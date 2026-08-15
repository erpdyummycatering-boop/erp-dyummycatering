"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LayoutDashboard, ShoppingCart, TrendingUp, Users, ShoppingBag, Plus, Calendar, Layers } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from "recharts";
import { toast } from "sonner";

export default function SiapSajiDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/siap-saji/dashboard");
      if (!res.ok) throw new Error("Gagal memuat data dashboard");
      setData(await res.json());
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.02em" }}>
              Dashboard Utama Siap Saji
            </h1>
            <span style={{ padding: "3px 10px", background: "#f0fdf4", color: "#639922", border: "1px solid #bbf7d0", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
              Live System
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Ringkasan penjualan, tren 7 hari terakhir, dan performa produk/customer hari ini
          </p>
        </div>

        <Link
          href="/siap-saji/orders"
          style={{
            background: "linear-gradient(135deg, #5005A6 0%, #B10FBD 100%)",
            color: "white",
            textDecoration: "none",
            borderRadius: 10,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 12px rgba(177, 15, 189, 0.25)",
          }}
        >
          <Plus size={18} /> + Buat Penjualan Baru
        </Link>
      </div>

      {/* 4 Summary Stat Cards (Mockup 01) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Total Penjualan Hari Ini</span>
          <p style={{ fontSize: 26, fontWeight: 900, color: "#5005A6", margin: "6px 0 0", letterSpacing: "-0.02em" }}>
            Rp {Number(data?.today?.total_omset || 0).toLocaleString("id-ID")}
          </p>
        </div>

        <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Total Order Hari Ini</span>
          <p style={{ fontSize: 26, fontWeight: 900, color: "#111827", margin: "6px 0 0", letterSpacing: "-0.02em" }}>
            {data?.today?.total_orders || 0}
          </p>
        </div>

        <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Channel Terbanyak</span>
          <p style={{ fontSize: 22, fontWeight: 900, color: "#b10fbd", margin: "6px 0 0" }}>
            {data?.today?.top_channel || "Gojek Offline"}
          </p>
        </div>

        <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Produk Terjual (Pcs)</span>
          <p style={{ fontSize: 26, fontWeight: 900, color: "#15803d", margin: "6px 0 0", letterSpacing: "-0.02em" }}>
            {data?.today?.total_pcs || 0} <span style={{ fontSize: 14, fontWeight: 600, color: "#6b7280" }}>pcs</span>
          </p>
        </div>
      </div>

      {/* Main Line Chart Card (Penjualan 7 Hari Terakhir) */}
      <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #e5e7eb", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>
              Penjualan 7 Hari Terakhir
            </h3>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0 0" }}>
              Grafik tren omset harian Siap Saji
            </p>
          </div>
        </div>

        <div style={{ height: 260, width: "100%" }}>
          {loading ? (
            <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
              Memuat grafik penjualan...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.trend || []}>
                <XAxis dataKey="date_label" stroke="#9ca3af" fontSize={12} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} tickFormatter={(v) => `Rp${v / 1000}k`} />
                <Tooltip
                  formatter={(value: any) => [`Rp ${Number(value).toLocaleString("id-ID")}`, "Omset"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontWeight: 700 }}
                />
                <Line
                  type="monotone"
                  dataKey="omset"
                  stroke="#5005A6"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "#b10fbd" }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Grid: Top 5 Produk & Top 5 Customer */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Top 5 Produk */}
        <div style={{ background: "white", borderRadius: 16, padding: 20, border: "1px solid #e5e7eb" }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 14 }}>
            Top 5 Produk Terlaris
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data?.top_products?.map((p: any, idx: number) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#fafafa", borderRadius: 8, border: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#5005A6", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{p.name}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#b10fbd" }}>
                  {p.total_qty} pcs
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 Customer */}
        <div style={{ background: "white", borderRadius: 16, padding: 20, border: "1px solid #e5e7eb" }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 14 }}>
            Top 5 Customer (Omset)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data?.top_customers?.map((c: any, idx: number) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#fafafa", borderRadius: 8, border: "1px solid #f3f4f6" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>{c.name}</p>
                  <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0" }}>{c.phone}</p>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#5005A6" }}>
                  Rp {Number(c.total_omset).toLocaleString("id-ID")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
