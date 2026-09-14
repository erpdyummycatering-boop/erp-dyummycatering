"use client";

import { useState, useEffect } from "react";
import { DollarSign, Play, CheckCircle, Calculator, FileText, AlertCircle, Edit, Plus, Trash2, Calendar, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { PageHeader, FormField } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

interface RincianPotonganItem {
  nama: string;
  nominal: number;
}

export default function ProsesPayrollPage() {
  // Mode Periode: PEKANAN, BULANAN, CUSTOM
  const [tipePayroll, setTipePayroll] = useState<"PEKANAN" | "BULANAN" | "CUSTOM">("PEKANAN");

  // Date range for PEKANAN or CUSTOM
  const [tanggalMulai, setTanggalMulai] = useState<string>(() => {
    const d = new Date();
    // Default to last Saturday
    const day = d.getDay();
    const diffToSat = (day + 1) % 7; // days since last Saturday
    d.setDate(d.getDate() - diffToSat - 7);
    return d.toISOString().substring(0, 10);
  });
  const [tanggalSelesai, setTanggalSelesai] = useState<string>(() => {
    const d = new Date();
    const day = d.getDay();
    const diffToSat = (day + 1) % 7;
    d.setDate(d.getDate() - diffToSat - 1); // Friday
    return d.toISOString().substring(0, 10);
  });

  // For BULANAN
  const [periodeTahun, setPeriodeTahun] = useState("2026");
  const [periodeBulan, setPeriodeBulan] = useState("9");

  // Optional filter employee tipe
  const [tipeFilter, setTipeFilter] = useState<string>("SEMUA");

  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [payrollDetail, setPayrollDetail] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Edit Detail Modal
  const [editingDetail, setEditingDetail] = useState<any>(null);
  const [adjForm, setAdjForm] = useState({
    subtotal_lembur_pagi: "0",
    tunjangan_bonus: "0",
    tunjangan_km: "0",
    pembulatan: "0",
    potongan_tabungan: "0",
    potongan_lain: "0",
    catatan_payroll: "",
  });

  // Dynamic Potongan Items
  const [potonganList, setPotonganList] = useState<RincianPotonganItem[]>([]);

  useEffect(() => {
    setCurrentPage(1);
  }, [payrollDetail, pageSize]);

  const handleCalculatePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setResult(null);
    setPayrollDetail(null);
    setErrorMsg("");

    try {
      const payload: any = {
        tipe_payroll: tipePayroll,
        tipe_periode_filter: tipeFilter,
      };

      if (tipePayroll === "BULANAN") {
        payload.periode_tahun = parseInt(periodeTahun, 10);
        payload.periode_bulan = parseInt(periodeBulan, 10);
      } else {
        payload.tanggal_mulai = tanggalMulai;
        payload.tanggal_selesai = tanggalSelesai;
      }

      const res = await fetch("/api/hr/payroll/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setResult(data);
        fetchPayrollDetail(data.payroll_id);
      } else {
        setErrorMsg(data.error || "Gagal menghitung payroll");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const fetchPayrollDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/hr/payroll/${id}`);
      const data = await res.json();
      if (res.ok) {
        setPayrollDetail(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenEditDetail = (det: any) => {
    setEditingDetail(det);
    setAdjForm({
      subtotal_lembur_pagi: String(det.subtotal_lembur_pagi || 0),
      tunjangan_bonus: String(det.tunjangan_bonus || det.subtotal_bonus || 0),
      tunjangan_km: String(det.tunjangan_km || 0),
      pembulatan: String(det.pembulatan || 0),
      potongan_tabungan: String(det.potongan_tabungan || 0),
      potongan_lain: String(det.potongan_lain || 0),
      catatan_payroll: det.catatan_payroll || "",
    });

    let existingRincian: RincianPotonganItem[] = [];
    if (Array.isArray(det.rincian_potongan) && det.rincian_potongan.length > 0) {
      existingRincian = det.rincian_potongan;
    } else if (det.potongan_tabungan > 0) {
      existingRincian = [{ nama: "Potongan Tabungan", nominal: Number(det.potongan_tabungan) }];
    }
    setPotonganList(existingRincian);
  };

  const handleAddPotonganRow = () => {
    setPotonganList([...potonganList, { nama: "Potongan Lain", nominal: 0 }]);
  };

  const handleRemovePotonganRow = (index: number) => {
    setPotonganList(potonganList.filter((_, idx) => idx !== index));
  };

  const handlePotonganRowChange = (index: number, field: "nama" | "nominal", val: any) => {
    const updated = [...potonganList];
    if (field === "nominal") {
      updated[index].nominal = Number(val) || 0;
    } else {
      updated[index].nama = val;
    }
    setPotonganList(updated);
  };

  const handleSaveDetailAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDetail || !payrollDetail) return;

    try {
      const sumPotonganRincian = potonganList.reduce((acc, it) => acc + (Number(it.nominal) || 0), 0);
      const res = await fetch(`/api/hr/payroll/${payrollDetail.id}/details/${editingDetail.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtotal_lembur_pagi: parseInt(adjForm.subtotal_lembur_pagi, 10) || 0,
          tunjangan_bonus: parseInt(adjForm.tunjangan_bonus, 10) || 0,
          tunjangan_km: parseInt(adjForm.tunjangan_km, 10) || 0,
          pembulatan: parseInt(adjForm.pembulatan, 10) || 0,
          potongan_tabungan: parseInt(adjForm.potongan_tabungan, 10) || 0,
          potongan_lain: sumPotonganRincian > 0 ? sumPotonganRincian : (parseInt(adjForm.potongan_lain, 10) || 0),
          rincian_potongan: potonganList,
          catatan_payroll: adjForm.catatan_payroll,
        }),
      });

      if (res.ok) {
        setEditingDetail(null);
        fetchPayrollDetail(payrollDetail.id);
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menyimpan adjustment");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusTransition = async (newStatus: string) => {
    if (!payrollDetail) return;
    if (!confirm(`Ubah status payroll menjadi ${newStatus}?`)) return;

    try {
      const res = await fetch(`/api/hr/payroll/${payrollDetail.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchPayrollDetail(payrollDetail.id);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Pagination Calculation
  const detailsList = payrollDetail?.details || [];
  const totalItems = detailsList.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedDetails = detailsList.slice(startIndex, startIndex + pageSize);

  return (
    <div>
      <PageHeader
        title="Proses & Kalkulasi Payroll Fleksibel"
        subtitle="Hitung otomatis gaji karyawan (Pekanan, Bulanan, atau Custom Tanggal) lengkap dengan lembur, bonus harian, dan potongan fleksibel"
        actions={
          <Link href="/hr/payroll/riwayat" className="btn btn-secondary btn-sm">
            <FileText size={14} /> Lihat Riwayat & Slip
          </Link>
        }
      />

      {/* Mode & Period Selection Card */}
      <div className="erp-card" style={{ marginBottom: 16, padding: "18px 20px" }}>
        <form onSubmit={handleCalculatePayroll}>
          {/* Mode Switcher Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid #e5e7eb", paddingBottom: 12 }}>
            <button
              type="button"
              onClick={() => setTipePayroll("PEKANAN")}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: tipePayroll === "PEKANAN" ? "#5005A6" : "#f3f4f6",
                color: tipePayroll === "PEKANAN" ? "white" : "#4b5563",
              }}
            >
              📅 Gaji Pekanan (Mingguan Tim Dapur)
            </button>
            <button
              type="button"
              onClick={() => setTipePayroll("BULANAN")}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: tipePayroll === "BULANAN" ? "#5005A6" : "#f3f4f6",
                color: tipePayroll === "BULANAN" ? "white" : "#4b5563",
              }}
            >
              🗓️ Gaji Bulanan (Staf / Office)
            </button>
            <button
              type="button"
              onClick={() => setTipePayroll("CUSTOM")}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: tipePayroll === "CUSTOM" ? "#5005A6" : "#f3f4f6",
                color: tipePayroll === "CUSTOM" ? "white" : "#4b5563",
              }}
            >
              ⚙️ Custom Rentang Tanggal
            </button>
          </div>

          {/* Controls Form */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
            {tipePayroll === "BULANAN" ? (
              <>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Tahun:
                  </label>
                  <select
                    value={periodeTahun}
                    onChange={(e) => setPeriodeTahun(e.target.value)}
                    style={{ width: 110 }}
                  >
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Bulan:
                  </label>
                  <select
                    value={periodeBulan}
                    onChange={(e) => setPeriodeBulan(e.target.value)}
                    style={{ width: 160 }}
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
              </>
            ) : (
              <>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Tanggal Mulai (Dari):
                  </label>
                  <input
                    type="date"
                    required
                    value={tanggalMulai}
                    onChange={(e) => setTanggalMulai(e.target.value)}
                    style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Tanggal Selesai (Sampai):
                  </label>
                  <input
                    type="date"
                    required
                    value={tanggalSelesai}
                    onChange={(e) => setTanggalSelesai(e.target.value)}
                    style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
              </>
            )}

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                Karyawan yang Dihitung:
              </label>
              <select
                value={tipeFilter}
                onChange={(e) => setTipeFilter(e.target.value)}
                style={{ width: 180 }}
              >
                <option value="SEMUA">Semua Karyawan</option>
                <option value="PEKANAN">Khusus Tim Pekanan (Dapur)</option>
                <option value="BULANAN">Khusus Tim Bulanan</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={processing}
              className="btn btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", height: 38 }}
            >
              <Play size={15} /> {processing ? "Sedang Menghitung..." : "Kalkulasi Payroll"}
            </button>
          </div>
        </form>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-sm font-medium flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          {errorMsg}
        </div>
      )}

      {/* Result Preview & Table */}
      {payrollDetail && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="text-xs text-gray-400 font-semibold uppercase">Status Payroll Batch</div>
              <div className="flex items-center gap-3 mt-1">
                <h2 className="text-xl font-bold text-gray-900">{payrollDetail.nama_periode}</h2>
                <Badge color={payrollDetail.status === "FINAL" ? "green" : payrollDetail.status === "APPROVED" ? "blue" : "yellow"}>
                  {payrollDetail.status}
                </Badge>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#ede9fe", color: "#5005A6" }}>
                  {payrollDetail.tipe_payroll || "PEKANAN"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div>
                <div className="text-xs text-gray-500">Total Karyawan</div>
                <div className="text-lg font-bold text-gray-900">{payrollDetail.total_karyawan}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total Gaji Bersih</div>
                <div className="text-xl font-extrabold text-[#5005A6]">
                  Rp {Number(payrollDetail.total_gaji_bersih || 0).toLocaleString("id-ID")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {payrollDetail.status === "DRAFT" && (
                  <button
                    onClick={() => handleStatusTransition("PENDING_APPROVAL")}
                    className="btn btn-secondary"
                  >
                    Kirim Approval
                  </button>
                )}
                {payrollDetail.status === "PENDING_APPROVAL" && (
                  <button
                    onClick={() => handleStatusTransition("APPROVED")}
                    className="btn btn-primary"
                  >
                    Approve (Finance)
                  </button>
                )}
                {payrollDetail.status === "APPROVED" && (
                  <button
                    onClick={() => handleStatusTransition("FINAL")}
                    className="btn btn-primary"
                  >
                    Finalisasi Payroll
                  </button>
                )}
                <Link
                  href="/hr/payroll/riwayat"
                  className="btn btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <FileText size={14} /> Cetak Slip A4 Multi-Up <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="erp-card-flush">
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, fontSize: 15, color: "#5005A6" }}>
              Rincian Perhitungan Gaji Karyawan ({payrollDetail.tipe_payroll || "PEKANAN"})
            </div>

            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: "center" }}>No.</th>
                    <th>Karyawan</th>
                    <th>Dept / Jabatan</th>
                    <th>Hadir</th>
                    <th>Gaji Pokok</th>
                    <th>Lembur</th>
                    <th>Bonus</th>
                    <th>Potongan</th>
                    <th style={{ color: "#5005A6" }}>Gaji Bersih</th>
                    <th style={{ textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDetails.map((d: any, idx: number) => {
                    const totalLemburRp = Number(d.subtotal_lembur || 0) + Number(d.subtotal_lembur_pagi || 0);
                    const totalBonusRp = Number(d.tunjangan_bonus || d.subtotal_bonus || 0);
                    const totalPot = Number(d.total_potongan || 0);

                    return (
                      <tr key={d.id}>
                        <td style={{ textAlign: "center", color: "#6b7280" }}>{startIndex + idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{d.snapshot_nama}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{d.kode_karyawan}</div>
                        </td>
                        <td>
                          <div>{d.snapshot_departemen}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{d.snapshot_jabatan}</div>
                        </td>
                        <td>
                          <span style={{ color: "#639922", fontWeight: 700 }}>{d.hari_hadir} Hari</span>
                        </td>
                        <td>Rp {Number(d.subtotal_gaji_pokok || 0).toLocaleString("id-ID")}</td>
                        <td>
                          Rp {totalLemburRp.toLocaleString("id-ID")}
                          {d.subtotal_lembur_pagi > 0 && (
                            <div style={{ fontSize: 10, color: "#5005A6" }}>+ Pagi: Rp {Number(d.subtotal_lembur_pagi).toLocaleString("id-ID")}</div>
                          )}
                        </td>
                        <td>
                          {totalBonusRp > 0 ? (
                            <span style={{ fontWeight: 700, color: "#b45309" }}>
                              Rp {totalBonusRp.toLocaleString("id-ID")}
                            </span>
                          ) : (
                            <span style={{ color: "#9ca3af" }}>Rp 0</span>
                          )}
                        </td>
                        <td>
                          {totalPot > 0 ? (
                            <span style={{ fontWeight: 700, color: "#E24B4A" }}>
                              -Rp {totalPot.toLocaleString("id-ID")}
                            </span>
                          ) : (
                            <span style={{ color: "#9ca3af" }}>Rp 0</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 800, color: "#5005A6", fontSize: 14 }}>
                          Rp {Number(d.gaji_bersih || 0).toLocaleString("id-ID")}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEditDetail(d)}
                          >
                            <Edit size={14} /> Adjust / Potongan
                          </button>
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
        </div>
      )}

      {/* Modal Adjustment & Potongan Fleksibel */}
      <Modal
        show={Boolean(editingDetail)}
        onClose={() => setEditingDetail(null)}
        title="Adjustment & Rincian Potongan Fleksibel"
        width={560}
      >
        {editingDetail && (
          <form onSubmit={handleSaveDetailAdjustment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: "#6b7280", paddingBottom: 8, borderBottom: "1px solid #e5e7eb" }}>
              Karyawan: <strong style={{ color: "#111827" }}>{editingDetail.snapshot_nama}</strong> ({editingDetail.kode_karyawan})
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Bonus Harian / Insentif (Rp)">
                <input
                  type="number"
                  value={adjForm.tunjangan_bonus}
                  onChange={(e) => setAdjForm({ ...adjForm, tunjangan_bonus: e.target.value })}
                />
              </FormField>

              <FormField label="Lembur Pagi (Rp)">
                <input
                  type="number"
                  value={adjForm.subtotal_lembur_pagi}
                  onChange={(e) => setAdjForm({ ...adjForm, subtotal_lembur_pagi: e.target.value })}
                />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Tunjangan KM / Trip Driver">
                <input
                  type="number"
                  value={adjForm.tunjangan_km}
                  onChange={(e) => setAdjForm({ ...adjForm, tunjangan_km: e.target.value })}
                />
              </FormField>

              <FormField label="Pembulatan (+ / -)">
                <input
                  type="number"
                  value={adjForm.pembulatan}
                  onChange={(e) => setAdjForm({ ...adjForm, pembulatan: e.target.value })}
                />
              </FormField>
            </div>

            {/* Rincian Potongan Fleksibel */}
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#E24B4A" }}>
                  Rincian Potongan (Fleksibel Tiap Orang)
                </span>
                <button
                  type="button"
                  onClick={handleAddPotonganRow}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 11, padding: "3px 8px" }}
                >
                  <Plus size={12} /> Tambah Baris Potongan
                </button>
              </div>

              {potonganList.length === 0 ? (
                <div style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic", padding: "8px 0" }}>
                  Belum ada potongan khusus (misal: Potongan Tabungan, Kasbon, Seragam, dll). Klik &quot;Tambah Baris Potongan&quot; jika ada.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {potonganList.map((item, pIdx) => (
                    <div key={pIdx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Nama Potongan (misal: Potongan Tabungan)"
                        value={item.nama}
                        onChange={(e) => handlePotonganRowChange(pIdx, "nama", e.target.value)}
                        style={{ flex: 2, fontSize: 12, padding: "5px 8px" }}
                      />
                      <input
                        type="number"
                        placeholder="Nominal (Rp)"
                        value={item.nominal}
                        onChange={(e) => handlePotonganRowChange(pIdx, "nominal", e.target.value)}
                        style={{ flex: 1.5, fontSize: 12, padding: "5px 8px", color: "#E24B4A", fontWeight: 700 }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePotonganRow(pIdx)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
                        title="Hapus baris"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <FormField label="Catatan Slip Gaji">
              <input
                type="text"
                value={adjForm.catatan_payroll}
                onChange={(e) => setAdjForm({ ...adjForm, catatan_payroll: e.target.value })}
                placeholder="misal: Tabungan diambil Rp 100.000"
              />
            </FormField>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setEditingDetail(null)} className="btn btn-secondary">
                Batal
              </button>
              <button type="submit" className="btn btn-primary">
                Simpan Penyesuaian
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
