"use client";

import { useState, useEffect } from "react";
import { PageHeader, FormField } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

export default function KoreksiPresensiPage() {
  const [attendances, setAttendances] = useState<any[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAtt, setSelectedAtt] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fieldChanged, setFieldChanged] = useState("jam_masuk");
  const [nilaiSesudah, setNilaiSesudah] = useState("");
  const [alasan, setAlasan] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [attRes, corrRes] = await Promise.all([
        fetch("/api/hr/attendance?year=2026&month=9"),
        fetch("/api/hr/attendance/corrections"),
      ]);
      const [attData, corrData] = await Promise.all([attRes.json(), corrRes.json()]);
      setAttendances(Array.isArray(attData) ? attData : []);
      setCorrections(Array.isArray(corrData) ? corrData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCorrection = (att: any) => {
    setSelectedAtt(att);
    setFieldChanged("jam_masuk");
    setNilaiSesudah(att.jam_masuk || "08:00");
    setAlasan("");
    setIsModalOpen(true);
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAtt) return;

    try {
      const nilaiSebelum = selectedAtt[fieldChanged] || "";
      const res = await fetch("/api/hr/attendance/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendance_id: selectedAtt.id,
          field_changed: fieldChanged,
          nilai_sebelum: nilaiSebelum,
          nilai_sesudah: nilaiSesudah,
          alasan: alasan,
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menyimpan koreksi presensi");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Pagination Calculation
  const totalItems = attendances.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedAttendances = attendances.slice(startIndex, startIndex + pageSize);

  return (
    <div>
      <PageHeader
        title="Koreksi Presensi & Audit Trail"
        subtitle="HRD dapat melakukan koreksi jam presensi sebelum payroll difinalisasi. Semua perubahan dicatat dalam audit log"
      />

      {/* Grid 2 Columns: Correction Form Table + Audit Log */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Table Presensi Siap Dikoreksi */}
        <div className="erp-card-flush">
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, fontSize: 16, color: "#111827" }}>
            Daftar Presensi Harian (Siap Koreksi)
          </div>

          {loading ? (
            <p style={{ padding: 24, color: "#6b7280", fontSize: 15 }}>Memuat data presensi...</p>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 48, textAlign: "center" }}>No.</th>
                      <th>Tanggal</th>
                      <th>Karyawan</th>
                      <th>Masuk</th>
                      <th>Keluar</th>
                      <th>Ket</th>
                      <th style={{ textAlign: "right" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAttendances.map((a, idx) => (
                      <tr key={a.id}>
                        <td style={{ textAlign: "center", color: "#6b7280" }}>{startIndex + idx + 1}</td>
                        <td>{a.tanggal ? a.tanggal.substring(0, 10) : "-"}</td>
                        <td style={{ fontWeight: 600 }}>{a.nama_lengkap}</td>
                        <td>{a.jam_masuk || "-"}</td>
                        <td>{a.jam_keluar || "-"}</td>
                        <td>
                          <Badge color="gray">{a.keterangan}</Badge>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleOpenCorrection(a)}
                          >
                            Koreksi
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

        {/* Audit Trail List */}
        <div className="erp-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
            Log Audit Koreksi
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 500, overflowY: "auto" }}>
            {corrections.length === 0 ? (
              <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "24px 0" }}>Belum ada riwayat koreksi.</p>
            ) : (
              corrections.map((c) => (
                <div key={c.id} style={{ padding: 10, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "#5005A6" }}>
                    <span>{c.nama_karyawan}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>
                      {c.created_at ? c.created_at.substring(0, 16).replace("T", " ") : ""}
                    </span>
                  </div>
                  <div style={{ color: "#374151", marginTop: 4 }}>
                    Ubah <strong style={{ background: "#e5e7eb", padding: "1px 4px", borderRadius: 4 }}>{c.field_changed}</strong> dari{" "}
                    <span style={{ textDecoration: "line-through", color: "#E24B4A" }}>{c.nilai_sebelum || "KOSONG"}</span> →{" "}
                    <span style={{ color: "#639922", fontWeight: 700 }}>{c.nilai_sesudah}</span>
                  </div>
                  <div style={{ color: "#6b7280", fontStyle: "italic", marginTop: 2 }}>"Alasan: {c.alasan}"</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal Koreksi */}
      <Modal
        show={isModalOpen && Boolean(selectedAtt)}
        onClose={() => setIsModalOpen(false)}
        title="Koreksi Presensi Karyawan"
        width={480}
      >
        {selectedAtt && (
          <form onSubmit={handleSaveCorrection} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              Karyawan: <strong style={{ color: "#111827" }}>{selectedAtt.nama_lengkap}</strong> (Tanggal: {selectedAtt.tanggal?.substring(0, 10)})
            </div>

            <FormField label="Kolom yang Dikoreksi *">
              <select
                value={fieldChanged}
                onChange={(e) => {
                  setFieldChanged(e.target.value);
                  setNilaiSesudah(selectedAtt[e.target.value] || "");
                }}
              >
                <option value="jam_masuk">Jam Masuk</option>
                <option value="jam_keluar">Jam Keluar</option>
                <option value="keterangan">Keterangan (HADIR/ABSEN/CUTI/SAKIT/IZIN)</option>
              </select>
            </FormField>

            <FormField label="Nilai Baru *">
              <input
                type="text"
                required
                value={nilaiSesudah}
                onChange={(e) => setNilaiSesudah(e.target.value)}
              />
            </FormField>

            <FormField label="Alasan Koreksi (Wajib untuk Audit) *">
              <textarea
                required
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="misal: Lupa scan fingerprint / HP mati"
                rows={3}
              />
            </FormField>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                Batal
              </button>
              <button type="submit" className="btn btn-primary">
                Simpan Koreksi
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
