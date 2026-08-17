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
    "Chef / Kitchen": "teal",
    Finance: "yellow",
    "Finance / Keuangan": "yellow",
    Purchasing: "gray",
    Owner: "green",
    HR: "green",
    HRD: "green",
    CS_SS: "teal",
    "CS Siap Saji": "teal",
    Keuangan_SS: "yellow",
    "Keuangan Siap Saji": "yellow",
    "Siap Saji": "purple",
  };
  return map[role] || "gray";
};

export const formatDate = (d: string | Date | null | undefined): string => {
  if (!d) return "-";
  try {
    const s = String(d).trim();
    if (!s) return "-";

    // If string is YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, day] = s.split("-");
      const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
      const mi = parseInt(m, 10) - 1;
      if (mi >= 0 && mi < 12) {
        return `${parseInt(day, 10)} ${months[mi]} ${y}`;
      }
    }

    const dateObj = new Date(s);
    if (isNaN(dateObj.getTime())) return s;

    return dateObj.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    });
  } catch {
    return String(d);
  }
};
