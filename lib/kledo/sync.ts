import { normalizePhoneNumber, isSamePhoneNumber } from "@/lib/phoneUtils";
import { jakartaToday, toDateOnly } from "@/lib/integration/dates";
import { deliveryInScope } from "@/lib/integration/config";
import { tableColumns, type Sql } from "@/lib/integration/schema";
import type { IntegrationConfig } from "@/lib/integration/types";
import { KledoError, kledoList, kledoRequest } from "@/lib/kledo/client";
import {
  customerToContact,
  erpMemo,
  orderSyncHash,
  orderToInvoice,
  orderToSalesOrder,
  productCode,
  productToKledo,
  validateOrderForSync,
  type BlockCode,
  type OrderSnapshot,
} from "@/lib/kledo/mappers";
import { formatOrderNo } from "@/lib/utils";

export class BlockedJob extends Error {
  reason: BlockCode | string;
  constructor(reason: string, message: string) {
    super(message);
    this.name = "BlockedJob";
    this.reason = reason;
  }
}

export class DeferJob extends Error {
  seconds: number;
  constructor(seconds: number, message = "Menunggu dependensi") {
    super(message);
    this.name = "DeferJob";
    this.seconds = seconds;
  }
}

export type FollowUp = {
  entityType: string;
  localId: number;
  action: string;
  idempotencyKey: string;
  priority?: number;
  triggeredBy?: string;
};

export type JobRow = {
  id: number;
  config_id: number;
  entity_type: string;
  local_id: number;
  action: string;
  idempotency_key: string;
  attempts: number;
  max_attempts: number;
  triggered_by: string | null;
};

type Ctx = { job: JobRow; config: IntegrationConfig; qstashMessageId: string | null };

const BLOCK_TEXT: Record<string, string> = {
  NO_PHONE: "Customer tidak punya nomor HP yang valid (10–14 digit).",
  NO_PRODUCT_CODE: "Item order tidak lengkap.",
  ZERO_TOTAL: "Nilai order 0, tidak dikirim ke Kledo.",
  BAD_DATE: "Tanggal order atau tanggal kirim tidak masuk akal.",
  NO_CONTACT: "Kontak belum ada di Kledo dan pembuatan otomatis dimatikan.",
  MISSING_DEFAULTS: "Lengkapi akun penjualan, satuan, kategori, atau produk ongkir/menu tambahan di pengaturan Kledo.",
  NOT_CATERING: "Bukan order catering.",
};

export async function executeSyncJob(db: Sql, job: JobRow, config: IntegrationConfig, qstashMessageId: string | null): Promise<FollowUp[]> {
  const ctx: Ctx = { job, config, qstashMessageId };
  const order = await loadOrder(db, Number(job.local_id));
  if (!order) throw new BlockedJob("BAD_DATE", "Order tidak ditemukan");
  if (order.lini !== "catering") throw new BlockedJob("NOT_CATERING", BLOCK_TEXT.NOT_CATERING);

  const cancelled = order.status_order === "Batal" || order.status_order === "Dibatalkan";
  if (job.entity_type === "invoice" && job.action === "void") return voidInvoice(db, ctx, order);
  if (job.entity_type === "invoice" && job.action === "update") return updateInvoice(db, ctx, order);
  if (job.entity_type === "invoice" || job.action === "create_invoice") {
    if (cancelled) return [];
    return createInvoice(db, ctx, order);
  }
  if (job.action === "void" || job.action === "delete" || cancelled) return voidSalesOrder(db, ctx, order);
  if (job.action === "update") return updateSalesOrder(db, ctx, order);
  return createSalesOrder(db, ctx, order);
}

