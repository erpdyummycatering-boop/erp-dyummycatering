import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireKledoAdmin } from "@/lib/integration/http";
import { publishSyncJobs } from "@/lib/qstash";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireKledoAdmin();
  if (!admin.ok) return admin.response;
  const { id } = await params;
  const res = await pool.query(
    `UPDATE integration_sync_jobs
     SET status='pending', blocked_reason=NULL, last_error=NULL, run_after=now(), attempts=0,
         locked_at=NULL, locked_by=NULL, finished_at=NULL, updated_at=now()
     WHERE id=$1 AND status IN ('failed','blocked','dead','cancelled')
     RETURNING id`,
    [id]
  );
  if (!res.rows[0]) return NextResponse.json({ error: "Job tidak bisa diulang" }, { status: 400 });
  await publishSyncJobs([Number(res.rows[0].id)], 1);
  return NextResponse.json({ ok: true, id: Number(res.rows[0].id) });
}
