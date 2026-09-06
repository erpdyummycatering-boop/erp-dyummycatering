"use client";

import { useState, useEffect } from "react";
import {
  Truck,
  Calendar,
  Search,
  Plus,
  Edit3,
  DollarSign,
  MapPin,
  CheckCircle2,
  FileText,
  Save,
  Calculator,
  RefreshCw,
  LayoutGrid,
  Table as TableIcon
} from "lucide-react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { formatDate } from "@/lib/utils";

interface DriverEmployee {
  employee_id: number;
  nip: string;
  nama_lengkap: string;
  jabatan_nama: string;
  gaji_pokok_harian: number;
  lembur_per_jam: number;
  tunjangan_km_tier1: number;
  tunjangan_km_tier2: number;
  tunjangan_km_tier3: number;
}

interface DriverTrip {
  id: number;
  employee_id: number;
  tanggal: string;
  total_trip: number;
  total_destinasi: number;
  km: number;
  tier: string;
  tunjangan_km: number;
  insentif_trip: number;
  keterangan: string | null;
}

export default function HRDriverTripsPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [drivers, setDrivers] = useState<DriverEmployee[]>([]);
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [ssSync, setSsSync] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State Modal Input/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<number | "">("");
  const [tanggalInput, setTanggalInput] = useState(() => new Date().toISOString().split("T")[0]);
  const [totalTrip, setTotalTrip] = useState<number>(1);
  const [totalDestinasi, setTotalDestinasi] = useState<number>(1);
  const [kmInput, setKmInput] = useState<number>(0);
  const [insentifInput, setInsentifInput] = useState<number>(0);
  const [keteranganInput, setKeteranganInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchTripData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/driver-trips?month=${month}`);
      if (!res.ok) throw new Error("Gagal mengambil data trip driver");
      const json = await res.json();
      setDrivers(json.drivers || []);
      setTrips(json.trips || []);
      setSsSync(json.siap_saji_sync || []);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTripData();
  }, [month]);

  const handleOpenAdd = (empId?: number) => {
    if (empId) setSelectedEmpId(empId);
    else setSelectedEmpId("");
    setTanggalInput(new Date().toISOString().split("T")[0]);
    setTotalTrip(1);
    setTotalDestinasi(1);
    setKmInput(0);
    setInsentifInput(0);
    setKeteranganInput("");
    setIsModalOpen(true);
  };

  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      toast.error("Silakan pilih driver terlebih dahulu");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/hr/driver-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: Number(selectedEmpId),
          tanggal: tanggalInput,
          total_trip: Number(totalTrip),
          total_destinasi: Number(totalDestinasi),
          km: Number(kmInput),
          insentif_trip: Number(insentifInput),
          keterangan: keteranganInput,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan log trip");

      toast.success("Data trip & KM driver berhasil disimpan!");
      setIsModalOpen(false);
      fetchTripData();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper Hitung Kalkulasi Rincian Draft Gaji Driver
  const calculateDriverPayrollDraft = (driver: DriverEmployee) => {
    const driverTrips = trips.filter((t) => Number(t.employee_id) === Number(driver.employee_id));
    const totalKm = driverTrips.reduce((acc, t) => acc + (Number(t.km) || 0), 0);
    const totalTripsCount = driverTrips.reduce((acc, t) => acc + (Number(t.total_trip) || 0), 0);
    const totalDestinasiCount = driverTrips.reduce((acc, t) => acc + (Number(t.total_destinasi) || 0), 0);

    // Tunjangan KM / Insentif
    const totalTunjanganKm = driverTrips.reduce((acc, t) => acc + (Number(t.tunjangan_km) || 0), 0);
    const totalInsentifTrip = driverTrips.reduce((acc, t) => acc + (Number(t.insentif_trip) || 0), 0);

    // Estimasi Hari Kerja (Berdasarkan log trip / default)
    const uniqueDays = new Set(driverTrips.map((t) => t.tanggal)).size;

    const estimasiGajiPokok = (Number(driver.gaji_pokok_harian) || 70000) * (uniqueDays || 1);
    const estimasiTotalGajiDriver = estimasiGajiPokok + totalTunjanganKm + totalInsentifTrip;

    return {
      totalKm,
      totalTripsCount,
      totalDestinasiCount,
      uniqueDays,
      totalTunjanganKm,
      totalInsentifTrip,
      estimasiGajiPokok,
      estimasiTotalGajiDriver,
    };
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingBottom: 40 }}>
      {/* ── HEADER ────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <Truck size={28} color="#5005A6" /> Hitung Trip, KM & Draft Gaji Driver
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Kalkulasi riwayat pengantaran, jumlah destinasi, jarak KM, dan draf payroll driver secara otomatis.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => fetchTripData()}
            style={{
              padding: "9px 16px",
              background: "white",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <RefreshCw size={14} /> Refresh Data
          </button>
          <button
            onClick={() => handleOpenAdd()}
            style={{
              padding: "9px 18px",
              background: "#5005A6",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 4px 12px rgba(80, 5, 166, 0.2)",
            }}
          >
            <Plus size={16} /> Input Log Trip & KM
          </button>
        </div>
      </div>

      {/* ── PERIODE FILTER BAR ────────────────────────────────────────── */}
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: "12px 18px",
          border: "1px solid #e5e7eb",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Calendar size={18} color="#6b7280" />
          <label style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Periode Bulan:</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 13,
              fontWeight: 600,
              outline: "none",
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", borderLeft: "1px solid #e5e7eb", paddingLeft: 16 }}>
          💡 Menampilkan total {drivers.length} Driver Dept. dengan estimasi insentif per perjalanan & KM.
        </div>
      </div>

      {/* ── REKAP DRAFT GAJI DRIVER SECTION ────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937", margin: 0 }}>
          📊 Ringkasan Draft Gaji & Tunjangan KM Periode {month}
        </h2>

        {/* View Toggle */}
        <div style={{ display: "flex", background: "#e5e7eb", borderRadius: 8, padding: 3, gap: 2 }}>
          <button
            onClick={() => setViewMode("card")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              background: viewMode === "card" ? "#5005A6" : "transparent",
              color: viewMode === "card" ? "white" : "#4b5563",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <LayoutGrid size={14} /> Card View
          </button>

          <button
            onClick={() => setViewMode("table")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              background: viewMode === "table" ? "#5005A6" : "transparent",
              color: viewMode === "table" ? "white" : "#4b5563",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <TableIcon size={14} /> DataGrid View
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Memuat kalkulasi trip driver...</div>
      ) : drivers.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280", background: "white", borderRadius: 12 }}>
          Tidak ada data driver terdaftar untuk periode ini.
        </div>
      ) : viewMode === "card" ? (
        /* CARD VIEW */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16, marginBottom: 32 }}>
          {drivers.map((drv) => {
            const calc = calculateDriverPayrollDraft(drv);
            return (
              <div
                key={drv.employee_id}
                style={{
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: "16px 20px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>
                      {drv.nama_lengkap}
                    </h3>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
                      {drv.nip} • {drv.jabatan_nama}
                    </p>
                  </div>
                  <button
                    onClick={() => handleOpenAdd(drv.employee_id)}
                    style={{
                      padding: "4px 8px",
                      background: "#f0fdf4",
                      color: "#15803d",
                      border: "1px solid #bbf7d0",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    + Log Trip
                  </button>
                </div>

                <div style={{ background: "#f9fafb", borderRadius: 8, padding: 12, marginBottom: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                    <div>
                      <span style={{ color: "#6b7280" }}>Total Trip:</span>
                      <strong style={{ display: "block", color: "#111827", fontSize: 14 }}>{calc.totalTripsCount} Trip</strong>
                    </div>
                    <div>
                      <span style={{ color: "#6b7280" }}>Total Destinasi:</span>
                      <strong style={{ display: "block", color: "#111827", fontSize: 14 }}>{calc.totalDestinasiCount} Alamat</strong>
                    </div>
                    <div>
                      <span style={{ color: "#6b7280" }}>Total Jarak KM:</span>
                      <strong style={{ display: "block", color: "#2563eb", fontSize: 14 }}>{calc.totalKm} KM</strong>
                    </div>
                    <div>
                      <span style={{ color: "#6b7280" }}>Tunjangan KM:</span>
                      <strong style={{ display: "block", color: "#059669", fontSize: 14 }}>Rp {calc.totalTunjanganKm.toLocaleString("id-ID")}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed #e5e7eb", paddingTop: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>ESTIMASI DRAFT GAJI:</span>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#5005A6" }}>
                      Rp {calc.estimasiTotalGajiDriver.toLocaleString("id-ID")}
                    </div>
                  </div>
                  <a
                    href="/hr/payroll/proses"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#378ADD",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Calculator size={14} /> Ke Payroll →
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DATAGRID / TABLE VIEW */
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: 32 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb", color: "#374151", fontWeight: 700, textTransform: "uppercase", fontSize: 11 }}>
                <th style={{ padding: "10px 14px", textAlign: "left" }}>No</th>
                <th style={{ padding: "10px 14px", textAlign: "left" }}>Nama Driver</th>
                <th style={{ padding: "10px 14px", textAlign: "left" }}>Jabatan</th>
                <th style={{ padding: "10px 14px", textAlign: "center" }}>Total Trip</th>
                <th style={{ padding: "10px 14px", textAlign: "center" }}>Total Destinasi</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Total Jarak (KM)</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Tunjangan KM</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Insentif Trip</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Estimasi Draft Gaji</th>
                <th style={{ padding: "10px 14px", textAlign: "center" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((drv, idx) => {
                const calc = calculateDriverPayrollDraft(drv);
                return (
                  <tr key={drv.employee_id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "10px 14px", color: "#6b7280", fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontWeight: 800, color: "#111827" }}>{drv.nama_lengkap}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{drv.nip}</div>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#4b5563" }}>{drv.jabatan_nama}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700 }}>{calc.totalTripsCount} Trip</td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700 }}>{calc.totalDestinasiCount} Alamat</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#2563eb" }}>{calc.totalKm} KM</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#059669" }}>
                      Rp {calc.totalTunjanganKm.toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#0284c7" }}>
                      Rp {calc.totalInsentifTrip.toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#5005A6", fontSize: 14 }}>
                      Rp {calc.estimasiTotalGajiDriver.toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                        <button
                          onClick={() => handleOpenAdd(drv.employee_id)}
                          style={{
                            padding: "4px 10px",
                            background: "#f0fdf4",
                            color: "#15803d",
                            border: "1px solid #bbf7d0",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          + Log Trip
                        </button>
                        <a
                          href="/hr/payroll/proses"
                          style={{
                            padding: "4px 10px",
                            background: "#eff6ff",
                            color: "#2563eb",
                            border: "1px solid #bfdbfe",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          Payroll
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── DETAIL LOG TRIP DRIVER TABLE ────────────────────────────────── */}
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937", marginBottom: 14 }}>
        📋 Detail Riwayat Trip & Pengantaran Harian Driver
      </h2>

      <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb", color: "#374151", fontWeight: 700, textTransform: "uppercase", fontSize: 11 }}>
              <th style={{ padding: "10px 14px", textAlign: "left" }}>Tanggal</th>
              <th style={{ padding: "10px 14px", textAlign: "left" }}>Nama Driver</th>
              <th style={{ padding: "10px 14px", textAlign: "center" }}>Jumlah Trip</th>
              <th style={{ padding: "10px 14px", textAlign: "center" }}>Jumlah Destinasi</th>
              <th style={{ padding: "10px 14px", textAlign: "right" }}>Jarak (KM)</th>
              <th style={{ padding: "10px 14px", textAlign: "center" }}>Tier KM</th>
              <th style={{ padding: "10px 14px", textAlign: "right" }}>Tunjangan KM</th>
              <th style={{ padding: "10px 14px", textAlign: "right" }}>Insentif Trip</th>
              <th style={{ padding: "10px 14px", textAlign: "left" }}>Keterangan / Rute</th>
            </tr>
          </thead>
          <tbody>
            {trips.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>
                  Belum ada log trip pengantaran diinput pada periode ini.
                </td>
              </tr>
            ) : (
              trips.map((t) => {
                const driverObj = drivers.find((d) => Number(d.employee_id) === Number(t.employee_id));
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "#111827" }}>{formatDate(t.tanggal)}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#5005A6" }}>
                      {driverObj?.nama_lengkap || `Driver #${t.employee_id}`}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700 }}>{t.total_trip} Trip</td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700 }}>{t.total_destinasi} Destinasi</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#2563eb" }}>{t.km} KM</td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span style={{ background: "#f3e8ff", color: "#7e22ce", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                        {t.tier || "TIER1"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#059669" }}>
                      Rp {Number(t.tunjangan_km).toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#0284c7" }}>
                      Rp {Number(t.insentif_trip).toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 12 }}>{t.keterangan || "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── MODAL INPUT LOG TRIP ────────────────────────────────────────── */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <div style={{ background: "white", width: "100%", maxWidth: 500, borderRadius: 12, padding: 20, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#111827", margin: 0 }}>
                Input Log Trip & KM Driver
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTrip}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                  Pilih Driver (Karyawan) *
                </label>
                <SearchableSelect
                  options={drivers.map((d) => ({ value: d.employee_id, label: `${d.nama_lengkap} (${d.jabatan_nama})` }))}
                  value={selectedEmpId}
                  onChange={(val) => setSelectedEmpId(val ? Number(val) : "")}
                  placeholder="-- Pilih Driver --"
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                  Tanggal Pengantaran *
                </label>
                <input
                  type="date"
                  value={tanggalInput}
                  onChange={(e) => setTanggalInput(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                    Jumlah Trip *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={totalTrip}
                    onChange={(e) => setTotalTrip(Number(e.target.value))}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                    Jumlah Destinasi/Alamat *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={totalDestinasi}
                    onChange={(e) => setTotalDestinasi(Number(e.target.value))}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                    Total Jarak KM *
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Misal: 12"
                    value={kmInput}
                    onChange={(e) => setKmInput(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                    Insentif Tambahan (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={insentifInput}
                    onChange={(e) => setInsentifInput(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                  Keterangan / Catatan Rute
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pengantaran Nasi Box area Panam"
                  value={keteranganInput}
                  onChange={(e) => setKeteranganInput(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 600, cursor: "pointer" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#5005A6", color: "white", fontWeight: 700, cursor: isSaving ? "not-allowed" : "pointer" }}
                >
                  {isSaving ? "Menyimpan..." : "Simpan Trip"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
