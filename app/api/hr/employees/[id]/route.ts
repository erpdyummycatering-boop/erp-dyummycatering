import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const empRes = await pool.query(
      `SELECT e.*, 
              d.nama as department_nama, d.kode as department_kode,
              p.nama as position_nama, p.kode as position_kode
       FROM hr_employees e
       LEFT JOIN hr_departments d ON d.id = e.department_id
       LEFT JOIN hr_positions p ON p.id = e.position_id
       WHERE e.id = $1`,
      [id]
    );

    if (empRes.rows.length === 0) {
      return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
    }

    const employee = empRes.rows[0];

    // Fetch salary history
    const salaryRes = await pool.query(
      `SELECT * FROM hr_salary_structures WHERE employee_id = $1 ORDER BY effective_date DESC`,
      [id]
    );

    return NextResponse.json({
      ...employee,
      salary_history: salaryRes.rows,
      active_salary: salaryRes.rows[0] || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const fields = [
      "kode_karyawan", "nama_fingerprint", "nama_lengkap", "department_id", "position_id",
      "tipe_karyawan", "tipe_gaji", "no_fingerprint", "no_ktp", "email", "no_telepon",
      "npwp", "ptkp_status", "bpjs_ketenagakerjaan", "bpjs_kesehatan",
      "tanggal_masuk", "tanggal_keluar", "status", "catatan"
    ];

    const updates: string[] = [];
    const values: any[] = [];

    fields.forEach((field) => {
      if (body[field] !== undefined) {
        values.push(body[field]);
        updates.push(`${field} = $${values.length}`);
      }
    });

    if (updates.length === 0) {
      return NextResponse.json({ error: "Tidak ada field yang diubah" }, { status: 400 });
    }

    values.push(id);
    const query = `
      UPDATE hr_employees
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
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
      `UPDATE hr_employees SET status = 'NON_AKTIF', tanggal_keluar = CURRENT_DATE, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Karyawan telah dinonaktifkan", employee: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
