import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const status = p.get("status") || "";
  const date_from = p.get("date_from") || "";
  const date_to = p.get("date_to") || "";

  const wheres: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (status) { wheres.push(`ps.status = $${idx}`); vals.push(status); idx++; }
  if (date_from) { wheres.push(`ps.target_date >= $${idx}`); vals.push(date_from); idx++; }
  if (date_to) { wheres.push(`ps.target_date <= $${idx}`); vals.push(date_to); idx++; }

  const where = wheres.length ? "WHERE " + wheres.join(" AND ") : "";
  const client = await pool.connect();
  try {
    const [countRes, dataRes] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM production_schedules ps ${where}`, vals),
      client.query(`
        SELECT ps.*, u.name AS chef_name,
        (SELECT COUNT(*) FROM schedule_orders so WHERE so.schedule_id = ps.id) AS order_count
        FROM production_schedules ps
        LEFT JOIN users u ON ps.chef_id = u.id
        ${where} ORDER BY ps.target_date DESC, ps.id DESC LIMIT $${idx} OFFSET $${idx+1}`,
        [...vals, limit, offset])
    ]);
    const total = Number(countRes.rows[0].count);
    return NextResponse.json({ data: dataRes.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } finally { client.release(); }
}

export async function POST(req: NextRequest) {
  const { chef_id, target_date, order_ids } = await req.json();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Hitung total revenue dari order yg dipilih
    let totalRev = 0;
    if (order_ids && order_ids.length > 0) {
      const q = `SELECT SUM(grand_total) as total FROM orders WHERE id = ANY($1::bigint[])`;
      const resSum = await client.query(q, [order_ids]);
      totalRev = Number(resSum.rows[0].total || 0);
    }
    
    // Budget limit = 50% revenue
    const budgetLimit = totalRev * 0.5;

    const resSched = await client.query(
      `INSERT INTO production_schedules (chef_id, target_date, total_revenue, budget_limit, total_estimated_hpp, status)
       VALUES ($1, $2, $3, $4, 0, 'Draft') RETURNING *`,
      [chef_id, target_date, totalRev, budgetLimit]
    );
    const schedId = resSched.rows[0].id;

    if (order_ids && order_ids.length > 0) {
      for (const oid of order_ids) {
        await client.query(`INSERT INTO schedule_orders (schedule_id, order_id) VALUES ($1, $2)`, [schedId, oid]);
      }
    }

    await client.query("COMMIT");
    return NextResponse.json(resSched.rows[0], { status: 201 });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
