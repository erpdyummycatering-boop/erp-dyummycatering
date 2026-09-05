import { NextResponse } from "next/server";
import pool from "@/lib/db";

// GET /api/hr/departments - List all departments
export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT d.*, 
              (SELECT COUNT(*) FROM hr_employees e WHERE e.department_id = d.id AND e.status = 'AKTIF') as employee_count
       FROM hr_departments d
       ORDER BY d.id ASC`
    );
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/hr/departments - Create department
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { kode, nama, deskripsi } = body;

    if (!kode || !nama) {
      return NextResponse.json({ error: "Kode dan Nama departemen wajib diisi" }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO hr_departments (kode, nama, deskripsi)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [kode.trim().toUpperCase(), nama.trim(), deskripsi || null]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
