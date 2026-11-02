import pool from "@/lib/db";

export type Sql = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

let schemaCache: { at: number; ready: boolean } | null = null;
const columnCache = new Map<string, { at: number; cols: Set<string> }>();

export function invalidateSchemaCache() {
  schemaCache = null;
  columnCache.clear();
}

export function isMissingRelation(err: unknown): boolean {
  const anyErr = err as { code?: string; originalError?: { code?: string }; message?: string };
  const code = anyErr?.code || anyErr?.originalError?.code;
  if (code === "42P01" || code === "42703") return true;
  const msg = err instanceof Error ? err.message : String(err || "");
  return /does not exist/i.test(msg);
}

export async function integrationSchemaReady(db: Sql = pool): Promise<boolean> {
  if (schemaCache && Date.now() - schemaCache.at < 30_000) return schemaCache.ready;
  try {
    const res = await db.query(`SELECT to_regclass('public.integration_configs') AS rel`);
    const ready = Boolean(res.rows[0]?.rel);
    schemaCache = { at: Date.now(), ready };
    return ready;
  } catch (err) {
    if (isMissingRelation(err)) {
      schemaCache = { at: Date.now(), ready: false };
      return false;
    }
    return false;
  }
}

export async function tableColumns(table: string, db: Sql = pool): Promise<Set<string>> {
  const hit = columnCache.get(table);
  if (hit && Date.now() - hit.at < 60_000) return hit.cols;
  try {
    const res = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    const cols = new Set<string>(res.rows.map((row) => String(row.column_name)));
    columnCache.set(table, { at: Date.now(), cols });
    return cols;
  } catch {
    return new Set();
  }
}
