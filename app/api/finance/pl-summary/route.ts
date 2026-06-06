import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "7");

  const client = await pool.connect();
  try {
    // Daily P&L: Revenue (orders by delivery_date) vs BPP (PO actual cost) vs Overhead
    const plRes = await client.query(`
      WITH dates AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '${days - 1} days',
          CURRENT_DATE, '1 day'::interval
        )::date as dt
      ),
      daily_revenue AS (
        SELECT delivery_date, SUM(grand_total) as revenue
        FROM orders WHERE delivery_date >= CURRENT_DATE - INTERVAL '${days - 1} days'
        GROUP BY delivery_date
      ),
      daily_bpp AS (
        SELECT ps.target_date as bpp_date, SUM(po.total_actual_cost) as bpp
        FROM purchase_orders po
        JOIN purchase_requests pr ON po.pr_id = pr.id
        JOIN production_schedules ps ON pr.schedule_id = ps.id
        WHERE ps.target_date >= CURRENT_DATE - INTERVAL '${days - 1} days'
        GROUP BY ps.target_date
      ),
      daily_overhead AS (
        SELECT expense_date, SUM(amount) as overhead
        FROM overheads WHERE expense_date >= CURRENT_DATE - INTERVAL '${days - 1} days'
        GROUP BY expense_date
      )
      SELECT 
        TO_CHAR(d.dt, 'DD Mon') as date,
        d.dt as raw_date,
        COALESCE(r.revenue, 0) as revenue,
        COALESCE(b.bpp, 0) as bpp,
        COALESCE(oh.overhead, 0) as overhead,
        COALESCE(r.revenue, 0) - COALESCE(b.bpp, 0) - COALESCE(oh.overhead, 0) as gross_profit,
        CASE WHEN COALESCE(r.revenue, 0) > 0
          THEN ROUND(((COALESCE(r.revenue, 0) - COALESCE(b.bpp, 0) - COALESCE(oh.overhead, 0)) / COALESCE(r.revenue, 0)) * 100, 1)
          ELSE 0 END as margin
      FROM dates d
      LEFT JOIN daily_revenue r ON r.delivery_date = d.dt
      LEFT JOIN daily_bpp b ON b.bpp_date = d.dt
      LEFT JOIN daily_overhead oh ON oh.expense_date = d.dt
      ORDER BY d.dt ASC
    `);

    // Leakage log (Overbudget POs)
    const leakageRes = await client.query(`
      SELECT po.id, po.total_actual_cost as actual_cost, pr.total_pr_value as estimated_cost,
             po.total_actual_cost - pr.total_pr_value as variance,
             po.variance_notes, po.status_cost, ps.target_date
      FROM purchase_orders po
      JOIN purchase_requests pr ON po.pr_id = pr.id
      JOIN production_schedules ps ON pr.schedule_id = ps.id
      WHERE po.status_cost = 'Overbudget'
      ORDER BY po.created_at DESC
    `);

    const rows = plRes.rows;
    const totalRevenue = rows.reduce((s: number, r: { revenue: number }) => s + Number(r.revenue), 0);
    const totalBPP = rows.reduce((s: number, r: { bpp: number }) => s + Number(r.bpp), 0);
    const totalOverhead = rows.reduce((s: number, r: { overhead: number }) => s + Number(r.overhead), 0);
    const totalProfit = totalRevenue - totalBPP - totalOverhead;

    return NextResponse.json({
      plChart: rows,
      summary: { totalRevenue, totalBPP, totalOverhead, totalProfit, avgMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0 },
      leakage: leakageRes.rows,
    });
  } finally { client.release(); }
}
