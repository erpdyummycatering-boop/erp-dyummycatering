import { encryptSecret, decryptSecret } from "../lib/crypto";
import { isValidPhone, normalizePhoneNumber } from "../lib/phoneUtils";
import { formatOrderNo } from "../lib/utils";
import { allowedConfigEnvironments, envGuardMessage, isValidKledoBaseUrl, kledoAccountFromUrl, kledoBadge, resolveAppEnv } from "../lib/integration/env";
import { orderSyncHash, orderToInvoice, orderToSalesOrder, productToKledo, validateOrderForSync, type OrderSnapshot } from "../lib/kledo/mappers";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const order: OrderSnapshot = {
  id: 2726,
  order_no: "ORD-2726",
  customer_id: 9,
  customer_name: "Bu Ana",
  customer_phone: "+62 812-0000-0001",
  customer_address: "Bandung",
  order_date: "2026-10-20",
  delivery_date: "2026-10-30",
  venue: "Rumah Bu Ana",
  order_notes: "Acara keluarga",
  recipient_name: "Bu Ana",
  recipient_phone: "081200000001",
  departure_time: "08:00:00",
  arrival_time: "10:00:00",
  shipping_fee: 25000,
  additional_menu_price: 10000,
  grand_total: 1_785_000,
  status_order: "Baru",
  lini: "catering",
  items: [{
    product_id: 15,
    product_name: "Paket Nikmat",
    sku: null,
    kledo_product_id: 2,
    price: 35000,
    quantity: 50,
    discount: 0,
    custom_menu: "Nasi putih\nAyam",
    notes: null,
  }],
};

process.env.INTEGRATION_ENC_KEY = Buffer.alloc(32, 7).toString("base64");
const secret = encryptSecret("kledo_pat_demo1234");
assert(secret.last4 === "1234", "last4");
assert(decryptSecret(secret) === "kledo_pat_demo1234", "roundtrip");
assert(normalizePhoneNumber("+62 812-0000-0001") === "081200000001", "phone +62");
assert(normalizePhoneNumber("081200000001") === "081200000001", "phone 08");
assert(isValidPhone("081234567890"), "valid phone");
assert(!isValidPhone("123"), "short phone");
assert(formatOrderNo(12) === "ORD-012", "order no pad");
assert(formatOrderNo(2726) === "ORD-2726", "order no long");
assert(isValidKledoBaseUrl("https://ptlenterasinergiprima.api.kledo.id/api/v1/"), "base url");
assert(kledoAccountFromUrl("https://ptlenterasinergiprima.api.kledo.id/api/v1") === "ptlenterasinergiprima", "account");
assert(!isValidKledoBaseUrl("http://ptlenterasinergiprima.api.kledo.id/api/v1"), "reject http");
assert(resolveAppEnv("production") === "production", "app env");
assert(allowedConfigEnvironments("production").join() === "production", "prod allow");
assert(allowedConfigEnvironments("preview").join() === "demo,staging", "preview allow");
assert(envGuardMessage("production", "preview")?.includes("APP_ENV"), "guard");
assert(kledoBadge("demo") === "DEMO" && kledoBadge("production") === "LIVE", "badge");

const settings = { sell_account_id: 10, unit_id: 4, pos_product_category_id: 3, addl_menu_product_id: 8, shipping_mode: "shipping_cost" as const, due_days: 0, auto_create_contact: true, auto_create_product: true };
const so = orderToSalesOrder(order, 3, settings);
assert(!("error" in so), "so built");
if (!("error" in so)) {
  assert(so.body.memo === "ERP#ORD-2726", "memo");
  assert(so.body.shipping_cost === 25000, "shipping");
  const items = so.body.items as { finance_account_id: number; qty: number }[];
  assert(items[0].finance_account_id === 2, "product id");
  assert(items[0].qty === 50, "qty");
  assert(items[1].finance_account_id === 8, "addl menu");
}
const inv = orderToInvoice(order, 3, 77, settings, "2026-10-30");
assert(!("error" in inv) && inv.body.business_tran_id === 77, "business_tran_id");
assert(!("error" in inv) && inv.body.trans_date === "2026-10-30", "invoice date");

const free = { ...order, items: [{ ...order.items[0], quantity: 0, price: 0 }] };
const freeSo = orderToSalesOrder(free, 3, settings);
assert(!("error" in freeSo), "free built");
if (!("error" in freeSo)) {
  const item = (freeSo.body.items as { qty: number; price: number; desc: string }[])[0];
  assert(item.qty === 1 && item.price === 0 && item.desc.startsWith("[Qty 0]"), "qty 0");
}
assert(validateOrderForSync({ ...order, customer_phone: "" }) === "NO_PHONE", "no phone");
assert(validateOrderForSync({ ...order, grand_total: 0 }) === "ZERO_TOTAL", "zero");
assert(validateOrderForSync({ ...order, delivery_date: "0226-09-19" }) === "BAD_DATE", "bad date");
assert(validateOrderForSync({ ...order, lini: "siap_saji" }) === "NOT_CATERING", "siap saji");
const missing = productToKledo(order.items[0], {});
assert("error" in missing && missing.error === "MISSING_DEFAULTS", "missing defaults");
assert(orderSyncHash(order) === orderSyncHash({ ...order }), "hash stable");

console.log("kledo selfcheck ok");
