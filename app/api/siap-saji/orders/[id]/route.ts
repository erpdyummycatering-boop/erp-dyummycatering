import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = Number(id);
  if (isNaN(orderId)) {
    return NextResponse.json({ error: "ID order tidak valid" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const orderRes = await client.query(
      `SELECT 
        o.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.address AS customer_address,
        c.patokan AS customer_patokan,
        c.area_id,
        a.kecamatan AS area_kecamatan,
        a.kota AS area_kota,
        ch.name AS channel_name,
        u.name AS pic_name,
        cb.name AS cancelled_by_name,
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
      LEFT JOIN users cb ON o.cancelled_by = cb.id
      WHERE o.id = $1 AND o.lini = 'siap_saji'`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(orderRes.rows[0]);
  } catch (error: any) {
    console.error("Gagal mengambil detail order:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = Number(id);
  if (isNaN(orderId)) {
    return NextResponse.json({ error: "ID order tidak valid" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const body = await req.json();
    const {
      channel_id,
      kas_bank_id,
      delivery_date,
      customer_name,
      customer_phone,
      customer_address,
      customer_patokan,
      area_id,
      shipping_fee,
      discount,
      items,
    } = body;

    if (!customer_name || !customer_phone) {
      return NextResponse.json({ error: "Nama dan No WhatsApp pelanggan wajib diisi." }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Order wajib memiliki minimal 1 item produk." }, { status: 400 });
    }

    await client.query("BEGIN");

    // 1. Verify Order Exists
    const existingOrderRes = await client.query("SELECT * FROM orders WHERE id = $1 AND lini = 'siap_saji' FOR UPDATE", [orderId]);
    if (existingOrderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
    }
    const existingOrder = existingOrderRes.rows[0];

    // 2. Update Customer Details
    await client.query(
      `UPDATE customers
       SET name = $1, phone = $2, address = $3, patokan = $4, area_id = $5
       WHERE id = $6`,
      [customer_name, customer_phone, customer_address || "-", customer_patokan || "", area_id || null, existingOrder.customer_id]
    );

    // 3. Calculate Item Subtotals & Order Totals
    let itemsTotal = 0;
    const processedItems = items.map((it: any) => {
      const pId = Number(it.product_id);
      const qty = Math.max(1, Number(it.quantity || 1));
      const price = Number(it.price || 0);
      const subtotal = qty * price;
      itemsTotal += subtotal;
      return {
        product_id: pId,
        price,
        quantity: qty,
        subtotal,
        notes: it.notes ? String(it.notes).trim() : "",
      };
    });

    const shipFee = Number(shipping_fee || 0);
    const discVal = Number(discount || 0);
    const grandTotal = Math.max(0, itemsTotal + shipFee - discVal);

    // Resolve Bank details if kas_bank_id provided
    let paymentBankName = existingOrder.payment_bank || "BCA";
    let paymentAccountNo = existingOrder.payment_account || "";
    if (kas_bank_id) {
      const kasRes = await client.query("SELECT * FROM kas_bank WHERE id = $1", [kas_bank_id]);
      if (kasRes.rows.length > 0) {
        paymentBankName = kasRes.rows[0].nama_bank || kasRes.rows[0].nama_rekening;
        paymentAccountNo = kasRes.rows[0].no_rekening || "";
      }
    }

    // 4. Update Order Record
    await client.query(
      `UPDATE orders
       SET channel_id = $1,
           delivery_date = $2::date,
           shipping_fee = $3,
           discount = $4,
           grand_total = $5,
           payment_bank = $6,
           payment_account = $7,
           updated_at = NOW()
       WHERE id = $8`,
      [
        channel_id || existingOrder.channel_id,
        delivery_date || existingOrder.delivery_date,
        shipFee,
        discVal,
        grandTotal,
        paymentBankName,
        paymentAccountNo,
        orderId,
      ]
    );

    // 5. Replace Order Items
    await client.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
    for (const item of processedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, price, quantity, subtotal, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, item.product_id, item.price, item.quantity, item.subtotal, item.notes]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      message: "Order berhasil diperbarui.",
      order_id: orderId,
      grand_total: grandTotal,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal memperbarui order:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = Number(id);
  if (isNaN(orderId)) {
    return NextResponse.json({ error: "ID order tidak valid" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id || null;

  const body = await req.json();
  const { action, cancel_reason } = body;

  if (action === "cancel") {
    if (!cancel_reason || cancel_reason.trim().length < 10) {
      return NextResponse.json(
        { error: "Alasan pembatalan wajib diisi minimal 10 karakter." },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existingRes = await client.query(
        "SELECT * FROM orders WHERE id = $1 AND lini = 'siap_saji' FOR UPDATE",
        [orderId]
      );
      if (existingRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
      }

      const order = existingRes.rows[0];
      if (order.status_order === "Dibatalkan") {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Order sudah dibatalkan sebelumnya." }, { status: 400 });
      }

      // Update Order status
      await client.query(
        `UPDATE orders
         SET status_order = 'Dibatalkan',
             cancel_reason = $1,
             cancelled_by = $2,
             cancelled_at = NOW()
         WHERE id = $3`,
        [cancel_reason.trim(), userId, orderId]
      );

      // Reverse Journal if journal exists
      if (order.journal_id) {
        const jRes = await client.query("SELECT * FROM journals WHERE id = $1", [order.journal_id]);
        if (jRes.rows.length > 0) {
          const origJ = jRes.rows[0];
          await client.query(
            `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan)
             VALUES ('siap_saji', CURRENT_DATE, 'koreksi', $1, $2, $3, $4, $5, $6)`,
            [
              orderId,
              order.no_struk,
              origJ.akun_kredit,
              origJ.akun_debit,
              origJ.nominal,
              `Pembatalan Order SS ${order.no_struk}: ${cancel_reason.trim()}`,
            ]
          );
        }
      }

      // Reverse Kas Mutasi & Saldo
      const mutasiRes = await client.query(
        "SELECT * FROM kas_mutasi WHERE ref_type = 'penjualan' AND ref_id = $1 LIMIT 1",
        [orderId]
      );
      if (mutasiRes.rows.length > 0) {
        const m = mutasiRes.rows[0];
        await client.query(
          `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
           VALUES ($1, 'siap_saji', CURRENT_DATE, 'Keluar', $2, 'koreksi', $3, $4)`,
          [m.kas_bank_id, m.nominal, orderId, `Batal ${order.no_struk}`]
        );
        await client.query(
          "UPDATE kas_bank SET saldo_kini = saldo_kini - $1, updated_at = NOW() WHERE id = $2",
          [m.nominal, m.kas_bank_id]
        );
      }

      await client.query("COMMIT");
      return NextResponse.json({ message: "Order berhasil dibatalkan.", order_id: orderId });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Gagal membatalkan order:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
      client.release();
    }
  }

  return NextResponse.json({ error: "Aksi tidak dikenali" }, { status: 400 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PATCH(req, { params });
}
