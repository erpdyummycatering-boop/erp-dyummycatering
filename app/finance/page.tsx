"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Download } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, FormRow, FormField } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { fmt } from "@/lib/utils";
import { exportToExcel } from "@/lib/export";

const CATEGORIES = ["Gas", "Kemasan", "Listrik", "Transportasi", "Uang Makan", "Lainnya"];

export default function FinancePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);

  const [fCategory, setFCategory] = useState("");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");

  const [form, setForm] = useState({ finance_id: "", expense_date: new Date().toISOString().split("T")[0], category: "Kemasan", amount: 0, notes: "" });

  const buildQs = useCallback((page = 1, lim = meta.limit) => {
    const p = new URLSearchParams({ page: String(page), limit: String(lim) });
    if (fCategory) p.set("category", fCategory);
    if (fDateFrom) p.set("date_from", fDateFrom);
    if (fDateTo) p.set("date_to", fDateTo);
    return p.toString();
  }, [fCategory, fDateFrom, fDateTo]);

  const fetchOverheads = useCallback((page = 1, lim = meta.limit) => {
    setLoading(true);
    fetch(`/api/overheads?${buildQs(page, lim)}`)
      .then(r => r.json())
      .then(d => { setRows(d.data || []); setMeta({ total: d.total, page: d.page, limit: d.limit, totalPages: d.totalPages }); })
      .finally(() => setLoading(false));
  }, [buildQs, meta.limit]);

  useEffect(() => { fetchOverheads(1, meta.limit); }, [fetchOverheads]);
  useEffect(() => { fetch("/api/users").then(r => r.json()).then(setUsers); }, []);

  const totalOverhead = rows.reduce((s, o) => s + Number(o.amount || 0), 0);

  const handleSave = async () => {
    if (!form.finance_id || form.amount <= 0) return alert("Pilih Finance dan isi nominal valid");
    const res = await fetch("/api/overheads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setShowModal(false); setForm({ finance_id: "", expense_date: new Date().toISOString().split("T")[0], category: "Kemasan", amount: 0, notes: "" }); fetchOverheads(1); }
  };

  const handleExport = async () => {
    const p = new URLSearchParams({ page: "1", limit: "1000" });
    if (fCategory) p.set("category", fCategory);
    if (fDateFrom) p.set("date_from", fDateFrom);
    if (fDateTo) p.set("date_to", fDateTo);
    const res = await fetch(`/api/overheads?${p}`);
    const d = await res.json();
    exportToExcel(d.data || [], "Data_Finance_Overhead");
  };

  return (
    <div>
      <PageHeader title="Finance & Overhead" subtitle={`Total overhead (halaman ini): ${fmt(totalOverhead)}`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={14} /> Export Excel</button>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Catat Pengeluaran</button>
          </div>
        }
      />

      <div className="erp-card" style={{ marginBottom: 12, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <SearchableSelect 
            value={fCategory} onChange={setFCategory} 
            options={[{ value: "", label: "Semua Kategori" }, ...CATEGORIES.map(c => ({ value: c, label: c }))]} 
            style={{ width: 180 }} 
          />
          <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} style={{ width: 140 }} title="Dari tanggal" />
          <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} style={{ width: 140 }} title="Sampai tanggal" />
          <button className="btn btn-secondary btn-sm" onClick={() => { setFCategory(""); setFDateFrom(""); setFDateTo(""); }}>Reset</button>
        </div>
      </div>

      <div className="erp-card-flush">
        {loading ? <p style={{ padding: 24, color: "#6b7280", fontSize: 13 }}>Memuat...</p> : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr><th>No.</th><th>ID</th><th>Tanggal Pengeluaran</th><th>Kategori</th><th>Nominal</th><th>Catatan</th><th>PIC Finance</th></tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>Tidak ada pengeluaran overhead</td></tr>
                  ) : rows.map((r: any, idx: number) => (
                    <tr key={r.id}>
                      <td style={{ fontSize: 12, color: "#6b7280" }}>{(meta.page - 1) * meta.limit + idx + 1}</td>
                      <td style={{ fontSize: 12, color: "#6b7280" }}>OVH-{String(r.id).padStart(3, "0")}</td>
                      <td style={{ fontWeight: 600 }}>{String(r.expense_date).slice(0, 10)}</td>
                      <td><Badge color="blue">{r.category}</Badge></td>
                      <td style={{ fontWeight: 700, color: "#E24B4A" }}>{fmt(r.amount)}</td>
                      <td style={{ fontSize: 12, color: "#6b7280" }}>{r.notes || "-"}</td>
                      <td style={{ fontSize: 12 }}>{r.finance_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination 
              page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} 
              onChange={(p) => fetchOverheads(p, meta.limit)} 
              onLimitChange={(lim) => fetchOverheads(1, lim)}
            />
          </>
        )}
      </div>

      <Modal show={showModal} onClose={() => setShowModal(false)} title="Catat Pengeluaran Operasional (Overhead)">
        <FormRow>
          <FormField label="Kategori">
            <SearchableSelect 
              value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))}
              options={CATEGORIES.map(c => ({ value: c, label: c }))}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
          <FormField label="Tanggal">
            <input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="Nominal (Rp)">
            <input type="number" value={form.amount || ""} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} />
          </FormField>
          <FormField label="PIC Finance">
            <SearchableSelect 
              value={form.finance_id} onChange={v => setForm(f => ({ ...f, finance_id: v }))}
              options={[
                { value: "", label: "-- Pilih PIC --" },
                ...users.filter((u: any) => u.role === "Finance").map((u: any) => ({ value: u.id, label: u.name }))
              ]}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
        </FormRow>
        <FormField label="Catatan" style={{ marginBottom: 14 }}>
          <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </FormField>
        <div className="alert-info" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#185FA5" }}>Catatan Sistem</p>
          <p style={{ fontSize: 11, color: "#185FA5" }}>Pengeluaran ini akan langsung mengurangi Net Profit di dashboard P&L.</p>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
          <button className="btn btn-primary" onClick={handleSave}>Simpan Pengeluaran</button>
        </div>
      </Modal>
    </div>
  );
}
