"use client";

import { useState, useEffect } from "react";
import { Truck, Plus, Search, Phone, Edit3, Trash2, X, CheckCircle, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface Driver {
  id: number;
  name: string;
  phone: string | null;
  status: string;
  lini: string;
  created_at?: string;
}

export default function SiapSajiDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("Aktif");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/siap-saji/drivers");
      if (!res.ok) throw new Error("Gagal memuat data driver");
      const json = await res.json();
      setDrivers(json.data || []);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat daftar driver");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleOpenAdd = () => {
    setEditingDriver(null);
    setName("");
    setPhone("");
    setStatus("Aktif");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (drv: Driver) => {
    setEditingDriver(drv);
    setName(drv.name);
    setPhone(drv.phone || "");
    setStatus(drv.status || "Aktif");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama Driver wajib diisi");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingDriver) {
        // Edit
        const res = await fetch(`/api/siap-saji/drivers/${editingDriver.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null, status }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal memperbarui driver");
        toast.success("Driver berhasil diperbarui");
      } else {
        // Add
        const res = await fetch("/api/siap-saji/drivers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal menambah driver");
        toast.success("Driver baru berhasil ditambahkan");
      }
      setIsModalOpen(false);
      fetchDrivers();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (drv: Driver) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus driver ${drv.name}?`)) return;
    try {
      const res = await fetch(`/api/siap-saji/drivers/${drv.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus driver");
      toast.success("Driver berhasil dihapus");
      fetchDrivers();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat menghapus");
    }
  };

  const filteredDrivers = drivers.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.phone && d.phone.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1e293b", display: "flex", alignItems: "center", gap: "10px" }}>
            <Truck size={28} color="#B10FBD" /> Master Driver (Kurir)
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b", marginTop: "4px" }}>
            Kelola daftar kurir/driver pengiriman Siap Saji untuk alokasi pengiriman order.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#B10FBD",
            color: "#fff",
            padding: "10px 18px",
            borderRadius: "8px",
            fontWeight: "600",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(177, 15, 189, 0.2)",
          }}
        >
          <Plus size={18} /> Tambah Driver
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "24px" }}>
        <div style={{ position: "relative", maxWidth: "400px" }}>
          <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Cari nama driver atau no HP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              paddingLeft: "38px",
              paddingRight: "12px",
              paddingTop: "8px",
              paddingBottom: "8px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "14px",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Data Table */}
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Memuat daftar driver...</div>
        ) : filteredDrivers.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
            Belum ada data driver{search ? " yang sesuai pencarian" : ""}.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: "600" }}>
                <th style={{ padding: "12px 16px", width: "60px" }}>No</th>
                <th style={{ padding: "12px 16px" }}>Nama Driver</th>
                <th style={{ padding: "12px 16px" }}>No. Telepon / WhatsApp</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.map((drv, idx) => (
                <tr key={drv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 16px", color: "#64748b" }}>{idx + 1}</td>
                  <td style={{ padding: "12px 16px", fontWeight: "600", color: "#0f172a" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <UserCheck size={16} color="#B10FBD" />
                      {drv.name}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#334155" }}>
                    {drv.phone ? (
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Phone size={14} color="#64748b" /> {drv.phone}
                      </span>
                    ) : (
                      <span style={{ color: "#94a3b8", fontStyle: "italic" }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: "600",
                        background: drv.status === "Aktif" ? "#dcfce7" : "#f1f5f9",
                        color: drv.status === "Aktif" ? "#15803d" : "#64748b",
                      }}
                    >
                      {drv.status || "Aktif"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                      <button
                        onClick={() => handleOpenEdit(drv)}
                        title="Edit Driver"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#3b82f6",
                          padding: "4px",
                        }}
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(drv)}
                        title="Hapus Driver"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#ef4444",
                          padding: "4px",
                        }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Add/Edit Driver */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div style={{ background: "#fff", width: "100%", maxWidth: "450px", borderRadius: "12px", overflow: "hidden", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>
                {editingDriver ? "Edit Driver" : "Tambah Driver Baru"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                  Nama Driver *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: driver Hendi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                  No. Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 08123456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>

              {editingDriver && (
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                    Status
                  </label>
                  <SearchableSelect
                    options={[
                      { value: "Aktif", label: "Aktif" },
                      { value: "Non-Aktif", label: "Non-Aktif" },
                    ]}
                    value={status}
                    onChange={(val) => setStatus(val ? String(val) : "Aktif")}
                    placeholder="Pilih Status"
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#475569",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#B10FBD",
                    color: "#fff",
                    fontWeight: "600",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
