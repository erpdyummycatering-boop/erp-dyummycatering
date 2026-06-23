"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Plus, Edit2, Download, Upload, Trash2 } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { XlsxImportModal } from "@/components/ui/XlsxImportModal";
import { PageHeader, FormRow, FormField } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { exportToExcel } from "@/lib/export";
import { useRole } from "@/contexts/RoleContext";

const C = { primary: "#5005A6" };

const EMPTY_FORM = {
  name: "", phone: "", email: "", type: "Perorangan", address: "", notes: "",
  lead_date: new Date().toISOString().split("T")[0],
  source: "WhatsApp",
  status: "Prospek",
  tags: "",
};

const formatWaLink = (phone: string) => {
  if (!phone) return "";
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("0")) {
    clean = "62" + clean.slice(1);
  }
  return `https://wa.me/${clean}`;
};

const getStatusColor = (s: string) => {
  if (s === "Closing") return "green";
  if (s === "Reject") return "red";
  if (s === "Follow Up") return "blue";
  if (s === "Negosiasi") return "purple";
  if (s === "Konfirmasi") return "yellow";
  return "gray";
};

const WhatsAppIcon = ({ size = 16 }: { size?: number }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    fill="#25D366"
    style={{ display: "inline-block", flexShrink: 0 }}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);

