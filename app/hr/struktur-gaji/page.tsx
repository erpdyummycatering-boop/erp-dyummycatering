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

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
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
      setFormData({
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
      setFormData({
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

  // Pagination calculation
  const totalItems = salaries.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedSalaries = salaries.slice(startIndex, startIndex + pageSize);

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
