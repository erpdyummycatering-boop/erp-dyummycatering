import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const employee_id = searchParams.get("employee_id");

    let query = `
      SELECT o.*, e.nama_lengkap, e.kode_karyawan
      FROM hr_payroll_rule_overrides o
      JOIN hr_employees e ON e.id = o.employee_id
    `;
    const params: any[] = [];

    if (employee_id) {
      params.push(employee_id);
      query += ` WHERE o.employee_id = $1`;
    }

    query += ` ORDER BY o.id DESC`;

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
      employee_id,
      potongan_terlambat_aktif,
      potongan_tarif_per_menit,
      potongan_tarif_per_kejadian,
      lembur_maks_aktif,
      lembur_maks_jam_per_hari,
      lembur_maks_jam_per_bulan,
      lembur_perilaku_melewati,
      berlaku_mulai,
      berlaku_sampai,
      catatan,
    } = body;

    if (!employee_id) {
      return NextResponse.json({ error: "Employee ID wajib diisi" }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO hr_payroll_rule_overrides (
        employee_id, potongan_terlambat_aktif, potongan_tarif_per_menit,
        potongan_tarif_per_kejadian, lembur_maks_aktif, lembur_maks_jam_per_hari,
        lembur_maks_jam_per_bulan, lembur_perilaku_melewati, berlaku_mulai,
        berlaku_sampai, catatan
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_DATE), $10, $11)
      RETURNING *`,
      [
        employee_id,
        potongan_terlambat_aktif ?? null,
        potongan_tarif_per_menit ?? null,
        potongan_tarif_per_kejadian ?? null,
        lembur_maks_aktif ?? null,
        lembur_maks_jam_per_hari ?? null,
        lembur_maks_jam_per_bulan ?? null,
        lembur_perilaku_melewati ?? null,
        berlaku_mulai || null,
        berlaku_sampai || null,
        catatan || null,
      ]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID override wajib diisi" }, { status: 400 });
    }

    const { rows } = await pool.query(`DELETE FROM hr_payroll_rule_overrides WHERE id = $1 RETURNING *`, [id]);
    return NextResponse.json({ message: "Override dihapus", deleted: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
