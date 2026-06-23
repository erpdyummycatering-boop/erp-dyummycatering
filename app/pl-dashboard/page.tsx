"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { TrendingUp, ShoppingCart, Settings, DollarSign, Target } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { fmt, statusBadgeColor } from "@/lib/utils";

const C = { primary: "#5005A6", coral: "#D85A30", warning: "#BA7517", secondary: "#378ADD", success: "#639922" };
const PIE_COLORS = [C.coral, C.warning, C.primary];

export default function PLDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/finance/pl-summary?days=7")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "#6b7280", fontSize: 15 }}>Memuat P&L data...</p>;

  const { plChart = [], summary = {}, leakage = [] } = data || {};
  const { totalRevenue = 0, totalBPP = 0, totalOverhead = 0, totalProfit = 0, avgMargin = 0 } = summary;

  const chartData = plChart.map((r: any) => ({
    ...r,
    revenue: Number(r.revenue), bpp: Number(r.bpp),
    overhead: Number(r.overhead), gross_profit: Number(r.gross_profit),
  }));

  const pieData = [
    { name: "BPP Aktual", value: totalBPP },
    { name: "Overhead", value: totalOverhead },
    { name: "Laba Kotor", value: totalProfit },
  ];

  return (
    <div>
      <PageHeader title="Daily Catering Profit Report (P&L)" subtitle="Owner — Monitoring laba rugi real-time" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
        <StatCard label="Total Revenue" value={fmt(totalRevenue)} sub="7 hari" icon={TrendingUp} color={C.primary} />
        <StatCard label="Total BPP Aktual" value={fmt(totalBPP)} sub={totalRevenue > 0 ? ((totalBPP / totalRevenue) * 100).toFixed(1) + "%" : "0%"} icon={ShoppingCart} color={C.coral} />
        <StatCard label="Total Overhead" value={fmt(totalOverhead)} sub={totalRevenue > 0 ? ((totalOverhead / totalRevenue) * 100).toFixed(1) + "%" : "0%"} icon={Settings} color={C.warning} />
        <StatCard label="Laba Kotor" value={fmt(totalProfit)} icon={DollarSign} color={C.secondary} />
        <StatCard label="Avg. Margin" value={avgMargin + "%"} sub="Target: ≥40%" icon={Target} color={C.success} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
        <div className="erp-card">
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Laporan P&L Harian (Area Chart)</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.primary} stopOpacity={0.1} />
                  <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.secondary} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={C.secondary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 15 }} />
              <YAxis tickFormatter={(v) => (v / 1_000_000).toFixed(1) + "Jt"} tick={{ fontSize: 15 }} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 15 }} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke={C.primary} fill="url(#revGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="bpp" name="BPP" stroke={C.coral} fill="none" strokeWidth={2} strokeDasharray="4 2" />
              <Area type="monotone" dataKey="gross_profit" name="Laba Kotor" stroke={C.secondary} fill="url(#profGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="erp-card">
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Komposisi Biaya</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                label={({ percent }: { percent?: number }) => `${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 15 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* P&L Table */}
      <div className="erp-card-flush" style={{ marginBottom: 16 }}>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Tanggal</th><th>Revenue</th><th>BPP Aktual</th><th>% BPP</th>
                <th>Overhead</th><th>Laba Kotor</th><th>Margin %</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d: any, i: number) => {
                const bppPct = d.revenue > 0 ? ((d.bpp / d.revenue) * 100).toFixed(1) : "0";
                const margin = Number(d.margin);
                const status = margin >= 45 ? { label: "Sehat", color: "green" as const } : margin >= 40 ? { label: "OK", color: "yellow" as const } : { label: "Perlu Perhatian", color: "red" as const };
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{d.date}</td>
                    <td style={{ fontWeight: 600, color: C.primary }}>{fmt(d.revenue)}</td>
                    <td>{fmt(d.bpp)}</td>
                    <td style={{ color: Number(bppPct) > 55 ? C.coral : Number(bppPct) > 50 ? C.warning : C.success, fontWeight: 700 }}>{bppPct}%</td>
                    <td>{fmt(d.overhead)}</td>
                    <td style={{ fontWeight: 700 }}>{fmt(d.gross_profit)}</td>
                    <td style={{ fontWeight: 700, color: margin >= 45 ? C.primary : margin >= 40 ? C.warning : C.coral }}>{margin}%</td>
                    <td><Badge color={status.color}>{status.label}</Badge></td>
                  </tr>
                );
              })}
              {chartData.length > 0 && (
                <tr style={{ background: "#f9fafb", borderTop: "2px solid #e5e7eb" }}>
                  <td style={{ fontWeight: 800 }}>TOTAL</td>
                  <td style={{ fontWeight: 800, color: C.primary }}>{fmt(totalRevenue)}</td>
                  <td style={{ fontWeight: 700 }}>{fmt(totalBPP)}</td>
                  <td style={{ fontWeight: 700 }}>{totalRevenue > 0 ? ((totalBPP / totalRevenue) * 100).toFixed(1) : 0}%</td>
                  <td style={{ fontWeight: 700 }}>{fmt(totalOverhead)}</td>
                  <td style={{ fontWeight: 800, color: C.secondary }}>{fmt(totalProfit)}</td>
                  <td style={{ fontWeight: 800, color: C.primary }}>{avgMargin}%</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leakage Log */}
      <div className="erp-card">
        <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Leakage Log — Catatan Kebocoran Anggaran</p>
        {leakage.length === 0 ? (
          <div className="alert-success"><p style={{ fontSize: 14, color: "#3b047a", fontWeight: 600 }}>Tidak ada kebocoran anggaran</p></div>
        ) : leakage.map((po: any) => (
          <div key={po.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: "0.5px solid #f3f4f6" }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FCEBEB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <DollarSign size={16} color={C.coral} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <p style={{ fontSize: 14, fontWeight: 700 }}>PO #{po.id} — Est: {fmt(po.estimated_cost)} → Aktual: {fmt(po.actual_cost)}</p>
                <Badge color="red">+{fmt(po.variance)}</Badge>
              </div>
              <p style={{ fontSize: 15, color: "#6b7280" }}>{po.variance_notes || "Tidak ada keterangan"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
