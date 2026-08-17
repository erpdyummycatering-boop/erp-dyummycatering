import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import * as XLSX from "xlsx";

const extractId = (val: any): number | null => {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str) return null;
  if (str.includes("|")) {
    const parts = str.split("|");
    const num = Number(parts[0].trim());
    return !isNaN(num) && num > 0 ? num : null;
  }
  const num = Number(str);
  return !isNaN(num) && num > 0 ? num : null;
};

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File excel wajib diunggah" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const sheetName = workbook.SheetNames.find((s) => s.toUpperCase().includes("DATA") || s.toUpperCase().includes("ORDER")) || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return NextResponse.json({ error: "Sheet DATA_ORDER tidak ditemukan pada file excel" }, { status: 400 });
    }

    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) {
      return NextResponse.json({ error: "File excel tidak berisi data order" }, { status: 400 });
    }

    // Skip header row (row index 0)
    const rawData = rows.slice(1).filter((r) => r && r.length > 0 && (r[1] || r[2]));

    if (rawData.length === 0) {
      return NextResponse.json({ error: "Tidak ada baris data valid yang terdeteksi" }, { status: 400 });
    }

    // Begin DB Transaction
    await client.query("BEGIN");

    let newCustomersCount = 0;
    let retainedCustomersCount = 0;
    let createdOrdersCount = 0;
    let insertedItemsCount = 0;

    // Grouping Map by `${phone}_${deliveryDate}`
    const orderGroupsMap = new Map<string, any>();

    for (const row of rawData) {
      const deliveryDateRaw = row[0] ? String(row[0]).trim() : new Date().toISOString().split("T")[0];
      let deliveryDate = deliveryDateRaw;
      if (typeof row[0] === "number") {
        const parsedD = XLSX.SSF.parse_date_code(row[0]);
        if (parsedD) {
          const m = String(parsedD.m).padStart(2, "0");
          const d = String(parsedD.d).padStart(2, "0");
          deliveryDate = `${parsedD.y}-${m}-${d}`;
        }
      }

      const customerName = row[1] ? String(row[1]).trim() : "Pelanggan Import";
      const customerPhone = row[2] ? String(row[2]).trim().replace(/[^0-9]/g, "") : "";
      const areaId = extractId(row[3]);
      const customerAddress = row[4] ? String(row[4]).trim() : "-";
      const customerPatokan = row[5] ? String(row[5]).trim() : "";
      const channelId = extractId(row[6]) || 1;
      const bankId = extractId(row[7]) || 1;
      const shippingFee = Number(row[8] || 0);
      const discount = Number(row[9] || 0);
      const productId = extractId(row[10]);
      const itemPrice = Number(row[11] || 0);
      const itemQty = Number(row[12] || 1);
      const itemNotes = row[13] ? String(row[13]).trim() : "";

      if (!customerPhone) {
        throw new Error(`Baris dengan nama customer "${customerName}" tidak memiliki No HP/WA yang valid.`);
      }
      if (!productId) {
        throw new Error(`Baris customer "${customerName}" tidak memiliki Produk ID yang valid (Format contoh: 421 | Beef Yakiniku).`);
      }

      const key = `${customerPhone}_${deliveryDate}`;

      if (!orderGroupsMap.has(key)) {
        orderGroupsMap.set(key, {
          deliveryDate,
          customerName,
          customerPhone,
          areaId,
          customerAddress,
          customerPatokan,
          channelId,
          bankId,
          shippingFee, // Shipping fee taken once per order/pengiriman
          discount,
          items: [],
        });
      }

      const group = orderGroupsMap.get(key);
      group.items.push({
        productId,
        price: itemPrice,
        quantity: itemQty,
        subtotal: itemPrice * itemQty,
        notes: itemNotes,
      });
    }

    // Process each grouped Order
    for (const [, group] of orderGroupsMap.entries()) {
      // 1. Customer Retention Check by Phone
      const custCheck = await client.query(
        "SELECT id FROM customers WHERE phone = $1 AND (lini = 'siap_saji' OR lini IS NULL) LIMIT 1",
        [group.customerPhone]
      );

      let customerId: number;
      if (custCheck.rows.length > 0) {
        customerId = custCheck.rows[0].id;
        retainedCustomersCount++;

        await client.query(
          `UPDATE customers 
           SET name = COALESCE(NULLIF($1, ''), name), 
               address = COALESCE(NULLIF($2, ''), address),
               patokan = COALESCE(NULLIF($3, ''), patokan),
               area_id = COALESCE($4, area_id)
           WHERE id = $5`,
          [group.customerName, group.customerAddress, group.customerPatokan, group.areaId, customerId]
        );
      } else {
        const newCustRes = await client.query(
          `INSERT INTO customers (name, phone, address, patokan, area_id, lini)
           VALUES ($1, $2, $3, $4, $5, 'siap_saji')
           RETURNING id`,
          [group.customerName, group.customerPhone, group.customerAddress, group.customerPatokan, group.areaId]
        );
        customerId = newCustRes.rows[0].id;
        newCustomersCount++;
      }

      // 2. Resolve Shipping Fee (use area_channel_shipping / get_shipping_fee if 0)
      let finalShippingFee = group.shippingFee;
      if (finalShippingFee === 0 && group.areaId && group.channelId) {
        try {
          const feeRes = await client.query(
            "SELECT shipping_fee FROM area_channel_shipping WHERE area_id = $1 AND channel_id = $2 AND is_active = true LIMIT 1",
            [group.areaId, group.channelId]
          );
          if (feeRes.rows.length > 0) {
            finalShippingFee = Number(feeRes.rows[0].shipping_fee || 0);
          } else {
            const funcFeeRes = await client.query("SELECT public.get_shipping_fee($1, $2) AS fee", [group.areaId, group.channelId]);
            finalShippingFee = Number(funcFeeRes.rows[0]?.fee || 0);
          }
        } catch {
          finalShippingFee = 0;
        }
      }

      // 3. Resolve Bank Account Details
      let paymentBankName = "BCA";
      let paymentAccountNo = "2832835545";
      if (group.bankId) {
        const kasRes = await client.query("SELECT * FROM kas_bank WHERE id = $1", [group.bankId]);
        if (kasRes.rows.length > 0) {
          paymentBankName = kasRes.rows[0].nama_bank || kasRes.rows[0].nama_rekening;
          paymentAccountNo = kasRes.rows[0].no_rekening || "";
        }
      }

      // 4. Calculate Order Totals
      let itemsTotal = 0;
      group.items.forEach((it: any) => {
        itemsTotal += it.subtotal;
      });

      const grandTotal = Math.max(0, itemsTotal + finalShippingFee - group.discount);

      // 5. Generate Struk Number: SI.YYYY.MM.XXXXX
      const todayDate = new Date();
      const yr = todayDate.getFullYear();
      const mo = String(todayDate.getMonth() + 1).padStart(2, "0");
      const strukSeqRes = await client.query("SELECT COUNT(*) FROM orders WHERE lini = 'siap_saji'");
      const seq = Number(strukSeqRes.rows[0].count) + 1;
      const noStruk = `SI.${yr}.${mo}.${String(seq).padStart(5, "0")}`;

      // 6. Insert Order
      const orderInsRes = await client.query(
        `INSERT INTO orders (
          no_struk, order_date, delivery_date, customer_id, channel_id,
          shipping_fee, discount, grand_total, payment_bank, payment_account,
          lini, status_order, status_payment
        ) VALUES (
          $1, CURRENT_DATE, $2::date, $3, $4,
          $5, $6, $7, $8, $9,
          'siap_saji', 'Aktif', 'Lunas'
        ) RETURNING id`,
        [
          noStruk,
          group.deliveryDate,
          customerId,
          group.channelId,
          finalShippingFee,
          group.discount,
          grandTotal,
          paymentBankName,
          paymentAccountNo,
        ]
      );

      const orderId = orderInsRes.rows[0].id;
      createdOrdersCount++;

      // 7. Insert Order Items
      for (const item of group.items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, price, quantity, subtotal, notes)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [orderId, item.productId, item.price, item.quantity, item.subtotal, item.notes]
        );
        insertedItemsCount++;
      }
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: `Berhasil mengimpor ${createdOrdersCount} transaksi (${insertedItemsCount} item produk).`,
      summary: {
        total_rows: rawData.length,
        created_orders: createdOrdersCount,
        inserted_items: insertedItemsCount,
        retained_customers: retainedCustomersCount,
        new_customers: newCustomersCount,
      },
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal import order dari excel:", error);
    return NextResponse.json({ error: error.message || "Gagal mengimpor data excel" }, { status: 500 });
  } finally {
    client.release();
  }
}
