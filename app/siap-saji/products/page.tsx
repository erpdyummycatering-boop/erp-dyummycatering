"use client";

import { useState, useEffect } from "react";
import { Layers, Plus, Search, Filter, Edit3, Trash2, Tag, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/Pagination";

interface Category {
  id: number;
  name: string;
}

interface Channel {
  id: number;
  name: string;
}

interface Product {
  id: number;
  sku: string;
  name: string;
  category_id: number;
  category_name?: string;
  description: string;
  price: number;
  is_half_portion: boolean;
  parent_sku: string | null;
  status: string;
  channel_prices?: { channel_id: number; channel_name?: string; harga_override: number | null }[];
}

export default function SiapSajiProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [porsiFilter, setPorsiFilter] = useState("");

  // Modal Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [isHalfPortion, setIsHalfPortion] = useState(false);
  const [parentSku, setParentSku] = useState("");
  const [channelPricesInput, setChannelPricesInput] = useState<{ [chId: number]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProducts = async (page = meta.page, lim = meta.limit) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.append("page", String(page));
      q.append("limit", String(lim));
      if (search) q.append("search", search);
      if (categoryFilter) q.append("category_id", categoryFilter);
      if (porsiFilter) q.append("is_half", porsiFilter);

      const res = await fetch(`/api/siap-saji/products?${q.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat katalog produk");
      const json = await res.json();
      setProducts(json.data || []);
      setMeta({
        total: json.total || 0,
        page: json.page || page,
        limit: json.limit || lim,
        totalPages: json.totalPages || 1,
      });
      setCategories(json.categories || []);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat produk");
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const res = await fetch("/api/siap-saji/master");
      if (res.ok) {
        const json = await res.json();
        setChannels(json.channels || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchChannels();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [search, categoryFilter, porsiFilter]);

  const handleOpenAdd = () => {
    setEditingProd(null);
    setSku("");
    setName("");
    setCategoryId(categories.length > 0 ? categories[0].id : "");
    setDescription("");
    setPrice(0);
    setIsHalfPortion(false);
    setParentSku("");
    setChannelPricesInput({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prod: Product) => {
    setEditingProd(prod);
    setSku(prod.sku || "");
    setName(prod.name);
    setCategoryId(prod.category_id || "");
    setDescription(prod.description || "");
    setPrice(Number(prod.price || 0));
    setIsHalfPortion(Boolean(prod.is_half_portion));
    setParentSku(prod.parent_sku || "");

    const cpInput: { [chId: number]: string } = {};
    if (prod.channel_prices) {
      prod.channel_prices.forEach((cp) => {
        if (cp.harga_override !== null && cp.harga_override !== undefined) {
          cpInput[cp.channel_id] = String(cp.harga_override);
        }
      });
    }
    setChannelPricesInput(cpInput);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku || !name || price === undefined) {
      return toast.error("SKU, Nama Produk, dan Harga Normal wajib diisi.");
    }

    setIsSubmitting(true);
    try {
      const url = editingProd ? `/api/siap-saji/products/${editingProd.id}` : "/api/siap-saji/products";
      const method = editingProd ? "PUT" : "POST";

      const channel_prices = channels.map((ch) => ({
        channel_id: ch.id,
        harga_override: channelPricesInput[ch.id] ? Number(channelPricesInput[ch.id]) : null,
      }));

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          name,
          category_id: categoryId ? Number(categoryId) : null,
          description,
          price: Number(price),
          is_half_portion: isHalfPortion,
          parent_sku: isHalfPortion ? parentSku : null,
          channel_prices,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Gagal menyimpan produk");
      }

      toast.success(editingProd ? "Produk berhasil diperbarui!" : "Produk baru berhasil ditambahkan!");
      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan produk");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.02em" }}>
            Katalog Produk Siap Saji
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Kelola SKU produk retail, varian ½ porsi, dan penyesuaian harga per channel
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          style={{
            background: "linear-gradient(135deg, #5005A6 0%, #B10FBD 100%)",
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 12px rgba(177, 15, 189, 0.25)",
          }}
        >
          <Plus size={18} /> Tambah Produk
        </button>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: "12px 16px",
          border: "1px solid #e5e7eb",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 10,
          overflowX: "auto",
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ flex: "1 1 240px", minWidth: 180, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Cari SKU atau Nama Produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "7px 12px 7px 34px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }}
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ width: 160, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white", flexShrink: 0 }}
        >
          <option value="">Semua Kategori</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <select
          value={porsiFilter}
          onChange={(e) => setPorsiFilter(e.target.value)}
          style={{ width: 160, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white", flexShrink: 0 }}
        >
          <option value="">Semua Varian Porsi</option>
          <option value="false">Porsi Penuh</option>
          <option value="true">½ Porsi</option>
        </select>
      </div>

      {/* Products Table */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14, whiteSpace: "nowrap" }}>
          <thead>
            <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>
              <th style={{ padding: "12px 16px", width: 50 }}>No.</th>
              <th style={{ padding: "12px 16px" }}>SKU</th>
              <th style={{ padding: "12px 16px" }}>Nama Produk</th>
              <th style={{ padding: "12px 16px" }}>Kategori</th>
              <th style={{ padding: "12px 16px" }}>Varian Porsi</th>
              <th style={{ padding: "12px 16px" }}>Harga Normal</th>
              <th style={{ padding: "12px 16px" }}>Harga Channel</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  Memuat katalog produk...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  Tidak ada produk Siap Saji ditemukan.
                </td>
              </tr>
            ) : (
              products.map((p, idx) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "14px 16px", color: "#6b7280" }}>{(meta.page - 1) * meta.limit + idx + 1}</td>
                  <td style={{ padding: "14px 16px", fontFamily: "monospace", fontWeight: 700, color: "#5005A6" }}>
                    {p.sku || "-"}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <p style={{ fontWeight: 700, color: "#111827", margin: 0 }}>{p.name}</p>
                    {p.description && <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>{p.description}</p>}
                  </td>
                  <td style={{ padding: "14px 16px", color: "#4b5563" }}>{p.category_name || "-"}</td>
                  <td style={{ padding: "14px 16px" }}>
                    {p.is_half_portion ? (
                      <span style={{ padding: "3px 8px", background: "#fdf4ff", color: "#b10fbd", border: "1px solid #f5d0fe", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                        ½ Porsi {p.parent_sku ? `(${p.parent_sku})` : ""}
                      </span>
                    ) : (
                      <span style={{ padding: "3px 8px", background: "#f3f4f6", color: "#4b5563", borderRadius: 6, fontSize: 12 }}>
                        Penuh
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 800, color: "#111827" }}>
                    Rp {Number(p.price).toLocaleString("id-ID")}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 12 }}>
                    {p.channel_prices && p.channel_prices.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {p.channel_prices.map((cp, i) =>
                          cp.harga_override !== null ? (
                            <span key={i} style={{ background: "#eff6ff", color: "#1d4ed8", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                              {cp.channel_name}: Rp{Number(cp.harga_override).toLocaleString("id-ID")}
                            </span>
                          ) : null
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "#9ca3af" }}>Normal</span>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right" }}>
                    <button
                      onClick={() => handleOpenEdit(p)}
                      style={{ padding: "6px 12px", background: "#5005A6", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      <Edit3 size={14} /> Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={meta.limit}
          onChange={(p) => fetchProducts(p, meta.limit)}
          onLimitChange={(lim) => fetchProducts(1, lim)}
        />
      </div>

      {/* ── MODAL: ADD / EDIT PRODUCT ────────────────────────────── */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div style={{ background: "white", borderRadius: 16, maxWidth: 600, width: "100%", padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
                {editingProd ? "Edit Produk Siap Saji" : "Tambah Produk Siap Saji"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    SKU Unik *
                  </label>
                  <input
                    type="text"
                    placeholder="SP-A01 / SP-A01H"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "monospace" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Nama Produk *
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Ayam Goreng Terasi Jeruk"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Kategori Produk
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Harga Normal (Rp) *
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                  />
                </div>
              </div>

              {/* Varian Porsi Toggle */}
              <div style={{ background: "#fdf4ff", border: "1px solid #f5d0fe", borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 700, color: "#b10fbd", fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={isHalfPortion}
                    onChange={(e) => setIsHalfPortion(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "#b10fbd" }}
                  />
                  Produk ini Varian ½ Porsi (SKU terpisah & harga berbeda)
                </label>

                {isHalfPortion && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                      Parent SKU Porsi Penuh
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: SP-A01"
                      value={parentSku}
                      onChange={(e) => setParentSku(e.target.value)}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, fontFamily: "monospace" }}
                    />
                  </div>
                )}
              </div>

              {/* Channel Pricing Override */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                  Harga Override per Channel (Opsional)
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "#f9fafb", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}>
                  {channels.map((ch) => (
                    <div key={ch.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{ch.name}:</span>
                      <input
                        type="number"
                        placeholder="Biarkan kosong jika sama"
                        value={channelPricesInput[ch.id] || ""}
                        onChange={(e) =>
                          setChannelPricesInput({
                            ...channelPricesInput,
                            [ch.id]: e.target.value,
                          })
                        }
                        style={{ width: 200, padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", fontSize: 14, cursor: "pointer" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5005A6", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  {isSubmitting ? "Simpan..." : "Simpan Produk"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
