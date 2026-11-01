"use client";

import { useState } from "react";
import { KledoStatusBadge } from "@/components/kledo/KledoStatusBadge";

export function KledoOrderPanel({
  order,
  canManage,
  onDone,
}: {
  order: any;
  canManage: boolean;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState("");
  const [transDate, setTransDate] = useState("delivery");
  if (!order) return null;
  const badge = order.kledo_config_environment === "production" ? "LIVE" : order.kledo_config_environment ? "DEMO" : null;
  const soUrl = order.kledo_so_id ? `https://app.kledo.com/#/sales/orders/detail/${order.kledo_so_id}` : "";
  const invUrl = order.kledo_invoice_id ? `https://app.kledo.com/#/sales/invoices/detail/${order.kledo_invoice_id}` : "";

  const run = async (path: string, body?: unknown) => {
    setBusy(path);
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert(data.error || "Gagal mengirim ke antrian Kledo");
      else alert("Permintaan masuk antrian Kledo.");
      onDone();
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="erp-card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#374151" }}>Kledo</h2>
        {badge && (
          <span style={{ background: badge === "LIVE" ? "#E24B4A" : "#BA7517", color: "white", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{badge}</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", fontSize: 14 }}>
        <KledoStatusBadge order={order} />
        {soUrl && <a href={soUrl} target="_blank" rel="noreferrer" style={{ color: "#378ADD" }}>{order.kledo_so_number || `SO ${order.kledo_so_id}`}</a>}
        {invUrl && <a href={invUrl} target="_blank" rel="noreferrer" style={{ color: "#639922" }}>{order.kledo_invoice_number || `INV ${order.kledo_invoice_id}`}</a>}
        {order.kledo_sync_error && <span style={{ color: "#A32D2D" }}>{order.kledo_sync_error}</span>}
      </div>
      {order.kledo_invoice_id && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#854F0B" }}>
          Invoice sudah terbit. Perubahan harga, item, ongkir, tanggal, atau customer tidak dikirim otomatis ke Kledo.
        </p>
      )}
      {canManage && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => run(`/api/integrations/kledo/orders/${order.id}/sync`)}>
            {busy.includes("sync") ? "..." : "Sync ulang"}
          </button>
          {!order.kledo_invoice_id && (
            <>
              <select value={transDate} onChange={(e) => setTransDate(e.target.value)} style={{ height: 32 }}>
                <option value="delivery">Invoice tanggal kirim</option>
                <option value="today">Invoice hari ini</option>
              </select>
              <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => run(`/api/integrations/kledo/orders/${order.id}/invoice`, { trans_date: transDate })}>
                Buat Invoice
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
