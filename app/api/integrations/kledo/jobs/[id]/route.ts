import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireKledoAdmin } from "@/lib/integration/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireKledoAdmin();
  if (!admin.ok) return admin.response;
  const { id } = await params;
  const job = await pool.query(
    `SELECT id, config_id, entity_type, local_id, action, status, attempts, max_attempts,
            last_error, blocked_reason, triggered_by, run_after, created_at, updated_at, finished_at
     FROM integration_sync_jobs WHERE id = $1`,
    [id]
  );
  if (!job.rows[0]) return NextResponse.json({ error: "Job tidak ditemukan" }, { status: 404 });
  const logs = await pool.query(
    `SELECT id, http_method, url_path, response_code, duration_ms, ratelimit_remaining, error_message, created_at, request_body, response_body
     FROM integration_sync_logs WHERE job_id = $1 ORDER BY id DESC LIMIT 20`,
    [id]
  );
  return NextResponse.json({ job: job.rows[0], logs: logs.rows });
}
