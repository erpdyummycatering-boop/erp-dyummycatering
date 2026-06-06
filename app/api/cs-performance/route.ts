import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

function formatDateRange(weekStartStr: string) {
  if (!weekStartStr) return "";
  const start = new Date(weekStartStr);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const f = (d: Date) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  return `${f(start)} - ${f(end)}`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const { searchParams } = new URL(req.url);
  const todayStr = new Date().toISOString().slice(0, 10);
  const mtdStr = todayStr.slice(0, 8) + '01'; // YYYY-MM-01
  const startDate = searchParams.get("startDate") || mtdStr;
  const endDate = searchParams.get("endDate") || todayStr;

  const client = await pool.connect();
  try {
    let dailyStats;
    let recentCustomers;
    let recentOrders;
    let csData: any[] = [];
    let chartData = [];

    if (userRole === "CS / Sales") {
      // 1. Daily Stats (scoped to CS)
      const dailyLeadsRes = await client.query(`SELECT COUNT(*) FROM leads WHERE lead_date >= $1 AND lead_date <= $2 AND pic_id = $3`, [startDate, endDate, userId]);
      const dailyOrdersRes = await client.query(`SELECT COUNT(*) FROM orders WHERE order_date >= $1 AND order_date <= $2 AND pic_id = $3`, [startDate, endDate, userId]);
      const dailyRevenueRes = await client.query(`SELECT SUM(grand_total) FROM orders WHERE order_date >= $1 AND order_date <= $2 AND pic_id = $3`, [startDate, endDate, userId]);
      
      const dailyLeads = Number(dailyLeadsRes.rows[0].count) || 0;
      const dailyOrders = Number(dailyOrdersRes.rows[0].count) || 0;
      const dailyRevenue = Number(dailyRevenueRes.rows[0].sum) || 0;
      const closingRate = dailyLeads > 0 ? ((dailyOrders / dailyLeads) * 100).toFixed(1) : 0;

      dailyStats = {
        leads: dailyLeads,
        orders: dailyOrders,
        closingRate: Number(closingRate),
        revenue: dailyRevenue
      };

      // 2. Recent Customers for this CS
      const recentCustomersRes = await client.query(`
        SELECT DISTINCT c.id, c.name, c.phone, 
          (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.pic_id = $3) as total_order
        FROM customers c
        JOIN orders o ON o.customer_id = c.id
        WHERE DATE(c.created_at) >= $1 AND DATE(c.created_at) <= $2 AND o.pic_id = $3
        ORDER BY c.id DESC LIMIT 5
      `, [startDate, endDate, userId]);
      recentCustomers = recentCustomersRes.rows;

      // 3. Recent Orders for this CS
      const recentOrdersRes = await client.query(`
        SELECT o.id, c.name as customer, o.grand_total as harga, o.delivery_date,
          (SELECT COALESCE(SUM(quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) as porsi
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.order_date >= $1 AND o.order_date <= $2 AND o.pic_id = $3
        ORDER BY o.created_at DESC LIMIT 5
      `, [startDate, endDate, userId]);
      recentOrders = recentOrdersRes.rows;

      // Summary per CS (only self)
      const monthRes = await client.query(`
        SELECT
          u.id, u.name,
          COUNT(l.id) AS total_leads,
          COUNT(CASE WHEN l.status='Closing' THEN 1 END) AS total_closing,
          ROUND(COUNT(CASE WHEN l.status='Closing' THEN 1 END)::numeric / NULLIF(COUNT(l.id),0) * 100, 1) AS closing_rate
        FROM users u
        LEFT JOIN leads l ON l.pic_id = u.id
          AND l.lead_date >= $1 AND l.lead_date <= $2
        WHERE u.id = $3 AND u.status = 'Aktif'
        GROUP BY u.id, u.name`,
        [startDate, endDate, userId]
      );

      // Weekly breakdown inside range (ensuring zero weeks are included)
      const weeklyChartRes = await client.query(`
        WITH weeks AS (
          SELECT generate_series(
            date_trunc('week', $1::date)::date,
            date_trunc('week', $2::date)::date,
            '1 week'::interval
          )::date AS week_start
        )
        SELECT 
          w.week_start::text AS week_start,
          u.id as cs_id,
          u.name as cs_name,
          COUNT(l.id) as leads,
          COUNT(CASE WHEN l.status='Closing' THEN 1 END) as closing
        FROM weeks w
        CROSS JOIN users u
        LEFT JOIN leads l ON l.pic_id = u.id 
          AND date_trunc('week', l.lead_date)::date = w.week_start
          AND l.lead_date >= $1 AND l.lead_date <= $2
        WHERE u.id = $3 AND u.status = 'Aktif'
        GROUP BY w.week_start, u.id, u.name
        ORDER BY w.week_start ASC
      `, [startDate, endDate, userId]);

      const weeksSet = new Set<string>();
      weeklyChartRes.rows.forEach(r => { if (r.week_start) weeksSet.add(r.week_start); });
      const sortedWeeks = Array.from(weeksSet).sort();

      const weeklyData: Record<number, any[]> = {};
      for (const cs of monthRes.rows) {
        weeklyData[cs.id] = sortedWeeks.map((week_start, i) => {
          const row = weeklyChartRes.rows.find(r => r.cs_id === cs.id && r.week_start === week_start);
          const leads = row ? Number(row.leads) : 0;
          const closing = row ? Number(row.closing) : 0;
          return {
            week: `Pekan ${i + 1}`,
            dateRange: formatDateRange(week_start),
            leads,
            closing,
            rate: leads > 0 ? Number(((closing / leads) * 100).toFixed(1)) : 0
          };
        });
      }

      csData = monthRes.rows.map((cs: any) => ({
        id: cs.id,
        name: cs.name,
        monthLeads: Number(cs.total_leads),
        monthClosing: Number(cs.total_closing),
        monthRate: Number(cs.closing_rate) || 0,
        weekly: weeklyData[cs.id] || [],
      }));

      chartData = sortedWeeks.map((week_start, i) => {
        const row: Record<string, any> = { week: `Pekan ${i + 1}` };
        for (const cs of csData) {
          row[cs.name.split(" ")[0]] = cs.weekly[i]?.rate || 0;
        }
        return row;
      });
    } else {
      // Original full logic (Admin/Owner)
      const dailyLeadsRes = await client.query(`SELECT COUNT(*) FROM leads WHERE lead_date >= $1 AND lead_date <= $2`, [startDate, endDate]);
      const dailyOrdersRes = await client.query(`SELECT COUNT(*) FROM orders WHERE order_date >= $1 AND order_date <= $2`, [startDate, endDate]);
      const dailyRevenueRes = await client.query(`SELECT SUM(grand_total) FROM orders WHERE order_date >= $1 AND order_date <= $2`, [startDate, endDate]);
      
      const dailyLeads = Number(dailyLeadsRes.rows[0].count) || 0;
      const dailyOrders = Number(dailyOrdersRes.rows[0].count) || 0;
      const dailyRevenue = Number(dailyRevenueRes.rows[0].sum) || 0;
      const closingRate = dailyLeads > 0 ? ((dailyOrders / dailyLeads) * 100).toFixed(1) : 0;

      dailyStats = {
        leads: dailyLeads,
        orders: dailyOrders,
        closingRate: Number(closingRate),
        revenue: dailyRevenue
      };

      const recentCustomersRes = await client.query(`
        SELECT c.id, c.name, c.phone, 
          (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) as total_order
        FROM customers c
        WHERE DATE(c.created_at) >= $1 AND DATE(c.created_at) <= $2
        ORDER BY c.created_at DESC LIMIT 5
      `, [startDate, endDate]);
      recentCustomers = recentCustomersRes.rows;

      const recentOrdersRes = await client.query(`
        SELECT o.id, c.name as customer, o.grand_total as harga, o.delivery_date,
          (SELECT COALESCE(SUM(quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) as porsi
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.order_date >= $1 AND o.order_date <= $2
        ORDER BY o.created_at DESC LIMIT 5
      `, [startDate, endDate]);
      recentOrders = recentOrdersRes.rows;

      const monthRes = await client.query(`
        SELECT
          u.id, u.name,
          COUNT(l.id) AS total_leads,
          COUNT(CASE WHEN l.status='Closing' THEN 1 END) AS total_closing,
          ROUND(COUNT(CASE WHEN l.status='Closing' THEN 1 END)::numeric / NULLIF(COUNT(l.id),0) * 100, 1) AS closing_rate
        FROM users u
        LEFT JOIN leads l ON l.pic_id = u.id
          AND l.lead_date >= $1 AND l.lead_date <= $2
        WHERE u.role = 'CS / Sales' AND u.status = 'Aktif'
        GROUP BY u.id, u.name
        ORDER BY closing_rate DESC NULLS LAST`,
        [startDate, endDate]
      );

      const weeklyChartRes = await client.query(`
        WITH weeks AS (
          SELECT generate_series(
            date_trunc('week', $1::date)::date,
            date_trunc('week', $2::date)::date,
            '1 week'::interval
          )::date AS week_start
        )
        SELECT 
          w.week_start::text AS week_start,
          u.id as cs_id,
          u.name as cs_name,
          COUNT(l.id) as leads,
          COUNT(CASE WHEN l.status='Closing' THEN 1 END) as closing
        FROM weeks w
        CROSS JOIN users u
        LEFT JOIN leads l ON l.pic_id = u.id 
          AND date_trunc('week', l.lead_date)::date = w.week_start
          AND l.lead_date >= $1 AND l.lead_date <= $2
        WHERE u.role = 'CS / Sales' AND u.status = 'Aktif'
        GROUP BY w.week_start, u.id, u.name
        ORDER BY w.week_start ASC
      `, [startDate, endDate]);

      const weeksSet = new Set<string>();
      weeklyChartRes.rows.forEach(r => { if (r.week_start) weeksSet.add(r.week_start); });
      const sortedWeeks = Array.from(weeksSet).sort();

      const weeklyData: Record<number, any[]> = {};
      for (const cs of monthRes.rows) {
        weeklyData[cs.id] = sortedWeeks.map((week_start, i) => {
          const row = weeklyChartRes.rows.find(r => r.cs_id === cs.id && r.week_start === week_start);
          const leads = row ? Number(row.leads) : 0;
          const closing = row ? Number(row.closing) : 0;
          return {
            week: `Pekan ${i + 1}`,
            dateRange: formatDateRange(week_start),
            leads,
            closing,
            rate: leads > 0 ? Number(((closing / leads) * 100).toFixed(1)) : 0
          };
        });
      }

      csData = monthRes.rows.map((cs: any) => ({
        id: cs.id,
        name: cs.name,
        monthLeads: Number(cs.total_leads),
        monthClosing: Number(cs.total_closing),
        monthRate: Number(cs.closing_rate) || 0,
        weekly: weeklyData[cs.id] || [],
      }));

      chartData = sortedWeeks.map((week_start, i) => {
        const row: Record<string, any> = { week: `Pekan ${i + 1}` };
        for (const cs of csData) {
          row[cs.name.split(" ")[0]] = cs.weekly[i]?.rate || 0;
        }
        return row;
      });
    }

    return NextResponse.json({ 
      csData, 
      chartData, 
      dailyStats,
      recentCustomers,
      recentOrders,
      startDate,
      endDate
    });
  } finally { client.release(); }
}
