"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Filter, Download, Upload, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { XlsxImportModal } from "@/components/ui/XlsxImportModal";
import { PageHeader, FormRow, FormField } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { statusBadgeColor } from "@/lib/utils";
import { exportToExcel } from "@/lib/export";

const STATUSES = ["Prospek","Follow Up","Negosiasi","Konfirmasi","Closing","Reject"];
const SOURCES = ["WhatsApp","Instagram","Website","Referral","Walk-in"];

export default function LeadsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [customers, setCustomers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fSource, setFSource] = useState("");
  const [fPic, setFPic] = useState("");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const [form, setForm] = useState({ 
    customer_id: "", customer_name: "", customer_phone: "",
    pic_id: "", lead_date: new Date().toISOString().split("T")[0], source: "WhatsApp", status: "Prospek", tags: "", notes: "" 
  });

  const buildQs = useCallback((page = 1, lim = meta.limit) => {
    const p = new URLSearchParams({ page: String(page), limit: String(lim) });
    if (search) p.set("search", search);
    if (fStatus) p.set("status", fStatus);
    if (fSource) p.set("source", fSource);
    if (userRole === "CS / Sales") {
      p.set("pic_id", String(userId));
    } else if (fPic) {
      p.set("pic_id", fPic);
    }
    if (fDateFrom) p.set("date_from", fDateFrom);
    if (fDateTo) p.set("date_to", fDateTo);
    return p.toString();
  }, [search, fStatus, fSource, fPic, fDateFrom, fDateTo, userRole, userId, meta.limit]);

  const fetchLeads = useCallback((page = 1, lim = meta.limit, signal?: AbortSignal) => {
    setLoading(true);
    fetch(`/api/leads?${buildQs(page, lim)}`, { signal })
      .then(r => r.json())
      .then(d => {
        setRows(d.data || []);
        setMeta({ total: d.total, page: d.page, limit: d.limit, totalPages: d.totalPages });
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          console.error(err);
        }
      })
      .finally(() => setLoading(false));
  }, [buildQs, meta.limit]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLeads(1, meta.limit, controller.signal);
    return () => controller.abort();
  }, [fetchLeads]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/customers?limit=100", { signal: controller.signal })
      .then(r => r.json())
      .then(d => setCustomers(d.data || []))
      .catch(() => {});
    fetch("/api/users", { signal: controller.signal })
      .then(r => r.json())
      .then(setUsers)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const handleSave = async () => {
    if (!form.customer_id) return alert("Pilih customer");
    if (form.customer_id === "new" && !form.customer_phone) return alert("Nomor WA wajib diisi untuk customer baru");
    
    const finalForm = { ...form };
    if (userRole === "CS / Sales") {
      finalForm.pic_id = String(userId);
    }

    const url = editItem ? `/api/leads/${editItem.id}` : "/api/leads";
    const method = editItem ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(finalForm) });
    if (res.ok) { setShowModal(false); setEditItem(null); fetchLeads(1); }
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    await fetch(`/api/leads/${itemToDelete.id}`, { method: "DELETE" });
    setItemToDelete(null);
    fetchLeads(meta.page);
  };

  const handleStatusChange = async (id: number, status: string) => {
    await fetch(`/api/leads/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    fetchLeads(meta.page, meta.limit);
  };

  const handleExport = async () => {
    const p = new URLSearchParams({ page: "1", limit: "1000" });
    if (search) p.set("search", search);
    if (fStatus) p.set("status", fStatus);
    if (fSource) p.set("source", fSource);
    if (userRole === "CS / Sales") {
      p.set("pic_id", String(userId));
    } else if (fPic) {
      p.set("pic_id", fPic);
    }
    if (fDateFrom) p.set("date_from", fDateFrom);
    if (fDateTo) p.set("date_to", fDateTo);
    const res = await fetch(`/api/leads?${p}`);
    const d = await res.json();
    exportToExcel(d.data || [], "Data_Leads");
  };
  
  return (
    <div>
      <PageHeader title="Lead Harian" subtitle={`${meta.total} total leads — semua terhubung database`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={14} /> Export Excel</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}><Upload size={14} /> Import Excel</button>
            <button className="btn btn-primary" onClick={() => { setEditItem(null); setForm({ customer_id: "", customer_name: "", customer_phone: "", pic_id: userRole === "CS / Sales" ? String(userId) : "", lead_date: new Date().toISOString().split("T")[0], source: "WhatsApp", status: "Prospek", tags: "", notes: "" }); setShowModal(true); }}><Plus size={14} /> Tambah Lead</button>
          </div>
        }
      />

      {/* Filters */}
      <div className="erp-card" style={{ marginBottom: 12, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="🔍 Cari nama, tag, catatan..." style={{ width: 200 }} />
          <SearchableSelect 
            value={fStatus} onChange={setFStatus} 
            options={[{ value: "", label: "Semua Status" }, ...STATUSES.map(s => ({ value: s, label: s }))]} 
            style={{ width: 140 }} 
          />
          <SearchableSelect 
            value={fSource} onChange={setFSource} 
            options={[{ value: "", label: "Semua Sumber" }, ...SOURCES.map(s => ({ value: s, label: s }))]} 
            style={{ width: 140 }} 
          />
          {userRole !== "CS / Sales" && (
            <SearchableSelect 
              value={fPic} onChange={setFPic} 
              options={[{ value: "", label: "Semua CS" }, ...users.filter((u: any) => u.role === "CS / Sales").map((u: any) => ({ value: u.id, label: u.name }))]} 
              style={{ width: 160 }} 
            />
          )}
          <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} style={{ width: 140 }} title="Dari tanggal" />
          <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} style={{ width: 140 }} title="Sampai tanggal" />
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearchInput(""); setSearch(""); setFStatus(""); setFSource(""); setFPic(""); setFDateFrom(""); setFDateTo(""); }}>Reset</button>
        </div>
      </div>

      {/* Status Summary Badges */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {STATUSES.map(s => {
          const cnt = rows.filter((r: any) => r.status === s).length;
          return (
            <button key={s} onClick={() => setFStatus(fStatus === s ? "" : s)}
              className="badge" style={{ cursor: "pointer", opacity: fStatus && fStatus !== s ? 0.4 : 1 }}
              data-color={statusBadgeColor(s)}>
              {s}: {cnt}
            </button>
          );
        })}
      </div>

      <div className="erp-card-flush">
        {loading ? <p style={{ padding: 24, color: "#6b7280", fontSize: 13 }}>Memuat...</p> : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr><th>No.</th><th>Tanggal</th><th>Customer</th><th>Sumber</th><th>Status</th><th>CS PIC</th><th>Tags</th><th>Catatan</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>Tidak ada data</td></tr>
                  ) : rows.map((r: any, idx: number) => (
                    <tr key={r.id}>
                      <td style={{ fontSize: 12, color: "#6b7280" }}>{(meta.page - 1) * meta.limit + idx + 1}</td>
                      <td style={{ fontSize: 12 }}>{String(r.lead_date).slice(0, 10)}</td>
                      <td style={{ fontWeight: 500 }}>{r.customer_name}</td>
                      <td><Badge color="blue">{r.source}</Badge></td>
                      <td>
                        <select value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}
                          style={{ border: "none", background: "transparent", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, width: "auto", color: r.status === "Closing" ? "#5005A6" : r.status === "Reject" ? "#E24B4A" : "#374151" }}>
                          {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ fontSize: 12 }}>{r.pic_name || "-"}</td>
                      <td style={{ fontSize: 11 }}>{r.tags || "-"}</td>
                      <td style={{ fontSize: 11, color: "#6b7280", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes || "-"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setEditItem(r); setForm({ customer_id: r.customer_id, customer_name: "", customer_phone: "", pic_id: r.pic_id || "", lead_date: String(r.lead_date).slice(0,10), source: r.source, status: r.status, tags: r.tags || "", notes: r.notes || "" }); setShowModal(true); }}>Edit</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setItemToDelete(r)} title="Hapus"><Trash2 size={11} color="#E24B4A" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination 
              page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} 
              onChange={(p) => fetchLeads(p, meta.limit)} 
              onLimitChange={(lim) => fetchLeads(1, lim)}
            />
          </>
        )}
      </div>

      <XlsxImportModal
        show={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => fetchLeads(1, meta.limit)}
        importUrl="/api/leads/import"
        entityLabel="Lead"
        columns={[
          { key: "customer_name", label: "Nama Customer *" },
          { key: "customer_phone", label: "No. HP" },
          { key: "lead_date", label: "Tanggal (YYYY-MM-DD)" },
          { key: "source", label: "Sumber" },
          { key: "status", label: "Status" },
          { key: "tags", label: "Tags" },
          { key: "notes", label: "Catatan" },
        ]}
        templateData={[
          { customer_name: "Rina Wijaya", customer_phone: "08112233445", lead_date: "2026-05-24", source: "WhatsApp", status: "Prospek", tags: "pernikahan", notes: "Tanya paket pernikahan 200 pax" },
          { customer_name: "PT Sejahtera", customer_phone: "02198765432", lead_date: "2026-05-24", source: "Instagram", status: "Follow Up", tags: "korporat", notes: "Meeting Rabu depan" },
          { customer_name: "Budi Santoso", customer_phone: "", lead_date: "2026-05-25", source: "Referral", status: "Negosiasi", tags: "", notes: "" },
        ]}
        templateFileName="Template_Import_Leads.xlsx"
      />

      <Modal show={showModal} onClose={() => { setShowModal(false); setEditItem(null); }} title={editItem ? "Edit Lead" : "Tambah Lead"}>
        <FormRow>
          <FormField label="Customer">
            <SearchableSelect 
              value={form.customer_id} onChange={v => setForm(f => ({ ...f, customer_id: v }))}
              options={[
                { value: "", label: "-- Pilih --" },
                { value: "new", label: "+ Tambah Baru (via WA)", color: "#5005A6", isBold: true },
                ...customers.map((c: any) => ({ value: c.id, label: c.name }))
              ]}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
          {userRole !== "CS / Sales" && (
            <FormField label="CS PIC">
              <SearchableSelect 
                value={form.pic_id} onChange={v => setForm(f => ({ ...f, pic_id: v }))}
                options={[
                  { value: "", label: "-- Pilih CS --" },
                  ...users.filter((u: any) => u.role === "CS / Sales").map((u: any) => ({ value: u.id, label: u.name }))
                ]}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              />
            </FormField>
          )}
        </FormRow>

        {form.customer_id === "new" && (
          <FormRow>
            <FormField label="Nama Customer Baru">
              <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Nama Lengkap / Instansi" />
            </FormField>
            <FormField label="Nomor WhatsApp">
              <input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} placeholder="08123456789" />
            </FormField>
          </FormRow>
        )}

        <FormRow>
          <FormField label="Tanggal Lead"><input type="date" value={form.lead_date} onChange={e => setForm(f => ({ ...f, lead_date: e.target.value }))} /></FormField>
          <FormField label="Sumber">
            <SearchableSelect 
              value={form.source} onChange={v => setForm(f => ({ ...f, source: v }))}
              options={SOURCES.map(s => ({ value: s, label: s }))}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="Status">
            <SearchableSelect 
              value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
              options={STATUSES.map(s => ({ value: s, label: s }))}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
          <FormField label="Tags"><input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="pernikahan, korporat..." /></FormField>
        </FormRow>
        <FormField label="Catatan" style={{ marginBottom: 14 }}>
          <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </FormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
          <button className="btn btn-primary" onClick={handleSave}>{editItem ? "Update" : "Simpan"}</button>
        </div>
      </Modal>

      <ConfirmModal
        show={!!itemToDelete}
        title="Hapus Lead"
        message={`Yakin ingin menghapus lead dari ${itemToDelete?.customer_name}? Data yang dihapus tidak dapat dikembalikan.`}
        onConfirm={executeDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}
