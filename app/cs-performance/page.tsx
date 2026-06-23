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

const getRangeDates = (type: string) => {
  const today = new Date();
  const tzOffset = today.getTimezoneOffset() * 60000;
  const getLocalDateStr = (d: Date) => new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);

  const todayStr = getLocalDateStr(today);

  switch (type) {
    case "today":
      return { start: todayStr, end: todayStr };
    case "yesterday": {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      return { start: getLocalDateStr(yesterday), end: getLocalDateStr(yesterday) };
    }
    case "7days": {
      const past7 = new Date();
      past7.setDate(today.getDate() - 6);
      return { start: getLocalDateStr(past7), end: todayStr };
    }
    case "14days": {
      const past14 = new Date();
      past14.setDate(today.getDate() - 13);
      return { start: getLocalDateStr(past14), end: todayStr };
    }
    case "month": {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: getLocalDateStr(firstDay), end: todayStr };
    }
    case "last_month": {
      const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: getLocalDateStr(firstDayLastMonth), end: getLocalDateStr(lastDayLastMonth) };
    }
    default:
      return null;
  }
};

export default function CSPerformancePage() {
  const { activeRole } = useRole();

  const todayStr = new Date().toISOString().slice(0, 10);
  const mtdStr = todayStr.slice(0, 8) + '01'; // YYYY-MM-01

  // Filter States
  const [periodType, setPeriodType] = useState<string>('month');
  const [startDate, setStartDate] = useState(mtdStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedCsId, setSelectedCsId] = useState<string>("all");

  // Data States
  const [data, setData] = useState<any>({
    csData: [],
    chartData: [],
    dailyStats: {},
    transactions: [],
    activeCsList: [],
    selectedCsId: "all",
    selectedCsName: "Semua CS",
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Sync date ranges when periodType changes
  useEffect(() => {
    const range = getRangeDates(periodType);
    if (range) {
      setStartDate(range.start);
      setEndDate(range.end);
    }
  }, [periodType]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, selectedCsId]);

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
            {activeRole !== "cs_sales" && activeCsList.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>Pilih CS:</span>
                <select 
                  value={selectedCsId} 
                  onChange={e => setSelectedCsId(e.target.value)}
                  style={{ 
                    border: "1.5px solid #cbd5e1", 
                    borderRadius: 8, 
                    padding: "6px 12px", 
                    fontSize: 15, 
                    fontWeight: 500,
                    outline: "none", 
                    backgroundColor: "white", 
                    color: BRAND.textDark,
                    cursor: "pointer"
                  }}
                >
                  <option value="all">Semua CS</option>
                  {activeCsList.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Period Filter Selector Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>Periode:</span>
              <select 
                value={periodType} 
                onChange={e => setPeriodType(e.target.value)}
                style={{ 
                  border: "1.5px solid #cbd5e1", 
                  borderRadius: 8, 
                  padding: "6px 12px", 
                  fontSize: 15, 
                  fontWeight: 500,
                  outline: "none", 
                  backgroundColor: "white", 
                  color: BRAND.textDark,
                  cursor: "pointer"
                }}
              >
                <option value="today">Hari Ini</option>
                <option value="yesterday">Kemarin</option>
                <option value="7days">7 Hari Terakhir</option>
                <option value="14days">14 Hari Terakhir</option>
                <option value="month">Bulan Ini</option>
                <option value="last_month">Bulan Lalu</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* Custom Date Picker Inputs */}
            {periodType === 'custom' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  style={{ border: "1.5px solid #cbd5e1", borderRadius: 8, padding: "5px 10px", fontSize: 14, fontWeight: 500 }} />
                <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>s.d.</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  style={{ border: "1.5px solid #cbd5e1", borderRadius: 8, padding: "5px 10px", fontSize: 14, fontWeight: 500 }} />
              </div>
            )}
          </div>
        }
      />

      {/* --- REKAP KESELURUHAN (Evaluasi Performa CS) --- */}
      <div style={{ animation: "fadeIn 0.3s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 24 }}>
            {/* Total CS Card */}
            <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 15, color: "#64748b", fontWeight: 700, margin: 0 }}>TOTAL CS</p>
                <h4 style={{ fontSize: 22, fontWeight: 700, color: BRAND.primary, margin: "4px 0" }}>{csData.length} orang</h4>
                <p style={{ fontSize: 15, color: "#64748b", margin: 0, fontWeight: 500 }}>CS Aktif</p>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", color: "#166534" }}>
                <Users size={18} />
              </div>
            </div>

            {/* Total Leads Card */}
            <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 15, color: "#64748b", fontWeight: 700, margin: 0 }}>TOTAL LEADS</p>
                <h4 style={{ fontSize: 22, fontWeight: 700, color: "#378ADD", margin: "4px 0" }}>
                  {csData.reduce((sum: number, c: any) => sum + c.monthLeads, 0)} lead
                </h4>
                <p style={{ fontSize: 15, color: "#64748b", margin: 0, fontWeight: 500 }}>Total lead masuk</p>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#378ADD" }}>
                <TrendingUp size={18} />
              </div>
            </div>

            {/* Avg Closing Rate Card */}
            <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 15, color: "#64748b", fontWeight: 700, margin: 0 }}>AVG CLOSING RATE</p>
                <h4 style={{ fontSize: 22, fontWeight: 700, color: BRAND.textDark, margin: "4px 0" }}>
                  {(() => {
                    const totalLeads = csData.reduce((sum: number, c: any) => sum + c.monthLeads, 0);
                    const totalClosing = csData.reduce((sum: number, c: any) => sum + c.monthClosing, 0);
                    return totalLeads > 0 ? ((totalClosing / totalLeads) * 100).toFixed(1) : "0";
                  })()}%
                </h4>
                <p style={{ fontSize: 15, color: "#64748b", margin: 0, fontWeight: 500 }}>Target: ≥30%</p>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#FFF8F1", display: "flex", alignItems: "center", justifyContent: "center", color: "#FD7E14" }}>
                <BarChart2 size={18} />
              </div>
            </div>

            {/* Total New Orders Card */}
            <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 15, color: "#64748b", fontWeight: 700, margin: 0 }}>TOTAL NEW ORDERS</p>
                <h4 style={{ fontSize: 22, fontWeight: 700, color: BRAND.textDark, margin: "4px 0" }}>
                  {csData.reduce((sum: number, c: any) => sum + c.monthClosing, 0)} order
                </h4>
                <p style={{ fontSize: 15, color: "#64748b", margin: 0, fontWeight: 500 }}>Berdasarkan lead closing</p>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", color: BRAND.primary }}>
                <Target size={18} />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 24, marginBottom: 24 }}>
            {/* Chart Card */}
            <div className="erp-card" style={{ border: "1px solid #e2e8f0", borderRadius: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: BRAND.primary, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                📈 Tren Closing Rate (%) per Pekan
              </p>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 15, fontWeight: 600 }} />
                    <YAxis domain={[0, 60]} tickFormatter={v => v + "%"} tick={{ fontSize: 15, fontWeight: 600 }} />
                    <Tooltip formatter={(v: any) => Number(v).toFixed(1) + "%"} />
                    <Legend wrapperStyle={{ fontSize: 15, fontWeight: 600 }} />
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
              ) : <p style={{ color: "#64748b", fontSize: 14 }}>Tidak ada data chart</p>}
              <p style={{ fontSize: 15, color: "#64748b", marginTop: 8, fontWeight: 500 }}>Target standard minimum closing rate: 30%</p>
            </div>

            {/* Rincian Capaian Omset Card */}
            <div className="erp-card" style={{ border: "1px solid #e2e8f0", borderRadius: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: BRAND.primary, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                📊 Rincian Capaian Omset per CS
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 14, fontWeight: 700, color: "#475569" }}>Nama CS</th>
                      <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 14, fontWeight: 700, color: "#475569" }}>Omset Baru</th>
                      <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 14, fontWeight: 700, color: "#475569" }}>Omset Repeat</th>
                      <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 14, fontWeight: 700, color: "#475569" }}>Total Omset</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...csData].sort((a: any, b: any) => b.monthOmzet - a.monthOmzet).map((cs: any) => (
                      <tr key={cs.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ fontWeight: 600, padding: "12px 14px", fontSize: 15, color: BRAND.textDark }}>{cs.name}</td>
                        <td style={{ textAlign: "right", padding: "12px 14px", fontSize: 14, color: "#166534", fontWeight: 500 }}>
                          {formatRupiah(cs.monthNewOrdersValue || 0)}
                        </td>
                        <td style={{ textAlign: "right", padding: "12px 14px", fontSize: 14, color: "#7F56D9", fontWeight: 500 }}>
                          {formatRupiah(cs.monthRepeatOrdersValue || 0)}
                          <div style={{ fontSize: 14, color: "#94a3b8" }}>({cs.monthRepeatOrders || 0} order)</div>
                        </td>
                        <td style={{ textAlign: "right", padding: "12px 14px", fontSize: 15, fontWeight: 700, color: BRAND.primary }}>
                          {formatRupiah(cs.monthOmzet || 0)}
                        </td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr style={{ backgroundColor: "#f8fafc", fontWeight: 700 }}>
                      <td style={{ padding: "12px 14px", fontSize: 14, color: "#475569" }}>TOTAL</td>
                      <td style={{ textAlign: "right", padding: "12px 14px", fontSize: 14, color: "#166534" }}>
                        {formatRupiah(csData.reduce((s: number, c: any) => s + (c.monthNewOrdersValue || 0), 0))}
                      </td>
                      <td style={{ textAlign: "right", padding: "12px 14px", fontSize: 14, color: "#7F56D9" }}>
                        {formatRupiah(csData.reduce((s: number, c: any) => s + (c.monthRepeatOrdersValue || 0), 0))}
                        <div style={{ fontSize: 14, color: "#94a3b8", fontWeight: 500 }}>
                          ({csData.reduce((s: number, c: any) => s + (c.monthRepeatOrders || 0), 0)} order)
                        </div>
                      </td>
                      <td style={{ textAlign: "right", padding: "12px 14px", fontSize: 15, color: BRAND.primary }}>
                        {formatRupiah(csData.reduce((s: number, c: any) => s + (c.monthOmzet || 0), 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 2: Ringkasan & Rangking Omset CS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 24, marginBottom: 24 }}>
            {/* Rangking Omset CS Card */}
            <div className="erp-card" style={{ border: "1px solid #e2e8f0", borderRadius: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: BRAND.primary, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                🏆 Rangking Omset CS
              </p>
              {(() => {
                const sortedByOmzet = [...csData].sort((a: any, b: any) => b.monthOmzet - a.monthOmzet);
                const maxOmzet = sortedByOmzet[0]?.monthOmzet || 1; // avoid division by zero
                
                if (sortedByOmzet.length === 0) {
                  return <p style={{ color: "#64748b", fontSize: 14 }}>Tidak ada data omset</p>;
                }
                
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {sortedByOmzet.map((cs: any, index: number) => {
                      const percentage = maxOmzet > 0 ? (cs.monthOmzet / maxOmzet) * 100 : 0;
                      let rankBadge = `${index + 1}`;
                      let rankStyle: React.CSSProperties = {
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        backgroundColor: "#f1f5f9",
                        color: "#475569",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 700
                      };
                      
                      if (index === 0) {
                        rankBadge = "🥇";
                        rankStyle = { fontSize: 18, marginRight: 4 };
                      } else if (index === 1) {
                        rankBadge = "🥈";
                        rankStyle = { fontSize: 18, marginRight: 4 };
                      } else if (index === 2) {
                        rankBadge = "🥉";
                        rankStyle = { fontSize: 18, marginRight: 4 };
                      }

                      return (
                        <div key={cs.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={rankStyle}>{index > 2 ? rankBadge : rankBadge}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, fontSize: 15, color: BRAND.textDark }}>{cs.name}</span>
                              <span style={{ fontWeight: 700, fontSize: 15, color: BRAND.primary }}>{formatRupiah(cs.monthOmzet)}</span>
                            </div>
                            <div style={{ width: "100%", height: 6, backgroundColor: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${percentage}%`, height: "100%", backgroundColor: index === 0 ? BRAND.primary : index === 1 ? "#378ADD" : index === 2 ? BRAND.pink : "#94a3b8", borderRadius: 3 }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* List CS Table Card */}
            <div className="erp-card" style={{ border: "1px solid #e2e8f0", borderRadius: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: BRAND.primary, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                👥 Ringkasan Closing Rate per CS
              </p>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 14, fontWeight: 700, color: "#475569" }}>Nama CS</th>
                    <th style={{ textAlign: "center", padding: "10px 14px", fontSize: 14, fontWeight: 700, color: "#475569" }}>Lead</th>
                    <th style={{ textAlign: "center", padding: "10px 14px", fontSize: 14, fontWeight: 700, color: "#475569" }}>Closing</th>
                    <th style={{ textAlign: "center", padding: "10px 14px", fontSize: 14, fontWeight: 700, color: "#475569" }}>Rate</th>
                    <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 14, fontWeight: 700, color: "#475569" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...csData].sort((a: any, b: any) => b.monthRate - a.monthRate).map((cs: any) => {
                    const r = cs.monthRate;
                    const statusConfig = getPerfStatus(r);
                    return (
                      <tr key={cs.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ fontWeight: 600, padding: "12px 14px", fontSize: 15, color: BRAND.textDark }}>{cs.name}</td>
                        <td style={{ textAlign: "center", padding: "12px 14px", fontSize: 15, color: "#475569" }}>{cs.monthLeads}</td>
                        <td style={{ textAlign: "center", padding: "12px 14px", fontSize: 15, color: "#475569" }}>{cs.monthClosing}</td>
                        <td style={{ fontWeight: 700, textAlign: "center", padding: "12px 14px", fontSize: 15, color: statusConfig.color }}>
                          {r}%
                        </td>
                        <td style={{ textAlign: "right", padding: "12px 14px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 14,
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
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#9B1C1C", margin: 0 }}>⚠ Peringatan Kinerja: {cs.name}</p>
                  <p style={{ fontSize: 15, color: "#7F1D1D", marginTop: 4, margin: 0, fontWeight: 500 }}>
                    Closing Rate {cs.monthRate}% berada di bawah batas minimum 25%. Segera jadwalkan monitoring bimbingan.
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Detail Table has been removed */}
        </div>
    </div>
  );
}
