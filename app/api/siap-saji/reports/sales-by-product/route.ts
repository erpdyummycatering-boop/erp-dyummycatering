import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const timeUnit = p.get("time_unit") || "month"; // "date" | "week" | "month" | "year"
  const dateFrom = p.get("date_from");
  const dateTo = p.get("date_to");
  const search = p.get("search") || "";

  const client = await pool.connect();
  try {
    const wheres: string[] = ["o.lini = 'siap_saji'", "o.status_order <> 'Dibatalkan'"];
    const vals: any[] = [];
    let idx = 1;

    if (dateFrom) {
      wheres.push(`o.delivery_date >= $${idx}::date`);
      vals.push(dateFrom);
      idx++;
    }
    if (dateTo) {
      wheres.push(`o.delivery_date <= $${idx}::date`);
      vals.push(dateTo);
      idx++;
    }
    if (search.trim()) {
      wheres.push(`(pr.name ILIKE $${idx} OR pr.sku ILIKE $${idx})`);
      vals.push(`%${search.trim()}%`);
      idx++;
    }

    const whereSql = wheres.join(" AND ");

    // 1. Aggregated by Product (Tabel Utama: No, Produk, Qty, Angka Rupiah)
    const productsRes = await client.query(
      `SELECT 
        pr.id AS product_id,
        pr.sku,
        pr.name AS product_name,
        pr.is_half_portion,
        COALESCE(cat.name, 'Umum') AS category_name,
        SUM(oi.quantity)::int AS total_qty,
        SUM(oi.subtotal)::numeric AS total_omset,
        ROUND(AVG(oi.price))::numeric AS avg_price
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN products pr ON oi.product_id = pr.id
       LEFT JOIN categories cat ON pr.category_id = cat.id
       WHERE ${whereSql}
       GROUP BY pr.id, pr.sku, pr.name, pr.is_half_portion, cat.name
       ORDER BY total_omset DESC`,
      vals
    );

    // 2. Horizontal Time Series for Chart (Metrik horizontal waktu: tgl / pekan / bulan / tahun)
    let timeGroupExpr = "";
    let timeLabelExpr = "";
    let timeOrderExpr = "";

    if (timeUnit === "date") {
      timeGroupExpr = "o.delivery_date";
      timeLabelExpr = "TO_CHAR(o.delivery_date, 'DD Mon YYYY')";
      timeOrderExpr = "o.delivery_date ASC";
    } else if (timeUnit === "week") {
      timeGroupExpr = "DATE_TRUNC('week', o.delivery_date)";
      timeLabelExpr = "'Pekan ' || TO_CHAR(DATE_TRUNC('week', o.delivery_date), 'WW, Mon YYYY')";
      timeOrderExpr = "DATE_TRUNC('week', o.delivery_date) ASC";
    } else if (timeUnit === "year") {
      timeGroupExpr = "TO_CHAR(o.delivery_date, 'YYYY')";
      timeLabelExpr = "TO_CHAR(o.delivery_date, 'YYYY')";
      timeOrderExpr = "TO_CHAR(o.delivery_date, 'YYYY') ASC";
    } else {
      // default: month
      timeGroupExpr = "DATE_TRUNC('month', o.delivery_date)";
      timeLabelExpr = "TO_CHAR(DATE_TRUNC('month', o.delivery_date), 'Mon YYYY')";
      timeOrderExpr = "DATE_TRUNC('month', o.delivery_date) ASC";
    }

    const timeSeriesRes = await client.query(
      `SELECT 
        ${timeLabelExpr} AS time_label,
        SUM(oi.quantity)::int AS total_qty,
        SUM(oi.subtotal)::numeric AS total_omset
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN products pr ON oi.product_id = pr.id
       WHERE ${whereSql}
       GROUP BY ${timeGroupExpr}
       ORDER BY ${timeOrderExpr}`,
      vals
    );

    return NextResponse.json({
      products: productsRes.rows,
      time_series: timeSeriesRes.rows,
      summary: {
        total_products: productsRes.rows.length,
        total_qty: productsRes.rows.reduce((sum, r) => sum + Number(r.total_qty || 0), 0),
        total_omset: productsRes.rows.reduce((sum, r) => sum + Number(r.total_omset || 0), 0),
      },
    });
  } catch (error: any) {
    console.error("Gagal mengambil laporan penjualan produk:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
