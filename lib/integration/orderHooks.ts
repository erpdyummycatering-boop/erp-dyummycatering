import pool from "@/lib/db";
import { getActiveConfig, getConfigById, deliveryInScope } from "@/lib/integration/config";
import { toDateOnly } from "@/lib/integration/dates";
import { isMissingRelation, tableColumns, type Sql } from "@/lib/integration/schema";
import {
  cancelOpenJobs,
  enqueueJob,
  invCreateKey,
  invUpdateKey,
  invVoidKey,
  soCreateKey,
  soUpdateKey,
  soVoidKey,
} from "@/lib/integration/outbox";
import { orderSyncHash, type OrderItemInput } from "@/lib/kledo/mappers";

export const PHONE_MATCH_SQL = `CASE
  WHEN phone IS NULL OR regexp_replace(phone, '\\D', '', 'g') = '' THEN NULL
  WHEN regexp_replace(phone, '\\D', '', 'g') LIKE '62%'
    THEN '0' || substr(regexp_replace(phone, '\\D', '', 'g'), 3)
  WHEN regexp_replace(phone, '\\D', '', 'g') LIKE '0%'
    THEN regexp_replace(phone, '\\D', '', 'g')
  ELSE '0' || regexp_replace(phone, '\\D', '', 'g')
END`;

export function phoneMatchSql(column = "phone") {
  return PHONE_MATCH_SQL.replace(/\bphone\b/g, column);
}

export type OrderItemState = {
  product_id: number;
  price: number;
  quantity: number;
  discount: number;
  custom_menu: string;
  notes: string;
};

export type OrderState = {
  id: number;
  lini: string;
  input_source: string;
  customer_id: number;
  order_date: string;
  delivery_date: string;
  shipping_fee: number;
  additional_menu_price: number;
  status_order: string;
  grand_total: number;
  venue: string;
  recipient_name: string;
  recipient_phone: string;
  kledo_so_id: number | null;
  kledo_invoice_id: number | null;
  kledo_invoice_number: string | null;
  kledo_config_id: number | null;
  items: OrderItemState[];
};

export async function withKledoSavepoint<T>(client: Sql, fn: () => Promise<T>, fallback: T): Promise<T> {
  await client.query("SAVEPOINT kledo_sync");
  try {
    const value = await fn();
    await client.query("RELEASE SAVEPOINT kledo_sync");
    return value;
  } catch (err) {
    try {
      await client.query("ROLLBACK TO SAVEPOINT kledo_sync");
    } catch {
      /* transaksi sudah di-rollback ke savepoint */
    }
    if (!isMissingRelation(err)) {
      console.error("[kledo] antrian dilewati:", err instanceof Error ? err.message : "error");
    }
    return fallback;
  }
}

export async function loadOrderState(db: Sql, orderId: number): Promise<OrderState | null> {
  const cols = await tableColumns("orders", db);
  const optional = ["kledo_so_id", "kledo_invoice_id", "kledo_invoice_number", "kledo_config_id"]
    .filter((name) => cols.has(name))
    .map((name) => `o.${name}`)
    .join(", ");
  const res = await db.query(
    `SELECT o.id, o.lini, o.input_source, o.customer_id, o.order_date, o.delivery_date,
            o.shipping_fee, o.additional_menu_price, o.status_order, o.grand_total,
            o.venue, o.recipient_name, o.recipient_phone, o.pic_id
            ${optional ? `, ${optional}` : ""}
     FROM orders o WHERE o.id = $1`,
    [orderId]
  );
  if (!res.rows[0]) return null;
  const row = res.rows[0];
  const items = await db.query(
    `SELECT product_id, price, quantity, discount, custom_menu, notes
     FROM order_items WHERE order_id = $1 ORDER BY id`,
    [orderId]
  );
  return {
    id: Number(row.id),
    lini: row.lini || "catering",
    input_source: row.input_source || "manual",
    customer_id: Number(row.customer_id),
    order_date: toDateOnly(row.order_date) || "",
    delivery_date: toDateOnly(row.delivery_date) || "",
    shipping_fee: Number(row.shipping_fee || 0),
    additional_menu_price: Number(row.additional_menu_price || 0),
    status_order: row.status_order || "Baru",
    grand_total: Number(row.grand_total || 0),
    venue: row.venue || "",
    recipient_name: row.recipient_name || "",
    recipient_phone: row.recipient_phone || "",
    kledo_so_id: row.kledo_so_id ? Number(row.kledo_so_id) : null,
    kledo_invoice_id: row.kledo_invoice_id ? Number(row.kledo_invoice_id) : null,
    kledo_invoice_number: row.kledo_invoice_number || null,
    kledo_config_id: row.kledo_config_id ? Number(row.kledo_config_id) : null,
    items: items.rows.map((item) => ({
      product_id: Number(item.product_id),
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 0),
      discount: Number(item.discount || 0),
      custom_menu: item.custom_menu || "",
      notes: item.notes || "",
    })),
  };
}

function money(value: unknown) {
  return Math.round(Number(value || 0));
}

