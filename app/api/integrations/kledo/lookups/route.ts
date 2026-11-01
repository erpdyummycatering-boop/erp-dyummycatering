import { NextResponse } from "next/server";
import { getEditableConfig } from "@/lib/integration/config";
import { requireKledoAdmin } from "@/lib/integration/http";
import { kledoList, kledoRequest } from "@/lib/kledo/client";

export const dynamic = "force-dynamic";

const RESOURCES: Record<string, string> = {
  accounts: "/finance/accounts",
  units: "/finance/units",
  taxes: "/finance/taxes",
  products: "/finance/products",
  categories: "/finance/productCategories",
};

export async function GET(req: Request) {
  const admin = await requireKledoAdmin();
  if (!admin.ok) return admin.response;
  const config = await getEditableConfig();
  if (!config) return NextResponse.json({ error: "Konfigurasi Kledo belum disimpan." }, { status: 400 });
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource") || "accounts";
  const search = url.searchParams.get("search") || "";
  const path = RESOURCES[resource];
  if (!path) return NextResponse.json({ error: "Resource tidak dikenal" }, { status: 400 });
  const query = new URLSearchParams({ per_page: "50" });
  if (search) query.set("search", search);
  try {
    const result = await kledoRequest(config, { method: "GET", path: `${path}?${query.toString()}` });
    const data = kledoList(result.data).map((row) => ({
      id: Number(row.id),
      name: row.name || row.ref_code || row.code || String(row.id),
      code: row.ref_code || row.code || null,
    }));
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengambil data Kledo";
    return NextResponse.json({ error: message, data: [] }, { status: 400 });
  }
}
