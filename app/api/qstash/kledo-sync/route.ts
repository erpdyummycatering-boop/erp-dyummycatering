import { NextResponse } from "next/server";
import { processJobs } from "@/lib/integration/outbox";
import { publishBatchContinuation, publishSyncJobs, readVerifiedQstash } from "@/lib/qstash";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const verified = await readVerifiedQstash(req);
  if (!verified.ok) return verified.response;
  let payload: { jobId?: number; mode?: string } = {};
  if (verified.bodyText.trim()) {
    try { payload = JSON.parse(verified.bodyText); } catch { payload = {}; }
  }
  const jobId = payload.jobId ? Number(payload.jobId) : null;
  const result = await processJobs({
    jobId,
    limit: 20,
    deadlineMs: Date.now() + 45_000,
    workerId: `qstash:${verified.messageId || "batch"}`.slice(0, 100),
    qstashMessageId: verified.messageId,
  });
  if (result.followUpIds.length) await publishSyncJobs(result.followUpIds);
  if (!jobId && result.remaining > 0) await publishBatchContinuation();
  if (result.qstashStatus === 429) {
    return NextResponse.json(result, { status: 429, headers: { "Retry-After": String(result.retryAfter || 60) } });
  }
  if (result.qstashStatus >= 500) return NextResponse.json(result, { status: result.qstashStatus });
  return NextResponse.json(result);
}
