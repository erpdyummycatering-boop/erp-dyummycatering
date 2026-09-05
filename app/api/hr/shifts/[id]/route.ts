import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { rows } = await pool.query(`SELECT * FROM hr_shifts WHERE id = $1`, [id]);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Shift tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { kode, nama, jam_masuk, jam_keluar, jam_kerja_normal_menit, toleransi_terlambat_menit, is_active } = body;

    const { rows } = await pool.query(
      `UPDATE hr_shifts
       SET kode = COALESCE($1, kode),
           nama = COALESCE($2, nama),
           jam_masuk = COALESCE($3, jam_masuk),
           jam_keluar = COALESCE($4, jam_keluar),
           jam_kerja_normal_menit = COALESCE($5, jam_kerja_normal_menit),
           toleransi_terlambat_menit = COALESCE($6, toleransi_terlambat_menit),
           is_active = COALESCE($7, is_active),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [kode ? kode.trim().toUpperCase() : null, nama ? nama.trim() : null, jam_masuk, jam_keluar, jam_kerja_normal_menit, toleransi_terlambat_menit, is_active, id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Shift tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { rows } = await pool.query(
      `UPDATE hr_shifts SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Shift tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Shift dinonaktifkan", shift: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
