import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const payrollRes = await pool.query(
      `SELECT p.*, u1.name as dihitung_oleh_nama, u2.name as disetujui_oleh_nama
       FROM hr_payrolls p
       LEFT JOIN users u1 ON u1.id = p.dihitung_oleh
       LEFT JOIN users u2 ON u2.id = p.disetujui_oleh
       WHERE p.id = $1`,
      [id]
    );

    if (payrollRes.rows.length === 0) {
      return NextResponse.json({ error: "Payroll tidak ditemukan" }, { status: 404 });
    }

    const detailsRes = await pool.query(
      `SELECT pd.*, e.kode_karyawan, e.no_telepon
       FROM hr_payroll_details pd
       JOIN hr_employees e ON e.id = pd.employee_id
       WHERE pd.payroll_id = $1
       ORDER BY pd.id ASC`,
      [id]
    );

    return NextResponse.json({
      ...payrollRes.rows[0],
      details: detailsRes.rows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, user_id, alasan_batal } = body;

    const validStatuses = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "FINAL", "CANCELLED"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Status payroll tidak valid" }, { status: 400 });
    }

    let statusCol = "updated_at = NOW()";
    const updateParams: any[] = [status];

    if (status === "PENDING_APPROVAL") {
      updateParams.push(user_id || 1);
      statusCol = `diajukan_oleh = $2, diajukan_pada = NOW()`;
    } else if (status === "APPROVED") {
      updateParams.push(user_id || 1);
      statusCol = `disetujui_oleh = $2, disetujui_pada = NOW()`;
    } else if (status === "FINAL") {
      updateParams.push(user_id || 1);
      statusCol = `difinalisasi_oleh = $2, difinalisasi_pada = NOW()`;
    } else if (status === "CANCELLED") {
      updateParams.push(user_id || 1, alasan_batal || null);
      statusCol = `dibatalkan_oleh = $2, dibatalkan_pada = NOW(), alasan_batal = $3`;
    }

    updateParams.push(id);
    const query = `
      UPDATE hr_payrolls
      SET status = $1, ${statusCol}, updated_at = NOW()
      WHERE id = $${updateParams.length}
      RETURNING *
    `;

    const { rows } = await pool.query(query, updateParams);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Payroll tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
