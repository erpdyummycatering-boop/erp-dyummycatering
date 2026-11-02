import pool from "@/lib/db";
import { decryptSecret, encryptSecret, encryptionReady } from "@/lib/crypto";
import { toDateOnly } from "@/lib/integration/dates";
import {
  allowedConfigEnvironments,
  configAllowed,
  currentAppEnv,
  envGuardMessage,
  isValidKledoBaseUrl,
  kledoAccountFromUrl,
  kledoBadge,
  normalizeKledoBaseUrl,
  type AppEnv,
  type ConfigEnvironment,
} from "@/lib/integration/env";
import { integrationSchemaReady, isMissingRelation, tableColumns, type Sql } from "@/lib/integration/schema";
import type { IntegrationConfig, KledoSettings, PublicIntegrationConfig } from "@/lib/integration/types";
import { kledoList, kledoRequest } from "@/lib/kledo/client";

export type { IntegrationConfig, KledoSettings, PublicIntegrationConfig };

const TENANT = "dyummy";
const CACHE_MS = 5 * 60 * 1000;

let cache: { at: number; key: string; value: IntegrationConfig | null } | null = null;

export function invalidateConfigCache() {
  cache = null;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseSettings(raw: unknown): KledoSettings {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const shipping = src.shipping_mode === "product" ? "product" : "shipping_cost";
  return {
    sell_account_id: num(src.sell_account_id),
    unit_id: num(src.unit_id),
    tax_id: num(src.tax_id),
    pos_product_category_id: num(src.pos_product_category_id),
    shipping_product_id: num(src.shipping_product_id),
    addl_menu_product_id: num(src.addl_menu_product_id),
    shipping_mode: shipping,
    due_days: Math.min(365, Math.max(0, num(src.due_days) ?? 0)),
    auto_create_contact: src.auto_create_contact !== false,
    auto_create_product: src.auto_create_product !== false,
    invoice_trigger: "delivery_date",
  };
}

function toPublic(config: IntegrationConfig): PublicIntegrationConfig {
  const copy = { ...config, badge: kledoBadge(config.environment) };
  delete (copy as { token?: string }).token;
  return copy;
}

function mapRow(row: any, token: string): IntegrationConfig {
  return {
    id: Number(row.id),
    tenantCode: row.tenant_code,
    environment: row.environment,
    kledoAccount: row.kledo_account,
    name: row.name,
    baseUrl: normalizeKledoBaseUrl(row.base_url),
    token,
    tokenLast4: row.token_last4,
    tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at).toISOString() : null,
    settings: parseSettings(row.settings),
    isActive: Boolean(row.is_active),
    syncEnabled: Boolean(row.sync_enabled),
    goLiveDate: toDateOnly(row.go_live_date),
    lastTestedAt: row.last_tested_at ? new Date(row.last_tested_at).toISOString() : null,
    lastTestOk: row.last_test_ok == null ? null : Boolean(row.last_test_ok),
    lastTestMessage: row.last_test_message,
    keyVersion: Number(row.key_version || 1),
  };
}

async function decryptRow(row: any): Promise<IntegrationConfig> {
  const token = decryptSecret({
    ciphertext: row.token_ciphertext,
    iv: row.token_iv,
    tag: row.token_tag,
    keyVersion: Number(row.key_version || 1),
  });
  return mapRow(row, token);
}

export async function getConfigState(): Promise<{
  schemaReady: boolean;
  encryptionReady: boolean;
  appEnv: AppEnv;
  allowedEnvironments: ConfigEnvironment[];
  guardMessage: string | null;
  config: PublicIntegrationConfig | null;
}> {
  const appEnv = currentAppEnv();
  const base = {
    schemaReady: false,
    encryptionReady: encryptionReady(),
    appEnv,
    allowedEnvironments: allowedConfigEnvironments(appEnv),
    guardMessage: null as string | null,
    config: null as PublicIntegrationConfig | null,
  };
  if (!(await integrationSchemaReady())) return base;
  base.schemaReady = true;
  try {
    const res = await pool.query(
      `SELECT * FROM integration_configs
       WHERE tenant_code = $1 AND provider = 'kledo' AND lini = 'catering'
       ORDER BY is_active DESC, updated_at DESC`,
      [TENANT]
    );
    const allowed = res.rows.filter((row) => configAllowed(row.environment, appEnv));
    const chosen = allowed.find((row) => row.is_active) || allowed[0];
    const rejected = res.rows.find((row) => row.is_active && !configAllowed(row.environment, appEnv));
    if (!chosen && rejected) {
      base.guardMessage = envGuardMessage(rejected.environment, appEnv);
      return base;
    }
    if (!chosen) return base;
    if (!base.encryptionReady) {
      base.guardMessage = "INTEGRATION_ENC_KEY belum diset. Token tidak bisa dibaca.";
      base.config = toPublic(mapRow(chosen, ""));
      return base;
    }
    try {
      base.config = toPublic(await decryptRow(chosen));
    } catch {
      base.guardMessage = "Token tidak bisa dibaca. Periksa INTEGRATION_ENC_KEY environment ini.";
      base.config = toPublic(mapRow(chosen, ""));
    }
    return base;
  } catch (err) {
    if (isMissingRelation(err)) return { ...base, schemaReady: false };
    throw err;
  }
}

