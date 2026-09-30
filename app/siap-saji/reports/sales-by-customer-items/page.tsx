"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Filter,
  Search,
  Users,
  Package,
  DollarSign,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { formatDate } from "@/lib/utils";
import { MultiSelectCheckbox } from "@/components/ui/MultiSelectCheckbox";
import { Pagination } from "@/components/ui/Pagination";

interface ItemRow {
  nama_barang: string;
  satuan: string;
  kuantitas: number;
  penjualan: number;
}

interface CustomerGroup {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  channels: string[];
  items: ItemRow[];
  total_kuantitas: number;
  total_penjualan: number;
}

interface DateGroup {
  tanggal: string;
  customers: CustomerGroup[];
  total_kuantitas: number;
  total_penjualan: number;
}

interface ReportData {
  date_from: string;
  date_to: string;
  channel: string;
  dates: DateGroup[];
  summary: {
    total_dates: number;
    total_customers: number;
    total_orders: number;
    grand_total_qty: number;
    grand_total_sales: number;
  };
}

export default function SalesByCustomerItemsReportPage() {
  const getTodayStr = () => new Date().toISOString().split("T")[0];

  const [dateFrom, setDateFrom] = useState(getTodayStr());
  const [dateTo, setDateTo] = useState(getTodayStr());
  const [quickShortcut, setQuickShortcut] = useState<string>("today");

  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [channels, setChannels] = useState<{ id: number; name: string }[]>([]);
  const [search, setSearch] = useState("");

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // Pagination state (default: 10 per page)
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Fetch channels for filter
  useEffect(() => {
    fetch("/api/siap-saji/master")
      .then((r) => r.json())
      .then((d) => setChannels(d.channels || []))
      .catch((e) => console.error(e));
  }, []);

  const handleShortcutChange = (val: string) => {
    setQuickShortcut(val);
    const now = new Date();
    if (val === "today") {
      const today = getTodayStr();
      setDateFrom(today);
      setDateTo(today);
    } else if (val === "yesterday") {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      const str = yest.toISOString().split("T")[0];
      setDateFrom(str);
      setDateTo(str);
    } else if (val === "week") {
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diffToMonday));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setDateFrom(monday.toISOString().split("T")[0]);
      setDateTo(sunday.toISOString().split("T")[0]);
    } else if (val === "month") {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      setDateFrom(`${y}-${m}-01`);
      setDateTo(`${y}-${m}-${String(lastDay).padStart(2, "0")}`);
    } else if (val === "prev_month") {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const y = prev.getFullYear();
      const m = String(prev.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(y, prev.getMonth() + 1, 0).getDate();
      setDateFrom(`${y}-${m}-01`);
      setDateTo(`${y}-${m}-${String(lastDay).padStart(2, "0")}`);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (dateFrom) q.append("date_from", dateFrom);
      if (dateTo) q.append("date_to", dateTo);
      if (selectedChannels.length > 0) {
        q.append("channel", selectedChannels.join(","));
      }
      if (search.trim()) q.append("search", search.trim());

      const res = await fetch(`/api/siap-saji/reports/sales-by-customer-items?${q.toString()}`);
      if (!res.ok) throw new Error("Gagal mengambil laporan penjualan per barang");
      const json = await res.json();
      setReportData(json);
      setPage(1); // Reset page on new fetch
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat laporan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [dateFrom, dateTo, selectedChannels]);

  // Flatten customer entries across all dates to paginate by customer
  const allCustomerEntries = useMemo(() => {
    if (!reportData?.dates) return [];
    const list: Array<{
      dateKey: string;
      customer: CustomerGroup;
    }> = [];
    for (const d of reportData.dates) {
      for (const c of d.customers) {
        list.push({ dateKey: d.tanggal, customer: c });
      }
    }
    return list;
  }, [reportData?.dates]);

  // Sliced for pagination on web view
  const pagedEntries = useMemo(() => {
    return allCustomerEntries.slice((page - 1) * limit, page * limit);
  }, [allCustomerEntries, page, limit]);

  // Re-group paged entries by date for structured table display
  const pagedDateGroups = useMemo(() => {
    const map = new Map<string, CustomerGroup[]>();
    for (const entry of pagedEntries) {
      if (!map.has(entry.dateKey)) {
        map.set(entry.dateKey, []);
      }
      map.get(entry.dateKey)!.push(entry.customer);
    }
    return Array.from(map.entries()).map(([tanggal, customers]) => ({
      tanggal,
      customers,
      total_kuantitas: customers.reduce((sum, c) => sum + c.total_kuantitas, 0),
      total_penjualan: customers.reduce((sum, c) => sum + c.total_penjualan, 0),
    }));
  }, [pagedEntries]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport();
  };

  // ── EXCEL EXPORT (EXACT MATCH SCREENSHOT 1) ───────────────────────
  const handleExportExcel = () => {
    if (!reportData || !reportData.dates || reportData.dates.length === 0) {
      return toast.error("Tidak ada data untuk diekspor");
    }

    const wb = XLSX.utils.book_new();

    // Build raw AoA (Array of Arrays)
    const aoa: any[][] = [];

    // Header info
    aoa.push(["", "", "DYummy Catering", "", ""]);
    aoa.push(["", "", "Penjualan Pelanggan per Barang", "", ""]);
    aoa.push([
      "",
      "",
      `Dari ${dateFrom ? formatDate(dateFrom) : "-"} s/d ${dateTo ? formatDate(dateTo) : "-"}`,
      "",
      "",
    ]);
    aoa.push(["", "", "", "Cabang :", reportData.channel || "Semua Cabang"]);
    aoa.push([]); // blank row

    // Table Header
    const tableHeaderRowIndex = aoa.length;
    aoa.push(["Pelanggan", "Nama Barang", "Satuan", "Kuantitas", "Penjualan"]);

    const merges: XLSX.Range[] = [];
    const isMultiDay = reportData.dates.length > 1;

    for (const d of reportData.dates) {
      if (isMultiDay) {
        // Date separator row
        const dateHeaderRowIdx = aoa.length;
        aoa.push([`TANGGAL: ${formatDate(d.tanggal)}`, "", "", "", ""]);
        merges.push({
          s: { r: dateHeaderRowIdx, c: 0 },
          e: { r: dateHeaderRowIdx, c: 4 },
        });
      }

      for (const cust of d.customers) {
        const custStartRow = aoa.length;

        // Render each item
        cust.items.forEach((item, itemIdx) => {
          aoa.push([
            itemIdx === 0 ? cust.customer_name : "",
            item.nama_barang,
            item.satuan,
            item.kuantitas,
            item.penjualan,
          ]);
        });

        // Customer subtotal row
        const subtotalRowIdx = aoa.length;
        aoa.push([
          "",
          "Total Nama Barang",
          "",
          cust.total_kuantitas,
          cust.total_penjualan,
        ]);

        // Merge customer name column vertically across items + subtotal row
        merges.push({
          s: { r: custStartRow, c: 0 },
          e: { r: subtotalRowIdx, c: 0 },
        });
      }

      if (isMultiDay) {
        // Subtotal for the day
        aoa.push([
          `SUBTOTAL TANGGAL ${formatDate(d.tanggal)}`,
          "",
          "",
          d.total_kuantitas,
          d.total_penjualan,
        ]);
        aoa.push([]); // blank line between days
      }
    }

    // Grand Total Row
    aoa.push([
      "GRAND TOTAL KESELURUHAN",
      "",
      "",
      reportData.summary.grand_total_qty,
      reportData.summary.grand_total_sales,
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Apply column widths
    ws["!cols"] = [
      { wch: 28 }, // Pelanggan
      { wch: 38 }, // Nama Barang
      { wch: 10 }, // Satuan
      { wch: 14 }, // Kuantitas
      { wch: 20 }, // Penjualan
    ];

    ws["!merges"] = merges;

    XLSX.utils.book_append_sheet(wb, ws, "Penjualan Pelanggan per Barang");

    const fileName = `Penjualan_Pelanggan_per_Barang_${dateFrom}_sd_${dateTo}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("Laporan Excel berhasil diunduh!");
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 50 }}>
      {/* ── PRINT CSS ────────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            body * { visibility: hidden !important; }
            #printable-report, #printable-report * { visibility: visible !important; }
            #printable-report {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
            }
            .no-print { display: none !important; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
          }
        `,
      }} />

      {/* ── HEADER & ACTIONS ─────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 10 }}>
            <FileSpreadsheet size={26} color="#5005A6" /> Penjualan Pelanggan per Barang
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            Rincian menu & biaya kirim per pelanggan per hari (Format Akuntansi Standar)
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: "9px 16px",
              background: "white",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 7,
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <Printer size={16} /> Cetak (PDF)
          </button>

          <button
            onClick={handleExportExcel}
            style={{
              padding: "9px 18px",
              background: "#16a34a",
              color: "white",
              border: "none",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 12px rgba(22, 163, 74, 0.25)",
            }}
          >
            <FileSpreadsheet size={16} /> Export Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* ── FILTER TOOLBAR ────────────────────────────────────── */}
      <div className="no-print" style={{ background: "white", borderRadius: 12, padding: "14px 18px", border: "1px solid #e5e7eb", marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", position: "relative", zIndex: 50 }}>
        {/* Row 1: Date Shortcuts */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Periode Cepat:</span>
          {[
            { id: "today", label: "Hari Ini" },
            { id: "yesterday", label: "Kemarin" },
            { id: "week", label: "Minggu Ini" },
            { id: "month", label: "Bulan Ini" },
            { id: "prev_month", label: "Bulan Lalu" },
            { id: "custom", label: "Kustom" },
          ].map((sc) => (
            <button
              key={sc.id}
              onClick={() => handleShortcutChange(sc.id)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                border: quickShortcut === sc.id ? "1.5px solid #5005A6" : "1px solid #e2e8f0",
                background: quickShortcut === sc.id ? "#f3e8ff" : "#f8fafc",
                color: quickShortcut === sc.id ? "#5005A6" : "#475569",
              }}
            >
              {sc.label}
            </button>
          ))}
        </div>

        {/* Row 2: Date Pickers & Multi-Select Channel & Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={15} color="#6b7280" />
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Dari:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setQuickShortcut("custom");
              }}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
            />
            <span style={{ fontSize: 13, color: "#9ca3af" }}>s/d</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setQuickShortcut("custom");
              }}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Filter size={15} color="#6b7280" />
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Channel:</label>
            <MultiSelectCheckbox
              options={channels.map((ch) => ({ value: ch.name, label: ch.name }))}
              selectedValues={selectedChannels}
              onChange={(vals) => setSelectedChannels(vals)}
              placeholder="Semua Channel"
              allLabel="Semua Channel"
              style={{ minWidth: 190 }}
            />
          </div>

          <form onSubmit={handleSearchSubmit} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 200 }}>
            <div style={{ position: "relative", width: "100%" }}>
              <Search size={15} color="#9ca3af" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Cari nama pelanggan atau menu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px 6px 32px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                padding: "6px 12px",
                background: "#5005A6",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Cari
            </button>
          </form>
        </div>
      </div>

      {/* ── SCORECARDS SUMMARY ────────────────────────────────── */}
      {reportData && (
        <div className="no-print" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
          <div style={{ background: "white", borderRadius: 12, padding: "14px 16px", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f3e8ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#5005A6" }}>
              <Users size={20} />
            </div>
            <div>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Total Pelanggan</p>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: "2px 0 0", color: "#111827" }}>
                {reportData.summary.total_customers.toLocaleString("id-ID")}
              </h3>
            </div>
          </div>

          <div style={{ background: "white", borderRadius: 12, padding: "14px 16px", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a" }}>
              <Package size={20} />
            </div>
            <div>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Total Kuantitas (Item)</p>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: "2px 0 0", color: "#111827" }}>
                {reportData.summary.grand_total_qty.toLocaleString("id-ID")}
              </h3>
            </div>
          </div>

          <div style={{ background: "white", borderRadius: 12, padding: "14px 16px", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
              <DollarSign size={20} />
            </div>
            <div>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Total Penjualan Omset</p>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: "2px 0 0", color: "#5005A6" }}>
                Rp {reportData.summary.grand_total_sales.toLocaleString("id-ID")}
              </h3>
            </div>
          </div>

          <div style={{ background: "white", borderRadius: 12, padding: "14px 16px", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fffbeb", display: "flex", alignItems: "center", justifyContent: "center", color: "#d97706" }}>
              <Calendar size={20} />
            </div>
            <div>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Jumlah Hari Transaksi</p>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: "2px 0 0", color: "#111827" }}>
                {reportData.summary.total_dates} Hari
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN REPORT CONTENT (PRINTABLE & EXACT MATCH) ─────── */}
      <div id="printable-report" style={{ background: "white", borderRadius: 12, padding: 24, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {/* Document Header in Sheet */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <p style={{ fontFamily: "monospace", fontSize: 14, color: "#374151", margin: "0 0 4px 0", letterSpacing: "0.05em" }}>
            DYummy Catering
          </p>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#991b1b", margin: 0 }}>
            Penjualan Pelanggan per Barang
          </h2>
          <p style={{ fontSize: 13, color: "#4b5563", marginTop: 4, margin: "4px 0 0 0" }}>
            Dari <strong>{dateFrom ? formatDate(dateFrom) : "-"}</strong> s/d <strong>{dateTo ? formatDate(dateTo) : "-"}</strong>
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <span style={{ fontSize: 12, fontStyle: "italic", color: "#6b7280" }}>
              Cabang : [{reportData?.channel || "Semua Cabang"}]
            </span>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Memuat laporan...</p>
        ) : !reportData || !reportData.dates || reportData.dates.length === 0 ? (
          <p style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
            Tidak ada transaksi untuk periode {dateFrom ? formatDate(dateFrom) : ""} s/d {dateTo ? formatDate(dateTo) : ""}.
          </p>
        ) : (
          <div>
            {pagedDateGroups.map((d, dIdx) => (
              <div key={d.tanggal} style={{ marginBottom: pagedDateGroups.length > 1 ? 32 : 12 }}>
                {/* Date Header for multi-day */}
                {reportData.dates.length > 1 && (
                  <div style={{ background: "#f1f5f9", padding: "8px 14px", borderRadius: 8, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: "4px solid #5005A6" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                      📅 Tanggal: {formatDate(d.tanggal)}
                    </span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      {d.customers.length} Pelanggan halaman ini • {d.total_kuantitas} item • Rp {d.total_penjualan.toLocaleString("id-ID")}
                    </span>
                  </div>
                )}

                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#dbeafe", color: "#1e3a8a", borderBottom: "2px solid #93c5fd" }}>
                        <th style={{ padding: "8px 12px", textAlign: "left", width: "25%", border: "1px solid #cbd5e1", fontWeight: 700 }}>
                          Pelanggan
                        </th>
                        <th style={{ padding: "8px 12px", textAlign: "left", width: "35%", border: "1px solid #cbd5e1", fontWeight: 700 }}>
                          Nama Barang
                        </th>
                        <th style={{ padding: "8px 12px", textAlign: "center", width: "12%", border: "1px solid #cbd5e1", fontWeight: 700 }}>
                          Satuan
                        </th>
                        <th style={{ padding: "8px 12px", textAlign: "center", width: "12%", border: "1px solid #cbd5e1", fontWeight: 700 }}>
                          Kuantitas
                        </th>
                        <th style={{ padding: "8px 12px", textAlign: "right", width: "16%", border: "1px solid #cbd5e1", fontWeight: 700 }}>
                          Penjualan
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.customers.map((cust, cIdx) => (
                        <React.Fragment key={cIdx}>
                          {cust.items.map((item, itIdx) => (
                            <tr key={itIdx} style={{ background: "white" }}>
                              {itIdx === 0 && (
                                <td
                                  rowSpan={cust.items.length + 1}
                                  style={{
                                    padding: "8px 12px",
                                    border: "1px solid #cbd5e1",
                                    verticalAlign: "top",
                                    fontWeight: 700,
                                    color: "#111827",
                                    background: "#f8fafc",
                                  }}
                                >
                                  <div>{cust.customer_name}</div>
                                  {cust.customer_phone && (
                                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                      {cust.customer_phone}
                                    </div>
                                  )}
                                  {cust.channels.length > 0 && (
                                    <div style={{ fontSize: 10, color: "#5005A6", marginTop: 4 }}>
                                      {cust.channels.join(", ")}
                                    </div>
                                  )}
                                </td>
                              )}
                              <td
                                style={{
                                  padding: "8px 12px",
                                  border: "1px solid #cbd5e1",
                                  color: item.nama_barang.includes("Biaya Kirim")
                                    ? "#0284c7"
                                    : item.nama_barang.includes("Diskon")
                                    ? "#dc2626"
                                    : "#1f2937",
                                  fontStyle: item.nama_barang.includes("Biaya Kirim") ? "italic" : "normal",
                                }}
                              >
                                {item.nama_barang}
                              </td>
                              <td style={{ padding: "8px 12px", textAlign: "center", border: "1px solid #cbd5e1", color: "#4b5563" }}>
                                {item.satuan}
                              </td>
                              <td style={{ padding: "8px 12px", textAlign: "center", border: "1px solid #cbd5e1", fontWeight: 600 }}>
                                {item.kuantitas}.
                              </td>
                              <td
                                style={{
                                  padding: "8px 12px",
                                  textAlign: "right",
                                  border: "1px solid #cbd5e1",
                                  color: item.penjualan < 0 ? "#dc2626" : "#111827",
                                }}
                              >
                                {item.penjualan < 0
                                  ? `-Rp ${Math.abs(item.penjualan).toLocaleString("id-ID")}.`
                                  : `${item.penjualan.toLocaleString("id-ID")}.`}
                              </td>
                            </tr>
                          ))}

                          {/* Customer Subtotal Row */}
                          <tr style={{ background: "#e0f2fe", fontWeight: 700 }}>
                            <td
                              style={{
                                padding: "8px 12px",
                                border: "1px solid #cbd5e1",
                                color: "#0369a1",
                              }}
                            >
                              Total Nama Barang
                            </td>
                            <td style={{ border: "1px solid #cbd5e1" }}></td>
                            <td style={{ padding: "8px 12px", textAlign: "center", border: "1px solid #cbd5e1", color: "#0369a1" }}>
                              {cust.total_kuantitas}.
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "right", border: "1px solid #cbd5e1", color: "#0369a1" }}>
                              {cust.total_penjualan.toLocaleString("id-ID")}.
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>

                    {/* Daily Subtotal if multi-day */}
                    {reportData.dates.length > 1 && (
                      <tfoot>
                        <tr style={{ background: "#f1f5f9", fontWeight: 800, borderTop: "2px solid #64748b" }}>
                          <td colSpan={3} style={{ padding: "10px 12px", textAlign: "right", border: "1px solid #cbd5e1" }}>
                            TOTAL TANGGAL {formatDate(d.tanggal)}:
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center", border: "1px solid #cbd5e1" }}>
                            {d.total_kuantitas}.
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", border: "1px solid #cbd5e1", color: "#5005A6" }}>
                            Rp {d.total_penjualan.toLocaleString("id-ID")}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            ))}

            {/* Overall Grand Total Bar */}
            <div
              style={{
                marginTop: 20,
                background: "linear-gradient(135deg, #f8fafc 0%, #ede9fe 100%)",
                border: "2px solid #5005A6",
                borderRadius: 10,
                padding: "14px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#1e1b4b", textTransform: "uppercase" }}>
                  Grand Total Keseluruhan:
                </span>
                <span style={{ fontSize: 13, color: "#6b7280", marginLeft: 8 }}>
                  ({reportData.summary.total_customers} Pelanggan • {reportData.summary.total_orders} Pesanan)
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>
                  Total Kuantitas: <strong style={{ color: "#111827" }}>{reportData.summary.grand_total_qty.toLocaleString("id-ID")}</strong>
                </span>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#5005A6" }}>
                  Total Penjualan: Rp {reportData.summary.grand_total_sales.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="no-print" style={{ marginTop: 18 }}>
              <Pagination
                page={page}
                totalPages={Math.ceil(allCustomerEntries.length / limit) || 1}
                total={allCustomerEntries.length}
                limit={limit}
                onChange={(p) => setPage(p)}
                onLimitChange={(lim) => {
                  setLimit(lim);
                  setPage(1);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
