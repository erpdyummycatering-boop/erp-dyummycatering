"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { fmt } from "@/lib/utils";

const TABS = [
  { id: "sales_order", label: "Sales Order" },
  { id: "invoice", label: "Invoice" },
  { id: "contact", label: "Kontak / Customer" },
  { id: "product", label: "Produk" },
] as const;

type Row = {
  id: number;
  refNumber: string | null;
  name: string | null;
  transDate: string | null;
  dueDate: string | null;
  amount: number;
  due: number | null;
  paid: number | null;
  status: string | null;
  phone: string | null;
  code: string | null;
  erpOrderNo: string | null;
  erpOrderId: number | null;
  kledoUrl: string;
};

export default function DataKledoPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("invoice");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ tab, page: String(page), per_page: "20", status });
    if (search) params.set("search", search);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const res = await fetch(`/api/integrations/kledo/browse?${params}`);
    const body = await res.json().catch(() => ({ ok: false, error: "Gagal memuat data Kledo" }));
    setData(body);
    setLoading(false);
  }, [tab, page, search, dateFrom, dateTo, status]);

  useEffect(() => { load(); }, [load]);

  const summary = data?.summary;
  const rows: Row[] = data?.rows || [];

  return (
    <div>
      <PageHeader title="Data Kledo" subtitle="Hanya baca dari akun Kledo yang tersimpan. Token tidak dikirim ke browser." />
      {data && !data.ok && (
        <div style={{ background: "#FAEEDA", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
          {data.error}
          <div style={{ marginTop: 8 }}>
            <Link href="/crm/pengaturan-kledo" style={{ color: "#3b047a" }}>Buka Pengaturan Kledo</Link>
          </div>
        </div>
      )}
      {data?.warning && <div style={{ background: "#FAEEDA", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>{data.warning}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Card label="Total invoice" value={summary ? fmt(summary.total) : "—"} hint={summary ? `${summary.count} dokumen` : "Pilih rentang tanggal"} />
        <Card label="Lunas" value={summary ? fmt(summary.paid) : "—"} />
        <Card label="Belum lunas" value={summary ? fmt(summary.unpaid) : "—"} />
        <Card label="Jatuh tempo" value={summary ? fmt(summary.overdue) : "—"} />
      </div>
      {summary?.capped && <p style={{ fontSize: 13, color: "#6b7280" }}>Ringkasan dihitung dari 500 invoice pertama pada rentang ini.</p>}

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {TABS.map((item) => (
          <button key={item.id} className={`btn btn-sm ${tab === item.id ? "btn-primary" : "btn-secondary"}`} onClick={() => { setTab(item.id); setPage(1); setStatus("all"); }}>{item.label}</button>
        ))}
      </div>

      <div className="erp-card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {(tab === "invoice" || tab === "sales_order") && (
            <>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="all">Semua status</option>
                {tab === "invoice" ? (
                  <>
                    <option value="unpaid">Belum lunas</option>
                    <option value="paid">Lunas</option>
                    <option value="overdue">Jatuh tempo</option>
                  </>
                ) : (
                  <>
                    <option value="open">Terbuka</option>
                    <option value="invoiced">Ditagih</option>
                  </>
                )}
              </select>
            </>
          )}
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Cari nomor, nama, atau memo" style={{ minWidth: 220 }} />
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(searchInput); setPage(1); }}>Terapkan</button>
        </div>
      </div>

      <div className="erp-card-flush">
        {loading ? <p style={{ padding: 16 }}>Memuat data Kledo...</p> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Nomor / Nama</th>
                  <th>Tanggal</th>
                  {tab === "invoice" && <th>Jatuh tempo</th>}
                  {tab === "invoice" && <th>Sisa</th>}
                  <th>Status</th>
                  <th>Order ERP</th>
                  <th>Kledo</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={7} style={{ padding: 16, color: "#6b7280" }}>{data?.ok === false ? "Tidak ada data" : "Tidak ada baris pada filter ini"}</td></tr>}
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.refNumber || row.name || row.code || row.id}</div>
                      {row.name && row.refNumber && <div style={{ fontSize: 13, color: "#6b7280" }}>{row.name}</div>}
                      {row.phone && <div style={{ fontSize: 13, color: "#6b7280" }}>{row.phone}</div>}
                    </td>
                    <td>{row.transDate || "—"}</td>
                    {tab === "invoice" && <td>{row.dueDate || "—"}</td>}
                    {tab === "invoice" && <td>{row.due == null ? "—" : fmt(row.due)}</td>}
                    <td>{row.status || "—"}</td>
                    <td>
                      {row.erpOrderId ? <Link href={`/orders/${row.erpOrderId}`} style={{ color: "#5005A6" }}>{row.erpOrderNo || `ORD-${row.erpOrderId}`}</Link> : "—"}
                    </td>
                    <td><a href={row.kledoUrl} target="_blank" rel="noreferrer" style={{ color: "#378ADD" }}>Buka di Kledo</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data?.ok && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: 12 }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>{data.cached ? "Cache ±60 detik. " : ""}{status !== "all" ? "Status menyaring baris di halaman ini. " : ""}Halaman {data.page} / {data.totalPages} · {data.total} data</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Sebelumnya</button>
              <button className="btn btn-secondary btn-sm" disabled={page >= (data.totalPages || 1)} onClick={() => setPage((p) => p + 1)}>Berikutnya</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="erp-card" style={{ marginBottom: 0 }}>
      <div style={{ fontSize: 13, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#3b047a" }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: "#6b7280" }}>{hint}</div>}
    </div>
  );
}
