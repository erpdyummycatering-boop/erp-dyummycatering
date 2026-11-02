import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getEditableConfig } from "@/lib/integration/config";
import { jakartaToday, toDateOnly } from "@/lib/integration/dates";
import { requireKledoAdmin } from "@/lib/integration/http";
import { KledoError, kledoLastPage, kledoList, kledoRequest } from "@/lib/kledo/client";
import type { IntegrationConfig } from "@/lib/integration/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Tab = "sales_order" | "invoice" | "contact" | "product";

const PATHS: Record<Tab, string> = {
  sales_order: "/finance/orders",
  invoice: "/finance/invoices",
  contact: "/finance/contacts",
  product: "/finance/products",
};

const KLEDO_URL: Record<Tab, (id: number) => string> = {
  sales_order: (id) => `https://app.kledo.com/#/sales/orders/detail/${id}`,
  invoice: (id) => `https://app.kledo.com/#/sales/invoices/detail/${id}`,
  contact: (id) => `https://app.kledo.com/#/contacts/detail/${id}`,
  product: (id) => `https://app.kledo.com/#/products/detail/${id}`,
};

const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 60_000;

function money(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function erpOrderNo(memo: unknown, localRef?: string | null): string | null {
  const fromMemo = String(memo || "").match(/ERP#(ORD-\d+)/);
  if (fromMemo) return fromMemo[1];
  if (localRef && /^ORD-\d+/.test(localRef)) return localRef.match(/ORD-\d+/)?.[0] || null;
  return null;
}

function orderIdFromNo(orderNo: string | null): number | null {
  const match = String(orderNo || "").match(/ORD-(\d+)/);
  return match ? Number(match[1]) : null;
}

function invoiceState(row: any, today: string) {
  const due = money(row.due ?? row.amount_after_tax);
  const amount = money(row.amount_after_tax ?? row.amount);
  const dueDate = toDateOnly(row.due_date);
  const paid = Math.max(0, amount - due);
  const overdue = due > 0 && !!dueDate && dueDate < today;
  let status = "Belum lunas";
  if (due <= 0) status = "Lunas";
  else if (overdue) status = "Jatuh tempo";
  return { due, amount, paid, dueDate, overdue, status };
}

function matchesStatus(tab: Tab, row: any, status: string, today: string): boolean {
  if (!status || status === "all") return true;
  if (tab === "invoice") {
    const state = invoiceState(row, today);
    if (status === "paid") return state.due <= 0;
    if (status === "unpaid") return state.due > 0;
    if (status === "overdue") return state.overdue;
  }
  if (tab === "sales_order") {
    const id = Number(row.status_id);
    if (status === "open") return id === 5;
    if (status === "invoiced") return id === 7;
  }
  return true;
}

async function kledoPage(config: IntegrationConfig, path: string, query: URLSearchParams) {
  const result = await kledoRequest(config, { method: "GET", path: `${path}?${query.toString()}` });
  return {
    rows: kledoList(result.data),
    total: Number(result.data?.total ?? result.data?.meta?.total ?? 0) || 0,
    lastPage: kledoLastPage(result.data),
    remaining: result.ratelimitRemaining,
  };
}

async function invoiceSummary(config: IntegrationConfig, dateFrom: string, dateTo: string, today: string) {
  const key = `summary:${config.id}:${dateFrom}:${dateTo}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.body as Record<string, number | boolean>;
  let total = 0;
  let paid = 0;
  let unpaid = 0;
  let overdue = 0;
  let count = 0;
  let capped = false;
  let page = 1;
  let last = 1;
  while (page <= last && page <= 5) {
    const query = new URLSearchParams({ per_page: "100", page: String(page) });
    if (dateFrom) query.set("date_from", dateFrom);
    if (dateTo) query.set("date_to", dateTo);
    const batch = await kledoPage(config, PATHS.invoice, query);
    if (batch.lastPage) last = Math.min(batch.lastPage, 5);
    if (!batch.lastPage && batch.rows.length >= 100) last = page + 1;
    for (const row of batch.rows) {
      const state = invoiceState(row, today);
      count += 1;
      total += state.amount;
      paid += state.paid;
      unpaid += state.due;
      if (state.overdue) overdue += state.due;
    }
    if (!batch.rows.length || (!batch.lastPage && batch.rows.length < 100)) break;
    page += 1;
  }
  if (last > 5) capped = true;
  const body = { count, total, paid, unpaid, overdue, capped };
  cache.set(key, { at: Date.now(), body });
  return body;
}

async function erpLinks(configId: number, tab: Tab, rows: any[]) {
  const ids = rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
  const map = new Map<number, { localId: number; localRef: string | null }>();
  if (!ids.length) return map;
  const entity = tab === "invoice" ? "invoice" : tab === "sales_order" ? "sales_order" : tab === "contact" ? "customer" : "product";
  if (entity === "customer" || entity === "product") return map;
  const res = await pool.query(
    `SELECT remote_id, local_id, local_ref FROM integration_mappings
     WHERE config_id = $1 AND entity_type = $2 AND remote_id = ANY($3::bigint[])`,
    [configId, entity, ids]
  );
  for (const row of res.rows) {
    map.set(Number(row.remote_id), { localId: Number(row.local_id), localRef: row.local_ref });
  }
  return map;
}

export async function GET(req: NextRequest) {
  const admin = await requireKledoAdmin();
  if (!admin.ok) return admin.response;
  const config = await getEditableConfig();
  if (!config || !config.isActive) {
    return NextResponse.json({
      ok: false,
      error: "Konfigurasi Kledo belum aktif. Buka Pengaturan Kledo, jalankan Test koneksi, lalu nyalakan Config aktif.",
    });
  }

  const params = req.nextUrl.searchParams;
  const tab = (params.get("tab") || "invoice") as Tab;
  if (!PATHS[tab]) return NextResponse.json({ ok: false, error: "Tab tidak dikenal" }, { status: 400 });
  const page = Math.max(1, Number(params.get("page") || 1));
  const perPage = Math.min(50, Math.max(5, Number(params.get("per_page") || 20)));
  const search = (params.get("search") || "").trim();
  const dateFrom = toDateOnly(params.get("date_from")) || "";
  const dateTo = toDateOnly(params.get("date_to")) || "";
  const status = params.get("status") || "all";
  const today = jakartaToday();
  const cacheKey = [config.id, tab, page, perPage, search, dateFrom, dateTo, status].join("|");
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < TTL) {
    return NextResponse.json({ ...(cached.body as object), cached: true });
  }

  try {
    const query = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (search) query.set("search", search);
    if (tab === "sales_order" || tab === "invoice") {
      if (dateFrom) query.set("date_from", dateFrom);
      if (dateTo) query.set("date_to", dateTo);
    }
    const listed = await kledoPage(config, PATHS[tab], query);
    const links = await erpLinks(config.id, tab, listed.rows).catch(() => new Map<number, { localId: number; localRef: string | null }>());
    const rows = listed.rows.filter((row) => matchesStatus(tab, row, status, today)).map((row) => {
      const link = links.get(Number(row.id));
      const orderNo = erpOrderNo(row.memo, link?.localRef);
      const erpOrderId = link?.localId || orderIdFromNo(orderNo);
      const state = tab === "invoice" ? invoiceState(row, today) : null;
      return {
        id: Number(row.id),
        refNumber: row.ref_number || row.code || null,
        name: row.name || row.contact?.name || null,
        transDate: toDateOnly(row.trans_date),
        dueDate: state?.dueDate || toDateOnly(row.due_date),
        amount: state ? state.amount : money(row.price ?? row.amount_after_tax),
        due: state?.due ?? null,
        paid: state?.paid ?? null,
        status: state?.status || (tab === "sales_order" ? (Number(row.status_id) === 7 ? "Ditagih" : Number(row.status_id) === 5 ? "Terbuka" : String(row.status_id || "")) : row.status || null),
        memo: row.memo || null,
        phone: row.phone || null,
        code: row.code || row.ref_code || null,
        erpOrderNo: orderNo,
        erpOrderId,
        kledoUrl: KLEDO_URL[tab](Number(row.id)),
      };
    });
    const total = listed.total || listed.rows.length;
    const summary = await invoiceSummary(config, dateFrom, dateTo, today).catch(() => null);
    const body = {
      ok: true,
      tab,
      page,
      perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      rows,
      summary,
      ratelimitRemaining: listed.remaining,
      cached: false,
    };
    cache.set(cacheKey, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (err) {
    const stale = cached?.body as { ok?: boolean } | undefined;
    if (err instanceof KledoError && err.status === 429 && stale) {
      return NextResponse.json({ ...stale, cached: true, warning: "Kledo membatasi permintaan. Menampilkan data cache sekitar 1 menit." });
    }
    const message = err instanceof KledoError && err.status === 429
      ? "Kledo membatasi permintaan. Tunggu sebentar lalu muat ulang."
      : err instanceof Error ? err.message : "Gagal membaca data Kledo";
    return NextResponse.json({ ok: false, error: message }, { status: err instanceof KledoError && err.status === 429 ? 429 : 502 });
  }
}