export async function getActiveConfig(db: Sql = pool): Promise<IntegrationConfig | null> {
  const appEnv = currentAppEnv();
  const cacheKey = appEnv;
  if (cache && cache.key === cacheKey && Date.now() - cache.at < CACHE_MS) return cache.value;
  if (!(await integrationSchemaReady(db)) || !encryptionReady()) return null;
  const res = await db.query(
    `SELECT * FROM integration_configs
     WHERE tenant_code = $1 AND provider = 'kledo' AND lini = 'catering' AND is_active = true AND sync_enabled = true
     ORDER BY updated_at DESC`,
    [TENANT]
  );
  const row = res.rows.find((item) => configAllowed(item.environment, appEnv));
  if (!row) {
    cache = { at: Date.now(), key: cacheKey, value: null };
    return null;
  }
  try {
    const config = await decryptRow(row);
    cache = { at: Date.now(), key: cacheKey, value: config };
    return config;
  } catch (err) {
    console.error("[kledo] gagal dekripsi token:", err instanceof Error ? err.message : "error");
    cache = { at: Date.now(), key: cacheKey, value: null };
    return null;
  }
}

export async function getEditableConfig(): Promise<IntegrationConfig | null> {
  if (!(await integrationSchemaReady()) || !encryptionReady()) return null;
  const appEnv = currentAppEnv();
  const res = await pool.query(
    `SELECT * FROM integration_configs
     WHERE tenant_code = $1 AND provider = 'kledo' AND lini = 'catering'
     ORDER BY is_active DESC, updated_at DESC`,
    [TENANT]
  );
  const allowed = res.rows.filter((row) => configAllowed(row.environment, appEnv));
  const chosen = allowed.find((row) => row.is_active) || allowed[0];
  if (!chosen) return null;
  return decryptRow(chosen);
}

export async function getConfigById(id: number): Promise<IntegrationConfig | null> {
  if (!(await integrationSchemaReady()) || !encryptionReady()) return null;
  const res = await pool.query(`SELECT * FROM integration_configs WHERE id = $1 AND provider = 'kledo'`, [id]);
  if (!res.rows[0]) return null;
  if (!configAllowed(res.rows[0].environment)) return null;
  return decryptRow(res.rows[0]);
}

export type SaveConfigInput = {
  name: string;
  baseUrl: string;
  environment: ConfigEnvironment;
  token?: string | null;
  tokenExpiresAt?: string | null;
  settings?: unknown;
  isActive?: boolean;
  syncEnabled?: boolean;
  goLiveDate?: string | null;
  userId?: number | null;
};

async function clearCacheForOtherConfigs(db: Sql, configId: number) {
  const orderCols = await tableColumns("orders", db);
  if (orderCols.has("kledo_config_id") && orderCols.has("kledo_sync_status")) {
    await db.query(
      `UPDATE orders SET
        kledo_so_id=NULL, kledo_so_number=NULL, kledo_invoice_id=NULL, kledo_invoice_number=NULL,
        kledo_sync_status='not_synced', kledo_sync_error=NULL, kledo_config_id=NULL, invoiced_at=NULL
       WHERE kledo_config_id IS NOT NULL AND kledo_config_id IS DISTINCT FROM $1`,
      [configId]
    );
  }
  const customerCols = await tableColumns("customers", db);
  if (customerCols.has("kledo_contact_id")) {
    await db.query(
      `UPDATE customers SET kledo_contact_id=NULL
       WHERE kledo_contact_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM integration_mappings m
           WHERE m.config_id=$1 AND m.entity_type='customer' AND m.local_id=customers.id
             AND m.remote_id=customers.kledo_contact_id
         )`,
      [configId]
    );
  }
  const productCols = await tableColumns("products", db);
  if (productCols.has("kledo_product_id")) {
    await db.query(
      `UPDATE products SET kledo_product_id=NULL
       WHERE kledo_product_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM integration_mappings m
           WHERE m.config_id=$1 AND m.entity_type='product' AND m.local_id=products.id
             AND m.remote_id=products.kledo_product_id
         )`,
      [configId]
    );
  }
}