export function financialChanged(previous: OrderState, next: {
  customer_id: unknown;
  order_date: unknown;
  delivery_date: unknown;
  shipping_fee: unknown;
  additional_menu_price: unknown;
  items: OrderItemState[];
}): boolean {
  if (Number(previous.customer_id) !== Number(next.customer_id)) return true;
  if (previous.order_date !== (toDateOnly(next.order_date) || "")) return true;
  if (previous.delivery_date !== (toDateOnly(next.delivery_date) || "")) return true;
  if (money(previous.shipping_fee) !== money(next.shipping_fee)) return true;
  if (money(previous.additional_menu_price) !== money(next.additional_menu_price)) return true;
  const norm = (items: OrderItemState[]) => items.map((item) => ({
    product_id: Number(item.product_id),
    price: money(item.price),
    quantity: Number(item.quantity || 0),
    discount: money(item.discount),
    custom_menu: String(item.custom_menu || ""),
  }));
  return JSON.stringify(norm(previous.items)) !== JSON.stringify(norm(next.items));
}

function asItems(items: OrderItemState[]): OrderItemInput[] {
  return items.map((item) => ({
    product_id: Number(item.product_id),
    product_name: "",
    sku: null,
    kledo_product_id: null,
    price: Number(item.price || 0),
    quantity: Number(item.quantity || 0),
    discount: Number(item.discount || 0),
    custom_menu: item.custom_menu || null,
    notes: item.notes || null,
  }));
}

function isCancelled(status: string) {
  return status === "Batal" || status === "Dibatalkan";
}

export async function enqueueCateringCreate(
  client: Sql,
  opts: { orderId: number; userId: number | null; deliveryDate: string; lini?: string | null; inputSource?: string | null }
): Promise<number[]> {
  return withKledoSavepoint(client, async () => {
    if ((opts.lini || "catering") !== "catering") return [];
    if (opts.inputSource === "import") return [];
    const config = await getActiveConfig();
    if (!config || !deliveryInScope(config, opts.deliveryDate)) return [];
    const id = await enqueueJob(client, {
      configId: config.id,
      entityType: "sales_order",
      localId: opts.orderId,
      action: "create",
      idempotencyKey: soCreateKey(config.id, opts.orderId),
      priority: 5,
      triggeredBy: "order_create",
      createdBy: opts.userId,
    });
    return id ? [id] : [];
  }, []);
}

export async function enqueueCateringUpdate(
  client: Sql,
  opts: {
    userId: number | null;
    previous: OrderState;
    nextStatus: string;
    next: {
      customer_id: number;
      order_date: string;
      delivery_date: string;
      shipping_fee: number;
      additional_menu_price: number;
      venue: string;
      recipient_name: string;
      recipient_phone: string;
      items: OrderItemState[];
    };
  }
): Promise<number[]> {
  return withKledoSavepoint(client, async () => {
    if (opts.previous.lini !== "catering") return [];
    if (opts.previous.input_source === "import" && !opts.previous.kledo_so_id && !opts.previous.kledo_invoice_id) return [];
    const config = (await getActiveConfig()) || (opts.previous.kledo_config_id ? await getConfigById(opts.previous.kledo_config_id) : null);
    if (!config) return [];
    const ids: number[] = [];
    const push = async (id: number | null) => { if (id) ids.push(id); };

    if (isCancelled(opts.nextStatus)) {
      await cancelOpenJobs(client, config.id, opts.previous.id);
      if (opts.previous.kledo_invoice_id) {
        await push(await enqueueJob(client, {
          configId: config.id, entityType: "invoice", localId: opts.previous.id, action: "void",
          idempotencyKey: invVoidKey(config.id, opts.previous.id), priority: 2, triggeredBy: "order_update", createdBy: opts.userId,
        }));
      } else if (opts.previous.kledo_so_id) {
        await push(await enqueueJob(client, {
          configId: config.id, entityType: "sales_order", localId: opts.previous.id, action: "void",
          idempotencyKey: soVoidKey(config.id, opts.previous.id), priority: 2, triggeredBy: "order_update", createdBy: opts.userId,
        }));
      }
      return ids;
    }

    const inScope = deliveryInScope(config, opts.next.delivery_date);
    let hashChanged = false;
    let nextHash = "";

    if (!opts.previous.kledo_so_id) {
      if (inScope && config.syncEnabled) {
        await push(await enqueueJob(client, {
          configId: config.id, entityType: "sales_order", localId: opts.previous.id, action: "create",
          idempotencyKey: soCreateKey(config.id, opts.previous.id), priority: 5, triggeredBy: "order_update", createdBy: opts.userId,
        }));
      }
    } else {
      nextHash = orderSyncHash({
        customer_id: opts.next.customer_id,
        order_date: opts.next.order_date,
        delivery_date: opts.next.delivery_date,
        shipping_fee: opts.next.shipping_fee,
        additional_menu_price: opts.next.additional_menu_price,
        venue: opts.next.venue,
        recipient_name: opts.next.recipient_name,
        recipient_phone: opts.next.recipient_phone,
        items: asItems(opts.next.items),
      });
      const previousHash = orderSyncHash({
        customer_id: opts.previous.customer_id,
        order_date: opts.previous.order_date,
        delivery_date: opts.previous.delivery_date,
        shipping_fee: opts.previous.shipping_fee,
        additional_menu_price: opts.previous.additional_menu_price,
        venue: opts.previous.venue,
        recipient_name: opts.previous.recipient_name,
        recipient_phone: opts.previous.recipient_phone,
        items: asItems(opts.previous.items),
      });
      hashChanged = nextHash !== previousHash;
      if (hashChanged && config.syncEnabled) {
        const key = soUpdateKey(config.id, opts.previous.id, nextHash);
        await cancelOpenJobs(client, config.id, opts.previous.id, key);
        await push(await enqueueJob(client, {
          configId: config.id, entityType: "sales_order", localId: opts.previous.id, action: "update",
          idempotencyKey: key, priority: 3, triggeredBy: "order_update", createdBy: opts.userId,
        }));
      }
    }

    if (opts.previous.kledo_invoice_id) {
      if (hashChanged && config.syncEnabled) {
        const invKey = invUpdateKey(config.id, opts.previous.id, nextHash);
        await push(await enqueueJob(client, {
          configId: config.id, entityType: "invoice", localId: opts.previous.id, action: "update",
          idempotencyKey: invKey, priority: 4, triggeredBy: "order_update", createdBy: opts.userId,
        }));
      }
      return ids;
    }

    if (opts.nextStatus === "Selesai" && inScope && config.syncEnabled) {
      await push(await enqueueJob(client, {
        configId: config.id, entityType: "invoice", localId: opts.previous.id, action: "create_invoice",
        idempotencyKey: invCreateKey(config.id, opts.previous.id), priority: 6, triggeredBy: "order_update", createdBy: opts.userId,
      }));
    }
    return ids;
  }, []);
}

