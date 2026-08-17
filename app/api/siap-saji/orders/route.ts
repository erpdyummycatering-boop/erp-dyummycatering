import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const search = p.get("search") || "";
  const status_order = p.get("status_order") || "";
  const status_payment = p.get("status_payment") || "";
  const channel_id = p.get("channel_id") || "";
  const product_id = p.get("product_id") || "";
  const date_from = p.get("date_from") || "";
  const date_to = p.get("date_to") || "";
  const sort_by = p.get("sort_by") || "order_date";
  const sort_dir = (p.get("sort_dir") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  let orderColumn = "o.order_date";
  if (sort_by === "delivery_date") orderColumn = "o.delivery_date";
  if (sort_by === "no_struk") orderColumn = "o.no_struk";
  if (sort_by === "grand_total") orderColumn = "o.grand_total";

  const wheres: string[] = ["o.lini = 'siap_saji'"];
  const vals: any[] = [];
  let idx = 1;

  if (search) {
    wheres.push(`(c.name ILIKE $${idx} OR o.no_struk ILIKE $${idx} OR c.phone ILIKE $${idx})`);
    vals.push(`%${search}%`);
    idx++;
  }
  if (status_order) {
    wheres.push(`o.status_order = $${idx}`);
    vals.push(status_order);
    idx++;
  }
  if (status_payment) {
    wheres.push(`o.status_payment = $${idx}`);
    vals.push(status_payment);
    idx++;
  }
  if (channel_id) {
    wheres.push(`o.channel_id = $${idx}`);
    vals.push(Number(channel_id));
    idx++;
  }
  if (product_id) {
    wheres.push(`EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.product_id = $${idx})`);
    vals.push(Number(product_id));
    idx++;
  }
  if (date_from) {
    wheres.push(`o.delivery_date >= $${idx}`);
    vals.push(date_from);
    idx++;
  }
  if (date_to) {
    wheres.push(`o.delivery_date <= $${idx}`);
    vals.push(date_to);
    idx++;
  }

  const whereSql = wheres.length ? "WHERE " + wheres.join(" AND ") : "";

  const client = await pool.connect();
  try {
    const todayStr = new Date().toISOString().split("T")[0];

    const [countRes, dataRes, statsRes] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM orders o JOIN customers c ON o.customer_id = c.id ${whereSql}`, vals),
      client.query(
        `SELECT 
          o.*,
          c.name AS customer_name,
          c.phone AS customer_phone,
          c.address AS customer_address,
          c.patokan AS customer_patokan,
          a.kecamatan AS area_kecamatan,
          a.kota AS area_kota,
          ch.name AS channel_name,
          u.name AS pic_name,
          (
            SELECT json_agg(
              json_build_object(
                'id', oi.id,
                'product_id', oi.product_id,
                'product_name', pr.name,
                'sku', pr.sku,
                'is_half_portion', pr.is_half_portion,
                'price', oi.price,
                'quantity', oi.quantity,
                'discount', oi.discount,
                'subtotal', oi.subtotal,
                'notes', oi.notes
              )
            )
            FROM order_items oi
            LEFT JOIN products pr ON oi.product_id = pr.id
            WHERE oi.order_id = o.id
          ) AS items
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        LEFT JOIN channels ch ON o.channel_id = ch.id
        LEFT JOIN areas a ON c.area_id = a.id
        LEFT JOIN users u ON o.pic_id = u.id
        ${whereSql}
        ORDER BY ${orderColumn} ${sort_dir}, o.id ${sort_dir}
        LIMIT $${idx} OFFSET $${idx + 1}`,
        [...vals, limit, offset]
      ),
      client.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN o.status_order <> 'Dibatalkan' THEN o.grand_total ELSE 0 END), 0) AS total_penjualan,
          COUNT(CASE WHEN o.status_order <> 'Dibatalkan' THEN 1 END) AS total_orders,
          COUNT(CASE WHEN o.status_order <> 'Dibatalkan' AND o.delivery_date = $1 THEN 1 END) AS orders_today
        FROM orders o
        WHERE o.lini = 'siap_saji'
      `, [todayStr]),
    ]);

    const total = Number(countRes.rows[0].count);
    return NextResponse.json({
      data: dataRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        total_penjualan: Number(statsRes.rows[0].total_penjualan),
        total_orders: Number(statsRes.rows[0].total_orders),
        orders_today: Number(statsRes.rows[0].orders_today),
      },
    });
  } catch (error: any) {
    console.error("Gagal mengambil daftar order Siap Saji:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id || null;

  const body = await req.json();
  const {
    channel_id,
    customer_id,
    customer_name,
    customer_phone,
    address,
    patokan,
    area_id,
    order_date,
    delivery_date,
    departure_time,
    arrival_time,
    shipping_fee,
    payment_bank_id,
    order_notes,
    items,
  } = body;

  if (!channel_id) {
    return NextResponse.json({ error: "Channel penjualan wajib dipilih." }, { status: 400 });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Order harus memiliki minimal 1 item produk." }, { status: 400 });
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const finalOrderDate = order_date || todayStr;
  const finalDeliveryDate = delivery_date || todayStr;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Resolve Customer
    let finalCustomerId = customer_id;
    if (finalCustomerId === "new" || !finalCustomerId) {
      if (!customer_name || !customer_phone || !area_id) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Nama, No Telepon, dan Kecamatan wajib diisi untuk customer baru." },
          { status: 400 }
        );
      }
      const existRes = await client.query("SELECT id FROM customers WHERE phone = $1", [customer_phone.trim()]);
      if (existRes.rows.length > 0) {
        finalCustomerId = existRes.rows[0].id;
        // Update customer details if provided
        await client.query(
          `UPDATE customers 
           SET name = $1, address = COALESCE($2, address), patokan = COALESCE($3, patokan), area_id = COALESCE($4, area_id), lini = 'siap_saji'
           WHERE id = $5`,
          [customer_name.trim(), address || null, patokan || null, area_id ? Number(area_id) : null, finalCustomerId]
        );
      } else {
        const insCustRes = await client.query(
          `INSERT INTO customers (name, phone, type, address, patokan, area_id, lini, status)
           VALUES ($1, $2, 'Personal', $3, $4, $5, 'siap_saji', 'Aktif')
           RETURNING id`,
          [customer_name.trim(), customer_phone.trim(), address || null, patokan || null, area_id ? Number(area_id) : null]
        );
        finalCustomerId = insCustRes.rows[0].id;
      }
    } else {
      // Update existing customer patokan/address if provided
      if (address || patokan || area_id) {
        await client.query(
          `UPDATE customers 
           SET address = COALESCE($1, address), patokan = COALESCE($2, patokan), area_id = COALESCE($3, area_id)
           WHERE id = $4`,
          [address || null, patokan || null, area_id ? Number(area_id) : null, finalCustomerId]
        );
      }
    }

    // 2. Lookup Area Snapshot for Zone
    let snapshotZone = "dalam_kota";
    const areaRes = await client.query(
      "SELECT a.id, a.shipping_zone FROM customers c JOIN areas a ON c.area_id = a.id WHERE c.id = $1",
      [finalCustomerId]
    );
    if (areaRes.rows.length > 0) {
      snapshotZone = areaRes.rows[0].shipping_zone;
    }

    // 3. Resolve Shipping Fee (use function get_shipping_fee if not explicitly overridden)
    let finalShippingFee = Number(shipping_fee);
    if (isNaN(finalShippingFee)) {
      const custAreaRes = await client.query("SELECT area_id FROM customers WHERE id = $1", [finalCustomerId]);
      const custAreaId = custAreaRes.rows[0]?.area_id;
      if (custAreaId) {
        const feeRes = await client.query("SELECT public.get_shipping_fee($1, $2) AS fee", [custAreaId, Number(channel_id)]);
        finalShippingFee = Number(feeRes.rows[0]?.fee || 0);
      } else {
        finalShippingFee = 0;
      }
    }

    // 4. Resolve Bank Account Details
    let paymentBankName = "BCA";
    let paymentAccountNo = "2832835545";
    let kasBankId = payment_bank_id;

    if (kasBankId) {
      const kasRes = await client.query("SELECT * FROM kas_bank WHERE id = $1", [kasBankId]);
      if (kasRes.rows.length > 0) {
        paymentBankName = kasRes.rows[0].nama_bank || kasRes.rows[0].nama_rekening;
        paymentAccountNo = kasRes.rows[0].no_rekening || "";
      }
    } else {
      const defKasRes = await client.query(
        "SELECT * FROM kas_bank WHERE lini = 'siap_saji' AND is_payment_default = true LIMIT 1"
      );
      if (defKasRes.rows.length > 0) {
        kasBankId = defKasRes.rows[0].id;
        paymentBankName = defKasRes.rows[0].nama_bank || defKasRes.rows[0].nama_rekening;
        paymentAccountNo = defKasRes.rows[0].no_rekening || "";
      }
    }

    // 5. Generate Atomic Struk Counter (SI.YYYY.MM.XXXXX)
    const [yearStr, monthStr] = finalDeliveryDate.split("-");
    const counterKey = `ss_struk_counter_${yearStr}_${monthStr}`;

    const settingRes = await client.query("SELECT value FROM settings WHERE key = $1 FOR UPDATE", [counterKey]);
    let currentCounter = 0;
    if (settingRes.rows.length > 0) {
      currentCounter = Number(settingRes.rows[0].value || 0);
    }
    const nextCounter = currentCounter + 1;
    await client.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [counterKey, String(nextCounter)]
    );

    const padCounter = String(nextCounter).padStart(5, "0");
    const noStruk = `SI.${yearStr}.${monthStr}.${padCounter}`;

    // 6. Calculate Grand Total
    const itemsSubtotal = items.reduce((sum: number, it: any) => {
      const qty = Number(it.quantity || 1);
      const prc = Number(it.price || 0);
      const disc = Number(it.discount || 0);
      return sum + (prc * qty - disc);
    }, 0);

    const grandTotal = itemsSubtotal + finalShippingFee;

    // Check Repeat Customer
    const prevOrdersRes = await client.query(
      "SELECT COUNT(*) FROM orders WHERE customer_id = $1 AND status_order <> 'Dibatalkan'",
      [finalCustomerId]
    );
    const jenisOrder = Number(prevOrdersRes.rows[0].count) > 0 ? "Repeat Order" : "New Order";

    // 7. Insert Order
    const insOrderRes = await client.query(
      `INSERT INTO orders (
        customer_id, pic_id, lini, channel_id, no_struk, order_date, delivery_date,
        departure_time, arrival_time, venue, order_notes, status_order, status_payment,
        shipping_fee, shipping_zone, grand_total, payment_bank, payment_account,
        input_source, jenis_order, closing_date
      )
      VALUES ($1, $2, 'siap_saji', $3, $4, $5, $6, $7, $8, $9, $10, 'Aktif', 'Lunas', $11, $12, $13, $14, $15, 'manual', $16, $17)
      RETURNING *`,
      [
        finalCustomerId,
        userId,
        Number(channel_id),
        noStruk,
        finalOrderDate,
        finalDeliveryDate,
        departure_time || "06:30",
        arrival_time || "07:00",
        address || null,
        order_notes || null,
        finalShippingFee,
        snapshotZone,
        grandTotal,
        paymentBankName,
        paymentAccountNo,
        jenisOrder,
        finalOrderDate,
      ]
    );
    const orderId = insOrderRes.rows[0].id;

    // 8. Insert Order Items
    for (const it of items) {
      const qty = Number(it.quantity || 1);
      const prc = Number(it.price || 0);
      const disc = Number(it.discount || 0);
      const subtotal = prc * qty - disc;
      await client.query(
        `INSERT INTO order_items (order_id, product_id, price, quantity, discount, subtotal, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, Number(it.product_id), prc, qty, disc, subtotal, it.notes || null]
      );
    }

    // 9. Accounting Journal & Kas Mutasi
    // Lookup Accounts:
    // Credit Account: Pendapatan Penjualan SS (4-1001)
    const coaKreditRes = await client.query(
      "SELECT id FROM coa WHERE kode_akun = '4-1001' AND lini = 'siap_saji' LIMIT 1"
    );
    // Debit Account: Depends on bank (1-1002 BCA, 1-1003 Mandiri, 1-1001 Kas)
    let debitKode = "1-1002";
    if (paymentBankName.toUpperCase().includes("MANDIRI")) debitKode = "1-1003";
    else if (paymentBankName.toUpperCase().includes("KAS")) debitKode = "1-1001";

    const coaDebitRes = await client.query(
      "SELECT id FROM coa WHERE kode_akun = $1 AND lini = 'siap_saji' LIMIT 1",
      [debitKode]
    );

    if (coaDebitRes.rows.length > 0 && coaKreditRes.rows.length > 0) {
      const debitId = coaDebitRes.rows[0].id;
      const kreditId = coaKreditRes.rows[0].id;

      const journalRes = await client.query(
        `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan)
         VALUES ('siap_saji', $1, 'penjualan', $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          finalOrderDate,
          orderId,
          noStruk,
          debitId,
          kreditId,
          grandTotal,
          `Penjualan Siap Saji ${noStruk} - ${paymentBankName}`,
        ]
      );

      const journalId = journalRes.rows[0].id;
      await client.query("UPDATE orders SET journal_id = $1 WHERE id = $2", [journalId, orderId]);
    }

    // Kas Mutasi
    if (kasBankId) {
      await client.query(
        `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
         VALUES ($1, 'siap_saji', $2, 'Masuk', $3, 'penjualan', $4, $5)`,
        [kasBankId, finalOrderDate, grandTotal, orderId, `Penjualan SS ${noStruk}`]
      );
      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini + $1, updated_at = NOW() WHERE id = $2",
        [grandTotal, kasBankId]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json(insOrderRes.rows[0], { status: 201 });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal menyimpan order Siap Saji:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
