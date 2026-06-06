"use client";
import { useEffect, useState, Fragment } from "react";
import { useRole } from "@/contexts/RoleContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, AlertTriangle, BarChart2, Target } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";

const C = { primary: "#5005A6", danger: "#E24B4A", warning: "#BA7517", secondary: "#378ADD", purple: "#7F77DD" };
const COLORS = [C.primary, C.danger, C.secondary, C.purple, C.warning];

export default function CSPerformancePage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const mtdStr = todayStr.slice(0, 8) + '01';
  
  const { activeRole } = useRole();
  const [data, setData] = useState<any>({ csData: [], chartData: [], dailyStats: {}, recentCustomers: [], recentOrders: [] });
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(mtdStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [activeTab, setActiveTab] = useState<'ringkasan' | 'evaluasi'>('ringkasan');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, activeTab]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/cs-performance?startDate=${startDate}&endDate=${endDate}`, { signal: controller.signal })
      .then(r => r.json())
      .then(setData)
      .catch(err => {
        if (err.name !== "AbortError") console.error(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [startDate, endDate]);

  const { csData = [], chartData = [], dailyStats = {}, recentCustomers = [], recentOrders = [] } = data;
  const best = csData.length ? csData.reduce((a: any, b: any) => a.monthRate > b.monthRate ? a : b) : null;
  const worst = csData.length ? csData.reduce((a: any, b: any) => a.monthRate < b.monthRate ? a : b) : null;
  const avgRate = csData.length ? (csData.reduce((s: number, c: any) => s + c.monthRate, 0) / csData.length).toFixed(1) : "0";
  const totalClosing = csData.reduce((s: number, c: any) => s + c.monthClosing, 0);

  // Helper formatting
  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div>
      <PageHeader title="Performa CS" subtitle="Closing rate & evaluasi per CS — dari database real"
        actions={
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Dari:</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 12px", fontSize: 13 }} />
            <span style={{ fontSize: 13, color: '#6b7280' }}>s.d.</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 12px", fontSize: 13 }} />
          </div>
        }
      />

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '0px' }}>
        <button 
          onClick={() => setActiveTab('ringkasan')}
          style={{ 
            padding: '10px 16px', 
            fontWeight: 600, 
            fontSize: 14,
            color: activeTab === 'ringkasan' ? C.primary : '#6b7280',
            borderBottom: activeTab === 'ringkasan' ? `2px solid ${C.primary}` : '2px solid transparent',
            background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer'
          }}>
          Dashboard Ringkasan
        </button>
        <button 
          onClick={() => setActiveTab('evaluasi')}
          style={{ 
            padding: '10px 16px', 
            fontWeight: 600, 
            fontSize: 14,
            color: activeTab === 'evaluasi' ? C.primary : '#6b7280',
            borderBottom: activeTab === 'evaluasi' ? `2px solid ${C.primary}` : '2px solid transparent',
            background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer'
          }}>
          Evaluasi Performa CS
        </button>
      </div>

      {/* --- TAB 1: DASHBOARD RINGKASAN --- */}
      {activeTab === 'ringkasan' && (
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Ringkasan Data ({formatDate(startDate)} - {formatDate(endDate)})</h2>
        
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12 }} />)}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 24 }}>
            <div style={{ backgroundColor: "#007BFF", color: "white", padding: 20, borderRadius: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
              <p style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>Total Leads</p>
              <h3 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>{dailyStats.leads || 0}</h3>
            </div>
            <div style={{ backgroundColor: "#28A745", color: "white", padding: 20, borderRadius: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
              <p style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>Total Orders baru</p>
              <h3 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>{dailyStats.orders || 0}</h3>
            </div>
            <div style={{ backgroundColor: "#17A2B8", color: "white", padding: 20, borderRadius: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
              <p style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>Closing Rate<br/><span style={{ fontSize: 12 }}>customer baru</span></p>
              <h3 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>{dailyStats.closingRate || 0}%</h3>
            </div>
            <div style={{ backgroundColor: "#FFC107", color: "white", padding: 20, borderRadius: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
              <p style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>Revenue<br/><span style={{ fontSize: 12 }}>(baru+repeat)</span></p>
              <h3 style={{ fontSize: 24, fontWeight: 700, margin: 0, marginTop: 8 }}>{formatRupiah(dailyStats.revenue || 0)}</h3>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
          {/* Recent Customers Table */}
          <div className="erp-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", backgroundColor: "#fff" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#007BFF", margin: 0 }}>Recent Customers</h3>
            </div>
            <div style={{ padding: "0 20px 20px" }}>
              <table style={{ marginTop: 16 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f1f5f9" }}>
                    <th style={{ width: 50, padding: "10px 16px" }}>#</th>
                    <th style={{ padding: "10px 16px" }}>Nama</th>
                    <th style={{ padding: "10px 16px" }}>No. WA</th>
                    <th style={{ padding: "10px 16px" }}>Total Order</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCustomers.length > 0 ? (
                    recentCustomers.map((c: any, i: number) => (
                      <tr key={c.id}>
                        <td style={{ padding: "10px 16px" }}>{i + 1}</td>
                        <td style={{ padding: "10px 16px", fontWeight: 500 }}>{c.name}</td>
                        <td style={{ padding: "10px 16px" }}>{c.phone || "-"}</td>
                        <td style={{ padding: "10px 16px" }}>{c.total_order}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "20px" }}>Belum ada data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Orders Table */}
          <div className="erp-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", backgroundColor: "#fff" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#007BFF", margin: 0 }}>Recent Orders</h3>
            </div>
            <div style={{ padding: "0 20px 20px" }}>
              <table style={{ marginTop: 16 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f1f5f9" }}>
                    <th style={{ width: 50, padding: "10px 16px" }}>#</th>
                    <th style={{ padding: "10px 16px" }}>Customer</th>
                    <th style={{ padding: "10px 16px" }}>Porsi</th>
                    <th style={{ padding: "10px 16px" }}>Harga</th>
                    <th style={{ padding: "10px 16px" }}>Tanggal kirim</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.length > 0 ? (
                    recentOrders.map((o: any, i: number) => (
                      <tr key={o.id}>
                        <td style={{ padding: "10px 16px" }}>{i + 1}</td>
                        <td style={{ padding: "10px 16px", fontWeight: 500 }}>{o.customer}</td>
                        <td style={{ padding: "10px 16px" }}>{o.porsi}</td>
                        <td style={{ padding: "10px 16px" }}>{formatRupiah(o.harga)}</td>
                        <td style={{ padding: "10px 16px" }}>{formatDate(o.delivery_date)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "20px" }}>Belum ada data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* --- TAB 2: REKAP KESELURUHAN (Eksisting) --- */}
      {activeTab === 'evaluasi' && (
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Evaluasi Performa CS</h2>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: activeRole === "cs_sales" ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
          {(activeRole === "cs_sales" ? [1,2] : [1,2,3,4]).map(i => <div key={i} className="skeleton" style={{ height: 82, borderRadius: 12 }} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 16 }}>
          {activeRole !== "cs_sales" && (
            <>
              <StatCard label="CS Terbaik" value={best?.name?.split(" ")[0] || "-"} sub={`CR: ${best?.monthRate || 0}%`} icon={TrendingUp} color={C.primary} />
              <StatCard label="Perlu Perhatian" value={worst?.name?.split(" ")[0] || "-"} sub={`CR: ${worst?.monthRate || 0}%`} icon={AlertTriangle} color={C.danger} />
            </>
          )}
          <StatCard label="Avg Closing Rate" value={avgRate + "%"} sub="Target: ≥30%" icon={BarChart2} color={C.secondary} />
          <StatCard label="Total Closing" value={totalClosing + " order"} icon={Target} color={C.purple} />
        </div>
      )}

      <div className="cs-grid-split">
        <div className="erp-card">
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Tren Closing Rate (%) per Pekan</p>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 60]} tickFormatter={v => v + "%"} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => Number(v).toFixed(1) + "%"} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {csData.map((cs: any, i: number) => (
                  <Line key={cs.id} type="monotone" dataKey={cs.name.split(" ")[0]}
                    stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 4 }}
                    strokeDasharray={i > 0 ? "4 2" : undefined} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : <p style={{ color: "#6b7280", fontSize: 12 }}>Tidak ada data</p>}
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Target minimum: 30% (garis batas)</p>
        </div>

        <div className="erp-card">
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Ringkasan per CS</p>
          <table>
            <thead><tr><th>CS</th><th>Lead</th><th>Closing</th><th>Rate</th><th>Status</th></tr></thead>
            <tbody>
              {csData.map((cs: any) => {
                const r = cs.monthRate;
                const perf = r >= 30 ? { label: "Bagus", color: "green" as const } : r >= 25 ? { label: "Standar", color: "yellow" as const } : { label: "Under Perform", color: "red" as const };
                return (
                  <tr key={cs.id}>
                    <td style={{ fontWeight: 500 }}>{cs.name}</td>
                    <td style={{ textAlign: "center" }}>{cs.monthLeads}</td>
                    <td style={{ textAlign: "center" }}>{cs.monthClosing}</td>
                    <td style={{ fontWeight: 700, color: r >= 30 ? C.primary : r >= 25 ? C.warning : C.danger }}>{r}%</td>
                    <td><Badge color={perf.color}>{perf.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {csData.filter((c: any) => c.monthRate < 25 && c.monthLeads > 0).map((cs: any) => (
            <div key={cs.id} className="alert-danger" style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#A32D2D" }}>⚠ Alert: {cs.name}</p>
              <p style={{ fontSize: 11, color: "#A32D2D", marginTop: 4 }}>
                CR {cs.monthRate}% — di bawah target 30%. Jadwalkan coaching 1-on-1.
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Detail */}
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
          <div className="erp-card" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Detail Per Pekan</p>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Periode / Pekan</th>
                      <th>Nama CS</th>
                      <th style={{ textAlign: "center" }}>Lead</th>
                      <th style={{ textAlign: "center" }}>Closing</th>
                      <th style={{ textAlign: "center" }}>Closing Rate</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "20px", color: "#6b7280" }}>
                          Tidak ada data pekan
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row, idx) => {
                        const perf = row.rate >= 30 ? { label: "Bagus", color: "green" as const } : row.rate >= 25 ? { label: "Standar", color: "yellow" as const } : { label: "Under Perform", color: "red" as const };
                        return (
                          <tr key={`${row.week}-${row.csName}-${idx}`}>
                            <td style={{ fontWeight: 500 }}>
                              <span style={{ fontWeight: 600 }}>{row.week}</span>
                              {row.dateRange && <span style={{ color: "#6b7280", fontSize: 11, marginLeft: 6 }}>({row.dateRange})</span>}
                            </td>
                            <td style={{ fontWeight: 500 }}>{row.csName}</td>
                            <td style={{ textAlign: "center" }}>{row.leads}</td>
                            <td style={{ textAlign: "center" }}>{row.closing}</td>
                            <td style={{ textAlign: "center", fontWeight: 700, color: row.rate >= 30 ? C.primary : row.rate >= 25 ? C.warning : C.danger }}>
                              {row.rate}%
                            </td>
                            <td>
                              <Badge color={perf.color}>{perf.label}</Badge>
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
