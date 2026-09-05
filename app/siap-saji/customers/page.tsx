"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Search, Filter, Phone, MapPin, Edit3, Trash2, Eye, Award, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/Pagination";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { formatDate, getWhatsAppUrl } from "@/lib/utils";

interface Area {
  id: number;
  kecamatan: string;
  kota: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  patokan: string;
  area_id: number;
  area_kecamatan: string;
  area_kota: string;
  segmen: string;
  total_omset: number;
  total_orders: number;
  last_order_date: string;
  channel_favorit: string;
  status: string;
  loyalty_points?: number;
}

export default function SiapSajiCustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);

  // Dynamic Loyalty Settings State
  const [loyaltySettings, setLoyaltySettings] = useState({ min_order: 100000, point_percentage: 2.0 });
  const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState(false);
  const [minOrderInput, setMinOrderInput] = useState<number>(100000);
  const [pointPercentageInput, setPointPercentageInput] = useState<number>(2.0);
  const [isSavingLoyalty, setIsSavingLoyalty] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [segmenFilter, setSegmenFilter] = useState("");

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCust, setEditingCust] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [patokan, setPatokan] = useState("");
  const [areaId, setAreaId] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCustomers = async (page = meta.page, lim = meta.limit) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.append("page", String(page));
      q.append("limit", String(lim));
      if (search) q.append("search", search);
      if (segmenFilter) q.append("segmen", segmenFilter);

      const res = await fetch(`/api/siap-saji/customers?${q.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat data pelanggan");
      const json = await res.json();
      setCustomers(json.data || []);
      if (json.loyalty_settings) {
        setLoyaltySettings(json.loyalty_settings);
      }
      setMeta({
        total: json.total || 0,
        page: json.page || page,
        limit: json.limit || lim,
        totalPages: json.totalPages || 1,
      });
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat pelanggan");
    } finally {
      setLoading(false);
    }
  };

  const fetchAreas = async () => {
    try {
      const res = await fetch("/api/siap-saji/master");
      if (res.ok) {
        const json = await res.json();
        setAreas(json.areas || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchAreas();
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [search, segmenFilter]);

  const handleOpenAdd = () => {
    setEditingCust(null);
    setName("");
    setPhone("");
    setAddress("");
    setPatokan("");
    setAreaId(areas.length > 0 ? areas[0].id : "");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cust: Customer) => {
    setEditingCust(cust);
    setName(cust.name);
    setPhone(cust.phone);
    setAddress(cust.address || "");
    setPatokan(cust.patokan || "");
    setAreaId(cust.area_id || "");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !areaId || !address.trim() || !patokan.trim()) {
      return toast.error("Harap lengkapi semua data pelanggan (Nama, No HP, Kecamatan, Alamat Lengkap, dan Patokan/Landmark wajib diisi) sebelum menyimpan.");
    }

    setIsSubmitting(true);
    try {
      const url = editingCust ? `/api/siap-saji/customers/${editingCust.id}` : "/api/siap-saji/customers";
      const method = editingCust ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), address: address.trim(), patokan: patokan.trim(), area_id: areaId }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Gagal menyimpan customer");
      }

      toast.success(editingCust ? "Data pelanggan berhasil diperbarui!" : "Pelanggan baru berhasil ditambahkan!");
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan data");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDetail = (custId: number) => {
    router.push(`/siap-saji/customers/${custId}`);
  };

  // RFM Badge Color helper
  const getSegmenBadgeStyle = (segmen: string) => {
    switch (segmen) {
      case "Champions":
        return { bg: "#fef3c7", color: "#b45309", border: "#fde68a" };
      case "Loyal Customers":
        return { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" };
      case "New Customers":
        return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
      case "At Risk":
        return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
      case "Dormant":
        return { bg: "#f3f4f6", color: "#4b5563", border: "#e5e7eb" };
      default:
        return { bg: "#fdf4ff", color: "#b10fbd", border: "#f5d0fe" };
    }
  };

  const handleOpenLoyaltyModal = () => {
    setMinOrderInput(loyaltySettings.min_order);
    setPointPercentageInput(loyaltySettings.point_percentage);
    setIsLoyaltyModalOpen(true);
  };

  const handleSaveLoyaltySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingLoyalty(true);
    try {
      const res = await fetch("/api/siap-saji/loyalty-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          min_order: minOrderInput,
          point_percentage: pointPercentageInput,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Gagal memperbarui pengaturan poin loyalty");
      }

      toast.success("Pengaturan Poin Loyalty berhasil diperbarui!");
      setIsLoyaltyModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui pengaturan");
    } finally {
      setIsSavingLoyalty(false);
    }
  };

  const handleDeleteCustomer = async (c: Customer) => {
    if (
      !confirm(
        `PERHATIAN HAPUS PELANGGAN:\n\nApakah Anda yakin ingin menghapus pelanggan "${c.name}"?\n\nMenghapus pelanggan ini akan menghapus SELURUH riwayat transaksi (orders), order items, jurnal akuntansi, dan mutasi kas terkait secara permanent!`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/siap-saji/customers/${c.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus pelanggan");
      toast.success(data.message || "Pelanggan berhasil dihapus.");
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus pelanggan");
    }
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.02em" }}>
            Master Pelanggan Siap Saji
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Kelola kontak customer retail, landmark patokan lokasi, dan poin loyalty pelanggan
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleOpenLoyaltyModal}
            style={{
              background: "#fdf4ff",
              color: "#b10fbd",
              border: "1px solid #f5d0fe",
              borderRadius: 10,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 2px 6px rgba(177, 15, 189, 0.1)",
            }}
          >
            <Award size={18} /> Pengaturan Poin ({loyaltySettings.point_percentage}% / Min Rp {loyaltySettings.min_order.toLocaleString("id-ID")})
          </button>

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
            <Plus size={18} /> Tambah Pelanggan
          </button>
        </div>
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
          gap: 12,
          overflowX: "auto",
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ flex: "1 1 300px", minWidth: 200, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Cari Nama, No HP, Patokan, atau Kecamatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "7px 12px 7px 34px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }}
          />
        </div>

        <SearchableSelect
          options={[
            { value: "", label: "Semua Segmen RFM" },
            { value: "Champions", label: "Champions" },
            { value: "Loyal Customers", label: "Loyal Customers" },
            { value: "Potential Loyalists", label: "Potential Loyalists" },
            { value: "At Risk", label: "At Risk" },
            { value: "Hibernating / Lost", label: "Hibernating / Lost" },
          ]}
          value={segmenFilter}
          onChange={(val) => setSegmenFilter(val ? String(val) : "")}
          placeholder="Semua Segmen RFM"
          style={{ width: 200, flexShrink: 0 }}
        />
      </div>

      {/* Customer Table */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
              <th style={{ padding: "10px 10px", width: 40 }}>No.</th>
              <th style={{ padding: "10px 10px", width: 140 }}>Pelanggan</th>
              <th style={{ padding: "10px 10px", width: 220 }}>Kecamatan & Alamat</th>
              <th style={{ padding: "10px 10px", width: 170 }}>Patokan / Landmark</th>
              <th style={{ padding: "10px 10px", width: 60, textAlign: "center" }}>Order</th>
              <th style={{ padding: "10px 10px", width: 110 }}>Total Omset</th>
              <th style={{ padding: "10px 10px", width: 100 }}>Poin Loyalty</th>
              <th style={{ padding: "10px 10px", width: 130 }}>Segmen RFM</th>
              <th style={{ padding: "10px 10px", width: 80, textAlign: "right" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  Memuat data pelanggan...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  Tidak ada pelanggan Siap Saji ditemukan.
                </td>
              </tr>
            ) : (
              customers.map((c, idx) => {
                const segmenName = Number(c.total_orders || 0) === 0 ? "New Customers" : (c.segmen || "New Customers");
                const sStyle = getSegmenBadgeStyle(segmenName);
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 10px", color: "#6b7280" }}>{(meta.page - 1) * meta.limit + idx + 1}</td>
                    <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>
                      <p
                        onClick={() => handleViewDetail(c.id)}
                        style={{ fontWeight: 800, color: "#5005A6", margin: 0, cursor: "pointer" }}
                        title="Klik untuk lihat detail brief pelanggan"
                      >
                        {c.name}
                      </p>
                      <a
                        href={getWhatsAppUrl(c.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 12,
                          color: "#25D366",
                          fontWeight: 700,
                          margin: "2px 0 0",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        title="Chat WhatsApp (Buka Tab Baru)"
                      >
                        💬 {c.phone}
                      </a>
                    </td>
                    <td style={{ padding: "10px 10px", whiteSpace: "normal", maxWidth: 220, wordBreak: "break-word" }}>
                      <p style={{ fontWeight: 600, color: "#374151", margin: 0 }}>
                        {c.area_kecamatan ? `${c.area_kecamatan}` : "-"}
                      </p>
                      <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0", lineHeight: 1.3 }}>{c.address || "-"}</p>
                    </td>
                    <td style={{ padding: "10px 10px", color: "#b10fbd", fontWeight: 600, fontSize: 12, whiteSpace: "normal", maxWidth: 170, wordBreak: "break-word", lineHeight: 1.3 }}>
                      {c.patokan ? `📍 ${c.patokan}` : "-"}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "center", fontWeight: 700 }}>
                      {c.total_orders || 0}
                    </td>
                    <td style={{ padding: "10px 10px", fontWeight: 700, color: "#5005A6", whiteSpace: "nowrap" }}>
                      Rp {Number(c.total_omset || 0).toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: "10px 10px", fontWeight: 800, color: "#15803d", whiteSpace: "nowrap" }}>
                      ⭐ {Number(c.loyalty_points || 0).toLocaleString("id-ID")} Poin
                    </td>
                    <td style={{ padding: "10px 10px" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          background: sStyle.bg,
                          color: sStyle.color,
                          border: `1px solid ${sStyle.border}`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {segmenName}
                      </span>
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                        <button
                          onClick={() => handleViewDetail(c.id)}
                          title="Lihat Detail Transaksi"
                          style={{ padding: "5px 8px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(c)}
                          title="Edit Data Pelanggan"
                          style={{ padding: "5px 8px", background: "#5005A6", color: "white", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(c)}
                          title="Hapus Pelanggan & Cascade Transaksi"
                          style={{ padding: "5px 8px", background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={meta.limit}
          onChange={(p) => fetchCustomers(p, meta.limit)}
          onLimitChange={(lim) => fetchCustomers(1, lim)}
        />
      </div>

      {/* ── MODAL: ADD / EDIT CUSTOMER ────────────────────────────── */}
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
          <div style={{ background: "white", borderRadius: 16, maxWidth: 500, width: "100%", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
                {editingCust ? "Edit Data Pelanggan" : "Tambah Pelanggan Baru"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Nama Pelanggan *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Ibu Elly"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  No. WhatsApp / HP *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 08111100004"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Kecamatan (Wilayah) *
                </label>
                <SearchableSelect
                  options={areas.map((a) => ({ value: a.id, label: `${a.kecamatan} (${a.kota})` }))}
                  value={areaId}
                  onChange={(val) => setAreaId(val ? Number(val) : "")}
                  placeholder="-- Pilih Kecamatan --"
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Alamat Lengkap *
                </label>
                <input
                  type="text"
                  placeholder="Jl Pluto I Blok C No 5 Kel Margasari"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Patokan / Landmark Lokasi (Khusus Kurir) *
                </label>
                <input
                  type="text"
                  placeholder="Dekat Griya Margahayuraya, depan puskesmas ada gerbang..."
                  value={patokan}
                  onChange={(e) => setPatokan(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
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
                  {isSubmitting ? "Simpan..." : "Simpan Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: PENGATURAN POIN LOYALTY DINAMIS ──────────── */}
      {isLoyaltyModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div style={{ background: "white", borderRadius: 16, maxWidth: 440, width: "100%", padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid #e5e7eb", paddingBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <Award size={20} color="#b10fbd" /> Pengaturan Poin Loyalty
                </h3>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
                  Pengaturan ini dinamis & berlaku otomatis untuk perhitungan poin seluruh pelanggan
                </p>
              </div>
              <button onClick={() => setIsLoyaltyModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveLoyaltySettings}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                  Minimal Nominal Order (Rp) *
                </label>
                <input
                  type="number"
                  placeholder="Contoh: 100000"
                  value={minOrderInput}
                  onChange={(e) => setMinOrderInput(Number(e.target.value))}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" }}
                />
                <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                  Order dengan nilai di bawah angka ini tidak mendapatkan poin loyalty.
                </p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                  Persentase Poin per Transaksi (%) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Contoh: 2.0"
                  value={pointPercentageInput}
                  onChange={(e) => setPointPercentageInput(Number(e.target.value))}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" }}
                />
                <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                  Contoh: 2% dari transaksi Rp 1.000.000 = <strong>20.000 Poin</strong>.
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsLoyaltyModalOpen(false)}
                  style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", fontSize: 14, cursor: "pointer" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingLoyalty}
                  style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #5005A6 0%, #B10FBD 100%)", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  {isSavingLoyalty ? "Simpan..." : "Simpan Pengaturan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
