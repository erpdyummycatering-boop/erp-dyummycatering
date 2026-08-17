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
        // Excel serial date conversion
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
      const channelId = extractId(row[6]) || 1; // Default Gojek Offline / Offline
      const bankId = extractId(row[7]) || 1;    // Default Kas/Bank
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
          shippingFee,
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

        // Update customer details if provided
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

      // 2. Calculate Order Totals
      let itemsTotal = 0;
      group.items.forEach((it: any) => {
        itemsTotal += it.subtotal;
      });

      const grandTotal = Math.max(0, itemsTotal + group.shippingFee - group.discount);

      // 3. Generate Struk Number: SI.YYYY.MM.XXXXX
      const todayDate = new Date();
      const yr = todayDate.getFullYear();
      const mo = String(todayDate.getMonth() + 1).padStart(2, "0");
      const strukSeqRes = await client.query("SELECT COUNT(*) FROM orders WHERE lini = 'siap_saji'");
      const seq = Number(strukSeqRes.rows[0].count) + 1;
      const noStruk = `SI.${yr}.${mo}.${String(seq).padStart(5, "0")}`;

      // 4. Insert Order
      const orderInsRes = await client.query(
        `INSERT INTO orders (
          no_struk, order_date, delivery_date, customer_id, channel_id, kas_bank_id,
          shipping_fee, discount, grand_total, lini, status_order, status_payment
        ) VALUES (
          $1, CURRENT_DATE, $2::date, $3, $4, $5,
          $6, $7, $8, 'siap_saji', 'Aktif', 'Lunas'
        ) RETURNING id`,
        [
          noStruk,
          group.deliveryDate,
          customerId,
          group.channelId,
          group.bankId,
          group.shippingFee,
          group.discount,
          grandTotal,
        ]
      );

      const orderId = orderInsRes.rows[0].id;
      createdOrdersCount++;

      // 5. Insert Order Items
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
