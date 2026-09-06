"use client";

import { useState, useEffect } from "react";
import { DollarSign, Plus, Edit } from "lucide-react";
import { PageHeader, FormRow, FormField } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

export default function StrukturGajiPage() {
  const [salaries, setSalaries] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Multi Advanced Filter State
  const [search, setSearch] = useState("");
  const [filterTipeGaji, setFilterTipeGaji] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    id: null as number | null,
    employee_id: "",
    effective_date: new Date().toISOString().substring(0, 10),
    gaji_pokok_harian: "60000",
    lembur_per_jam: "7000",
    tunjangan_tetap: "0",
    tunjangan_km_tier1: "10000",
    tunjangan_km_tier2: "15000",
    tunjangan_km_tier3: "20000",
    catatan: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [salRes, empRes] = await Promise.all([
        fetch("/api/hr/salary-structures"),
        fetch("/api/hr/employees"),
      ]);
      const [salData, empData] = await Promise.all([salRes.json(), empRes.json()]);
      setSalaries(Array.isArray(salData) ? salData : []);
      setEmployees(Array.isArray(empData) ? empData : []);
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
      setEditingId(s.id);
      setFormData({
        id: s.id,
        employee_id: String(s.employee_id),
        effective_date: s.effective_date ? s.effective_date.substring(0, 10) : new Date().toISOString().substring(0, 10),
        gaji_pokok_harian: String(s.gaji_pokok_harian || "0"),
        lembur_per_jam: String(s.lembur_per_jam || "0"),
        tunjangan_tetap: String(s.tunjangan_tetap || "0"),
        tunjangan_km_tier1: s.tunjangan_km_tier1 ? String(s.tunjangan_km_tier1) : "10000",
        tunjangan_km_tier2: s.tunjangan_km_tier2 ? String(s.tunjangan_km_tier2) : "15000",
        tunjangan_km_tier3: s.tunjangan_km_tier3 ? String(s.tunjangan_km_tier3) : "20000",
        catatan: s.catatan || "",
      });
    } else {
      setEditingId(null);
      setFormData({
        id: null,
        employee_id: employees[0]?.id ? String(employees[0].id) : "",
        effective_date: new Date().toISOString().substring(0, 10),
        gaji_pokok_harian: "60000",
        lembur_per_jam: "7000",
        tunjangan_tetap: "0",
        tunjangan_km_tier1: "10000",
        tunjangan_km_tier2: "15000",
        tunjangan_km_tier3: "20000",
        catatan: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedEmp = employees.find((emp) => String(emp.id) === formData.employee_id);
      const isDriver = selectedEmp?.tipe_gaji === "HARIAN_DRIVER";

      const res = await fetch("/api/hr/salary-structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          id: editingId,
          employee_id: parseInt(formData.employee_id, 10),
          gaji_pokok_harian: parseInt(formData.gaji_pokok_harian, 10) || 0,
          lembur_per_jam: parseInt(formData.lembur_per_jam, 10) || 0,
          tunjangan_tetap: parseInt(formData.tunjangan_tetap, 10) || 0,
          tunjangan_km_tier1: isDriver ? parseInt(formData.tunjangan_km_tier1, 10) : null,
          tunjangan_km_tier2: isDriver ? parseInt(formData.tunjangan_km_tier2, 10) : null,
          tunjangan_km_tier3: isDriver ? parseInt(formData.tunjangan_km_tier3, 10) : null,
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menyimpan struktur gaji");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filter Logic
  const filteredSalaries = salaries.filter((s) => {
    const matchSearch =
      !search ||
      s.nama_lengkap?.toLowerCase().includes(search.toLowerCase()) ||
      s.kode_karyawan?.toLowerCase().includes(search.toLowerCase());
    const matchTipe = !filterTipeGaji || s.tipe_gaji === filterTipeGaji;
    const matchEmp = !filterEmployeeId || String(s.employee_id) === filterEmployeeId;
    return matchSearch && matchTipe && matchEmp;
  });

  // Pagination calculation
  const totalItems = filteredSalaries.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedSalaries = filteredSalaries.slice(startIndex, startIndex + pageSize);

  return (
    <div>
      <PageHeader
        title="Master Struktur Gaji"
        subtitle="Pengaturan komponen gaji pokok, lembur per jam, dan tier kilometer driver per tanggal berlaku"
        actions={
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={14} /> Update / Tambah Tarif Gaji
          </button>
        }
      />

      {/* Multi Advanced Filter Bar */}
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: "14px 18px",
          border: "1px solid #e5e7eb",
          marginBottom: 16,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text"
            placeholder="🔍 Cari nama karyawan / NIP..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: "100%",
              padding: "7px 12px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        <div style={{ width: 180 }}>
          <select
            value={filterTipeGaji}
            onChange={(e) => {
              setFilterTipeGaji(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: "100%",
              padding: "7px 12px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 13,
              outline: "none",
              background: "white",
            }}
          >
            <option value="">Semua Tipe Gaji</option>
            <option value="HARIAN_PRODUKSI">Harian Produksi</option>
            <option value="HARIAN_DRIVER">Harian Driver</option>
            <option value="BULANAN">Bulanan</option>
          </select>
        </div>

        <div style={{ width: 220 }}>
          <select
            value={filterEmployeeId}
            onChange={(e) => {
              setFilterEmployeeId(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: "100%",
              padding: "7px 12px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 13,
              outline: "none",
              background: "white",
            }}
          >
            <option value="">Semua Karyawan</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nama_lengkap} ({e.kode_karyawan})
              </option>
            ))}
          </select>
        </div>

        {(search || filterTipeGaji || filterEmployeeId) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterTipeGaji("");
              setFilterEmployeeId("");
              setCurrentPage(1);
            }}
            style={{
              padding: "7px 12px",
              background: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              cursor: "pointer",
            }}
          >
            Reset Filter
          </button>
        )}
      </div>

      {/* Salary List */}
      <div className="erp-card-flush">
        {loading ? (
          <p style={{ padding: 24, color: "#6b7280", fontSize: 15 }}>Memuat data struktur gaji...</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 48, textAlign: "center" }}>No.</th>
                    <th>Karyawan</th>
                    <th>Tipe Gaji</th>
                    <th>Tanggal Berlaku</th>
                    <th>Gaji Pokok / Hari</th>
                    <th>Lembur / Jam</th>
                    <th>Tier KM (Driver)</th>
                    <th style={{ textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSalaries.map((s, idx) => (
                    <tr key={s.id}>
                      <td style={{ textAlign: "center", color: "#6b7280" }}>{startIndex + idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.nama_lengkap}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{s.kode_karyawan}</div>
                      </td>
                      <td>
                        <Badge color={s.tipe_gaji === "HARIAN_DRIVER" ? "purple" : "blue"}>
                          {s.tipe_gaji}
                        </Badge>
                      </td>
                      <td>{s.effective_date ? s.effective_date.substring(0, 10) : "-"}</td>
                      <td style={{ fontWeight: 600 }}>Rp {Number(s.gaji_pokok_harian || 0).toLocaleString("id-ID")}</td>
                      <td>Rp {Number(s.lembur_per_jam || 0).toLocaleString("id-ID")}</td>
                      <td style={{ fontSize: 12 }}>
                        {s.tunjangan_km_tier1 ? (
                          <div>
                            <div>1-5km: Rp {Number(s.tunjangan_km_tier1).toLocaleString("id-ID")}</div>
                            <div>6-15km: Rp {Number(s.tunjangan_km_tier2).toLocaleString("id-ID")}</div>
                            <div>&gt;15km: Rp {Number(s.tunjangan_km_tier3).toLocaleString("id-ID")}</div>
                          </div>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>-</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenModal(s)}
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={currentPage}
              totalPages={totalPages}
              total={totalItems}
              limit={pageSize}
              onChange={(page) => setCurrentPage(page)}
              onLimitChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </>
        )}
      </div>

      {/* Form Modal */}
      <Modal
        show={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Set Struktur Gaji Karyawan"
        width={500}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FormField label="Pilih Karyawan *">
            <select
              required
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
            >
              <option value="">Pilih Karyawan</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nama_lengkap} ({e.kode_karyawan} - {e.tipe_gaji})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Tanggal Berlaku (Effective Date) *">
            <input
              type="date"
              required
              value={formData.effective_date}
              onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
            />
          </FormField>

          <FormRow>
            <FormField label="Gaji Pokok / Hari (Rp) *">
              <input
                type="number"
                required
                value={formData.gaji_pokok_harian}
                onChange={(e) => setFormData({ ...formData, gaji_pokok_harian: e.target.value })}
              />
            </FormField>
            <FormField label="Lembur / Jam (Rp) *">
              <input
                type="number"
                required
                value={formData.lembur_per_jam}
                onChange={(e) => setFormData({ ...formData, lembur_per_jam: e.target.value })}
              />
            </FormField>
          </FormRow>

          {/* Conditional KM Tiers for Drivers */}
          {employees.find((emp) => String(emp.id) === formData.employee_id)?.tipe_gaji === "HARIAN_DRIVER" && (
            <div style={{ borderTop: "1px dashed #e5e7eb", paddingTop: 10, marginTop: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#5005A6", display: "block", marginBottom: 8 }}>
                🚚 Setting Tarif Tunjangan KM (Driver)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <FormField label="Tier 1 (1-5 KM)">
                  <input
                    type="number"
                    value={formData.tunjangan_km_tier1}
                    onChange={(e) => setFormData({ ...formData, tunjangan_km_tier1: e.target.value })}
                    placeholder="10000"
                  />
                </FormField>
                <FormField label="Tier 2 (6-15 KM)">
                  <input
                    type="number"
                    value={formData.tunjangan_km_tier2}
                    onChange={(e) => setFormData({ ...formData, tunjangan_km_tier2: e.target.value })}
                    placeholder="15000"
                  />
                </FormField>
                <FormField label="Tier 3 (>15 KM)">
                  <input
                    type="number"
                    value={formData.tunjangan_km_tier3}
                    onChange={(e) => setFormData({ ...formData, tunjangan_km_tier3: e.target.value })}
                    placeholder="20000"
                  />
                </FormField>
              </div>
            </div>
          )}

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
