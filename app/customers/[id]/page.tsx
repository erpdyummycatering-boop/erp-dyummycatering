"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit2, FileText, Plus, Trash2, Download } from "lucide-react";
import { PageHeader, FormRow, FormField } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { fmt, statusBadgeColor } from "@/lib/utils";
import { exportToExcel } from "@/lib/export";

const C = { primary: "#5005A6" };

const formatWaLink = (phone: string) => {
  if (!phone) return "";
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("0")) {
    clean = "62" + clean.slice(1);
  }
  return `https://wa.me/${clean}`;
};

const getStatusColor = (s: string) => {
  if (s === "Closing") return "green";
  if (s === "Reject") return "red";
  if (s === "Follow Up") return "blue";
  if (s === "Negosiasi") return "purple";
  if (s === "Konfirmasi") return "yellow";
  return "gray";
};

const WhatsAppIcon = ({ size = 16 }: { size?: number }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    fill="#25D366"
    style={{ display: "inline-block", flexShrink: 0 }}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);

export default function CustomerDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });

  const handleExportOrders = async () => {
    if (!customer) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/customers/${id}?limit=999999`);
      if (!res.ok) throw new Error("Gagal mengambil data order untuk ekspor");
      const data = await res.json();
      const allOrders = data.orders || [];

      if (allOrders.length === 0) {
        alert("Tidak ada order untuk diekspor");
        return;
      }

      const formattedData = allOrders.map((o: any, idx: number) => ({
        "No.": idx + 1,
        "No. Order": `ORD-${String(o.id).padStart(3, "0")}`,
        "Nama Customer": customer.name,
        "Nama Penerima": o.recipient_name || "-",
        "No HP Penerima": o.recipient_phone ? o.recipient_phone.replace(/[\s-]/g, "") : "-",
        "Tgl Order": o.order_date ? String(o.order_date).slice(0, 10) : "-",
        "Tgl Kirim": o.delivery_date ? String(o.delivery_date).slice(0, 10) : "-",
        "Jam Berangkat": o.departure_time || "-",
        "Jam Tiba": o.arrival_time || "-",
        "Lokasi / Venue": o.venue || "-",
        "Jenis Order": o.jenis_order || "New Order",
        "Biaya Ongkir": Number(o.shipping_fee || 0),
        "Tambahan Harga Menu": Number(o.additional_menu_price || 0),
        "Grand Total": Number(o.grand_total || 0),
        "Status Order": o.status_order || "-",
        "Status Pembayaran": o.status_payment || "-",
        "PIC CS": o.pic_name || "-",
        "Catatan": o.order_notes || "-"
      }));

      const filename = `Daftar_Order_${(customer.name || "Customer").replace(/[^a-zA-Z0-9]/g, "_")}`;
      exportToExcel(formattedData, filename);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>({
    name: "", phone: "", email: "", type: "Perorangan", address: "", notes: "", status: "Prospek"
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fetchDetail = useCallback((page = 1, lim = meta.limit, signal?: AbortSignal) => {
    setLoading(true);
    fetch(`/api/customers/${id}?page=${page}&limit=${lim}`, { signal })
      .then(r => {
        if (!r.ok) throw new Error("Customer tidak ditemukan");
        return r.json();
      })
      .then(d => {
        setCustomer(d);
        setOrders(d.orders || []);
        if (d.pagination) {
          setMeta({
            total: d.pagination.total,
            page: d.pagination.page,
            limit: d.pagination.limit,
            totalPages: d.pagination.totalPages
          });
        }
      })
      .catch(err => {
        if (err.name === "AbortError") return;
        alert(err.message);
        router.push("/customers");
      })
      .finally(() => setLoading(false));
  }, [id, meta.limit, router]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDetail(1, meta.limit, controller.signal);
    return () => controller.abort();
  }, [fetchDetail]);

  const openEdit = () => {
    if (!customer) return;
    setEditForm({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      type: customer.type || "Perorangan",
      address: customer.address || "",
      notes: customer.notes || "",
      status: customer.status || "Prospek"
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.name) return alert("Nama wajib diisi");
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        setShowEditModal(false);
        fetchDetail(meta.page, meta.limit);
      } else {
        const err = await res.json();
        alert("Gagal memperbarui: " + (err.error || "Error"));
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/customers");
      } else {
        const err = await res.json();
        alert("Gagal menghapus: " + (err.error || "Error"));
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  if (loading && !customer) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
        <p>Memuat detail customer...</p>
      </div>
    );
  }

  const hasOrders = (customer?.order_count || 0) > 0;
  const currentStatus = hasOrders ? "Closing" : (customer?.status || "Prospek");

  return (
    <div style={{ maxWidth: 1050, margin: "0 auto" }}>
      {/* Back Link */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/customers" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, color: "#6b7280", fontWeight: 600 }}>
          <ArrowLeft size={14} /> Kembali ke Daftar Customer
        </Link>
      </div>

      <PageHeader 
        title={`Detail Customer: ${customer?.name || ""}`}
        subtitle={`Informasi profil dan riwayat ${meta.total} order`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={openEdit}>
              <Edit2 size={14} /> Edit Customer
            </button>
            <button className="btn btn-secondary" onClick={() => setShowDeleteModal(true)} style={{ color: "#E24B4A" }}>
              <Trash2 size={14} /> Hapus
            </button>
          </div>
        }
      />

      {/* Customer Overview Card */}
      <div className="erp-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{
              width: 54, height: 54, borderRadius: "50%",
              background: C.primary + "20",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 700, color: C.primary, flexShrink: 0
            }}>
              {(customer?.name || "").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#111827" }}>{customer?.name}</h2>
                <Badge color="purple">{customer?.type || "Perorangan"}</Badge>
                <Badge color={getStatusColor(currentStatus)}>
                  {currentStatus}
                </Badge>
              </div>
              <p style={{ fontSize: 14, color: "#6b7280", margin: "6px 0 0" }}>{customer?.address || "Alamat belum diisi"}</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 18px", textAlign: "center" }}>
              <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", margin: 0, fontWeight: 700 }}>Total Order</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: C.primary, margin: "4px 0 0" }}>{customer?.order_count || 0}x</p>
            </div>
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 18px", textAlign: "center" }}>
              <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", margin: 0, fontWeight: 700 }}>Total Omset</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: "#639922", margin: "4px 0 0" }}>{fmt(customer?.total_omzet || 0)}</p>
            </div>
          </div>
        </div>

        {/* Contact Info Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 16, paddingTop: 14, borderTop: "1px solid #e5e7eb", fontSize: 14 }}>
          <div>
            <span style={{ color: "#6b7280" }}>No. WA / Telp: </span>
            {customer?.phone ? (
              <a href={formatWaLink(customer.phone)} target="_blank" rel="noopener noreferrer" style={{ color: "#378ADD", textDecoration: "none", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <WhatsAppIcon size={16} /> {customer.phone}
              </a>
            ) : "-"}
          </div>
          <div>
            <span style={{ color: "#6b7280" }}>Email: </span>
            <span style={{ fontWeight: 600, color: "#374151" }}>{customer?.email || "-"}</span>
          </div>
          <div>
            <span style={{ color: "#6b7280" }}>Catatan: </span>
            <span style={{ color: "#374151" }}>{customer?.notes || "-"}</span>
          </div>
        </div>
      </div>

      {/* Orders Table Card with Pagination */}
      <div className="erp-card-flush">
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#374151" }}>
            Daftar Pesanan / Order ({meta.total} order)
          </h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExportOrders} disabled={exporting} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Download size={14} /> {exporting ? "Mengekspor..." : "Export Excel"}
            </button>
            <Link href="/orders">
              <button className="btn btn-primary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Plus size={14} /> Buat Order Baru
              </button>
            </Link>
          </div>
        </div>

        {loading ? (
          <p style={{ padding: 24, color: "#6b7280", fontSize: 15 }}>Memuat daftar order...</p>
        ) : orders.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#6b7280", fontSize: 15 }}>
            Customer ini belum memiliki riwayat order.
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 45 }}>No.</th>
                    <th style={{ whiteSpace: "nowrap" }}>No. Order</th>
                    <th style={{ whiteSpace: "nowrap", minWidth: 115 }}>Tgl Kirim</th>
                    <th>Penerima</th>
                    <th style={{ minWidth: 220 }}>Lokasi / Venue</th>
                    <th style={{ whiteSpace: "nowrap" }}>Jenis Order</th>
                    <th style={{ whiteSpace: "nowrap" }}>Total</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o: any, idx: number) => (
                    <tr key={o.id}>
                      <td style={{ fontSize: 14, color: "#6b7280" }}>
                        {(meta.page - 1) * meta.limit + idx + 1}
                      </td>
                      <td style={{ fontWeight: 700, color: C.primary, fontSize: 14, whiteSpace: "nowrap" }}>
                        ORD-{String(o.id).padStart(3, "0")}
                      </td>
                      <td style={{ fontSize: 14, whiteSpace: "nowrap" }}>
                        {String(o.delivery_date || "").slice(0, 10)}
                      </td>
                      <td style={{ fontSize: 14 }}>
                        {o.recipient_name ? (
                          <span>
                            {o.recipient_name}{" "}
                            {o.recipient_phone ? (
                              <span style={{ color: "#6b7280", fontSize: 12 }}>
                                ({o.recipient_phone.replace(/[\s-]/g, "")})
                              </span>
                            ) : ""}
                          </span>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>Sama dg Pemesan</span>
                        )}
                      </td>
                      <td style={{ fontSize: 14, whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.4 }}>
                        {o.venue || "-"}
                      </td>
                      <td style={{ fontSize: 14 }}>
                        <Badge color={o.jenis_order === "New Order" ? "green" : "purple"}>
                          {o.jenis_order || "New Order"}
                        </Badge>
                      </td>
                      <td style={{ fontWeight: 700, color: C.primary, fontSize: 14 }}>{fmt(o.grand_total)}</td>
                      <td>
                        <Badge color={statusBadgeColor(o.status_order)}>{o.status_order}</Badge>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <Link href={`/orders/${o.id}`}>
                            <button className="btn btn-secondary btn-sm" title="Edit Order">
                              <Edit2 size={11} /> Edit
                            </button>
                          </Link>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            onClick={() => window.open(`/print/konfirmasi/${o.id}`, "_blank")} 
                            title="Konfirmasi PDF"
                          >
                            <FileText size={11} /> Konfirmasi
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Component */}
            <Pagination 
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              limit={meta.limit}
              onChange={(p) => fetchDetail(p, meta.limit)}
              onLimitChange={(lim) => fetchDetail(1, lim)}
            />
          </>
        )}
      </div>

      {/* Edit Customer Modal */}
      <Modal show={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Customer">
        <FormRow>
          <FormField label="Nama *">
            <input value={editForm.name} onChange={(e) => setEditForm((f: any) => ({ ...f, name: e.target.value }))} />
          </FormField>
          <FormField label="No. Telepon / WA">
            <input value={editForm.phone} onChange={(e) => setEditForm((f: any) => ({ ...f, phone: e.target.value }))} />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="Tipe Customer">
            <SearchableSelect 
              value={editForm.type} onChange={v => setEditForm((f: any) => ({ ...f, type: v }))}
              options={["Perorangan", "Corporate", "Instansi"].map(t => ({ value: t, label: t }))}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
          <FormField label="Email">
            <input type="email" value={editForm.email} onChange={(e) => setEditForm((f: any) => ({ ...f, email: e.target.value }))} />
          </FormField>
        </FormRow>
        <FormField label="Alamat" style={{ marginBottom: 14 }}>
          <input value={editForm.address} onChange={(e) => setEditForm((f: any) => ({ ...f, address: e.target.value }))} />
        </FormField>
        <FormField label="Catatan" style={{ marginBottom: 14 }}>
          <textarea rows={2} value={editForm.notes} onChange={(e) => setEditForm((f: any) => ({ ...f, notes: e.target.value }))} />
        </FormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Batal</button>
          <button className="btn btn-primary" onClick={handleSaveEdit}>Simpan Perubahan</button>
        </div>
      </Modal>

      <ConfirmModal 
        show={showDeleteModal}
        title="Hapus Customer"
        message={`Yakin ingin menghapus ${customer?.name}? Data yang dihapus tidak dapat dikembalikan.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
