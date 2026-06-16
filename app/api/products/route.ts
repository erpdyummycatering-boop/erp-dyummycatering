import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const search = p.get("search") || "";
  const category = p.get("category") || "";

  const wheres: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (search) { wheres.push(`p.name ILIKE $${idx}`); vals.push(`%${search}%`); idx++; }
  if (category) {
    if (/^\d+$/.test(category)) {
      wheres.push(`p.category_id = $${idx}`);
      vals.push(Number(category));
    } else {
      wheres.push(`pc.name = $${idx}`);
      vals.push(category);
    }
    idx++;
  }

  const where = wheres.length ? "WHERE " + wheres.join(" AND ") : "";
  const client = await pool.connect();
  try {
    const [countRes, dataRes] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM products p LEFT JOIN product_categories pc ON p.category_id = pc.id ${where}`, vals),
      client.query(
        `SELECT p.*, pc.name as category 
         FROM products p 
         LEFT JOIN product_categories pc ON p.category_id = pc.id 
         ${where} 
         ORDER BY p.id ASC LIMIT $${idx} OFFSET $${idx+1}`, 
        [...vals, limit, offset]
      )
    ]);
    const total = Number(countRes.rows[0].count);
    return NextResponse.json({ data: dataRes.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } finally { client.release(); }
}

export async function POST(req: NextRequest) {
  const { name, category_id, description, price, status, image_url } = await req.json();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO products (name,category_id,description,price,status,image_url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, category_id ? Number(category_id) : null, description, price, status || "Aktif", image_url || null]
    );
    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (err: any) {
    console.error("Gagal menyimpan produk:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally { client.release(); }
}
