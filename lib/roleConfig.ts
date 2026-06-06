// ─── Role Configuration ───────────────────────────────────────────────────────

export type RoleKey =
  | "super_admin"
  | "owner"
  | "cs_sales"
  | "chef"
  | "purchasing"
  | "finance";

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
    firstPage: "/dashboard",
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
    ],
  },
];

export const DEFAULT_ROLE: RoleKey = "super_admin";

export function getRoleConfig(key: RoleKey): RoleConfig {
  return ROLES.find((r) => r.key === key) ?? ROLES[0];
}
