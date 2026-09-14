"use client";

import { useState, useEffect } from "react";
import { Clock, Calendar, Save, CheckCircle2, AlertCircle, Users, Sparkles, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

interface DailyRecord {
  employee_id: number;
  kode_karyawan: string;
  nama_lengkap: string;
  nama_fingerprint: string;
  department_nama: string;
  position_nama: string;
  tipe_karyawan: string;
  tipe_gaji: string;
  tipe_periode_gaji: string;
  gaji_pokok_harian: number;
  lembur_per_jam: number;
  attendance_id: number | null;
  tanggal: string;
  jam_masuk: string;
  jam_keluar: string;
  durasi_kerja_menit: number;
  lembur_menit: number;
  lembur_pagi_menit: number;
  bonus_harian: number;
  keterangan: string;
  catatan: string;
}

export default function PresensiHarianPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().substring(0, 10);
  });
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Filters
  const [deptFilter, setDeptFilter] = useState<string>("SEMUA");
  const [periodeFilter, setPeriodeFilter] = useState<string>("SEMUA");
  const [search, setSearch] = useState<string>("");

  const fetchDailyAttendance = async (dateStr: string) => {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/hr/attendances/daily?date=${dateStr}`);
      const data = await res.json();
      if (res.ok) {
        const mapped = (data.employees || []).map((e: any) => ({
          employee_id: e.employee_id,
          kode_karyawan: e.kode_karyawan,
          nama_lengkap: e.nama_lengkap,
          nama_fingerprint: e.nama_fingerprint,
          department_nama: e.department_nama || "-",
          position_nama: e.position_nama || "-",
          tipe_karyawan: e.tipe_karyawan || "TETAP",
          tipe_gaji: e.tipe_gaji || "HARIAN_PRODUKSI",
          tipe_periode_gaji: e.tipe_periode_gaji || "PEKANAN",
          gaji_pokok_harian: Number(e.gaji_pokok_harian || 0),
          lembur_per_jam: Number(e.lembur_per_jam || 0),
          attendance_id: e.attendance_id || null,
          tanggal: dateStr,
          jam_masuk: e.jam_masuk ? e.jam_masuk.substring(0, 5) : "",
          jam_keluar: e.jam_keluar ? e.jam_keluar.substring(0, 5) : "",
          durasi_kerja_menit: e.durasi_kerja_menit || 0,
          lembur_menit: e.lembur_menit || 0,
          lembur_pagi_menit: e.lembur_pagi_menit || 0,
          bonus_harian: e.bonus_harian || 0,
          keterangan: e.keterangan || "HADIR",
          catatan: e.catatan || "",
        }));
        setRecords(mapped);
      } else {
        setErrorMsg(data.error || "Gagal memuat presensi harian");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyAttendance(selectedDate);
  }, [selectedDate]);

  const handleRecordChange = (empId: number, field: keyof DailyRecord, value: any) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.employee_id !== empId) return r;
        const updated = { ...r, [field]: value };

        // Auto calculate durasi kerja & jam lembur jika jam_masuk dan jam_keluar diisi
        if (field === "jam_masuk" || field === "jam_keluar") {
          const inVal = field === "jam_masuk" ? value : r.jam_masuk;
          const outVal = field === "jam_keluar" ? value : r.jam_keluar;
          if (inVal && outVal) {
            const [inH, inM] = inVal.split(":").map(Number);
            const [outH, outM] = outVal.split(":").map(Number);
            let inTotal = inH * 60 + inM;
            let outTotal = outH * 60 + outM;
            if (outTotal < inTotal) {
              outTotal += 24 * 60; // Cross midnight
            }
            const diffMenit = outTotal - inTotal;
            updated.durasi_kerja_menit = diffMenit;
            // Jika lebih dari 8 jam (480 menit), auto sarankan lembur
            if (diffMenit > 480) {
              updated.lembur_menit = diffMenit - 480;
            }
          }
        }

        return updated;
      })
    );
  };

  const handleQuickBonusSaturday = (nominal: number) => {
    setRecords((prev) =>
      prev.map((r) => {
        // Khusus tim produksi / dapur atau yang tipe_periode_gaji PEKANAN
        if (r.tipe_gaji === "HARIAN_PRODUKSI" || r.tipe_periode_gaji === "PEKANAN") {
          return { ...r, bonus_harian: nominal };
        }
        return r;
      })
    );
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const payload = {
        date: selectedDate,
        records: records.map((r) => ({
          employee_id: r.employee_id,
          jam_masuk: r.jam_masuk || null,
          jam_keluar: r.jam_keluar || null,
          durasi_kerja_menit: r.durasi_kerja_menit,
          lembur_menit: r.lembur_menit,
          lembur_pagi_menit: r.lembur_pagi_menit,
          bonus_harian: r.bonus_harian,
          keterangan: r.keterangan,
          catatan: r.catatan,
        })),
      };

      const res = await fetch("/api/hr/attendances/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Seluruh data presensi dan bonus harian berhasil disimpan!");
        fetchDailyAttendance(selectedDate);
      } else {
        setErrorMsg(data.error || "Gagal menyimpan presensi harian");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changeDateBy = (days: number) => {
    const curr = new Date(selectedDate);
    curr.setDate(curr.getDate() + days);
    setSelectedDate(curr.toISOString().substring(0, 10));
  };

  // Check if Saturday
  const dateObj = new Date(selectedDate);
  const dayIndex = dateObj.getDay(); // 0 is Sunday, 6 is Saturday
  const dayNames = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jum'at", "Sabtu"];
  const currentDayName = dayNames[dayIndex];
  const isSaturday = dayIndex === 6;

  // Filtered records
  const filteredRecords = records.filter((r) => {
    const matchSearch =
      r.nama_lengkap.toLowerCase().includes(search.toLowerCase()) ||
      r.kode_karyawan.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === "SEMUA" || r.department_nama === deptFilter;
    const matchPeriode = periodeFilter === "SEMUA" || r.tipe_periode_gaji === periodeFilter;
    return matchSearch && matchDept && matchPeriode;
  });

  const uniqueDepts = Array.from(new Set(records.map((r) => r.department_nama))).filter(Boolean);

  return (
    <div style={{ padding: "0 4px" }}>
      <PageHeader
        title="Input Presensi Harian & Bonus"
        subtitle={`Pencatatan harian jam datang, pulang, lembur, dan bonus harian tim dapur (${currentDayName}, ${selectedDate})`}
        actions={
          <button
            onClick={handleSaveAll}
            disabled={saving || loading}
            className="btn btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Save size={16} /> {saving ? "Menyimpan..." : "Simpan Semua Presensi"}
          </button>
        }
      />

      {/* Date Navigation & Quick Toolbar */}
      <div className="erp-card" style={{ marginBottom: 14, padding: "14px 18px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          {/* Date Picker Bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => changeDateBy(-1)}
              className="btn btn-secondary btn-sm"
              style={{ padding: "6px 10px" }}
              title="Hari Sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={18} style={{ color: "#5005A6" }} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ fontWeight: 700, fontSize: 14, padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
              />
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: isSaturday ? "#fef3c7" : "#ede9fe",
                  color: isSaturday ? "#b45309" : "#5005A6",
                  border: isSaturday ? "1px solid #fde68a" : "1px solid #ddd6fe",
                }}
              >
                Hari: {currentDayName} {isSaturday && "⭐ (Hari Pembagian Bonus Dapur)"}
              </span>
            </div>
            <button
              onClick={() => changeDateBy(1)}
              className="btn btn-secondary btn-sm"
              style={{ padding: "6px 10px" }}
              title="Hari Berikutnya"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setSelectedDate(new Date().toISOString().substring(0, 10))}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 12 }}
            >
              Hari Ini
            </button>
          </div>

          {/* Quick Bonus Setter for Saturday */}
          {isSaturday && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fffbeb", padding: "6px 12px", borderRadius: 8, border: "1px solid #fef08a" }}>
              <Sparkles size={16} color="#d97706" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>Auto-Set Bonus Sabtu:</span>
              <button
                type="button"
                onClick={() => handleQuickBonusSaturday(50000)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: "4px 8px" }}
              >
                Rp 50.000
              </button>
              <button
                type="button"
                onClick={() => handleQuickBonusSaturday(30000)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: "4px 8px" }}
              >
                Rp 30.000
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = prompt("Masukkan nominal bonus tim dapur hari ini (Rp):", "50000");
                  if (val && !isNaN(Number(val))) handleQuickBonusSaturday(Number(val));
                }}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: "4px 8px" }}
              >
                Custom...
              </button>
            </div>
          )}
        </div>

        {/* Filter Controls Row */}
        <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 12, borderTop: "1px solid #f3f4f6", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Cari nama karyawan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220, fontSize: 13, padding: "6px 10px" }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>Departemen:</span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{ fontSize: 13, padding: "5px 8px" }}
            >
              <option value="SEMUA">Semua Departemen</option>
              {uniqueDepts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>Tipe Payroll:</span>
            <select
              value={periodeFilter}
              onChange={(e) => setPeriodeFilter(e.target.value)}
              style={{ fontSize: 13, padding: "5px 8px" }}
            >
              <option value="SEMUA">Semua Tipe</option>
              <option value="PEKANAN">Pekanan (Dapur/Produksi)</option>
              <option value="BULANAN">Bulanan</option>
            </select>
          </div>

          <div style={{ marginLeft: "auto", fontSize: 13, color: "#6b7280" }}>
            Menampilkan <strong>{filteredRecords.length}</strong> dari {records.length} karyawan
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-medium flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Daily Attendance Matrix Table */}
      <div className="erp-card-flush">
        {loading ? (
          <p style={{ padding: 24, color: "#6b7280", fontSize: 15, textAlign: "center" }}>Memuat presensi harian...</p>
        ) : filteredRecords.length === 0 ? (
          <p style={{ padding: 24, color: "#6b7280", fontSize: 15, textAlign: "center" }}>Tidak ada data karyawan ditemukan.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ width: 40, textAlign: "center", padding: "10px 8px" }}>No.</th>
                  <th style={{ padding: "10px 10px" }}>Karyawan</th>
                  <th style={{ width: 100, padding: "10px 8px" }}>Kehadiran</th>
                  <th style={{ width: 95, padding: "10px 8px" }}>Jam Masuk</th>
                  <th style={{ width: 95, padding: "10px 8px" }}>Jam Keluar</th>
                  <th style={{ width: 95, padding: "10px 8px" }}>Durasi Kerja</th>
                  <th style={{ width: 95, padding: "10px 8px" }}>Jam Lembur</th>
                  <th style={{ width: 95, padding: "10px 8px" }}>Lembur Pagi</th>
                  <th style={{ width: 120, padding: "10px 8px", background: isSaturday ? "#fef3c7" : undefined }}>
                    Bonus Harian (Rp) {isSaturday && "⭐"}
                  </th>
                  <th style={{ padding: "10px 8px" }}>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r, idx) => {
                  const jamKerjaHours = (r.durasi_kerja_menit / 60).toFixed(1);
                  const jamLemburHours = (r.lembur_menit / 60).toFixed(1);
                  const jamLemburPagiHours = (r.lembur_pagi_menit / 60).toFixed(1);

                  return (
                    <tr
                      key={r.employee_id}
                      style={{
                        borderBottom: "1px solid #e5e7eb",
                        background: r.keterangan !== "HADIR" ? "#f9fafb" : "white",
                      }}
                    >
                      <td style={{ textAlign: "center", color: "#6b7280" }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: "#111827" }}>{r.nama_lengkap}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                          {r.kode_karyawan} · {r.department_nama} ({r.position_nama})
                        </div>
                        <div style={{ fontSize: 10, marginTop: 2 }}>
                          <span style={{ padding: "1px 5px", borderRadius: 4, background: r.tipe_periode_gaji === "BULANAN" ? "#e0f2fe" : "#fef3c7", color: r.tipe_periode_gaji === "BULANAN" ? "#0369a1" : "#b45309", fontWeight: 700 }}>
                            {r.tipe_periode_gaji}
                          </span>
                          <span style={{ marginLeft: 4, color: "#6b7280" }}>
                            Pokok: Rp {r.gaji_pokok_harian.toLocaleString("id-ID")}
                          </span>
                        </div>
                      </td>
                      <td>
                        <select
                          value={r.keterangan}
                          onChange={(e) => handleRecordChange(r.employee_id, "keterangan", e.target.value)}
                          style={{
                            fontSize: 12,
                            padding: "4px 6px",
                            borderRadius: 6,
                            fontWeight: 700,
                            color: r.keterangan === "HADIR" ? "#15803d" : "#b91c1c",
                            background: r.keterangan === "HADIR" ? "#f0fdf4" : "#fef2f2",
                            border: "1px solid #d1d5db",
                            width: "100%",
                          }}
                        >
                          <option value="HADIR">HADIR</option>
                          <option value="ABSEN">ABSEN (Alpa)</option>
                          <option value="IZIN">IZIN</option>
                          <option value="SAKIT">SAKIT</option>
                          <option value="CUTI">CUTI</option>
                          <option value="DINAS">DINAS</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="time"
                          value={r.jam_masuk}
                          onChange={(e) => handleRecordChange(r.employee_id, "jam_masuk", e.target.value)}
                          disabled={r.keterangan !== "HADIR"}
                          style={{ fontSize: 12, padding: "4px 6px", width: "100%", borderRadius: 6, border: "1px solid #d1d5db" }}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          value={r.jam_keluar}
                          onChange={(e) => handleRecordChange(r.employee_id, "jam_keluar", e.target.value)}
                          disabled={r.keterangan !== "HADIR"}
                          style={{ fontSize: 12, padding: "4px 6px", width: "100%", borderRadius: 6, border: "1px solid #d1d5db" }}
                        />
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="number"
                            step="0.1"
                            value={jamKerjaHours}
                            onChange={(e) => {
                              const hrs = parseFloat(e.target.value) || 0;
                              handleRecordChange(r.employee_id, "durasi_kerja_menit", Math.round(hrs * 60));
                            }}
                            disabled={r.keterangan !== "HADIR"}
                            style={{ fontSize: 12, padding: "4px 6px", width: 65, borderRadius: 6, border: "1px solid #d1d5db" }}
                          />
                          <span style={{ fontSize: 11, color: "#6b7280" }}>Jam</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="number"
                            step="0.1"
                            value={jamLemburHours}
                            onChange={(e) => {
                              const hrs = parseFloat(e.target.value) || 0;
                              handleRecordChange(r.employee_id, "lembur_menit", Math.round(hrs * 60));
                            }}
                            disabled={r.keterangan !== "HADIR"}
                            style={{ fontSize: 12, padding: "4px 6px", width: 65, borderRadius: 6, border: "1px solid #d1d5db" }}
                          />
                          <span style={{ fontSize: 11, color: "#6b7280" }}>Jam</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="number"
                            step="0.1"
                            value={jamLemburPagiHours}
                            onChange={(e) => {
                              const hrs = parseFloat(e.target.value) || 0;
                              handleRecordChange(r.employee_id, "lembur_pagi_menit", Math.round(hrs * 60));
                            }}
                            disabled={r.keterangan !== "HADIR"}
                            style={{ fontSize: 12, padding: "4px 6px", width: 65, borderRadius: 6, border: "1px solid #d1d5db" }}
                          />
                          <span style={{ fontSize: 11, color: "#6b7280" }}>Jam</span>
                        </div>
                      </td>
                      <td style={{ background: isSaturday ? "#fffbeb" : undefined }}>
                        <input
                          type="number"
                          step="1000"
                          value={r.bonus_harian}
                          onChange={(e) => handleRecordChange(r.employee_id, "bonus_harian", parseInt(e.target.value, 10) || 0)}
                          style={{
                            fontSize: 12,
                            padding: "4px 8px",
                            width: "100%",
                            borderRadius: 6,
                            border: r.bonus_harian > 0 ? "1.5px solid #d97706" : "1px solid #d1d5db",
                            fontWeight: r.bonus_harian > 0 ? 700 : 500,
                            color: r.bonus_harian > 0 ? "#b45309" : "#111827",
                          }}
                          placeholder="0"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={r.catatan}
                          onChange={(e) => handleRecordChange(r.employee_id, "catatan", e.target.value)}
                          placeholder="Opsional..."
                          style={{ fontSize: 12, padding: "4px 6px", width: "100%", borderRadius: 6, border: "1px solid #d1d5db" }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div
        style={{
          position: "sticky",
          bottom: 16,
          marginTop: 16,
          padding: "12px 20px",
          background: "white",
          borderRadius: 12,
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          border: "1px solid #e5e7eb",
        }}
      >
        <div style={{ fontSize: 13, color: "#4b5563" }}>
          💡 <em>Tip: Data presensi dan bonus harian yang tersimpan di sini akan otomatis ditarik saat Anda melakukan <strong>Kalkulasi Payroll</strong>.</em>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={saving || loading}
          className="btn btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", fontSize: 14, fontWeight: 700 }}
        >
          <Save size={16} /> {saving ? "Menyimpan..." : "Simpan Semua Presensi"}
        </button>
      </div>
    </div>
  );
}
