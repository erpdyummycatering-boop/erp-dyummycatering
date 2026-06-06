import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const search = p.get("search") || "";
  const product_id = p.get("product_id") || "";

  const wheres: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (search) { wheres.push(`r.menu_name ILIKE $${idx}`); vals.push(`%${search}%`); idx++; }
  if (product_id) { wheres.push(`r.product_id = $${idx}`); vals.push(product_id); idx++; }

  const where = wheres.length ? "WHERE " + wheres.join(" AND ") : "";
  const client = await pool.connect();
  try {
    const [countRes, dataRes] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM recipes r ${where}`, vals),
      client.query(`SELECT r.*, p.name AS product_name FROM recipes r LEFT JOIN products p ON r.product_id = p.id ${where} ORDER BY r.id ASC LIMIT $${idx} OFFSET $${idx+1}`, [...vals, limit, offset])
    ]);
    const total = Number(countRes.rows[0].count);
    return NextResponse.json({ data: dataRes.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } finally { client.release(); }
}

export async function POST(req: NextRequest) {
  const { product_id, menu_name, ingredients, standard_cost } = await req.json();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO recipes (product_id,menu_name,ingredients,standard_cost) VALUES ($1,$2,$3,$4) RETURNING *`,
      [product_id, menu_name, ingredients, standard_cost]
    );
    return NextResponse.json(res.rows[0], { status: 201 });
  } finally { client.release(); }
}
