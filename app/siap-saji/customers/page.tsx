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
  total_saved_addresses?: number;
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

  // Address Management Modal
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [selectedCustForAddress, setSelectedCustForAddress] = useState<Customer | null>(null);
  const [modalAddresses, setModalAddresses] = useState<any[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [newAddrLabel, setNewAddrLabel] = useState("Rumah");
  const [newAddrText, setNewAddrText] = useState("");
  const [newAddrPatokan, setNewAddrPatokan] = useState("");
  const [newAddrAreaId, setNewAddrAreaId] = useState<number | "">("");
  const [isSavingNewAddr, setIsSavingNewAddr] = useState(false);

  const fetchCustomerAddressesList = async (custId: number) => {
    setLoadingAddresses(true);
    try {
      const res = await fetch(`/api/siap-saji/customers/${custId}/addresses`);
      if (res.ok) {
        const json = await res.json();
        setModalAddresses(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleOpenAddressModal = (cust: Customer) => {
    setSelectedCustForAddress(cust);
    setNewAddrLabel("Rumah");
    setNewAddrText("");
    setNewAddrPatokan("");
    setNewAddrAreaId(cust.area_id || (areas.length > 0 ? areas[0].id : ""));
    setIsAddressModalOpen(true);
    fetchCustomerAddressesList(cust.id);
  };

  const handleSaveAddressFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustForAddress) return;
    if (!newAddrText.trim()) return toast.error("Alamat lengkap wajib diisi");
    if (!newAddrAreaId) return toast.error("Kecamatan wajib dipilih");

    setIsSavingNewAddr(true);
    try {
      const res = await fetch(`/api/siap-saji/customers/${selectedCustForAddress.id}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newAddrLabel.trim() || "Alamat",
          address: newAddrText.trim(),
          patokan: newAddrPatokan.trim(),
          area_id: newAddrAreaId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan alamat");

      toast.success("Alamat berhasil ditambahkan!");
      setNewAddrText("");
      setNewAddrPatokan("");
      fetchCustomerAddressesList(selectedCustForAddress.id);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan alamat");
    } finally {
      setIsSavingNewAddr(false);
    }
  };

  const handleDeleteAddressFromModal = async (addrId: number, label: string) => {
    if (!selectedCustForAddress) return;
    if (!confirm(`Hapus variasi alamat "${label}"?`)) return;
    try {
      const res = await fetch(`/api/siap-saji/customers/${selectedCustForAddress.id}/addresses?address_id=${addrId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus alamat");

      toast.success("Alamat berhasil dihapus");
      fetchCustomerAddressesList(selectedCustForAddress.id);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus alamat");
    }
  };

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
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto", maxWidth: "100%" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, textAlign: "left", fontSize: 13, whiteSpace: "nowrap" }}>
          <thead>
            <tr style={{ background: "#fafafa", color: "#6b7280", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
              <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 10px", width: 40 }}>No.</th>
              <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px" }}>Nama Pelanggan</th>
              <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px" }}>No. HP / WA</th>
              <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px" }}>Kecamatan</th>
              <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px" }}>Alamat Lengkap</th>
              <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px" }}>Patokan / Landmark</th>
              <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px", textAlign: "center" }}>Order</th>
              <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px" }}>Total Omset</th>
              <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px" }}>Poin Loyalty</th>
              <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px" }}>Segmen RFM</th>
              <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px", textAlign: "right" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  Memuat data pelanggan...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  Tidak ada pelanggan Siap Saji ditemukan.
                </td>
              </tr>
            ) : (
              customers.map((c, idx) => {
                const segmenName = Number(c.total_orders || 0) === 0 ? "New Customers" : (c.segmen || "New Customers");
                const sStyle = getSegmenBadgeStyle(segmenName);
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 10px", color: "#6b7280", borderBottom: "1px solid #f3f4f6" }}>{(meta.page - 1) * meta.limit + idx + 1}</td>
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid #f3f4f6" }}>
                      <span
                        onClick={() => handleViewDetail(c.id)}
                        style={{ fontWeight: 700, color: "#5005A6", cursor: "pointer" }}
                        title="Klik untuk lihat detail brief pelanggan"
                      >
                        {c.name}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid #f3f4f6" }}>
                      {c.phone ? (
                        <a
                          href={getWhatsAppUrl(c.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 12,
                            color: "#16a34a",
                            fontWeight: 700,
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          title="Chat WhatsApp (Buka Tab Baru)"
                        >
                          💬 {c.phone}
                        </a>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid #f3f4f6", fontWeight: 600, color: "#374151" }}>
                      {c.area_kecamatan ? `${c.area_kecamatan}` : "-"}
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid #f3f4f6", color: "#4b5563" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{c.address || "-"}</span>
                        {Number(c.total_saved_addresses || 0) > 1 && (
                          <span
                            onClick={() => handleViewDetail(c.id)}
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              background: "#f3e8ff",
                              color: "#6d28d9",
                              padding: "2px 6px",
                              borderRadius: 12,
                              border: "1px solid #ddd6fe",
                              cursor: "pointer",
                            }}
                            title="Klik untuk melihat semua daftar alamat pelanggan ini"
                          >
                            📍 {c.total_saved_addresses} Alamat
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid #f3f4f6", color: "#b10fbd", fontWeight: 600 }}>
                      {c.patokan ? `📍 ${c.patokan}` : "-"}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, borderBottom: "1px solid #f3f4f6" }}>
                      {c.total_orders || 0}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "#5005A6", borderBottom: "1px solid #f3f4f6" }}>
                      Rp {Number(c.total_omset || 0).toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 800, color: "#15803d", borderBottom: "1px solid #f3f4f6" }}>
                      ⭐ {Number(c.loyalty_points || 0).toLocaleString("id-ID")} Poin
                    </td>
                    <td style={{ padding: "12px 14px", borderBottom: "1px solid #f3f4f6" }}>
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
                          onClick={() => handleOpenAddressModal(c)}
                          title="Kelola Daftar Alamat Pengiriman (Multi-Alamat)"
                          style={{ padding: "5px 8px", background: "#f3e8ff", color: "#6d28d9", border: "1px solid #ddd6fe", borderRadius: 6, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 700 }}
                        >
                          <MapPin size={14} />
                          {Number(c.total_saved_addresses || 0) > 0 ? c.total_saved_addresses : ""}
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

      {/* ── MODAL: KELOLA MULTI-ALAMAT PELANGGAN ──────────── */}
      {isAddressModalOpen && selectedCustForAddress && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 125,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div style={{ background: "white", borderRadius: 16, maxWidth: 640, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid #e5e7eb" }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <MapPin size={20} color="#6d28d9" /> Daftar Alamat Pelanggan: {selectedCustForAddress.name}
                </h3>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
                  Kelola alamat rumah, kantor, atau cabang pengiriman yang akan tersinkron otomatis ke Form Order
                </p>
              </div>
              <button onClick={() => setIsAddressModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              {/* Form Tambah Alamat Baru */}
              <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "#6d28d9" }}>
                  + Tambah Variasi Alamat Baru
                </h4>
                <form onSubmit={handleSaveAddressFromModal}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 3 }}>
                        Label (Rumah, Kantor, Toko, dsb)
                      </label>
                      <input
                        type="text"
                        value={newAddrLabel}
                        onChange={(e) => setNewAddrLabel(e.target.value)}
                        placeholder="Contoh: Kantor Utama"
                        style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 3 }}>
                        Kecamatan / Area *
                      </label>
                      <select
                        value={newAddrAreaId}
                        onChange={(e) => setNewAddrAreaId(Number(e.target.value))}
                        style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }}
                        required
                      >
                        <option value="">-- Pilih Kecamatan --</option>
                        {areas.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.kecamatan} ({a.kota})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 3 }}>
                      Alamat Lengkap *
                    </label>
                    <textarea
                      rows={2}
                      value={newAddrText}
                      onChange={(e) => setNewAddrText(e.target.value)}
                      placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan..."
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }}
                      required
                    />
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 3 }}>
                        Patokan / Landmark Lokasi (Untuk Kurir)
                      </label>
                      <input
                        type="text"
                        value={newAddrPatokan}
                        onChange={(e) => setNewAddrPatokan(e.target.value)}
                        placeholder="Contoh: Sebelah Alfamart, pagar hitam"
                        style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSavingNewAddr}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        background: "#5005A6",
                        color: "white",
                        border: "none",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: isSavingNewAddr ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isSavingNewAddr ? "Menyimpan..." : "+ Simpan Alamat"}
                    </button>
                  </div>
                </form>
              </div>

              {/* List Alamat Tersimpan */}
              <div>
                <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#374151" }}>
                  Alamat Tersimpan Saat Ini ({modalAddresses.length})
                </h4>
                {loadingAddresses ? (
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Memuat daftar alamat...</p>
                ) : modalAddresses.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", background: "#f9fafb", borderRadius: 8, border: "1px dashed #d1d5db", color: "#6b7280", fontSize: 13 }}>
                    Belum ada variasi alamat tersimpan di database untuk customer ini.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {modalAddresses.map((addr) => (
                      <div
                        key={addr.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          padding: 12,
                          background: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ flex: 1, marginRight: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, background: "#7c3aed", color: "white", padding: "2px 6px", borderRadius: 4 }}>
                              🏷️ {addr.label || "Alamat"}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                              Kec. {addr.area_kecamatan || "-"} ({addr.area_kota || "Bandung"})
                            </span>
                          </div>
                          <p style={{ margin: "0 0 3px", fontSize: 13, color: "#111827", lineHeight: 1.3 }}>
                            {addr.address}
                          </p>
                          {addr.patokan && (
                            <p style={{ margin: 0, fontSize: 12, color: "#b10fbd", fontWeight: 600 }}>
                              📍 Patokan: {addr.patokan}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAddressFromModal(addr.id, addr.label || addr.address)}
                          style={{
                            background: "#fee2e2",
                            color: "#dc2626",
                            border: "1px solid #fca5a5",
                            borderRadius: 6,
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                          title="Hapus alamat ini"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 24px", borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
