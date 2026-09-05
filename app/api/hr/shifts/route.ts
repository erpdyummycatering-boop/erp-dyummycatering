import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const { rows } = await pool.query(`SELECT * FROM hr_shifts ORDER BY id ASC`);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { kode, nama, jam_masuk, jam_keluar, jam_kerja_normal_menit, toleransi_terlambat_menit } = body;

    if (!kode || !nama || !jam_masuk || !jam_keluar) {
      return NextResponse.json({ error: "Kode, Nama, Jam Masuk, dan Jam Keluar wajib diisi" }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO hr_shifts (kode, nama, jam_masuk, jam_keluar, jam_kerja_normal_menit, toleransi_terlambat_menit)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        kode.trim().toUpperCase(),
        nama.trim(),
        jam_masuk,
        jam_keluar,
        jam_kerja_normal_menit || 480,
        toleransi_terlambat_menit || 15,
      ]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
