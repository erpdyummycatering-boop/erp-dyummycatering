"use client";

import { useState, useEffect } from "react";
import { PieChart as PieIcon, RefreshCw, Users, Award, ShieldAlert, UserCheck, HelpCircle } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { toast } from "sonner";

export default function SiapSajiCustomerAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/siap-saji/analytics/customers");
      if (!res.ok) throw new Error("Gagal memuat analitik customer");
      setData(await res.json());
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat analitik customer");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleRefreshRfm = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/siap-saji/rfm", { method: "POST" });
      if (!res.ok) throw new Error("Gagal memperbarui skor RFM");
      toast.success("Skor RFM customer berhasil diperbarui!");
      fetchAnalytics();
    } catch (err: any) {
      toast.error(err.message || "Gagal merefresh RFM");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.02em" }}>
            Analisa Customer (RFM Segmentation)
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Segmentasi pelanggan retail berdasarkan Recency, Frequency, dan Monetary value
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {data?.last_refreshed_at && (
            <span style={{ fontSize: 12, color: "#6b7280", background: "#f3f4f6", padding: "6px 12px", borderRadius: 8, fontWeight: 500 }}>
              Terakhir diperbarui: {new Date(data.last_refreshed_at).toLocaleString("id-ID")}
            </span>
          )}

          <button
            onClick={handleRefreshRfm}
            disabled={isRefreshing}
            style={{
              background: "#5005A6",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "9px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 2px 8px rgba(80, 5, 166, 0.25)",
              opacity: isRefreshing ? 0.7 : 1,
            }}
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Menghitung Ulang..." : "🔄 Hitung Ulang Skor RFM (Manual Rescoring)"}
          </button>
        </div>
      </div>

      {/* Main Grid: Donut Chart (Mockup 08) & Segment Table */}
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 24, marginBottom: 24 }}>
        {/* Donut Chart Card */}
        <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #e5e7eb", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: "0 0 16px", alignSelf: "flex-start" }}>
            Proporsi Segmen Customer
          </h3>

          <div style={{ position: "relative", width: 240, height: 240 }}>
            {loading ? (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
                Memuat Donut Chart...
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.distribution || []}
                      dataKey="jumlah"
                      nameKey="segmen"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={105}
                      paddingAngle={3}
                    >
                      {(data?.distribution || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [`${value} customer`, name]}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontWeight: 700 }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Overlay Text (Mockup 08) */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Total Customer</span>
                  <span style={{ fontSize: 26, fontWeight: 900, color: "#111827" }}>
                    {data?.total_customers || 0}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Legend Badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20, justifyContent: "center" }}>
            {(data?.distribution || []).map((item: any, idx: number) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: item.color }} />
                <span>{item.segmen} ({item.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Segment Breakdown Table (Mockup 08) */}
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>
              Tabel Distribusi Segmen RFM & Aksi Rekomendasi
            </h3>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>
                <th style={{ padding: "12px 16px" }}>Kelompok Segmen</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Jumlah</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>%</th>
                <th style={{ padding: "12px 16px" }}>Keterangan & Strategi Marketing</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                    Memuat data segmen...
                  </td>
                </tr>
              ) : (
                (data?.distribution || []).map((row: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 700 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: row.color }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: row.color }} />
                        {row.segmen}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: 800, color: "#111827" }}>
                      {row.jumlah}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: 700, color: "#5005A6" }}>
                      {row.percentage}%
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "#4b5563" }}>
                      {row.keterangan}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
