import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireKledoAdmin } from "@/lib/integration/http";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireKledoAdmin();
  if (!admin.ok) return admin.response;
  const { id } = await params;
  const res = await pool.query(
    `UPDATE integration_sync_jobs
     SET status='cancelled', finished_at=now(), updated_at=now()
     WHERE id=$1 AND status IN ('pending','failed','blocked')
     RETURNING id`,
    [id]
  );
  if (!res.rows[0]) return NextResponse.json({ error: "Job tidak bisa dibatalkan" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
