import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const status_po = p.get("status_po") || "";
  const status_cost = p.get("status_cost") || "";

  const wheres: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (status_po) { wheres.push(`po.status_po = $${idx}`); vals.push(status_po); idx++; }
  if (status_cost) { wheres.push(`po.status_cost = $${idx}`); vals.push(status_cost); idx++; }

  const where = wheres.length ? "WHERE " + wheres.join(" AND ") : "";
  const client = await pool.connect();
  try {
    const [countRes, dataRes] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM purchase_orders po ${where}`, vals),
      client.query(`
        SELECT po.*, pr.total_pr_value AS estimated_cost,
               ps.target_date,
               up.name AS purchasing_name,
               uf.name AS finance_name
        FROM purchase_orders po
        JOIN purchase_requests pr ON po.pr_id = pr.id
        JOIN production_schedules ps ON pr.schedule_id = ps.id
        LEFT JOIN users up ON po.purchasing_id = up.id
        LEFT JOIN users uf ON po.finance_id = uf.id
        ${where} ORDER BY po.po_date DESC, po.id DESC LIMIT $${idx} OFFSET $${idx+1}`,
        [...vals, limit, offset])
    ]);
    const total = Number(countRes.rows[0].count);
    return NextResponse.json({ data: dataRes.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } finally { client.release(); }
}
