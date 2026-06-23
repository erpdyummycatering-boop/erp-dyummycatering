"use client";
import { useEffect, useState, useCallback } from "react";
import { Download, CheckCircle, ShoppingCart, FileText, Printer } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { fmt, statusBadgeColor } from "@/lib/utils";
import { exportToExcel } from "@/lib/export";
import { Badge } from "@/components/ui/Badge";

const STATUS_PO = ["Diproses", "Selesai Belanja"];
const STATUS_COST = ["Pending", "Safe", "Overbudget"];

export default function PurchasingPage() {
  const [activeTab, setActiveTab] = useState<"pr" | "po">("pr");

  // ---- PR State ----
  const [prRows, setPrRows] = useState<any[]>([]);
  const [prMeta, setPrMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [prLoading, setPrLoading] = useState(true);
  const [fPrStatus, setFPrStatus] = useState("Sent to Purchasing");

  // ---- PO State ----
  const [poRows, setPoRows] = useState<any[]>([]);
  const [poMeta, setPoMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [poLoading, setPoLoading] = useState(true);
  const [fStatusPO, setFStatusPO] = useState("");
  const [fStatusCost, setFStatusCost] = useState("");

  // ---- Realisasi Modal (Finance input actual cost) ----
  const [showRealisasiModal, setShowRealisasiModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [realisasiForm, setRealisasiForm] = useState({ total_actual_cost: "", variance_notes: "", status_po: "Selesai Belanja" });
  const [submitting, setSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void; } | null>(null);

  // ---- Fetch PR ----
  const buildPrQs = useCallback((page = 1, lim = prMeta.limit) => {
    const p = new URLSearchParams({ page: String(page), limit: String(lim) });
    if (fPrStatus) p.set("status", fPrStatus);
    return p.toString();
  }, [fPrStatus, prMeta.limit]);

  const fetchPRs = useCallback((page = 1, lim = prMeta.limit) => {
    setPrLoading(true);
    fetch(`/api/purchase-requests?${buildPrQs(page, lim)}`)
      .then(r => r.json())
      .then(d => { setPrRows(d.data || []); setPrMeta({ total: d.total, page: d.page, limit: d.limit, totalPages: d.totalPages }); })
      .finally(() => setPrLoading(false));
  }, [buildPrQs, prMeta.limit]);

  // ---- Fetch PO ----
  const buildPoQs = useCallback((page = 1, lim = poMeta.limit) => {
    const p = new URLSearchParams({ page: String(page), limit: String(lim) });
    if (fStatusPO) p.set("status_po", fStatusPO);
    if (fStatusCost) p.set("status_cost", fStatusCost);
    return p.toString();
  }, [fStatusPO, fStatusCost, poMeta.limit]);

  const fetchPOs = useCallback((page = 1, lim = poMeta.limit) => {
    setPoLoading(true);
    fetch(`/api/purchase-orders?${buildPoQs(page, lim)}`)
      .then(r => r.json())
      .then(d => { setPoRows(d.data || []); setPoMeta({ total: d.total, page: d.page, limit: d.limit, totalPages: d.totalPages }); })
      .finally(() => setPoLoading(false));
  }, [buildPoQs, poMeta.limit]);

  useEffect(() => { fetchPRs(1, prMeta.limit); }, [fetchPRs]);
  useEffect(() => { fetchPOs(1, poMeta.limit); }, [fetchPOs]);

  // ---- Purchasing: Proses PR → buat PO ----
  const handleProsesPR = async (prId: number) => {
    setConfirmAction({
      title: "Proses Purchase Request",
      message: "Proses PR ini dan buat Purchase Order?",
      onConfirm: async () => {
        setSubmitting(true);
        const res = await fetch(`/api/purchase-requests/${prId}/create-po`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ po_date: new Date().toISOString().split("T")[0] }),
        });
        if (res.ok) {
          alert("✅ PO berhasil dibuat! Beralih ke tab Purchase Orders.");
          fetchPRs(prMeta.page);
          fetchPOs(1);
          setActiveTab("po");
        } else {
          const e = await res.json();
          alert(e.error || "Gagal membuat PO");
        }
        setSubmitting(false);
        setConfirmAction(null);
      }
    });
  };

  // ---- Finance: Input Realisasi ----
  const openRealisasi = (po: any) => {
    setSelectedPO(po);
    setRealisasiForm({
      total_actual_cost: String(po.total_actual_cost > 0 ? po.total_actual_cost : ""),
      variance_notes: po.variance_notes || "",
      status_po: "Selesai Belanja",
    });
    setShowRealisasiModal(true);
  };

  const handleSaveRealisasi = async () => {
    if (!realisasiForm.total_actual_cost) return alert("Masukkan total aktual belanja");
    setSubmitting(true);
    const res = await fetch(`/api/purchase-orders/${selectedPO.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        total_actual_cost: Number(realisasiForm.total_actual_cost),
        variance_notes: realisasiForm.variance_notes,
        status_po: realisasiForm.status_po,
      }),
    });
    if (res.ok) {
      setShowRealisasiModal(false);
      fetchPOs(poMeta.page);
    } else {
      const e = await res.json();
      alert(e.error || "Gagal menyimpan realisasi");
    }
    setSubmitting(false);
  };

  // ---- Export ----
  const handleExportPR = async () => {
    const res = await fetch(`/api/purchase-requests?page=1&limit=1000${fPrStatus ? `&status=${fPrStatus}` : ""}`);
    const d = await res.json();
    exportToExcel(d.data || [], "Data_PurchaseRequests");
  };
  const handleExportPO = async () => {
    const p = new URLSearchParams({ page: "1", limit: "1000" });
    if (fStatusPO) p.set("status_po", fStatusPO);
    if (fStatusCost) p.set("status_cost", fStatusCost);
    const res = await fetch(`/api/purchase-orders?${p}`);
    const d = await res.json();
    exportToExcel(d.data || [], "Data_PurchaseOrders");
  };

  const tabStyle = (t: string) => ({
    padding: "10px 20px", border: "none", background: "none", cursor: "pointer",
    fontWeight: 600, fontSize: 15,
    borderBottom: activeTab === t ? "2px solid #5005A6" : "2px solid transparent",
    color: activeTab === t ? "#5005A6" : "#6b7280",
    marginBottom: -2,
  } as React.CSSProperties);

  return (
    <div>
      <PageHeader
        title="Purchasing & Cost Control"
        subtitle={`${prMeta.total} PR · ${poMeta.total} PO terdaftar`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={activeTab === "pr" ? handleExportPR : handleExportPO}>
              <Download size={14} /> Export Excel
            </button>
          </div>
        }
      />

      {/* ---- Tabs ---- */}
      <div style={{ display: "flex", borderBottom: "2px solid #e5e7eb", marginBottom: 16 }}>
        <button style={tabStyle("pr")} onClick={() => setActiveTab("pr")}>
          <FileText size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Purchase Requests ({prMeta.total})
        </button>
        <button style={tabStyle("po")} onClick={() => setActiveTab("po")}>
          <ShoppingCart size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Purchase Orders ({poMeta.total})
        </button>
      </div>

      {/* ==================== TAB: PURCHASE REQUESTS ==================== */}
      {activeTab === "pr" && (
        <>
          <div className="erp-card" style={{ marginBottom: 12, padding: "12px 16px" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <SearchableSelect
                value={fPrStatus} onChange={setFPrStatus}
                options={[
                  { value: "", label: "Semua Status PR" },
                  { value: "Sent to Purchasing", label: "Sent to Purchasing" },
                  { value: "Diproses", label: "Diproses" },
                  { value: "Draft", label: "Draft" },
                ]}
                style={{ width: 200 }}
              />
              <button className="btn btn-secondary btn-sm" onClick={() => setFPrStatus("Sent to Purchasing")}>Reset</button>
            </div>
          </div>

          <div className="erp-card-flush">
            {prLoading ? <p style={{ padding: 24, color: "#6b7280", fontSize: 15 }}>Memuat...</p> : (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>PR No</th>
                        <th>Tgl Produksi</th>
                        <th>Chef PIC</th>
                        <th style={{ textAlign: "right" }}>Total PR</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prRows.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>Tidak ada Purchase Request</td></tr>
                      ) : prRows.map((r: any, idx: number) => (
                        <tr key={r.id}>
                          <td style={{ fontSize: 14, color: "#6b7280" }}>{(prMeta.page - 1) * prMeta.limit + idx + 1}</td>
                          <td style={{ fontWeight: 700, fontSize: 14, color: "#5005A6" }}>PR-{String(r.id).padStart(4, "0")}</td>
                          <td style={{ fontSize: 14 }}>{String(r.target_date || "").slice(0, 10)}</td>
                          <td style={{ fontSize: 14 }}>{r.chef_name || "-"}</td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(r.total_pr_value)}</td>
                          <td><Badge color={statusBadgeColor(r.status)}>{r.status}</Badge></td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {r.status === "Sent to Purchasing" && !r.has_po && (
                                <button className="btn btn-primary btn-sm" disabled={submitting}
                                  onClick={() => handleProsesPR(r.id)}
                                  style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <CheckCircle size={11} /> Proses Belanja
                                </button>
                              )}
                              {r.has_po && (
                                <span style={{ fontSize: 15, color: "#5005A6", fontWeight: 600 }}>✓ PO Dibuat</span>
                              )}
                              <a href={`/print/pr/${r.id}`} target="_blank" rel="noreferrer">
                                <button className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <Printer size={11} /> Print
                                </button>
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={prMeta.page} totalPages={prMeta.totalPages} total={prMeta.total} limit={prMeta.limit}
                  onChange={(p) => fetchPRs(p, prMeta.limit)}
                  onLimitChange={(lim) => fetchPRs(1, lim)}
                />
              </>
            )}
          </div>
        </>
      )}

      {/* ==================== TAB: PURCHASE ORDERS ==================== */}
      {activeTab === "po" && (
        <>
          <div className="erp-card" style={{ marginBottom: 12, padding: "12px 16px" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <SearchableSelect
                value={fStatusPO} onChange={setFStatusPO}
                options={[{ value: "", label: "Semua Status PO" }, ...STATUS_PO.map(s => ({ value: s, label: s }))]}
                style={{ width: 180 }}
              />
              <SearchableSelect
                value={fStatusCost} onChange={setFStatusCost}
                options={[{ value: "", label: "Semua Status Biaya" }, ...STATUS_COST.map(s => ({ value: s, label: s }))]}
                style={{ width: 180 }}
              />
              <button className="btn btn-secondary btn-sm" onClick={() => { setFStatusPO(""); setFStatusCost(""); }}>Reset</button>
            </div>
          </div>

          <div className="erp-card-flush">
            {poLoading ? <p style={{ padding: 24, color: "#6b7280", fontSize: 15 }}>Memuat...</p> : (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>PO No</th>
                        <th>Tgl PO</th>
                        <th>Untuk Prod.</th>
                        <th style={{ textAlign: "right" }}>Estimasi (PR)</th>
                        <th style={{ textAlign: "right" }}>Aktual Belanja</th>
                        <th style={{ textAlign: "right" }}>Variance</th>
                        <th>Cost Status</th>
                        <th>Status Belanja</th>
                        <th>Aksi (Finance)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poRows.length === 0 ? (
                        <tr><td colSpan={10} style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>Tidak ada dokumen PO</td></tr>
                      ) : poRows.map((r: any, idx: number) => {
                        const variance = Number(r.estimated_cost) - Number(r.total_actual_cost);
                        const isOver = r.total_actual_cost > 0 && variance < 0;
                        return (
                          <tr key={r.id}>
                            <td style={{ fontSize: 14, color: "#6b7280" }}>{(poMeta.page - 1) * poMeta.limit + idx + 1}</td>
                            <td style={{ fontWeight: 700, fontSize: 14, color: "#378ADD" }}>PO-{String(r.id).padStart(4, "0")}</td>
                            <td style={{ fontSize: 14 }}>{String(r.po_date).slice(0, 10)}</td>
                            <td style={{ fontSize: 14, color: "#6b7280" }}>{String(r.target_date || "").slice(0, 10)}</td>
                            <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(r.estimated_cost)}</td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: r.total_actual_cost > 0 ? (isOver ? "#E24B4A" : "#5005A6") : "#6b7280" }}>
                              {r.total_actual_cost > 0 ? fmt(r.total_actual_cost) : "-"}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: isOver ? "#E24B4A" : "#5005A6" }}>
                              {r.total_actual_cost > 0 ? (isOver ? "" : "+") + fmt(variance) : "-"}
                            </td>
                            <td><Badge color={statusBadgeColor(r.status_cost)}>{r.status_cost}</Badge></td>
                            <td><Badge color={statusBadgeColor(r.status_po)}>{r.status_po}</Badge></td>
                            <td>
                              {r.status_po !== "Selesai Belanja" ? (
                                <button className="btn btn-primary btn-sm" onClick={() => openRealisasi(r)}
                                  style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <CheckCircle size={11} /> Input Realisasi
                                </button>
                              ) : (
                                <button className="btn btn-secondary btn-sm" onClick={() => openRealisasi(r)}
                                  style={{ display: "flex", alignItems: "center", gap: 4, opacity: 0.7 }}>
                                  ✏️ Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={poMeta.page} totalPages={poMeta.totalPages} total={poMeta.total} limit={poMeta.limit}
                  onChange={(p) => fetchPOs(p, poMeta.limit)}
                  onLimitChange={(lim) => fetchPOs(1, lim)}
                />
              </>
            )}
          </div>
        </>
      )}

      {/* ---- Modal: Input Realisasi Belanja (Finance) ---- */}
      <Modal show={showRealisasiModal} onClose={() => setShowRealisasiModal(false)} title={`Input Realisasi — PO-${String(selectedPO?.id || "").padStart(4, "0")}`}>
        {selectedPO && (
          <>
            <div className="alert-info" style={{ marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#185FA5" }}>
                Estimasi Chef: {fmt(selectedPO.estimated_cost)} &nbsp;·&nbsp; Tgl Produksi: {String(selectedPO.target_date || "").slice(0, 10)}
              </p>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Total Actual Belanja (Rp) — Sesuai Nota
              </label>
              <input type="number" min="0" step="1000"
                value={realisasiForm.total_actual_cost}
                onChange={e => setRealisasiForm(f => ({ ...f, total_actual_cost: e.target.value }))}
                placeholder="Masukkan total sesuai nota riil"
                style={{ width: "100%", fontWeight: 700, fontSize: 15 }}
              />
            </div>

            {/* Real-time variance preview */}
            {realisasiForm.total_actual_cost && (
              <div style={{
                background: Number(realisasiForm.total_actual_cost) > Number(selectedPO.estimated_cost) ? "#fef2f2" : "#f0fdf4",
                border: `1px solid ${Number(realisasiForm.total_actual_cost) > Number(selectedPO.estimated_cost) ? "#fecaca" : "#bbf7d0"}`,
                borderRadius: 8, padding: "10px 14px", marginBottom: 12
              }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: Number(realisasiForm.total_actual_cost) > Number(selectedPO.estimated_cost) ? "#E24B4A" : "#5005A6" }}>
                  {Number(realisasiForm.total_actual_cost) > Number(selectedPO.estimated_cost)
                    ? `⚠ OVERBUDGET: +${fmt(Number(realisasiForm.total_actual_cost) - Number(selectedPO.estimated_cost))} dari estimasi`
                    : `✓ Dalam batas: hemat ${fmt(Number(selectedPO.estimated_cost) - Number(realisasiForm.total_actual_cost))}`
                  }
                </p>
              </div>
            )}

            {/* Keterangan jika overbudget */}
            {Number(realisasiForm.total_actual_cost) > Number(selectedPO.estimated_cost) && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: "#E24B4A", display: "block", marginBottom: 6 }}>
                  ⚠ Wajib diisi: Keterangan/Alasan Selisih
                </label>
                <textarea rows={3}
                  value={realisasiForm.variance_notes}
                  onChange={e => setRealisasiForm(f => ({ ...f, variance_notes: e.target.value }))}
                  placeholder="Contoh: Harga daging sapi mendadak naik Rp 10.000/kg dari perkiraan awal"
                  style={{ width: "100%", resize: "vertical" }}
                />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Status Belanja</label>
              <SearchableSelect
                value={realisasiForm.status_po}
                onChange={v => setRealisasiForm(f => ({ ...f, status_po: v }))}
                options={STATUS_PO.map(s => ({ value: s, label: s }))}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setShowRealisasiModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSaveRealisasi} disabled={submitting}>
                {submitting ? "Menyimpan..." : "Simpan Realisasi"}
              </button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmModal
        show={!!confirmAction}
        title={confirmAction?.title || ""}
        message={confirmAction?.message || ""}
        danger={false}
        confirmLabel="Ya, Lanjutkan"
        onConfirm={() => confirmAction?.onConfirm()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
