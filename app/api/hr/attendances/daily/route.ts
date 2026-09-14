import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || new Date().toISOString().substring(0, 10);
    const department_id = searchParams.get("department_id");

    let query = `
      SELECT 
        e.id as employee_id,
        e.kode_karyawan,
        e.nama_lengkap,
        e.nama_fingerprint,
        e.tipe_karyawan,
        e.tipe_gaji,
        e.tipe_periode_gaji,
        d.nama as department_nama,
        p.nama as position_nama,
        COALESCE(s.gaji_pokok_harian, 0) as gaji_pokok_harian,
        COALESCE(s.lembur_per_jam, 0) as lembur_per_jam,
        a.id as attendance_id,
        a.tanggal,
        a.jam_masuk,
        a.jam_keluar,
        COALESCE(a.durasi_kerja_menit, 0) as durasi_kerja_menit,
        COALESCE(a.lembur_menit, 0) as lembur_menit,
        COALESCE(a.lembur_pagi_menit, 0) as lembur_pagi_menit,
        COALESCE(a.bonus_harian, 0) as bonus_harian,
        COALESCE(a.keterangan, 'HADIR') as keterangan,
        COALESCE(a.tidak_scan_lengkap, false) as tidak_scan_lengkap,
        a.catatan
      FROM hr_employees e
      LEFT JOIN hr_departments d ON d.id = e.department_id
      LEFT JOIN hr_positions p ON p.id = e.position_id
      LEFT JOIN LATERAL (
        SELECT * FROM hr_salary_structures ss
        WHERE ss.employee_id = e.id AND ss.effective_date <= $1::date
        ORDER BY ss.effective_date DESC LIMIT 1
      ) s ON true
      LEFT JOIN hr_attendances a ON a.employee_id = e.id AND a.tanggal = $1::date
      WHERE e.status = 'AKTIF'
    `;

    const params: any[] = [date];
    if (department_id) {
      params.push(department_id);
      query += ` AND e.department_id = $${params.length}`;
    }

    query += ` ORDER BY d.id ASC, e.nama_lengkap ASC`;

    const { rows } = await pool.query(query, params);
    return NextResponse.json({
      date,
      total: rows.length,
      employees: rows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { date, records, user_id } = body;

    if (!date || !Array.isArray(records)) {
      return NextResponse.json({ error: "Parameter date dan array records wajib diisi" }, { status: 400 });
    }

    await client.query("BEGIN");

    for (const item of records) {
      const {
        employee_id,
        jam_masuk,
        jam_keluar,
        durasi_kerja_menit,
        lembur_menit,
        lembur_pagi_menit,
        bonus_harian,
        keterangan,
        catatan,
      } = item;

      if (!employee_id) continue;

      const isNoScan = (!jam_masuk && !!jam_keluar) || (!!jam_masuk && !jam_keluar);

      await client.query(
        `INSERT INTO hr_attendances (
          employee_id, tanggal, jam_masuk, jam_keluar, durasi_kerja_menit,
          lembur_menit, lembur_pagi_menit, bonus_harian, keterangan,
          tidak_scan_lengkap, is_anomali, source, catatan, created_by, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'MANUAL_HR', $12, $13, NOW())
        ON CONFLICT (employee_id, tanggal) DO UPDATE SET
          jam_masuk = EXCLUDED.jam_masuk,
          jam_keluar = EXCLUDED.jam_keluar,
          durasi_kerja_menit = EXCLUDED.durasi_kerja_menit,
          lembur_menit = EXCLUDED.lembur_menit,
          lembur_pagi_menit = EXCLUDED.lembur_pagi_menit,
          bonus_harian = EXCLUDED.bonus_harian,
          keterangan = EXCLUDED.keterangan,
          tidak_scan_lengkap = EXCLUDED.tidak_scan_lengkap,
          is_anomali = EXCLUDED.is_anomali,
          catatan = EXCLUDED.catatan,
          updated_at = NOW()`,
        [
          employee_id,
          date,
          jam_masuk || null,
          jam_keluar || null,
          durasi_kerja_menit !== undefined && durasi_kerja_menit !== null ? parseInt(durasi_kerja_menit, 10) : null,
          lembur_menit ? parseInt(lembur_menit, 10) : 0,
          lembur_pagi_menit ? parseInt(lembur_pagi_menit, 10) : 0,
          bonus_harian ? parseInt(bonus_harian, 10) : 0,
          keterangan || "HADIR",
          isNoScan,
          isNoScan,
          catatan || null,
          user_id || 1,
        ]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ message: "Presensi dan bonus harian berhasil disimpan", count: records.length });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
