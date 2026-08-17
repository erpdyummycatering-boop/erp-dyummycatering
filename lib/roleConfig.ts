// ─── Role Configuration ───────────────────────────────────────────────────────

export type RoleKey =
  | "super_admin"
  | "owner"
  | "cs_sales"
  | "chef"
  | "purchasing"
  | "finance"
  | "hr"
  | "cs_ss"
  | "keuangan_ss"
  | "siap_saji";

export interface RoleConfig {
  key: RoleKey;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  initials: string;
  /** Halaman pertama saat role ini aktif */
  firstPage: string;
  /** href yang boleh muncul di sidebar. "*" = semua */
  allowedHrefs: string[] | "*";
}

export const ROLES: RoleConfig[] = [
  {
    key: "super_admin",
    label: "Super Admin",
    description: "Akses penuh ke semua fitur ERP & CRM",
    color: "#5005A6",
    bgColor: "#f0fdf4",
    initials: "SA",
    firstPage: "/cs-performance",
    allowedHrefs: "*",
  },
  {
    key: "owner",
    label: "Owner",
    description: "Dashboard bisnis, P&L, Target, dan laporan keuangan",
    color: "#7c3aed",
    bgColor: "#f5f3ff",
    initials: "OW",
    firstPage: "/pl-dashboard",
    allowedHrefs: [
      "/pl-dashboard",
      "/targets",
      "/cs-performance",
      "/orders",
      "/siap-saji/dashboard",
      "/siap-saji/orders",
      "/siap-saji/documents",
      "/siap-saji/analytics/products",
      "/siap-saji/analytics/customers",
      "/siap-saji/shipping",
      "/siap-saji/customers",
      "/siap-saji/products",
      "/siap-saji/master-data",
      "/siap-saji/finance",
    ],
  },
  {
    key: "cs_sales",
    label: "CS / Sales",
    description: "Kelola leads, kontak customer, dan order masuk",
    color: "#378ADD",
    bgColor: "#eff6ff",
    initials: "CS",
    firstPage: "/leads",
    allowedHrefs: [
      "/leads",
      "/customers",
      "/orders",
      "/cs-performance",
      "/products",
      "/siap-saji/dashboard",
      "/siap-saji/orders",
      "/siap-saji/documents",
      "/siap-saji/analytics/products",
      "/siap-saji/analytics/customers",
      "/siap-saji/customers",
      "/siap-saji/products",
    ],
  },
  {
    key: "chef",
    label: "Chef / Kitchen",
    description: "Jadwal produksi, master resep, dan BOM",
    color: "#e05a00",
    bgColor: "#fff7ed",
    initials: "KT",
    firstPage: "/production-schedules",
    allowedHrefs: [
      "/production-schedules",
      "/recipes",
    ],
  },
  {
    key: "purchasing",
    label: "Purchasing",
    description: "PR & PO, harga pasar, dan realisasi pembelian",
    color: "#BA7517",
    bgColor: "#fffbeb",
    initials: "PU",
    firstPage: "/purchasing",
    allowedHrefs: [
      "/purchasing",
      "/market-prices",
    ],
  },
  {
    key: "finance",
    label: "Finance / Keuangan",
    description: "Realisasi cost, laporan P&L, dan target keuangan",
    color: "#E24B4A",
    bgColor: "#fef2f2",
    initials: "FN",
    firstPage: "/finance",
    allowedHrefs: [
      "/finance",
      "/pl-dashboard",
      "/targets",
      "/siap-saji/dashboard",
      "/siap-saji/orders",
      "/siap-saji/documents",
      "/siap-saji/analytics/products",
      "/siap-saji/analytics/customers",
      "/siap-saji/shipping",
      "/siap-saji/customers",
      "/siap-saji/products",
      "/siap-saji/master-data",
      "/siap-saji/finance",
    ],
  },
  {
    key: "hr",
    label: "HR",
    description: "Melihat performa CS dan rekap tim",
    color: "#639922",
    bgColor: "#f1fbf0",
    initials: "HR",
    firstPage: "/cs-performance",
    allowedHrefs: [
      "/cs-performance",
      "/customers",
      "/orders",
    ],
  },
  {
    key: "cs_ss",
    label: "CS Siap Saji",
    description: "Akses khusus order, dokumen, dan pelanggan Siap Saji",
    color: "#EC008C",
    bgColor: "#fdf2f8",
    initials: "CS",
    firstPage: "/siap-saji/dashboard",
    allowedHrefs: [
      "/siap-saji/dashboard",
      "/siap-saji/orders",
      "/siap-saji/documents",
      "/siap-saji/analytics/products",
      "/siap-saji/analytics/customers",
      "/siap-saji/customers",
      "/siap-saji/products",
    ],
  },
  {
    key: "keuangan_ss",
    label: "Keuangan Siap Saji",
    description: "Akses modul Penjualan & Laporan Keuangan Siap Saji",
    color: "#06b6d4",
    bgColor: "#ecfeff",
    initials: "KS",
    firstPage: "/siap-saji/dashboard",
    allowedHrefs: [
      "/siap-saji/dashboard",
      "/siap-saji/orders",
      "/siap-saji/documents",
      "/siap-saji/analytics/products",
      "/siap-saji/analytics/customers",
      "/siap-saji/finance",
      "/siap-saji/shipping",
      "/siap-saji/customers",
      "/siap-saji/products",
      "/siap-saji/master-data",
    ],
  },
  {
    key: "siap_saji",
    label: "Siap Saji",
    description: "Akses penuh ke seluruh menu Penjualan Siap Saji",
    color: "#B10FBD",
    bgColor: "#fcf4fd",
    initials: "SS",
    firstPage: "/siap-saji/dashboard",
    allowedHrefs: [
      "/siap-saji/dashboard",
      "/siap-saji/orders",
      "/siap-saji/documents",
      "/siap-saji/analytics/products",
      "/siap-saji/analytics/customers",
      "/siap-saji/finance",
      "/siap-saji/shipping",
      "/siap-saji/customers",
      "/siap-saji/products",
      "/siap-saji/master-data",
    ],
  },
];

export const DEFAULT_ROLE: RoleKey = "super_admin";

export function getRoleConfig(key: RoleKey): RoleConfig {
  return ROLES.find((r) => r.key === key) ?? ROLES[0];
}
