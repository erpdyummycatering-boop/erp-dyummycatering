import pool from "@/lib/db";
import { getActiveConfig, getConfigById, markConfigUnauthorized } from "@/lib/integration/config";
import { isMissingRelation, tableColumns, type Sql } from "@/lib/integration/schema";
import { KledoError } from "@/lib/kledo/client";
import { BlockedJob, DeferJob, executeSyncJob, type FollowUp, type JobRow } from "@/lib/kledo/sync";

const BACKOFF_SEC = [60, 300, 900, 3600, 21600, 86400];

export type JobInput = {
  configId: number;
  entityType: string;
  localId: number;
  action: string;
  idempotencyKey: string;
  priority?: number;
  triggeredBy?: string | null;
  createdBy?: number | null;
};

export type ProcessResult = {
  processed: number;
  remaining: number;
  qstashStatus: number;
  retryAfter?: number;
  followUpIds: number[];
  disabled?: boolean;
  outcomes: { jobId: number; status: string; message?: string }[];
};

export function soCreateKey(configId: number, orderId: number) {
  return `kledo:${configId}:so:create:${orderId}`;
}
export function soUpdateKey(configId: number, orderId: number, hash: string) {
  return `kledo:${configId}:so:update:${orderId}:${hash}`;
}
export function soVoidKey(configId: number, orderId: number) {
  return `kledo:${configId}:so:void:${orderId}`;
}
export function invCreateKey(configId: number, orderId: number) {
  return `kledo:${configId}:inv:create:${orderId}`;
}
export function invVoidKey(configId: number, orderId: number) {
  return `kledo:${configId}:inv:void:${orderId}`;
}

export async function enqueueJob(db: Sql, input: JobInput): Promise<number | null> {
  const key = input.idempotencyKey.slice(0, 150);
  const triggeredBy = input.triggeredBy ? String(input.triggeredBy).slice(0, 30) : null;
  const res = await db.query(
    `INSERT INTO integration_sync_jobs
      (config_id, entity_type, local_id, action, idempotency_key, priority, triggered_by, created_by, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
     ON CONFLICT (idempotency_key) DO UPDATE SET
       triggered_by = COALESCE(EXCLUDED.triggered_by, integration_sync_jobs.triggered_by),
       priority = LEAST(integration_sync_jobs.priority, EXCLUDED.priority),
       status = CASE
         WHEN integration_sync_jobs.status IN ('failed','blocked','dead','cancelled') THEN 'pending'
         ELSE integration_sync_jobs.status END,
       run_after = CASE
         WHEN integration_sync_jobs.status IN ('failed','blocked','dead','cancelled') THEN now()
         ELSE integration_sync_jobs.run_after END,
       blocked_reason = CASE
         WHEN integration_sync_jobs.status IN ('failed','blocked','dead','cancelled') THEN NULL
         ELSE integration_sync_jobs.blocked_reason END,
       finished_at = CASE
         WHEN integration_sync_jobs.status IN ('failed','blocked','dead','cancelled') THEN NULL
         ELSE integration_sync_jobs.finished_at END,
       updated_at = now()
     WHERE integration_sync_jobs.status <> 'success'
     RETURNING id, status`,
    [
      input.configId,
      input.entityType,
      input.localId,
      input.action,
      key,
      input.priority ?? 5,
      triggeredBy,
      input.createdBy ?? null,
    ]
  );
  const row = res.rows[0];
  if (row && (row.status === "pending" || row.status === "failed" || row.status === "processing")) {
    if (row.status === "pending") await markOrderQueued(db, input.localId, input.configId);
    return Number(row.id);
  }
  return null;
}

export async function cancelOpenJobs(db: Sql, configId: number, orderId: number, exceptKey?: string) {
  await db.query(
    `UPDATE integration_sync_jobs
     SET status='cancelled', finished_at=now(), updated_at=now()
     WHERE config_id=$1 AND local_id=$2 AND status IN ('pending','failed','blocked')
       AND action IN ('create','update','create_invoice')
       AND idempotency_key IS DISTINCT FROM $3`,
    [configId, orderId, exceptKey ?? ""]
  );
}

