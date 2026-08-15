"use client";

import { useState, useEffect } from "react";
import { BarChart2, Calendar, TrendingUp, ShoppingBag, Layers, Filter } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { toast } from "sonner";

export default function SiapSajiProductAnalyticsPage() {
  const [period, setPeriod] = useState("week");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/siap-saji/analytics/products?period=${period}`);
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
  }, [period]);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.02em" }}>
            Analisa Produk Siap Saji
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Lihat produk terlaris, varian porsi terpopuler, dan tren kuantitas penjualan
          </p>
        </div>

        {/* Period Selector (Mockup 07) */}
        <div style={{ background: "white", borderRadius: 10, padding: 4, border: "1px solid #d1d5db", display: "flex", gap: 4 }}>
          <button
            onClick={() => setPeriod("week")}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              background: period === "week" ? "#5005A6" : "transparent",
              color: period === "week" ? "white" : "#4b5563",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Minggu Ini
          </button>
          <button
            onClick={() => setPeriod("month")}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              background: period === "month" ? "#5005A6" : "transparent",
              color: period === "month" ? "white" : "#4b5563",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Bulan Ini
          </button>
        </div>
      </div>

      {/* Horizontal Bar Chart (Mockup 07: Top 10 Produk Terlaris) */}
      <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #e5e7eb", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>
            Top 10 Produk Terlaris
          </h3>
          <span style={{ fontSize: 13, color: "#6b7280" }}>Urutan berdasarkan kuantitas terjual (pcs)</span>
        </div>

        <div style={{ height: 400, width: "100%" }}>
          {loading ? (
            <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
              Memuat grafik produk terlaris...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={data?.top_10 || []}
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <XAxis type="number" stroke="#9ca3af" fontSize={12} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#374151" fontSize={12} width={160} tickLine={false} />
                <Tooltip
                  formatter={(value: any, name: any, item: any) => [
                    `${value} pcs (Rp ${Number(item.payload.total_omset).toLocaleString("id-ID")})`,
                    "Terjual",
                  ]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontWeight: 700 }}
                />
                <Bar dataKey="total_qty" fill="#5005A6" radius={[0, 8, 8, 0]}>
                  {(data?.top_10 || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? "#5005A6" : index < 3 ? "#b10fbd" : "#7c3aed"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 3 Summary Cards (Mockup 07) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Total Produk Terjual</span>
          <p style={{ fontSize: 26, fontWeight: 900, color: "#5005A6", margin: "6px 0 0" }}>
            {data?.summary?.total_pcs_terjual || 0} <span style={{ fontSize: 14, fontWeight: 600, color: "#6b7280" }}>pcs</span>
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
