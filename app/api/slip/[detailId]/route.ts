import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ detailId: string }> }) {
  try {
    const { detailId } = await params;

    const { rows } = await pool.query(
      `SELECT pd.*, e.kode_karyawan, e.no_telepon, p.nama_periode, p.periode_tahun, p.periode_bulan, p.status as payroll_status
       FROM hr_payroll_details pd
       JOIN hr_employees e ON e.id = pd.employee_id
       JOIN hr_payrolls p ON p.id = pd.payroll_id
       WHERE pd.id = $1`,
      [detailId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Slip gaji tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
