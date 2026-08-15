"use client";

import { useState, useEffect } from "react";
import { ClipboardList, Printer, Calendar, Filter, Truck, ChefHat, FileText, CheckCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/Pagination";
import { formatDate } from "@/lib/utils";

export default function SiapSajiDocumentsPage() {
  const [activeTab, setActiveTab] = useState<"produksi" | "pengiriman" | "rekap_cs">("produksi");
  const [tanggal, setTanggal] = useState("2026-06-18"); // default date matching seed order data
  const [channelFilter, setChannelFilter] = useState("");
  const [channels, setChannels] = useState<{ id: number; name: string }[]>([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [docData, setDocData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch channels for filter
  useEffect(() => {
    fetch("/api/siap-saji/master")
      .then((r) => r.json())
      .then((d) => setChannels(d.channels || []))
      .catch((e) => console.error(e));
  }, []);

  // Fetch document data when tab, date, or channel filter changes
  const fetchDoc = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.append("type", activeTab);
      q.append("tanggal", tanggal);
      if (channelFilter) q.append("channel", channelFilter);

      const res = await fetch(`/api/siap-saji/documents?${q.toString()}`);
      if (!res.ok) throw new Error("Gagal mengambil data dokumen");
      const json = await res.json();
      setDocData(json);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat dokumen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoc();
  }, [activeTab, tanggal, channelFilter]);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 40 }}>
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
      <div style={{ background: "white", borderRadius: 12, padding: "12px 16px", border: "1px solid #e5e7eb", marginBottom: 20, display: "flex", gap: 16, alignItems: "center", overflowX: "auto", whiteSpace: "nowrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Calendar size={16} color="#6b7280" />
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Tanggal:</label>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Filter size={16} color="#6b7280" />
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Channel:</label>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            style={{ width: 160, padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "white" }}
          >
            <option value="">Semua Channel</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.name}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── DOCUMENT CONTENT AREA ────────────────────────────────── */}
      <div id="document-print-content" style={{ background: "white", borderRadius: 12, padding: 24, border: "1px solid #e5e7eb", minHeight: 400 }}>
        {loading ? (
          <p style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Memuat dokumen...</p>
        ) : !docData || !docData.data || docData.data.length === 0 ? (
          <p style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
            Tidak ada data untuk tanggal {tanggal} ({channelFilter || "Semua Channel"}).
          </p>
        ) : activeTab === "produksi" ? (
          /* TAB 1: LAPORAN PRODUKSI DAPUR */
          <div>
            <div style={{ textAlign: "center", borderBottom: "2px solid #111827", paddingBottom: 12, marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, textTransform: "uppercase" }}>
                LAPORAN PENJUALAN HARIAN — PRODUKSI DAPUR
              </h2>
              <p style={{ fontSize: 13, color: "#4b5563", marginTop: 4 }}>
                DYUMMY CATERING | Tanggal: <strong>{formatDate(tanggal)}</strong> | Channel: <strong>{docData.channel}</strong>
              </p>
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
        ) : activeTab === "pengiriman" ? (
          /* TAB 2: DAFTAR ORDER PENGIRIMAN KURIR */
          <div>
            <div style={{ textAlign: "center", borderBottom: "2px solid #111827", paddingBottom: 12, marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, textTransform: "uppercase" }}>
                DAFTAR ORDER PENGIRIMAN HARIAN
              </h2>
              <p style={{ fontSize: 13, color: "#4b5563", marginTop: 4 }}>
                DYUMMY CATERING | Tanggal: <strong>{formatDate(tanggal)}</strong> | Channel: <strong>{docData.channel}</strong>
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
            <div style={{ textAlign: "center", borderBottom: "2px solid #111827", paddingBottom: 12, marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, textTransform: "uppercase" }}>
                REKAP TABEL HARIAN — CUSTOMER SERVICE
              </h2>
              <p style={{ fontSize: 13, color: "#4b5563", marginTop: 4 }}>
                Format Sheet Manual CS | Tanggal: <strong>{formatDate(tanggal)}</strong> | Channel: <strong>{docData.channel}</strong>
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #d1d5db", textTransform: "uppercase", fontSize: 11, color: "#374151" }}>
                  <th style={{ padding: "10px 12px", width: 50 }}>No</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>Pelanggan</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Penjualan</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Biaya Kirim</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Total</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>Rekening</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>Status</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>Kecamatan</th>
                </tr>
              </thead>
              <tbody>
                {docData.data.slice((page - 1) * limit, page * limit).map((row: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>{(page - 1) * limit + idx + 1}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#111827" }}>{row.pelanggan}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      Rp {Number(row.penjualan).toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      Rp {Number(row.ongkir).toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "#5005A6" }}>
                      Rp {Number(row.total).toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 12 }}>
                      {row.bank} ({row.no_rekening})
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span style={{ background: "#f0fdf4", color: "#639922", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#4b5563" }}>{row.kecamatan}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f9fafb", borderTop: "2px solid #111827", fontWeight: 800 }}>
                  <td colSpan={2} style={{ padding: "12px", textAlign: "right" }}>
                    TOTAL REKAP HARIAN:
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    Rp {(docData.total_omset - docData.total_ongkir).toLocaleString("id-ID")}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    Rp {docData.total_ongkir.toLocaleString("id-ID")}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right", fontSize: 16, color: "#5005A6" }}>
                    Rp {docData.total_omset.toLocaleString("id-ID")}
                  </td>
                  <td colSpan={3}></td>
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
        )}
      </div>
    </div>
  );
}
