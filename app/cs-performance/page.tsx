"use client";
import { useEffect, useState } from "react";
import { useRole } from "@/contexts/RoleContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, AlertTriangle, BarChart2, Target, Users, CheckCircle, DollarSign, Award } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";

// Brand Colors
const BRAND = {
  primary: "#B10FBD", // Ungu
  pink: "#EC008C",    // Pink Accent
  yellow: "#FFF200",  // Kuning Accent
  white: "#FFFFFF",
  grayBg: "#f8fafc",
  textDark: "#1e293b",
};

// Status Colors
const PERF_TIERS = {
  under_perform: { label: "UNDER PERFORM", color: "#DC3545", bg: "#FDF2F2", text: "#9B1C1C", desc: "Performa di bawah standar perusahaan. Rekomendasi: Coaching intensif, bimbingan rutin, handling objection." },
  developing:    { label: "DEVELOPING", color: "#FD7E14", bg: "#FFF8F1", text: "#C2410C", desc: "Dalam tahap pengembangan, belum konsisten. Rekomendasi: Motivasi, pendampingan, evaluasi berkala." },
  competent:     { label: "COMPETENT", color: "#FFC107", bg: "#FEFCE8", text: "#854D0E", desc: "Memenuhi standar kinerja perusahaan. Rekomendasi: Pertahankan performa, tingkatkan kecepatan respon." },
  excellent:     { label: "EXCELLENT", color: "#28A745", bg: "#F0FDF4", text: "#166534", desc: "Kinerja sangat baik, melampaui standar. Rekomendasi: Pertahankan konsistensi, bagikan best practice ke tim." },
};

