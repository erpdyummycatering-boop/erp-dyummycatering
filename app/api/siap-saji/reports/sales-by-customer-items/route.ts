import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const dateFrom = p.get("date_from") || new Date().toISOString().split("T")[0];
  const dateTo = p.get("date_to") || dateFrom;
  const channelParam = p.get("channel") || "";
  const channelList = channelParam
    ? channelParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const search = p.get("search") || "";

  const client = await pool.connect();
  try {
    const wheres: string[] = [
      "o.lini = 'siap_saji'",
      "o.status_order <> 'Dibatalkan'",
    ];
    const vals: any[] = [];
    let idx = 1;

    if (dateFrom) {
      wheres.push(`COALESCE(o.delivery_date::date, o.order_date::date) >= $${idx}::date`);
      vals.push(dateFrom);
      idx++;
    }
    if (dateTo) {
      wheres.push(`COALESCE(o.delivery_date::date, o.order_date::date) <= $${idx}::date`);
      vals.push(dateTo);
      idx++;
    }
    if (channelList.length > 0) {
      wheres.push(`ch.name = ANY($${idx}::text[])`);
      vals.push(channelList);
      idx++;
    }
    if (search.trim()) {
      wheres.push(`(c.name ILIKE $${idx} OR p.name ILIKE $${idx} OR c.phone ILIKE $${idx})`);
      vals.push(`%${search.trim()}%`);
      idx++;
    }

    const whereSql = wheres.join(" AND ");

    const res = await client.query(
      `SELECT 
        COALESCE(o.delivery_date::date, o.order_date::date)::text AS tanggal,
        c.id AS customer_id,
        c.name AS customer_name,
        c.phone AS customer_phone,
        o.id AS order_id,
        o.no_struk,
        COALESCE(o.shipping_fee, 0)::numeric AS shipping_fee,
        COALESCE(o.discount_value, 0)::numeric AS discount_value,
        COALESCE(o.grand_total, 0)::numeric AS grand_total,
        COALESCE(ch.name, 'Direct') AS channel_name,
        oi.id AS item_id,
        p.name AS product_name,
        COALESCE(oi.quantity, 0)::int AS quantity,
        COALESCE(oi.price, 0)::numeric AS price,
        COALESCE(oi.subtotal, 0)::numeric AS subtotal
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN channels ch ON ch.id = o.channel_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE ${whereSql}
      ORDER BY tanggal ASC, c.name ASC, o.id ASC, oi.id ASC`,
      vals
    );

    // Grouping structure: by Date -> by Customer -> items & shipping
    const dateMap = new Map<string, Map<string, {
      customer_id: string;
      customer_name: string;
      customer_phone: string;
      channels: Set<string>;
      ordersSeen: Set<string>;
      items: Array<{
        nama_barang: string;
        satuan: string;
        kuantitas: number;
        penjualan: number;
      }>;
    }>>();

    const uniqueOrders = new Set<string>();
    const uniqueCustomers = new Set<string>();

    for (const row of res.rows) {
      const dateKey = row.tanggal;
      const custKey = `${row.customer_id}_${row.customer_name}`;
      uniqueOrders.add(String(row.order_id));
      uniqueCustomers.add(String(row.customer_id));

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, new Map());
      }
      const custMap = dateMap.get(dateKey)!;

      if (!custMap.has(custKey)) {
        custMap.set(custKey, {
          customer_id: String(row.customer_id),
          customer_name: row.customer_name,
          customer_phone: row.customer_phone || "",
          channels: new Set(),
          ordersSeen: new Set(),
          items: [],
        });
      }
      const custObj = custMap.get(custKey)!;
      if (row.channel_name) custObj.channels.add(row.channel_name);

      // Add product item if exists
      if (row.product_name) {
        custObj.items.push({
          nama_barang: row.product_name,
          satuan: "Pax",
          kuantitas: Number(row.quantity || 1),
          penjualan: Number(row.subtotal || 0),
        });
      }

      // Check if order shipping / discount needs to be added once per order
      const orderKey = String(row.order_id);
      if (!custObj.ordersSeen.has(orderKey)) {
        custObj.ordersSeen.add(orderKey);

        const shippingFee = Number(row.shipping_fee || 0);
        if (shippingFee > 0) {
          custObj.items.push({
            nama_barang: "Biaya Kirim",
            satuan: "Kirim",
            kuantitas: 1,
            penjualan: shippingFee,
          });
        }

        const discountValue = Number(row.discount_value || 0);
        if (discountValue > 0) {
          custObj.items.push({
            nama_barang: "Diskon Penjualan",
            satuan: "Potongan",
            kuantitas: 1,
            penjualan: -discountValue,
          });
        }
      }
    }

    // Convert map to nested JSON response
    let grandTotalQty = 0;
    let grandTotalSales = 0;

    const datesResult = Array.from(dateMap.entries()).map(([tanggal, custMap]) => {
      let dateTotalQty = 0;
      let dateTotalSales = 0;

      const customers = Array.from(custMap.values()).map((c) => {
        const totalQty = c.items.reduce((s, it) => s + (it.satuan === "Pax" || it.satuan === "Kirim" ? it.kuantitas : 0), 0);
        const totalPenjualan = c.items.reduce((s, it) => s + it.penjualan, 0);

        dateTotalQty += totalQty;
        dateTotalSales += totalPenjualan;

        return {
          customer_id: c.customer_id,
          customer_name: c.customer_name,
          customer_phone: c.customer_phone,
          channels: Array.from(c.channels),
          items: c.items,
          total_kuantitas: totalQty,
          total_penjualan: totalPenjualan,
        };
      });

      grandTotalQty += dateTotalQty;
      grandTotalSales += dateTotalSales;

      return {
        tanggal,
        customers,
        total_kuantitas: dateTotalQty,
        total_penjualan: dateTotalSales,
      };
    });

    return NextResponse.json({
      date_from: dateFrom,
      date_to: dateTo,
      channel: channelList.length > 0 ? channelList.join(", ") : "Semua Channel",
      dates: datesResult,
      summary: {
        total_dates: datesResult.length,
        total_customers: uniqueCustomers.size,
        total_orders: uniqueOrders.size,
        grand_total_qty: grandTotalQty,
        grand_total_sales: grandTotalSales,
      },
    });
  } catch (error: any) {
    console.error("Gagal memuat laporan penjualan pelanggan per barang:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
