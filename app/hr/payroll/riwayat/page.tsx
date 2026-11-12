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
  Trash2,
  Copy,
  Building2,
  Edit,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

// Helper categorizer matching user spreadsheet and images
const getDivisionCategory = (d: any) => {
  const j = (d.snapshot_jabatan || "").toLowerCase();
  const dep = (d.snapshot_departemen || "").toLowerCase();
  const n = (d.snapshot_nama || "").toLowerCase();
  const tg = (d.snapshot_tipe_gaji || "").toUpperCase();
  const tk = (d.tipe_karyawan || "").toUpperCase();

  // 1. Freelance
  if (
    tk === "FREELANCE" ||
    j.includes("freelance") ||
    n.includes("freelance") ||
    n.includes("(freelance)")
  ) {
    return "Gaji Freelance";
  }

  // 2. Driver
  if (tg === "HARIAN_DRIVER" || j.includes("driver") || dep.includes("driver")) {
    return "Gaji Driver";
  }

  // 3. Siap Saji
  if (j.includes("siap saji") || dep.includes("siap saji")) {
    if (tg === "BULANAN" || j.includes("office") || j.includes("direktur")) {
      return "Gaji Office Siap Saji";
    }
    return "Gaji Siap Saji";
  }

  // 4. Office (Bulanan / Office Dept)
  if (tg === "BULANAN" || dep.includes("office") || j.includes("direktur") || j.includes("hrd") || j.includes("finance")) {
    return "Gaji Office";
  }

  // 5. Default Produksi Catering
  return "Gaji Produksi";
};