export default function CSPerformancePage() {
  const { activeRole } = useRole();

  const todayStr = new Date().toISOString().slice(0, 10);
  const mtdStr = todayStr.slice(0, 8) + '01'; // YYYY-MM-01

  // Filter States
  const [periodType, setPeriodType] = useState<'today' | 'month' | 'custom'>('today');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedCsId, setSelectedCsId] = useState<string>("");

  // Data States
  const [data, setData] = useState<any>({
    csData: [],
    chartData: [],
    dailyStats: {},
    transactions: [],
    activeCsList: [],
    selectedCsId: "",
    selectedCsName: "",
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ringkasan' | 'evaluasi'>('ringkasan');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Sync date ranges when periodType changes
  useEffect(() => {
    if (periodType === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (periodType === 'month') {
      setStartDate(mtdStr);
      setEndDate(todayStr);
    }
  }, [periodType]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, activeTab, selectedCsId]);

  // Fetch data
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    let url = `/api/cs-performance?startDate=${startDate}&endDate=${endDate}`;
    if (selectedCsId) {
      url += `&csId=${selectedCsId}`;
    }

    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(res => {
        setData(res);
        // If local state selectedCsId is empty and API returned a selectedCsId, update it
        if (!selectedCsId && res.selectedCsId) {
          setSelectedCsId(res.selectedCsId);
        }
      })
      .catch(err => {
        if (err.name !== "AbortError") console.error(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [startDate, endDate, selectedCsId]);

  const { csData = [], chartData = [], dailyStats = {}, transactions = [], activeCsList = [], selectedCsName = "" } = data;

  // Compute performance status
  const closingRate = dailyStats.closingRate || 0;
  const getPerfStatus = (rate: number) => {
    if (rate < 20) return PERF_TIERS.under_perform;
    if (rate <= 25) return PERF_TIERS.developing;
    if (rate <= 30) return PERF_TIERS.competent;
    return PERF_TIERS.excellent;
  };
  const currentPerf = getPerfStatus(closingRate);

  const best = csData.length ? csData.reduce((a: any, b: any) => a.monthRate > b.monthRate ? a : b) : null;
  const worst = csData.length ? csData.reduce((a: any, b: any) => a.monthRate < b.monthRate ? a : b) : null;
  const avgRate = csData.length ? (csData.reduce((s: number, c: any) => s + c.monthRate, 0) / csData.length).toFixed(1) : "0";
  const totalClosing = csData.reduce((s: number, c: any) => s + c.monthClosing, 0);

  // Helper formatting
  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div style={{ backgroundColor: "#f8fafc", minHeight: "100vh", padding: "12px 0px" }}>
      <PageHeader 
        title="CRM & Performa CS" 
        subtitle="Analisis tingkat closing, repeat order, bonus, dan pencapaian target Sales."
        actions={
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* CS Selector Dropdown for Admin/Owner */}
            {activeRole !== "CS / Sales" && activeCsList.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Pilih CS:</span>
                <select 
                  value={selectedCsId} 
                  onChange={e => setSelectedCsId(e.target.value)}
                  style={{ 
                    border: "1.5px solid #cbd5e1", 
                    borderRadius: 8, 
                    padding: "6px 12px", 
                    fontSize: 13, 
                    fontWeight: 500,
                    outline: "none", 
                    backgroundColor: "white", 
                    color: BRAND.textDark,
                    cursor: "pointer"
                  }}
                >
                  {activeCsList.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Period Filter Selector */}
            <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: 8, padding: 3 }}>
              <button 
                onClick={() => setPeriodType('today')}
                style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                  backgroundColor: periodType === 'today' ? BRAND.primary : 'transparent',
                  color: periodType === 'today' ? 'white' : '#475569',
                  transition: 'all 0.2s'
                }}
              >
                Hari Ini
              </button>
              <button 
                onClick={() => setPeriodType('month')}
                style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                  backgroundColor: periodType === 'month' ? BRAND.primary : 'transparent',
                  color: periodType === 'month' ? 'white' : '#475569',
                  transition: 'all 0.2s'
                }}
              >
                Bulan Ini
              </button>
              <button 
                onClick={() => setPeriodType('custom')}
                style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                  backgroundColor: periodType === 'custom' ? BRAND.primary : 'transparent',
                  color: periodType === 'custom' ? 'white' : '#475569',
                  transition: 'all 0.2s'
                }}
              >
                Custom
              </button>
            </div>

            {/* Custom Date Picker Inputs */}
            {periodType === 'custom' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  style={{ border: "1.5px solid #cbd5e1", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 500 }} />
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>s.d.</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  style={{ border: "1.5px solid #cbd5e1", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 500 }} />
              </div>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0px' }}>
        <button 
          onClick={() => setActiveTab('ringkasan')}
          style={{ 
            padding: '10px 18px', 
            fontWeight: 600, 
            fontSize: 14,
            color: activeTab === 'ringkasan' ? BRAND.primary : '#64748b',
            borderBottom: activeTab === 'ringkasan' ? `3px solid ${BRAND.primary}` : '3px solid transparent',
            background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer',
            transition: 'all 0.2s'
          }}>
          Dashboard Ringkasan
        </button>
        <button 
          onClick={() => setActiveTab('evaluasi')}
          style={{ 
            padding: '10px 18px', 
            fontWeight: 600, 
            fontSize: 14,
            color: activeTab === 'evaluasi' ? BRAND.primary : '#64748b',
            borderBottom: activeTab === 'evaluasi' ? `3px solid ${BRAND.primary}` : '3px solid transparent',
            background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer',
            transition: 'all 0.2s'
          }}>
          Evaluasi & Rekap CS
        </button>
      </div>

      {/* --- TAB 1: DASHBOARD RINGKASAN --- */}
      {activeTab === 'ringkasan' && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          {/* Status Performance Banner */}
          <div style={{ 
            backgroundColor: "white", 
            borderRadius: 16, 
            border: "1px solid #e2e8f0", 
            padding: "20px", 
            marginBottom: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, backgroundColor: currentPerf.color }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <p style={{ fontSize: 13, color: "#64748b", fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Status Performa CS
                </p>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: BRAND.textDark, margin: "4px 0 6px 0", display: "flex", alignItems: "center", gap: 10 }}>
                  {selectedCsName}
                  <span style={{ 
                    fontSize: 12, 
                    fontWeight: 700, 
                    backgroundColor: currentPerf.bg, 
                    color: currentPerf.text, 
                    padding: "4px 12px", 
                    borderRadius: 20, 
                    border: `1px solid ${currentPerf.color}30` 
                  }}>
                    {currentPerf.label}
                  </span>
                </h2>
                <p style={{ fontSize: 13, color: "#475569", margin: 0, fontWeight: 500 }}>
                  {currentPerf.desc}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 12, color: "#64748b", fontWeight: 600, margin: 0 }}>Periode Laporan</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: BRAND.primary, margin: "2px 0 0 0" }}>
                  {formatDate(startDate)} {startDate !== endDate && ` - ${formatDate(endDate)}`}
                </p>
              </div>
            </div>
          </div>

          {/* Section: KPI Closing Rate */}
          <div style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Award size={18} color={BRAND.primary} />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: BRAND.primary, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                📊 KPI Closing Rate
              </h3>
            </div>
            
            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />)}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 16 }}>
                {/* Lead Baru */}
                <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 12, color: "#64748b", fontWeight: 600, margin: 0 }}>LEAD BARU</p>
                    <h4 style={{ fontSize: 32, fontWeight: 700, color: BRAND.textDark, margin: "4px 0" }}>{dailyStats.leads}</h4>
                    <p style={{ fontSize: 12, color: "#64748b", margin: 0, fontWeight: 500 }}>Total lead masuk</p>
                  </div>
                  <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: "#E6F4EA", display: "flex", alignItems: "center", justifyContent: "center", color: "#137333" }}>
                    <Users size={22} />
                  </div>
                </div>

                {/* Order Baru Closing */}
                <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 12, color: "#64748b", fontWeight: 600, margin: 0 }}>ORDER BARU CLOSING</p>
                    <h4 style={{ fontSize: 32, fontWeight: 700, color: BRAND.textDark, margin: "4px 0" }}>{dailyStats.newOrders}</h4>
                    <p style={{ fontSize: 12, color: "#64748b", margin: 0, fontWeight: 500 }}>New order closing</p>
                  </div>
                  <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", color: BRAND.primary }}>
                    <CheckCircle size={22} />
                  </div>
                </div>

                {/* Closing Rate */}
                <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 12, color: "#64748b", fontWeight: 600, margin: 0 }}>CLOSING RATE</p>
                    <h4 style={{ fontSize: 32, fontWeight: 700, color: currentPerf.text, margin: "4px 0" }}>
                      {closingRate}%
                    </h4>
                    <p style={{ fontSize: 12, color: currentPerf.text, margin: 0, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: currentPerf.color }} />
                      {currentPerf.label}
                    </p>
                  </div>
                  <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: currentPerf.bg, display: "flex", alignItems: "center", justifyContent: "center", color: currentPerf.color }}>
                    <BarChart2 size={22} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section: KPI Bonus CS */}
          <div style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <DollarSign size={18} color={BRAND.pink} />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: BRAND.pink, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                💰 KPI Bonus Customer Service
              </h3>
            </div>

            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
                {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />)}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
                {/* Order Baru */}
                <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px" }}>
                  <p style={{ fontSize: 11, color: "#64748b", fontWeight: 700, margin: 0 }}>ORDER BARU</p>
                  <h4 style={{ fontSize: 24, fontWeight: 700, color: BRAND.textDark, margin: "4px 0" }}>{dailyStats.newOrders} Transaksi</h4>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#166534", margin: 0 }}>{formatRupiah(dailyStats.newOrdersValue)}</p>
                </div>

                {/* Repeat Order */}
                <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px" }}>
                  <p style={{ fontSize: 11, color: "#64748b", fontWeight: 700, margin: 0 }}>REPEAT ORDER</p>
                  <h4 style={{ fontSize: 24, fontWeight: 700, color: BRAND.textDark, margin: "4px 0" }}>{dailyStats.repeatOrders} Transaksi</h4>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#7F56D9", margin: 0 }}>{formatRupiah(dailyStats.repeatOrdersValue)}</p>
                </div>

                {/* Total Closing */}
                <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px" }}>
                  <p style={{ fontSize: 11, color: "#64748b", fontWeight: 700, margin: 0 }}>TOTAL CLOSING</p>
                  <h4 style={{ fontSize: 24, fontWeight: 700, color: BRAND.textDark, margin: "4px 0" }}>{dailyStats.totalClosing} Transaksi</h4>
                  <p style={{ fontSize: 12, color: "#64748b", margin: 0, fontWeight: 500 }}>Jumlah transaksi total</p>
                </div>

                {/* Total Omzet */}
                <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px" }}>
                  <p style={{ fontSize: 11, color: "#64748b", fontWeight: 700, margin: 0 }}>TOTAL OMZET</p>
                  <h4 style={{ fontSize: 20, fontWeight: 700, color: BRAND.pink, margin: "6px 0 4px 0" }}>{formatRupiah(dailyStats.totalOmzet)}</h4>
                  <p style={{ fontSize: 11, color: "#64748b", margin: 0, fontWeight: 600 }}>Dari {dailyStats.totalClosing} transaksi</p>
                </div>
              </div>
            )}
          </div>

          {/* Section: Transaction List Table */}
          <div className="erp-card" style={{ padding: 0, overflow: "hidden", border: "1px solid #e2e8f0", borderRadius: 16 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", backgroundColor: "white" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: BRAND.primary, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                📋 Riwayat Transaksi Closing
              </h3>
            </div>
            
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "12px 20px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Tgl Closing</th>
                    <th style={{ textAlign: "left", padding: "12px 20px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Customer ID</th>
                    <th style={{ textAlign: "left", padding: "12px 20px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Nama Customer</th>
                    <th style={{ textAlign: "left", padding: "12px 20px", fontSize: 12, fontWeight: 700, color: "#475569" }}>No. WA</th>
                    <th style={{ textAlign: "center", padding: "12px 20px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Jenis Order</th>
                    <th style={{ textAlign: "right", padding: "12px 20px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Nilai Order</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1,2,3].map(i => (
                      <tr key={i}><td colSpan={6} style={{ padding: "16px 20px" }}><div className="skeleton" style={{ height: 20, width: "100%" }} /></td></tr>
                    ))
                  ) : transactions.length > 0 ? (
                    transactions.map((tr: any) => {
                      const isNewOrder = tr.jenis_order === 'New Order';
                      return (
                        <tr key={tr.id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background-color 0.2s" }} className="hover:bg-slate-50">
                          <td style={{ padding: "14px 20px", fontSize: 13, color: "#334155" }}>
                            {formatDate(tr.closing_date)}
                          </td>
                          <td style={{ padding: "14px 20px", fontSize: 13, color: "#334155", fontWeight: 600 }}>
                            CUS-{String(tr.customer_id).padStart(3, '0')}
                          </td>
                          <td style={{ padding: "14px 20px", fontSize: 13, color: "#0f172a", fontWeight: 600 }}>
                            {tr.customer_name}
                          </td>
                          <td style={{ padding: "14px 20px", fontSize: 13, color: "#475569" }}>
                            {tr.whatsapp || "-"}
                          </td>
                          <td style={{ padding: "14px 20px", textAlign: "center" }}>
                            <span style={{
                              display: "inline-block",
                              padding: "4px 12px",
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 700,
                              backgroundColor: isNewOrder ? "#E6F4EA" : "#F3E8FF",
                              color: isNewOrder ? "#137333" : BRAND.primary,
                              border: isNewOrder ? "1px solid #13733320" : `1px solid ${BRAND.primary}20`
                            }}>
                              {isNewOrder ? "NEW ORDER" : "REPEAT ORDER"}
                            </span>
                          </td>
                          <td style={{ padding: "14px 20px", textAlign: "right", fontSize: 13, fontWeight: 700, color: BRAND.textDark }}>
                            {formatRupiah(tr.nilai_order)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "#64748b", fontSize: 13, fontWeight: 500 }}>
                        Belum ada transaksi closing pada periode ini
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: REKAP KESELURUHAN (Evaluasi Performa CS) --- */}
      {activeTab === 'evaluasi' && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 24 }}>
            {activeRole !== "CS / Sales" && (
              <>
                {/* CS Terbaik Card */}
                <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 11, color: "#64748b", fontWeight: 700, margin: 0 }}>CS TERBAIK</p>
                    <h4 style={{ fontSize: 20, fontWeight: 700, color: BRAND.primary, margin: "4px 0" }}>{best?.name?.split(" ")[0] || "-"}</h4>
                    <p style={{ fontSize: 12, color: "#166534", margin: 0, fontWeight: 600 }}>Rate: {best?.monthRate || 0}%</p>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", color: "#166534" }}>
                    <TrendingUp size={18} />
                  </div>
                </div>

                {/* Perlu Perhatian Card */}
                <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 11, color: "#64748b", fontWeight: 700, margin: 0 }}>PERLU PERHATIAN</p>
                    <h4 style={{ fontSize: 20, fontWeight: 700, color: "#DC3545", margin: "4px 0" }}>{worst?.name?.split(" ")[0] || "-"}</h4>
                    <p style={{ fontSize: 12, color: "#9B1C1C", margin: 0, fontWeight: 600 }}>Rate: {worst?.monthRate || 0}%</p>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#FDF2F2", display: "flex", alignItems: "center", justifyContent: "center", color: "#DC3545" }}>
                    <AlertTriangle size={18} />
                  </div>
                </div>
              </>
            )}

            {/* Rata-rata Rate Card */}
            <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 11, color: "#64748b", fontWeight: 700, margin: 0 }}>AVG CLOSING RATE</p>
                <h4 style={{ fontSize: 22, fontWeight: 700, color: BRAND.textDark, margin: "4px 0" }}>{avgRate}%</h4>
                <p style={{ fontSize: 11, color: "#64748b", margin: 0, fontWeight: 500 }}>Target: ≥30%</p>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#FFF8F1", display: "flex", alignItems: "center", justifyContent: "center", color: "#FD7E14" }}>
                <BarChart2 size={18} />
              </div>
            </div>

            {/* Total Closing Card */}
            <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 11, color: "#64748b", fontWeight: 700, margin: 0 }}>TOTAL NEW ORDERS</p>
                <h4 style={{ fontSize: 22, fontWeight: 700, color: BRAND.textDark, margin: "4px 0" }}>{totalClosing} order</h4>
                <p style={{ fontSize: 11, color: "#64748b", margin: 0, fontWeight: 500 }}>Berdasarkan lead closing</p>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", color: BRAND.primary }}>
                <Target size={18} />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 24, marginBottom: 24 }}>
            {/* Chart Card */}
            <div className="erp-card" style={{ border: "1px solid #e2e8f0", borderRadius: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: BRAND.primary, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                📈 Tren Closing Rate (%) per Pekan
              </p>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fontWeight: 600 }} />
                    <YAxis domain={[0, 60]} tickFormatter={v => v + "%"} tick={{ fontSize: 11, fontWeight: 600 }} />
                    <Tooltip formatter={(v: any) => Number(v).toFixed(1) + "%"} />
                    <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                    {csData.map((cs: any, i: number) => {
                      const colors = [BRAND.primary, BRAND.pink, "#10B981", "#F59E0B", "#EF4444"];
                      return (
                        <Line 
                          key={cs.id} 
                          type="monotone" 
                          dataKey={cs.name.split(" ")[0]}
                          stroke={colors[i % colors.length]} 
                          strokeWidth={3} 
                          dot={{ r: 5, strokeWidth: 2 }}
                          activeDot={{ r: 7 }} 
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              ) : <p style={{ color: "#64748b", fontSize: 12 }}>Tidak ada data chart</p>}
              <p style={{ fontSize: 11, color: "#64748b", marginTop: 8, fontWeight: 500 }}>Target standard minimum closing rate: 30%</p>
            </div>

            {/* List CS Table Card */}
            <div className="erp-card" style={{ border: "1px solid #e2e8f0", borderRadius: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: BRAND.primary, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                👥 Ringkasan Closing Rate per CS
              </p>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Nama CS</th>
                    <th style={{ textAlign: "center", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Lead</th>
                    <th style={{ textAlign: "center", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Closing</th>
                    <th style={{ textAlign: "center", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Rate</th>
                    <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {csData.map((cs: any) => {
                    const r = cs.monthRate;
                    const statusConfig = getPerfStatus(r);
                    return (
                      <tr key={cs.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ fontWeight: 600, padding: "12px 14px", fontSize: 13, color: BRAND.textDark }}>{cs.name}</td>
                        <td style={{ textAlign: "center", padding: "12px 14px", fontSize: 13, color: "#475569" }}>{cs.monthLeads}</td>
                        <td style={{ textAlign: "center", padding: "12px 14px", fontSize: 13, color: "#475569" }}>{cs.monthClosing}</td>
                        <td style={{ fontWeight: 700, textAlign: "center", padding: "12px 14px", fontSize: 13, color: statusConfig.color }}>
                          {r}%
                        </td>
                        <td style={{ textAlign: "right", padding: "12px 14px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 10,
                            fontWeight: 700,
                            backgroundColor: statusConfig.bg,
                            color: statusConfig.text,
                            border: `1px solid ${statusConfig.color}20`
                          }}>
                            {statusConfig.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {csData.filter((c: any) => c.monthRate < 25 && c.monthLeads > 0).map((cs: any) => (
                <div key={cs.id} style={{ marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: "#FDF2F2", border: "1px solid #F87171" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#9B1C1C", margin: 0 }}>⚠ Peringatan Kinerja: {cs.name}</p>
                  <p style={{ fontSize: 11, color: "#7F1D1D", marginTop: 4, margin: 0, fontWeight: 500 }}>
                    Closing Rate {cs.monthRate}% berada di bawah batas minimum 25%. Segera jadwalkan monitoring bimbingan.
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Detail Table */}
          {(() => {
            const tableRows: any[] = [];
            const numWeeks = csData[0]?.weekly?.length || 0;
            for (let i = numWeeks - 1; i >= 0; i--) {
              for (const cs of csData) {
                const w = cs.weekly[i];
                if (w) {
                  tableRows.push({
                    week: w.week,
                    dateRange: w.dateRange,
                    csName: cs.name,
                    leads: w.leads,
                    closing: w.closing,
                    rate: w.rate,
                  });
                }
              }
            }

            const totalRows = tableRows.length;
            const totalPages = Math.ceil(totalRows / limit) || 1;
            const offset = (page - 1) * limit;
            const paginatedRows = tableRows.slice(offset, offset + limit);

            return (
              <div className="erp-card" style={{ display: "flex", flexDirection: "column", border: "1px solid #e2e8f0", borderRadius: 16 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: BRAND.primary, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Detail Per Pekan (Closing Rate)
                  </p>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                          <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Periode / Pekan</th>
                          <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Nama CS</th>
                          <th style={{ textAlign: "center", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Lead Baru</th>
                          <th style={{ textAlign: "center", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Order Baru Closing</th>
                          <th style={{ textAlign: "center", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Closing Rate</th>
                          <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#475569" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: "center", padding: "20px", color: "#64748b", fontSize: 13 }}>
                              Tidak ada data pekan
                            </td>
                          </tr>
                        ) : (
                          paginatedRows.map((row, idx) => {
                            const statusConfig = getPerfStatus(row.rate);
                            return (
                              <tr key={`${row.week}-${row.csName}-${idx}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ fontWeight: 600, padding: "12px 14px", fontSize: 13, color: BRAND.textDark }}>
                                  {row.week}
                                  {row.dateRange && <span style={{ color: "#64748b", fontSize: 11, marginLeft: 6, fontWeight: 500 }}>({row.dateRange})</span>}
                                </td>
                                <td style={{ fontWeight: 600, padding: "12px 14px", fontSize: 13, color: BRAND.textDark }}>{row.csName}</td>
                                <td style={{ textAlign: "center", padding: "12px 14px", fontSize: 13, color: "#475569" }}>{row.leads}</td>
                                <td style={{ textAlign: "center", padding: "12px 14px", fontSize: 13, color: "#475569" }}>{row.closing}</td>
                                <td style={{ textAlign: "center", fontWeight: 700, padding: "12px 14px", fontSize: 13, color: statusConfig.color }}>
                                  {row.rate}%
                                </td>
                                <td style={{ textAlign: "right", padding: "12px 14px" }}>
                                  <span style={{
                                    display: "inline-block",
                                    padding: "2px 8px",
                                    borderRadius: 12,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    backgroundColor: statusConfig.bg,
                                    color: statusConfig.text,
                                    border: `1px solid ${statusConfig.color}20`
                                  }}>
                                    {statusConfig.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                {totalRows > 0 && (
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    total={totalRows}
                    limit={limit}
                    onChange={setPage}
                    onLimitChange={(lim) => {
                      setLimit(lim);
                      setPage(1);
                    }}
                  />
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
