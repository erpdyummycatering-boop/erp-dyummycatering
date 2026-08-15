import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const search = p.get("search") || "";
  const zone = p.get("shipping_zone") || "";

  const wheres: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (search) {
    wheres.push(`(kecamatan ILIKE $${idx} OR kota ILIKE $${idx})`);
    vals.push(`%${search}%`);
    idx++;
  }
  if (zone) {
    wheres.push(`shipping_zone = $${idx}`);
    vals.push(zone);
    idx++;
  }

  const whereSql = wheres.length ? "WHERE " + wheres.join(" AND ") : "";

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT * FROM areas ${whereSql} ORDER BY shipping_zone, kota, kecamatan`,
      vals
    );
    return NextResponse.json(res.rows);
  } catch (error: any) {
    console.error("Gagal mengambil master area:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { kecamatan, kota, provinsi, shipping_zone, is_active } = body;

  if (!kecamatan || !kota) {
    return NextResponse.json({ error: "Kecamatan dan Kota wajib diisi." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO areas (kecamatan, kota, provinsi, shipping_zone, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        kecamatan.trim(),
        kota.trim(),
        provinsi || "Jawa Barat",
        shipping_zone || "dalam_kota",
        is_active !== undefined ? Boolean(is_active) : true,
      ]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error: any) {
    console.error("Gagal membuat area baru:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
