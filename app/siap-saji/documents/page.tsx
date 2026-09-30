"use client";

import { useState, useEffect, useMemo } from "react";
import { ClipboardList, Printer, Calendar, Filter, Truck, ChefHat, FileText, CheckCircle, Search, ArrowUpDown, ChevronUp, ChevronDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { MultiSelectCheckbox } from "@/components/ui/MultiSelectCheckbox";
import { Pagination } from "@/components/ui/Pagination";
import { formatDate } from "@/lib/utils";

export default function SiapSajiDocumentsPage() {
  const [activeTab, setActiveTab] = useState<"produksi" | "pengiriman" | "rekap_pengiriman" | "rekap_cs">("produksi");
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [channels, setChannels] = useState<{ id: number; name: string }[]>([]);

  // Sorting state for Rekap CS
  const [rekapSortField, setRekapSortField] = useState<string>("no");
  const [rekapSortOrder, setRekapSortOrder] = useState<"asc" | "desc">("asc");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [docData, setDocData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Helper date display
  const dateLabel = dateFrom === dateTo ? formatDate(dateFrom) : `${formatDate(dateFrom)} s/d ${formatDate(dateTo)}`;

  // Fetch channels for filter
  useEffect(() => {
    fetch("/api/siap-saji/master")
      .then((r) => r.json())
      .then((d) => setChannels(d.channels || []))
      .catch((e) => console.error(e));
  }, []);

  // Fetch document data when tab, date range, or channel filter changes
  const fetchDoc = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.append("type", activeTab);
      q.append("date_from", dateFrom);
      q.append("date_to", dateTo);
      if (selectedChannels.length > 0) {
        q.append("channel", selectedChannels.join(","));
      }

      const res = await fetch(`/api/siap-saji/documents?${q.toString()}`);
      if (!res.ok) throw new Error("Gagal mengambil data dokumen");
      const json = await res.json();
      setDocData(json);
      setPage(1); // Reset page on filter change
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat dokumen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoc();
  }, [activeTab, dateFrom, dateTo, selectedChannels]);

  // Sorting calculation for Rekap CS
  const sortedRekapData = useMemo(() => {
    if (!docData?.data || activeTab !== "rekap_cs") return docData?.data || [];
    const list = [...docData.data];
    if (rekapSortField === "no") return list;

    return list.sort((a, b) => {
      let comp = 0;
      if (rekapSortField === "tanggal") {
        comp = (a.tanggal || "").localeCompare(b.tanggal || "");
      } else if (rekapSortField === "channel") {
        comp = (a.channel || "").localeCompare(b.channel || "");
      } else if (rekapSortField === "pelanggan") {
        comp = (a.pelanggan || "").localeCompare(b.pelanggan || "");
      } else if (rekapSortField === "penjualan") {
        comp = Number(a.penjualan || 0) - Number(b.penjualan || 0);
      } else if (rekapSortField === "ongkir") {
        comp = Number(a.ongkir || 0) - Number(b.ongkir || 0);
      } else if (rekapSortField === "total") {
        comp = Number(a.total || 0) - Number(b.total || 0);
      } else if (rekapSortField === "rekening") {
        const rekA = `${a.bank || "Cash"} ${a.no_rekening || ""}`.trim().toUpperCase();
        const rekB = `${b.bank || "Cash"} ${b.no_rekening || ""}`.trim().toUpperCase();
        comp = rekA.localeCompare(rekB);
      } else if (rekapSortField === "status") {
        comp = (a.status || "").localeCompare(b.status || "");
      } else if (rekapSortField === "kecamatan") {
        comp = (a.kecamatan || "").localeCompare(b.kecamatan || "");
      }
      return rekapSortOrder === "asc" ? comp : -comp;
    });
  }, [docData?.data, activeTab, rekapSortField, rekapSortOrder]);

  const toggleRekapSort = (field: string) => {
    if (rekapSortField === field) {
      setRekapSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setRekapSortField(field);
      setRekapSortOrder("asc");
    }
  };

  const renderSortIndicator = (field: string) => {
    if (rekapSortField !== field) {
      return <ArrowUpDown size={12} color="#9ca3af" style={{ marginLeft: 4, display: "inline-block" }} />;
    }
    return rekapSortOrder === "asc" ? (
      <ChevronUp size={13} color="#5005A6" style={{ marginLeft: 4, display: "inline-block" }} />
    ) : (
      <ChevronDown size={13} color="#5005A6" style={{ marginLeft: 4, display: "inline-block" }} />
    );
  };

  // Export Excel for Rekap CS
  const handleExportRekapCS = () => {
    if (!sortedRekapData || sortedRekapData.length === 0) {
      return toast.error("Tidak ada data Rekap CS untuk diekspor");
    }

    const wb = XLSX.utils.book_new();

    const aoa: any[][] = [];
    aoa.push(["REKAP TABEL HARIAN — CUSTOMER SERVICE"]);
    aoa.push([`Format Sheet Manual CS | Tanggal: ${dateLabel} | Channel: ${docData?.channel || "Semua Channel"}`]);
    aoa.push([]); // blank row

    // Table Header
    aoa.push([
      "No",
      "Tanggal",
      "Pelanggan",
      "Channel",
      "Penjualan",
      "Biaya Kirim",
      "Total",
      "Rekening",
      "Status",
      "Kecamatan",
    ]);

    sortedRekapData.forEach((row: any, idx: number) => {
      const rekeningStr = `${row.bank || "Cash"}${row.no_rekening && row.no_rekening !== "-" ? ` (${row.no_rekening})` : ""}`;
      aoa.push([
        idx + 1,
        row.tanggal ? formatDate(row.tanggal) : "-",
        row.pelanggan || "-",
        row.channel || "Direct",
        Number(row.penjualan || 0),
        Number(row.ongkir || 0),
        Number(row.total || 0),
        rekeningStr,
        row.status || "Lunas",
        row.kecamatan || "-",
      ]);
    });

    // Total row
    const totalPenjualan = (docData?.total_omset || 0) - (docData?.total_ongkir || 0);
    aoa.push([
      "",
      "",
      "",
      "TOTAL REKAP:",
      totalPenjualan,
      Number(docData?.total_ongkir || 0),
      Number(docData?.total_omset || 0),
      "",
      "",
      "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Set column widths
    ws["!cols"] = [
      { wch: 6 },  // No
      { wch: 16 }, // Tanggal
      { wch: 25 }, // Pelanggan
      { wch: 18 }, // Channel
      { wch: 16 }, // Penjualan
      { wch: 14 }, // Biaya Kirim
      { wch: 16 }, // Total
      { wch: 26 }, // Rekening
      { wch: 12 }, // Status
      { wch: 20 }, // Kecamatan
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Rekap CS");

    const fileName = `Rekap_Tabel_CS_${dateFrom}_sd_${dateTo}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("Rekap Tabel CS berhasil diekspor ke Excel!");
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 40 }}>
      {/* ── PRINT STYLES ─────────────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            body * { visibility: hidden !important; }
            #document-print-content, #document-print-content * { visibility: visible !important; }
            #document-print-content {
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
            .print-all-rows { display: table-row !important; }
          }
        `,
      }} />
      {/* ── HEADER & CONTROLS ────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.02em" }}>
            Dokumen Operasional Harian
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            1× Input Penjualan → 3 Output Otomatis (Produksi, Pengiriman, Rekap CS)
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: "10px 18px",
              background: "#5005A6",
              color: "white",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 12px rgba(80, 5, 166, 0.2)",
            }}
          >
            <Printer size={18} /> Cetak Dokumen
          </button>
        </div>
      </div>

      {/* ── TABS NAVIGATION ────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, borderBottom: "2px solid #e5e7eb", marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab("produksi")}
          style={{
            padding: "12px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "produksi" ? "3px solid #5005A6" : "3px solid transparent",
            color: activeTab === "produksi" ? "#5005A6" : "#6b7280",
            fontSize: 15,
            fontWeight: activeTab === "produksi" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: -2,
          }}
        >
          <ChefHat size={18} /> Laporan Produksi Dapur
        </button>

        <button
          onClick={() => setActiveTab("rekap_pengiriman")}
          style={{
            padding: "12px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "rekap_pengiriman" ? "3px solid #5005A6" : "3px solid transparent",
            color: activeTab === "rekap_pengiriman" ? "#5005A6" : "#6b7280",
            fontSize: 15,
            fontWeight: activeTab === "rekap_pengiriman" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: -2,
          }}
        >
          <ClipboardList size={18} /> Rekap Pengiriman (Kurir)
        </button>

        <button
          onClick={() => setActiveTab("pengiriman")}
          style={{
            padding: "12px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "pengiriman" ? "3px solid #5005A6" : "3px solid transparent",
            color: activeTab === "pengiriman" ? "#5005A6" : "#6b7280",
            fontSize: 15,
            fontWeight: activeTab === "pengiriman" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: -2,
          }}
        >
          <Truck size={18} /> Daftar Order Pengiriman
        </button>

        <button
          onClick={() => setActiveTab("rekap_cs")}
          style={{
            padding: "12px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "rekap_cs" ? "3px solid #5005A6" : "3px solid transparent",
            color: activeTab === "rekap_cs" ? "#5005A6" : "#6b7280",
            fontSize: 15,
            fontWeight: activeTab === "rekap_cs" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: -2,
          }}
        >
          <FileText size={18} /> Rekap Tabel CS
        </button>
      </div>

      {/* ── FILTER TOOLBAR ────────────────────────────────────────── */}
      <div style={{ background: "white", borderRadius: 12, padding: "12px 16px", border: "1px solid #e5e7eb", marginBottom: 20, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", position: "relative", zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Calendar size={16} color="#6b7280" />
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Dari:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
          />
          <span style={{ fontSize: 13, color: "#9ca3af" }}>s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Filter size={16} color="#6b7280" />
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
      </div>

      {/* ── DOCUMENT CONTENT AREA ────────────────────────────────── */}
      <div id="document-print-content" style={{ background: "white", borderRadius: 12, padding: 24, border: "1px solid #e5e7eb", minHeight: 400 }}>
        {loading ? (
          <p style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Memuat dokumen...</p>
        ) : !docData || !docData.data || docData.data.length === 0 ? (
          <p style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
            Tidak ada data untuk tanggal {dateLabel} ({selectedChannels.length > 0 ? selectedChannels.join(", ") : "Semua Channel"}).
          </p>
        ) : activeTab === "produksi" ? (
          /* TAB 1: LAPORAN PRODUKSI DAPUR */
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #111827", paddingBottom: 12, marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, textTransform: "uppercase" }}>
                  LAPORAN PENJUALAN HARIAN — PRODUKSI DAPUR
                </h2>
                <p style={{ fontSize: 13, color: "#4b5563", marginTop: 4, margin: 0 }}>
                  DYUMMY CATERING | Tanggal: <strong>{dateLabel}</strong> | Channel: <strong>{docData.channel}</strong>
                </p>
              </div>
              <button
                onClick={() => window.open(`/api/siap-saji/orders/recap-pdf?date_from=${dateFrom}&date_to=${dateTo}`, "_blank")}
                style={{
                  padding: "8px 14px",
                  background: "#378ADD",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 8px rgba(55, 138, 221, 0.3)",
                }}
              >
                🍳 Cetak PDF Rekap Dapur (A4)
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #d1d5db", textTransform: "uppercase", fontSize: 12, color: "#374151" }}>
                  <th style={{ padding: "10px 12px", width: 50 }}>No</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>SKU</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>Nama Barang</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>Porsi</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", width: 100 }}>Qty Total</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>Catatan Tambahan</th>
                </tr>
              </thead>
              <tbody>
                {docData.data.slice((page - 1) * limit, page * limit).map((row: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb", background: row.is_half_portion ? "#fcf4ff" : "white" }}>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>{(page - 1) * limit + idx + 1}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 700, color: "#5005A6" }}>
                      {row.sku || "-"}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{row.nama_barang}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      {row.is_half_portion ? (
                        <span style={{ background: "#b10fbd", color: "white", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          1/2 Porsi
                        </span>
                      ) : (
                        <span style={{ color: "#4b5563", fontSize: 12 }}>Penuh</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, fontSize: 16 }}>
                      {row.total_qty}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 13 }}>
                      {row.notes_gabungan || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f9fafb", borderTop: "2px solid #111827", fontWeight: 800 }}>
                  <td colSpan={4} style={{ padding: "12px", textAlign: "right" }}>
                    TOTAL PORSI PRODUKSI:
                  </td>
                  <td style={{ padding: "12px", textAlign: "right", fontSize: 18, color: "#5005A6" }}>
                    {docData.total_qty} porsi
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            </div>

            <Pagination
              page={page}
              totalPages={Math.ceil(docData.data.length / limit) || 1}
              total={docData.data.length}
              limit={limit}
              onChange={(p) => setPage(p)}
              onLimitChange={(lim) => { setLimit(lim); setPage(1); }}
            />
          </div>
        ) : activeTab === "rekap_pengiriman" ? (
          /* TAB 2: REKAP PENGIRIMAN (KURIR) - MATCHING SCREENSHOT LAYOUT */
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #111827", paddingBottom: 12, marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, textTransform: "uppercase" }}>
                  REKAP PENGIRIMAN HARIAN KURIR / GOJEK OFFLINE
                </h2>
                <p style={{ fontSize: 13, color: "#4b5563", marginTop: 4, margin: 0 }}>
                  DYUMMY CATERING | Tanggal: <strong>{dateLabel}</strong> | Channel: <strong>{docData.channel}</strong>
                </p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <a
                  href="/siap-saji/shipping-monitoring"
                  style={{
                    padding: "8px 16px",
                    background: "white",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#374151",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  🚚 Buka Monitoring Pengiriman Real-time
                </a>
                <button
                  onClick={() => window.open(`/api/siap-saji/orders/recap-shipping-pdf?date_from=${dateFrom}&date_to=${dateTo}`, "_blank")}
                  style={{
                    padding: "8px 16px",
                    background: "linear-gradient(135deg, #5005A6 0%, #B10FBD 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 8px rgba(80, 5, 166, 0.3)",
                  }}
                >
                  🖨️ Cetak PDF Rekap Pengiriman
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1.5px solid #000" }}>
                <thead>
                  <tr style={{ background: "#dbeafe", borderBottom: "1.5px solid #000", textTransform: "uppercase", fontSize: 12, color: "#000", fontWeight: 800 }}>
                    <th style={{ padding: "8px 10px", width: 40, borderRight: "1px solid #000", textAlign: "center" }}>NO</th>
                    <th style={{ padding: "8px 10px", width: 140, borderRight: "1px solid #000", textAlign: "left" }}>Pelanggan</th>
                    <th style={{ padding: "8px 10px", width: 180, borderRight: "1px solid #000", textAlign: "left" }}>Nama Barang</th>
                    <th style={{ padding: "8px 10px", width: 70, borderRight: "1px solid #000", textAlign: "center" }}>Kuantitas</th>
                    <th style={{ padding: "8px 10px", borderRight: "1px solid #000", textAlign: "left" }}>ALAMAT</th>
                    <th style={{ padding: "8px 10px", width: 120, borderRight: "1px solid #000", textAlign: "center" }}>KECAMATAN</th>
                    <th style={{ padding: "8px 10px", width: 100, textAlign: "center" }}>DRIVER</th>
                  </tr>
                </thead>
                <tbody>
                  {docData.data.slice((page - 1) * limit, page * limit).map((row: any, idx: number) => {
                    const items = Array.isArray(row.items) ? row.items : [];
                    const displayItems = [
                      ...items.map((it: any) => ({ name: it.name || "Produk", qty: String(it.quantity || 1) })),
                      { name: "Biaya Kirim", qty: "1" },
                    ];
                    let drNameStr = String(row.driver_name || "Unassigned").toUpperCase();
                    if (!drNameStr.startsWith("P ") && !drNameStr.startsWith("DRIVER ")) {
                      drNameStr = `P ${drNameStr.replace(/^DRIVER\s+/i, "")}`;
                    }

                    return (
                      <tr key={idx} style={{ borderBottom: "1.5px solid #000" }}>
                        <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, borderRight: "1px solid #000", verticalAlign: "top" }}>
                          {(page - 1) * limit + idx + 1}
                        </td>
                        <td style={{ padding: "8px 10px", borderRight: "1px solid #000", verticalAlign: "top" }}>
                          <p style={{ fontWeight: 700, margin: 0, color: "#111827" }}>{row.nama_customer}</p>
                          <p style={{ fontSize: 11, color: "#dc2626", fontWeight: 700, margin: "2px 0 0" }}>({row.no_hp || "No Telepon"})</p>
                        </td>
                        <td colSpan={2} style={{ padding: 0, borderRight: "1px solid #000", verticalAlign: "top" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <tbody>
                              {displayItems.map((it: any, iIdx: number) => (
                                <tr key={iIdx} style={{ borderBottom: iIdx === displayItems.length - 1 ? "none" : "1px solid #e5e7eb" }}>
                                  <td style={{ padding: "6px 10px", fontWeight: it.name === "Biaya Kirim" ? 600 : 500 }}>{it.name}</td>
                                  <td style={{ padding: "6px 10px", width: 70, textAlign: "center", fontWeight: 700, borderLeft: "1px solid #000" }}>
                                    {it.qty},
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                        <td style={{ padding: "8px 10px", borderRight: "1px solid #000", verticalAlign: "top", color: "#111827", fontSize: 12, lineHeight: 1.4 }}>
                          <div>{row.alamat}</div>
                          {row.patokan && (
                            <div style={{ color: "#4b5563", fontWeight: 600, marginTop: 4 }}>
                              Patokan : {row.patokan}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#000", borderRight: "1px solid #000", verticalAlign: "top", textTransform: "uppercase" }}>
                          {row.kecamatan}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#000", verticalAlign: "top" }}>
                          {drNameStr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={Math.ceil(docData.data.length / limit) || 1}
              total={docData.data.length}
              limit={limit}
              onChange={(p) => setPage(p)}
              onLimitChange={(lim) => { setLimit(lim); setPage(1); }}
            />
          </div>
        ) : activeTab === "pengiriman" ? (
          /* TAB 2: DAFTAR ORDER PENGIRIMAN KURIR */
          <div>
            <div style={{ textAlign: "center", borderBottom: "2px solid #111827", paddingBottom: 12, marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, textTransform: "uppercase" }}>
                DAFTAR ORDER PENGIRIMAN HARIAN
              </h2>
              <p style={{ fontSize: 13, color: "#4b5563", marginTop: 4 }}>
                DYUMMY CATERING | Tanggal: <strong>{dateLabel}</strong> | Channel: <strong>{docData.channel}</strong>
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #d1d5db", textTransform: "uppercase", fontSize: 11, color: "#374151" }}>
                  <th style={{ padding: "10px", width: 50 }}>No</th>
                  <th style={{ padding: "10px", textAlign: "left" }}>Pelanggan / No HP</th>
                  <th style={{ padding: "10px", textAlign: "left" }}>Kecamatan & Zona</th>
                  <th style={{ padding: "10px", textAlign: "left" }}>Alamat Lengkap</th>
                  <th style={{ padding: "10px", textAlign: "left" }}>Patokan / Landmark</th>
                  <th style={{ padding: "10px", textAlign: "left" }}>Daftar Barang</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Total</th>
                  <th style={{ padding: "10px", textAlign: "center" }}>Rekening</th>
                </tr>
              </thead>
              <tbody>
                {docData.data.slice((page - 1) * limit, page * limit).map((row: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "10px", textAlign: "center", fontWeight: 700 }}>{(page - 1) * limit + idx + 1}</td>
                    <td style={{ padding: "10px" }}>
                      <p style={{ fontWeight: 700, margin: 0, color: "#111827" }}>{row.nama_customer}</p>
                      <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0" }}>{row.no_hp}</p>
                      <p style={{ fontSize: 10, color: "#5005A6", fontFamily: "monospace", margin: "2px 0 0" }}>
                        {row.no_struk}
                      </p>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ fontWeight: 600 }}>{row.kecamatan}</span>
                      <br />
                      <span style={{ fontSize: 11, color: "#6b7280" }}>({row.shipping_zone})</span>
                    </td>
                    <td style={{ padding: "10px", color: "#374151" }}>{row.alamat}</td>
                    <td style={{ padding: "10px", color: "#b10fbd", fontWeight: 600, whiteSpace: "normal", minWidth: 180, maxWidth: 280, wordBreak: "break-word", lineHeight: 1.4 }}>
                      {row.patokan ? `📍 ${row.patokan}` : "-"}
                    </td>
                    <td style={{ padding: "10px", color: "#111827" }}>{row.daftar_order}</td>
                    <td style={{ padding: "10px", textAlign: "right", fontWeight: 700 }}>
                      Rp {Number(row.grand_total).toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: "10px", textAlign: "center", fontSize: 11 }}>
                      {row.payment_bank}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <Pagination
              page={page}
              totalPages={Math.ceil(docData.data.length / limit) || 1}
              total={docData.data.length}
              limit={limit}
              onChange={(p) => setPage(p)}
              onLimitChange={(lim) => { setLimit(lim); setPage(1); }}
            />
          </div>
        ) : (
          /* TAB 3: REKAP TABEL CS */
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #111827", paddingBottom: 12, marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, textTransform: "uppercase" }}>
                  REKAP TABEL HARIAN — CUSTOMER SERVICE
                </h2>
                <p style={{ fontSize: 13, color: "#4b5563", marginTop: 4, margin: 0 }}>
                  Format Sheet Manual CS | Tanggal: <strong>{dateLabel}</strong> | Channel: <strong>{docData.channel}</strong>
                </p>
              </div>

              <button
                onClick={handleExportRekapCS}
                className="no-print"
                style={{
                  padding: "8px 16px",
                  background: "#16a34a",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  boxShadow: "0 2px 8px rgba(22, 163, 74, 0.25)",
                }}
              >
                <FileSpreadsheet size={16} /> Export Excel (.xlsx)
              </button>
            </div>

            {/* Quick Sort Options Bar */}
            <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap", background: "#f8fafc", padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
                <ArrowUpDown size={14} color="#64748b" /> Urutkan Data:
              </span>

              <button
                onClick={() => {
                  setRekapSortField("rekening");
                  setRekapSortOrder("asc");
                }}
                style={{
                  padding: "5px 11px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: rekapSortField === "rekening" ? "1.5px solid #5005A6" : "1px solid #cbd5e1",
                  background: rekapSortField === "rekening" ? "#f3e8ff" : "white",
                  color: rekapSortField === "rekening" ? "#5005A6" : "#334155",
                  boxShadow: rekapSortField === "rekening" ? "0 1px 3px rgba(80, 5, 166, 0.15)" : "none",
                }}
              >
                🏦 Urut Rekening (Sama Bank) {rekapSortField === "rekening" && (rekapSortOrder === "asc" ? "▲" : "▼")}
              </button>

              <button
                onClick={() => {
                  setRekapSortField("pelanggan");
                  setRekapSortOrder((prev) => (rekapSortField === "pelanggan" && prev === "asc" ? "desc" : "asc"));
                }}
                style={{
                  padding: "5px 11px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: rekapSortField === "pelanggan" ? "1.5px solid #5005A6" : "1px solid #cbd5e1",
                  background: rekapSortField === "pelanggan" ? "#f3e8ff" : "white",
                  color: rekapSortField === "pelanggan" ? "#5005A6" : "#334155",
                }}
              >
                👤 Pelanggan (A-Z) {rekapSortField === "pelanggan" && (rekapSortOrder === "asc" ? "▲" : "▼")}
              </button>

              <button
                onClick={() => {
                  setRekapSortField("total");
                  setRekapSortOrder((prev) => (rekapSortField === "total" && prev === "desc" ? "asc" : "desc"));
                }}
                style={{
                  padding: "5px 11px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: rekapSortField === "total" ? "1.5px solid #5005A6" : "1px solid #cbd5e1",
                  background: rekapSortField === "total" ? "#f3e8ff" : "white",
                  color: rekapSortField === "total" ? "#5005A6" : "#334155",
                }}
              >
                💰 Total (Nominal) {rekapSortField === "total" && (rekapSortOrder === "desc" ? "▼" : "▲")}
              </button>

              {rekapSortField !== "no" && (
                <button
                  onClick={() => {
                    setRekapSortField("no");
                    setRekapSortOrder("asc");
                  }}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    border: "none",
                    background: "none",
                    color: "#dc2626",
                    textDecoration: "underline",
                  }}
                >
                  Reset Urutan
                </button>
              )}
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #d1d5db", textTransform: "uppercase", fontSize: 11, color: "#374151" }}>
                  <th
                    onClick={() => toggleRekapSort("no")}
                    style={{ padding: "10px 12px", width: 45, textAlign: "center", cursor: "pointer", userSelect: "none" }}
                    title="Klik untuk urutkan No"
                  >
                    No {renderSortIndicator("no")}
                  </th>
                  <th
                    onClick={() => toggleRekapSort("tanggal")}
                    style={{ padding: "10px 12px", textAlign: "center", cursor: "pointer", userSelect: "none" }}
                    title="Klik untuk urutkan Tanggal"
                  >
                    Tanggal {renderSortIndicator("tanggal")}
                  </th>
                  <th
                    onClick={() => toggleRekapSort("pelanggan")}
                    style={{ padding: "10px 12px", textAlign: "left", cursor: "pointer", userSelect: "none" }}
                    title="Klik untuk urutkan Pelanggan"
                  >
                    Pelanggan {renderSortIndicator("pelanggan")}
                  </th>
                  <th
                    onClick={() => toggleRekapSort("channel")}
                    style={{ padding: "10px 12px", textAlign: "center", cursor: "pointer", userSelect: "none" }}
                    title="Klik untuk urutkan Channel"
                  >
                    Channel {renderSortIndicator("channel")}
                  </th>
                  <th
                    onClick={() => toggleRekapSort("penjualan")}
                    style={{ padding: "10px 12px", textAlign: "right", cursor: "pointer", userSelect: "none" }}
                    title="Klik untuk urutkan Penjualan"
                  >
                    Penjualan {renderSortIndicator("penjualan")}
                  </th>
                  <th
                    onClick={() => toggleRekapSort("ongkir")}
                    style={{ padding: "10px 12px", textAlign: "right", cursor: "pointer", userSelect: "none" }}
                    title="Klik untuk urutkan Biaya Kirim"
                  >
                    Biaya Kirim {renderSortIndicator("ongkir")}
                  </th>
                  <th
                    onClick={() => toggleRekapSort("total")}
                    style={{ padding: "10px 12px", textAlign: "right", cursor: "pointer", userSelect: "none" }}
                    title="Klik untuk urutkan Total"
                  >
                    Total {renderSortIndicator("total")}
                  </th>
                  <th
                    onClick={() => toggleRekapSort("rekening")}
                    style={{
                      padding: "10px 12px",
                      textAlign: "center",
                      cursor: "pointer",
                      userSelect: "none",
                      background: rekapSortField === "rekening" ? "#ede9fe" : undefined,
                      color: rekapSortField === "rekening" ? "#5005A6" : undefined,
                      fontWeight: rekapSortField === "rekening" ? 800 : undefined,
                    }}
                    title="Klik untuk kelompokkan rekening yang sama (BCA, Mandiri, Kas Kecil, dll)"
                  >
                    🏦 Rekening {renderSortIndicator("rekening")}
                  </th>
                  <th
                    onClick={() => toggleRekapSort("status")}
                    style={{ padding: "10px 12px", textAlign: "center", cursor: "pointer", userSelect: "none" }}
                    title="Klik untuk urutkan Status"
                  >
                    Status {renderSortIndicator("status")}
                  </th>
                  <th
                    onClick={() => toggleRekapSort("kecamatan")}
                    style={{ padding: "10px 12px", textAlign: "left", cursor: "pointer", userSelect: "none" }}
                    title="Klik untuk urutkan Kecamatan"
                  >
                    Kecamatan {renderSortIndicator("kecamatan")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRekapData.map((row: any, idx: number) => {
                  const isVisibleOnPage = idx >= (page - 1) * limit && idx < page * limit;
                  return (
                    <tr
                      key={idx}
                      className={isVisibleOnPage ? "" : "no-print"}
                      style={{
                        borderBottom: "1px solid #e5e7eb",
                        display: isVisibleOnPage ? "table-row" : "none",
                      }}
                    >
                      <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600 }}>{idx + 1}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 12, color: "#4b5563", whiteSpace: "nowrap" }}>
                        {row.tanggal ? formatDate(row.tanggal) : "-"}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "#111827" }}>{row.pelanggan}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span style={{ background: "#f5f3ff", color: "#5005A6", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {row.channel || "Direct"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        Rp {Number(row.penjualan || 0).toLocaleString("id-ID")}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        Rp {Number(row.ongkir || 0).toLocaleString("id-ID")}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "#5005A6" }}>
                        Rp {Number(row.total || 0).toLocaleString("id-ID")}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontSize: 12,
                          background: rekapSortField === "rekening" ? "#faf5ff" : undefined,
                          fontWeight: rekapSortField === "rekening" ? 700 : 500,
                        }}
                      >
                        {row.bank || "Cash"}{row.no_rekening && row.no_rekening !== "-" ? ` (${row.no_rekening})` : ""}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span style={{ background: "#f0fdf4", color: "#639922", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          {row.status || "Lunas"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#4b5563" }}>{row.kecamatan || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f9fafb", borderTop: "2px solid #111827", fontWeight: 800 }}>
                  <td colSpan={4} style={{ padding: "12px", textAlign: "right" }}>
                    TOTAL REKAP:
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    Rp {((docData.total_omset || 0) - (docData.total_ongkir || 0)).toLocaleString("id-ID")}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    Rp {(docData.total_ongkir || 0).toLocaleString("id-ID")}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right", fontSize: 16, color: "#5005A6" }}>
                    Rp {(docData.total_omset || 0).toLocaleString("id-ID")}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
            </div>

            <div className="no-print">
              <Pagination
                page={page}
                totalPages={Math.ceil(sortedRekapData.length / limit) || 1}
                total={sortedRekapData.length}
                limit={limit}
                onChange={(p) => setPage(p)}
                onLimitChange={(lim) => { setLimit(lim); setPage(1); }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
