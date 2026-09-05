import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { rows } = await pool.query(`SELECT * FROM hr_departments WHERE id = $1`, [id]);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Departemen tidak ditemukan" }, { status: 404 });
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
    const { kode, nama, deskripsi, is_active } = body;

    const { rows } = await pool.query(
      `UPDATE hr_departments
       SET kode = COALESCE($1, kode),
           nama = COALESCE($2, nama),
           deskripsi = COALESCE($3, deskripsi),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [kode ? kode.trim().toUpperCase() : null, nama ? nama.trim() : null, deskripsi, is_active, id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Departemen tidak ditemukan" }, { status: 404 });
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
      `UPDATE hr_departments SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Departemen tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Departemen dinonaktifkan", department: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
