import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, d.nama as department_nama, d.kode as department_kode
       FROM hr_positions p
       LEFT JOIN hr_departments d ON d.id = p.department_id
       ORDER BY p.id ASC`
    );
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { kode, nama, department_id, tipe_gaji, deskripsi } = body;

    if (!kode || !nama || !department_id) {
      return NextResponse.json({ error: "Kode, Nama, dan Departemen wajib diisi" }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO hr_positions (kode, nama, department_id, tipe_gaji, deskripsi)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [kode.trim().toUpperCase(), nama.trim(), department_id, tipe_gaji || "HARIAN_PRODUKSI", deskripsi || null]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