export type SaveConfigResult = {
  config: PublicIntegrationConfig;
  message: string;
  warning: string | null;
};

export async function saveConfig(input: SaveConfigInput): Promise<SaveConfigResult> {
  if (!(await integrationSchemaReady())) {
    throw new Error("Tabel integrasi belum ada. Terapkan refs/kledo_integration.sql di database staging.");
  }
  const appEnv = currentAppEnv();
  if (!configAllowed(input.environment, appEnv)) {
    throw new Error(envGuardMessage(input.environment, appEnv) || "Environment tidak diizinkan");
  }
  const baseUrl = normalizeKledoBaseUrl(input.baseUrl);
  if (!isValidKledoBaseUrl(baseUrl)) {
    throw new Error("Base URL harus https://<subdomain>.api.kledo.id/api/v1");
  }
  const account = kledoAccountFromUrl(baseUrl);
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Nama konfigurasi wajib diisi");
  const settings = parseSettings(input.settings);

  const existing = await pool.query(
    `SELECT * FROM integration_configs
     WHERE tenant_code = $1 AND provider = 'kledo' AND lini = 'catering' AND environment = $2
     ORDER BY is_active DESC, id DESC LIMIT 1`,
    [TENANT, input.environment]
  );
  const row = existing.rows[0];
  const tokenChanged = Boolean(input.token && input.token.trim());
  const urlChanged = row ? normalizeKledoBaseUrl(row.base_url) !== baseUrl : true;
  if (!row && !tokenChanged) throw new Error("Token wajib diisi saat pertama kali menyimpan");
  if (tokenChanged && !encryptionReady()) throw new Error("INTEGRATION_ENC_KEY belum diset");

  let wantsActive = Boolean(input.isActive);
  let wantsSync = Boolean(input.syncEnabled);
  let lastTestOk: boolean | null = row ? row.last_test_ok : null;
  let lastTestMessage: string | null = row?.last_test_message ?? null;
  let testedNow = false;
  let message = "Konfigurasi tersimpan. Token tidak ditampilkan kembali.";
  let warning: string | null = null;
  const credentialsChanged = !row || urlChanged || tokenChanged;

  if (credentialsChanged) {
    const tokenPlain = tokenChanged
      ? input.token!.trim()
      : decryptSecret({
          ciphertext: row!.token_ciphertext,
          iv: row!.token_iv,
          tag: row!.token_tag,
          keyVersion: Number(row!.key_version || 1),
        });
    const probeConfig = draftConfig({
      id: row ? Number(row.id) : 0,
      name,
      environment: input.environment,
      baseUrl,
      account,
      token: tokenPlain,
      settings,
      tokenLast4: tokenPlain.slice(-4),
    });
    const test = await testConnection(probeConfig, { persist: false });
    testedNow = true;
    lastTestMessage = test.message;
    if (!test.ok) {
      const asked = wantsActive || wantsSync;
      wantsActive = false;
      wantsSync = false;
      lastTestOk = false;
      warning = asked
        ? `Koneksi gagal: ${test.message} Config aktif dan Sync aktif tidak dihidupkan.`
        : `Test koneksi gagal: ${test.message}`;
      message = "Konfigurasi tersimpan, tetapi koneksi ke Kledo gagal.";
    } else {
      lastTestOk = true;
      message = `Konfigurasi tersimpan. ${test.message}`;
    }
  } else if ((wantsActive || wantsSync) && lastTestOk !== true) {
    wantsActive = false;
    wantsSync = false;
    warning = "Config aktif dan Sync aktif tidak dihidupkan karena test koneksi terakhir belum berhasil. Jalankan Test koneksi dulu.";
    message = "Konfigurasi tersimpan tanpa mengaktifkan sync.";
  }

  const encrypted = tokenChanged ? encryptSecret(input.token!.trim(), 1) : null;
  const goLive = input.goLiveDate ? toDateOnly(input.goLiveDate) : null;
  const expires = input.tokenExpiresAt ? new Date(input.tokenExpiresAt) : null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let saved;
    if (!row) {
      saved = await client.query(
        `INSERT INTO integration_configs (
          tenant_code, environment, kledo_account, provider, lini, name, base_url,
          token_ciphertext, token_iv, token_tag, token_last4, key_version, token_expires_at,
          settings, is_active, sync_enabled, go_live_date, last_test_ok, last_test_message, last_tested_at, created_by, updated_by
        ) VALUES (
          $1,$2,$3,'kledo','catering',$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,CASE WHEN $18 THEN now() ELSE NULL END,$19,$19
        ) RETURNING *`,
        [
          TENANT, input.environment, account, name, baseUrl,
          encrypted!.ciphertext, encrypted!.iv, encrypted!.tag, encrypted!.last4, encrypted!.keyVersion,
          expires, JSON.stringify(settings), wantsActive, wantsSync, goLive, lastTestOk, lastTestMessage, testedNow, input.userId ?? null,
        ]
      );
    } else {
      saved = await client.query(
        `UPDATE integration_configs SET
          name=$2, base_url=$3, kledo_account=$4, token_expires_at=$5, settings=$6::jsonb,
          is_active=$7, sync_enabled=$8, go_live_date=$9, last_test_ok=$10, updated_by=$11, updated_at=now(),
          last_test_message=CASE WHEN $17 THEN $18 ELSE last_test_message END,
          last_tested_at=CASE WHEN $17 THEN now() ELSE last_tested_at END,
          token_ciphertext=COALESCE($12, token_ciphertext),
          token_iv=COALESCE($13, token_iv),
          token_tag=COALESCE($14, token_tag),
          token_last4=COALESCE($15, token_last4),
          key_version=COALESCE($16, key_version)
        WHERE id=$1 RETURNING *`,
        [
          row.id, name, baseUrl, account, expires, JSON.stringify(settings),
          wantsActive, wantsSync, goLive, lastTestOk, input.userId ?? null,
          encrypted?.ciphertext ?? null, encrypted?.iv ?? null, encrypted?.tag ?? null,
          encrypted?.last4 ?? null, encrypted?.keyVersion ?? null,
          testedNow, lastTestMessage,
        ]
      );
    }
    if (wantsActive) {
      await client.query(
        `UPDATE integration_configs SET is_active=false, sync_enabled=false, updated_at=now()
         WHERE tenant_code=$1 AND provider='kledo' AND lini='catering' AND id <> $2 AND is_active = true`,
        [TENANT, saved.rows[0].id]
      );
      await clearCacheForOtherConfigs(client, Number(saved.rows[0].id));
    }
    await client.query("COMMIT");
    invalidateConfigCache();
    const token = encrypted ? input.token!.trim() : decryptSecret({
      ciphertext: saved.rows[0].token_ciphertext,
      iv: saved.rows[0].token_iv,
      tag: saved.rows[0].token_tag,
      keyVersion: Number(saved.rows[0].key_version || 1),
    });
    return { config: toPublic(mapRow(saved.rows[0], token)), message, warning };
  } catch (err) {
    await client.query("ROLLBACK");
    const code = (err as { code?: string })?.code;
    if (code === "23505") {
      throw new Error("Akun Kledo (subdomain) ini sudah dipakai konfigurasi lain.");
    }
    throw err;
  } finally {
    client.release();
  }
}

