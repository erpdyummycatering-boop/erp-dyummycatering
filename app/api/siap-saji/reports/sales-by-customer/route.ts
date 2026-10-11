import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
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
      wheres.push(`(c.name ILIKE $${idx} OR c.phone ILIKE $${idx} OR a.kecamatan ILIKE $${idx})`);
      vals.push(`%${search.trim()}%`);
      idx++;
    }

    const whereSql = wheres.join(" AND ");

    // 1. Aggregated by Customer (Nama Customer, Qty, Angka Rupiah, Frekuensi Order)
    // Avoid Cartesian multiplication between orders and order_items
    const customerRes = await client.query(
      `SELECT 
        c.id AS customer_id,
        c.name AS customer_name,
        c.phone AS customer_phone,
        a.kecamatan AS area_kecamatan,
        COUNT(DISTINCT o.id)::int AS total_orders,
        COALESCE(
          (SELECT SUM(oi.quantity)::int 
           FROM order_items oi 
           JOIN orders o2 ON oi.order_id = o2.id 
           WHERE o2.customer_id = c.id 
             AND o2.lini = 'siap_saji' 
             AND o2.status_order <> 'Dibatalkan'
             ${dateFrom ? `AND o2.delivery_date >= '${dateFrom}'::date` : ""}
             ${dateTo ? `AND o2.delivery_date <= '${dateTo}'::date` : ""}
          ), 0
        ) AS total_qty,
        COALESCE(SUM(o.grand_total), 0)::numeric AS total_omset,
        MAX(o.delivery_date) AS last_order_date
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       LEFT JOIN areas a ON c.area_id = a.id
       WHERE ${whereSql}
       GROUP BY c.id, c.name, c.phone, a.kecamatan
       ORDER BY total_omset DESC`,
      vals
    );

    // 2. Chart Metrik Customer: Top Customers (Nama Customer, Qty, Angka Rupiah)
    const chartRes = await client.query(
      `SELECT 
        c.name AS customer_name,
        COALESCE(
          (SELECT SUM(oi.quantity)::int 
           FROM order_items oi 
           JOIN orders o2 ON oi.order_id = o2.id 
           WHERE o2.customer_id = c.id 
             AND o2.lini = 'siap_saji' 
             AND o2.status_order <> 'Dibatalkan'
             ${dateFrom ? `AND o2.delivery_date >= '${dateFrom}'::date` : ""}
             ${dateTo ? `AND o2.delivery_date <= '${dateTo}'::date` : ""}
          ), 0
        ) AS total_qty,
        COALESCE(SUM(o.grand_total), 0)::numeric AS total_omset
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE ${whereSql}
       GROUP BY c.id, c.name
       ORDER BY total_omset DESC
       LIMIT 15`,
      vals
    );

    const customers = customerRes.rows;

    return NextResponse.json({
      customers,
      chart_data: chartRes.rows,
      summary: {
        total_customers: customers.length,
        total_orders: customers.reduce((sum, r) => sum + Number(r.total_orders || 0), 0),
        total_qty: customers.reduce((sum, r) => sum + Number(r.total_qty || 0), 0),
        total_omset: customers.reduce((sum, r) => sum + Number(r.total_omset || 0), 0),
      },
    });
  } catch (error: any) {
    console.error("Gagal mengambil laporan penjualan customer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
