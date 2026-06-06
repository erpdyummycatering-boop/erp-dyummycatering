"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Plus, Edit2, Trash2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PageHeader, FormRow, FormField } from "@/components/ui/PageHeader";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { fmt } from "@/lib/utils";

const C = { primary: "#5005A6", danger: "#E24B4A", warning: "#BA7517", success: "#639922" };

const KPI_OPTIONS = [
  { value: "Revenue",      label: "Revenue (Omset)",       satuan: "Rp" },
  { value: "Order Count",  label: "Jumlah Order",          satuan: "order" },
  { value: "Lead Masuk",   label: "Lead Masuk",            satuan: "lead" },
  { value: "Closing Rate", label: "Closing Rate",          satuan: "%" },
  { value: "Gross Margin", label: "Gross Margin",          satuan: "%" },
  { value: "BPP %",        label: "BPP % dari Revenue",    satuan: "%" },
];

// Generate month options (12 bulan ke belakang)
function genPeriodeOptions() {
  const months = ["Januari","Februari","Maret","April","Mei","Juni",
                  "Juli","Agustus","September","Oktober","November","Desember"];
  const now = new Date();
  const opts = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push(`${months[d.getMonth()]} ${d.getFullYear()}`);
  }
  return opts;
}
const PERIODE_OPTIONS = genPeriodeOptions();

// ── Gauge SVG ────────────────────────────────────────────────────────────────
function GaugeChart({ value, max = 100, label }: { value: number; max?: number; label: string }) {
  const pct = Math.min(max > 0 ? (value / max) * 100 : 0, 100);
  const radius = 45;
  const circ = 2 * Math.PI * radius;
  const arc = circ * 0.75;
  const offset = arc - (pct / 100) * arc;
  const gaugeColor = pct >= 100 ? C.primary : pct >= 80 ? C.success : pct >= 50 ? C.warning : C.danger;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={120} height={90} viewBox="0 0 110 82">
        <path d="M 10 78 A 45 45 0 1 1 100 78" fill="none" stroke="#f3f4f6" strokeWidth="10" strokeLinecap="round" />
        <path d="M 10 78 A 45 45 0 1 1 100 78" fill="none" stroke={gaugeColor} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={arc} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.5s ease" }} />
        <text x="55" y="68" textAnchor="middle" fontSize="15" fontWeight="700" fill={gaugeColor} fontFamily="inherit">
          {pct.toFixed(0)}%
        </text>
      </svg>
      <p style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "center" }}>{label}</p>
    </div>
  );
}

const EMPTY_FORM = {
  periode: PERIODE_OPTIONS[0],
  jenis: "Revenue",
  target: "",
  satuan: "Rp",
};

