import { NextRequest, NextResponse } from "next/server";
import { getConfigState, saveConfig } from "@/lib/integration/config";
import { requireKledoAdmin } from "@/lib/integration/http";
import type { ConfigEnvironment } from "@/lib/integration/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireKledoAdmin();
  if (!admin.ok) return admin.response;
  const state = await getConfigState();
  return NextResponse.json(state);
}

export async function PUT(req: NextRequest) {
  const admin = await requireKledoAdmin();
  if (!admin.ok) return admin.response;
  try {
    const body = await req.json();
    const config = await saveConfig({
      name: body.name,
      baseUrl: body.base_url,
      environment: body.environment as ConfigEnvironment,
      token: body.token,
      tokenExpiresAt: body.token_expires_at,
      settings: body.settings,
      isActive: body.is_active,
      syncEnabled: body.sync_enabled,
      goLiveDate: body.go_live_date,
      userId: admin.userId,
    });
    return NextResponse.json({ config });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan konfigurasi";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
