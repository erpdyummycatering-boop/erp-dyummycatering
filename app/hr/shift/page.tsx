"use client";

import { useState, useEffect } from "react";
import { Plus, Edit } from "lucide-react";
import { PageHeader, FormRow, FormField } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

export default function ShiftPage() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<any>(null);
  const [formData, setFormData] = useState({
    kode: "",
    nama: "",
    jam_masuk: "08:00",
    jam_keluar: "17:00",
    jam_kerja_normal_menit: "480",
    toleransi_terlambat_menit: "15",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hr/shifts");
      const data = await res.json();
      setShifts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (s?: any) => {
    if (s) {
      setEditingShift(s);
      setFormData({
        kode: s.kode,
        nama: s.nama,
        jam_masuk: s.jam_masuk || "08:00",
        jam_keluar: s.jam_keluar || "17:00",
        jam_kerja_normal_menit: String(s.jam_kerja_normal_menit || 480),
        toleransi_terlambat_menit: String(s.toleransi_terlambat_menit || 15),
      });
    } else {
      setEditingShift(null);
      setFormData({
        kode: "",
        nama: "",
        jam_masuk: "08:00",
        jam_keluar: "17:00",
        jam_kerja_normal_menit: "480",
        toleransi_terlambat_menit: "15",
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingShift ? `/api/hr/shifts/${editingShift.id}` : "/api/hr/shifts";
      const method = editingShift ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          jam_kerja_normal_menit: parseInt(formData.jam_kerja_normal_menit, 10),
          toleransi_terlambat_menit: parseInt(formData.toleransi_terlambat_menit, 10),
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menyimpan shift");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Master Jadwal Shift"
        subtitle="Pengaturan definisi jam masuk/keluar shift kerja dan toleransi keterlambatan"
        actions={
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={14} /> Tambah Shift Baru
          </button>
        }
      />

      {/* Shifts Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {loading ? (
          <p style={{ padding: 24, color: "#6b7280", fontSize: 15 }}>Memuat master shift...</p>
        ) : (
          shifts.map((s) => (
            <div key={s.id} className="erp-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Badge color="purple">{s.kode}</Badge>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenModal(s)}
                  title="Edit"
                >
                  <Edit size={14} />
                </button>
              </div>

              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{s.nama}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 14, color: "#4b5563" }}>
                  <span style={{ background: "#f3f4f6", padding: "2px 8px", borderRadius: 4 }}>Masuk: {s.jam_masuk}</span>
                  <span>-</span>
                  <span style={{ background: "#f3f4f6", padding: "2px 8px", borderRadius: 4 }}>Keluar: {s.jam_keluar}</span>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 10, fontSize: 13, color: "#6b7280" }}>
                <div>Jam Kerja Standar: <strong style={{ color: "#111827" }}>{s.jam_kerja_normal_menit / 60} Jam ({s.jam_kerja_normal_menit} Menit)</strong></div>
                <div>Toleransi Terlambat: <strong style={{ color: "#639922" }}>{s.toleransi_terlambat_menit} Menit</strong></div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        show={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingShift ? "Edit Shift" : "Tambah Shift Baru"}
        width={480}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FormField label="Kode Shift *">
            <input
              type="text"
              required
              value={formData.kode}
              onChange={(e) => setFormData({ ...formData, kode: e.target.value })}
              placeholder="e.g. SHIFT_PAGI"
            />
          </FormField>
          <FormField label="Nama Shift *">
            <input
              type="text"
              required
              value={formData.nama}
              onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
            />
          </FormField>
          <FormRow>
            <FormField label="Jam Masuk *">
              <input
                type="time"
                required
                value={formData.jam_masuk}
                onChange={(e) => setFormData({ ...formData, jam_masuk: e.target.value })}
              />
            </FormField>
            <FormField label="Jam Keluar *">
              <input
                type="time"
                required
                value={formData.jam_keluar}
                onChange={(e) => setFormData({ ...formData, jam_keluar: e.target.value })}
              />
            </FormField>
          </FormRow>
          <FormField label="Toleransi Terlambat (Menit)">
            <input
              type="number"
              value={formData.toleransi_terlambat_menit}
              onChange={(e) => setFormData({ ...formData, toleransi_terlambat_menit: e.target.value })}
            />
          </FormField>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Simpan Data
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
