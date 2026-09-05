"use client";

import { useState, useEffect } from "react";
import { FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";

export default function RekapKehadiranPage() {
  const [attendances, setAttendances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState("2026");
  const [month, setMonth] = useState("9");
  const [anomaliOnly, setAnomaliOnly] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchAttendances = async () => {
    setLoading(true);
    try {
      let url = `/api/hr/attendance?year=${year}&month=${month}`;
      if (anomaliOnly) url += `&is_anomali=true`;
      const res = await fetch(url);
      const data = await res.json();
      setAttendances(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendances();
  }, [year, month, anomaliOnly]);

  useEffect(() => {
    setCurrentPage(1);
  }, [year, month, anomaliOnly, pageSize]);

  const handleExportExcel = () => {
    const dataToExport = attendances.map((a, idx) => ({
      "No": idx + 1,
      "Kode Karyawan": a.kode_karyawan,
      "Nama Karyawan": a.nama_lengkap,
      "Departemen": a.department_nama,
      "Jabatan": a.position_nama,
      "Tanggal": a.tanggal ? a.tanggal.substring(0, 10) : "-",
      "Jam Masuk": a.jam_masuk || "-",
      "Jam Keluar": a.jam_keluar || "-",
      "Keterangan": a.keterangan,
      "Terlambat (Menit)": a.terlambat_menit || 0,
      "Lembur (Menit)": a.lembur_menit || 0,
      "Tidak Scan Lengkap": a.tidak_scan_lengkap ? "YA" : "TIDAK",
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Presensi_${month}_${year}`);
    XLSX.writeFile(wb, `Rekap_Presensi_${month}_${year}.xlsx`);
  };

  // Pagination Calculation
  const totalItems = attendances.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedAttendances = attendances.slice(startIndex, startIndex + pageSize);

  return (
    <div>
      <PageHeader
        title="Rekap Kehadiran Karyawan"
        subtitle={`Data presensi harian, jam masuk/keluar, keterlambatan, lembur, dan anomali scan (${totalItems} data)`}
        actions={
          <button className="btn btn-secondary btn-sm" onClick={handleExportExcel}>
            <FileSpreadsheet size={14} /> Export Excel Rekap
          </button>
        }
      />

      {/* Filter Bar (Single-row nowrap) */}
      <div className="erp-card" style={{ marginBottom: 12, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "nowrap", alignItems: "center", overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Tahun:</span>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              style={{ width: 100 }}
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Bulan:</span>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ width: 140 }}
            >
              {[
                "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                "Juli", "Agustus", "September", "Oktober", "November", "Desember"
              ].map((m, idx) => (
                <option key={idx + 1} value={String(idx + 1)}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#BA7517", background: "#FAEEDA", padding: "6px 12px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={anomaliOnly}
              onChange={(e) => setAnomaliOnly(e.target.checked)}
            />
            Filter Anomali & Tidak Scan Lengkap Saja
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="erp-card-flush">
        {loading ? (
          <p style={{ padding: 24, color: "#6b7280", fontSize: 15 }}>Memuat rekap presensi...</p>
        ) : attendances.length === 0 ? (
          <p style={{ padding: 24, color: "#6b7280", fontSize: 15, textAlign: "center" }}>Belum ada data presensi pada periode ini.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-purple-50/50 text-[#5005A6] font-semibold border-b border-purple-100">
                  <tr>
                    <th className="p-4 text-center w-12">No</th>
                    <th className="p-4">Tanggal</th>
                    <th className="p-4">Nama Karyawan</th>
                    <th className="p-4">Departemen</th>
                    <th className="p-4">Jam Masuk</th>
                    <th className="p-4">Jam Keluar</th>
                    <th className="p-4">Keterangan</th>
                    <th className="p-4">Terlambat</th>
                    <th className="p-4">Lembur</th>
                    <th className="p-4">Anomali</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAttendances.map((a, idx) => (
                    <tr key={a.id}>
                      <td style={{ textAlign: "center", color: "#6b7280" }}>{startIndex + idx + 1}</td>
                      <td>{a.tanggal ? a.tanggal.substring(0, 10) : "-"}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{a.nama_lengkap}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{a.kode_karyawan}</div>
                      </td>
                      <td>{a.department_nama || "-"}</td>
                      <td style={{ fontWeight: 500 }}>{a.jam_masuk || <span style={{ color: "#d1d5db" }}>-</span>}</td>
                      <td style={{ fontWeight: 500 }}>{a.jam_keluar || <span style={{ color: "#d1d5db" }}>-</span>}</td>
                      <td>
                        <Badge color={a.keterangan === "HADIR" ? "green" : a.keterangan === "ABSEN" ? "red" : "blue"}>
                          {a.keterangan}
                        </Badge>
                      </td>
                      <td>
                        {a.terlambat_menit > 0 ? (
                          <span style={{ color: "#E24B4A", fontWeight: 600 }}>{a.terlambat_menit} mnt</span>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>0</span>
                        )}
                      </td>
                      <td>
                        {a.lembur_menit > 0 ? (
                          <span style={{ color: "#5005A6", fontWeight: 600 }}>{(a.lembur_menit / 60).toFixed(1)} jam</span>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>0</span>
                        )}
                      </td>
                      <td>
                        {a.tidak_scan_lengkap ? (
                          <Badge color="yellow">Hanya 1 Scan</Badge>
                        ) : (
                          <span style={{ fontSize: 12, color: "#9ca3af" }}>Normal</span>
                        )}
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
    </div>
  );
}
