import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getActiveConfig } from "@/lib/integration/config";
import { isMissingRelation } from "@/lib/integration/schema";
import { enqueueJob, invCreateKey, processJobs } from "@/lib/integration/outbox";
import { publishBatchContinuation, publishSyncJobs, readVerifiedQstash } from "@/lib/qstash";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const verified = await readVerifiedQstash(req);
  if (!verified.ok) return verified.response;
  const config = await getActiveConfig().catch((err) => {
    if (isMissingRelation(err)) return null;
    throw err;
  });
  if (!config || !config.goLiveDate) {
    return NextResponse.json({ ok: true, disabled: !config, enqueued: 0 });
  }

  let orderIds: number[] = [];
  try {
    const due = await pool.query(
      `SELECT o.id
       FROM orders o
       WHERE o.lini = 'catering'
         AND o.delivery_date <= (now() AT TIME ZONE 'Asia/Jakarta')::date
         AND o.delivery_date >= $1::date
         AND COALESCE(o.status_order, '') NOT IN ('Batal', 'Dibatalkan')
         AND o.kledo_invoice_id IS NULL
         AND o.kledo_so_id IS NOT NULL
       ORDER BY o.delivery_date, o.id
       LIMIT 200`,
      [config.goLiveDate]
    );
    orderIds = due.rows.map((row) => Number(row.id));
  } catch (err) {
    if (isMissingRelation(err)) return NextResponse.json({ ok: true, disabled: true, enqueued: 0 });
    throw err;
  }

  const jobIds: number[] = [];
  for (const orderId of orderIds) {
    const id = await enqueueJob(pool, {
      configId: config.id,
      entityType: "invoice",
      localId: orderId,
      action: "create_invoice",
      idempotencyKey: invCreateKey(config.id, orderId),
      priority: 6,
      triggeredBy: "qstash_invoice",
    });
    if (id) jobIds.push(id);
  }

  await pool.query(
    `DELETE FROM integration_sync_logs
     WHERE id IN (SELECT id FROM integration_sync_logs WHERE created_at < now() - interval '90 days' LIMIT 500)`
  ).catch(() => undefined);

  const result = await processJobs({
    limit: 20,
    deadlineMs: Date.now() + 45_000,
    workerId: `qstash-invoice:${verified.messageId || "schedule"}`.slice(0, 100),
    qstashMessageId: verified.messageId,
  });
  if (result.followUpIds.length) await publishSyncJobs(result.followUpIds);
  if (result.remaining > 0) await publishBatchContinuation();
  return NextResponse.json({ ok: true, enqueued: jobIds.length, ...result });
}
