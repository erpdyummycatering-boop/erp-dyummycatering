"use client";

import { useState, useEffect } from "react";
import { BarChart2, Calendar, TrendingUp, ShoppingBag, Layers, Filter } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from "recharts";
import { toast } from "sonner";

export default function SiapSajiProductAnalyticsPage() {
  const [period, setPeriod] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [metric, setMetric] = useState<"qty" | "omset">("qty");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.append("period", period);
      if (dateFrom) q.append("date_from", dateFrom);
      if (dateTo) q.append("date_to", dateTo);

      const res = await fetch(`/api/siap-saji/analytics/products?${q.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat analitik produk");
      setData(await res.json());
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat analitik produk");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period, dateFrom, dateTo]);

  const chartData = metric === "qty" ? (data?.top_10_qty || data?.top_10 || []) : (data?.top_10_omset || []);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.02em" }}>
            Analisa Produk Siap Saji
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Lihat produk terlaris berdasarkan kuantitas (pcs) dan total omset (Rp)
          </p>
        </div>

        {/* Period & Custom Date Range Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Preset Buttons */}
          <div style={{ background: "white", borderRadius: 10, padding: 4, border: "1px solid #d1d5db", display: "flex", gap: 4 }}>
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setPeriod("week");
              }}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                background: period === "week" && !dateFrom && !dateTo ? "#5005A6" : "transparent",
                color: period === "week" && !dateFrom && !dateTo ? "white" : "#4b5563",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Minggu Ini
            </button>
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setPeriod("month");
              }}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                background: period === "month" && !dateFrom && !dateTo ? "#5005A6" : "transparent",
                color: period === "month" && !dateFrom && !dateTo ? "white" : "#4b5563",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setPeriod("all");
              }}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                background: period === "all" && !dateFrom && !dateTo ? "#5005A6" : "transparent",
                color: period === "all" && !dateFrom && !dateTo ? "white" : "#4b5563",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Semua Periode
            </button>
          </div>

          {/* Date Picker Start & End */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "white", padding: "6px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}>
            <Calendar size={15} color="#6b7280" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPeriod("custom");
              }}
              title="Tanggal Mulai"
              style={{ border: "none", outline: "none", fontSize: 13, color: "#374151" }}
            />
            <span style={{ color: "#9ca3af", fontSize: 12 }}>s/d</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPeriod("custom");
              }}
              title="Tanggal Selesai"
              style={{ border: "none", outline: "none", fontSize: 13, color: "#374151" }}
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setPeriod("all");
                }}
                style={{ background: "#f3f4f6", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 11, cursor: "pointer", color: "#4b5563", fontWeight: 700 }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Horizontal Bar Chart (Top 10 Produk) */}
      <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #e5e7eb", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
              Top 10 Produk {metric === "qty" ? "Terlaris (Kuantitas Pcs)" : "Penghasil Omset Tertinggi (Rp)"}
            </h3>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0 0" }}>
              Angka langsung terlihat pada grafik tanpa perlu meng-hover bar
            </p>
          </div>

          {/* Metric Switcher: Top Qty vs Top Omset */}
          <div style={{ background: "#f3f4f6", borderRadius: 10, padding: 4, display: "flex", gap: 4 }}>
            <button
              onClick={() => setMetric("qty")}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: metric === "qty" ? "#5005A6" : "transparent",
                color: metric === "qty" ? "white" : "#4b5563",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s ease",
              }}
            >
              <ShoppingBag size={15} /> Top Kuantitas (pcs)
            </button>
            <button
              onClick={() => setMetric("omset")}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: metric === "omset" ? "#15803d" : "transparent",
                color: metric === "omset" ? "white" : "#4b5563",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s ease",
              }}
            >
              <TrendingUp size={15} /> Top Omset (Rp)
            </button>
          </div>
        </div>

        <div style={{ height: 440, width: "100%" }}>
          {loading ? (
            <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
              Memuat grafik produk...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 10, right: 150, left: 20, bottom: 10 }}
              >
                <XAxis type="number" stroke="#9ca3af" fontSize={12} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#374151" fontSize={12} width={180} tickLine={false} />
                <Tooltip
                  formatter={(value: any, name: any, item: any) => [
                    `${item.payload.total_qty} pcs — Rp ${Number(item.payload.total_omset).toLocaleString("id-ID")}`,
                    "Penjualan",
                  ]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontWeight: 700 }}
                />
                <Bar
                  dataKey={metric === "qty" ? "total_qty" : "total_omset"}
                  fill={metric === "qty" ? "#5005A6" : "#15803d"}
                  radius={[0, 8, 8, 0]}
                  barSize={24}
                >
                  <LabelList
                    dataKey={metric === "qty" ? "total_qty" : "total_omset"}
                    position="right"
                    formatter={(val: any) =>
                      metric === "qty"
                        ? `${Number(val).toLocaleString("id-ID")} pcs`
                        : `Rp ${Number(val).toLocaleString("id-ID")}`
                    }
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      fill: metric === "qty" ? "#5005A6" : "#15803d",
                    }}
                  />
                  {chartData.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        metric === "qty"
                          ? index === 0
                            ? "#5005A6"
                            : index < 3
                            ? "#b10fbd"
                            : "#7c3aed"
                          : index === 0
                          ? "#15803d"
                          : index < 3
                          ? "#16a34a"
                          : "#22c55e"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Total Produk Terjual</span>
          <p style={{ fontSize: 26, fontWeight: 900, color: "#5005A6", margin: "6px 0 0" }}>
            {Number(data?.summary?.total_pcs_terjual || 0).toLocaleString("id-ID")}{" "}
            <span style={{ fontSize: 14, fontWeight: 600, color: "#6b7280" }}>pcs</span>
          </p>
        </div>

        <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Total Penjualan</span>
          <p style={{ fontSize: 26, fontWeight: 900, color: "#15803d", margin: "6px 0 0" }}>
            Rp {Number(data?.summary?.total_penjualan || 0).toLocaleString("id-ID")}
          </p>
        </div>

        <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Rata-rata Harga Produk</span>
          <p style={{ fontSize: 26, fontWeight: 900, color: "#b10fbd", margin: "6px 0 0" }}>
            Rp {Number(data?.summary?.rata_rata_harga || 0).toLocaleString("id-ID")}
          </p>
        </div>
      </div>
    </div>
  );
}
