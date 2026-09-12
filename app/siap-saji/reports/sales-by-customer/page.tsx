"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Calendar,
  Search,
  FileSpreadsheet,
  TrendingUp,
  ShoppingCart,
  Phone,
  ArrowUpDown,
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
} from "recharts";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { getWhatsAppUrl, formatDate } from "@/lib/utils";
import { Pagination } from "@/components/ui/Pagination";

export default function SalesByCustomerReportPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<"all" | "today" | "month" | "year">("all");

  // Pagination & Table Search State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [tableSearch, setTableSearch] = useState("");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ search });
      if (dateFrom) q.append("date_from", dateFrom);
      if (dateTo) q.append("date_to", dateTo);

      const res = await fetch(`/api/siap-saji/reports/sales-by-customer?${q.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat laporan penjualan customer");
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
  }, [dateFrom, dateTo]);

  const handleQuickFilter = (type: "all" | "today" | "month" | "year") => {
    setQuickFilter(type);
    const now = new Date();
    if (type === "all") {
      setDateFrom("");
      setDateTo("");
    } else if (type === "today") {
      const today = now.toISOString().split("T")[0];
      setDateFrom(today);
      setDateTo(today);
    } else if (type === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const end = now.toISOString().split("T")[0];
      setDateFrom(start);
      setDateTo(end);
    } else if (type === "year") {
      const start = `${now.getFullYear()}-01-01`;
      const end = now.toISOString().split("T")[0];
      setDateFrom(start);
      setDateTo(end);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport();
  };

  const handleExportXLSX = () => {
    if (!data?.customers || data.customers.length === 0) {
      return toast.error("Tidak ada data customer untuk diekspor");
    }
    const wb = XLSX.utils.book_new();

    const rows = data.customers.map((c: any, idx: number) => ({
      No: idx + 1,
      "Nama Customer": c.customer_name,
      "No. HP / WhatsApp": c.customer_phone || "-",
      Kecamatan: c.area_kecamatan || "-",
      "Jumlah Transaksi (Order)": Number(c.total_orders || 0),
      "Total Kuantitas Produk (Qty)": Number(c.total_qty || 0),
      "Total Pembelian / Omset (Rp)": Number(c.total_omset || 0),
      "Transaksi Terakhir": c.last_order_date ? formatDate(c.last_order_date) : "-",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Penjualan Customer");
    XLSX.writeFile(wb, "Laporan_Penjualan_Berdasarkan_Customer.xlsx");
    toast.success("Laporan penjualan customer berhasil diexport ke Excel!");
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 50 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={26} color="#5005A6" /> Laporan Penjualan Berdasarkan Customer
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            Grafik komparasi pelanggan & tabel transaksi dengan metrik Nama Customer, Qty (Pcs), dan Angka Rupiah
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
        {/* Quick Filter Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#4b5563" }}>Periode Cepat:</span>
          <div style={{ background: "#f3f4f6", padding: 4, borderRadius: 10, display: "flex", gap: 4 }}>
            <button
              onClick={() => handleQuickFilter("all")}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: quickFilter === "all" ? "#5005A6" : "transparent",
                color: quickFilter === "all" ? "white" : "#4b5563",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Semua Waktu
            </button>
            <button
              onClick={() => handleQuickFilter("today")}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: quickFilter === "today" ? "#5005A6" : "transparent",
                color: quickFilter === "today" ? "white" : "#4b5563",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Hari Ini
            </button>
            <button
              onClick={() => handleQuickFilter("month")}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: quickFilter === "month" ? "#5005A6" : "transparent",
                color: quickFilter === "month" ? "white" : "#4b5563",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => handleQuickFilter("year")}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: quickFilter === "year" ? "#5005A6" : "transparent",
                color: quickFilter === "year" ? "white" : "#4b5563",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Tahun Ini
            </button>
          </div>
        </div>

        {/* Custom Date Range & Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f9fafb", padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}>
            <Calendar size={14} color="#6b7280" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setQuickFilter("all");
              }}
              title="Dari Tanggal"
              style={{ border: "none", background: "transparent", outline: "none", fontSize: 12, color: "#374151" }}
            />
            <span style={{ color: "#9ca3af", fontSize: 12 }}>s/d</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setQuickFilter("all");
              }}
              title="Sampai Tanggal"
              style={{ border: "none", background: "transparent", outline: "none", fontSize: 12, color: "#374151" }}
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); setQuickFilter("all"); }}
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
                placeholder="Cari nama / HP / kec..."
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
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Customer Bertransaksi</span>
          <p style={{ fontSize: 24, fontWeight: 900, color: "#111827", margin: "4px 0 0" }}>
            {data?.summary?.total_customers || 0} <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>orang</span>
          </p>
        </div>
        <div style={{ background: "white", borderRadius: 12, padding: 16, border: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Total Transaksi Order</span>
          <p style={{ fontSize: 24, fontWeight: 900, color: "#378ADD", margin: "4px 0 0" }}>
            {Number(data?.summary?.total_orders || 0).toLocaleString("id-ID")} <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>pesanan</span>
          </p>
        </div>
        <div style={{ background: "white", borderRadius: 12, padding: 16, border: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Total Produk (Qty)</span>
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

      {/* Chart: Metrik Nama Customer vs Qty vs Angka Rupiah */}
      <div style={{ background: "white", borderRadius: 16, padding: 20, border: "1px solid #e5e7eb", marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>
          Grafik Penjualan Customer (Nama Customer vs Qty vs Angka Rupiah)
        </h3>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 16px" }}>
          Perbandingan performa pembelian pelanggan dengan angka rupiah omset dan total kuantitas produk
        </p>

        <div style={{ height: 280, width: "100%", minWidth: 0 }}>
          {loading ? (
            <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
              Memuat grafik penjualan customer...
            </div>
          ) : (data?.chart_data || []).length === 0 ? (
            <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
              Tidak ada data penjualan customer pada filter ini.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
              <BarChart data={data?.chart_data || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="customer_name" stroke="#9ca3af" fontSize={11} tickLine={false} />
                <YAxis yAxisId="left" stroke="#5005A6" fontSize={11} tickLine={false} tickFormatter={(v) => `Rp${v / 1000}k`} />
                <YAxis yAxisId="right" orientation="right" stroke="#15803d" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(val: any, name: any) =>
                    name === "Angka Rupiah (Omset)"
                      ? [`Rp ${Number(val).toLocaleString("id-ID")}`, name]
                      : [`${Number(val).toLocaleString("id-ID")} pcs`, name]
                  }
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontWeight: 700 }}
                />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                <Bar yAxisId="left" dataKey="total_omset" name="Angka Rupiah (Omset)" fill="#5005A6" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="total_qty" name="Qty Terjual (Pcs)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabel Utama: No, Nama Customer, No HP, Kecamatan, Order, Qty, Angka Rupiah */}
      <div style={{ background: "white", borderRadius: 14, border: "1px solid #e5e7eb", overflowX: "auto", maxWidth: "100%" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>
              Tabel Rincian Penjualan per Customer
            </h3>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
              Data terpisah: Nama Pelanggan, Kontak WA, Kecamatan, Frekuensi Transaksi, Total Qty, dan Angka Rupiah (Paging 10 baris)
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Search terms khusus tabel customer */}
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
              {data?.customers?.length || 0} Total Pelanggan
            </span>
          </div>
        </div>

        {(() => {
          const allCusts = data?.customers || [];
          const filteredCusts = allCusts.filter((c: any) => {
            if (!tableSearch.trim()) return true;
            const q = tableSearch.toLowerCase().trim();
            return (
              (c.customer_name && c.customer_name.toLowerCase().includes(q)) ||
              (c.customer_phone && c.customer_phone.toLowerCase().includes(q)) ||
              (c.area_kecamatan && c.area_kecamatan.toLowerCase().includes(q))
            );
          });

          const totalItems = filteredCusts.length;
          const totalPages = Math.max(1, Math.ceil(totalItems / limit));
          const safePage = Math.min(page, totalPages);
          const startIndex = (safePage - 1) * limit;
          const pagedCustomers = filteredCusts.slice(startIndex, startIndex + limit);

          return (
            <>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, textAlign: "left", fontSize: 13, whiteSpace: "nowrap" }}>
                <thead>
                  <tr style={{ background: "#fafafa", color: "#6b7280", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
                    <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px", width: 50 }}>No.</th>
                    <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px" }}>Nama Customer</th>
                    <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px" }}>No. HP / WA</th>
                    <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px" }}>Kecamatan</th>
                    <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px", textAlign: "center" }}>Total Order</th>
                    <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px", textAlign: "right" }}>Qty (Pcs)</th>
                    <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px", textAlign: "right" }}>Angka Rupiah (Omset)</th>
                    <th style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 10, borderBottom: "2px solid #e5e7eb", padding: "12px 14px" }}>Order Terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                        Memuat data pelanggan...
                      </td>
                    </tr>
                  ) : pagedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                        {tableSearch ? "Tidak ada pelanggan yang sesuai dengan pencarian." : "Tidak ada data penjualan customer ditemukan."}
                      </td>
                    </tr>
                  ) : (
                    pagedCustomers.map((c: any, idx: number) => (
                      <tr key={c.customer_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "12px 14px", color: "#6b7280", borderBottom: "1px solid #f3f4f6" }}>{startIndex + idx + 1}</td>
                        <td style={{ padding: "12px 14px", fontWeight: 700, color: "#111827", borderBottom: "1px solid #f3f4f6" }}>
                          {c.customer_name}
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #f3f4f6" }}>
                          {c.customer_phone ? (
                            <a
                              href={getWhatsAppUrl(c.customer_phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: 12,
                                color: "#16a34a",
                                fontWeight: 700,
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                              title="Chat WhatsApp"
                            >
                              💬 {c.customer_phone}
                            </a>
                          ) : (
                            <span style={{ color: "#9ca3af" }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px", color: "#4b5563", borderBottom: "1px solid #f3f4f6" }}>
                          {c.area_kecamatan || "-"}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, color: "#378ADD", borderBottom: "1px solid #f3f4f6" }}>
                          {c.total_orders}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: "#15803d", borderBottom: "1px solid #f3f4f6" }}>
                          {Number(c.total_qty || 0).toLocaleString("id-ID")} pcs
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: "#5005A6", borderBottom: "1px solid #f3f4f6" }}>
                          Rp {Number(c.total_omset || 0).toLocaleString("id-ID")}
                        </td>
                        <td style={{ padding: "12px 14px", color: "#6b7280", fontSize: 12, borderBottom: "1px solid #f3f4f6" }}>
                          {c.last_order_date ? formatDate(c.last_order_date) : "-"}
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