export async function enqueueManual(opts: {
  orderId: number;
  userId: number | null;
  action: "sync" | "invoice" | "void";
  invoiceDate?: string | null;
}): Promise<number | null> {
  const config = await getActiveConfig();
  if (!config) return null;
  const state = await loadOrderState(pool, opts.orderId);
  if (!state || state.lini !== "catering") return null;
  if (opts.action === "void") {
    if (state.kledo_invoice_id) {
      return enqueueJob(pool, {
        configId: config.id, entityType: "invoice", localId: opts.orderId, action: "void",
        idempotencyKey: invVoidKey(config.id, opts.orderId), priority: 2, triggeredBy: "manual", createdBy: opts.userId,
      });
    }
    return enqueueJob(pool, {
      configId: config.id, entityType: "sales_order", localId: opts.orderId, action: "void",
      idempotencyKey: soVoidKey(config.id, opts.orderId), priority: 2, triggeredBy: "manual", createdBy: opts.userId,
    });
  }
  if (opts.action === "invoice") {
    const triggeredBy = opts.invoiceDate ? `manual:${opts.invoiceDate}` : "manual";
    return enqueueJob(pool, {
      configId: config.id, entityType: "invoice", localId: opts.orderId, action: "create_invoice",
      idempotencyKey: invCreateKey(config.id, opts.orderId), priority: 4, triggeredBy, createdBy: opts.userId,
    });
  }
  if (state.kledo_invoice_id) {
    const hash = orderSyncHash({
      customer_id: state.customer_id,
      order_date: state.order_date,
      delivery_date: state.delivery_date,
      shipping_fee: state.shipping_fee,
      additional_menu_price: state.additional_menu_price,
      venue: state.venue,
      recipient_name: state.recipient_name,
      recipient_phone: state.recipient_phone,
      items: asItems(state.items),
    });
    return enqueueJob(pool, {
      configId: config.id, entityType: "invoice", localId: opts.orderId, action: "update",
      idempotencyKey: invUpdateKey(config.id, opts.orderId, hash), priority: 3, triggeredBy: "manual", createdBy: opts.userId,
    });
  }
  if (state.kledo_so_id) {
    const hash = orderSyncHash({
      customer_id: state.customer_id,
      order_date: state.order_date,
      delivery_date: state.delivery_date,
      shipping_fee: state.shipping_fee,
      additional_menu_price: state.additional_menu_price,
      venue: state.venue,
      recipient_name: state.recipient_name,
      recipient_phone: state.recipient_phone,
      items: asItems(state.items),
    });
    return enqueueJob(pool, {
      configId: config.id, entityType: "sales_order", localId: opts.orderId, action: "update",
      idempotencyKey: soUpdateKey(config.id, opts.orderId, hash), priority: 3, triggeredBy: "manual", createdBy: opts.userId,
    });
  }
  return enqueueJob(pool, {
    configId: config.id, entityType: "sales_order", localId: opts.orderId, action: "create",
    idempotencyKey: soCreateKey(config.id, opts.orderId), priority: 3, triggeredBy: "manual", createdBy: opts.userId,
  });
}