export default function RiwayatPayrollPage() {
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayroll, setSelectedPayroll] = useState<any>(null);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<any>(null);

  // Edit / Penyesuaian Potongan Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDetail, setEditingDetail] = useState<any>(null);
  const [savingDetail, setSavingDetail] = useState(false);
  const [editForm, setEditForm] = useState<{
    tunjangan_km: number;
    tunjangan_bonus: number;
    subtotal_lembur_pagi: number;
    potongan_tabungan: number;
    rincian_potongan: { nama: string; nominal: number }[];
    catatan_payroll: string;
  }>({
    tunjangan_km: 0,
    tunjangan_bonus: 0,
    subtotal_lembur_pagi: 0,
    potongan_tabungan: 0,
    rincian_potongan: [],
    catatan_payroll: "",
  });

  const handleOpenEditDetail = (d: any) => {
    let rincian: { nama: string; nominal: number }[] = [];
    if (Array.isArray(d.rincian_potongan)) {
      rincian = d.rincian_potongan;
    } else if (typeof d.rincian_potongan === "string") {
      try {
        rincian = JSON.parse(d.rincian_potongan);
      } catch (e) {
        rincian = [];
      }
    }
    // If no rincian but potongan_lain exists
    if (rincian.length === 0 && Number(d.potongan_lain) > 0) {
      rincian = [{ nama: "Iuran / Potongan Lain", nominal: Number(d.potongan_lain) }];
    }

    setEditingDetail(d);
    setEditForm({
      tunjangan_km: Number(d.tunjangan_km || 0),
      tunjangan_bonus: Number(d.tunjangan_bonus || d.subtotal_bonus || 0),
      subtotal_lembur_pagi: Number(d.subtotal_lembur_pagi || 0),
      potongan_tabungan: Number(d.potongan_tabungan || 0),
      rincian_potongan: rincian,
      catatan_payroll: d.catatan_payroll || "",
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEditDetail = async () => {
    if (!selectedPayroll || !editingDetail) return;
    setSavingDetail(true);
    try {
      const res = await fetch(
        `/api/hr/payroll/${selectedPayroll.id}/details/${editingDetail.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tunjangan_km: editForm.tunjangan_km,
            tunjangan_bonus: editForm.tunjangan_bonus,
            subtotal_lembur_pagi: editForm.subtotal_lembur_pagi,
            potongan_tabungan: editForm.potongan_tabungan,
            rincian_potongan: editForm.rincian_potongan,
            catatan_payroll: editForm.catatan_payroll,
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(`Berhasil memperbarui data payroll ${editingDetail.snapshot_nama}`);
        setIsEditModalOpen(false);
        // Refresh details
        await handleViewDetails(selectedPayroll.id);
        fetchPayrolls();
      } else {
        alert(data.error || "Gagal menyimpan perubahan");
      }
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan perubahan");
    } finally {
      setSavingDetail(false);
    }
  };

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

  const handleDeletePayroll = async (payroll: any) => {
    if (payroll.status === "FINAL") {
      alert("Batch payroll yang sudah berstatus FINAL tidak dapat dihapus.");
      return;
    }

    if (!confirm(`Yakin ingin menghapus batch payroll #${payroll.id} (${payroll.nama_periode})? Semua rincian slip di dalam batch ini akan ikut terhapus.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/hr/payroll/${payroll.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        if (selectedPayroll?.id === payroll.id) {
          setSelectedPayroll(null);
        }
        fetchPayrolls();
      } else {
        alert(data.error || "Gagal menghapus batch payroll");
      }
    } catch (err: any) {
      alert(err.message || "Gagal menghapus batch payroll");
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
    if (!p.details || p.details.length === 0) {
      alert("Tidak ada data rincian payroll untuk diekspor.");
      return;
    }

    const details: any[] = p.details;

    // Calculate group sums for approval summary
    const divSums: { [key: string]: { count: number; total: number; names: string[] } } = {
      "Gaji Produksi": { count: 0, total: 0, names: [] },
      "Gaji Driver": { count: 0, total: 0, names: [] },
      "Gaji Siap Saji": { count: 0, total: 0, names: [] },
      "Gaji Freelance": { count: 0, total: 0, names: [] },
      "Gaji Office": { count: 0, total: 0, names: [] },
      "Gaji Office Siap Saji": { count: 0, total: 0, names: [] },
    };

    let totalGajiKotorSemua = 0;
    let totalTabungan = 0;
    const iuranMap: { [key: string]: number } = {};

    details.forEach((d) => {
      const cat = getDivisionCategory(d);
      if (!divSums[cat]) {
        divSums[cat] = { count: 0, total: 0, names: [] };
      }
      const net = Number(d.gaji_bersih || 0);
      const tabungan = Number(d.potongan_tabungan || 0);
      const potLain = Number(d.potongan_lain || 0);
      // Gaji sebelum potongan tabungan & iuran = net + tabungan + potLain
      const subKotor = net + tabungan + potLain;

      divSums[cat].count += 1;
      divSums[cat].total += subKotor;
      divSums[cat].names.push(d.snapshot_nama);

      totalGajiKotorSemua += subKotor;
      totalTabungan += tabungan;

      // Parse rincian potongan
      let rincian: any[] = [];
      if (Array.isArray(d.rincian_potongan)) {
        rincian = d.rincian_potongan;
      } else if (typeof d.rincian_potongan === "string") {
        try {
          rincian = JSON.parse(d.rincian_potongan);
        } catch (e) {
          rincian = [];
        }
      }
      if (rincian.length > 0) {
        rincian.forEach((item: any) => {
          const itemNama = item.nama || "Iuran Lain";
          iuranMap[itemNama] = (iuranMap[itemNama] || 0) + (Number(item.nominal) || 0);
        });
      } else if (potLain > 0) {
        iuranMap["Iuran Lainnya"] = (iuranMap["Iuran Lainnya"] || 0) + potLain;
      }
    });

    const totalIuran = Object.values(iuranMap).reduce((a, b) => a + b, 0);
    const subtotalSetelahTabungan = totalGajiKotorSemua - totalTabungan;
    const grandTotalApproval = subtotalSetelahTabungan - totalIuran;

    // --- SHEET 1: RINGKASAN APPROVAL FINANCE ---
    const sheet1Rows: any[] = [
      ["RINGKASAN APPROVAL GAJI KARYAWAN"],
      [`Periode: ${p.nama_periode}`],
      [`Tipe Payroll: ${p.tipe_payroll || "PEKANAN"}`],
      [""],
      ["DIVISI / KOMPONEN", "JUMLAH (RP)", "KETERANGAN"],
      ["Gaji Produksi", divSums["Gaji Produksi"].total, `${divSums["Gaji Produksi"].count} Karyawan`],
      ["Gaji Driver", divSums["Gaji Driver"].total, `${divSums["Gaji Driver"].count} Karyawan`],
      ["Gaji Siap Saji", divSums["Gaji Siap Saji"].total, `${divSums["Gaji Siap Saji"].count} Karyawan`],
      ["Gaji Freelance", divSums["Gaji Freelance"].total, `${divSums["Gaji Freelance"].count} Karyawan`],
      ["Gaji Office", divSums["Gaji Office"].total, `${divSums["Gaji Office"].count} Karyawan`],
      ["Gaji Office Siap Saji", divSums["Gaji Office Siap Saji"].total, `${divSums["Gaji Office Siap Saji"].count} Karyawan`],
      ["TOTAL KOTOR", totalGajiKotorSemua, `${details.length} Karyawan`],
      ["TABUNGAN", -totalTabungan, "Potongan Tabungan Karyawan"],
      ["SUBTOTAL SETELAH TABUNGAN", subtotalSetelahTabungan, ""],
    ];

    Object.entries(iuranMap).forEach(([namaIuran, nom]) => {
      sheet1Rows.push([namaIuran, -nom, "Potongan Iuran Dinamis"]);
    });

    sheet1Rows.push(["GRAND TOTAL APPROVAL", grandTotalApproval, "Total Dana Yang Ditransfer"]);

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);

    // --- SHEET 2: REKAP DETAIL KARYAWAN PER DIVISI ---
    const sheet2Rows: any[] = [
      [
        "No",
        "Divisi ERP",
        "Kode Karyawan",
        "Nama Karyawan",
        "Departemen",
        "Jabatan",
        "Hari Hadir",
        "Hari Absen",
        "Gaji Pokok / Hari",
        "Subtotal Pokok",
        "Subtotal Lembur",
        "Lembur Pagi",
        "Tunjangan Bonus",
        "Tunjangan KM Driver",
        "Gaji Sebelum Potongan",
        "Potongan Tabungan",
        "Potongan Iuran / Lain",
        "Potongan Terlambat",
        "Total Potongan",
        "Gaji Bersih Diterima",
      ],
    ];

    // Urutkan data per kategori divisi
    const categoryOrder = [
      "Gaji Produksi",
      "Gaji Driver",
      "Gaji Siap Saji",
      "Gaji Freelance",
      "Gaji Office",
      "Gaji Office Siap Saji",
    ];

    const sortedDetails = [...details].sort((a, b) => {
      const catA = getDivisionCategory(a);
      const catB = getDivisionCategory(b);
      const idxA = categoryOrder.indexOf(catA);
      const idxB = categoryOrder.indexOf(catB);
      if (idxA !== idxB) return idxA - idxB;
      return (a.snapshot_nama || "").localeCompare(b.snapshot_nama || "");
    });

    sortedDetails.forEach((d: any, idx: number) => {
      const net = Number(d.gaji_bersih || 0);
      const tabungan = Number(d.potongan_tabungan || 0);
      const potLain = Number(d.potongan_lain || 0);
      const kotor = net + tabungan + potLain;

      sheet2Rows.push([
        idx + 1,
        getDivisionCategory(d),
        d.kode_karyawan,
        d.snapshot_nama,
        d.snapshot_departemen,
        d.snapshot_jabatan,
        d.hari_hadir,
        d.hari_absen,
        Number(d.gaji_pokok_harian_snapshot || 0),
        Number(d.subtotal_gaji_pokok || 0),
        Number(d.subtotal_lembur || 0),
        Number(d.subtotal_lembur_pagi || 0),
        Number(d.tunjangan_bonus || d.subtotal_bonus || 0),
        Number(d.tunjangan_km || 0),
        kotor,
        tabungan,
        potLain,
        Number(d.potongan_terlambat || 0),
        Number(d.total_potongan || 0),
        net,
      ]);
    });

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Ringkasan Approval");
    XLSX.utils.book_append_sheet(wb, ws2, "Rincian Karyawan");
    XLSX.writeFile(wb, `Payroll_${p.nama_periode.replace(/\s+/g, "_")}.xlsx`);
    toast.success("Excel ringkasan payroll 2-sheet berhasil diunduh!");
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

                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetails(p.id);
                    }}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    <Eye size={14} /> Buka Batch Ini
                  </button>
                  {p.status !== "FINAL" && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePayroll(p);
                      }}
                      title="Hapus batch ini"
                      style={{ color: "#ef4444", borderColor: "#fecaca", padding: "6px 10px" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
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

              {selectedPayroll.status !== "FINAL" && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDeletePayroll(selectedPayroll)}
                  style={{ color: "#ef4444", borderColor: "#fecaca" }}
                >
                  <Trash2 size={14} /> Hapus Batch
                </button>
              )}
            </div>
          </div>

          {/* Department Breakdown Widget for Finance Review */}
          {(() => {
            const details: any[] = selectedPayroll.details || [];
            
            // 6 standard division buckets
            const divBuckets: { [key: string]: { name: string; count: number; subtotalKotor: number; net: number } } = {
              "Gaji Produksi": { name: "Gaji Produksi", count: 0, subtotalKotor: 0, net: 0 },
              "Gaji Driver": { name: "Gaji Driver", count: 0, subtotalKotor: 0, net: 0 },
              "Gaji Siap Saji": { name: "Gaji Siap Saji", count: 0, subtotalKotor: 0, net: 0 },
              "Gaji Freelance": { name: "Gaji Freelance", count: 0, subtotalKotor: 0, net: 0 },
              "Gaji Office": { name: "Gaji Office", count: 0, subtotalKotor: 0, net: 0 },
              "Gaji Office Siap Saji": { name: "Gaji Office Siap Saji", count: 0, subtotalKotor: 0, net: 0 },
            };

            let sumGajiKotor = 0;
            let sumTabungan = 0;
            const iuranSummary: { [key: string]: number } = {};

            details.forEach((d) => {
              const cat = getDivisionCategory(d);
              if (!divBuckets[cat]) {
                divBuckets[cat] = { name: cat, count: 0, subtotalKotor: 0, net: 0 };
              }
              const net = Number(d.gaji_bersih || 0);
              const tab = Number(d.potongan_tabungan || 0);
              const potLain = Number(d.potongan_lain || 0);
              const kotor = net + tab + potLain;

              divBuckets[cat].count += 1;
              divBuckets[cat].subtotalKotor += kotor;
              divBuckets[cat].net += net;

              sumGajiKotor += kotor;
              sumTabungan += tab;

              // Parse rincian potongan
              let rincian: any[] = [];
              if (Array.isArray(d.rincian_potongan)) {
                rincian = d.rincian_potongan;
              } else if (typeof d.rincian_potongan === "string") {
                try {
                  rincian = JSON.parse(d.rincian_potongan);
                } catch (e) {
                  rincian = [];
                }
              }

              if (rincian.length > 0) {
                rincian.forEach((item: any) => {
                  const nm = item.nama || "Iuran Lain";
                  iuranSummary[nm] = (iuranSummary[nm] || 0) + (Number(item.nominal) || 0);
                });
              } else if (potLain > 0) {
                iuranSummary["Iuran Lainnya"] = (iuranSummary["Iuran Lainnya"] || 0) + potLain;
              }
            });

            const totalIuran = Object.values(iuranSummary).reduce((a, b) => a + b, 0);
            const subtotalSetelahTabungan = sumGajiKotor - sumTabungan;
            const grandTotalApproval = subtotalSetelahTabungan - totalIuran;

            const handleCopySummaryFinance = () => {
              let text = `📌 *GAJI KARYAWAN*\n`;
              text += `----------------------------------------\n`;
              const divList = [
                "Gaji Produksi",
                "Gaji Driver",
                "Gaji Siap Saji",
                "Gaji Freelance",
                "Gaji Office",
                "Gaji Office Siap Saji",
              ];
              divList.forEach((key) => {
                const b = divBuckets[key];
                if (b && b.count > 0) {
                  text += `${key.padEnd(22, " ")}: Rp ${b.subtotalKotor.toLocaleString("id-ID")}\n`;
                }
              });
              text += `----------------------------------------\n`;
              text += `*TOTAL*                 : Rp ${sumGajiKotor.toLocaleString("id-ID")}\n`;
              if (sumTabungan > 0) {
                text += `*TABUNGAN*              : -Rp ${sumTabungan.toLocaleString("id-ID")}\n`;
                text += `Subtotal                : Rp ${subtotalSetelahTabungan.toLocaleString("id-ID")}\n`;
              }
              Object.entries(iuranSummary).forEach(([nm, val]) => {
                text += `${nm.padEnd(24, " ")}: -Rp ${val.toLocaleString("id-ID")}\n`;
              });
              text += `========================================\n`;
              text += `*GRAND TOTAL APPROVAL   : Rp ${grandTotalApproval.toLocaleString("id-ID")}*\n`;
              text += `Total Karyawan          : ${details.length} orang\n`;

              navigator.clipboard.writeText(text);
              toast.success("Format Approval WA Finance berhasil disalin ke clipboard!");
            };

            const bucketDisplayList = [
              "Gaji Produksi",
              "Gaji Driver",
              "Gaji Siap Saji",
              "Gaji Freelance",
              "Gaji Office",
              "Gaji Office Siap Saji",
            ];

            return (
              <div style={{ margin: "14px 20px 0 20px", borderRadius: 12, border: "1px solid #e9d5ff", background: "#faf5ff", overflow: "hidden" }}>
                <div style={{ padding: "10px 16px", background: "#f3e8ff", borderBottom: "1px solid #e9d5ff", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Building2 size={16} color="#5005A6" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#5005A6" }}>
                      Ringkasan Approval Payroll Keuangan ({selectedPayroll.nama_periode})
                    </span>
                  </div>
                  <button
                    onClick={handleCopySummaryFinance}
                    style={{
                      padding: "5px 12px",
                      background: "#5005A6",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Copy size={13} /> Salin Format WA Finance
                  </button>
                </div>

                {/* Division Breakdown Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, padding: 12 }}>
                  {bucketDisplayList.map((divName) => {
                    const b = divBuckets[divName] || { count: 0, subtotalKotor: 0 };
                    return (
                      <div key={divName} style={{ background: "white", borderRadius: 8, padding: "8px 12px", border: "1px solid #e5e7eb" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>{divName}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, background: "#f3f4f6", color: "#4b5563", padding: "1px 6px", borderRadius: 10 }}>
                            {b.count} orang
                          </span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#5005A6", marginTop: 4 }}>
                          Rp {b.subtotalKotor.toLocaleString("id-ID")}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary Totals Bar (Gambar 4 format) */}
                <div style={{ padding: "10px 16px", background: "#fdf4ff", borderTop: "1px solid #e9d5ff", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 12 }}>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                    <div>
                      <span style={{ color: "#6b7280" }}>TOTAL KOTOR: </span>
                      <strong style={{ color: "#111827" }}>Rp {sumGajiKotor.toLocaleString("id-ID")}</strong>
                    </div>
                    {sumTabungan > 0 && (
                      <div>
                        <span style={{ color: "#b45309" }}>TABUNGAN: </span>
                        <strong style={{ color: "#b45309" }}>-Rp {sumTabungan.toLocaleString("id-ID")}</strong>
                      </div>
                    )}
                    {Object.entries(iuranSummary).map(([nm, val]) => (
                      <div key={nm}>
                        <span style={{ color: "#E24B4A" }}>{nm}: </span>
                        <strong style={{ color: "#E24B4A" }}>-Rp {val.toLocaleString("id-ID")}</strong>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: "#5005A6", color: "white", padding: "4px 12px", borderRadius: 6, fontWeight: 800, fontSize: 13 }}>
                    GRAND TOTAL APPROVAL: Rp {grandTotalApproval.toLocaleString("id-ID")}
                  </div>
                </div>
              </div>
            );
          })()}

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
                          {selectedPayroll.status !== "FINAL" && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenEditDetail(d)}
                              title="Edit Penyesuaian & Potongan"
                              style={{ color: "#7e22ce", borderColor: "#e9d5ff" }}
                            >
                              <Edit size={13} /> Edit
                            </button>
                          )}
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

      {/* Modal Edit / Penyesuaian Potongan & Tunjangan */}
      <Modal
        show={isEditModalOpen && Boolean(editingDetail)}
        onClose={() => setIsEditModalOpen(false)}
        title={`Penyesuaian Gaji & Potongan — ${editingDetail?.snapshot_nama}`}
        width={550}
      >
        {editingDetail && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 12, color: "#6b7280", background: "#f9fafb", padding: "8px 12px", borderRadius: 6, border: "1px solid #e5e7eb" }}>
              <div>Karyawan: <strong>{editingDetail.snapshot_nama}</strong> ({editingDetail.kode_karyawan})</div>
              <div>Jabatan: {editingDetail.snapshot_jabatan} — {getDivisionCategory(editingDetail)}</div>
              <div>Gaji Pokok: Rp {Number(editingDetail.subtotal_gaji_pokok || 0).toLocaleString("id-ID")} ({editingDetail.hari_hadir} Hari)</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Lembur Pagi (Rp)</label>
                <input
                  type="number"
                  className="erp-input"
                  style={{ width: "100%", marginTop: 4 }}
                  value={editForm.subtotal_lembur_pagi}
                  onChange={(e) => setEditForm({ ...editForm, subtotal_lembur_pagi: Number(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Bonus / Insentif (Rp)</label>
                <input
                  type="number"
                  className="erp-input"
                  style={{ width: "100%", marginTop: 4 }}
                  value={editForm.tunjangan_bonus}
                  onChange={(e) => setEditForm({ ...editForm, tunjangan_bonus: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Tunjangan KM Driver (Rp)</label>
              <input
                type="number"
                className="erp-input"
                style={{ width: "100%", marginTop: 4 }}
                value={editForm.tunjangan_km}
                onChange={(e) => setEditForm({ ...editForm, tunjangan_km: Number(e.target.value) || 0 })}
              />
            </div>

            {/* Potongan Tabungan */}
            <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", padding: "10px 12px", borderRadius: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>Potongan Tabungan (Rp / Pekan)</label>
              <input
                type="number"
                className="erp-input"
                style={{ width: "100%", marginTop: 4 }}
                value={editForm.potongan_tabungan}
                onChange={(e) => setEditForm({ ...editForm, potongan_tabungan: Number(e.target.value) || 0 })}
              />
            </div>

            {/* Potongan Iuran Dinamis */}
            <div style={{ background: "#fdf2f8", border: "1px solid #fbcfe8", padding: "10px 12px", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#9d174d" }}>Potongan Iuran Dinamis</label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 11, padding: "2px 8px" }}
                  onClick={() => {
                    setEditForm({
                      ...editForm,
                      rincian_potongan: [...editForm.rincian_potongan, { nama: "Iuran", nominal: 10000 }],
                    });
                  }}
                >
                  <Plus size={11} /> Tambah Iuran
                </button>
              </div>

              {editForm.rincian_potongan.length === 0 ? (
                <div style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>
                  Belum ada potongan iuran untuk karyawan ini
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {editForm.rincian_potongan.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Nama Iuran (mis: Iuran Azis)"
                        className="erp-input"
                        style={{ flex: 1, fontSize: 12 }}
                        value={item.nama}
                        onChange={(e) => {
                          const updated = [...editForm.rincian_potongan];
                          updated[idx].nama = e.target.value;
                          setEditForm({ ...editForm, rincian_potongan: updated });
                        }}
                      />
                      <input
                        type="number"
                        placeholder="Nominal (Rp)"
                        className="erp-input"
                        style={{ width: 110, fontSize: 12 }}
                        value={item.nominal}
                        onChange={(e) => {
                          const updated = [...editForm.rincian_potongan];
                          updated[idx].nominal = Number(e.target.value) || 0;
                          setEditForm({ ...editForm, rincian_potongan: updated });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editForm.rincian_potongan.filter((_, i) => i !== idx);
                          setEditForm({ ...editForm, rincian_potongan: updated });
                        }}
                        style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Catatan Payroll</label>
              <textarea
                className="erp-input"
                rows={2}
                style={{ width: "100%", marginTop: 4, fontSize: 12 }}
                value={editForm.catatan_payroll}
                onChange={(e) => setEditForm({ ...editForm, catatan_payroll: e.target.value })}
                placeholder="Misal: Penyesuaian lembur kirim batununggal"
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEditModalOpen(false)}
                disabled={savingDetail}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveEditDetail}
                disabled={savingDetail}
              >
                {savingDetail ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
