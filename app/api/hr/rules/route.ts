import { NextResponse } from "next/server";
import pool from "@/lib/db";

// GET /api/hr/rules - Get latest active payroll rule
export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM hr_payroll_rules ORDER BY berlaku_mulai DESC, id DESC LIMIT 1`
    );
    if (rows.length === 0) {
      return NextResponse.json({
        potongan_terlambat_aktif: false,
        potongan_mode: "PER_MENIT",
        potongan_tarif_per_menit: 0,
        potongan_tarif_per_kejadian: 0,
        potongan_toleransi_menit: 0,
        potongan_maks_per_hari: 0,
        lembur_maks_aktif: false,
        lembur_maks_jam_per_hari: 0,
        lembur_maks_jam_per_bulan: 0,
        lembur_perilaku_melewati: "TANDAI_SAJA",
      });
    }
    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/hr/rules - Create/Update payroll rules
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      potongan_terlambat_aktif,
      potongan_mode,
      potongan_tarif_per_menit,
      potongan_tarif_per_kejadian,
      potongan_toleransi_menit,
      potongan_maks_per_hari,
      lembur_maks_aktif,
      lembur_maks_jam_per_hari,
      lembur_maks_jam_per_bulan,
      lembur_perilaku_melewati,
      berlaku_mulai,
      catatan,
    } = body;

    const { rows } = await pool.query(
      `INSERT INTO hr_payroll_rules (
        potongan_terlambat_aktif, potongan_mode, potongan_tarif_per_menit,
        potongan_tarif_per_kejadian, potongan_toleransi_menit, potongan_maks_per_hari,
        lembur_maks_aktif, lembur_maks_jam_per_hari, lembur_maks_jam_per_bulan,
        lembur_perilaku_melewati, berlaku_mulai, catatan
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, CURRENT_DATE), $12)
      RETURNING *`,
      [
        Boolean(potongan_terlambat_aktif),
        potongan_mode || "PER_MENIT",
        potongan_tarif_per_menit || 0,
        potongan_tarif_per_kejadian || 0,
        potongan_toleransi_menit || 0,
        potongan_maks_per_hari || 0,
        Boolean(lembur_maks_aktif),
        lembur_maks_jam_per_hari || 0,
        lembur_maks_jam_per_bulan || 0,
        lembur_perilaku_melewati || "TANDAI_SAJA",
        berlaku_mulai || null,
        catatan || null,
      ]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
