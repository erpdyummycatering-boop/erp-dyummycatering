import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const category = p.get("category") || "";
  const date_from = p.get("date_from") || "";
  const date_to = p.get("date_to") || "";

  const wheres: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (category) { wheres.push(`category = $${idx}`); vals.push(category); idx++; }
  if (date_from) { wheres.push(`expense_date >= $${idx}`); vals.push(date_from); idx++; }
  if (date_to) { wheres.push(`expense_date <= $${idx}`); vals.push(date_to); idx++; }

  const where = wheres.length ? "WHERE " + wheres.join(" AND ") : "";
  const client = await pool.connect();
  try {
    const [countRes, dataRes] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM overheads ${where}`, vals),
      client.query(`
        SELECT o.*, u.name AS finance_name
        FROM overheads o
        LEFT JOIN users u ON o.finance_id = u.id
        ${where} ORDER BY o.expense_date DESC, o.id DESC LIMIT $${idx} OFFSET $${idx+1}`,
        [...vals, limit, offset])
    ]);
    const total = Number(countRes.rows[0].count);
    return NextResponse.json({ data: dataRes.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } finally { client.release(); }
}

export async function POST(req: NextRequest) {
  const { finance_id, expense_date, category, amount, notes } = await req.json();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO overheads (finance_id, expense_date, category, amount, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [finance_id, expense_date, category, amount, notes]
    );
    return NextResponse.json(res.rows[0], { status: 201 });
  } finally { client.release(); }
}
