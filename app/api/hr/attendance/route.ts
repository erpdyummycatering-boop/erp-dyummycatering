import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const employee_id = searchParams.get("employee_id");
    const is_anomali = searchParams.get("is_anomali");

    let query = `
      SELECT a.*, e.nama_lengkap, e.kode_karyawan, e.nama_fingerprint,
             d.nama as department_nama, p.nama as position_nama
      FROM hr_attendances a
      JOIN hr_employees e ON e.id = a.employee_id
      LEFT JOIN hr_departments d ON d.id = e.department_id
      LEFT JOIN hr_positions p ON p.id = e.position_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (year && month) {
      params.push(year, month);
      query += ` AND EXTRACT(YEAR FROM a.tanggal) = $${params.length - 1} AND EXTRACT(MONTH FROM a.tanggal) = $${params.length}`;
    }

    if (employee_id) {
      params.push(employee_id);
      query += ` AND a.employee_id = $${params.length}`;
    }

    if (is_anomali === "true") {
      query += ` AND (a.is_anomali = true OR a.tidak_scan_lengkap = true)`;
    }

    query += ` ORDER BY a.tanggal DESC, e.nama_lengkap ASC`;

    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { employee_id, tanggal, jam_masuk, jam_keluar, keterangan, catatan } = body;

    if (!employee_id || !tanggal) {
      return NextResponse.json({ error: "Employee ID dan Tanggal wajib diisi" }, { status: 400 });
    }

    const isNoScan = (!jam_masuk && !!jam_keluar) || (!!jam_masuk && !jam_keluar);

    const { rows } = await pool.query(
      `INSERT INTO hr_attendances (
        employee_id, tanggal, jam_masuk, jam_keluar, keterangan, tidak_scan_lengkap, is_anomali, source, catatan
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'MANUAL', $8)
      ON CONFLICT (employee_id, tanggal) DO UPDATE SET
        jam_masuk = EXCLUDED.jam_masuk,
        jam_keluar = EXCLUDED.jam_keluar,
        keterangan = EXCLUDED.keterangan,
        tidak_scan_lengkap = EXCLUDED.tidak_scan_lengkap,
        is_anomali = EXCLUDED.is_anomali,
        source = 'MANUAL',
        catatan = EXCLUDED.catatan,
        updated_at = NOW()
      RETURNING *`,
      [employee_id, tanggal, jam_masuk || null, jam_keluar || null, keterangan || "HADIR", isNoScan, isNoScan, catatan || null]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
