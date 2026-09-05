import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const attendance_id = searchParams.get("attendance_id");

    let query = `
      SELECT c.*, e.nama_lengkap as nama_karyawan, u.name as corrected_by_name
      FROM hr_attendance_corrections c
      JOIN hr_employees e ON e.id = c.employee_id
      LEFT JOIN users u ON u.id = c.corrected_by
    `;
    const params: any[] = [];

    if (attendance_id) {
      params.push(attendance_id);
      query += ` WHERE c.attendance_id = $1`;
    }

    query += ` ORDER BY c.created_at DESC`;

    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { attendance_id, field_changed, nilai_sebelum, nilai_sesudah, alasan, user_id } = body;

    if (!attendance_id || !field_changed || !alasan) {
      return NextResponse.json({ error: "Attendance ID, Field Changed, dan Alasan wajib diisi" }, { status: 400 });
    }

    await client.query("BEGIN");

    // Fetch existing attendance
    const attRes = await client.query(`SELECT * FROM hr_attendances WHERE id = $1`, [attendance_id]);
    if (attRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Presensi tidak ditemukan" }, { status: 404 });
    }
    const att = attRes.rows[0];

    // Check if payroll already FINAL for this period
    const month = new Date(att.tanggal).getMonth() + 1;
    const year = new Date(att.tanggal).getFullYear();
    const payrollCheck = await client.query(
      `SELECT status FROM hr_payrolls WHERE periode_tahun = $1 AND periode_bulan = $2 AND status = 'FINAL'`,
      [year, month]
    );

    if (payrollCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Tidak dapat mengoreksi presensi karena payroll bulan ini sudah status FINAL" }, { status: 400 });
    }

    // Apply correction to hr_attendances
    await client.query(
      `UPDATE hr_attendances SET ${field_changed} = $1, is_koreksi = TRUE, updated_at = NOW() WHERE id = $2`,
      [nilai_sesudah, attendance_id]
    );

    // Insert correction log
    const corrRes = await client.query(
      `INSERT INTO hr_attendance_corrections (
        attendance_id, employee_id, field_changed, nilai_sebelum, nilai_sesudah, alasan, corrected_by
      ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 1))
      RETURNING *`,
      [attendance_id, att.employee_id, field_changed, String(nilai_sebelum || ""), String(nilai_sesudah || ""), alasan, user_id || 1]
    );

    await client.query("COMMIT");
    return NextResponse.json(corrRes.rows[0], { status: 201 });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
