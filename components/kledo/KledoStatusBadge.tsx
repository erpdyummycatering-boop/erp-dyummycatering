"use client";

import { Badge } from "@/components/ui/Badge";
import type { BadgeColor } from "@/lib/utils";

const LABEL: Record<string, { text: string; color: BadgeColor }> = {
  not_synced: { text: "Belum", color: "gray" },
  queued: { text: "Antrian", color: "yellow" },
  so_synced: { text: "SO", color: "blue" },
  invoiced: { text: "Invoice", color: "green" },
  failed: { text: "Gagal", color: "red" },
  blocked: { text: "Blocked", color: "yellow" },
  voided: { text: "Void", color: "gray" },
  skipped: { text: "Lewat", color: "gray" },
};

export function KledoStatusBadge({ order }: { order: { kledo_sync_status?: string | null; kledo_sync_error?: string | null; kledo_so_number?: string | null; kledo_invoice_number?: string | null } }) {
  if (!order || order.kledo_sync_status == null) {
    return <span style={{ color: "#9ca3af" }}>—</span>;
  }
  const meta = LABEL[order.kledo_sync_status] || { text: order.kledo_sync_status, color: "gray" as BadgeColor };
  const ref = order.kledo_sync_status === "invoiced" ? order.kledo_invoice_number : order.kledo_so_number;
  const text = ref && (order.kledo_sync_status === "so_synced" || order.kledo_sync_status === "invoiced" || order.kledo_sync_status === "voided")
    ? ref
    : meta.text;
  return (
    <span title={order.kledo_sync_error || order.kledo_sync_status}>
      <Badge color={meta.color}>{text}</Badge>
    </span>
  );
}
