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
    // 1. Fetch active CS List
    const activeCsRes = await client.query(
      `SELECT id, name FROM users WHERE role = 'CS / Sales' AND status = 'Aktif' ORDER BY id`
    );
    const activeCsList = activeCsRes.rows;

    // 2. Determine selected CS ID
    let selectedCsId: string | null = null;
    if (userRole === "CS / Sales") {
      selectedCsId = String(userId);
    } else {
      const queryCsId = searchParams.get("csId");
      if (queryCsId) {
        selectedCsId = queryCsId;
      } else if (activeCsList.length > 0) {
        selectedCsId = String(activeCsList[0].id);
      }
    }

    const selectedCsName = activeCsList.find(c => String(c.id) === selectedCsId)?.name || "Semua CS";

    // 3. Compute dailyStats (Dashboard KPIs) for the selected CS
    let dailyStats = {
      leads: 0,
      newOrders: 0,
      repeatOrders: 0,
      newOrdersValue: 0,
      repeatOrdersValue: 0,
      totalClosing: 0,
      totalOmzet: 0,
      closingRate: 0
    };

    let transactions: any[] = [];

    if (selectedCsId) {
      // Leads Count
      const leadsRes = await client.query(
        `SELECT COUNT(*) FROM leads WHERE lead_date >= $1 AND lead_date <= $2 AND pic_id = $3`,
        [startDate, endDate, selectedCsId]
      );
      const leadsCount = Number(leadsRes.rows[0].count) || 0;

      // New Orders Count & Value
      const newOrdersRes = await client.query(
        `SELECT COUNT(*), COALESCE(SUM(grand_total), 0) as total_value 
         FROM orders 
         WHERE order_date >= $1 AND order_date <= $2 AND pic_id = $3 AND jenis_order = 'New Order'`,
        [startDate, endDate, selectedCsId]
      );
      const newOrdersCount = Number(newOrdersRes.rows[0].count) || 0;
      const newOrdersValue = Number(newOrdersRes.rows[0].total_value) || 0;

      // Repeat Orders Count & Value
      const repeatOrdersRes = await client.query(
        `SELECT COUNT(*), COALESCE(SUM(grand_total), 0) as total_value 
         FROM orders 
         WHERE order_date >= $1 AND order_date <= $2 AND pic_id = $3 AND jenis_order = 'Repeat Order'`,
        [startDate, endDate, selectedCsId]
      );
      const repeatOrdersCount = Number(repeatOrdersRes.rows[0].count) || 0;
      const repeatOrdersValue = Number(repeatOrdersRes.rows[0].total_value) || 0;

      const totalClosing = newOrdersCount + repeatOrdersCount;
      const totalOmzet = newOrdersValue + repeatOrdersValue;
      const closingRate = leadsCount > 0 ? Number(((newOrdersCount / leadsCount) * 100).toFixed(1)) : 0;

      dailyStats = {
        leads: leadsCount,
        newOrders: newOrdersCount,
        repeatOrders: repeatOrdersCount,
        newOrdersValue,
        repeatOrdersValue,
        totalClosing,
        totalOmzet,
        closingRate
      };

      // Transactions List for selected CS
      const transRes = await client.query(
        `SELECT 
          o.id,
          COALESCE(o.closing_date, o.order_date) as closing_date,
          c.id as customer_id,
          c.name as customer_name,
          c.phone as whatsapp,
          o.jenis_order,
          o.grand_total as nilai_order
         FROM orders o
         JOIN customers c ON o.customer_id = c.id
         WHERE o.order_date >= $1 AND o.order_date <= $2 AND o.pic_id = $3
         ORDER BY o.order_date DESC, o.id DESC`,
        [startDate, endDate, selectedCsId]
      );
      transactions = transRes.rows;
    }

    // 4. Compute csData (Comparison/Evaluation List) for all active CSs
    const monthRes = await client.query(
      `SELECT
        u.id, u.name,
        (SELECT COUNT(*) FROM leads l WHERE l.pic_id = u.id AND l.lead_date >= $1 AND l.lead_date <= $2) AS total_leads,
        (SELECT COUNT(*) FROM orders o WHERE o.pic_id = u.id AND o.order_date >= $1 AND o.order_date <= $2 AND o.jenis_order = 'New Order') AS total_closing
      FROM users u
      WHERE u.role = 'CS / Sales' AND u.status = 'Aktif'
      ORDER BY id ASC`,
      [startDate, endDate]
    );

    // 5. Generate Weekly Chart Data
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
        (SELECT COUNT(*) FROM leads l WHERE l.pic_id = u.id AND date_trunc('week', l.lead_date)::date = w.week_start AND l.lead_date >= $1 AND l.lead_date <= $2) as leads,
        (SELECT COUNT(*) FROM orders o WHERE o.pic_id = u.id AND date_trunc('week', o.order_date)::date = w.week_start AND o.order_date >= $1 AND o.order_date <= $2 AND o.jenis_order = 'New Order') as closing
      FROM weeks w
      CROSS JOIN users u
      WHERE u.role = 'CS / Sales' AND u.status = 'Aktif'
      ORDER BY w.week_start ASC
    `, [startDate, endDate]);

    const weeksSet = new Set<string>();
    weeklyChartRes.rows.forEach(r => { if (r.week_start) weeksSet.add(r.week_start); });
    const sortedWeeks = Array.from(weeksSet).sort();

    const weeklyData: Record<number, any[]> = {};
    for (const cs of monthRes.rows) {
      const csIdNum = Number(cs.id);
      weeklyData[csIdNum] = sortedWeeks.map((week_start, i) => {
        const row = weeklyChartRes.rows.find(r => Number(r.cs_id) === csIdNum && r.week_start === week_start);
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

    const csData = monthRes.rows.map((cs: any) => {
      const csIdNum = Number(cs.id);
      const leads = Number(cs.total_leads);
      const closing = Number(cs.total_closing);
      return {
        id: cs.id,
        name: cs.name,
        monthLeads: leads,
        monthClosing: closing,
        monthRate: leads > 0 ? Number(((closing / leads) * 100).toFixed(1)) : 0,
        weekly: weeklyData[csIdNum] || [],
      };
    });

    const chartData = sortedWeeks.map((week_start, i) => {
      const row: Record<string, any> = { week: `Pekan ${i + 1}` };
      for (const cs of csData) {
        row[cs.name.split(" ")[0]] = cs.weekly[i]?.rate || 0;
      }
      return row;
    });

    return NextResponse.json({ 
      csData, 
      chartData, 
      dailyStats,
      transactions,
      selectedCsId,
      selectedCsName,
      activeCsList,
      startDate,
      endDate
    });
  } finally { client.release(); }
}
