"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Download, Edit2, Trash2, Package, Tag } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PageHeader, FormRow, FormField } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { fmt } from "@/lib/utils";
import { exportToExcel } from "@/lib/export";

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState<"products" | "categories">("products");

  // ---- Products State ----
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [fCategory, setFCategory] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);
  const [editItem, setEditItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [form, setForm] = useState({ name: "", category_id: "", price: 0, description: "", status: "Aktif", image_url: "" });

  // ---- Categories State ----
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editCat, setEditCat] = useState<any>(null);
  const [catForm, setCatForm] = useState({ name: "" });
  const [catToDelete, setCatToDelete] = useState<any>(null);

  // ---- Fetch Categories ----
  const fetchCategories = useCallback((signal?: AbortSignal) => {
    fetch("/api/categories", { signal })
      .then(r => r.json())
      .then(data => setCategories(data))
      .catch(e => {
        if (e.name !== "AbortError") console.error("Gagal memuat kategori:", e);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCategories(controller.signal);
    return () => controller.abort();
  }, [fetchCategories]);

  // ---- Fetch Products ----
  const buildQs = useCallback((page = 1, lim = meta.limit) => {
    const p = new URLSearchParams({ page: String(page), limit: String(lim) });
    if (search) p.set("search", search);
    if (fCategory) p.set("category", fCategory);
    return p.toString();
  }, [search, fCategory, meta.limit]);

  const fetchProducts = useCallback((page = 1, lim = meta.limit, signal?: AbortSignal) => {
    setLoading(true);
    fetch(`/api/products?${buildQs(page, lim)}`, { signal })
      .then(r => r.json())
      .then(d => { setRows(d.data || []); setMeta({ total: d.total, page: d.page, limit: d.limit, totalPages: d.totalPages }); })
      .catch(e => {
        if (e.name !== "AbortError") console.error("Gagal memuat produk:", e);
      })
      .finally(() => setLoading(false));
  }, [buildQs, meta.limit]);

  useEffect(() => {
    const controller = new AbortController();
    if (activeTab === "products") {
      fetchProducts(1, meta.limit, controller.signal);
    }
    return () => controller.abort();
  }, [fetchProducts, activeTab]);

  // ---- Product CRUD Handlers ----
  const openAdd = () => {
    setEditItem(null);
    setForm({
      name: "",
      category_id: categories[0]?.id ? String(categories[0].id) : "",
      price: 0,
      description: "",
      status: "Aktif",
      image_url: ""
    });
    setShowModal(true);
  };

  const openEdit = (p: any) => {
    setEditItem(p);
    setForm({
      name: p.name,
      category_id: p.category_id ? String(p.category_id) : "",
      price: Number(p.price),
      description: p.description || "",
      status: p.status,
      image_url: p.image_url || ""
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || form.price <= 0) return alert("Nama dan harga wajib diisi valid");
    const url = editItem ? `/api/products/${editItem.id}` : "/api/products";
    const method = editItem ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      setShowModal(false);
      fetchProducts(meta.page);
    } else {
      const err = await res.json();
      alert(err.error || "Gagal menyimpan produk");
    }
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    await fetch(`/api/products/${itemToDelete.id}`, { method: "DELETE" });
    setItemToDelete(null);
    fetchProducts(meta.page);
  };

  const handleExport = async () => {
    const p = new URLSearchParams({ page: "1", limit: "1000" });
    if (search) p.set("search", search);
    if (fCategory) p.set("category", fCategory);
    const res = await fetch(`/api/products?${p}`);
    const d = await res.json();
    exportToExcel(d.data || [], "Data_Products");
  };

  // ---- Category CRUD Handlers ----
  const openCatAdd = () => {
    setEditCat(null);
    setCatForm({ name: "" });
    setShowCatModal(true);
  };

  const openCatEdit = (c: any) => {
    setEditCat(c);
    setCatForm({ name: c.name });
    setShowCatModal(true);
  };

  const handleSaveCat = async () => {
    if (!catForm.name.trim()) return alert("Nama kategori wajib diisi");
    const url = editCat ? `/api/categories/${editCat.id}` : "/api/categories";
    const method = editCat ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(catForm)
    });
    if (res.ok) {
      setShowCatModal(false);
      fetchCategories();
      fetchProducts(meta.page); // Refresh product details if needed
    } else {
      const err = await res.json();
      alert(err.error || "Gagal menyimpan kategori");
    }
  };

  const executeDeleteCat = async () => {
    if (!catToDelete) return;
    const res = await fetch(`/api/categories/${catToDelete.id}`, { method: "DELETE" });
    if (res.ok) {
      setCatToDelete(null);
      fetchCategories();
    } else {
      const err = await res.json();
      alert(err.error || "Gagal menghapus kategori");
      setCatToDelete(null);
    }
  };

  // ---- Styling Tab Helper ----
  const tabStyle = (t: "products" | "categories") => ({
    padding: "10px 20px",
    border: "none",
    background: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    borderBottom: activeTab === t ? "2px solid #5005A6" : "2px solid transparent",
    color: activeTab === t ? "#5005A6" : "#6b7280",
    marginBottom: -2,
    display: "inline-flex",
    alignItems: "center",
    gap: 6
  } as React.CSSProperties);

  return (
    <div>
      <PageHeader
        title="Katalog & Kategori"
        subtitle={`${meta.total} produk · ${categories.length} kategori terdaftar`}
        actions={
          activeTab === "products" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={handleExport}>
                <Download size={14} /> Export Excel
              </button>
              <button className="btn btn-primary" onClick={openAdd}>
                <Plus size={14} /> Tambah Produk
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={openCatAdd}>
              <Plus size={14} /> Tambah Kategori
            </button>
          )
        }
      />

      {/* ---- Tab Bar ---- */}
      <div style={{ display: "flex", borderBottom: "2px solid #e5e7eb", marginBottom: 16 }}>
        <button style={tabStyle("products")} onClick={() => setActiveTab("products")}>
          <Package size={14} /> Katalog Produk ({meta.total})
        </button>
        <button style={tabStyle("categories")} onClick={() => setActiveTab("categories")}>
          <Tag size={14} /> Kategori Produk ({categories.length})
        </button>
      </div>

      {/* ==================== TAB: PRODUCTS ==================== */}
      {activeTab === "products" && (
        <>
          <div className="erp-card" style={{ marginBottom: 12, padding: "12px 16px" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="🔍 Cari nama produk..."
                style={{ width: 250 }}
              />
              <SearchableSelect
                value={fCategory}
                onChange={setFCategory}
                options={[{ value: "", label: "Semua Kategori" }, ...categories.map(c => ({ value: String(c.id), label: c.name }))]}
                style={{ width: 160 }}
              />
              <button className="btn btn-secondary btn-sm" onClick={() => { setSearchInput(""); setSearch(""); setFCategory(""); }}>
                Reset
              </button>
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
                        <th>No.</th>
                        <th>ID</th>
                        <th>Foto</th>
                        <th>Nama Produk</th>
                        <th>Kategori</th>
                        <th>Harga Jual</th>
                        <th>Menu Default / Deskripsi</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>
                            Tidak ada produk
                          </td>
                        </tr>
                      ) : (
                        rows.map((r: any, idx: number) => (
                          <tr key={r.id}>
                            <td style={{ fontSize: 12, color: "#6b7280" }}>
                              {(meta.page - 1) * meta.limit + idx + 1}
                            </td>
                            <td style={{ fontSize: 12, color: "#6b7280" }}>
                              PRD-{String(r.id).padStart(3, "0")}
                            </td>
                            <td>
                              {r.image_url ? (
                                <img
                                  src={r.image_url}
                                  alt={r.name}
                                  style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }}
                                />
                              ) : (
                                <div style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#9ca3af" }}>
                                  No Img
                                </div>
                              )}
                            </td>
                            <td style={{ fontWeight: 600 }}>{r.name}</td>
                            <td>
                              <Badge color="blue">{r.category}</Badge>
                            </td>
                            <td style={{ fontWeight: 600, color: "#5005A6" }}>{fmt(r.price)}</td>
                            <td style={{ fontSize: 11, color: "#6b7280", maxWidth: 200, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                              {r.description || "-"}
                            </td>
                            <td>
                              <Badge color={r.status === "Aktif" ? "green" : "red"}>{r.status}</Badge>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>
                                  <Edit2 size={11} />
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setItemToDelete(r)} title="Hapus">
                                  <Trash2 size={11} color="#E24B4A" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={meta.page}
                  totalPages={meta.totalPages}
                  total={meta.total}
                  limit={meta.limit}
                  onChange={p => fetchProducts(p, meta.limit)}
                  onLimitChange={lim => fetchProducts(1, lim)}
                />
              </>
            )}
          </div>
        </>
      )}

      {/* ==================== TAB: CATEGORIES ==================== */}
      {activeTab === "categories" && (
        <div className="erp-card-flush">
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>No.</th>
                  <th style={{ width: 120 }}>ID</th>
                  <th>Nama Kategori</th>
                  <th style={{ width: 120 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>
                      Tidak ada kategori
                    </td>
                  </tr>
                ) : (
                  categories.map((c: any, idx: number) => (
                    <tr key={c.id}>
                      <td style={{ fontSize: 12, color: "#6b7280" }}>{idx + 1}</td>
                      <td style={{ fontSize: 12, color: "#6b7280" }}>CAT-{String(c.id).padStart(3, "0")}</td>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openCatEdit(c)}>
                            <Edit2 size={11} />
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setCatToDelete(c)} title="Hapus">
                            <Trash2 size={11} color="#E24B4A" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- Product Modal ---- */}
      <Modal show={showModal} onClose={() => setShowModal(false)} title={editItem ? "Edit Produk" : "Tambah Produk"}>
        <FormRow>
          <FormField label="Nama Produk">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </FormField>
          <FormField label="Kategori">
            <SearchableSelect
              value={form.category_id}
              onChange={v => setForm(f => ({ ...f, category_id: v }))}
              options={categories.map(c => ({ value: String(c.id), label: c.name }))}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="Harga Jual (Rp)">
            <input type="number" value={form.price || ""} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
          </FormField>
          <FormField label="Status">
            <SearchableSelect
              value={form.status}
              onChange={v => setForm(f => ({ ...f, status: v }))}
              options={["Aktif", "Nonaktif"].map(s => ({ value: s, label: s }))}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="Foto Produk">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {form.image_url && (
                <img
                  src={form.image_url}
                  alt="Preview"
                  style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const uploadBtn = e.target;
                    uploadBtn.disabled = true;
                    try {
                      const res = await fetch(`/api/products/upload?filename=${encodeURIComponent(file.name)}`, {
                        method: "POST",
                        body: file
                      });
                      if (res.ok) {
                        const blob = await res.json();
                        setForm(f => ({ ...f, image_url: blob.url }));
                      } else {
                        alert("Gagal mengupload gambar");
                      }
                    } catch (err) {
                      alert("Error: Gagal mengupload gambar");
                    } finally {
                      uploadBtn.disabled = false;
                    }
                  }}
                  style={{ fontSize: 12 }}
                />
                <span style={{ fontSize: 10, color: "#6b7280" }}>Maks. 5MB (PNG, JPG, WebP)</span>
              </div>
            </div>
          </FormField>
        </FormRow>
        <FormField label="Rincian Menu / Lauk Default (Tampil di PDF Konfirmasi)" style={{ marginBottom: 14 }}>
          <textarea
            rows={5}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder={"Masukkan lauk pauk dipisah baris baru untuk auto-populate konfirmasi order, contoh:\n1. NASI PUTIH\n2. AYAM SERUNDENG (pot.8)\n3. CAH TAHU BUNCIS"}
            style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.4 }}
          />
        </FormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
            Batal
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Simpan
          </button>
        </div>
      </Modal>

      {/* ---- Category Modal ---- */}
      <Modal show={showCatModal} onClose={() => setShowCatModal(false)} title={editCat ? "Edit Kategori" : "Tambah Kategori"}>
        <FormField label="Nama Kategori" style={{ marginBottom: 14 }}>
          <input
            value={catForm.name}
            onChange={e => setCatForm({ name: e.target.value })}
            placeholder="Contoh: Snack Box, Prasmanan, dll."
            style={{ width: "100%" }}
          />
        </FormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={() => setShowCatModal(false)}>
            Batal
          </button>
          <button className="btn btn-primary" onClick={handleSaveCat}>
            Simpan
          </button>
        </div>
      </Modal>

      {/* ---- Confirm Product Delete ---- */}
      <ConfirmModal
        show={!!itemToDelete}
        title="Hapus Produk"
        message={`Yakin ingin menghapus produk ${itemToDelete?.name}? Data yang dihapus tidak dapat dikembalikan.`}
        onConfirm={executeDelete}
        onCancel={() => setItemToDelete(null)}
      />

      {/* ---- Confirm Category Delete ---- */}
      <ConfirmModal
        show={!!catToDelete}
        title="Hapus Kategori"
        message={`Yakin ingin menghapus kategori ${catToDelete?.name}? Kategori hanya dapat dihapus jika tidak ada produk yang menggunakannya.`}
        onConfirm={executeDeleteCat}
        onCancel={() => setCatToDelete(null)}
      />
    </div>
  );
}
