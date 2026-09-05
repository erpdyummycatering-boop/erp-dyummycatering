"use client";

import { useState, useEffect } from "react";
import { FileText, Eye, Printer, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

export default function RiwayatPayrollPage() {
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayroll, setSelectedPayroll] = useState<any>(null);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<any>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchPayrolls = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hr/payroll");
      const data = await res.json();
      setPayrolls(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrolls();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedPayroll, pageSize]);

  const handleViewDetails = async (id: number) => {
    try {
      const res = await fetch(`/api/hr/payroll/${id}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedPayroll(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenSlip = (detail: any) => {
    setSelectedSlip(detail);
    setIsSlipModalOpen(true);
  };

  const handleExportExcel = (p: any) => {
    if (!p.details) return;
    const dataToExport = p.details.map((d: any, idx: number) => ({
      "No": idx + 1,
      "Kode Karyawan": d.kode_karyawan,
      "Nama Karyawan": d.snapshot_nama,
      "Departemen": d.snapshot_departemen,
      "Jabatan": d.snapshot_jabatan,
      "Hari Hadir": d.hari_hadir,
      "Hari Absen": d.hari_absen,
      "Gaji Pokok / Hari": d.gaji_pokok_harian_snapshot,
      "Subtotal Pokok": d.subtotal_gaji_pokok,
      "Subtotal Lembur": d.subtotal_lembur,
      "Tunjangan Bonus": d.tunjangan_bonus,
      "Tunjangan KM": d.tunjangan_km,
      "Potongan Terlambat": d.potongan_terlambat,
      "Potongan Lain": d.potongan_lain,
      "Gaji Kotor": d.gaji_kotor,
      "Gaji Bersih": d.gaji_bersih,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Payroll");
    XLSX.writeFile(wb, `Payroll_${p.nama_periode.replace(/\s+/g, "_")}.xlsx`);
  };

  // Pagination calculation for details table
  const detailsList = selectedPayroll?.details || [];
  const totalItems = detailsList.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedDetails = detailsList.slice(startIndex, startIndex + pageSize);

  return (
    <div>
      <PageHeader
        title="Riwayat & Slip Gaji Payroll"
        subtitle="Daftar histori batch penggajian yang telah diproses dan cetak Slip Gaji digital karyawan"
      />

      {/* Grid: Payroll History Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 16 }}>
        {loading ? (
          <p style={{ padding: 24, color: "#6b7280", fontSize: 15 }}>Memuat riwayat payroll...</p>
        ) : (
          payrolls.map((p) => (
            <div
              key={p.id}
              className="erp-card"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                border: selectedPayroll?.id === p.id ? "2px solid #5005A6" : "0.5px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Badge color="yellow">{p.status}</Badge>
                <span style={{ fontSize: 12, color: "#6b7280" }}>ID: #{p.id}</span>
              </div>

              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{p.nama_periode}</h3>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{p.total_karyawan} Karyawan Diproses</div>
              </div>

              <div style={{ borderTop: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6", padding: "8px 0", fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>Total Gaji Kotor:</span>
                  <span style={{ fontWeight: 600 }}>Rp {Number(p.total_gaji_kotor || 0).toLocaleString("id-ID")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>Total Gaji Bersih:</span>
                  <span style={{ fontWeight: 700, color: "#5005A6" }}>Rp {Number(p.total_gaji_bersih || 0).toLocaleString("id-ID")}</span>
                </div>
              </div>

              <div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleViewDetails(p.id)}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <Eye size={14} /> Lihat Rincian Slip
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Selected Payroll Details & Slip List */}
      {selectedPayroll && (
        <div className="erp-card-flush">
          <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb" }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#5005A6" }}>
                Rincian Slip Gaji — {selectedPayroll.nama_periode}
              </h2>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Status: {selectedPayroll.status}</div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleExportExcel(selectedPayroll)}
            >
              <FileSpreadsheet size={14} /> Export Excel Periode Ini
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48, textAlign: "center" }}>No.</th>
                  <th>Karyawan</th>
                  <th>Dept / Jabatan</th>
                  <th>Hadir</th>
                  <th>Gaji Pokok</th>
                  <th>Lembur</th>
                  <th>Tunjangan</th>
                  <th>Potongan</th>
                  <th style={{ color: "#5005A6" }}>Gaji Bersih</th>
                  <th style={{ textAlign: "right" }}>Slip Gaji</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDetails.map((d: any, idx: number) => (
                  <tr key={d.id}>
                    <td style={{ textAlign: "center", color: "#6b7280" }}>{startIndex + idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{d.snapshot_nama}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{d.kode_karyawan}</div>
                    </td>
                    <td>
                      <div>{d.snapshot_departemen}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{d.snapshot_jabatan}</div>
                    </td>
                    <td style={{ color: "#639922", fontWeight: 600 }}>{d.hari_hadir} Hari</td>
                    <td>Rp {Number(d.subtotal_gaji_pokok || 0).toLocaleString("id-ID")}</td>
                    <td>Rp {Number(d.subtotal_lembur || 0).toLocaleString("id-ID")}</td>
                    <td style={{ color: "#639922" }}>
                      Rp {Number((d.tunjangan_bonus || 0) + (d.tunjangan_km || 0)).toLocaleString("id-ID")}
                    </td>
                    <td style={{ color: "#E24B4A" }}>
                      Rp {Number(d.total_potongan || 0).toLocaleString("id-ID")}
                    </td>
                    <td style={{ fontWeight: 700, color: "#5005A6" }}>
                      Rp {Number(d.gaji_bersih || 0).toLocaleString("id-ID")}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenSlip(d)}
                      >
                        <Printer size={14} /> Cetak Slip
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
        </div>
      )}

      {/* Slip Gaji Modal / Print Preview */}
      <Modal
        show={isSlipModalOpen && Boolean(selectedSlip)}
        onClose={() => setIsSlipModalOpen(false)}
        title="Slip Gaji Karyawan"
        width={580}
      >
        {selectedSlip && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header Slip */}
            <div style={{ textAlign: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: 12 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: "#5005A6", letterSpacing: "0.04em", textTransform: "uppercase" }}>CATERING ERP</h2>
              <div style={{ fontSize: 12, color: "#6b7280" }}>SLIP GAJI KARYAWAN</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginTop: 4 }}>{selectedPayroll?.nama_periode}</div>
            </div>

            {/* Employee Info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13, background: "#f9fafb", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: 12 }}>Nama Karyawan:</span>
                <span style={{ fontWeight: 700, color: "#111827" }}>{selectedSlip.snapshot_nama}</span>
                <span style={{ color: "#6b7280", display: "block", fontSize: 12 }}>{selectedSlip.kode_karyawan}</span>
              </div>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: 12 }}>Departemen / Jabatan:</span>
                <span style={{ fontWeight: 700, color: "#111827" }}>{selectedSlip.snapshot_departemen}</span>
                <span style={{ color: "#6b7280", display: "block", fontSize: 12 }}>{selectedSlip.snapshot_jabatan}</span>
              </div>
            </div>

            {/* Rekap Kehadiran */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center", fontSize: 13, background: "#f3f4f6", padding: 10, borderRadius: 8 }}>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: 11 }}>Hari Hadir</span>
                <strong style={{ color: "#639922" }}>{selectedSlip.hari_hadir} Hari</strong>
              </div>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: 11 }}>Hari Absen</span>
                <strong style={{ color: "#E24B4A" }}>{selectedSlip.hari_absen} Hari</strong>
              </div>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: 11 }}>Jam Lembur</span>
                <strong style={{ color: "#5005A6" }}>{(selectedSlip.total_lembur_menit_diakui / 60).toFixed(1)} Jam</strong>
              </div>
            </div>

            {/* Breakdown Table */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: "#5005A6", borderBottom: "1px solid #e5e7eb", paddingBottom: 4 }}>1. PENDAPATAN</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Gaji Pokok ({selectedSlip.hari_hadir} × Rp {Number(selectedSlip.gaji_pokok_harian_snapshot).toLocaleString("id-ID")})</span>
                  <strong>Rp {Number(selectedSlip.subtotal_gaji_pokok).toLocaleString("id-ID")}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Uang Lembur</span>
                  <strong>Rp {Number(selectedSlip.subtotal_lembur).toLocaleString("id-ID")}</strong>
                </div>
                {selectedSlip.tunjangan_km > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Tunjangan Perjalanan KM (Driver)</span>
                    <strong>Rp {Number(selectedSlip.tunjangan_km).toLocaleString("id-ID")}</strong>
                  </div>
                )}
                {selectedSlip.tunjangan_bonus > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Insentif / Bonus</span>
                    <strong>Rp {Number(selectedSlip.tunjangan_bonus).toLocaleString("id-ID")}</strong>
                  </div>
                )}
              </div>

              <div style={{ fontWeight: 700, color: "#5005A6", borderBottom: "1px solid #e5e7eb", paddingBottom: 4, paddingTop: 4 }}>2. POTONGAN</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 8, color: "#E24B4A" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Potongan Keterlambatan</span>
                  <strong>Rp {Number(selectedSlip.potongan_terlambat || 0).toLocaleString("id-ID")}</strong>
                </div>
                {selectedSlip.potongan_lain > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Potongan Lainnya (Kasbon)</span>
                    <strong>Rp {Number(selectedSlip.potongan_lain).toLocaleString("id-ID")}</strong>
                  </div>
                )}
              </div>

              {/* Total Gaji Bersih */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#5005A6", color: "white", padding: 14, borderRadius: 10, fontSize: 16, fontWeight: 800, marginTop: 8 }}>
                <span>TOTAL GAJI BERSIH</span>
                <span>Rp {Number(selectedSlip.gaji_bersih || 0).toLocaleString("id-ID")}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
              <button
                onClick={() => setIsSlipModalOpen(false)}
                className="btn btn-secondary"
              >
                Tutup
              </button>
              <button
                onClick={() => window.print()}
                className="btn btn-primary"
              >
                <Printer size={14} /> Cetak Slip PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