async function loadOrder(db: Sql, orderId: number): Promise<OrderSnapshot | null> {
  const cols = await tableColumns("orders", db);
  const orderNoSql = cols.has("order_no") ? "o.order_no" : "NULL::text AS order_no";
  const invoiceSql = cols.has("kledo_invoice_id") ? "o.kledo_invoice_id" : "NULL::bigint AS kledo_invoice_id";
  const res = await db.query(
    `SELECT o.id, o.customer_id, o.order_date, o.delivery_date, o.venue, o.order_notes,
            o.recipient_name, o.recipient_phone, o.departure_time, o.arrival_time,
            o.shipping_fee, o.additional_menu_price, o.grand_total, o.status_order, o.lini,
            ${orderNoSql}, ${invoiceSql},
            c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
     FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`,
    [orderId]
  );
  if (!res.rows[0]) return null;
  const row = res.rows[0];
  const productCols = await tableColumns("products", db);
  const kledoProductSql = productCols.has("kledo_product_id") ? "p.kledo_product_id" : "NULL::bigint AS kledo_product_id";
  const items = await db.query(
    `SELECT oi.product_id, oi.price, oi.quantity, oi.discount, oi.custom_menu, oi.notes,
            p.name AS product_name, p.sku, ${kledoProductSql}
     FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1 ORDER BY oi.id`,
    [orderId]
  );
  return {
    id: Number(row.id),
    order_no: row.order_no || formatOrderNo(row.id),
    customer_id: Number(row.customer_id),
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_address: row.customer_address,
    order_date: toDateOnly(row.order_date) || "",
    delivery_date: toDateOnly(row.delivery_date) || "",
    venue: row.venue,
    order_notes: row.order_notes,
    recipient_name: row.recipient_name,
    recipient_phone: row.recipient_phone,
    departure_time: row.departure_time,
    arrival_time: row.arrival_time,
    shipping_fee: Number(row.shipping_fee || 0),
    additional_menu_price: Number(row.additional_menu_price || 0),
    grand_total: Number(row.grand_total || 0),
    status_order: row.status_order || "Baru",
    lini: row.lini || "catering",
    items: items.rows.map((item) => ({
      product_id: Number(item.product_id),
      product_name: item.product_name || "",
      sku: item.sku,
      kledo_product_id: item.kledo_product_id ? Number(item.kledo_product_id) : null,
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 0),
      discount: Number(item.discount || 0),
      custom_menu: item.custom_menu,
      notes: item.notes,
    })),
  };
}

async function readInvoiceId(db: Sql, orderId: number): Promise<number | null> {
  const cols = await tableColumns("orders", db);
  if (!cols.has("kledo_invoice_id")) return null;
  const res = await db.query(`SELECT kledo_invoice_id FROM orders WHERE id=$1`, [orderId]);
  return res.rows[0]?.kledo_invoice_id ? Number(res.rows[0].kledo_invoice_id) : null;
}

async function getMapping(db: Sql, configId: number, entityType: string, localId: number) {
  const res = await db.query(
    `SELECT remote_id, remote_ref, payload_hash FROM integration_mappings
     WHERE config_id=$1 AND entity_type=$2 AND local_id=$3`,
    [configId, entityType, localId]
  );
  if (!res.rows[0]) return null;
  return {
    remoteId: Number(res.rows[0].remote_id),
    remoteRef: res.rows[0].remote_ref as string | null,
    hash: res.rows[0].payload_hash as string | null,
  };
}

async function saveMapping(db: Sql, configId: number, entityType: string, localId: number, localRef: string, remoteId: number, remoteRef: string | null, hash: string | null, remoteStatus: string | null) {
  await db.query(
    `INSERT INTO integration_mappings
      (config_id, entity_type, local_id, local_ref, remote_id, remote_ref, payload_hash, remote_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT ON CONSTRAINT uq_map_local DO UPDATE SET
       remote_id=EXCLUDED.remote_id, remote_ref=EXCLUDED.remote_ref, local_ref=EXCLUDED.local_ref,
       payload_hash=EXCLUDED.payload_hash, remote_status=EXCLUDED.remote_status,
       last_synced_at=now(), updated_at=now()`,
    [configId, entityType, localId, localRef, remoteId, remoteRef, hash, remoteStatus]
  );
}

async function patchOrder(db: Sql, orderId: number, patch: Record<string, unknown>) {
  const cols = await tableColumns("orders", db);
  const allowed = [
    "kledo_config_id", "kledo_so_id", "kledo_so_number", "kledo_invoice_id", "kledo_invoice_number",
    "kledo_sync_status", "kledo_last_synced_at", "kledo_sync_error", "invoiced_at",
  ];
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const key of allowed) {
    if (!(key in patch) || !cols.has(key)) continue;
    vals.push(patch[key]);
    sets.push(`${key} = $${vals.length}`);
  }
  if (!sets.length) return;
  vals.push(orderId);
  await db.query(`UPDATE orders SET ${sets.join(", ")} WHERE id = $${vals.length}`, vals);
}

