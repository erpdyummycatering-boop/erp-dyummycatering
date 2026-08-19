"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw,
  Users,
  Search,
  X,
  MessageCircle,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  Lightbulb,
  ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";
import { toast } from "sonner";
import { formatPhoneForDisplay, normalizePhoneNumber } from "@/lib/phoneUtils";

export default function SiapSajiCustomerAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "count" | "monetary" | "retention">("overview");

  // Modal drill-down state
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [segmentCustomers, setSegmentCustomers] = useState<any[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [modalSearch, setModalSearch] = useState("");

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

  const openSegmentModal = async (segmentName: string) => {
    setSelectedSegment(segmentName);
    setLoadingModal(true);
    setSegmentCustomers([]);
    setModalSearch("");
    try {
      const res = await fetch(`/api/siap-saji/analytics/customers?segment=${encodeURIComponent(segmentName)}`);
      if (!res.ok) throw new Error("Gagal mengambil daftar customer segmen");
      const result = await res.json();
      setSegmentCustomers(result.customers || []);
    } catch (err: any) {
      toast.error(err.message || "Gagal mengambil daftar customer");
    } finally {
      setLoadingModal(false);
    }
  };

  const closeModal = () => {
    setSelectedSegment(null);
    setSegmentCustomers([]);
    setModalSearch("");
  };

  const formatRp = (val: number) => {
    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}Jt`;
    if (val >= 1_000) return `Rp ${Math.round(val / 1_000)}rb`;
    return `Rp ${val.toLocaleString("id-ID")}`;
  };

  const filteredModalCustomers = segmentCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(modalSearch))
  );

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
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

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          borderBottom: "2px solid #e5e7eb",
          marginBottom: 24,
          paddingBottom: 2,
        }}
      >
        <button
          onClick={() => setActiveTab("overview")}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            color: activeTab === "overview" ? "#5005A6" : "#6b7280",
            borderBottom: activeTab === "overview" ? "3px solid #5005A6" : "3px solid transparent",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <PieIcon size={16} /> Matriks RFM & Rekomendasi
        </button>

        <button
          onClick={() => setActiveTab("count")}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            color: activeTab === "count" ? "#5005A6" : "#6b7280",
            borderBottom: activeTab === "count" ? "3px solid #5005A6" : "3px solid transparent",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Users size={16} /> Segmentation by Customers (Gambar 2)
        </button>

        <button
          onClick={() => setActiveTab("monetary")}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            color: activeTab === "monetary" ? "#5005A6" : "#6b7280",
            borderBottom: activeTab === "monetary" ? "3px solid #5005A6" : "3px solid transparent",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <BarChart3 size={16} /> Transaksi per Segmen (Gambar 3)
        </button>

        <button
          onClick={() => setActiveTab("retention")}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            color: activeTab === "retention" ? "#5005A6" : "#6b7280",
            borderBottom: activeTab === "retention" ? "3px solid #5005A6" : "3px solid transparent",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <TrendingUp size={16} /> Customer Baru vs Retaining (Gambar 4)
        </button>
      </div>

      {/* TAB 1: OVERVIEW (IMAGE 1 + DRILLDOWN MODAL) */}
      {activeTab === "overview" && (
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
                        style={{ cursor: "pointer" }}
                        onClick={(entry: any) => openSegmentModal(entry?.segmen || entry?.name || "")}
                      >
                        {(data?.distribution || []).map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: any, name: any) => [`${value} customer (Klik untuk detail)`, name]}
                        contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontWeight: 700 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Overlay Text */}
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
                <button
                  key={idx}
                  onClick={() => openSegmentModal(item.segmen)}
                  title={`Klik untuk melihat list daftar ${item.segmen}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    padding: "4px 8px",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: item.color }} />
                  <span>{item.segmen} ({item.percentage}%)</span>
                </button>
              ))}
            </div>
          </div>

          {/* Segment Breakdown Table */}
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #e5e7eb", background: "#fafafa", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>
                Tabel Distribusi Segmen RFM & Aksi Rekomendasi
              </h3>
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>
                💡 Klik nama segmen untuk melihat daftar customer
              </span>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 11, textTransform: "uppercase", background: "#f8fafc" }}>
                  <th style={{ padding: "12px 14px", width: 150 }}>Segmen</th>
                  <th style={{ padding: "12px 14px", textAlign: "center", width: 60 }}>Jumlah</th>
                  <th style={{ padding: "12px 14px", textAlign: "center", width: 50 }}>%</th>
                  <th style={{ padding: "12px 14px", width: 220 }}>Definisi Perilaku Customer</th>
                  <th style={{ padding: "12px 14px" }}>Treatment CRM</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                      Memuat data segmen...
                    </td>
                  </tr>
                ) : (
                  (data?.distribution || []).map((row: any, idx: number) => (
                    <tr
                      key={idx}
                      onClick={() => openSegmentModal(row.segmen)}
                      style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 14px", fontWeight: 700 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: row.color }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: row.color }} />
                          <span style={{ textDecoration: "underline", textDecorationStyle: "dotted" }}>{row.segmen}</span>
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 800, color: "#111827" }}>
                        <span style={{ background: "#f3f4f6", padding: "2px 8px", borderRadius: 12 }}>
                          {row.jumlah}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, color: "#5005A6" }}>
                        {row.percentage}%
                      </td>
                      <td style={{ padding: "12px 14px", color: "#374151", fontWeight: 500 }}>
                        {row.definition}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#1f2937", lineHeight: 1.4 }}>
                        {row.treatment}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SEGMENTATION BY CUSTOMERS (IMAGE 2) */}
      {activeTab === "count" && (
        <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #e5e7eb", marginBottom: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: "#000000", margin: 0 }}>
              Segmentation by Customers
            </h2>
            <p style={{ fontSize: 15, color: "#6b7280", margin: "4px 0 0" }}>
              (Jumlah customer yang dikelompokkan berdasarkan segmentasi)
            </p>
          </div>

          <div style={{ width: "100%", height: 380, marginTop: 24 }}>
            {loading ? (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
                Memuat Grafik Customer...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(data?.distribution || []).map((d: any) => ({
                    name: d.altLabel || d.segmen,
                    segmen: d.segmen,
                    jumlah: d.jumlah,
                  }))}
                  margin={{ top: 25, right: 30, left: 20, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#374151", fontSize: 13, fontWeight: 600 }}
                    axisLine={{ stroke: "#000000", strokeWidth: 1.5 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#374151", fontSize: 12 }}
                    axisLine={{ stroke: "#000000", strokeWidth: 1.5 }}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    formatter={(val: any) => [`${val} Customer`, "Jumlah"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontWeight: 700 }}
                  />
                  <Bar
                    dataKey="jumlah"
                    fill="#facc15"
                    radius={[4, 4, 0, 0]}
                    onClick={(entry: any) => openSegmentModal(entry?.segmen || entry?.name || "")}
                    style={{ cursor: "pointer" }}
                  >
                    <LabelList dataKey="jumlah" position="top" fill="#ca8a04" fontSize={14} fontWeight={800} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SEGMENTATION BY MEDIAN MONETARY (IMAGE 3) */}
      {activeTab === "monetary" && (
        <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #e5e7eb", marginBottom: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: "#000000", margin: 0 }}>
              Segmentation by Median Monetary
            </h2>
            <p style={{ fontSize: 15, color: "#6b7280", margin: "4px 0 0" }}>
              (Median nilai transaksi per segmentasi)
            </p>
          </div>

          <div style={{ width: "100%", height: 380, marginTop: 24 }}>
            {loading ? (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
                Memuat Grafik Monetary...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(data?.distribution || []).map((d: any) => ({
                    name: d.altLabel || d.segmen,
                    segmen: d.segmen,
                    medianVal: d.median_monetary,
                    labelFormatted: formatRp(d.median_monetary),
                  }))}
                  margin={{ top: 25, right: 30, left: 20, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#374151", fontSize: 13, fontWeight: 600 }}
                    axisLine={{ stroke: "#000000", strokeWidth: 1.5 }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(val) => formatRp(val)}
                    tick={{ fill: "#374151", fontSize: 12 }}
                    axisLine={{ stroke: "#000000", strokeWidth: 1.5 }}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    formatter={(val: any) => [`Rp ${Number(val).toLocaleString("id-ID")}`, "Median Monetary"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontWeight: 700 }}
                  />
                  <Bar
                    dataKey="medianVal"
                    fill="#facc15"
                    radius={[4, 4, 0, 0]}
                    onClick={(entry: any) => openSegmentModal(entry?.segmen || entry?.name || "")}
                    style={{ cursor: "pointer" }}
                  >
                    <LabelList dataKey="labelFormatted" position="top" fill="#ca8a04" fontSize={13} fontWeight={800} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Business Insight Banner */}
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 12,
              padding: 16,
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <Lightbulb size={24} color="#1d4ed8" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 14, color: "#1e3a8a", lineHeight: 1.5 }}>
              <strong style={{ display: "block", marginBottom: 4, fontSize: 15 }}>
                💡 Rekomendasi Prioritas Layanan Berdasarkan Nilai Transaksi:
              </strong>
              • Segmen dengan median transaksi tertinggi (seperti <strong>Champions & Loyal</strong>) menjadi{" "}
              <strong>prioritas utama layanan VIP</strong> (fast-track CS, penanganan khusus, voucher eksklusif).
              <br />• Segmen <strong>At-Risk</strong> dan <strong>Dormant</strong> perlu di-treatment khusus lewat{" "}
              <em>Win-back campaign</em> agar nominal transaksi mereka tidak hilang ke kompetitor.
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: NEW VS RETAINING CUSTOMERS (IMAGE 4) */}
      {activeTab === "retention" && (
        <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #e5e7eb", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: "#000000", margin: 0 }}>
                New vs Retaining Customers
              </h2>
              <p style={{ fontSize: 15, color: "#6b7280", margin: "4px 0 0" }}>
                (Proporsi customer baru vs customer lama per bulan)
              </p>
            </div>

            {/* Custom Legend */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
                <span style={{ width: 14, height: 14, background: "#111827", borderRadius: 2 }} />
                <span>Retain</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
                <span style={{ width: 14, height: 14, background: "#facc15", borderRadius: 2 }} />
                <span>New</span>
              </div>
            </div>
          </div>

          <div style={{ width: "100%", height: 380, marginTop: 24 }}>
            {loading ? (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
                Memuat Grafik Retention...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data?.monthly_retention || []}
                  margin={{ top: 20, right: 30, left: 20, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#374151", fontSize: 13, fontWeight: 600 }}
                    axisLine={{ stroke: "#000000", strokeWidth: 1.5 }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(val) => `${val}%`}
                    tick={{ fill: "#374151", fontSize: 12 }}
                    axisLine={{ stroke: "#000000", strokeWidth: 1.5 }}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    formatter={(value: any, name: any, item: any) => [
                      `${value}% (${name === "New" ? item.payload.new_count : item.payload.retain_count} customer)`,
                      name === "New" ? "Customer Baru" : "Customer Lama (Retain)",
                    ]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontWeight: 700 }}
                  />
                  {/* Stacked Bars: New (bottom) and Retain (top) */}
                  <Bar dataKey="New" stackId="a" fill="#facc15">
                    <LabelList
                      dataKey="New"
                      position="inside"
                      formatter={(v: any) => (v > 0 ? `${v}%` : "")}
                      fill="#854d0e"
                      fontSize={11}
                      fontWeight={800}
                    />
                  </Bar>
                  <Bar dataKey="Retain" stackId="a" fill="#111827">
                    <LabelList
                      dataKey="Retain"
                      position="inside"
                      formatter={(v: any) => (v > 0 ? `${v}%` : "")}
                      fill="#ffffff"
                      fontSize={11}
                      fontWeight={800}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Actionable Content / Marketing Insight Box (Gambar 4 Request) */}
          <div
            style={{
              background: "#fffbe6",
              border: "1px solid #ffe58f",
              borderRadius: 12,
              padding: 16,
              marginTop: 16,
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <Lightbulb size={24} color="#d48806" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 14, color: "#854d0e", lineHeight: 1.5 }}>
              <strong style={{ display: "block", marginBottom: 4, fontSize: 15, color: "#713f12" }}>
                📢 Analisa & Evaluasi Tim Konten & Promosi:
              </strong>
              Jika proporsi <strong>New Customer</strong> berada di tingkat yang rendah (seperti pada beberapa bulan terakhir),{" "}
              <strong>tandanya Tim Konten & Marketing harus lebih aktif lagi berpromosi</strong> (menaikkan aktivitas iklan, konten sosial media, referral program) untuk meningkatkan kran trafik customer baru!
            </div>
          </div>
        </div>
      )}

      {/* DRILL-DOWN CUSTOMER LIST MODAL (REQUIREMENT 1) */}
      {selectedSegment && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              maxWidth: 800,
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f9fafb",
              }}
            >
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
                  Daftar Customer — Segmen {selectedSegment}
                </h3>
                <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0 0" }}>
                  Total {segmentCustomers.length} pelanggan di segmen ini
                </p>
              </div>

              <button
                onClick={closeModal}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6b7280",
                  padding: 4,
                  borderRadius: 6,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Input inside Modal */}
            <div style={{ padding: "12px 24px", borderBottom: "1px solid #e5e7eb", background: "white" }}>
              <div style={{ position: "relative" }}>
                <Search
                  size={16}
                  color="#9ca3af"
                  style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
                />
                <input
                  type="text"
                  placeholder="Cari nama atau nomor HP customer..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 36px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Modal Body: Customer List Table */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 24px" }}>
              {loadingModal ? (
                <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  Memuat daftar customer...
                </div>
              ) : filteredModalCustomers.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  Tidak ada customer ditemukan di segmen ini.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, margin: "12px 0" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontSize: 11, textTransform: "uppercase" }}>
                      <th style={{ padding: "10px 8px", textAlign: "left" }}>Nama Customer</th>
                      <th style={{ padding: "10px 8px", textAlign: "left" }}>No. WhatsApp</th>
                      <th style={{ padding: "10px 8px", textAlign: "center" }}>Total Order</th>
                      <th style={{ padding: "10px 8px", textAlign: "left" }}>Order Terakhir</th>
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>Total Belanja</th>
                      <th style={{ padding: "10px 8px", textAlign: "center" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModalCustomers.map((c, i) => (
                      <tr key={c.id || i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "10px 8px", fontWeight: 700, color: "#111827" }}>
                          {c.name}
                        </td>
                        <td style={{ padding: "10px 8px", color: "#374151" }}>
                          {formatPhoneForDisplay(c.phone) || c.phone || "-"}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700 }}>
                          {c.total_orders}x
                        </td>
                        <td style={{ padding: "10px 8px", color: "#6b7280" }}>
                          {c.last_order_date
                            ? new Date(c.last_order_date).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: "#5005A6" }}>
                          Rp {c.total_spending.toLocaleString("id-ID")}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center" }}>
                          {c.phone ? (
                            <a
                              href={`https://wa.me/${normalizePhoneNumber(c.phone).replace(/^0/, "62")}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                background: "#25D366",
                                color: "white",
                                padding: "4px 10px",
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                                textDecoration: "none",
                              }}
                            >
                              <MessageCircle size={13} /> WA
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid #e5e7eb",
                background: "#fafafa",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={closeModal}
                style={{
                  background: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

