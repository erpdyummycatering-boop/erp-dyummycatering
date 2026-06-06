import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const client = await pool.connect();
  try {
    let totalRevenue = 0;
    let totalLeadsToday = 0;
    let closingToday = 0;
    let followUp = 0;
    let activeOrders = 0;
    let chartRows = [];
    let scheduleAlerts = [];
    let poAlerts = [];

    if (userRole === "CS / Sales") {
      // 1. Total Revenue
      const revRes = await client.query(`SELECT SUM(grand_total) as total FROM orders WHERE status_order != 'Batal' AND pic_id = $1`, [userId]);
      totalRevenue = Number(revRes.rows[0]?.total || 0);

      // 2. Leads today
      const leadRes = await client.query(`
        SELECT 
          COUNT(*) as total_leads,
          COUNT(CASE WHEN status='Closing' THEN 1 END) as total_closing
        FROM leads WHERE DATE(lead_date) = CURRENT_DATE AND pic_id = $1
      `, [userId]);
      totalLeadsToday = Number(leadRes.rows[0]?.total_leads || 0);
      closingToday = Number(leadRes.rows[0]?.total_closing || 0);

      // 3. Follow Up
      const followupRes = await client.query(`SELECT COUNT(*) as count FROM leads WHERE status IN ('Follow Up', 'Negosiasi', 'Prospek') AND pic_id = $1`, [userId]);
      followUp = Number(followupRes.rows[0]?.count || 0);

      // 4. Active Orders
      const orderRes = await client.query(`SELECT COUNT(*) as count FROM orders WHERE status_order IN ('Baru', 'Diproses') AND pic_id = $1`, [userId]);
      activeOrders = Number(orderRes.rows[0]?.count || 0);

      // 5. P&L Chart (Only their revenue, 0 BPP/Overhead)
      const chartRes = await client.query(`
        WITH dates AS (
          SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day')::date AS date
        ),
        rev AS (
          SELECT delivery_date as date, SUM(grand_total) as rev FROM orders WHERE status_order != 'Batal' AND pic_id = $1 GROUP BY delivery_date
        )
        SELECT 
          TO_CHAR(d.date, 'DD Mon') as date_str,
          d.date,
          COALESCE(r.rev, 0) as revenue
        FROM dates d
        LEFT JOIN rev r ON d.date = r.date
        ORDER BY d.date ASC
      `, [userId]);
      chartRows = chartRes.rows.map(r => ({
        date: r.date_str,
        revenue: Number(r.revenue),
        bpp: 0,
        overhead: 0,
        gross_profit: Number(r.revenue),
        margin: Number(r.revenue) > 0 ? 100 : 0
      }));
    } else {
      // Admin / Owner (Original full logic)
      const revRes = await client.query(`SELECT SUM(grand_total) as total FROM orders WHERE status_order != 'Batal'`);
      totalRevenue = Number(revRes.rows[0]?.total || 0);

      const leadRes = await client.query(`
        SELECT 
          COUNT(*) as total_leads,
          COUNT(CASE WHEN status='Closing' THEN 1 END) as total_closing
        FROM leads WHERE DATE(lead_date) = CURRENT_DATE
      `);
      totalLeadsToday = Number(leadRes.rows[0]?.total_leads || 0);
      closingToday = Number(leadRes.rows[0]?.total_closing || 0);

      const followupRes = await client.query(`SELECT COUNT(*) as count FROM leads WHERE status IN ('Follow Up', 'Negosiasi', 'Prospek')`);
      followUp = Number(followupRes.rows[0]?.count || 0);

      const orderRes = await client.query(`SELECT COUNT(*) as count FROM orders WHERE status_order IN ('Baru', 'Diproses')`);
      activeOrders = Number(orderRes.rows[0]?.count || 0);

      const chartRes = await client.query(`
        WITH dates AS (
          SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day')::date AS date
        ),
        rev AS (
          SELECT delivery_date as date, SUM(grand_total) as rev FROM orders WHERE status_order != 'Batal' GROUP BY delivery_date
        ),
        bpp AS (
          SELECT po.po_date as date, SUM(po.total_actual_cost) as bpp 
          FROM purchase_orders po
          WHERE po.status_po = 'Selesai Belanja'
          GROUP BY po.po_date
        ),
        ovh AS (
          SELECT expense_date as date, SUM(amount) as overhead FROM overheads GROUP BY expense_date
        )
        SELECT 
          TO_CHAR(d.date, 'DD Mon') as date_str,
          d.date,
          COALESCE(r.rev, 0) as revenue,
          COALESCE(b.bpp, 0) as bpp,
          COALESCE(o.overhead, 0) as overhead,
          COALESCE(r.rev, 0) - COALESCE(b.bpp, 0) - COALESCE(o.overhead, 0) as gross_profit,
          CASE WHEN COALESCE(r.rev, 0) > 0 THEN 
            ROUND(((COALESCE(r.rev, 0) - COALESCE(b.bpp, 0) - COALESCE(o.overhead, 0)) / COALESCE(r.rev, 0) * 100)::numeric, 1)
          ELSE 0 END as margin
        FROM dates d
        LEFT JOIN rev r ON d.date = r.date
        LEFT JOIN bpp b ON d.date = b.date
        LEFT JOIN ovh o ON d.date = o.date
        ORDER BY d.date ASC
      `);
      chartRows = chartRes.rows.map(r => ({
        date: r.date_str,
        revenue: Number(r.revenue),
        bpp: Number(r.bpp),
        overhead: Number(r.overhead),
        gross_profit: Number(r.gross_profit),
        margin: Number(r.margin)
      }));

      const schedAlertsRes = await client.query(`
        SELECT id, TO_CHAR(target_date, 'DD Mon YYYY') as target_date, total_estimated_hpp, budget_limit, status
        FROM production_schedules
        WHERE status = 'Overbudget Warning'
        LIMIT 5
      `);
      scheduleAlerts = schedAlertsRes.rows;
      
      const poAlertsRes = await client.query(`
        SELECT id, variance_notes
        FROM purchase_orders
        WHERE status_cost = 'Overbudget'
        LIMIT 5
      `);
      poAlerts = poAlertsRes.rows;
    }

    return NextResponse.json({
      totalRevenue,
      totalLeadsToday,
      closingToday,
      followUp,
      activeOrders,
      plChart: chartRows,
      scheduleAlerts,
      poAlerts
    });
  } finally {
    client.release();
  }
}
