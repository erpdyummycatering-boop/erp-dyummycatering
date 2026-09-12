"use client";

import { useState, useEffect } from "react";
import {
  Layers,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  TrendingUp,
  ShoppingBag,
  PieChart as PieIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Pagination } from "@/components/ui/Pagination";

const PIE_COLORS = [
  "#5005A6",
  "#378ADD",
  "#15803d",
  "#b10fbd",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

export default function SalesByProductReportPage() {
  const [timeUnit, setTimeUnit] = useState<"date" | "week" | "month" | "year">("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  // Pie Chart Metric: "omset" or "qty"
  const [pieMetric, setPieMetric] = useState<"omset" | "qty">("omset");

  // Pagination & Table Search State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [tableSearch, setTableSearch] = useState("");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        time_unit: timeUnit,
        search,
      });
      if (dateFrom) q.append("date_from", dateFrom);
      if (dateTo) q.append("date_to", dateTo);

      const res = await fetch(`/api/siap-saji/reports/sales-by-product?${q.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat laporan penjualan produk");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat laporan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [timeUnit, dateFrom, dateTo]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport();
  };

  const handleExportXLSX = () => {
    if (!data?.products || data.products.length === 0) {
      return toast.error("Tidak ada data produk untuk diekspor");
    }
    const wb = XLSX.utils.book_new();

    // Sheet 1: Tabel Penjualan per Produk
    const rows = data.products.map((p: any, idx: number) => ({
      No: idx + 1,
      SKU: p.sku || "-",
      "Nama Produk": p.product_name + (p.is_half_portion ? " (½ Porsi)" : ""),
      Kategori: p.category_name,
      "Kuantitas Terjual (Qty)": Number(p.total_qty || 0),
      "Harga Rata-Rata (Rp)": Number(p.avg_price || 0),
      "Total Penjualan (Rp)": Number(p.total_omset || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Penjualan Produk");

    // Sheet 2: Tren Waktu
    if (data.time_series && data.time_series.length > 0) {
      const timeRows = data.time_series.map((t: any, idx: number) => ({
        No: idx + 1,
        "Periode Waktu": t.time_label,
        "Total Qty (Pcs)": Number(t.total_qty || 0),
        "Total Omset (Rp)": Number(t.total_omset || 0),
      }));
      const wsTime = XLSX.utils.json_to_sheet(timeRows);
      XLSX.utils.book_append_sheet(wb, wsTime, `Tren ${timeUnit.toUpperCase()}`);
    }

    XLSX.writeFile(wb, `Laporan_Penjualan_Produk_${timeUnit}.xlsx`);
    toast.success("Laporan penjualan produk berhasil diexport ke Excel!");
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 50 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 10 }}>
            <Layers size={26} color="#5005A6" /> Laporan Penjualan Berdasarkan Produk
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            Visualisasi grafik tren waktu (Tgl / Pekan / Bulan / Tahun) & tabel detail rincian produk, qty, dan angka rupiah
          </p>
        </div>

        <button
          onClick={handleExportXLSX}
          style={{
            padding: "10px 18px",
            background: "#f0fdf4",
            color: "#16a34a",
            border: "1.5px solid #86efac",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 2px 6px rgba(22, 163, 74, 0.12)",
          }}
        >
          <FileSpreadsheet size={16} /> Export XLSX
        </button>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          background: "white",
          borderRadius: 14,
          padding: "14px 18px",
          border: "1px solid #e5e7eb",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* Metrik Waktu Horizontal Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#4b5563" }}>Metrik Waktu:</span>
          <div style={{ background: "#f3f4f6", padding: 4, borderRadius: 10, display: "flex", gap: 4 }}>
            <button
              onClick={() => setTimeUnit("date")}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: timeUnit === "date" ? "#5005A6" : "transparent",
                color: timeUnit === "date" ? "white" : "#4b5563",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Harian (Tanggal)
            </button>
            <button
              onClick={() => setTimeUnit("week")}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: timeUnit === "week" ? "#5005A6" : "transparent",
                color: timeUnit === "week" ? "white" : "#4b5563",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Pekan (Mingguan)
            </button>
            <button
              onClick={() => setTimeUnit("month")}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: timeUnit === "month" ? "#5005A6" : "transparent",
                color: timeUnit === "month" ? "white" : "#4b5563",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Bulanan
            </button>
            <button
              onClick={() => setTimeUnit("year")}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: timeUnit === "year" ? "#5005A6" : "transparent",
                color: timeUnit === "year" ? "white" : "#4b5563",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Tahunan
            </button>
          </div>
        </div>

        {/* Date Range Picker & Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f9fafb", padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}>
            <Calendar size={14} color="#6b7280" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Dari Tanggal"
              style={{ border: "none", background: "transparent", outline: "none", fontSize: 12, color: "#374151" }}
            />
            <span style={{ color: "#9ca3af", fontSize: 12 }}>s/d</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Sampai Tanggal"
              style={{ border: "none", background: "transparent", outline: "none", fontSize: 12, color: "#374151" }}
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                style={{ background: "#e5e7eb", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}
              >
                ✕
              </button>
            )}
          </div>

          <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 6 }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                type="text"
                placeholder="Cari produk / SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: "6px 10px 6px 30px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12, outline: "none" }}
              />
            </div>
            <button
              type="submit"
              style={{ padding: "6px 12px", background: "#5005A6", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Cari
            </button>
          </form>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div style={{ background: "white", borderRadius: 12, padding: 16, border: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Total Produk Terjual</span>
          <p style={{ fontSize: 24, fontWeight: 900, color: "#111827", margin: "4px 0 0" }}>
            {data?.summary?.total_products || 0} <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>item</span>
          </p>
        </div>
        <div style={{ background: "white", borderRadius: 12, padding: 16, border: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Total Kuantitas (Qty)</span>
          <p style={{ fontSize: 24, fontWeight: 900, color: "#15803d", margin: "4px 0 0" }}>
            {Number(data?.summary?.total_qty || 0).toLocaleString("id-ID")} <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>pcs</span>
          </p>
        </div>
        <div style={{ background: "white", borderRadius: 12, padding: 16, border: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Total Angka Rupiah (Omset)</span>
          <p style={{ fontSize: 24, fontWeight: 900, color: "#5005A6", margin: "4px 0 0" }}>
            Rp {Number(data?.summary?.total_omset || 0).toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      {/* Charts Grid: Bar Chart Waktu & Pie Chart Produk */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20, marginBottom: 24 }}>
        {/* Chart 1: Bar Chart Metrik Horizontal Waktu */}
        <div style={{ background: "white", borderRadius: 16, padding: 20, border: "1px solid #e5e7eb" }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>
            Grafik Penjualan terhadap Waktu ({timeUnit.toUpperCase()})
          </h3>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 16px" }}>
            Metrik horizontal: {timeUnit === "date" ? "Tanggal" : timeUnit === "week" ? "Pekan (Mingguan)" : timeUnit === "month" ? "Bulan" : "Tahun"}
          </p>

          <div style={{ height: 280, width: "100%", minWidth: 0 }}>
            {loading ? (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
                Memuat grafik tren...
              </div>
            ) : (data?.time_series || []).length === 0 ? (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
                Tidak ada data penjualan pada periode ini.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                <BarChart data={data?.time_series || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="time_label" stroke="#9ca3af" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#5005A6" fontSize={11} tickLine={false} tickFormatter={(v) => `Rp${v / 1000}k`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#15803d" fontSize={11} tickLine={false} />
                  <Tooltip
                    formatter={(val: any, name: any) =>
                      name === "Omset (Rp)"
                        ? [`Rp ${Number(val).toLocaleString("id-ID")}`, name]
                        : [`${Number(val).toLocaleString("id-ID")} pcs`, name]
                    }
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontWeight: 700 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                  <Bar yAxisId="left" dataKey="total_omset" name="Omset (Rp)" fill="#5005A6" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="total_qty" name="Qty (Pcs)" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Pie Chart Pangsa Penjualan by Produk */}
        <div style={{ background: "white", borderRadius: 16, padding: 20, border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <PieIcon size={18} color="#5005A6" /> Proporsi Penjualan per Produk
              </h3>
              <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
                Pangsa kontribusi produk berdasarkan {pieMetric === "omset" ? "Angka Rupiah (Omset)" : "Total Kuantitas (Qty)"}
              </p>
            </div>

            {/* Switcher: Omset vs Qty */}
            <div style={{ background: "#f3f4f6", borderRadius: 8, padding: 3, display: "flex", gap: 4 }}>
              <button
                onClick={() => setPieMetric("omset")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: pieMetric === "omset" ? "#5005A6" : "transparent",
                  color: pieMetric === "omset" ? "white" : "#4b5563",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Omset (Rp)
              </button>
              <button
                onClick={() => setPieMetric("qty")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: pieMetric === "qty" ? "#15803d" : "transparent",
                  color: pieMetric === "qty" ? "white" : "#4b5563",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Kuantitas (Pcs)
              </button>
            </div>
          </div>

          <div style={{ height: 280, width: "100%", minWidth: 0 }}>
            {loading ? (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
                Memuat pie chart...
              </div>
            ) : (() => {
                const prods = data?.products || [];
                if (prods.length === 0) {
                  return (
                    <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
                      Tidak ada data produk pada periode ini.
                    </div>
                  );
                }

                // Sort by chosen metric
                const sorted = [...prods].sort((a: any, b: any) => {
                  return pieMetric === "omset"
                    ? Number(b.total_omset || 0) - Number(a.total_omset || 0)
                    : Number(b.total_qty || 0) - Number(a.total_qty || 0);
                });

                // Top 7 items + "Lainnya"
                const topItems = sorted.slice(0, 7).map((p: any) => ({
                  name: p.product_name + (p.is_half_portion ? " (½)" : ""),
                  value: pieMetric === "omset" ? Number(p.total_omset || 0) : Number(p.total_qty || 0),
                }));

                const otherItems = sorted.slice(7);
                if (otherItems.length > 0) {
                  const otherTotal = otherItems.reduce((acc: number, cur: any) => {
                    return acc + (pieMetric === "omset" ? Number(cur.total_omset || 0) : Number(cur.total_qty || 0));
                  }, 0);
                  topItems.push({
                    name: `Lainnya (${otherItems.length} produk)`,
                    value: otherTotal,
                  });
                }

                return (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                    <PieChart>
                      <Pie
                        data={topItems}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ percent }: any) => ((percent || 0) >= 0.04 ? `${((percent || 0) * 100).toFixed(0)}%` : "")}
                        labelLine={false}
                      >
                        {topItems.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any, name: any, item: any) => {
                          const total = topItems.reduce((acc, it) => acc + it.value, 0);
                          const pct = total > 0 ? ((Number(val) / total) * 100).toFixed(1) : "0";
                          const formattedVal =
                            pieMetric === "omset"
                              ? `Rp ${Number(val).toLocaleString("id-ID")} (${pct}%)`
                              : `${Number(val).toLocaleString("id-ID")} pcs (${pct}%)`;
                          return [formattedVal, `${item?.payload?.name || name}`];
                        }}
                        contentStyle={{
                          borderRadius: 10,
                          border: "1px solid #e5e7eb",
                          fontWeight: 700,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                          padding: "8px 12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()}
          </div>
        </div>
      </div>

      {/* Tabel Utama: No, Produk, Qty, Angka Rupiah */}
      <div style={{ background: "white", borderRadius: 14, border: "1px solid #e5e7eb", overflowX: "auto", maxWidth: "100%" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>
              Rincian Tabel Penjualan per Produk
            </h3>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
              Daftar seluruh produk beserta kuantitas terjual dan akumulasi rupiah (Paging 10 baris)
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Search terms khusus tabel */}
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                type="text"
                placeholder="Cari di tabel..."
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setPage(1);
                }}
                style={{ padding: "6px 12px 6px 30px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12, outline: "none", width: 180 }}
              />
            </div>

            <span style={{ fontSize: 12, fontWeight: 700, color: "#5005A6", background: "#f3e8ff", padding: "4px 10px", borderRadius: 20 }}>
              {data?.products?.length || 0} Total Produk
            </span>
          </div>
        </div>

        {(() => {
          const allProds = data?.products || [];
          const filteredProds = allProds.filter((p: any) => {
            if (!tableSearch.trim()) return true;
            const q = tableSearch.toLowerCase().trim();
            return (
              (p.sku && p.sku.toLowerCase().includes(q)) ||
              (p.product_name && p.product_name.toLowerCase().includes(q)) ||
              (p.category_name && p.category_name.toLowerCase().includes(q))
            );
          });

          const totalItems = filteredProds.length;
          const totalPages = Math.max(1, Math.ceil(totalItems / limit));
          const safePage = Math.min(page, totalPages);
          const startIndex = (safePage - 1) * limit;
          const pagedProducts = filteredProds.slice(startIndex, startIndex + limit);

          return (
            <>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, textAlign: "left", fontSize: 13, whiteSpace: "nowrap" }}>
                <thead>
                  <tr style={{ background: "#fafafa", color: "#6b7280", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
                    <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px", width: 50 }}>No.</th>
                    <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px", width: 110 }}>SKU</th>
                    <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px" }}>Nama Produk</th>
                    <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px" }}>Kategori</th>
                    <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px", textAlign: "right" }}>Harga Rata-Rata</th>
                    <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px", textAlign: "right" }}>Qty Terjual</th>
                    <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px", textAlign: "right" }}>Total Rupiah (Omset)</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                        Memuat data produk...
                      </td>
                    </tr>
                  ) : pagedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                        {tableSearch ? "Tidak ada produk yang sesuai dengan pencarian." : "Tidak ada data penjualan produk ditemukan."}
                      </td>
                    </tr>
                  ) : (
                    pagedProducts.map((p: any, idx: number) => (
                      <tr key={p.product_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "12px 14px", color: "#6b7280", borderBottom: "1px solid #f3f4f6" }}>{startIndex + idx + 1}</td>
                        <td style={{ padding: "12px 14px", fontFamily: "monospace", fontWeight: 700, color: "#5005A6", borderBottom: "1px solid #f3f4f6" }}>
                          {p.sku || "-"}
                        </td>
                        <td style={{ padding: "12px 14px", fontWeight: 700, color: "#111827", borderBottom: "1px solid #f3f4f6" }}>
                          {p.product_name}
                          {p.is_half_portion && (
                            <span style={{ marginLeft: 6, fontSize: 11, background: "#fef3c7", color: "#b45309", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                              ½ Porsi
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px", color: "#4b5563", borderBottom: "1px solid #f3f4f6" }}>
                          {p.category_name}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: "#4b5563", borderBottom: "1px solid #f3f4f6" }}>
                          Rp {Number(p.avg_price || 0).toLocaleString("id-ID")}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: "#15803d", borderBottom: "1px solid #f3f4f6" }}>
                          {Number(p.total_qty || 0).toLocaleString("id-ID")} pcs
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: "#5005A6", borderBottom: "1px solid #f3f4f6" }}>
                          Rp {Number(p.total_omset || 0).toLocaleString("id-ID")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <Pagination
                page={safePage}
                totalPages={totalPages}
                total={totalItems}
                limit={limit}
                onChange={(p) => setPage(p)}
                onLimitChange={(lim) => {
                  setLimit(lim);
                  setPage(1);
                }}
              />
            </>
          );
        })()}
      </div>
    </div>
  );
}