function call(ctx: Ctx, method: string, path: string, body?: unknown) {
  return kledoRequest(ctx.config, { method, path, body, jobId: ctx.job.id, qstashMessageId: ctx.qstashMessageId });
}

async function searchRows(ctx: Ctx, path: string): Promise<any[]> {
  try {
    const res = await call(ctx, "GET", path);
    return kledoList(res.data);
  } catch (err) {
    if (err instanceof KledoError && err.status === 404) return [];
    throw err;
  }
}

async function findByMemo(ctx: Ctx, kind: "orders" | "invoices", memo: string) {
  const rows = await searchRows(ctx, `/finance/${kind}?search=${encodeURIComponent(memo)}&per_page=10`);
  return rows.find((row) => String(row.memo || "").includes(memo)) || null;
}

async function ensureContact(db: Sql, ctx: Ctx, order: OrderSnapshot): Promise<number> {
  const existing = await getMapping(db, ctx.config.id, "customer", order.customer_id);
  if (existing) return existing.remoteId;
  const phone = normalizePhoneNumber(order.customer_phone);
  const rows = await searchRows(ctx, `/finance/contacts?search=${encodeURIComponent(phone)}&per_page=5`);
  const match = rows.find((row) =>
    isSamePhoneNumber(row.phone, phone) || String(row.ref_number || "") === `CUST-${order.customer_id}`
  );
  let remoteId = match ? Number(match.id) : 0;
  let remoteRef = match?.ref_number || null;
  if (!remoteId) {
    if (ctx.config.settings.auto_create_contact === false) {
      throw new BlockedJob("NO_CONTACT", BLOCK_TEXT.NO_CONTACT);
    }
    const created = await call(ctx, "POST", "/finance/contacts", customerToContact(order, phone));
    remoteId = Number(created.data?.id);
    remoteRef = created.data?.ref_number || `CUST-${order.customer_id}`;
  }
  await saveMapping(db, ctx.config.id, "customer", order.customer_id, phone, remoteId, remoteRef, null, null);
  const cols = await tableColumns("customers", db);
  if (cols.has("kledo_contact_id")) {
    await db.query(`UPDATE customers SET kledo_contact_id=$2 WHERE id=$1`, [order.customer_id, remoteId]);
  }
  return remoteId;
}

async function ensureProduct(db: Sql, ctx: Ctx, item: OrderSnapshot["items"][number]): Promise<number> {
  const mapped = await getMapping(db, ctx.config.id, "product", item.product_id);
  if (mapped) {
    item.kledo_product_id = mapped.remoteId;
    return mapped.remoteId;
  }
  const code = productCode(item);
  const rows = await searchRows(ctx, `/finance/products?search=${encodeURIComponent(code)}&per_page=5`);
  const match = rows.find((row) => String(row.code || "") === code);
  let remoteId = match ? Number(match.id) : 0;
  let remoteRef = match?.code || code;
  if (!remoteId) {
    if (ctx.config.settings.auto_create_product === false) {
      throw new BlockedJob("NO_PRODUCT_CODE", `Produk ${code} belum ada di Kledo dan pembuatan otomatis dimatikan.`);
    }
    const productBody = productToKledo(item, ctx.config.settings);
    if ("error" in productBody) throw new BlockedJob(productBody.error, BLOCK_TEXT.MISSING_DEFAULTS);
    const created = await call(ctx, "POST", "/finance/products", productBody.body);
    remoteId = Number(created.data?.id);
    remoteRef = created.data?.code || code;
  }
  await saveMapping(db, ctx.config.id, "product", item.product_id, code, remoteId, remoteRef, null, null);
  item.kledo_product_id = remoteId;
  const cols = await tableColumns("products", db);
  if (cols.has("kledo_product_id")) {
    await db.query(`UPDATE products SET kledo_product_id=$2 WHERE id=$1`, [item.product_id, remoteId]);
  }
  return remoteId;
}

function assertReady(order: OrderSnapshot) {
  const code = validateOrderForSync(order);
  if (code) throw new BlockedJob(code, BLOCK_TEXT[code] || code);
}

