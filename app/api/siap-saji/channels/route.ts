import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      "SELECT * FROM channels WHERE lini = 'siap_saji' ORDER BY urutan ASC, id ASC"
    );
    return NextResponse.json(res.rows);
  } catch (error: any) {
    console.error("Gagal mengambil master channel:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, harga_type, platform_key, urutan, is_active } = body;

  if (!name) {
    return NextResponse.json({ error: "Nama channel wajib diisi." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO channels (name, lini, harga_type, platform_key, is_active, urutan)
       VALUES ($1, 'siap_saji', $2, $3, $4, $5)
       RETURNING *`,
      [
        name.trim(),
        harga_type || "normal",
        platform_key || null,
        is_active !== undefined ? Boolean(is_active) : true,
        urutan ? Number(urutan) : 99,
      ]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error: any) {
    console.error("Gagal membuat channel baru:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
