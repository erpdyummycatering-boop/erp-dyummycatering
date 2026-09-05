"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Search, Edit, Trash2, CheckCircle, XCircle, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import { PageHeader, FormRow, FormField } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

export default function KaryawanPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("AKTIF");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any>(null);
  const [formData, setFormData] = useState({
    nama_fingerprint: "",
    nama_lengkap: "",
    department_id: "",
    position_id: "",
    tipe_karyawan: "TETAP",
    tipe_gaji: "HARIAN_PRODUKSI",
    no_fingerprint: "",
    no_ktp: "",
    no_telepon: "",
    email: "",
    tanggal_masuk: new Date().toISOString().substring(0, 10),
    gaji_pokok_harian: "60000",
    lembur_per_jam: "7000",
    tunjangan_km_tier1: "10000",
    tunjangan_km_tier2: "15000",
    tunjangan_km_tier3: "20000",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, deptRes, posRes] = await Promise.all([
        fetch("/api/hr/employees"),
        fetch("/api/hr/departments"),
        fetch("/api/hr/positions"),
      ]);
      const [empData, deptData, posData] = await Promise.all([
        empRes.json(),
        deptRes.json(),
        posRes.json(),
      ]);
      setEmployees(Array.isArray(empData) ? empData : []);
      setDepartments(Array.isArray(deptData) ? deptData : []);
      setPositions(Array.isArray(posData) ? posData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (emp?: any) => {
    if (emp) {
      setEditingEmp(emp);
      setFormData({
        nama_fingerprint: emp.nama_fingerprint || "",
        nama_lengkap: emp.nama_lengkap || "",
        department_id: String(emp.department_id || ""),
        position_id: String(emp.position_id || ""),
        tipe_karyawan: emp.tipe_karyawan || "TETAP",
        tipe_gaji: emp.tipe_gaji || "HARIAN_PRODUKSI",
        no_fingerprint: emp.no_fingerprint ? String(emp.no_fingerprint) : "",
        no_ktp: emp.no_ktp || "",
        no_telepon: emp.no_telepon || "",
        email: emp.email || "",
        tanggal_masuk: emp.tanggal_masuk ? emp.tanggal_masuk.substring(0, 10) : new Date().toISOString().substring(0, 10),
        gaji_pokok_harian: emp.gaji_pokok_harian ? String(emp.gaji_pokok_harian) : "60000",
        lembur_per_jam: emp.lembur_per_jam ? String(emp.lembur_per_jam) : "7000",
        tunjangan_km_tier1: emp.tunjangan_km_tier1 ? String(emp.tunjangan_km_tier1) : "10000",
        tunjangan_km_tier2: emp.tunjangan_km_tier2 ? String(emp.tunjangan_km_tier2) : "15000",
        tunjangan_km_tier3: emp.tunjangan_km_tier3 ? String(emp.tunjangan_km_tier3) : "20000",
      });
    } else {
      setEditingEmp(null);
      setFormData({
        nama_fingerprint: "",
        nama_lengkap: "",
        department_id: departments[0]?.id ? String(departments[0].id) : "",
        position_id: positions[0]?.id ? String(positions[0].id) : "",
        tipe_karyawan: "TETAP",
        tipe_gaji: "HARIAN_PRODUKSI",
        no_fingerprint: "",
        no_ktp: "",
        no_telepon: "",
        email: "",
        tanggal_masuk: new Date().toISOString().substring(0, 10),
        gaji_pokok_harian: "60000",
        lembur_per_jam: "7000",
        tunjangan_km_tier1: "10000",
        tunjangan_km_tier2: "15000",
        tunjangan_km_tier3: "20000",
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingEmp ? `/api/hr/employees/${editingEmp.id}` : "/api/hr/employees";
      const method = editingEmp ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menyimpan data karyawan");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleStatus = async (emp: any) => {
    const newStatus = emp.status === "AKTIF" ? "NON_AKTIF" : "AKTIF";
    if (!confirm(`Ubah status karyawan ${emp.nama_lengkap} menjadi ${newStatus}?`)) return;

    try {
      const res = await fetch(`/api/hr/employees/${emp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filteredEmployees.map((e, idx) => ({
      "No": idx + 1,
      "Kode Karyawan": e.kode_karyawan,
      "Nama Lengkap": e.nama_lengkap,
      "Nama Fingerprint": e.nama_fingerprint,
      "Departemen": e.department_nama,
      "Jabatan": e.position_nama,
      "Tipe Karyawan": e.tipe_karyawan,
      "Tipe Gaji": e.tipe_gaji,
      "No Fingerprint": e.no_fingerprint || "-",
      "Tanggal Masuk": e.tanggal_masuk ? e.tanggal_masuk.substring(0, 10) : "-",
      "Gaji Pokok/Hari": e.gaji_pokok_harian || 0,
      "Lembur/Jam": e.lembur_per_jam || 0,
      "Status": e.status,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Karyawan");
    XLSX.writeFile(wb, "Data_Karyawan_Catering.xlsx");
  };

  const filteredEmployees = employees.filter((e) => {
    const matchSearch =
      e.nama_lengkap.toLowerCase().includes(search.toLowerCase()) ||
      e.nama_fingerprint.toLowerCase().includes(search.toLowerCase()) ||
      e.kode_karyawan.toLowerCase().includes(search.toLowerCase());
    const matchDept = !selectedDept || String(e.department_id) === selectedDept;
    const matchStatus = !selectedStatus || e.status === selectedStatus;
    return matchSearch && matchDept && matchStatus;
  });

  const totalItems = filteredEmployees.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedEmployees = filteredEmployees.slice(startIndex, startIndex + pageSize);

  return (
    <div className="p-6">
      <PageHeader
        title="Master Data Karyawan"
        subtitle={`Kelola profil karyawan, departemen, jabatan, dan struktur dasar gaji (${totalItems} data)`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExportExcel}>
              <FileSpreadsheet size={14} /> Export Excel
            </button>
            <button className="btn btn-primary" onClick={() => handleOpenModal()}>
              <Plus size={14} /> Tambah Karyawan
            </button>
          </div>
        }
      />

      <div className="erp-card" style={{ marginBottom: 12, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "center", overflowX: "auto" }}>
          <div style={{ position: "relative", minWidth: 240, flexShrink: 0 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input
              type="text"
              placeholder="Cari nama, fingerprint, kode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 30 }}
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            style={{ width: 180, flexShrink: 0 }}
          >
            <option value="">Semua Departemen</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nama}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ width: 140, flexShrink: 0 }}
          >
            <option value="">Semua Status</option>
            <option value="AKTIF">Aktif</option>
            <option value="NON_AKTIF">Non-Aktif</option>
          </select>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearch("");
              setSelectedDept("");
              setSelectedStatus("AKTIF");
            }}
            style={{ flexShrink: 0 }}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="erp-card-flush">
        {loading ? (
          <p style={{ padding: 24, color: "#6b7280", fontSize: 15 }}>Memuat data karyawan...</p>
        ) : filteredEmployees.length === 0 ? (
          <p style={{ padding: 24, color: "#6b7280", fontSize: 15, textAlign: "center" }}>Tidak ada data karyawan ditemukan.</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 48, textAlign: "center" }}>No.</th>
                    <th>Kode / ID</th>
                    <th>Nama Lengkap</th>
                    <th>Nama Fingerprint</th>
                    <th>Dept / Jabatan</th>
                    <th>Tipe Karyawan</th>
                    <th>Gaji Pokok / Hari</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEmployees.map((emp, idx) => (
                    <tr key={emp.id}>
                      <td style={{ textAlign: "center", color: "#6b7280" }}>{startIndex + idx + 1}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: "#5005A6" }}>{emp.kode_karyawan}</span>
                        {emp.no_fingerprint && (
                          <div style={{ fontSize: 12, color: "#6b7280" }}>FP ID: #{emp.no_fingerprint}</div>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{emp.nama_lengkap}</td>
                      <td>{emp.nama_fingerprint}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{emp.department_nama || "-"}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{emp.position_nama || "-"}</div>
                      </td>
                      <td>
                        <Badge color={emp.tipe_karyawan === "TETAP" ? "purple" : "gray"}>
                          {emp.tipe_karyawan}
                        </Badge>
                      </td>
                      <td>Rp {Number(emp.gaji_pokok_harian || 0).toLocaleString("id-ID")}</td>
                      <td>
                        <Badge color={emp.status === "AKTIF" ? "green" : "red"}>
                          {emp.status === "AKTIF" ? "Aktif" : "Non-Aktif"}
                        </Badge>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenModal(emp)}
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className={emp.status === "AKTIF" ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}
                            onClick={() => handleToggleStatus(emp)}
                            title={emp.status === "AKTIF" ? "Nonaktifkan" : "Aktifkan"}
                          >
                            {emp.status === "AKTIF" ? <XCircle size={14} style={{ color: "#E24B4A" }} /> : <CheckCircle size={14} />}
                          </button>
                        </div>
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

      <Modal
        show={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEmp ? "Edit Karyawan" : "Tambah Karyawan Baru"}
        width={680}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FormRow>
            <FormField label="Nama Fingerprint (Match Export) *">
              <input
                type="text"
                required
                value={formData.nama_fingerprint}
                onChange={(e) => setFormData({ ...formData, nama_fingerprint: e.target.value })}
                placeholder="misal: Wiwi Sumiati"
              />
            </FormField>
            <FormField label="Nama Lengkap *">
              <input
                type="text"
                required
                value={formData.nama_lengkap}
                onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
              />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Departemen *">
              <select
                required
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
              >
                <option value="">Pilih Departemen</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nama}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Jabatan *">
              <select
                required
                value={formData.position_id}
                onChange={(e) => setFormData({ ...formData, position_id: e.target.value })}
              >
                <option value="">Pilih Jabatan</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} ({p.tipe_gaji})
                  </option>
                ))}
              </select>
            </FormField>
          </FormRow>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <FormField label="Tipe Karyawan">
              <select
                value={formData.tipe_karyawan}
                onChange={(e) => setFormData({ ...formData, tipe_karyawan: e.target.value })}
              >
                <option value="TETAP">TETAP</option>
                <option value="FREELANCE">FREELANCE</option>
                <option value="TRAINING">TRAINING</option>
                <option value="DRIVER">DRIVER</option>
              </select>
            </FormField>
            <FormField label="Tipe Gaji">
              <select
                value={formData.tipe_gaji}
                onChange={(e) => setFormData({ ...formData, tipe_gaji: e.target.value })}
              >
                <option value="HARIAN_PRODUKSI">Harian Produksi</option>
                <option value="HARIAN_DRIVER">Harian Driver</option>
              </select>
            </FormField>
            <FormField label="No. Fingerprint">
              <input
                type="number"
                value={formData.no_fingerprint}
                onChange={(e) => setFormData({ ...formData, no_fingerprint: e.target.value })}
                placeholder="misal: 40"
              />
            </FormField>
          </div>

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 14, marginTop: 4 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: "#5005A6", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Komponen Gaji Dasar (Rupiah)
            </h4>
            <FormRow>
              <FormField label="Gaji Pokok / Hari *">
                <input
                  type="number"
                  required
                  value={formData.gaji_pokok_harian}
                  onChange={(e) => setFormData({ ...formData, gaji_pokok_harian: e.target.value })}
                />
              </FormField>
              <FormField label="Lembur / Jam">
                <input
                  type="number"
                  value={formData.lembur_per_jam}
                  onChange={(e) => setFormData({ ...formData, lembur_per_jam: e.target.value })}
                />
              </FormField>
            </FormRow>

            {formData.tipe_gaji === "HARIAN_DRIVER" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, background: "#f9fafb", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}>
                <FormField label="Tier 1 (1-5km)">
                  <input
                    type="number"
                    value={formData.tunjangan_km_tier1}
                    onChange={(e) => setFormData({ ...formData, tunjangan_km_tier1: e.target.value })}
                  />
                </FormField>
                <FormField label="Tier 2 (6-15km)">
                  <input
                    type="number"
                    value={formData.tunjangan_km_tier2}
                    onChange={(e) => setFormData({ ...formData, tunjangan_km_tier2: e.target.value })}
                  />
                </FormField>
                <FormField label="Tier 3 (>15km)">
                  <input
                    type="number"
                    value={formData.tunjangan_km_tier3}
                    onChange={(e) => setFormData({ ...formData, tunjangan_km_tier3: e.target.value })}
                  />
                </FormField>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              Simpan Data
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
