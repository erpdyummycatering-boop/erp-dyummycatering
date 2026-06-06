import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const status = p.get("status") || "";

  const wheres: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (status) { wheres.push(`pr.status = $${idx}`); vals.push(status); idx++; }

  const where = wheres.length ? "WHERE " + wheres.join(" AND ") : "";
  const client = await pool.connect();
  try {
    const [countRes, dataRes] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM purchase_requests pr ${where}`, vals),
      client.query(`
        SELECT pr.*, u.name as chef_name, ps.target_date, ps.total_revenue,
          (SELECT COUNT(*) FROM pr_items pi WHERE pi.pr_id = pr.id) AS item_count,
          (SELECT EXISTS(SELECT 1 FROM purchase_orders po WHERE po.pr_id = pr.id)) AS has_po
        FROM purchase_requests pr
        LEFT JOIN users u ON pr.chef_id = u.id
        LEFT JOIN production_schedules ps ON pr.schedule_id = ps.id
        ${where} ORDER BY pr.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
        [...vals, limit, offset])
    ]);
    const total = Number(countRes.rows[0].count);
    return NextResponse.json({ data: dataRes.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } finally { client.release(); }
}