async function markOrderQueued(db: Sql, orderId: number, configId: number) {
  const cols = await tableColumns("orders", db);
  if (!cols.has("kledo_sync_status") || !cols.has("kledo_config_id")) return;
  const statusExpr = cols.has("kledo_invoice_id")
    ? "CASE WHEN kledo_invoice_id IS NULL THEN 'queued' ELSE kledo_sync_status END"
    : "'queued'";
  await db.query(
    `UPDATE orders SET kledo_sync_status=${statusExpr}, kledo_config_id=$2, kledo_sync_error=NULL WHERE id=$1`,
    [orderId, configId]
  );
}

async function setOrderProblem(db: Sql, orderId: number, status: string, message: string) {
  const cols = await tableColumns("orders", db);
  if (!cols.has("kledo_sync_status")) return;
  const guard = cols.has("kledo_invoice_id") ? "AND kledo_invoice_id IS NULL" : "";
  await db.query(
    `UPDATE orders SET kledo_sync_status=$2, kledo_sync_error=$3 WHERE id=$1 ${guard}`,
    [orderId, status, message.slice(0, 500)]
  );
}

function backoffSeconds(attempts: number, retryAfter?: number | null) {
  if (retryAfter && retryAfter > 0) return Math.min(retryAfter, 86_400);
  const index = Math.min(Math.max(attempts, 1), BACKOFF_SEC.length) - 1;
  return BACKOFF_SEC[index];
}

