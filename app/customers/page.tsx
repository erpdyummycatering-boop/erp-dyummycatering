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

const C = { primary: "#5005A6" };

const EMPTY_FORM = {
  name: "", phone: "", email: "", type: "Perorangan", address: "", notes: "",
};

export default function CustomersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

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
    return p.toString();
  }, [search, typeFilter]);

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
    setForm({ name: c.name, phone: c.phone || "", email: c.email || "", type: c.type || "Perorangan", address: c.address || "", notes: c.notes || "" });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return alert("Nama wajib diisi");
    const url = editItem ? `/api/customers/${editItem.id}` : "/api/customers";
    const method = editItem ? "PUT" : "POST";
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (res.ok) { setShowModal(false); fetchCustomers(meta.page); }
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    await fetch(`/api/customers/${itemToDelete.id}`, { method: "DELETE" });
    setItemToDelete(null);
    fetchCustomers(meta.page);
  };

  const corporateCount = rows.filter((c) => c.type === "Corporate").length;

  const handleExport = async () => {
    const p = new URLSearchParams({ page: "1", limit: "1000" });
    if (search) p.set("search", search);
    if (typeFilter) p.set("type", typeFilter);
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
        <StatCard label="Corporate (di halaman ini)" value={corporateCount} icon={Users} color="#378ADD" />
      </div>

      <div className="erp-card" style={{ marginBottom: 12, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="🔍 Cari nama, telepon, email..." style={{ width: 250 }} />
          <SearchableSelect 
            value={typeFilter} onChange={setTypeFilter} 
            options={[{ value: "", label: "Semua Tipe" }, ...["Perorangan", "Corporate", "Instansi"].map(t => ({ value: t, label: t }))]} 
            style={{ width: 160 }} 
          />
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearchInput(""); setSearch(""); setTypeFilter(""); }}>Reset</button>
        </div>
      </div>

      <div className="erp-card-flush">
        {loading ? (
          <p style={{ padding: 24, color: "#6b7280", fontSize: 13 }}>Memuat...</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>No.</th><th>Nama</th><th>Telepon</th><th>Tipe</th><th>Email</th>
                    <th>Terakhir Order</th><th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#6b7280" }}>Tidak ada data</td></tr>
                  ) : rows.map((c: any, idx: number) => (
                    <tr key={c.id}>
                      <td style={{ fontSize: 12, color: "#6b7280" }}>{(meta.page - 1) * meta.limit + idx + 1}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: C.primary + "20",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, color: C.primary, flexShrink: 0,
                          }}>
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</p>
                            <p style={{ fontSize: 11, color: "#6b7280" }}>{c.address || "Alamat belum diisi"}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.phone || "-"}</td>
                      <td>
                        <Badge color={c.type === "Corporate" ? "blue" : c.type === "Instansi" ? "purple" : "gray"}>
                          {c.type || "Perorangan"}
                        </Badge>
                      </td>
                      <td style={{ fontSize: 12, color: "#6b7280" }}>{c.email || "-"}</td>
                      <td style={{ fontSize: 12 }}>
                        {c.last_order ? String(c.last_order).slice(0, 10) : <span style={{ color: "#6b7280" }}>Belum pernah</span>}
                      </td>
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
        <FormField label="Catatan" style={{ marginBottom: 14 }}><textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></FormField>
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
