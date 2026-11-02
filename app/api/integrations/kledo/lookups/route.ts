import { NextResponse } from "next/server";
import { getEditableConfig, parseSettings } from "@/lib/integration/config";
import { isValidKledoBaseUrl, kledoAccountFromUrl, normalizeKledoBaseUrl, type ConfigEnvironment } from "@/lib/integration/env";
import { requireKledoAdmin } from "@/lib/integration/http";
import { kledoListAll } from "@/lib/kledo/client";
import type { IntegrationConfig, KledoSettings } from "@/lib/integration/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RESOURCES: Record<string, string> = {
  accounts: "/finance/accounts",
  units: "/finance/units",
  taxes: "/finance/taxes",
  products: "/finance/products",
  categories: "/finance/productCategories",
};

function mapRow(row: { id?: unknown; name?: string; ref_code?: string; code?: string }) {
  return {
    id: Number(row.id),
    name: row.name || row.ref_code || row.code || String(row.id),
    code: row.ref_code || row.code || null,
  };
}

async function configFromBody(body: {
  base_url?: string;
  token?: string;
  settings?: unknown;
  environment?: string;
  name?: string;
}): Promise<IntegrationConfig | null> {
  const saved = await getEditableConfig();
  const baseUrl = normalizeKledoBaseUrl(String(body.base_url || saved?.baseUrl || ""));
  const typedToken = String(body.token || "").trim();
  const token = typedToken || (saved && saved.baseUrl === baseUrl ? saved.token : "");
  if (!baseUrl || !token || !isValidKledoBaseUrl(baseUrl)) return saved && !body.base_url ? saved : null;
  if (saved && saved.baseUrl === baseUrl && !typedToken) return { ...saved, settings: body.settings ? parseSettings(body.settings) : saved.settings };
  const settings: KledoSettings = body.settings ? parseSettings(body.settings) : (saved?.settings || {});
  return {
    id: 0,
    tenantCode: "dyummy",
    environment: (body.environment || saved?.environment || "demo") as ConfigEnvironment,
    kledoAccount: kledoAccountFromUrl(baseUrl),
    name: String(body.name || saved?.name || "Kledo"),
    baseUrl,
    token,
    tokenLast4: token.slice(-4),
    tokenExpiresAt: null,
    settings,
    isActive: false,
    syncEnabled: false,
    goLiveDate: null,
    lastTestedAt: null,
    lastTestOk: null,
    lastTestMessage: null,
    keyVersion: 1,
  };
}

export async function GET(req: Request) {
  const admin = await requireKledoAdmin();
  if (!admin.ok) return admin.response;
  const url = new URL(req.url);
  return respond(await getEditableConfig(), url.searchParams.get("resource") || "accounts", url.searchParams.get("search") || "");
}

export async function POST(req: Request) {
  const admin = await requireKledoAdmin();
  if (!admin.ok) return admin.response;
  const body = await req.json().catch(() => ({}));
  const config = await configFromBody(body);
  return respond(config, String(body.resource || "accounts"), String(body.search || ""));
}

async function respond(config: IntegrationConfig | null, resource: string, search: string) {
  if (!config) {
    return NextResponse.json({ error: "Isi Base URL dan token pada form, atau simpan konfigurasi terlebih dahulu.", data: [] }, { status: 400 });
  }
  const path = RESOURCES[resource];
  if (!path) return NextResponse.json({ error: "Resource tidak dikenal", data: [] }, { status: 400 });
  try {
    const rows = await kledoListAll(config, path, search);
    return NextResponse.json({ data: rows.map(mapRow), pagesLoaded: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengambil data Kledo";
    return NextResponse.json({ error: message, data: [] }, { status: 400 });
  }
}
