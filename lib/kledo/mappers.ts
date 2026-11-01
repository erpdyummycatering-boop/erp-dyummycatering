import { createHash } from "crypto";
import { formatOrderNo } from "@/lib/utils";
import { isValidPhone } from "@/lib/phoneUtils";
import { addDays, isReasonableDate } from "@/lib/integration/dates";
import type { KledoSettings } from "@/lib/integration/types";

export type OrderItemInput = {
  product_id: number;
  product_name: string;
  sku: string | null;
  kledo_product_id: number | null;
  price: number;
  quantity: number;
  discount: number;
  custom_menu: string | null;
  notes: string | null;
};

export type OrderSnapshot = {
  id: number;
  order_no: string;
  customer_id: number;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  order_date: string;
  delivery_date: string;
  venue: string | null;
  order_notes: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  shipping_fee: number;
  additional_menu_price: number;
  grand_total: number;
  status_order: string;
  lini: string;
  items: OrderItemInput[];
};

export type BlockCode =
  | "NO_PHONE"
  | "NO_PRODUCT_CODE"
  | "ZERO_TOTAL"
  | "BAD_DATE"
  | "NO_CONTACT"
  | "MISSING_DEFAULTS"
  | "NOT_CATERING";

export function payloadHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stable(obj[key]);
        return acc;
      }, {});
  }
  return value;
}

export function productCode(item: { product_id: number; sku?: string | null }): string {
  const sku = String(item.sku || "").trim();
  return sku || `CTR-${item.product_id}`;
}

export function erpMemo(orderNo: string): string {
  return `ERP#${orderNo}`;
}

export function orderSyncHash(order: Pick<OrderSnapshot, "customer_id" | "order_date" | "delivery_date" | "shipping_fee" | "additional_menu_price" | "venue" | "recipient_name" | "recipient_phone" | "items">): string {
  return payloadHash({
    customer_id: order.customer_id,
    order_date: order.order_date,
    delivery_date: order.delivery_date,
    shipping_fee: Number(order.shipping_fee || 0),
    additional_menu_price: Number(order.additional_menu_price || 0),
    venue: order.venue || "",
    recipient_name: order.recipient_name || "",
    recipient_phone: order.recipient_phone || "",
    items: order.items.map((item) => ({
      product_id: Number(item.product_id),
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 0),
      discount: Number(item.discount || 0),
      custom_menu: item.custom_menu || "",
      notes: item.notes || "",
    })),
  });
}

export function validateOrderForSync(order: OrderSnapshot): BlockCode | null {
  if (order.lini && order.lini !== "catering") return "NOT_CATERING";
  if (!isValidPhone(order.customer_phone)) return "NO_PHONE";
  if (!isReasonableDate(order.order_date) || !isReasonableDate(order.delivery_date)) return "BAD_DATE";
  if (order.delivery_date < order.order_date) return "BAD_DATE";
  if (!(Number(order.grand_total) > 0)) return "ZERO_TOTAL";
  if (!order.items.length || order.items.some((item) => !item.product_id)) return "NO_PRODUCT_CODE";
  return null;
}

function lineDesc(item: OrderItemInput): string {
  const parts = [item.custom_menu, item.notes].map((part) => String(part || "").trim()).filter(Boolean);
  let desc = parts.join("\n") || item.product_name || productCode(item);
  if (Number(item.quantity) <= 0) desc = `[Qty 0] ${desc}`;
  return desc.slice(0, 1000);
}

function mapItem(item: OrderItemInput, unitId: number | null) {
  const rawQty = Number(item.quantity || 0);
  const qty = rawQty > 0 ? rawQty : 1;
  const price = rawQty > 0 ? Number(item.price || 0) : 0;
  const discount = rawQty > 0 ? Number(item.discount || 0) : 0;
  const amount = Math.max(0, price * qty - discount);
  const row: Record<string, unknown> = {
    finance_account_id: Number(item.kledo_product_id),
    desc: lineDesc(item),
    qty,
    price,
    amount,
  };
  if (unitId) row.unit_id = unitId;
  if (discount > 0 && qty > 0) {
    row.discount_type = 2;
    row.discount_amount = Math.round((discount / qty) * 100) / 100;
  }
  return row;
}