function totalWarning(order: OrderSnapshot, remoteTotal: unknown): string | null {
  const remote = Number(remoteTotal);
  if (!Number.isFinite(remote)) return null;
  if (Math.abs(remote - Number(order.grand_total)) > 1) {
    return `Total Kledo ${remote} berbeda dari total ERP ${order.grand_total}.`;
  }
  return null;
}

async function rememberSalesOrder(db: Sql, ctx: Ctx, order: OrderSnapshot, remoteId: number, remoteRef: string | null, status: string | null, warning: string | null) {
  const hash = orderSyncHash(order);
  await saveMapping(db, ctx.config.id, "sales_order", order.id, order.order_no, remoteId, remoteRef, hash, status);
  await patchOrder(db, order.id, {
    kledo_config_id: ctx.config.id,
    kledo_so_id: remoteId,
    kledo_so_number: remoteRef,
    kledo_sync_status: "so_synced",
    kledo_last_synced_at: new Date().toISOString(),
    kledo_sync_error: warning,
  });
}

function invoiceFollowUp(ctx: Ctx, order: OrderSnapshot, invoiceAlready: number | null): FollowUp[] {
  if (invoiceAlready) return [];
  if (order.status_order === "Batal" || order.status_order === "Dibatalkan") return [];
  if (order.delivery_date > jakartaToday()) return [];
  if (!deliveryInScope(ctx.config, order.delivery_date)) return [];
  return [{
    entityType: "invoice",
    localId: order.id,
    action: "create_invoice",
    idempotencyKey: `kledo:${ctx.config.id}:inv:create:${order.id}`,
    priority: 6,
    triggeredBy: "order_create",
  }];
}

async function createSalesOrder(db: Sql, ctx: Ctx, order: OrderSnapshot): Promise<FollowUp[]> {
  assertReady(order);
  const contactId = await ensureContact(db, ctx, order);
  for (const item of order.items) await ensureProduct(db, ctx, item);
  const built = orderToSalesOrder(order, contactId, ctx.config.settings);
  if ("error" in built) throw new BlockedJob(built.error, BLOCK_TEXT[built.error]);
  const memo = erpMemo(order.order_no);
  const mapped = await getMapping(db, ctx.config.id, "sales_order", order.id);
  let remote = mapped ? { id: mapped.remoteId, ref_number: mapped.remoteRef, amount_after_tax: null, status_id: null } : null;
  if (!remote) {
    const found = await findByMemo(ctx, "orders", memo);
    if (found) remote = found;
  }
  if (!remote) {
    const created = await call(ctx, "POST", "/finance/orders", built.body);
    remote = created.data;
  }
  if (!remote?.id) throw new Error("Kledo tidak mengembalikan sales order");
  const warning = totalWarning(order, remote.amount_after_tax);
  await rememberSalesOrder(db, ctx, order, Number(remote.id), remote.ref_number || null, remote.status_id != null ? String(remote.status_id) : null, warning);
  const invoiceAlready = await readInvoiceId(db, order.id);
  return invoiceFollowUp(ctx, order, invoiceAlready);
}