async function claimJobs(workerId: string, limit: number, jobId: number | null, configId: number): Promise<JobRow[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE integration_sync_jobs
       SET status='failed', locked_at=NULL, locked_by=NULL, last_error='Worker macet dan di-reset', run_after=now(), updated_at=now()
       WHERE status='processing' AND locked_at < now() - interval '10 minutes'`
    );
    await client.query(
      `UPDATE integration_sync_jobs
       SET status='dead', finished_at=now(), updated_at=now()
       WHERE status IN ('pending','failed') AND attempts >= max_attempts
         AND COALESCE(blocked_reason,'') NOT IN ('VALIDATION','AUTH')`
    );
    const res = await client.query(
      `UPDATE integration_sync_jobs
       SET status='processing', locked_at=now(), locked_by=$1, attempts=attempts+1, updated_at=now()
       WHERE id IN (
         SELECT id FROM integration_sync_jobs
         WHERE config_id=$2
           AND status IN ('pending','failed')
           AND attempts < max_attempts
           AND COALESCE(blocked_reason,'') NOT IN ('VALIDATION','AUTH')
           AND ($3::bigint IS NOT NULL OR run_after <= now())
           AND ($3::bigint IS NULL OR id = $3)
         ORDER BY priority, id
         LIMIT $4
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, config_id, entity_type, local_id, action, idempotency_key, attempts, max_attempts, triggered_by`,
      [workerId, configId, jobId, limit]
    );
    await client.query("COMMIT");
    return res.rows.map(mapJob);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function mapJob(row: any): JobRow {
  return {
    id: Number(row.id),
    config_id: Number(row.config_id),
    entity_type: row.entity_type,
    local_id: Number(row.local_id),
    action: row.action,
    idempotency_key: row.idempotency_key,
    attempts: Number(row.attempts),
    max_attempts: Number(row.max_attempts),
    triggered_by: row.triggered_by,
  };
}

async function countRemaining(configId: number): Promise<number> {
  const res = await pool.query(
    `SELECT COUNT(*)::int AS n FROM integration_sync_jobs
     WHERE config_id=$1 AND status IN ('pending','failed') AND run_after <= now()
       AND attempts < max_attempts
       AND COALESCE(blocked_reason,'') NOT IN ('VALIDATION','AUTH')`,
    [configId]
  );
  return Number(res.rows[0]?.n || 0);
}

export async function processJobs(opts: {
  jobId?: number | null;
  limit?: number;
  deadlineMs: number;
  workerId: string;
  qstashMessageId?: string | null;
}): Promise<ProcessResult> {
  const empty: ProcessResult = { processed: 0, remaining: 0, qstashStatus: 200, followUpIds: [], outcomes: [] };
  let active;
  try {
    active = await getActiveConfig();
  } catch (err) {
    if (isMissingRelation(err)) return { ...empty, disabled: true };
    throw err;
  }
  if (!active) return { ...empty, disabled: true };

  if (opts.jobId) {
    const existing = await pool.query(`SELECT status, blocked_reason, config_id FROM integration_sync_jobs WHERE id=$1`, [opts.jobId]);
    const row = existing.rows[0];
    if (!row) return { ...empty, outcomes: [{ jobId: opts.jobId, status: "missing" }] };
    if (row.status === "success" || row.status === "cancelled" || row.status === "blocked" || row.status === "dead") {
      return { ...empty, outcomes: [{ jobId: opts.jobId, status: "skipped" }] };
    }
    if (row.blocked_reason === "VALIDATION" || row.blocked_reason === "AUTH") {
      return { ...empty, outcomes: [{ jobId: opts.jobId, status: "skipped", message: row.blocked_reason }] };
    }
    if (Number(row.config_id) !== active.id) {
      return { ...empty, outcomes: [{ jobId: opts.jobId, status: "skipped", message: "config" }] };
    }
  }

  const limit = opts.jobId ? 1 : Math.min(opts.limit ?? 20, 20);
  let jobs: JobRow[] = [];
  try {
    jobs = await claimJobs(opts.workerId, limit, opts.jobId ?? null, active.id);
  } catch (err) {
    if (isMissingRelation(err)) return { ...empty, disabled: true };
    throw err;
  }

  const outcomes: ProcessResult["outcomes"] = [];
  const followUpIds: number[] = [];
  let qstashStatus = 200;
  let retryAfter: number | undefined;

  for (const job of jobs) {
    if (Date.now() > opts.deadlineMs) {
      await pool.query(
        `UPDATE integration_sync_jobs
         SET status='pending', attempts=GREATEST(attempts-1,0), locked_at=NULL, locked_by=NULL, run_after=now(), updated_at=now()
         WHERE id=$1 AND status='processing'`,
        [job.id]
      );
      continue;
    }
    const config = await getConfigById(job.config_id);
    if (!config || !config.syncEnabled) {
      await pool.query(
        `UPDATE integration_sync_jobs
         SET status='pending', attempts=GREATEST(attempts-1,0), locked_at=NULL, locked_by=NULL, updated_at=now()
         WHERE id=$1`,
        [job.id]
      );
      outcomes.push({ jobId: job.id, status: "skipped", message: "sync_disabled" });
      continue;
    }
    const outcome = await runJob(job, config, opts.qstashMessageId ?? null);
    outcomes.push({ jobId: job.id, status: outcome.status, message: outcome.message });
    followUpIds.push(...outcome.followUpIds);
    if (opts.jobId && outcome.qstashStatus > qstashStatus) {
      qstashStatus = outcome.qstashStatus;
      retryAfter = outcome.retryAfter;
    }
  }

  const remaining = await countRemaining(active.id).catch(() => 0);
  return { processed: outcomes.length, remaining, qstashStatus, retryAfter, followUpIds, outcomes };
}

async function runJob(job: JobRow, config: NonNullable<Awaited<ReturnType<typeof getConfigById>>>, qstashMessageId: string | null): Promise<{
  status: string;
  message?: string;
  qstashStatus: number;
  retryAfter?: number;
  followUpIds: number[];
}> {
  const client = await pool.connect();
  try {
    const followUps = await executeSyncJob(client, job, config, qstashMessageId);
    await client.query(
      `UPDATE integration_sync_jobs
       SET status='success', last_error=NULL, blocked_reason=NULL, locked_at=NULL, locked_by=NULL, finished_at=now(), updated_at=now()
       WHERE id=$1`,
      [job.id]
    );
    const followUpIds: number[] = [];
    for (const follow of followUps) followUpIds.push(...(await enqueueFollowUp(client, job, follow)));
    return { status: "success", qstashStatus: 200, followUpIds };
  } catch (err) {
    if (err instanceof DeferJob) {
      await client.query(
        `UPDATE integration_sync_jobs
         SET status='pending', attempts=GREATEST(attempts-1,0), run_after=now() + make_interval(secs => $2::int),
             locked_at=NULL, locked_by=NULL, last_error=$3, updated_at=now()
         WHERE id=$1`,
        [job.id, err.seconds, err.message]
      );
      return { status: "deferred", message: err.message, qstashStatus: 200, followUpIds: [] };
    }
    if (err instanceof BlockedJob) {
      await client.query(
        `UPDATE integration_sync_jobs
         SET status='blocked', blocked_reason=$2, last_error=$3, locked_at=NULL, locked_by=NULL, finished_at=now(), updated_at=now()
         WHERE id=$1`,
        [job.id, String(err.reason).slice(0, 100), err.message]
      );
      await setOrderProblem(client, job.local_id, "blocked", err.message);
      return { status: "blocked", message: err.message, qstashStatus: 200, followUpIds: [] };
    }
    if (err instanceof KledoError && (err.status === 400 || err.status === 404 || err.status === 422)) {
      await client.query(
        `UPDATE integration_sync_jobs
         SET status='failed', blocked_reason='VALIDATION', last_error=$2, locked_at=NULL, locked_by=NULL, finished_at=now(), updated_at=now()
         WHERE id=$1`,
        [job.id, err.message.slice(0, 500)]
      );
      await setOrderProblem(client, job.local_id, "failed", err.message);
      return { status: "failed", message: err.message, qstashStatus: 200, followUpIds: [] };
    }
    if (err instanceof KledoError && (err.status === 401 || err.status === 403)) {
      await client.query(
        `UPDATE integration_sync_jobs
         SET status='failed', blocked_reason='AUTH', last_error=$2, locked_at=NULL, locked_by=NULL, finished_at=now(), updated_at=now()
         WHERE id=$1`,
        [job.id, err.message.slice(0, 500)]
      );
      await setOrderProblem(client, job.local_id, "failed", "Token Kledo ditolak");
      await markConfigUnauthorized(config.id, "Token Kledo ditolak (401). Sync dimatikan sampai token diganti dan test berhasil.");
      return { status: "failed", message: "AUTH", qstashStatus: 200, followUpIds: [] };
    }
    const retryAfter = err instanceof KledoError ? err.retryAfter : null;
    const message = err instanceof Error ? err.message : "Gagal sementara";
    const delay = backoffSeconds(job.attempts, retryAfter);
    const dead = job.attempts >= job.max_attempts;
    await client.query(
      `UPDATE integration_sync_jobs
       SET status=$2, blocked_reason=NULL, last_error=$3, run_after=now() + make_interval(secs => $4::int),
           locked_at=NULL, locked_by=NULL, finished_at=CASE WHEN $2='dead' THEN now() ELSE NULL END, updated_at=now()
       WHERE id=$1`,
      [job.id, dead ? "dead" : "failed", message.slice(0, 500), delay]
    );
    if (dead) await setOrderProblem(client, job.local_id, "failed", message);
    const status = err instanceof KledoError && err.status === 429 ? 429 : 500;
    return { status: dead ? "dead" : "failed", message, qstashStatus: dead ? 200 : status, retryAfter: retryAfter ?? delay, followUpIds: [] };
  } finally {
    client.release();
  }
}

async function enqueueFollowUp(db: Sql, job: JobRow, follow: FollowUp): Promise<number[]> {
  const id = await enqueueJob(db, {
    configId: job.config_id,
    entityType: follow.entityType,
    localId: follow.localId,
    action: follow.action,
    idempotencyKey: follow.idempotencyKey,
    priority: follow.priority,
    triggeredBy: follow.triggeredBy,
  });
  return id ? [id] : [];
}