async function probe(config: IntegrationConfig, path: string): Promise<string | null> {
  try {
    await kledoRequest(config, { method: "GET", path });
    return null;
  } catch (err) {
    const status = err instanceof Error && "status" in err ? (err as { status: number }).status : 0;
    if (status === 404) return `${path} tidak ditemukan di akun ini`;
    return err instanceof Error ? err.message : "Gagal memeriksa data referensi";
  }
}

function draftConfig(input: {
  id: number;
  name: string;
  environment: ConfigEnvironment;
  baseUrl: string;
  account: string | null;
  token: string;
  settings: KledoSettings;
  tokenLast4: string;
}): IntegrationConfig {
  return {
    id: input.id,
    tenantCode: TENANT,
    environment: input.environment,
    kledoAccount: input.account,
    name: input.name,
    baseUrl: input.baseUrl,
    token: input.token,
    tokenLast4: input.tokenLast4,
    tokenExpiresAt: null,
    settings: input.settings,
    isActive: false,
    syncEnabled: false,
    goLiveDate: null,
    lastTestedAt: null,
    lastTestOk: null,
    lastTestMessage: null,
    keyVersion: 1,
  };
}

export async function testConnection(config: IntegrationConfig, opts?: { persist?: boolean }): Promise<{
  ok: boolean;
  message: string;
  ratelimitLimit: number | null;
  ratelimitRemaining: number | null;
}> {
  const persist = Boolean(opts?.persist && config.id);
  if (!isValidKledoBaseUrl(config.baseUrl)) {
    const message = "Base URL tidak valid. Gunakan https://<subdomain>.api.kledo.id/api/v1";
    if (persist) await storeTest(config.id, false, message);
    return { ok: false, message, ratelimitLimit: null, ratelimitRemaining: null };
  }
  try {
    const ping = await kledoRequest(config, { method: "GET", path: "/finance/contacts?per_page=1" });
    const problems: string[] = [];
    const settings = config.settings;
    if (settings.sell_account_id) {
      const issue = await probe(config, `/finance/accounts/${settings.sell_account_id}`);
      if (issue) problems.push(`Akun penjualan ${settings.sell_account_id}: ${issue}`);
    }
    if (settings.unit_id) {
      const units = await kledoRequest(config, { method: "GET", path: "/finance/units?per_page=100" });
      const found = kledoList(units.data).some((unit) => Number(unit.id) === Number(settings.unit_id));
      if (!found) problems.push(`Unit ${settings.unit_id} tidak ada di akun ini`);
    }
    if (settings.tax_id) {
      const issue = await probe(config, `/finance/taxes/${settings.tax_id}`);
      if (issue) problems.push(`Pajak ${settings.tax_id}: ${issue}`);
    }
    if (settings.pos_product_category_id) {
      const cats = await kledoRequest(config, { method: "GET", path: "/finance/productCategories?per_page=100" }).catch(() => null);
      if (cats) {
        const found = kledoList(cats.data).some((cat) => Number(cat.id) === Number(settings.pos_product_category_id));
        if (!found) problems.push(`Kategori produk ${settings.pos_product_category_id} tidak ada`);
      }
    }
    for (const [label, id] of [
      ["Produk ongkir", settings.shipping_product_id],
      ["Produk menu tambahan", settings.addl_menu_product_id],
    ] as const) {
      if (!id) continue;
      const issue = await probe(config, `/finance/products/${id}`);
      if (issue) problems.push(`${label} ${id}: ${issue}`);
    }
    if (problems.length) {
      const message = problems.join("; ");
      if (persist) await storeTest(config.id, false, message);
      return { ok: false, message, ratelimitLimit: ping.ratelimitLimit, ratelimitRemaining: ping.ratelimitRemaining };
    }
    const quota = ping.ratelimitRemaining != null ? ` Sisa kuota ${ping.ratelimitRemaining}${ping.ratelimitLimit != null ? `/${ping.ratelimitLimit}` : ""}.` : "";
    const message = `Koneksi berhasil.${quota}`;
    if (persist) await storeTest(config.id, true, message);
    return { ok: true, message, ratelimitLimit: ping.ratelimitLimit, ratelimitRemaining: ping.ratelimitRemaining };
  } catch (err) {
    const status = err instanceof Error && "status" in err ? (err as { status: number }).status : 0;
    const message = status === 401
      ? "Token salah atau kedaluwarsa (401)."
      : err instanceof Error ? err.message : "Test koneksi gagal";
    if (persist) await storeTest(config.id, false, message);
    return { ok: false, message, ratelimitLimit: null, ratelimitRemaining: null };
  }
}

async function storeTest(configId: number, ok: boolean, message: string) {
  await pool.query(
    `UPDATE integration_configs
     SET last_tested_at=now(), last_test_ok=$2, last_test_message=$3, updated_at=now(),
         is_active=CASE WHEN $2 THEN is_active ELSE false END,
         sync_enabled=CASE WHEN $2 THEN sync_enabled ELSE false END
     WHERE id=$1`,
    [configId, ok, message.slice(0, 500)]
  );
  invalidateConfigCache();
}

export async function markConfigUnauthorized(configId: number, message: string) {
  await pool.query(
    `UPDATE integration_configs
     SET sync_enabled=false, last_test_ok=false, last_test_message=$2, last_tested_at=now(), updated_at=now()
     WHERE id=$1`,
    [configId, message.slice(0, 500)]
  );
  invalidateConfigCache();
}

export function deliveryInScope(config: IntegrationConfig, deliveryDate: string, force = false): boolean {
  if (!config.isActive || !config.syncEnabled) return false;
  if (force) return true;
  if (!config.goLiveDate) return false;
  return deliveryDate >= config.goLiveDate;
}
