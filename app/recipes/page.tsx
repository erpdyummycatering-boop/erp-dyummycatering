"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Edit2, Download, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PageHeader, FormRow, FormField } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { fmt } from "@/lib/utils";
import { exportToExcel } from "@/lib/export";

const C = { primary: "#5005A6" };

const EMPTY_FORM = { product_id: "", menu_name: "", ingredients: "", standard_cost: "" };

export default function RecipesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [fProduct, setFProduct] = useState("");

  const buildQs = useCallback((page = 1, lim = meta.limit) => {
    const p = new URLSearchParams({ page: String(page), limit: String(lim) });
    if (search) p.set("search", search);
    if (fProduct) p.set("product_id", fProduct);
    return p.toString();
  }, [search, fProduct]);

  const fetchRecipes = useCallback((page = 1, lim = meta.limit) => {
    setLoading(true);
    fetch(`/api/recipes?${buildQs(page, lim)}`)
      .then(r => r.json())
      .then(d => { setRows(d.data || []); setMeta({ total: d.total, page: d.page, limit: d.limit, totalPages: d.totalPages }); })
      .finally(() => setLoading(false));
  }, [buildQs, meta.limit]);

  useEffect(() => {
    fetchRecipes(1, meta.limit);
    fetch("/api/products?limit=100").then(r => r.json()).then(d => setProducts(d.data || []));
  }, [fetchRecipes]);

  const openAdd = () => { setEditItem(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (r: any) => {
    setEditItem(r);
    setForm({ product_id: r.product_id, menu_name: r.menu_name, ingredients: r.ingredients, standard_cost: r.standard_cost });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.menu_name || !form.standard_cost) return alert("Nama menu dan HPP wajib diisi");
    const url = editItem ? `/api/recipes/${editItem.id}` : "/api/recipes";
    const method = editItem ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowModal(false);
        fetchRecipes(meta.page);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Gagal menyimpan resep.");
      }
    } catch (e) {
      alert("Terjadi kesalahan saat menyimpan resep.");
    }
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(`/api/recipes/${itemToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setItemToDelete(null);
        fetchRecipes(meta.page);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Gagal menghapus resep.");
      }
    } catch (e) {
      alert("Terjadi kesalahan saat menghapus resep.");
    }
  };

  const handleExport = async () => {
    const p = new URLSearchParams({ page: "1", limit: "1000" });
    if (search) p.set("search", search);
    if (fProduct) p.set("product_id", fProduct);
    const res = await fetch(`/api/recipes?${p}`);
    const d = await res.json();
    exportToExcel(d.data || [], "Data_Recipes");
  };

  return (
    <div>
      <PageHeader
        title="Master Resep & HPP Standar"
        subtitle={`${meta.total} resep menu terdaftar`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={14} /> Export Excel</button>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Tambah Resep</button>
          </div>
        }
      />

      <div className="erp-card" style={{ marginBottom: 12, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari nama menu..." style={{ width: 250 }} />
          <SearchableSelect 
            value={fProduct} onChange={setFProduct} 
            options={[{ value: "", label: "Semua Produk" }, ...products.map((p: any) => ({ value: p.id, label: p.name }))]} 
            style={{ width: 200 }} 
          />
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(""); setFProduct(""); }}>Reset</button>
        </div>
      </div>

      <div className="erp-card-flush">
        {loading ? <p style={{ padding: 24, color: "#6b7280", fontSize: 13 }}>Memuat...</p> : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Nama Menu</th><th>Produk (Kategori)</th>
                    <th>Bahan Utama</th><th>HPP Standar/Porsi</th><th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "#6b7280" }}>Belum ada resep</td></tr>
                  ) : rows.map((r: any, idx: number) => (
                    <tr key={r.id}>
                      <td style={{ color: "#6b7280", fontSize: 12 }}>{(meta.page - 1) * meta.limit + idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{r.menu_name}</td>
                      <td><Badge color="blue">{r.product_name || "-"}</Badge></td>
                      <td style={{ fontSize: 12, color: "#6b7280", maxWidth: 200 }}>{r.ingredients}</td>
                      <td style={{ fontWeight: 700, color: C.primary }}>{fmt(r.standard_cost)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}><Edit2 size={11} /></button>
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
              onChange={(p) => fetchRecipes(p, meta.limit)} 
              onLimitChange={(lim) => fetchRecipes(1, lim)}
            />
          </>
        )}
      </div>

      <Modal show={showModal} onClose={() => setShowModal(false)} title={editItem ? "Edit Resep" : "Tambah Resep Menu"}>
        <FormField label="Nama Menu" style={{ marginBottom: 14 }}>
          <input value={form.menu_name} onChange={(e) => setForm((f) => ({ ...f, menu_name: e.target.value }))} placeholder="Contoh: Rendang Daging Sapi" />
        </FormField>
        <FormField label="Produk (Paket)" style={{ marginBottom: 14 }}>
          <SearchableSelect 
            value={form.product_id} onChange={v => setForm((f) => ({ ...f, product_id: v }))}
            options={[
              { value: "", label: "-- Pilih Produk --" },
              ...products.map((p: any) => ({ value: p.id, label: p.name }))
            ]}
            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
          />
        </FormField>
        <FormField label="Bahan-Bahan" style={{ marginBottom: 14 }}>
          <textarea rows={3} value={form.ingredients} onChange={(e) => setForm((f) => ({ ...f, ingredients: e.target.value }))} placeholder="Daging Sapi 200gr, Bumbu Rendang, Kelapa..." />
        </FormField>
        <FormField label="HPP Standar per Porsi (Rp)" style={{ marginBottom: 14 }}>
          <input type="number" value={form.standard_cost} onChange={(e) => setForm((f) => ({ ...f, standard_cost: e.target.value }))} placeholder="25000" />
        </FormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
          <button className="btn btn-primary" onClick={handleSave}>{editItem ? "Simpan Perubahan" : "Simpan Resep"}</button>
        </div>
      </Modal>

      <ConfirmModal
        show={!!itemToDelete}
        title="Hapus Resep"
        message={`Yakin ingin menghapus resep ${itemToDelete?.menu_name}? Data yang dihapus tidak dapat dikembalikan.`}
        onConfirm={executeDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}
