import { NextResponse } from "next/server";
import { getEditableConfig, parseSettings, testConnection } from "@/lib/integration/config";
import { isValidKledoBaseUrl, kledoAccountFromUrl, normalizeKledoBaseUrl, type ConfigEnvironment } from "@/lib/integration/env";
import { requireKledoAdmin } from "@/lib/integration/http";
import type { IntegrationConfig } from "@/lib/integration/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const admin = await requireKledoAdmin();
  if (!admin.ok) return admin.response;
  const body = await req.json().catch(() => ({}));
  const saved = await getEditableConfig();
  const baseUrl = normalizeKledoBaseUrl(String(body.base_url || saved?.baseUrl || ""));
  const typedToken = String(body.token || "").trim();
  const sameSavedAccount = Boolean(saved && saved.baseUrl === baseUrl && !typedToken);
  const token = typedToken || (sameSavedAccount ? saved!.token : "");
  if (!baseUrl || !token) {
    return NextResponse.json({ error: "Isi Base URL dan token pada form sebelum test. Token tersimpan hanya dipakai jika Base URL-nya sama." }, { status: 400 });
  }
  if (!isValidKledoBaseUrl(baseUrl)) {
    return NextResponse.json({ ok: false, message: "Base URL harus https://<subdomain>.api.kledo.id/api/v1" }, { status: 400 });
  }
  const settings = body.settings ? parseSettings(body.settings) : (saved?.settings || {});
  const environment = (body.environment || saved?.environment || "demo") as ConfigEnvironment;
  const config: IntegrationConfig = {
    id: sameSavedAccount ? saved!.id : 0,
    tenantCode: "dyummy",
    environment,
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
  const result = await testConnection(config, { persist: sameSavedAccount });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