export default function CustomersPage() {
  const { activeRole } = useRole();
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [casteFilter, setCasteFilter] = useState("");
  const [picFilter, setPicFilter] = useState("");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");
  const [csUsers, setCsUsers] = useState<any[]>([]);

  useEffect(() => {
    if (activeRole !== "cs_sales") {
      fetch("/api/users")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setCsUsers(data.filter((u: any) => u.role === "CS / Sales" && u.status === "Aktif"));
          }
        })
        .catch(console.error);
    }
  }, [activeRole]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);

  const buildQs = useCallback((page = 1, lim = meta.limit) => {
    const p = new URLSearchParams({ page: String(page), limit: String(lim) });
    if (search) p.set("search", search);
    if (typeFilter) p.set("type", typeFilter);
    if (casteFilter) p.set("caste", casteFilter);
    if (picFilter) p.set("pic_id", picFilter);
    if (fDateFrom) p.set("date_from", fDateFrom);
    if (fDateTo) p.set("date_to", fDateTo);
    return p.toString();
  }, [search, typeFilter, casteFilter, picFilter, fDateFrom, fDateTo, meta.limit]);

  const fetchCustomers = useCallback((page = 1, lim = meta.limit, signal?: AbortSignal) => {
    setLoading(true);
    fetch(`/api/customers?${buildQs(page, lim)}`, { signal })
      .then(r => r.json())
      .then(d => { setRows(d.data || []); setMeta({ total: d.total, page: d.page, limit: d.limit, totalPages: d.totalPages }); })
      .catch(e => { if (e.name !== "AbortError") console.error("Gagal memuat customer:", e); })
      .finally(() => setLoading(false));
  }, [buildQs, meta.limit]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCustomers(1, meta.limit, controller.signal);
    return () => controller.abort();
  }, [fetchCustomers]);

  const openAdd = () => { setEditItem(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (c: any) => {
    setEditItem(c);
    setForm({
      name: c.name,
      phone: c.phone || "",
      email: c.email || "",
      type: c.type || "Perorangan",
      address: c.address || "",
      notes: c.notes || "",
      lead_date: "",
      source: "",
      status: c.status || "Prospek",
      tags: ""
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return alert("Nama wajib diisi");
    const url = editItem ? `/api/customers/${editItem.id}` : "/api/customers";
    const method = editItem ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowModal(false);
        fetchCustomers(meta.page);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Gagal menyimpan customer.");
      }
    } catch (e) {
      alert("Terjadi kesalahan saat menyimpan data.");
    }
  };

  const updateStatus = async (customer: any, newStatus: string) => {
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...customer, status: newStatus }),
      });
      if (res.ok) {
        setRows(rows => rows.map(r => r.id === customer.id ? { ...r, status: newStatus } : r));
      } else {
        alert("Gagal mengupdate status");
      }
    } catch (e) {
      alert("Terjadi kesalahan saat mengupdate status.");
    }
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(`/api/customers/${itemToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setItemToDelete(null);
        fetchCustomers(meta.page);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Gagal menghapus customer.");
      }
    } catch (e) {
      alert("Terjadi kesalahan saat menghapus data.");
    }
  };



  const handleExport = async () => {
    const p = new URLSearchParams({ page: "1", limit: "1000" });
    if (search) p.set("search", search);
    if (typeFilter) p.set("type", typeFilter);
    if (casteFilter) p.set("caste", casteFilter);
    if (picFilter) p.set("pic_id", picFilter);
    if (fDateFrom) p.set("date_from", fDateFrom);
    if (fDateTo) p.set("date_to", fDateTo);
    const res = await fetch(`/api/customers?${p}`);
    const d = await res.json();
    exportToExcel(d.data || [], "Data_Customers");
  };

  return (
    <div>
      <PageHeader
        title="Data Kontak Customer"
        subtitle={`${meta.total} total kontak terdaftar`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={14} /> Export Excel</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}><Upload size={14} /> Import Excel</button>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Tambah Kontak</button>
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
        <StatCard label="Total Kontak" value={meta.total} icon={Users} color={C.primary} />
      </div>

      <div className="erp-card" style={{ marginBottom: 12, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="🔍 Cari nama, telepon, email..." style={{ width: 250 }} />
          <SearchableSelect 
            value={typeFilter} onChange={setTypeFilter} 
            options={[{ value: "", label: "Semua Tipe" }, ...["Perorangan", "Corporate", "Instansi"].map(t => ({ value: t, label: t }))]} 
            style={{ width: 160 }} 
          />
          <SearchableSelect
            value={casteFilter}
            onChange={setCasteFilter}
            options={[{ value: "", label: "Semua Kasta" }, { value: "Customer", label: "Customer (Pernah Order)" }, { value: "Lead", label: "Lead (Belum Order)" }]}
            placeholder="Semua Kasta"
            style={{ minWidth: 160, width: 220 }}
          />
          {activeRole !== "cs_sales" && csUsers.length > 0 && (
            <SearchableSelect
              value={picFilter}
              onChange={setPicFilter}
              options={[
                { value: "", label: "Semua CS" },
                ...csUsers.map((u) => ({ value: String(u.id), label: u.name }))
              ]}
              placeholder="Semua CS"
              style={{ minWidth: 160, width: 200 }}
            />
          )}
          <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} style={{ width: 140 }} title="Tanggal dari" />
          <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} style={{ width: 140 }} title="Tanggal sampai" />
          <button 
            onClick={() => { setSearchInput(""); setSearch(""); setTypeFilter(""); setCasteFilter(""); setPicFilter(""); setFDateFrom(""); setFDateTo(""); setMeta(m => ({ ...m, page: 1 })); }}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", backgroundColor: "white", fontSize: 15, fontWeight: 600, color: "#64748b", cursor: "pointer", whiteSpace: "nowrap" }}
          >Reset</button>
        </div>
      </div>

      <div className="erp-card-flush">
        {loading ? (
          <p style={{ padding: 24, color: "#6b7280", fontSize: 15 }}>Memuat...</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>No.</th><th>Tanggal</th><th>Nama</th><th>WhatsApp</th><th>Status Prospek</th><th>Total Order</th>
                    {activeRole !== "cs_sales" && <th>Dibuat Oleh</th>}
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={activeRole !== "cs_sales" ? 8 : 7} style={{ textAlign: "center", padding: "24px", color: "#6b7280" }}>Tidak ada data</td></tr>
                  ) : rows.map((c: any, idx: number) => (
                    <tr key={c.id}>
                      <td style={{ fontSize: 14, color: "#6b7280" }}>{(meta.page - 1) * meta.limit + idx + 1}</td>
                      <td style={{ fontSize: 14 }}>{c.created_at ? String(c.created_at).slice(0, 10) : "-"}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: C.primary + "20",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 15, fontWeight: 700, color: C.primary, flexShrink: 0,
                          }}>
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</p>
                            <p style={{ fontSize: 15, color: "#6b7280" }}>{c.address || "Alamat belum diisi"}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: 14 }}>
                        {c.phone ? (
                          <a
                            href={formatWaLink(c.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#378ADD", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
                          >
                            <WhatsAppIcon size={16} /> {c.phone}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        {(() => {
                          const hasOrders = (c.order_count || 0) > 0;
                          const status = hasOrders ? "Closing" : (c.status || "Prospek");
                          const color = getStatusColor(status);
                          let bg = "#f1f5f9", text = "#475569";
                          if (color === "green") { bg = "#dcfce7"; text = "#16a34a"; }
                          else if (color === "red") { bg = "#fee2e2"; text = "#dc2626"; }
                          else if (color === "blue") { bg = "#dbeafe"; text = "#2563eb"; }
                          else if (color === "purple") { bg = "#f3e8ff"; text = "#9333ea"; }
                          else if (color === "yellow") { bg = "#fef9c3"; text = "#ca8a04"; }

                          if (hasOrders) {
                            return (
                              <div style={{
                                width: "120px",
                                padding: "6px 12px",
                                borderRadius: 12,
                                fontSize: 15,
                                fontWeight: 700,
                                backgroundColor: bg,
                                color: text,
                                border: `1px solid ${text}40`,
                                textAlign: "center",
                                display: "inline-block"
                              }}>
                                {status}
                              </div>
                            );
                          }

                          return (
                            <div style={{ position: "relative", display: "inline-block", width: "120px" }}>
                              <select
                                value={status}
                                onChange={(e) => updateStatus(c, e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "6px 28px 6px 12px",
                                  borderRadius: 12,
                                  fontSize: 15,
                                  fontWeight: 700,
                                  backgroundColor: bg,
                                  color: text,
                                  border: `1px solid ${text}40`,
                                  outline: "none",
                                  cursor: "pointer",
                                  appearance: "none",
                                  transition: "all 0.2s",
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                                }}
                              >
                                {["Prospek", "Follow Up", "Negosiasi", "Konfirmasi", "Closing", "Reject"].map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: text, display: "flex", alignItems: "center" }}>
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ fontSize: 14, fontWeight: 600 }}>
                        {c.order_count || 0}x
                      </td>
                      {activeRole !== "cs_sales" && (
                        <td style={{ fontSize: 14, color: "#6b7280" }}>
                          {c.created_by ? c.created_by.split(" | ")[0] : "-"}
                        </td>
                      )}
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}><Edit2 size={11} /></button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setItemToDelete(c)} title="Hapus"><Trash2 size={11} color="#E24B4A" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination 
              page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} 
              onChange={(p) => fetchCustomers(p, meta.limit)} 
              onLimitChange={(lim) => fetchCustomers(1, lim)}
            />
          </>
        )}
      </div>

      <XlsxImportModal
        show={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => fetchCustomers(1, meta.limit)}
        importUrl="/api/customers/import"
        entityLabel="Customer"
        columns={[
          { key: "name", label: "Nama *" },
          { key: "phone", label: "No. Telepon" },
          { key: "email", label: "Email" },
          { key: "type", label: "Tipe" },
          { key: "address", label: "Alamat" },
          { key: "notes", label: "Catatan" },
        ]}
        templateData={[
          { name: "Budi Santoso", phone: "08123456789", email: "budi@email.com", type: "Perorangan", address: "Jl. Mawar No.1 Bandung", notes: "" },
          { name: "PT Maju Jaya", phone: "02112345678", email: "info@majujaya.com", type: "Corporate", address: "Jl. Sudirman No.99 Jakarta", notes: "Langganan acara tahunan" },
          { name: "Dinas Pendidikan Kota", phone: "02298765432", email: "", type: "Instansi", address: "Jl. Kebon Jati No.5 Bandung", notes: "" },
        ]}
        templateFileName="Template_Import_Customer.xlsx"
      />

      <Modal show={showModal} onClose={() => setShowModal(false)} title={editItem ? "Edit Kontak" : "Tambah Kontak"}>
        <FormRow>
          <FormField label="Nama *"><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama / kode customer" /></FormField>
          <FormField label="No. Telepon / WA"><input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="08xx..." /></FormField>
        </FormRow>
        <FormRow>
          <FormField label="Tipe Customer">
            <SearchableSelect 
              value={form.type} onChange={v => setForm((f) => ({ ...f, type: v }))}
              options={["Perorangan", "Corporate", "Instansi"].map(t => ({ value: t, label: t }))}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
          <FormField label="Email"><input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@domain.com" /></FormField>
        </FormRow>
        <FormField label="Alamat" style={{ marginBottom: 14 }}><input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Alamat lengkap" /></FormField>
        <FormRow>
          <FormField label="Status Kontak">
            <SearchableSelect 
              value={form.status} onChange={v => setForm((f) => ({ ...f, status: v }))}
              options={["Prospek", "Follow Up", "Negosiasi", "Konfirmasi", "Closing", "Reject"].map(s => ({ value: s, label: s }))}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
        </FormRow>
        <FormField label="Catatan" style={{ marginBottom: 14 }}><textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></FormField>
        
        {!editItem && (
          <>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 16, marginBottom: 8, borderTop: "1px solid #e5e7eb", paddingTop: 12, color: "#374151" }}>
              Data Lead Pertama (Otomatis Dibuat)
            </h3>
            <FormRow>
              <FormField label="Tanggal Lead">
                <input type="date" value={form.lead_date} onChange={(e) => setForm((f) => ({ ...f, lead_date: e.target.value }))} />
              </FormField>
              <FormField label="Sumber Lead">
                <SearchableSelect 
                  value={form.source} onChange={v => setForm((f) => ({ ...f, source: v }))}
                  options={["WhatsApp", "Instagram", "Website", "Referral", "Walk-in"].map(s => ({ value: s, label: s }))}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Tags Lead">
                <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="pernikahan, korporat..." />
              </FormField>
            </FormRow>
          </>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
          <button className="btn btn-primary" onClick={handleSave}>{editItem ? "Simpan Perubahan" : "Simpan"}</button>
        </div>
      </Modal>

      <ConfirmModal
        show={!!itemToDelete}
        title="Hapus Customer"
        message={`Yakin ingin menghapus kontak ${itemToDelete?.name}? Data yang dihapus tidak dapat dikembalikan.`}
        onConfirm={executeDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}