function customerMessage(order: OrderSnapshot): string | undefined {
  const bits = [
    order.venue ? `Venue: ${order.venue}` : "",
    order.recipient_name ? `Penerima: ${order.recipient_name}` : "",
    order.recipient_phone ? `HP penerima: ${order.recipient_phone}` : "",
    order.departure_time ? `Berangkat: ${order.departure_time}` : "",
    order.arrival_time ? `Tiba: ${order.arrival_time}` : "",
    order.order_notes || "",
  ].filter(Boolean);
  if (!bits.length) return undefined;
  return bits.join(" | ").slice(0, 1000);
}

function extraLines(order: OrderSnapshot, settings: KledoSettings, unitId: number | null): { lines: Record<string, unknown>[] } | { error: "MISSING_DEFAULTS" } {
  const lines: Record<string, unknown>[] = [];
  const shipping = Number(order.shipping_fee || 0);
  const extra = Number(order.additional_menu_price || 0);
  if (settings.shipping_mode === "product" && shipping > 0) {
    if (!settings.shipping_product_id) return { error: "MISSING_DEFAULTS" as const };
    lines.push({
      finance_account_id: Number(settings.shipping_product_id),
      desc: "Ongkos Kirim",
      qty: 1,
      price: shipping,
      amount: shipping,
      ...(unitId ? { unit_id: unitId } : {}),
    });
  }
  if (extra > 0) {
    if (!settings.addl_menu_product_id) return { error: "MISSING_DEFAULTS" as const };
    lines.push({
      finance_account_id: Number(settings.addl_menu_product_id),
      desc: "Menu Tambahan",
      qty: 1,
      price: extra,
      amount: extra,
      ...(unitId ? { unit_id: unitId } : {}),
    });
  }
  return { lines };
}

export function orderToSalesOrder(
  order: OrderSnapshot,
  contactId: number,
  settings: KledoSettings
): { body: Record<string, unknown> } | { error: BlockCode } {
  const unitId = settings.unit_id ? Number(settings.unit_id) : null;
  const items = order.items.map((item) => mapItem(item, unitId));
  const extra = extraLines(order, settings, unitId);
  if ("error" in extra) return { error: extra.error };
  const dueDays = Number(settings.due_days || 0);
  const body: Record<string, unknown> = {
    trans_date: order.order_date,
    due_date: addDays(order.delivery_date, dueDays),
    shipping_date: order.delivery_date,
    contact_id: contactId,
    include_tax: 0,
    memo: erpMemo(order.order_no || formatOrderNo(order.id)),
    items: [...items, ...extra.lines],
  };
  const message = customerMessage(order);
  if (message) body.message = message;
  const shipping = Number(order.shipping_fee || 0);
  if (shipping > 0 && settings.shipping_mode !== "product") body.shipping_cost = shipping;
  return { body };
}

export function orderToInvoice(
  order: OrderSnapshot,
  contactId: number,
  salesOrderId: number,
  settings: KledoSettings,
  transDate: string
): { body: Record<string, unknown> } | { error: BlockCode } {
  const so = orderToSalesOrder(order, contactId, settings);
  if ("error" in so) return so;
  const dueDays = Number(settings.due_days || 0);
  return {
    body: {
      ...so.body,
      business_tran_id: salesOrderId,
      trans_date: transDate,
      due_date: addDays(transDate, dueDays),
      shipping_date: order.delivery_date,
    },
  };
}

export function customerToContact(order: OrderSnapshot, phone: string): Record<string, unknown> {
  return {
    name: order.customer_name,
    type_id: 3,
    phone,
    address: order.customer_address || undefined,
    ref_number: `CUST-${order.customer_id}`,
  };
}

export function productToKledo(item: OrderItemInput, settings: KledoSettings): { body: Record<string, unknown> } | { error: "MISSING_DEFAULTS" } {
  if (!settings.sell_account_id || !settings.unit_id || !settings.pos_product_category_id) {
    return { error: "MISSING_DEFAULTS" };
  }
  const price = Number(item.price || 0);
  return {
    body: {
      name: item.product_name || productCode(item),
      code: productCode(item),
      pos_product_category_id: Number(settings.pos_product_category_id),
      base_price: price,
      price,
      is_sell: 1,
      sell_account_id: Number(settings.sell_account_id),
      is_purchase: 0,
      is_track: 0,
      unit_id: Number(settings.unit_id),
    },
  };
}
