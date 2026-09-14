"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Eye,
  Printer,
  FileSpreadsheet,
  MessageSquare,
  ExternalLink,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  Clock,
  Calendar,
} from "lucide-react";
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

  // Multi-selection state for batch printing A4
  const [selectedDetailIds, setSelectedDetailIds] = useState<number[]>([]);

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
    // Reset selection when payroll changes
    if (selectedPayroll?.details) {
      setSelectedDetailIds(selectedPayroll.details.map((d: any) => d.id));
    } else {
      setSelectedDetailIds([]);
    }
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

  const toggleSelectDetail = (id: number) => {
    setSelectedDetailIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllDetails = () => {
    if (!selectedPayroll?.details) return;
    if (selectedDetailIds.length === selectedPayroll.details.length) {
      setSelectedDetailIds([]);
    } else {
      setSelectedDetailIds(selectedPayroll.details.map((d: any) => d.id));
    }
  };

  const handlePrintMultiUpA4 = () => {
    if (!selectedPayroll) return;
    if (selectedDetailIds.length === 0) {
      alert("Pilih minimal 1 karyawan untuk dicetak.");
      return;
    }
    const idsParam = selectedDetailIds.join(",");
    window.open(
      `/api/hr/payroll/print-slips?payroll_id=${selectedPayroll.id}&detail_ids=${idsParam}`,
      "_blank"
    );
  };

  const handleExportExcel = (p: any) => {
    if (!p.details) return;
    const dataToExport = p.details.map((d: any, idx: number) => ({
      No: idx + 1,
      "Kode Karyawan": d.kode_karyawan,
      "Nama Karyawan": d.snapshot_nama,
      Departemen: d.snapshot_departemen,
      Jabatan: d.snapshot_jabatan,
      "Hari Hadir": d.hari_hadir,
      "Hari Absen": d.hari_absen,
      "Gaji Pokok / Hari": d.gaji_pokok_harian_snapshot,
      "Subtotal Pokok": d.subtotal_gaji_pokok,
      "Subtotal Lembur": d.subtotal_lembur,
      "Lembur Pagi": d.subtotal_lembur_pagi || 0,
      "Tunjangan Bonus": d.tunjangan_bonus || d.subtotal_bonus || 0,
      "Tunjangan KM": d.tunjangan_km || 0,
      "Potongan Tabungan": d.potongan_tabungan || 0,
      "Potongan Terlambat": d.potongan_terlambat || 0,
      "Potongan Lain": d.potongan_lain || 0,
      "Total Potongan": d.total_potongan || 0,
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

  const isBulananPayroll = selectedPayroll?.tipe_payroll === "BULANAN";

  return (
    <div>
      <PageHeader
        title="Riwayat & Cetak Slip Gaji Multi-Up A4"
        subtitle="Daftar histori batch penggajian dan cetak slip gaji format grid 6 slip per lembar A4 atau custom pilihan"
      />

      {/* Grid: Payroll History Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {loading ? (
          <p style={{ padding: 24, color: "#6b7280", fontSize: 15 }}>
            Memuat riwayat payroll...
          </p>
        ) : (
          payrolls.map((p) => {
            const isPekanan = p.tipe_payroll === "PEKANAN";
            return (
              <div
                key={p.id}
                className="erp-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  border:
                    selectedPayroll?.id === p.id
                      ? "2px solid #5005A6"
                      : "0.5px solid var(--border)",
                  cursor: "pointer",
                }}
                onClick={() => handleViewDetails(p.id)}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Badge color={p.status === "FINAL" ? "green" : "yellow"}>
                      {p.status}
                    </Badge>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: isPekanan ? "#fef3c7" : "#ede9fe",
                        color: isPekanan ? "#b45309" : "#5005A6",
                      }}
                    >
                      {p.tipe_payroll || "BULANAN"}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>
                    ID: #{p.id}
                  </span>
                </div>

                <div>
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#111827",
                    }}
                  >
                    {p.nama_periode}
                  </h3>
                  <div
                    style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}
                  >
                    {p.total_karyawan} Karyawan
                    {p.tanggal_mulai && (
                      <span style={{ marginLeft: 6 }}>
                        ({p.tanggal_mulai.substring(5)} s/d{" "}
                        {p.tanggal_selesai?.substring(5)})
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    borderTop: "1px solid #f3f4f6",
                    borderBottom: "1px solid #f3f4f6",
                    padding: "8px 0",
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ color: "#6b7280" }}>Total Gaji Bersih:</span>
                    <span style={{ fontWeight: 800, color: "#5005A6" }}>
                      Rp {Number(p.total_gaji_bersih || 0).toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>

                <div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetails(p.id);
                    }}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    <Eye size={14} /> Buka Batch Ini
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selected Payroll Details & Slip List */}
      {selectedPayroll && (
        <div className="erp-card-flush" style={{ marginTop: 20 }}>
          {/* Header Action Toolbar */}
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              borderBottom: "1px solid #e5e7eb",
              background: "#faf5ff",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: "#5005A6",
                  }}
                >
                  {selectedPayroll.nama_periode}
                </h2>
                <Badge color={selectedPayroll.status === "FINAL" ? "green" : "yellow"}>
                  {selectedPayroll.status}
                </Badge>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: "#5005A6",
                    color: "white",
                  }}
                >
                  {selectedPayroll.tipe_payroll || "PEKANAN"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                Pilih slip karyawan yang ingin dicetak ke dalam lembar kertas A4 (otomatis muat 6 slip per halaman).
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSelectAllDetails}
              >
                {selectedDetailIds.length === (selectedPayroll.details?.length || 0) ? (
                  <>
                    <Square size={14} /> Batalkan Semua
                  </>
                ) : (
                  <>
                    <CheckSquare size={14} /> Pilih Semua ({selectedPayroll.details?.length || 0})
                  </>
                )}
              </button>

              <button
                className="btn btn-primary"
                onClick={handlePrintMultiUpA4}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 700,
                }}
              >
                <Printer size={15} /> Cetak A4 Isi 6 ({selectedDetailIds.length} Terpilih)
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleExportExcel(selectedPayroll)}
              >
                <FileSpreadsheet size={14} /> Export Excel
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={
                        selectedDetailIds.length ===
                          (selectedPayroll.details?.length || 0) &&
                        (selectedPayroll.details?.length || 0) > 0
                      }
                      onChange={handleSelectAllDetails}
                      title="Pilih / Batal Semua"
                    />
                  </th>
                  <th style={{ width: 40, textAlign: "center" }}>No.</th>
                  <th>Karyawan</th>
                  <th>Dept / Jabatan</th>
                  <th>Hadir</th>
                  <th>Gaji Pokok</th>
                  <th>Lembur</th>
                  <th>Bonus</th>
                  <th>Potongan</th>
                  <th style={{ color: "#5005A6" }}>Gaji Bersih</th>
                  <th style={{ textAlign: "right" }}>Aksi Slip</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDetails.map((d: any, idx: number) => {
                  const isChecked = selectedDetailIds.includes(d.id);
                  const totalBonus = Number(d.tunjangan_bonus || d.subtotal_bonus || 0);
                  const totalLembur = Number(d.subtotal_lembur || 0) + Number(d.subtotal_lembur_pagi || 0);

                  return (
                    <tr
                      key={d.id}
                      style={{
                        background: isChecked ? "#faf5ff" : undefined,
                      }}
                    >
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectDetail(d.id)}
                        />
                      </td>
                      <td style={{ textAlign: "center", color: "#6b7280" }}>
                        {startIndex + idx + 1}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{d.snapshot_nama}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                          {d.kode_karyawan}
                        </div>
                      </td>
                      <td>
                        <div>{d.snapshot_departemen}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                          {d.snapshot_jabatan}
                        </div>
                      </td>
                      <td style={{ color: "#639922", fontWeight: 700 }}>
                        {d.hari_hadir} Hari
                      </td>
                      <td>
                        Rp {Number(d.subtotal_gaji_pokok || 0).toLocaleString("id-ID")}
                      </td>
                      <td>
                        Rp {totalLembur.toLocaleString("id-ID")}
                        {d.subtotal_lembur_pagi > 0 && (
                          <div style={{ fontSize: 10, color: "#5005A6" }}>
                            + Pagi: Rp {Number(d.subtotal_lembur_pagi).toLocaleString("id-ID")}
                          </div>
                        )}
                      </td>
                      <td>
                        {totalBonus > 0 ? (
                          <span style={{ fontWeight: 700, color: "#b45309" }}>
                            Rp {totalBonus.toLocaleString("id-ID")}
                          </span>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>Rp 0</span>
                        )}
                      </td>
                      <td style={{ color: "#E24B4A", fontWeight: 600 }}>
                        -Rp {Number(d.total_potongan || 0).toLocaleString("id-ID")}
                        {d.potongan_tabungan > 0 && (
                          <div style={{ fontSize: 10 }}>
                            Tabungan: Rp {Number(d.potongan_tabungan).toLocaleString("id-ID")}
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 800, color: "#5005A6", fontSize: 13 }}>
                        Rp {Number(d.gaji_bersih || 0).toLocaleString("id-ID")}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{
                              color: "#25D366",
                              borderColor: "#25D366",
                              fontWeight: 700,
                            }}
                            onClick={() => {
                              let rawPhone = d.no_telepon || "";
                              if (!rawPhone) {
                                const inputPhone = prompt(
                                  `Nomor WhatsApp ${d.snapshot_nama} belum terdaftar. Masukkan nomor WhatsApp (misal: 6281234567890):`
                                );
                                if (!inputPhone) return;
                                rawPhone = inputPhone;
                              }
                              const phone = rawPhone.replace(/\D/g, "");
                              const slipUrl = `${window.location.origin}/slip/${d.id}`;
                              const caption = `Halo ${d.snapshot_nama},\n\nBerikut adalah Slip Gaji Anda untuk periode ${selectedPayroll?.nama_periode}:\nTotal Gaji Bersih: Rp ${Number(d.gaji_bersih || 0).toLocaleString("id-ID")}\n\nAnda dapat melihat dan mengunduh slip PDF resmi melalui tautan berikut:\n${slipUrl}\n\nTerima Kasih,\nHRD Dyummy Catering`;
                              const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(caption)}`;
                              window.open(waUrl, "_blank");
                            }}
                            title="Kirim Slip ke WhatsApp Karyawan"
                          >
                            <MessageSquare size={13} /> WA
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenSlip(d)}
                            title="Preview Slip Gaji"
                          >
                            <Printer size={13} /> Preview
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
        title={`Slip Gaji — ${selectedSlip?.snapshot_nama}`}
        width={600}
      >
        {selectedSlip && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Header Slip */}
            <div
              style={{
                textAlign: "center",
                borderBottom: "1px solid #e5e7eb",
                paddingBottom: 10,
              }}
            >
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: "#5005A6",
                  letterSpacing: "0.04em",
                }}
              >
                Dyummy Catering
              </h2>
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                SLIP GAJI RESMI KARYAWAN ({selectedPayroll?.tipe_payroll || "PEKANAN"})
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#111827",
                  marginTop: 2,
                }}
              >
                {selectedPayroll?.nama_periode}
              </div>
            </div>

            {/* Employee Info */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                fontSize: 12,
                background: "#f9fafb",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
            >
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: 11 }}>
                  Nama Karyawan:
                </span>
                <strong style={{ fontSize: 13, color: "#111827" }}>
                  {selectedSlip.snapshot_nama}
                </strong>
                <span style={{ color: "#6b7280", display: "block", fontSize: 11 }}>
                  {selectedSlip.kode_karyawan}
                </span>
              </div>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: 11 }}>
                  Departemen / Jabatan:
                </span>
                <strong style={{ color: "#111827" }}>
                  {selectedSlip.snapshot_departemen}
                </strong>
                <span style={{ color: "#6b7280", display: "block", fontSize: 11 }}>
                  {selectedSlip.snapshot_jabatan}
                </span>
              </div>
            </div>

            {/* Jika PEKANAN dan ada detail harian -> Tampilkan tabel persis seperti Excel */}
            {!isBulananPayroll && Array.isArray(selectedSlip.detail_harian) && selectedSlip.detail_harian.length > 0 ? (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#5005A6", marginBottom: 6 }}>
                  Rincian Kehadiran & Jam Kerja Harian
                </div>
                <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 6 }}>
                  <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f3f4f6", borderBottom: "1px solid #e5e7eb" }}>
                        <th style={{ padding: "6px 4px" }}>Tgl</th>
                        <th style={{ padding: "6px 4px" }}>Hari</th>
                        <th style={{ padding: "6px 4px" }}>Datang</th>
                        <th style={{ padding: "6px 4px" }}>Pulang</th>
                        <th style={{ padding: "6px 4px" }}>Jam Kerja</th>
                        <th style={{ padding: "6px 4px" }}>Jam Lembur</th>
                        <th style={{ padding: "6px 4px", textAlign: "right" }}>Gaji Pokok</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSlip.detail_harian.map((item: any, hIdx: number) => (
                        <tr key={hIdx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "4px 6px" }}>{item.tanggal?.substring(5)}</td>
                          <td style={{ padding: "4px 6px" }}>{item.hari}</td>
                          <td style={{ padding: "4px 6px" }}>{item.jam_masuk || "-"}</td>
                          <td style={{ padding: "4px 6px" }}>{item.jam_keluar || "-"}</td>
                          <td style={{ padding: "4px 6px" }}>
                            {item.jam_kerja_menit ? `${Math.floor(item.jam_kerja_menit / 60)}:${String(item.jam_kerja_menit % 60).padStart(2, "0")}` : "-"}
                          </td>
                          <td style={{ padding: "4px 6px" }}>
                            {item.jam_lembur_menit ? `${Math.floor(item.jam_lembur_menit / 60)}:${String(item.jam_lembur_menit % 60).padStart(2, "0")}` : "-"}
                          </td>
                          <td style={{ padding: "4px 6px", textAlign: "right" }}>
                            {item.gaji_pokok ? `Rp ${Number(item.gaji_pokok).toLocaleString("id-ID")}` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Rekap Kehadiran Bulanan (Tanpa Jam) */
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  textAlign: "center",
                  fontSize: 12,
                  background: "#f3f4f6",
                  padding: 8,
                  borderRadius: 8,
                }}
              >
                <div>
                  <span style={{ color: "#6b7280", display: "block", fontSize: 11 }}>
                    Hari Hadir
                  </span>
                  <strong style={{ color: "#639922", fontSize: 14 }}>
                    {selectedSlip.hari_hadir} Hari
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#6b7280", display: "block", fontSize: 11 }}>
                    Hari Absen
                  </span>
                  <strong style={{ color: "#E24B4A", fontSize: 14 }}>
                    {selectedSlip.hari_absen} Hari
                  </strong>
                </div>
              </div>
            )}

            {/* Breakdown Pendapatan & Potongan */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
              <div
                style={{
                  fontWeight: 700,
                  color: "#5005A6",
                  borderBottom: "1px solid #e5e7eb",
                  paddingBottom: 4,
                }}
              >
                1. PENDAPATAN
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingLeft: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Gaji Pokok ({selectedSlip.hari_hadir} × Rp {Number(selectedSlip.gaji_pokok_harian_snapshot).toLocaleString("id-ID")})</span>
                  <strong>Rp {Number(selectedSlip.subtotal_gaji_pokok).toLocaleString("id-ID")}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Uang Lembur</span>
                  <strong>Rp {Number(selectedSlip.subtotal_lembur).toLocaleString("id-ID")}</strong>
                </div>
                {selectedSlip.subtotal_lembur_pagi > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Lembur Pagi</span>
                    <strong>Rp {Number(selectedSlip.subtotal_lembur_pagi).toLocaleString("id-ID")}</strong>
                  </div>
                )}
                {(selectedSlip.tunjangan_bonus > 0 || selectedSlip.subtotal_bonus > 0) && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Bonus / Insentif Hari</span>
                    <strong>Rp {Number(selectedSlip.tunjangan_bonus || selectedSlip.subtotal_bonus).toLocaleString("id-ID")}</strong>
                  </div>
                )}
                {selectedSlip.tunjangan_km > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Tunjangan KM Driver</span>
                    <strong>Rp {Number(selectedSlip.tunjangan_km).toLocaleString("id-ID")}</strong>
                  </div>
                )}
              </div>

              <div
                style={{
                  fontWeight: 700,
                  color: "#E24B4A",
                  borderBottom: "1px solid #e5e7eb",
                  paddingBottom: 4,
                  paddingTop: 4,
                }}
              >
                2. POTONGAN
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingLeft: 8, color: "#E24B4A" }}>
                {selectedSlip.potongan_tabungan > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Potongan Tabungan</span>
                    <strong>-Rp {Number(selectedSlip.potongan_tabungan).toLocaleString("id-ID")}</strong>
                  </div>
                )}
                {selectedSlip.potongan_terlambat > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Potongan Keterlambatan</span>
                    <strong>-Rp {Number(selectedSlip.potongan_terlambat).toLocaleString("id-ID")}</strong>
                  </div>
                )}
                {selectedSlip.potongan_lain > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Potongan Lainnya / Kasbon</span>
                    <strong>-Rp {Number(selectedSlip.potongan_lain).toLocaleString("id-ID")}</strong>
                  </div>
                )}
                {selectedSlip.total_potongan === 0 && (
                  <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Tidak ada potongan</span>
                )}
              </div>

              {/* Total Gaji Bersih */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#5005A6",
                  color: "white",
                  padding: "12px 16px",
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 800,
                  marginTop: 6,
                }}
              >
                <span>TOTAL GAJI BERSIH</span>
                <span>Rp {Number(selectedSlip.gaji_bersih || 0).toLocaleString("id-ID")}</span>
              </div>
            </div>

            {/* Footer action buttons */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                paddingTop: 10,
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <button
                onClick={() => setIsSlipModalOpen(false)}
                className="btn btn-secondary"
              >
                Tutup
              </button>
              <button
                onClick={() => window.open(`/slip/${selectedSlip.id}`, "_blank")}
                className="btn btn-primary"
              >
                <Printer size={14} /> Cetak 1 Slip Penuh
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
