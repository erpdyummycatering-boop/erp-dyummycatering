import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const search = p.get("search") || "";
  const type = p.get("type") || "";

  const wheres: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (search) { wheres.push(`(name ILIKE $${idx} OR phone ILIKE $${idx} OR email ILIKE $${idx})`); vals.push(`%${search}%`); idx++; }
  if (type) { wheres.push(`type = $${idx}`); vals.push(type); idx++; }

  const where = wheres.length ? "WHERE " + wheres.join(" AND ") : "";
  const client = await pool.connect();
  try {
    const [countRes, dataRes] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM customers ${where}`, vals),
      client.query(`SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx+1}`, [...vals, limit, offset])
    ]);
    const total = Number(countRes.rows[0].count);
    return NextResponse.json({ data: dataRes.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } finally { client.release(); }
}

export async function POST(req: NextRequest) {
  const { name, phone, email, type, address, notes } = await req.json();
  if (!name) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO customers (name,phone,email,type,address,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, phone, email, type, address, notes]
    );
    return NextResponse.json(res.rows[0], { status: 201 });
  } finally { client.release(); }
}