export default function TargetsPage() {
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchTargets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/targets");
      const data = await res.json();
      setTargets(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  // Auto-fill satuan when jenis changes
  const handleJenisChange = (v: string) => {
    const kpi = KPI_OPTIONS.find(k => k.value === v);
    setForm(f => ({ ...f, jenis: v, satuan: kpi?.satuan || "Rp" }));
  };

  const openAdd = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (t: any) => {
    setEditItem(t);
    setForm({ periode: t.periode, jenis: t.jenis, target: String(t.target), satuan: t.satuan });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.target || isNaN(Number(form.target))) return alert("Isi angka target yang valid");
    setSaving(true);
    const url = editItem ? `/api/targets/${editItem.id}` : "/api/targets";
    const method = editItem ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowModal(false);
      fetchTargets(true);
    } else {
      const err = await res.json();
      alert(err.error || "Gagal menyimpan target");
    }
    setSaving(false);
  };



  const executeDelete = async () => {
    if (!itemToDelete) return;
    await fetch(`/api/targets/${itemToDelete.id}`, { method: "DELETE" });
    setItemToDelete(null);
    fetchTargets(true);
  };

  const fmtVal = (t: any, v: number) =>
    t.satuan === "Rp" ? fmt(v) : `${v}${t.satuan}`;

  const chartData = targets.map((t) => ({
    name: t.jenis,
    Target: Number(t.target),
    Realisasi: Number(t.realisasi),
    pct: t.target > 0 ? ((Number(t.realisasi) / Number(t.target)) * 100).toFixed(1) : "0",
  }));

  if (loading) return <p style={{ padding: 32, color: "#6b7280" }}>Memuat data target...</p>;

  return (
    <div>
      <PageHeader
        title="Target & Realisasi"
        subtitle="Atur target KPI — capaian otomatis dihitung dari data omset & leads"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fetchTargets(true)}
              disabled={refreshing}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
              {refreshing ? "Memuat..." : "Refresh Data"}
            </button>
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={14} /> Tambah Target
            </button>
          </div>
        }
      />

      {/* Info banner */}
      <div style={{ marginBottom: 16, padding: "10px 16px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, fontSize: 13, color: "#1e40af", display: "flex", alignItems: "center", gap: 8 }}>
        <span>ℹ️</span>
        <span>
          <strong>Capaian dihitung otomatis</strong> dari data real: omset order, jumlah lead, closing rate, dan margin aktual — bukan diinput manual.
        </span>
      </div>

      {targets.length === 0 ? (
        <div className="erp-card" style={{ padding: "48px 24px", textAlign: "center", color: "#6b7280" }}>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Belum ada target yang ditetapkan</p>
          <p style={{ fontSize: 13 }}>Klik "Tambah Target" untuk mulai menetapkan KPI bulan ini</p>
          <button className="btn btn-primary" onClick={openAdd} style={{ marginTop: 16 }}><Plus size={14} /> Tambah Target Pertama</button>
        </div>
      ) : (
        <>
          {/* Gauge Scorecard */}
          <div className="erp-card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700 }}>Scorecard Capaian — Gauge Persentase</p>
              <span style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6", padding: "3px 10px", borderRadius: 20 }}>
                Real-time dari database
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 16 }}>
              {targets.map((t) => (
                <div key={t.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 8px", border: "0.5px solid #f3f4f6", borderRadius: 10, background: "#fafafa" }}>
                  <GaugeChart value={Number(t.realisasi)} max={Number(t.target)} label={t.jenis} />
                  <div style={{ marginTop: 4, textAlign: "center" }}>
                    <p style={{ fontSize: 11, color: "#6b7280" }}>Real: <b style={{ color: "#1a1a1a" }}>{fmtVal(t, Number(t.realisasi))}</b></p>
                    <p style={{ fontSize: 11, color: "#6b7280" }}>Target: <b style={{ color: "#1a1a1a" }}>{fmtVal(t, Number(t.target))}</b></p>
                    <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{t.periode}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts */}
          {targets.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div className="erp-card">
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Chart Target vs Realisasi</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Target" fill="#e5e7eb" name="Target" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Realisasi" fill={C.primary} name="Realisasi" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="erp-card">
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Persentase Capaian (%)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} layout="vertical" barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis type="number" domain={[0, 130]} tickFormatter={(v) => v + "%"} tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip formatter={(v: any) => v + "%"} />
                    <Bar dataKey="pct" name="Capaian %" radius={[0, 4, 4, 0]} fill={C.primary}
                      label={{ position: "right", fontSize: 10, formatter: (v: any) => v + "%", fill: "#6b7280" }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* CRUD Table */}
          <div className="erp-card-flush">
            <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 13, fontWeight: 700 }}>Tabel Target KPI</p>
              <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={12} /> Tambah</button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Periode</th>
                    <th>KPI</th>
                    <th>Target</th>
                    <th style={{ color: "#5005A6" }}>Capaian Real ↗</th>
                    <th>%</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((t) => {
                    const target = Number(t.target);
                    const real = Number(t.realisasi);
                    const pct = target > 0 ? (real / target) * 100 : 0;
                    const statusLabel = pct >= 100 ? "Tercapai" : pct >= 80 ? "Hampir" : pct >= 50 ? "On Track" : "Di Bawah";
                    const statusColor = pct >= 100 ? "green" : pct >= 80 ? "teal" : pct >= 50 ? "yellow" : "red";
                    const barColor = pct >= 100 ? C.primary : pct >= 80 ? C.success : pct >= 50 ? C.warning : C.danger;
                    return (
                      <tr key={t.id}>
                        <td style={{ fontSize: 12, color: "#6b7280" }}>{t.periode}</td>
                        <td style={{ fontWeight: 600 }}>{t.jenis}</td>
                        <td style={{ fontWeight: 600 }}>{fmtVal(t, target)}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: C.primary }}>{fmtVal(t, real)}</span>
                          <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 4 }}>otomatis</span>
                        </td>
                        <td style={{ fontWeight: 700, color: barColor }}>{pct.toFixed(1)}%</td>
                        <td style={{ minWidth: 100 }}>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: Math.min(pct, 100) + "%", background: barColor }} />
                          </div>
                        </td>
                        <td><Badge color={statusColor as any}>{statusLabel}</Badge></td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(t)}><Edit2 size={11} /></button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setItemToDelete(t)} title="Hapus"><Trash2 size={11} color="#E24B4A" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal — hanya isi target, TIDAK ada field realisasi */}
      <Modal show={showModal} onClose={() => setShowModal(false)} title={editItem ? "Edit Target KPI" : "Tambah Target KPI"}>
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "#f0fdf4", borderRadius: 8, fontSize: 12, color: "#166534" }}>
          ✓ Capaian akan dihitung otomatis dari data omset & leads — tidak perlu diinput manual
        </div>
        <FormRow>
          <FormField label="Periode">
            <SearchableSelect
              value={form.periode}
              onChange={v => setForm(f => ({ ...f, periode: v }))}
              options={PERIODE_OPTIONS.map(p => ({ value: p, label: p }))}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
          <FormField label="Jenis KPI">
            <SearchableSelect
              value={form.jenis}
              onChange={handleJenisChange}
              options={KPI_OPTIONS.map(k => ({ value: k.value, label: k.label }))}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label={`Target (${form.satuan})`}>
            <input
              type="number"
              value={form.target}
              onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
              placeholder={form.satuan === "Rp" ? "60000000" : form.satuan === "%" ? "40" : "25"}
            />
          </FormField>
          <FormField label="Satuan">
            <SearchableSelect
              value={form.satuan}
              onChange={v => setForm(f => ({ ...f, satuan: v }))}
              options={[
                { value: "Rp", label: "Rp (Rupiah)" },
                { value: "%", label: "% (Persen)" },
                { value: "order", label: "order" },
                { value: "lead", label: "lead" },
              ]}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
        </FormRow>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Menyimpan..." : editItem ? "Update Target" : "Simpan Target"}
          </button>
        </div>
      </Modal>

      <ConfirmModal
        show={!!itemToDelete}
        title="Hapus Target KPI"
        message={`Yakin ingin menghapus target ${itemToDelete?.jenis} periode ${itemToDelete?.periode}? Data yang dihapus tidak dapat dikembalikan.`}
        onConfirm={executeDelete}
        onCancel={() => setItemToDelete(null)}
      />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
