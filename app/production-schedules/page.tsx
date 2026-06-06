"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, AlertTriangle, FileText, Download, ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, FormRow, FormField } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { fmt, statusBadgeColor } from "@/lib/utils";
import { exportToExcel } from "@/lib/export";

const STATUSES = ["Draft", "Approved", "Overbudget Warning"];

export default function ProductionSchedulesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<any[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [fStatus, setFStatus] = useState("");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");

  const [form, setForm] = useState({ chef_id: "", target_date: new Date().toISOString().split("T")[0], order_ids: [] as string[] });

  const buildQs = useCallback((page = 1, lim = meta.limit) => {
    const p = new URLSearchParams({ page: String(page), limit: String(lim) });
    if (fStatus) p.set("status", fStatus);
    if (fDateFrom) p.set("date_from", fDateFrom);
    if (fDateTo) p.set("date_to", fDateTo);
    return p.toString();
  }, [fStatus, fDateFrom, fDateTo]);

  const fetchScheds = useCallback((page = 1, lim = meta.limit) => {
    setLoading(true);
    fetch(`/api/production-schedules?${buildQs(page, lim)}`)
      .then(r => r.json())
      .then(d => { setRows(d.data || []); setMeta({ total: d.total, page: d.page, limit: d.limit, totalPages: d.totalPages }); })
      .finally(() => setLoading(false));
  }, [buildQs, meta.limit]);

  useEffect(() => { fetchScheds(1, meta.limit); }, [fetchScheds]);

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(setUsers);
    fetch("/api/orders?status_order=Baru&limit=50").then(r => r.json()).then(d => setUnassignedOrders(d.data || []));
  }, []);

  const handleSave = async () => {
    if (!form.chef_id || !form.target_date) return alert("Pilih Chef dan Tanggal");
    const res = await fetch("/api/production-schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setShowModal(false); setForm({ chef_id: "", target_date: new Date().toISOString().split("T")[0], order_ids: [] }); fetchScheds(1); }
  };

  const generatePR = async (id: number) => {
    const res = await fetch(`/api/production-schedules/${id}/generate-pr`, { method: "POST" });
    if (res.ok) { alert("PR Berhasil digenerate!"); fetchScheds(meta.page); }
    else alert("Gagal generate PR (mungkin PR sudah ada atau status draft/overbudget)");
  };

  const handleExport = async () => {
    const p = new URLSearchParams({ page: "1", limit: "1000" });
    if (fStatus) p.set("status", fStatus);
    if (fDateFrom) p.set("date_from", fDateFrom);
    if (fDateTo) p.set("date_to", fDateTo);
    const res = await fetch(`/api/production-schedules?${p}`);
    const d = await res.json();
    exportToExcel(d.data || [], "Data_Schedules");
  };

  return (
    <div>
      <PageHeader title="Jadwal Produksi & Budget" subtitle={`${meta.total} jadwal produksi terdaftar`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={14} /> Export Excel</button>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Buat Jadwal Menu</button>
          </div>
        }
      />

      <div className="erp-card" style={{ marginBottom: 12, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <SearchableSelect 
            value={fStatus} onChange={setFStatus} 
            options={[{ value: "", label: "Semua Status" }, ...STATUSES.map(s => ({ value: s, label: s }))]} 
            style={{ width: 180 }} 
          />
          <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} style={{ width: 140 }} title="Dari tanggal" />
          <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} style={{ width: 140 }} title="Sampai tanggal" />
          <button className="btn btn-secondary btn-sm" onClick={() => { setFStatus(""); setFDateFrom(""); setFDateTo(""); }}>Reset</button>
        </div>
      </div>

      <div className="erp-card-flush">
        {loading ? <p style={{ padding: 24, color: "#6b7280", fontSize: 13 }}>Memuat...</p> : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr><th>No.</th><th>Tgl Produksi</th><th>Chef PIC</th><th>Jml Order</th><th>Budget BPP (Max)</th><th>HPP Aktual (Estimasi)</th><th>Variance</th><th>Status</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>Tidak ada jadwal</td></tr>
                  ) : rows.map((r: any, idx: number) => {
                    const variance = Number(r.budget_limit) - Number(r.total_estimated_hpp);
                    const isOver = variance < 0;
                    return (
                      <tr key={r.id}>
                        <td style={{ fontSize: 12, color: "#6b7280" }}>{(meta.page - 1) * meta.limit + idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{String(r.target_date).slice(0, 10)}</td>
                        <td>{r.chef_name}</td>
                        <td style={{ textAlign: "center" }}><Badge color="blue">{r.order_count} Orders</Badge></td>
                        <td style={{ fontWeight: 600 }}>{fmt(r.budget_limit)}</td>
                        <td style={{ fontWeight: 600, color: r.total_estimated_hpp > 0 ? (isOver ? "#E24B4A" : "#5005A6") : "#6b7280" }}>{fmt(r.total_estimated_hpp)}</td>
                        <td style={{ fontWeight: 700, color: isOver ? "#E24B4A" : "#5005A6" }}>{isOver ? "" : "+"}{fmt(variance)}</td>
                        <td><Badge color={statusBadgeColor(r.status)}>{r.status}</Badge></td>
                        <td>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <Link href={`/production-schedules/${r.id}`}>
                              <button className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <ClipboardList size={11} /> Kelola Menu
                              </button>
                            </Link>
                            {r.status === "Approved" && (
                              <button className="btn btn-primary btn-sm" onClick={() => generatePR(r.id)}><FileText size={11}/> Generate PR</button>
                            )}
                            {r.status === "Overbudget Warning" && (
                              <span style={{ fontSize: 11, color: "#E24B4A", display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={11}/> Overbudget</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination 
              page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} 
              onChange={(p) => fetchScheds(p, meta.limit)} 
              onLimitChange={(lim) => fetchScheds(1, lim)}
            />
          </>
        )}
      </div>

      <Modal show={showModal} onClose={() => setShowModal(false)} title="Buat Jadwal Produksi Baru">
        <FormRow>
          <FormField label="Chef Penanggung Jawab">
            <SearchableSelect 
              value={form.chef_id} onChange={v => setForm(f => ({ ...f, chef_id: v }))}
              options={[
                { value: "", label: "-- Pilih Chef --" },
                ...users.filter((u: any) => u.role === "Kitchen").map((u: any) => ({ value: u.id, label: u.name }))
              ]}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
          <FormField label="Tanggal Produksi">
            <input type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} />
          </FormField>
        </FormRow>

        <FormField label="Pilih Order yang akan diproduksi" style={{ marginBottom: 14 }}>
          <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, background: "#f9fafb" }}>
            {unassignedOrders.length === 0 ? <p style={{ fontSize: 12, color: "#6b7280" }}>Semua order (Baru) sudah dijadwalkan.</p> : unassignedOrders.map((o: any) => (
              <label key={o.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px", borderBottom: "1px solid #e5e7eb" }}>
                <input type="checkbox" checked={form.order_ids.includes(o.id)}
                  onChange={e => setForm(f => ({ ...f, order_ids: e.target.checked ? [...f.order_ids, o.id] : f.order_ids.filter(id => id !== o.id) }))}
                />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>ORD-{o.id} ({o.customer_name})</span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>Kirim: {String(o.delivery_date).slice(0,10)} | Rev: {fmt(o.grand_total)}</span>
                </div>
              </label>
            ))}
          </div>
        </FormField>
        
        <div className="alert-info" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#185FA5" }}>Catatan Sistem Cost Control</p>
          <p style={{ fontSize: 11, color: "#185FA5" }}>Budget Limit BPP dikunci maksimal 50% dari total Revenue order terpilih. Chef dapat mengisi menu masakan di detail jadwal nantinya.</p>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
          <button className="btn btn-primary" onClick={handleSave}>Simpan & Kunci Budget</button>
        </div>
      </Modal>
    </div>
  );
}
