import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, u1.name as dihitung_oleh_nama, u2.name as disetujui_oleh_nama
       FROM hr_payrolls p
       LEFT JOIN users u1 ON u1.id = p.dihitung_oleh
       LEFT JOIN users u2 ON u2.id = p.disetujui_oleh
       ORDER BY COALESCE(p.tanggal_mulai, p.created_at::date) DESC, p.id DESC`
    );
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
