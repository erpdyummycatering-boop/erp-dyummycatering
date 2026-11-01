import pool from "@/lib/db";
import type { IntegrationConfig } from "@/lib/integration/types";

const TIMEOUT_MS = 20_000;
let lastCallAt = 0;
let remainingQuota: number | null = null;

export type KledoResult = {
  status: number;
  ok: boolean;
  success: boolean;
  message: string;
  data: any;
  raw: unknown;
  ratelimitLimit: number | null;
  ratelimitRemaining: number | null;
  retryAfter: number | null;
  durationMs: number;
};

export class KledoError extends Error {
  status: number;
  transient: boolean;
  retryAfter: number | null;
  result: KledoResult;
  constructor(message: string, result: KledoResult) {
    super(message);
    this.name = "KledoError";
    this.status = result.status;
    this.result = result;
    this.retryAfter = result.retryAfter;
    this.transient = result.status === 0 || result.status === 429 || result.status >= 500;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pace() {
  const wait = 200 - (Date.now() - lastCallAt);
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();
}

function numHeader(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function shrink(value: unknown): unknown {
  if (value == null) return null;
  try {
    const text = JSON.stringify(value);
    if (text.length <= 8000) return JSON.parse(text);
    return { truncated: true, preview: text.slice(0, 4000) };
  } catch {
    return { unserializable: true };
  }
}

export function kledoList(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

export async function kledoRequest(
  config: IntegrationConfig,
  opts: {
    method: string;
    path: string;
    body?: unknown;
    jobId?: number | null;
    qstashMessageId?: string | null;
  }
): Promise<KledoResult> {
  if (remainingQuota != null && remainingQuota < 20) {
    const blocked: KledoResult = {
      status: 429,
      ok: false,
      success: false,
      message: "Sisa kuota Kledo di bawah 20. Antrian ditunda.",
      data: null,
      raw: null,
      ratelimitLimit: null,
      ratelimitRemaining: remainingQuota,
      retryAfter: 60,
      durationMs: 0,
    };
    throw new KledoError(blocked.message, blocked);
  }

  await pace();
  const path = opts.path.startsWith("/") ? opts.path : `/${opts.path}`;
  const url = `${config.baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  let status = 0;
  let rawText = "";
  let headers: Headers | null = null;
  try {
    const response = await fetch(url, {
      method: opts.method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.token}`,
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    status = response.status;
    headers = response.headers;
    rawText = await response.text();
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    const result: KledoResult = {
      status: 0,
      ok: false,
      success: false,
      message: aborted ? "Timeout saat menghubungi Kledo (20 detik)" : "Gagal menghubungi Kledo",
      data: null,
      raw: null,
      ratelimitLimit: null,
      ratelimitRemaining: remainingQuota,
      retryAfter: null,
      durationMs: Date.now() - started,
    };
    await writeLog(config, opts, result);
    throw new KledoError(result.message, result);
  } finally {
    clearTimeout(timer);
  }

  let parsed: any = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { message: rawText.slice(0, 500) };
    }
  }
  const ratelimitRemaining = headers ? numHeader(headers, "x-ratelimit-remaining") : null;
  if (ratelimitRemaining != null) remainingQuota = ratelimitRemaining;
  const retryAfter = headers ? numHeader(headers, "retry-after") : null;
  const success = Boolean(parsed?.success) && status >= 200 && status < 300;
  const result: KledoResult = {
    status,
    ok: success,
    success,
    message: String(parsed?.message || (success ? "OK" : `Kledo HTTP ${status}`)),
    data: parsed?.data ?? null,
    raw: parsed,
    ratelimitLimit: headers ? numHeader(headers, "x-ratelimit-limit") : null,
    ratelimitRemaining,
    retryAfter,
    durationMs: Date.now() - started,
  };
  await writeLog(config, opts, result);
  if (!success) throw new KledoError(result.message, result);
  return result;
}

async function writeLog(
  config: IntegrationConfig,
  opts: { method: string; path: string; body?: unknown; jobId?: number | null; qstashMessageId?: string | null },
  result: KledoResult
) {
  try {
    await pool.query(
      `INSERT INTO integration_sync_logs
        (job_id, config_id, http_method, url_path, request_body, response_code, response_body, duration_ms, ratelimit_remaining, error_message, qstash_message_id)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8,$9,$10,$11)`,
      [
        opts.jobId ?? null,
        config.id,
        opts.method,
        opts.path.split("?")[0],
        JSON.stringify(shrink(opts.body ?? null)),
        result.status || null,
        JSON.stringify(shrink(result.raw)),
        result.durationMs,
        result.ratelimitRemaining,
        result.ok ? null : result.message.slice(0, 500),
        opts.qstashMessageId ?? null,
      ]
    );
  } catch (err) {
    console.error("[kledo] gagal menulis sync log:", err instanceof Error ? err.message : "error");
  }
}

export function resetKledoPaceForTests() {
  lastCallAt = 0;
  remainingQuota = null;
}
