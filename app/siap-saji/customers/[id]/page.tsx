"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone, MapPin, Award, RefreshCw, MessageSquare, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDate, getWhatsAppUrl } from "@/lib/utils";

interface CustomerDetailData {
  customer: {
    id: number;
    name: string;
    phone: string;
    address: string;
    patokan: string;
    area_kecamatan: string;
    area_kota: string;
    loyalty_points?: number;
  };
  stats: {
    total_orders: number;
    total_omzet: number;
    aov: number;
    last_order_date: string;
    first_order_date: string;
    recency_days: number | null;
    segmen: string;
    crm_treatment: string;
  };
  favorite_products: { product_name: string; total_qty: number }[];
  recent_orders: { id: number; no_struk: string; order_date: string; grand_total: number; item_names: string }[];
}

export default function SiapSajiCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [data, setData] = useState<CustomerDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCustomerDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/siap-saji/customers/${id}`);
      if (!res.ok) throw new Error("Gagal memuat detail pelanggan");
      setData(await res.json());
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat data pelanggan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerDetail();
  }, [id]);

  const getSegmenBadgeStyle = (segmen: string) => {
    switch (segmen) {
      case "Champions":
      case "Champion":
        return { bg: "#fef3c7", color: "#b45309", border: "#fde68a" };
      case "Loyal Customers":
      case "Loyal":
        return { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" };
      case "Active":
        return { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" };
      case "New Customers":
      case "New Customer":
        return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
      case "At Risk":
        return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
      case "Dormant":
        return { bg: "#f3f4f6", color: "#4b5563", border: "#e5e7eb" };
      default:
        return { bg: "#fdf4ff", color: "#b10fbd", border: "#f5d0fe" };
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <RefreshCw size={36} className="animate-spin" style={{ color: "#5005A6", marginBottom: 16 }} />
        <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>Memuat Detail & Analisa Pelanggan...</p>
      </div>
    );
  }

  if (!data || !data.customer) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 20px" }}>
        <button
          onClick={() => router.push("/siap-saji/customers")}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", color: "#5005A6", fontWeight: 700, cursor: "pointer", fontSize: 14, marginBottom: 20 }}
        >
          <ArrowLeft size={18} /> Kembali ke Master Pelanggan
        </button>
        <div style={{ background: "white", borderRadius: 16, padding: 40, border: "1px solid #e5e7eb", textAlign: "center", color: "#6b7280" }}>
          Pelanggan tidak ditemukan.
        </div>
      </div>
    );
  }

  const cust = data.customer;
  const stats = data.stats;
  const favs = data.favorite_products || [];
  const recents = data.recent_orders || [];
  const segBadge = getSegmenBadgeStyle(stats.segmen);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 40 }}>
      {/* Top Header Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.push("/siap-saji/customers")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "white",
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: "8px 14px",
              color: "#374151",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <ArrowLeft size={16} /> Kembali
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>
              Brief Detail & Analisa Pelanggan: {cust.name}
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0 0" }}>
              Informasi kontak, riwayat belanja, dan panduan follow-up CRM
            </p>
          </div>
        </div>
      </div>

      {/* 4-Section Grid Layout (A, B, C, D) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
        {/* A. DATA CUSTOMER */}
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20, display: "flex", flexDirection: "column", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 6, background: "#5005A6", color: "white", fontSize: 11, fontWeight: 800, alignSelf: "flex-start", marginBottom: 16 }}>
            A. DATA CUSTOMER
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#f3e8ff", border: "2px solid #d8b4fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, flexShrink: 0 }}>
              👤
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#111827" }}>{cust.name}</h2>
              <span style={{ display: "inline-block", marginTop: 4, padding: "3px 12px", borderRadius: 14, fontSize: 12, fontWeight: 800, background: segBadge.bg, color: segBadge.color, border: `1px solid ${segBadge.border}` }}>
                {stats.segmen}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "#374151", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>📞</span> <strong style={{ color: "#111827" }}>{cust.phone}</strong>
            </div>
            <div style={{ display: "flex", gap: 8, lineHeight: 1.4 }}>
              <span>📍</span> <span>{cust.address || "-"}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span>🏢</span> <span>{cust.area_kecamatan ? `Kec. ${cust.area_kecamatan} (${cust.area_kota})` : "-"}</span>
            </div>
            {cust.patokan && (
              <div style={{ background: "#fdf4ff", border: "1px solid #f5d0fe", padding: "8px 12px", borderRadius: 8, color: "#b10fbd", fontWeight: 600, fontSize: 12, marginTop: 4 }}>
                📍 <strong>Patokan:</strong> {cust.patokan}
              </div>
            )}
          </div>

          <div style={{ marginTop: "auto" }}>
            <a
              href={getWhatsAppUrl(cust.phone)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 18px",
                borderRadius: 12,
                background: "#25D366",
                color: "white",
                fontWeight: 900,
                fontSize: 15,
                textDecoration: "none",
                boxShadow: "0 4px 12px rgba(37, 211, 102, 0.3)",
              }}
            >
              💬 WhatsApp Customer
            </a>
          </div>
        </div>

        {/* B. RINGKASAN PERILAKU CUSTOMER */}
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 6, background: "#5005A6", color: "white", fontSize: 11, fontWeight: 800, marginBottom: 16 }}>
            B. RINGKASAN PERILAKU CUSTOMER
          </div>

          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ color: "#6b7280", padding: "7px 0" }}>Segmen</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: segBadge.color }}>{stats.segmen}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ color: "#6b7280", padding: "7px 0" }}>Last Order</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{stats.recency_days !== null ? `${stats.recency_days} hari lalu` : "-"}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ color: "#6b7280", padding: "7px 0" }}>Tanggal Last Order</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{stats.last_order_date ? formatDate(stats.last_order_date) : "-"}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ color: "#6b7280", padding: "7px 0" }}>Total Order</td>
                <td style={{ textAlign: "right", fontWeight: 800 }}>{stats.total_orders}x</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ color: "#6b7280", padding: "7px 0" }}>AOV (Rata-rata Order)</td>
                <td style={{ textAlign: "right", fontWeight: 700, color: "#5005A6" }}>Rp {Number(stats.aov || 0).toLocaleString("id-ID")}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ color: "#6b7280", padding: "7px 0" }}>Total Omzet</td>
                <td style={{ textAlign: "right", fontWeight: 900, color: "#5005A6" }}>Rp {Number(stats.total_omzet || 0).toLocaleString("id-ID")}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ color: "#6b7280", padding: "7px 0" }}>Order Pertama</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{stats.first_order_date ? formatDate(stats.first_order_date) : "-"}</td>
              </tr>
              <tr>
                <td style={{ color: "#6b7280", padding: "7px 0" }}>Total Poin Loyalty</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#15803d" }}>⭐ {Number(cust.loyalty_points || Math.floor((stats.total_omzet || 0) / 1000)).toLocaleString("id-ID")} Poin</td>
              </tr>
            </tbody>
          </table>

          {/* CRM Treatment Highlight Box for CS */}
          {stats.crm_treatment && (
            <div
              style={{
                marginTop: 16,
                background: "#fdf4ff",
                border: "1px solid #f5d0fe",
                borderRadius: 10,
                padding: "12px 14px",
                boxShadow: "0 2px 8px rgba(177, 15, 189, 0.08)",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#b10fbd",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                💡 Rekomendasi Treatment CS / CRM:
              </span>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#111827",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {stats.crm_treatment}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: C. PRODUK FAVORIT & D. RIWAYAT ORDER */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* C. PRODUK FAVORIT */}
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 6, background: "#5005A6", color: "white", fontSize: 11, fontWeight: 800, marginBottom: 16 }}>
              C. PRODUK FAVORIT
            </div>

            {favs.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>Belum ada data produk favorit.</p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#374151" }}>
                {favs.map((p, i) => (
                  <li key={i} style={{ margin: "6px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700 }}>{p.product_name}</span>
                      <span style={{ fontWeight: 900, color: "#5005A6", background: "#f3e8ff", padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>
                        {p.total_qty}x
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* D. RIWAYAT ORDER (TERAKHIR) */}
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e7eb", padding: 20, flex: 1, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 6, background: "#5005A6", color: "white", fontSize: 11, fontWeight: 800, marginBottom: 16 }}>
              D. RIWAYAT ORDER (TERAKHIR)
            </div>

            {recents.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>Belum ada riwayat order.</p>
            ) : (
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#64748b", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Tanggal</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Produk</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recents.map((o) => (
                    <tr key={o.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{formatDate(o.order_date)}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "#111827" }}>{o.item_names || "-"}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: "#5005A6", whiteSpace: "nowrap" }}>
                        Rp {Number(o.grand_total).toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
