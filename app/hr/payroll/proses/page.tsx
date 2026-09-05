"use client";

import { useState, useEffect } from "react";
import { DollarSign, Play, CheckCircle, Calculator, FileText, AlertCircle, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { PageHeader, FormField } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

export default function ProsesPayrollPage() {
  const [periodeTahun, setPeriodeTahun] = useState("2026");
  const [periodeBulan, setPeriodeBulan] = useState("9");
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
    tunjangan_bonus: "0",
    tunjangan_km: "0",
    pembulatan: "0",
    potongan_lain: "0",
    catatan_payroll: "",
  });

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
      const res = await fetch("/api/hr/payroll/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periode_tahun: parseInt(periodeTahun, 10),
          periode_bulan: parseInt(periodeBulan, 10),
        }),
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
      tunjangan_bonus: String(det.tunjangan_bonus || 0),
      tunjangan_km: String(det.tunjangan_km || 0),
      pembulatan: String(det.pembulatan || 0),
      potongan_lain: String(det.potongan_lain || 0),
      catatan_payroll: det.catatan_payroll || "",
    });
  };

  const handleSaveDetailAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDetail || !payrollDetail) return;

    try {
      const res = await fetch(`/api/hr/payroll/${payrollDetail.id}/details/${editingDetail.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tunjangan_bonus: parseInt(adjForm.tunjangan_bonus, 10) || 0,
          tunjangan_km: parseInt(adjForm.tunjangan_km, 10) || 0,
          pembulatan: parseInt(adjForm.pembulatan, 10) || 0,
          potongan_lain: parseInt(adjForm.potongan_lain, 10) || 0,
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
        title="Proses & Kalkulasi Payroll Bulanan"
        subtitle="Hitung otomatis gaji karyawan berdasarkan presensi, tarif harian, lembur, dan bonus"
      />

      {/* Process Filter Box */}
      <div className="erp-card" style={{ marginBottom: 16, padding: "16px 20px" }}>
        <form onSubmit={handleCalculatePayroll} style={{ display: "flex", gap: 12, flexWrap: "nowrap", alignItems: "center", overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Tahun:</span>
            <select
              value={periodeTahun}
              onChange={(e) => setPeriodeTahun(e.target.value)}
              style={{ width: 110 }}
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Bulan:</span>
            <select
              value={periodeBulan}
              onChange={(e) => setPeriodeBulan(e.target.value)}
              style={{ width: 150 }}
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

          <button
            type="submit"
            disabled={processing}
            className="btn btn-primary"
            style={{ flexShrink: 0 }}
          >
            <Play size={14} /> {processing ? "Prosesing..." : "Kalkulasi Payroll"}
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-sm font-medium flex items-center gap-2">
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
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="erp-card-flush">
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, fontSize: 15, color: "#5005A6" }}>
              Rincian Perhitungan Gaji Per Karyawan
            </div>

            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 48, textAlign: "center" }}>No.</th>
                    <th>Karyawan</th>
                    <th>Dept / Jabatan</th>
                    <th>Hadir / Absen</th>
                    <th>Subtotal Pokok</th>
                    <th>Lembur (Diakui)</th>
                    <th>Tunj. Bonus / KM</th>
                    <th>Pot. Terlambat</th>
                    <th style={{ color: "#5005A6" }}>Gaji Bersih</th>
                    <th style={{ textAlign: "right" }}>Adjustment</th>
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
                      <td>
                        <span style={{ color: "#639922", fontWeight: 600 }}>{d.hari_hadir} H</span> /{" "}
                        <span style={{ color: "#E24B4A" }}>{d.hari_absen} A</span>
                      </td>
                      <td>Rp {Number(d.subtotal_gaji_pokok || 0).toLocaleString("id-ID")}</td>
                      <td>
                        Rp {Number(d.subtotal_lembur || 0).toLocaleString("id-ID")}
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{(Number(d.jam_lembur_diakui || 0)).toFixed(1)} jam</div>
                      </td>
                      <td>
                        Rp {(Number(d.tunjangan_bonus || 0) + Number(d.tunjangan_km || 0)).toLocaleString("id-ID")}
                      </td>
                      <td style={{ color: "#E24B4A" }}>
                        Rp {Number(d.potongan_terlambat || 0).toLocaleString("id-ID")}
                      </td>
                      <td style={{ fontWeight: 700, color: "#5005A6" }}>
                        Rp {Number(d.gaji_bersih || 0).toLocaleString("id-ID")}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEditDetail(d)}
                        >
                          <Edit size={14} /> Adjust
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
        </div>
      )}

      {/* Modal Adjustment Manual */}
      <Modal
        show={Boolean(editingDetail)}
        onClose={() => setEditingDetail(null)}
        title="Adjustment Manual Gaji"
        width={480}
      >
        {editingDetail && (
          <form onSubmit={handleSaveDetailAdjustment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              Karyawan: <strong style={{ color: "#111827" }}>{editingDetail.snapshot_nama}</strong>
            </div>

            <FormField label="Tunjangan Bonus (Rp)">
              <input
                type="number"
                value={adjForm.tunjangan_bonus}
                onChange={(e) => setAdjForm({ ...adjForm, tunjangan_bonus: e.target.value })}
              />
            </FormField>

            <FormField label="Tunjangan KM / Perjalanan (Driver)">
              <input
                type="number"
                value={adjForm.tunjangan_km}
                onChange={(e) => setAdjForm({ ...adjForm, tunjangan_km: e.target.value })}
              />
            </FormField>

            <FormField label="Potongan Lainnya (Kasbon / Alat)">
              <input
                type="number"
                value={adjForm.potongan_lain}
                onChange={(e) => setAdjForm({ ...adjForm, potongan_lain: e.target.value })}
              />
            </FormField>

            <FormField label="Catatan Slip Gaji">
              <input
                type="text"
                value={adjForm.catatan_payroll}
                onChange={(e) => setAdjForm({ ...adjForm, catatan_payroll: e.target.value })}
                placeholder="misal: Insentif lembur event khusus"
              />
            </FormField>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => setEditingDetail(null)} className="btn btn-secondary">
                Batal
              </button>
              <button type="submit" className="btn btn-primary">
                Simpan Adjustment
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
