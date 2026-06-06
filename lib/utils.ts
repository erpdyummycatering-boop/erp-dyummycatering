// Shared type definitions for the ERP system

export type BadgeColor = "green" | "red" | "yellow" | "blue" | "gray" | "purple" | "teal";

export const fmt = (n: number | string) =>
  "Rp " + Number(n).toLocaleString("id-ID");

export const fmtShort = (n: number) => {
  if (n >= 1_000_000_000) return "Rp " + (n / 1_000_000_000).toFixed(1) + "M";
  if (n >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1) + " Jt";
  if (n >= 1_000) return "Rp " + (n / 1_000).toFixed(0) + "rb";
  return fmt(n);
};

export const pct = (a: number, b: number) =>
  b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "0%";

export const statusBadgeColor = (s: string): BadgeColor => {
  const map: Record<string, BadgeColor> = {
    Closing: "green", Approved: "green", Lunas: "green", Aktif: "green",
    Safe: "green", "Selesai Belanja": "green", Selesai: "green", Sehat: "green",
    "Overbudget Warning": "red", Overbudget: "red", "Belum Lunas": "red",
    Reject: "red", "Perlu Perhatian": "red",
    "Follow Up": "yellow", Negosiasi: "yellow", "DP 50%": "yellow",
    Draft: "yellow", OK: "yellow", Diproses: "yellow",
    Konfirmasi: "blue", Baru: "blue", "Sent to Purchasing": "blue", Repeat: "teal",
    Prospek: "purple",
  };
  return map[s] || "gray";
};

export const roleColor = (role: string): BadgeColor => {
  const map: Record<string, BadgeColor> = {
    "Super Admin": "purple",
    "CS / Sales": "blue",
    Kitchen: "teal",
    Finance: "yellow",
    Purchasing: "gray",
    Owner: "green",
  };
  return map[role] || "gray";
};
