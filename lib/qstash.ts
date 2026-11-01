import { Client, Receiver } from "@upstash/qstash";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { currentAppEnv } from "@/lib/integration/env";

export function appBaseUrl(): string | null {
  const raw = process.env.APP_BASE_URL;
  if (!raw || !raw.trim()) return null;
  return raw.trim().replace(/\/$/, "");
}

function qstashClient(): Client | null {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return null;
  return new Client({ token, baseUrl: process.env.QSTASH_URL || undefined });
}

export async function publishSyncJobs(jobIds: number[], attempt = 0): Promise<{ published: number; skipped: boolean }> {
  const base = appBaseUrl();
  const client = qstashClient();
  const ids = [...new Set(jobIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (!base || !client || !ids.length) return { published: 0, skipped: true };
  const env = currentAppEnv();
  let published = 0;
  for (const jobId of ids) {
    try {
      await client.publishJSON({
        url: `${base}/api/qstash/kledo-sync`,
        body: { jobId },
        deduplicationId: `kledo-${env}-job-${jobId}-a${attempt}`.slice(0, 100),
        retries: 3,
      });
      published += 1;
    } catch (err) {
      console.error("[qstash] publish gagal:", err instanceof Error ? err.message : "error");
    }
  }
  return { published, skipped: false };
}

export async function publishBatchContinuation(): Promise<void> {
  const base = appBaseUrl();
  const client = qstashClient();
  if (!base || !client) return;
  const env = currentAppEnv();
  try {
    await client.publishJSON({
      url: `${base}/api/qstash/kledo-sync`,
      body: { mode: "batch" },
      deduplicationId: `kledo-${env}-batch-${Date.now()}`.slice(0, 100),
      retries: 3,
    });
  } catch (err) {
    console.error("[qstash] lanjutan batch gagal:", err instanceof Error ? err.message : "error");
  }
}

export function publishJobsAfterResponse(jobIds: number[]) {
  const ids = [...new Set(jobIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return;
  try {
    after(async () => {
      await publishSyncJobs(ids);
    });
  } catch (err) {
    console.error("[qstash] jadwal after gagal:", err instanceof Error ? err.message : "error");
  }
}

function candidateUrls(req: Request): string[] {
  const path = new URL(req.url).pathname;
  const urls = new Set<string>();
  const add = (base: string | undefined | null) => {
    if (!base) return;
    urls.add(`${base.replace(/\/$/, "")}${path}`);
  };
  add(appBaseUrl());
  if (process.env.VERCEL_URL) add(`https://${process.env.VERCEL_URL}`);
  if (process.env.VERCEL_BRANCH_URL) add(`https://${process.env.VERCEL_BRANCH_URL}`);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) add(`${proto}://${forwardedHost}`);
  try {
    urls.add(new URL(req.url).origin + path);
  } catch {
    /* abaikan url internal yang tidak valid */
  }
  return [...urls];
}

export async function readVerifiedQstash(req: Request): Promise<
  { ok: true; bodyText: string; messageId: string | null } | { ok: false; response: NextResponse }
> {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!current || !next) {
    return { ok: false, response: NextResponse.json({ error: "Signature QStash tidak dapat diverifikasi" }, { status: 401 }) };
  }
  const signature = req.headers.get("upstash-signature");
  if (!signature) {
    return { ok: false, response: NextResponse.json({ error: "Signature tidak ada" }, { status: 401 }) };
  }
  const bodyText = await req.text();
  const receiver = new Receiver({ currentSigningKey: current, nextSigningKey: next, devMode: false });
  const region = req.headers.get("upstash-region") || undefined;
  let matched = false;
  let lastMessage = "";
  for (const url of candidateUrls(req)) {
    try {
      await receiver.verify({ signature, body: bodyText, url, clockTolerance: 30, upstashRegion: region });
      matched = true;
      break;
    } catch (err) {
      lastMessage = err instanceof Error ? err.message : "signature";
      if (!lastMessage.includes("invalid subject")) break;
    }
  }
  if (!matched) {
    console.error("[qstash] signature ditolak");
    return { ok: false, response: NextResponse.json({ error: "Signature tidak valid" }, { status: 401 }) };
  }
  return { ok: true, bodyText, messageId: req.headers.get("upstash-message-id") };
}
