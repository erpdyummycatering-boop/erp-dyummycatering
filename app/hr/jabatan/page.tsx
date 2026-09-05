"use client";

import { useState, useEffect } from "react";
import { Building, Plus, Edit } from "lucide-react";
import { PageHeader, FormRow, FormField } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

export default function JabatanPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"DEPT" | "POS">("DEPT");

  // Pagination State
  const [deptPage, setDeptPage] = useState(1);
  const [deptPageSize, setDeptPageSize] = useState(10);
  const [posPage, setPosPage] = useState(1);
  const [posPageSize, setPosPageSize] = useState(10);

  // Dept Modal
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<any>(null);
  const [deptForm, setDeptForm] = useState({ kode: "", nama: "", deskripsi: "" });

  // Pos Modal
  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [editingPos, setEditingPos] = useState<any>(null);
  const [posForm, setPosForm] = useState({ kode: "", nama: "", department_id: "", tipe_gaji: "HARIAN_PRODUKSI", deskripsi: "" });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [deptRes, posRes] = await Promise.all([
        fetch("/api/hr/departments"),
        fetch("/api/hr/positions"),
      ]);
      const [deptData, posData] = await Promise.all([deptRes.json(), posRes.json()]);
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

  const handleOpenDeptModal = (dept?: any) => {
    if (dept) {
      setEditingDept(dept);
      setDeptForm({ kode: dept.kode, nama: dept.nama, deskripsi: dept.deskripsi || "" });
    } else {
      setEditingDept(null);
      setDeptForm({ kode: "", nama: "", deskripsi: "" });
    }
    setIsDeptModalOpen(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingDept ? `/api/hr/departments/${editingDept.id}` : "/api/hr/departments";
      const method = editingDept ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deptForm),
      });
      if (res.ok) {
        setIsDeptModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menyimpan departemen");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenPosModal = (pos?: any) => {
    if (pos) {
      setEditingPos(pos);
      setPosForm({
        kode: pos.kode,
        nama: pos.nama,
        department_id: String(pos.department_id || ""),
        tipe_gaji: pos.tipe_gaji || "HARIAN_PRODUKSI",
        deskripsi: pos.deskripsi || "",
      });
    } else {
      setEditingPos(null);
      setPosForm({
        kode: "",
        nama: "",
        department_id: departments[0]?.id ? String(departments[0].id) : "",
        tipe_gaji: "HARIAN_PRODUKSI",
        deskripsi: "",
      });
    }
    setIsPosModalOpen(true);
  };

  const handleSavePos = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingPos ? `/api/hr/positions/${editingPos.id}` : "/api/hr/positions";
      const method = editingPos ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...posForm,
          department_id: parseInt(posForm.department_id, 10),
        }),
      });
      if (res.ok) {
        setIsPosModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menyimpan jabatan");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Dept Pagination
  const deptTotal = departments.length;
  const deptTotalPages = Math.ceil(deptTotal / deptPageSize) || 1;
  const deptStartIdx = (deptPage - 1) * deptPageSize;
  const paginatedDepts = departments.slice(deptStartIdx, deptStartIdx + deptPageSize);

  // Pos Pagination
  const posTotal = positions.length;
  const posTotalPages = Math.ceil(posTotal / posPageSize) || 1;
  const posStartIdx = (posPage - 1) * posPageSize;
  const paginatedPositions = positions.slice(posStartIdx, posStartIdx + posPageSize);

  return (
    <div>
      <PageHeader
        title="Departemen & Jabatan"
        subtitle="Kelola struktur organisasi departemen dan posisi jabatan karyawan catering"
        actions={
          activeTab === "DEPT" ? (
            <button className="btn btn-primary" onClick={() => handleOpenDeptModal()}>
              <Plus size={14} /> Tambah Departemen
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => handleOpenPosModal()}>
              <Plus size={14} /> Tambah Jabatan
            </button>
          )
        }
      />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, borderBottom: "1px solid #e5e7eb" }}>
        <button
          onClick={() => setActiveTab("DEPT")}
          style={{
            padding: "10px 16px",
            fontWeight: 600,
            fontSize: 14,
            borderBottom: activeTab === "DEPT" ? "2px solid #5005A6" : "2px solid transparent",
            color: activeTab === "DEPT" ? "#5005A6" : "#6b7280",
            background: "none",
            borderRadius: 0,
          }}
        >
          Master Departemen ({departments.length})
        </button>
        <button
          onClick={() => setActiveTab("POS")}
          style={{
            padding: "10px 16px",
            fontWeight: 600,
            fontSize: 14,
            borderBottom: activeTab === "POS" ? "2px solid #5005A6" : "2px solid transparent",
            color: activeTab === "POS" ? "#5005A6" : "#6b7280",
            background: "none",
            borderRadius: 0,
          }}
        >
          Master Jabatan ({positions.length})
        </button>
      </div>

      {/* Tab Content: Departments */}
      {activeTab === "DEPT" && (
        <div className="erp-card-flush">
          {loading ? (
            <p style={{ padding: 24, color: "#6b7280", fontSize: 15 }}>Memuat data departemen...</p>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 48, textAlign: "center" }}>No.</th>
                      <th>Kode</th>
                      <th>Nama Departemen</th>
                      <th>Deskripsi</th>
                      <th>Jumlah Karyawan</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDepts.map((d, idx) => (
                      <tr key={d.id}>
                        <td style={{ textAlign: "center", color: "#6b7280" }}>{deptStartIdx + idx + 1}</td>
                        <td style={{ fontWeight: 600, color: "#5005A6" }}>{d.kode}</td>
                        <td style={{ fontWeight: 600 }}>{d.nama}</td>
                        <td style={{ color: "#6b7280" }}>{d.deskripsi || "-"}</td>
                        <td>{d.employee_count || 0} Orang</td>
                        <td>
                          <Badge color={d.is_active ? "green" : "red"}>
                            {d.is_active ? "Aktif" : "Non-Aktif"}
                          </Badge>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenDeptModal(d)}
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
                page={deptPage}
                totalPages={deptTotalPages}
                total={deptTotal}
                limit={deptPageSize}
                onChange={(page) => setDeptPage(page)}
                onLimitChange={(size) => {
                  setDeptPageSize(size);
                  setDeptPage(1);
                }}
              />
            </>
          )}
        </div>
      )}

      {/* Tab Content: Positions */}
      {activeTab === "POS" && (
        <div className="erp-card-flush">
          {loading ? (
            <p style={{ padding: 24, color: "#6b7280", fontSize: 15 }}>Memuat data jabatan...</p>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 48, textAlign: "center" }}>No.</th>
                      <th>Kode</th>
                      <th>Nama Jabatan</th>
                      <th>Departemen</th>
                      <th>Tipe Gaji</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPositions.map((p, idx) => (
                      <tr key={p.id}>
                        <td style={{ textAlign: "center", color: "#6b7280" }}>{posStartIdx + idx + 1}</td>
                        <td style={{ fontWeight: 600, color: "#5005A6" }}>{p.kode}</td>
                        <td style={{ fontWeight: 600 }}>{p.nama}</td>
                        <td>{p.department_nama || "-"}</td>
                        <td>
                          <Badge color={p.tipe_gaji === "HARIAN_DRIVER" ? "purple" : "blue"}>
                            {p.tipe_gaji}
                          </Badge>
                        </td>
                        <td>
                          <Badge color={p.is_active ? "green" : "red"}>
                            {p.is_active ? "Aktif" : "Non-Aktif"}
                          </Badge>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenPosModal(p)}
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
                page={posPage}
                totalPages={posTotalPages}
                total={posTotal}
                limit={posPageSize}
                onChange={(page) => setPosPage(page)}
                onLimitChange={(size) => {
                  setPosPageSize(size);
                  setPosPage(1);
                }}
              />
            </>
          )}
        </div>
      )}

      {/* Dept Modal */}
      <Modal
        show={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title={editingDept ? "Edit Departemen" : "Tambah Departemen Baru"}
        width={480}
      >
        <form onSubmit={handleSaveDept} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FormField label="Kode Departemen *">
            <input
              type="text"
              required
              value={deptForm.kode}
              onChange={(e) => setDeptForm({ ...deptForm, kode: e.target.value })}
              placeholder="e.g. PRODUKSI"
            />
          </FormField>
          <FormField label="Nama Departemen *">
            <input
              type="text"
              required
              value={deptForm.nama}
              onChange={(e) => setDeptForm({ ...deptForm, nama: e.target.value })}
            />
          </FormField>
          <FormField label="Deskripsi">
            <textarea
              value={deptForm.deskripsi}
              onChange={(e) => setDeptForm({ ...deptForm, deskripsi: e.target.value })}
              rows={3}
            />
          </FormField>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => setIsDeptModalOpen(false)} className="btn btn-secondary">
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Simpan Data
            </button>
          </div>
        </form>
      </Modal>

      {/* Pos Modal */}
      <Modal
        show={isPosModalOpen}
        onClose={() => setIsPosModalOpen(false)}
        title={editingPos ? "Edit Jabatan" : "Tambah Jabatan Baru"}
        width={480}
      >
        <form onSubmit={handleSavePos} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FormField label="Kode Jabatan *">
            <input
              type="text"
              required
              value={posForm.kode}
              onChange={(e) => setPosForm({ ...posForm, kode: e.target.value })}
              placeholder="e.g. KOKI"
            />
          </FormField>
          <FormField label="Nama Jabatan *">
            <input
              type="text"
              required
              value={posForm.nama}
              onChange={(e) => setPosForm({ ...posForm, nama: e.target.value })}
            />
          </FormField>
          <FormRow>
            <FormField label="Departemen *">
              <select
                required
                value={posForm.department_id}
                onChange={(e) => setPosForm({ ...posForm, department_id: e.target.value })}
              >
                <option value="">Pilih Departemen</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.nama}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Tipe Gaji *">
              <select
                value={posForm.tipe_gaji}
                onChange={(e) => setPosForm({ ...posForm, tipe_gaji: e.target.value })}
              >
                <option value="HARIAN_PRODUKSI">Harian Produksi</option>
                <option value="HARIAN_DRIVER">Harian Driver</option>
              </select>
            </FormField>
          </FormRow>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => setIsPosModalOpen(false)} className="btn btn-secondary">
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
