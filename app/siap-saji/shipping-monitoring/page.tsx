"use client";

import { useState, useEffect } from "react";
import { Truck, Search, Filter, Calendar, CheckCircle2, Clock, MapPin, Phone, User, Edit3, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/Pagination";
import { formatDate } from "@/lib/utils";

interface DeliveryOrder {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  kecamatan: string;
  shipping_status: string;
  driver_id: number | null;
  driver_name: string | null;
  items: any[];
  notes: string | null;
  patokan: string | null;
  created_at: string;
}

interface Driver {
  id: number;
  name: string;
}

export default function ShippingMonitoringPage() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Editing state
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.append("type", "rekap_pengiriman");
      q.append("tanggal", tanggal);

      const res = await fetch(`/api/siap-saji/documents?${q.toString()}`);
      if (!res.ok) throw new Error("Gagal mengambil data pengiriman");
      const json = await res.json();
      setOrders(json.data || []);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat data pengiriman");
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const res = await fetch("/api/siap-saji/master");
      if (!res.ok) return;
      const data = await res.json();
      setDrivers(data.drivers || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [tanggal]);

  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/siap-saji/orders/${orderId}/shipping-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipping_status: newStatus }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Gagal mengubah status pengiriman");
      }

      toast.success(`Status pengiriman berhasil diubah ke: ${newStatus}`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateDriver = async (orderId: number, newDriverId: string) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/siap-saji/orders/${orderId}/shipping-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: newDriverId ? Number(newDriverId) : null }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Gagal mentugaskan driver");
      }

      toast.success("Driver pengiriman berhasil diperbarui!");
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui driver");
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtered List
  const filteredOrders = orders.filter((ord) => {
    const matchSearch =
      !search ||
      ord.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      ord.customer_phone?.includes(search) ||
      ord.kecamatan?.toLowerCase().includes(search.toLowerCase()) ||
      ord.order_number?.toLowerCase().includes(search.toLowerCase());

    const matchDriver =
      !driverFilter ||
      (driverFilter === "unassigned" ? !ord.driver_id : String(ord.driver_id) === driverFilter);

    const matchStatus =
      !statusFilter ||
      (ord.shipping_status || "Menunggu") === statusFilter;

    return matchSearch && matchDriver && matchStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Selesai":
      case "Terkirim":
        return <span style={{ background: "#dcfce7", color: "#15803d", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>✓ Terkirim</span>;
      case "Dalam Pengiriman":
      case "Dikirim":
        return <span style={{ background: "#dbeafe", color: "#1d4ed8", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>🚚 Dalam Pengiriman</span>;
      case "Diproses":
        return <span style={{ background: "#fef3c7", color: "#b45309", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>⏳ Diproses Dapur</span>;
      default:
        return <span style={{ background: "#f3f4f6", color: "#4b5563", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>⏸ Menunggu</span>;
    }
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 40 }}>
      {/* ── HEADER ────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.02em" }}>
            Monitoring Status Pengiriman (Kurir)
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Monitor & kelola status kurir / pengiriman harian Siap Saji secara real-time
          </p>
        </div>

        <button
          onClick={() => fetchOrders()}
          style={{
            padding: "8px 16px",
            background: "white",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            color: "#374151",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      {/* ── FILTER TOOLBAR ────────────────────────────────────────── */}
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: "12px 16px",
          border: "1px solid #e5e7eb",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Calendar size={16} style={{ color: "#6b7280" }} />
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            style={{
              padding: "7px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        <div style={{ flex: "1 1 200px", position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Cari Pelanggan, No HP, Kecamatan, Order..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 12px 7px 34px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        <select
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          style={{ width: 160, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white" }}
        >
          <option value="">Semua Driver</option>
          <option value="unassigned">Belum Ditugaskan</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 160, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white" }}
        >
          <option value="">Semua Status</option>
          <option value="Menunggu">Menunggu</option>
          <option value="Diproses">Diproses</option>
          <option value="Dalam Pengiriman">Dalam Pengiriman</option>
          <option value="Selesai">Selesai / Terkirim</option>
        </select>
      </div>

      {/* ── TABLE MONITORING ────────────────────────────────────────── */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
              <th style={{ padding: "12px 10px", width: 40, textAlign: "center" }}>No</th>
              <th style={{ padding: "12px 10px", width: 160 }}>Pelanggan / No HP</th>
              <th style={{ padding: "12px 10px", width: 180 }}>Pesanan Barang</th>
              <th style={{ padding: "12px 10px" }}>Alamat & Patokan</th>
              <th style={{ padding: "12px 10px", width: 120, textAlign: "center" }}>Kecamatan</th>
              <th style={{ padding: "12px 10px", width: 150 }}>Driver Bertugas</th>
              <th style={{ padding: "12px 10px", width: 140, textAlign: "center" }}>Status Pengiriman</th>
              <th style={{ padding: "12px 10px", width: 140, textAlign: "right" }}>Aksi Update Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  Memuat data monitoring pengiriman...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  Tidak ada data pengiriman ditemukan untuk tanggal ini.
                </td>
              </tr>
            ) : (
              filteredOrders.slice((page - 1) * limit, page * limit).map((ord, idx) => {
                const items = Array.isArray(ord.items) ? ord.items : [];
                const currentStatus = ord.shipping_status || "Menunggu";

                return (
                  <tr key={ord.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 10px", textAlign: "center", color: "#6b7280", fontWeight: 600 }}>
                      {(page - 1) * limit + idx + 1}
                    </td>
                    <td style={{ padding: "12px 10px", verticalAlign: "top" }}>
                      <p style={{ fontWeight: 700, margin: 0, color: "#111827" }}>{ord.customer_name}</p>
                      <p style={{ fontSize: 11, color: "#dc2626", fontWeight: 700, margin: "2px 0 0" }}>({ord.customer_phone || "No Telepon"})</p>
                      <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace" }}>{ord.order_number}</span>
                    </td>
                    <td style={{ padding: "12px 10px", verticalAlign: "top" }}>
                      <ul style={{ margin: 0, paddingLeft: 14, fontSize: 12, color: "#374151" }}>
                        {items.map((it: any, i: number) => (
                          <li key={i}>
                            <strong>{it.quantity}x</strong> {it.name || "Produk"}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td style={{ padding: "12px 10px", verticalAlign: "top", color: "#4b5563", fontSize: 12 }}>
                      <div>{ord.delivery_address || "-"}</div>
                      {ord.patokan && (
                        <div style={{ color: "#b45309", fontWeight: 600, marginTop: 4 }}>
                          Patokan: {ord.patokan}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "center", fontWeight: 800, color: "#111827", textTransform: "uppercase", verticalAlign: "top" }}>
                      {ord.kecamatan}
                    </td>
                    <td style={{ padding: "12px 10px", verticalAlign: "top" }}>
                      <select
                        value={ord.driver_id || ""}
                        disabled={updatingId === ord.id}
                        onChange={(e) => handleUpdateDriver(ord.id, e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          fontSize: 12,
                          fontWeight: 600,
                          background: ord.driver_id ? "#f5f3ff" : "#fff",
                          color: ord.driver_id ? "#5005A6" : "#6b7280",
                        }}
                      >
                        <option value="">-- Pilih Driver --</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "center", verticalAlign: "top" }}>
                      {getStatusBadge(currentStatus)}
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "right", verticalAlign: "top" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                        {currentStatus !== "Dalam Pengiriman" && currentStatus !== "Selesai" && (
                          <button
                            disabled={updatingId === ord.id}
                            onClick={() => handleUpdateStatus(ord.id, "Dalam Pengiriman")}
                            style={{
                              padding: "4px 8px",
                              background: "#378ADD",
                              color: "white",
                              border: "none",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                              width: 120,
                            }}
                          >
                            🚚 Kirimkan
                          </button>
                        )}
                        {currentStatus !== "Selesai" && (
                          <button
                            disabled={updatingId === ord.id}
                            onClick={() => handleUpdateStatus(ord.id, "Selesai")}
                            style={{
                              padding: "4px 8px",
                              background: "#639922",
                              color: "white",
                              border: "none",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                              width: 120,
                            }}
                          >
                            ✓ Set Selesai
                          </button>
                        )}
                        {currentStatus !== "Menunggu" && (
                          <button
                            disabled={updatingId === ord.id}
                            onClick={() => handleUpdateStatus(ord.id, "Menunggu")}
                            style={{
                              padding: "3px 6px",
                              background: "#f3f4f6",
                              color: "#6b7280",
                              border: "1px solid #d1d5db",
                              borderRadius: 4,
                              fontSize: 10,
                              cursor: "pointer",
                              width: 120,
                              marginTop: 2,
                            }}
                          >
                            Reset Status
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <Pagination
          page={page}
          totalPages={Math.ceil(filteredOrders.length / limit) || 1}
          total={filteredOrders.length}
          limit={limit}
          onChange={(p) => setPage(p)}
          onLimitChange={(lim) => { setLimit(lim); setPage(1); }}
        />
      </div>
    </div>
  );
}
