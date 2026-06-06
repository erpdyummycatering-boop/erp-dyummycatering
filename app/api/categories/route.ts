import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT * FROM product_categories ORDER BY name ASC");
    return NextResponse.json(res.rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Nama kategori wajib diisi" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      "INSERT INTO product_categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *",
      [name]
    );
    return NextResponse.json(res.rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