async function updateSalesOrder(db: Sql, ctx: Ctx, order: OrderSnapshot): Promise<FollowUp[]> {
  const mapped = await getMapping(db, ctx.config.id, "sales_order", order.id);
  if (!mapped) return createSalesOrder(db, ctx, order);
  assertReady(order);
  const contactId = await ensureContact(db, ctx, order);
  for (const item of order.items) await ensureProduct(db, ctx, item);
  const built = orderToSalesOrder(order, contactId, ctx.config.settings);
  if ("error" in built) throw new BlockedJob(built.error, BLOCK_TEXT[built.error]);
  let remoteId = mapped.remoteId;
  let remoteRef = mapped.remoteRef;
  let remoteTotal: unknown = null;
  let remoteStatus: string | null = null;
  try {
    const updated = await call(ctx, "PUT", `/finance/orders/${remoteId}`, built.body);
    remoteRef = updated.data?.ref_number || remoteRef;
    remoteTotal = updated.data?.amount_after_tax;
    remoteStatus = updated.data?.status_id != null ? String(updated.data.status_id) : null;
  } catch (err) {
    if (!(err instanceof KledoError) || (err.status !== 404 && err.status !== 405)) throw err;
    const invoiceAlready = await readInvoiceId(db, order.id);
    if (invoiceAlready) {
      throw new BlockedJob("VALIDATION", "Invoice sudah terbit. Perubahan SO ditolak; revisi manual di Kledo.");
    }
    await call(ctx, "DELETE", `/finance/orders/${remoteId}`).catch(async () => {
      await call(ctx, "POST", `/finance/orders/${remoteId}/void`);
    });
    const created = await call(ctx, "POST", "/finance/orders", built.body);
    remoteId = Number(created.data?.id);
    remoteRef = created.data?.ref_number || null;
    remoteTotal = created.data?.amount_after_tax;
    remoteStatus = created.data?.status_id != null ? String(created.data.status_id) : null;
  }
  await rememberSalesOrder(db, ctx, order, remoteId, remoteRef, remoteStatus, totalWarning(order, remoteTotal));
  return invoiceFollowUp(ctx, order, await readInvoiceId(db, order.id));
}

async function voidSalesOrder(db: Sql, ctx: Ctx, order: OrderSnapshot): Promise<FollowUp[]> {
  const mapped = await getMapping(db, ctx.config.id, "sales_order", order.id);
  const memo = erpMemo(order.order_no);
  const found = mapped || null;
  let remoteId = found?.remoteId || 0;
  if (!remoteId) {
    const remote = await findByMemo(ctx, "orders", memo);
    if (remote) remoteId = Number(remote.id);
  }
  if (remoteId) {
    try {
      await call(ctx, "POST", `/finance/orders/${remoteId}/void`);
    } catch (err) {
      if (!(err instanceof KledoError) || err.status === 401 || err.transient) throw err;
      if (err.status !== 400) {
        try {
          await call(ctx, "DELETE", `/finance/orders/${remoteId}`);
        } catch (delErr) {
          if (!(delErr instanceof KledoError) || delErr.transient || delErr.status === 401) throw delErr;
          await call(ctx, "POST", `/finance/orders/${remoteId}/close`);
        }
      }
    }
    if (mapped || remoteId) {
      await saveMapping(db, ctx.config.id, "sales_order", order.id, order.order_no, remoteId, mapped?.remoteRef || null, mapped?.hash || null, "void");
    }
  }
  await patchOrder(db, order.id, {
    kledo_config_id: ctx.config.id,
    kledo_sync_status: "voided",
    kledo_last_synced_at: new Date().toISOString(),
    kledo_sync_error: null,
  });
  return [];
}

function invoiceTransDate(job: JobRow, order: OrderSnapshot): string {
  const match = String(job.triggered_by || "").match(/^manual:(\d{4}-\d{2}-\d{2})$/);
  return match ? match[1] : order.delivery_date;
}

async function createInvoice(db: Sql, ctx: Ctx, order: OrderSnapshot): Promise<FollowUp[]> {
  const existingInvoice = await getMapping(db, ctx.config.id, "invoice", order.id);
  if (existingInvoice) {
    await patchOrder(db, order.id, {
      kledo_invoice_id: existingInvoice.remoteId,
      kledo_invoice_number: existingInvoice.remoteRef,
      kledo_sync_status: "invoiced",
      kledo_sync_error: null,
    });
    return [];
  }
  const so = await getMapping(db, ctx.config.id, "sales_order", order.id);
  if (!so) throw new DeferJob(300, "Invoice menunggu Sales Order");
  const pendingUpdate = await db.query(
    `SELECT 1 FROM integration_sync_jobs
     WHERE config_id=$1 AND local_id=$2 AND entity_type='sales_order' AND action='update'
       AND status IN ('pending','processing') AND id <> $3 LIMIT 1`,
    [ctx.config.id, order.id, ctx.job.id]
  );
  if (pendingUpdate.rows.length) throw new DeferJob(60, "Invoice menunggu pembaruan Sales Order");
  if (so.hash && so.hash !== orderSyncHash(order)) throw new DeferJob(60, "Sales Order belum sesuai dengan order terbaru");

  assertReady(order);
  const contactId = await ensureContact(db, ctx, order);
  for (const item of order.items) await ensureProduct(db, ctx, item);
  const transDate = invoiceTransDate(ctx.job, order);
  const built = orderToInvoice(order, contactId, so.remoteId, ctx.config.settings, transDate);
  if ("error" in built) throw new BlockedJob(built.error, BLOCK_TEXT[built.error]);
  const memo = erpMemo(order.order_no);
  let remote = await findByMemo(ctx, "invoices", memo);
  if (!remote) {
    const created = await call(ctx, "POST", "/finance/invoices", built.body);
    remote = created.data;
  }
  const warning = totalWarning(order, remote.amount_after_tax);
  await saveMapping(db, ctx.config.id, "invoice", order.id, order.order_no, Number(remote.id), remote.ref_number || null, orderSyncHash(order), remote.status_id != null ? String(remote.status_id) : null);
  await patchOrder(db, order.id, {
    kledo_config_id: ctx.config.id,
    kledo_invoice_id: Number(remote.id),
    kledo_invoice_number: remote.ref_number || null,
    kledo_sync_status: "invoiced",
    kledo_last_synced_at: new Date().toISOString(),
    kledo_sync_error: warning,
    invoiced_at: new Date().toISOString(),
  });
  return [];
}

