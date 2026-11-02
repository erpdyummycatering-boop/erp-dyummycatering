import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { integrationSchemaReady } from "@/lib/integration/schema";
import { requireKledoAdmin } from "@/lib/integration/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireKledoAdmin();
  if (!admin.ok) return admin.response;
  if (!(await integrationSchemaReady())) return NextResponse.json({ data: [], total: 0, schemaReady: false });
  const status = new URL(req.url).searchParams.get("status") || "";
  const page = Math.max(1, Number(new URL(req.url).searchParams.get("page") || 1));
  const limit = Math.min(50, Number(new URL(req.url).searchParams.get("limit") || 20));
  const offset = (page - 1) * limit;
  const values: unknown[] = [];
  let where = "";
  if (status) {
    values.push(status);
    where = `WHERE status = $1`;
  }
  const count = await pool.query(`SELECT COUNT(*)::int AS n FROM integration_sync_jobs ${where}`, values);
  const data = await pool.query(
    `SELECT id, config_id, entity_type, local_id, action, status, attempts, max_attempts, priority,
            last_error, blocked_reason, triggered_by, run_after, created_at, updated_at, finished_at
     FROM integration_sync_jobs ${where}
     ORDER BY id DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset]
  );
  return NextResponse.json({ data: data.rows, total: count.rows[0].n, page, limit, schemaReady: true });
}
