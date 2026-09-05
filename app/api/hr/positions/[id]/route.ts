import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { rows } = await pool.query(
      `SELECT p.*, d.nama as department_nama
       FROM hr_positions p
       LEFT JOIN hr_departments d ON d.id = p.department_id
       WHERE p.id = $1`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Jabatan tidak ditemukan" }, { status: 404 });
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
    const { kode, nama, department_id, tipe_gaji, deskripsi, is_active } = body;

    const { rows } = await pool.query(
      `UPDATE hr_positions
       SET kode = COALESCE($1, kode),
           nama = COALESCE($2, nama),
           department_id = COALESCE($3, department_id),
           tipe_gaji = COALESCE($4, tipe_gaji),
           deskripsi = COALESCE($5, deskripsi),
           is_active = COALESCE($6, is_active),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [kode ? kode.trim().toUpperCase() : null, nama ? nama.trim() : null, department_id, tipe_gaji, deskripsi, is_active, id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Jabatan tidak ditemukan" }, { status: 404 });
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
      `UPDATE hr_positions SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Jabatan tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Jabatan dinonaktifkan", position: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