async function updateInvoice(db: Sql, ctx: Ctx, order: OrderSnapshot): Promise<FollowUp[]> {
  const mapped = await getMapping(db, ctx.config.id, "invoice", order.id);
  if (!mapped) return createInvoice(db, ctx, order);
  const so = await getMapping(db, ctx.config.id, "sales_order", order.id);
  if (!so) throw new DeferJob(300, "Invoice menunggu Sales Order");

  assertReady(order);
  const contactId = await ensureContact(db, ctx, order);
  for (const item of order.items) await ensureProduct(db, ctx, item);
  const transDate = invoiceTransDate(ctx.job, order);
  const built = orderToInvoice(order, contactId, so.remoteId, ctx.config.settings, transDate);
  if ("error" in built) throw new BlockedJob(built.error, BLOCK_TEXT[built.error]);

  let remoteId = mapped.remoteId;
  let remoteRef = mapped.remoteRef;
  let remoteTotal: unknown = null;
  let remoteStatus: string | null = null;

  try {
    const updated = await call(ctx, "PUT", `/finance/invoices/${remoteId}`, built.body);
    remoteRef = updated.data?.ref_number || remoteRef;
    remoteTotal = updated.data?.amount_after_tax;
    remoteStatus = updated.data?.status_id != null ? String(updated.data.status_id) : null;
  } catch (err: any) {
    if (err instanceof KledoError) {
      const errMsg = err.result?.message || err.message;
      throw new BlockedJob("VALIDATION", `Gagal update invoice di Kledo: ${errMsg}`);
    }
    throw err;
  }

  const warning = totalWarning(order, remoteTotal);
  await saveMapping(db, ctx.config.id, "invoice", order.id, order.order_no, remoteId, remoteRef, orderSyncHash(order), remoteStatus);
  await patchOrder(db, order.id, {
    kledo_config_id: ctx.config.id,
    kledo_invoice_id: remoteId,
    kledo_invoice_number: remoteRef,
    kledo_sync_status: "invoiced",
    kledo_last_synced_at: new Date().toISOString(),
    kledo_sync_error: warning,
  });
  return [];
}

async function voidInvoice(db: Sql, ctx: Ctx, order: OrderSnapshot): Promise<FollowUp[]> {
  const mapped = await getMapping(db, ctx.config.id, "invoice", order.id);
  let remoteId = mapped?.remoteId || (await readInvoiceId(db, order.id)) || 0;
  if (!remoteId) {
    const found = await findByMemo(ctx, "invoices", erpMemo(order.order_no));
    if (found) remoteId = Number(found.id);
  }
  if (remoteId) {
    await call(ctx, "POST", `/finance/invoices/${remoteId}/void`);
    await saveMapping(db, ctx.config.id, "invoice", order.id, order.order_no, remoteId, mapped?.remoteRef || null, mapped?.hash || null, "void");
  }
  await voidSalesOrder(db, ctx, order);
  return [];
}

export function blockMessage(reason: string): string {
  return BLOCK_TEXT[reason] || reason;
}
