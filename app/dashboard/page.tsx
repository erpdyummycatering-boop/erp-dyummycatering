"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, DollarSign, Inbox, ShoppingCart,
  AlertTriangle, CheckCircle, ShieldAlert, Package, Users,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { fmt, fmtShort } from "@/lib/utils";

const C = {
  primary: "#5005A6",
  secondary: "#378ADD",
  coral: "#D85A30",
  warning: "#BA7517",
  danger: "#E24B4A",
  purple: "#7F77DD",
};

// Fallback chart data saat DB kosong
const DEMO_CHART = [
  { date: "18 Mei", revenue: 7500000, bpp: 3200000, overhead: 500000, grossProfit: 3800000, margin: 50.7 },
  { date: "19 Mei", revenue: 12000000, bpp: 5500000, overhead: 800000, grossProfit: 5700000, margin: 47.5 },
  { date: "20 Mei", revenue: 5000000, bpp: 2400000, overhead: 400000, grossProfit: 2200000, margin: 44.0 },
  { date: "21 Mei", revenue: 9800000, bpp: 4100000, overhead: 600000, grossProfit: 5100000, margin: 52.0 },
  { date: "22 Mei", revenue: 15000000, bpp: 6800000, overhead: 900000, grossProfit: 7300000, margin: 48.7 },
  { date: "23 Mei", revenue: 8500000, bpp: 3900000, overhead: 550000, grossProfit: 4050000, margin: 47.6 },
  { date: "24 Mei", revenue: 11200000, bpp: 5200000, overhead: 700000, grossProfit: 5300000, margin: 47.3 },
];

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard/summary", { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  const activeOrders = data?.activeOrders ?? 0;
  const totalRevenue = data?.totalRevenue ?? 0;
  const totalLeadsToday = data?.totalLeadsToday ?? 0;
  const closingToday = data?.closingToday ?? 0;
  const followUp = data?.followUp ?? 0;
  const scheduleAlerts = data?.scheduleAlerts ?? [];
  const poAlerts = data?.poAlerts ?? [];
  const totalContacts = data?.totalContacts ?? 0;
  const customerCasteCount = data?.customerCasteCount ?? 0;
  const leadCasteCount = data?.leadCasteCount ?? 0;

  // Gunakan data DB jika ada, fallback ke demo
  const rawChart = data?.plChart ?? [];
  const chartData = rawChart.length > 0
    ? rawChart.map((r: any) => ({
        date: r.date,
        revenue: Number(r.revenue),
        bpp: Number(r.bpp),
        overhead: Number(r.overhead),
        grossProfit: Number(r.gross_profit ?? (Number(r.revenue) - Number(r.bpp) - Number(r.overhead))),
        margin: Number(r.margin ?? 0),
      }))
    : DEMO_CHART;

  const isDemo = rawChart.length === 0 && !loading;

  if (loading) return <LoadingSkeleton />;

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", margin: 0, letterSpacing: "-0.02em" }}>
          Dashboard Utama
        </h1>
        <p style={{ fontSize: 15, color: "#6b7280", marginTop: 3 }}>
          {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          {isDemo && (
            <span style={{ marginLeft: 10, background: "#FAEEDA", color: "#854F0B", padding: "2px 8px", borderRadius: 10, fontSize: 15, fontWeight: 600 }}>
              Demo Data — Tambahkan data real untuk update chart
            </span>
          )}
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
        marginBottom: 20,
      }}>
        <StatCard
          label="Revenue 30 Hari"
          value={totalRevenue > 0 ? fmtShort(totalRevenue) : "Rp 0"}
          sub="dari orders terkirim"
          icon={TrendingUp}
          color={C.primary}
        />
        <StatCard
          label="Total Kontak"
          value={totalContacts}
          sub={`${customerCasteCount} Customer, ${leadCasteCount} Lead`}
          icon={Users}
          color="#378ADD"
        />
        <StatCard
          label="Lead Masuk Hari Ini"
          value={totalLeadsToday}
          sub={`${closingToday} closing hari ini`}
          icon={Inbox}
          color={C.purple}
        />
        <StatCard
          label="Perlu Follow Up"
          value={followUp}
          sub="Status Follow Up"
          icon={ShoppingCart}
          color={C.warning}
        />
        <StatCard
          label="Order Aktif"
          value={activeOrders}
          sub="Belum selesai"
          icon={Package}
          color={C.secondary}
        />
      </div>

      {/* Charts Row */}
      <div className="dashboard-grid-charts">
        {/* Bar Chart — Revenue vs BPP */}
        <div className="erp-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>Revenue vs BPP vs Laba Kotor (7 Hari)</p>
            {isDemo && <span style={{ fontSize: 14, color: "#6b7280" }}>*contoh data</span>}
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={chartData} barCategoryGap="30%" barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 15, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => (v / 1_000_000).toFixed(1) + "Jt"}
                tick={{ fontSize: 15, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                formatter={(v: any, name: any) => [fmt(Number(v)), String(name ?? "")]}
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 15, paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
              <Bar dataKey="revenue" name="Revenue" fill={C.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="bpp" name="BPP Aktual" fill={C.coral} radius={[4, 4, 0, 0]} />
              <Bar dataKey="grossProfit" name="Laba Kotor" fill={C.secondary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Line Chart — Margin */}
        <div className="erp-card">
          <p style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 14 }}>Margin Laba (%) Harian</p>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, background: C.primary + "15", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
              <p style={{ fontSize: 14, color: C.primary, fontWeight: 600, marginBottom: 2 }}>RATA-RATA</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>
                {(chartData.reduce((s: number, d: any) => s + d.margin, 0) / chartData.length).toFixed(1)}%
              </p>
            </div>
            <div style={{ flex: 1, background: "#f9fafb", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "#6b7280", fontWeight: 600, marginBottom: 2 }}>TARGET</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: "#6b7280" }}>40%</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={155}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="marginGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.primary} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 14, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => v + "%"}
                tick={{ fontSize: 14, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip formatter={(v: any) => [Number(v).toFixed(1) + "%", "Margin"]} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }} />
              {/* Target line */}
              <Area type="monotone" dataKey={() => 40} stroke="#e5e7eb" fill="none" strokeDasharray="4 3" strokeWidth={1} legendType="none" />
              <Area
                type="monotone"
                dataKey="margin"
                name="Margin %"
                stroke={C.primary}
                fill="url(#marginGrad)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: C.primary, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Kasta Kontak Pie Chart Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }} className="grid-col-1-mobile">
        {/* Kasta Kontak Pie Chart */}
        <div className="erp-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 24px" }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", width: "100%", textAlign: "left", marginBottom: 14 }}>
            Kasta Kontak (Lead vs Customer)
          </p>
          {totalContacts > 0 ? (
            <div style={{ width: "100%", height: 160, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Customer (Pernah Order)", value: customerCasteCount },
                      { name: "Lead (Belum Order)", value: leadCasteCount },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    <Cell fill="#639922" />
                    <Cell fill="#BA7517" />
                  </Pie>
                  <Tooltip formatter={(v: any) => [v + " Kontak", "Total"]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>{totalContacts}</p>
                <p style={{ fontSize: 9, color: "#6b7280", margin: 0, textTransform: "uppercase", fontWeight: 600 }}>Total</p>
              </div>
            </div>
          ) : (
            <p style={{ color: "#6b7280", fontSize: 14, padding: 24 }}>Belum ada data kontak</p>
          )}
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 15, width: "100%", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#639922" }} />
              <span style={{ color: "#374151", fontWeight: 600 }}>Customer ({customerCasteCount})</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#BA7517" }} />
              <span style={{ color: "#374151", fontWeight: 600 }}>Lead ({leadCasteCount})</span>
            </div>
          </div>
        </div>

        {/* Quick Tips or Aktivitas Prospek Summary */}
        <div className="erp-card" style={{ padding: "16px 24px" }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 14 }}>Tips Konversi & CRM</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="grid-col-1-mobile">
            <div style={{ background: "#f9fafb", padding: 12, borderRadius: 8, borderLeft: "4px solid #639922" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>Konversi Lead ke Customer</p>
              <p style={{ fontSize: 15, color: "#6b7280", lineHeight: "1.4" }}>
                Tawarkan promo khusus, bundling menu, atau tester gratis untuk mengubah Lead yang belum pernah melakukan transaksi menjadi Customer aktif.
              </p>
            </div>
            <div style={{ background: "#f9fafb", padding: 12, borderRadius: 8, borderLeft: "4px solid #BA7517" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>Follow Up Berkala</p>
              <p style={{ fontSize: 15, color: "#6b7280", lineHeight: "1.4" }}>
                Jaga hubungan baik dengan Lead dengan menanyakan rencana event mereka atau memberikan penawaran menu catering harian/kantor secara berkala.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Row + Alerts */}
      <div className="dashboard-grid-alerts">
        {/* Summary Stats */}
        <div className="erp-card">
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Ringkasan 7 Hari</p>
          {[
            { label: "Total Revenue", value: fmtShort(chartData.reduce((s: number, d: any) => s + d.revenue, 0)), color: C.primary },
            { label: "Total BPP Aktual", value: fmtShort(chartData.reduce((s: number, d: any) => s + d.bpp, 0)), color: C.coral },
            { label: "Total Overhead", value: fmtShort(chartData.reduce((s: number, d: any) => s + d.overhead, 0)), color: C.warning },
            { label: "Laba Kotor", value: fmtShort(chartData.reduce((s: number, d: any) => s + d.grossProfit, 0)), color: C.secondary },
          ].map((item) => (
            <div key={item.label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "9px 0", borderBottom: "0.5px solid #f3f4f6",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                <p style={{ fontSize: 15, color: "#374151" }}>{item.label}</p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* System Alerts */}
        <div className="erp-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <ShieldAlert size={16} color={scheduleAlerts.length + poAlerts.length > 0 ? C.danger : C.primary} />
            <p style={{ fontSize: 15, fontWeight: 700 }}>Peringatan Sistem</p>
            {scheduleAlerts.length + poAlerts.length > 0 && (
              <span style={{ background: C.danger, color: "white", padding: "1px 7px", borderRadius: 10, fontSize: 15, fontWeight: 700 }}>
                {scheduleAlerts.length + poAlerts.length}
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
            {scheduleAlerts.length === 0 && poAlerts.length === 0 ? (
              <div className="alert-success">
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <CheckCircle size={15} color="#3b047a" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontWeight: 700, color: "#3b047a", fontSize: 14 }}>Semua sistem normal</p>
                    <p style={{ fontSize: 15, color: "#3b047a", marginTop: 2 }}>
                      Tidak ada jadwal overbudget atau variance belanja.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {scheduleAlerts.map((a: any) => (
              <div key={a.id} className="alert-danger">
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <AlertTriangle size={14} color="#A32D2D" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontWeight: 700, color: "#A32D2D", fontSize: 14 }}>
                      {a.status} — Jadwal {a.target_date}
                    </p>
                    <p style={{ fontSize: 15, color: "#A32D2D", marginTop: 2 }}>
                      HPP {fmt(a.total_estimated_hpp)} melebihi budget {fmt(a.budget_limit)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {poAlerts.map((a: any) => (
              <div key={a.id} className="alert-warning">
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <DollarSign size={14} color="#854F0B" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontWeight: 700, color: "#854F0B", fontSize: 14 }}>
                      Overbudget — PO #{a.id}
                    </p>
                    <p style={{ fontSize: 15, color: "#854F0B", marginTop: 2 }}>
                      {a.variance_notes || "Aktual melebihi estimasi PR Chef"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div className="skeleton" style={{ height: 52, marginBottom: 20, borderRadius: 10 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 82, borderRadius: 12 }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
        <div className="skeleton" style={{ height: 280, borderRadius: 12 }} />
        <div className="skeleton" style={{ height: 280, borderRadius: 12 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
        <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
      </div>
    </div>
  );
}
