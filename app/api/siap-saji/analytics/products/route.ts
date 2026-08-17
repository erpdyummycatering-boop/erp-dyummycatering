import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const period = p.get("period") || "week"; // week | month | all | custom
  const dateFrom = p.get("date_from");
  const dateTo = p.get("date_to");

  let dateFilter = "";
  if (dateFrom && dateTo) {
    dateFilter = `AND o.delivery_date >= '${dateFrom}'::date AND o.delivery_date <= '${dateTo}'::date`;
  } else if (dateFrom) {
    dateFilter = `AND o.delivery_date >= '${dateFrom}'::date`;
  } else if (dateTo) {
    dateFilter = `AND o.delivery_date <= '${dateTo}'::date`;
  } else if (period === "week") {
    dateFilter = "AND o.delivery_date >= CURRENT_DATE - INTERVAL '7 days'";
  } else if (period === "month") {
    dateFilter = "AND o.delivery_date >= date_trunc('month', CURRENT_DATE)";
  }

  const client = await pool.connect();
  try {
    // Top 10 Best Selling Products by Quantity
    const top10QtyRes = await client.query(
      `SELECT 
        p.name AS name,
        p.is_half_portion,
        SUM(oi.quantity)::int AS total_qty,
        SUM(oi.subtotal)::numeric AS total_omset,
        ROUND(AVG(oi.price)) AS avg_price
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN products p ON oi.product_id = p.id
       WHERE o.lini = 'siap_saji' AND o.status_order <> 'Dibatalkan' ${dateFilter}
       GROUP BY p.id, p.name, p.is_half_portion
       ORDER BY total_qty DESC LIMIT 10`
    );

    // Top 10 Best Selling Products by Omset (Revenue)
    const top10OmsetRes = await client.query(
      `SELECT 
        p.name AS name,
        p.is_half_portion,
        SUM(oi.quantity)::int AS total_qty,
        SUM(oi.subtotal)::numeric AS total_omset,
        ROUND(AVG(oi.price)) AS avg_price
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN products p ON oi.product_id = p.id
       WHERE o.lini = 'siap_saji' AND o.status_order <> 'Dibatalkan' ${dateFilter}
       GROUP BY p.id, p.name, p.is_half_portion
       ORDER BY total_omset DESC LIMIT 10`
    );

    // Metric Summary Cards
    const summaryRes = await client.query(
      `SELECT 
        COALESCE(SUM(oi.quantity), 0) AS total_pcs_terjual,
        COALESCE(SUM(oi.subtotal), 0) AS total_penjualan,
        COALESCE(ROUND(AVG(oi.price)), 0) AS rata_rata_harga
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.lini = 'siap_saji' AND o.status_order <> 'Dibatalkan' ${dateFilter}`
    );

    return NextResponse.json({
      top_10: top10QtyRes.rows,
      top_10_qty: top10QtyRes.rows,
      top_10_omset: top10OmsetRes.rows,
      summary: {
        total_pcs_terjual: Number(summaryRes.rows[0]?.total_pcs_terjual || 0),
        total_penjualan: Number(summaryRes.rows[0]?.total_penjualan || 0),
        rata_rata_harga: Number(summaryRes.rows[0]?.rata_rata_harga || 0),
      },
    });
  } catch (error: any) {
    console.error("Gagal mengambil data analitik produk:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
