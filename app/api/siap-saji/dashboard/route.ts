import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const client = await pool.connect();
  try {
    const todayStr = "2026-06-18"; // Matching seed date

    // 1. Today Stats
    const statsRes = await client.query(
      `SELECT 
        COALESCE(SUM(grand_total), 0) AS total_omset,
        COUNT(*) AS total_orders,
        COALESCE(AVG(grand_total), 0) AS avg_order_value
       FROM orders
       WHERE lini = 'siap_saji' AND delivery_date = $1 AND status_order <> 'Dibatalkan'`,
      [todayStr]
    );

    // 2. Top Channel & Total Pcs Sold Today
    const [channelRes, pcsRes] = await Promise.all([
      client.query(
        `SELECT ch.name AS channel_name, COUNT(o.id) AS order_count
         FROM orders o
         JOIN channels ch ON o.channel_id = ch.id
         WHERE o.lini = 'siap_saji' AND o.delivery_date = $1 AND o.status_order <> 'Dibatalkan'
         GROUP BY ch.name
         ORDER BY order_count DESC LIMIT 1`,
        [todayStr]
      ),
      client.query(
        `SELECT COALESCE(SUM(oi.quantity), 0) AS total_pcs
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.lini = 'siap_saji' AND o.delivery_date = $1 AND o.status_order <> 'Dibatalkan'`,
        [todayStr]
      ),
    ]);

    // 3. 7-Day Sales Trend
    const trendRes = await client.query(
      `SELECT 
        TO_CHAR(delivery_date, 'DD Mon') AS date_label,
        delivery_date,
        COALESCE(SUM(grand_total), 0) AS omset,
        COUNT(id) AS order_count
       FROM orders
       WHERE lini = 'siap_saji' AND status_order <> 'Dibatalkan'
       GROUP BY delivery_date
       ORDER BY delivery_date ASC
       LIMIT 7`
    );

    // 4. Top 5 Products
    const topProductsRes = await client.query(
      `SELECT 
        p.name AS name,
        SUM(oi.quantity) AS total_qty,
        SUM(oi.subtotal) AS total_omset
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN products p ON oi.product_id = p.id
       WHERE o.lini = 'siap_saji' AND o.status_order <> 'Dibatalkan'
       GROUP BY p.id, p.name
       ORDER BY total_qty DESC LIMIT 5`
    );

    // 5. Top 5 Customers
    const topCustomersRes = await client.query(
      `SELECT 
        c.name,
        c.phone,
        COUNT(o.id) AS total_orders,
        SUM(o.grand_total) AS total_omset
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.lini = 'siap_saji' AND o.status_order <> 'Dibatalkan'
       GROUP BY c.id, c.name, c.phone
       ORDER BY total_omset DESC LIMIT 5`
    );

    return NextResponse.json({
      today: {
        total_omset: Number(statsRes.rows[0]?.total_omset || 0),
        total_orders: Number(statsRes.rows[0]?.total_orders || 0),
        avg_order_value: Number(statsRes.rows[0]?.avg_order_value || 0),
        top_channel: channelRes.rows[0]?.channel_name || "Gojek Offline",
        total_pcs: Number(pcsRes.rows[0]?.total_pcs || 0),
      },
      trend: trendRes.rows,
      top_products: topProductsRes.rows,
      top_customers: topCustomersRes.rows,
    });
  } catch (error: any) {
    console.error("Gagal mengambil data dashboard Siap Saji:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
