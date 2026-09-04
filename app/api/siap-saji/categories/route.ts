import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT id, name, description, lini, is_active 
       FROM product_categories 
       WHERE lini = 'siap_saji' 
       ORDER BY name ASC`
    );
    return NextResponse.json({ data: res.rows });
  } catch (error: any) {
    console.error("Gagal mengambil kategori Siap Saji:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Nama kategori wajib diisi." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const check = await client.query(
      "SELECT id FROM product_categories WHERE LOWER(name) = $1 AND lini = 'siap_saji'",
      [name.trim().toLowerCase()]
    );
    if (check.rows.length > 0) {
      return NextResponse.json({ error: `Kategori '${name}' sudah ada.` }, { status: 400 });
    }

    const ins = await client.query(
      `INSERT INTO product_categories (name, description, lini, is_active)
       VALUES ($1, $2, 'siap_saji', true)
       RETURNING *`,
      [name.trim(), description || null]
    );

    return NextResponse.json({ success: true, data: ins.rows[0] });
  } catch (error: any) {
    console.error("Gagal membuat kategori Siap Saji:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
