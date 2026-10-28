import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const employee_id = searchParams.get("employee_id");

    let query = `
      SELECT s.*, e.nama_lengkap, e.kode_karyawan, e.tipe_gaji
      FROM hr_salary_structures s
      JOIN hr_employees e ON e.id = s.employee_id
    `;
    const params: any[] = [];

    if (employee_id) {
      params.push(employee_id);
      query += ` WHERE s.employee_id = $1`;
    }

    query += ` ORDER BY s.employee_id ASC, s.effective_date DESC`;

    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      employee_id,
      effective_date,
      gaji_pokok_harian,
      gaji_pokok_bulanan,
      lembur_per_jam,
      tunjangan_tetap,
      tunjangan_km_tier1,
      tunjangan_km_tier2,
      tunjangan_km_tier3,
      catatan,
    } = body;

    if (!employee_id || !effective_date || (gaji_pokok_harian === undefined && gaji_pokok_bulanan === undefined)) {
      return NextResponse.json({ error: "Karyawan, Tanggal Berlaku, dan Gaji Pokok wajib diisi" }, { status: 400 });
    }

    // Hitung estimasi harian dan lembur jika bulanan diisi tapi harian kosong
    const finalGajiBulanan = gaji_pokok_bulanan !== undefined && gaji_pokok_bulanan !== null ? Number(gaji_pokok_bulanan) : null;
    let finalGajiHarian = Number(gaji_pokok_harian || 0);
    if (!finalGajiHarian && finalGajiBulanan) {
      finalGajiHarian = Math.round(finalGajiBulanan / 26);
    }
    const finalLembur = lembur_per_jam !== undefined && lembur_per_jam !== null && lembur_per_jam !== ""
      ? Number(lembur_per_jam)
      : Math.round(finalGajiHarian / 8);

    let rows;
    if (id) {
      // Direct update by primary key ID
      const res = await pool.query(
        `UPDATE hr_salary_structures SET
          employee_id = $1,
          effective_date = $2,
          gaji_pokok_harian = $3,
          lembur_per_jam = $4,
          tunjangan_tetap = $5,
          tunjangan_km_tier1 = $6,
          tunjangan_km_tier2 = $7,
          tunjangan_km_tier3 = $8,
          catatan = $9,
          gaji_pokok_bulanan = $10
         WHERE id = $11
         RETURNING *`,
        [
          employee_id,
          effective_date,
          finalGajiHarian,
          finalLembur,
          tunjangan_tetap || 0,
          tunjangan_km_tier1 !== undefined ? tunjangan_km_tier1 : null,
          tunjangan_km_tier2 !== undefined ? tunjangan_km_tier2 : null,
          tunjangan_km_tier3 !== undefined ? tunjangan_km_tier3 : null,
          catatan || null,
          finalGajiBulanan,
          id,
        ]
      );
      rows = res.rows;
    } else {
      const res = await pool.query(
        `INSERT INTO hr_salary_structures (
          employee_id, effective_date, gaji_pokok_harian, lembur_per_jam,
          tunjangan_tetap, tunjangan_km_tier1, tunjangan_km_tier2, tunjangan_km_tier3, catatan, gaji_pokok_bulanan
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (employee_id, effective_date) DO UPDATE SET
          gaji_pokok_harian = EXCLUDED.gaji_pokok_harian,
          lembur_per_jam = EXCLUDED.lembur_per_jam,
          tunjangan_tetap = EXCLUDED.tunjangan_tetap,
          tunjangan_km_tier1 = EXCLUDED.tunjangan_km_tier1,
          tunjangan_km_tier2 = EXCLUDED.tunjangan_km_tier2,
          tunjangan_km_tier3 = EXCLUDED.tunjangan_km_tier3,
          catatan = EXCLUDED.catatan,
          gaji_pokok_bulanan = EXCLUDED.gaji_pokok_bulanan
        RETURNING *`,
        [
          employee_id,
          effective_date,
          finalGajiHarian,
          finalLembur,
          tunjangan_tetap || 0,
          tunjangan_km_tier1 !== undefined ? tunjangan_km_tier1 : null,
          tunjangan_km_tier2 !== undefined ? tunjangan_km_tier2 : null,
          tunjangan_km_tier3 !== undefined ? tunjangan_km_tier3 : null,
          catatan || null,
          finalGajiBulanan,
        ]
      );
      rows = res.rows;
    }

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
