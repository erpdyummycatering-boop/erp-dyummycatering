import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Manual approve endpoint — accessible by Chef & Super Admin
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    const schedRes = await client.query(`SELECT * FROM production_schedules WHERE id = $1`, [id]);
    if (!schedRes.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const sched = schedRes.rows[0];

    if (sched.status === "Approved") {
      return NextResponse.json({ error: "Schedule already approved" }, { status: 409 });
    }

    const res = await client.query(
      `UPDATE production_schedules SET status='Approved', updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id]
    );
    return NextResponse.json(res.rows[0]);
  } finally { client.release(); }
}
