import { NextResponse } from "next/server";
import { getEditableConfig, testConnection } from "@/lib/integration/config";
import { requireKledoAdmin } from "@/lib/integration/http";

export const dynamic = "force-dynamic";

export async function POST() {
  const admin = await requireKledoAdmin();
  if (!admin.ok) return admin.response;
  const config = await getEditableConfig();
  if (!config) {
    return NextResponse.json({ error: "Simpan Base URL dan token terlebih dahulu." }, { status: 400 });
  }
  const result = await testConnection(config);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
