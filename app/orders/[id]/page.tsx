"use client";

import { useEffect, useState, use } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Trash2, Save, ArrowLeft, Plus, CheckCircle2 } from "lucide-react";
import { PageHeader, FormRow, FormField } from "@/components/ui/PageHeader";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Modal } from "@/components/ui/Modal";
import { fmt } from "@/lib/utils";

const STATUS_ORDER = ["Baru", "Diproses", "Selesai", "Batal"];
const STATUS_PAY = ["Belum Lunas", "DP 50%", "Lunas"];

const emptyItem = () => ({
  product_id: "",
  product_name: "",
  price: 0,
  quantity: 50,
  discount: 0,
  subtotal: 0,
  custom_menu: ""
});

export default function OrderDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [form, setForm] = useState<any>({
    customer_id: "",
    pic_id: "",
    order_date: "",
    delivery_date: "",
    departure_time: "",
    arrival_time: "",
    shipping_fee: 0,
    additional_menu_price: 0,
    venue: "",
    order_notes: "",
    status_order: "Baru",
    status_payment: "Belum Lunas",
    items: []
  });

  const [showQuickCust, setShowQuickCust] = useState(false);
  const [quickCustForm, setQuickCustForm] = useState({ name: "", phone: "", type: "Perorangan", email: "", address: "", notes: "" });

  const openQuickCust = (name = "") => {
    setQuickCustForm({ name, phone: "", type: "Perorangan", email: "", address: "", notes: "" });
    setShowQuickCust(true);
  };

  const handleSaveQuickCust = async () => {
    if (!quickCustForm.name) return alert("Nama wajib diisi");
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...quickCustForm, create_lead: true }),
    });
    if (res.ok) {
      const newCust = await res.json();
      setCustomers((prev) => [...prev, newCust]);
      setForm((f: any) => ({ ...f, customer_id: String(newCust.id) }));
      setShowQuickCust(false);
    } else {
      const err = await res.json();
      alert("Gagal menambahkan kontak: " + (err.error || "Unknown error"));
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    // Fetch master data
    Promise.all([
      fetch("/api/customers?limit=100", { signal }).then(r => r.json()),
      fetch("/api/users", { signal }).then(r => r.json()),
      fetch("/api/products?limit=100", { signal }).then(r => r.json())
    ]).then(([cData, uData, pData]) => {
      setCustomers(cData.data || []);
      setUsers(uData || []);
      setProducts(pData.data || []);
    }).catch(err => {
      if (err.name !== "AbortError") console.error(err);
    });

    // Fetch active order
    fetch(`/api/orders/${id}`, { signal })
      .then(r => {
        if (!r.ok) throw new Error("Order tidak ditemukan");
        return r.json();
      })
      .then(d => {
        setForm({
          customer_id: String(d.customer_id),
          pic_id: d.pic_id ? String(d.pic_id) : "",
          order_date: String(d.order_date || "").slice(0, 10),
          delivery_date: String(d.delivery_date || "").slice(0, 10),
          departure_time: d.departure_time || "",
          arrival_time: d.arrival_time || "",
          venue: d.venue || "",
          order_notes: d.order_notes || "",
          status_order: d.status_order || "Baru",
          status_payment: d.status_payment || "Belum Lunas",
          shipping_fee: Number(d.shipping_fee || 0),
          additional_menu_price: Number(d.additional_menu_price || 0),
          items: (d.items || []).map((i: any) => ({
            ...i,
            product_id: String(i.product_id),
            custom_menu: i.custom_menu || ""
          }))
        });
      })
      .catch(err => {
        if (err.name === "AbortError") return;
        alert(err.message);
        router.push("/orders");
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [id, router]);

  const updateItem = (idx: number, field: string, val: any) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: val };
    
    if (field === "product_id") {
      const p = products.find((p: any) => String(p.id) === String(val));
      if (p) {
        items[idx].price = Number(p.price);
        items[idx].product_name = p.name;
        items[idx].custom_menu = p.description || "";
      }
    }
    
    const price = Number(items[idx].price || 0);
    const qty = Number(items[idx].quantity || 0);
    const disc = Number(items[idx].discount || 0);
    items[idx].subtotal = price * qty - disc;
    
    setForm((f: any) => ({ ...f, items }));
  };

  const grandTotal = form.items.reduce((s: number, i: any) => s + (Number(i.subtotal) || 0), 0) + Number(form.shipping_fee || 0) + Number(form.additional_menu_price || 0);

  const handleSave = async () => {
    if (!form.customer_id || !form.delivery_date) {
      return alert("Customer dan tanggal kirim wajib diisi");
    }
    if (!form.items.some((i: any) => i.product_id)) {
      return alert("Minimal harus ada 1 item produk");
    }

    setSaving(true);
    setMessage("");

    try {
      const validItems = form.items.filter((i: any) => i.product_id);
      const res = await fetch(`/api/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items: validItems })
      });

      if (res.ok) {
        setMessage("Perubahan order berhasil disimpan!");
        // Refresh detail
        const updated = await res.json();
        setForm((f: any) => ({
          ...f,
          status_order: updated.status_order,
          status_payment: updated.status_payment
        }));
        setTimeout(() => setMessage(""), 3000);
      } else {
        const err = await res.json();
        alert("Gagal menyimpan: " + (err.error || "Unknown error"));
      }
    } catch (e) {
      alert("Error: Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
        <p>Memuat rincian order...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* Back button */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/orders" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7280" }}>
          <ArrowLeft size={14} /> Kembali ke Rekap Order
        </Link>
      </div>

      <PageHeader 
        title={`Edit Order ORD-${String(id).padStart(3, "0")}`}
        subtitle="Kelola rincian pengiriman, item pesanan, dan menu custom"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/orders">
              <button className="btn btn-secondary">Batal</button>
            </Link>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={14} /> {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        }
      />

      {message && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#E1F5EE", border: "1px solid #9FE1CB", color: "#0F6E56", padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
          <CheckCircle2 size={16} color="#639922" /> {message}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        {/* Card 1: Informasi Utama */}
        <div className="erp-card">
          <h2 style={{ fontSize: 14, fontWeight: 700, borderBottom: "1px solid #e5e7eb", paddingBottom: 8, marginBottom: 14, color: "#374151" }}>
            Informasi Pengiriman & Status
          </h2>
          
          <FormRow>
            <FormField label="Customer">
              <div style={{ display: "flex", gap: 6, width: "100%" }}>
                <div style={{ flex: 1 }}>
                  <SearchableSelect 
                    value={form.customer_id} 
                    onChange={v => setForm((f: any) => ({ ...f, customer_id: v }))}
                    options={[
                      { value: "", label: "-- Pilih Customer --" },
                      ...customers.map((c: any) => ({ value: String(c.id), label: c.name }))
                    ]}
                    onCreateClick={(typedText) => openQuickCust(typedText)}
                  />
                </div>
                <button 
                  type="button"
                  className="btn btn-secondary" 
                  style={{ padding: "0 10px", height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}
                  onClick={() => openQuickCust("")}
                  title="Tambah Kontak Baru"
                >
                  <Plus size={14} />
                </button>
              </div>
            </FormField>
            {userRole !== "CS / Sales" && (
              <FormField label="PIC CS">
                <SearchableSelect 
                  value={form.pic_id} 
                  onChange={v => setForm((f: any) => ({ ...f, pic_id: v }))}
                  options={[
                    { value: "", label: "-- Pilih CS --" },
                    ...users.filter((u: any) => u.role === "CS / Sales").map((u: any) => ({ value: String(u.id), label: u.name }))
                  ]}
                />
              </FormField>
            )}
          </FormRow>

          <FormRow>
            <FormField label="Tanggal Order">
              <input type="date" value={form.order_date} onChange={e => setForm((f: any) => ({ ...f, order_date: e.target.value }))} />
            </FormField>
            <FormField label="Tanggal Kirim">
              <input type="date" value={form.delivery_date} onChange={e => setForm((f: any) => ({ ...f, delivery_date: e.target.value }))} />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Jam Berangkat">
              <input type="time" step="1" value={form.departure_time} onChange={e => setForm((f: any) => ({ ...f, departure_time: e.target.value }))} />
            </FormField>
            <FormField label="Jam Sampai Lokasi (Arrival)">
              <input type="time" step="1" value={form.arrival_time} onChange={e => setForm((f: any) => ({ ...f, arrival_time: e.target.value }))} />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Status Order">
              <SearchableSelect 
                value={form.status_order} 
                onChange={v => setForm((f: any) => ({ ...f, status_order: v }))}
                options={STATUS_ORDER.map(s => ({ value: s, label: s }))}
              />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label="Biaya Ongkir (Rp)">
              <input type="number" value={form.shipping_fee || ""} onChange={e => setForm((f: any) => ({ ...f, shipping_fee: Number(e.target.value) }))} placeholder="0" />
            </FormField>
            <FormField label="Tambahan Harga Menu (Rp)">
              <input type="number" value={form.additional_menu_price || ""} onChange={e => setForm((f: any) => ({ ...f, additional_menu_price: Number(e.target.value) }))} placeholder="0" />
            </FormField>
          </FormRow>

          <FormField label="Venue / Lokasi" style={{ marginBottom: 14 }}>
            <input value={form.venue} onChange={e => setForm((f: any) => ({ ...f, venue: e.target.value }))} placeholder="Nama gedung, alamat lengkap pengiriman..." />
          </FormField>

          <FormField label="Catatan Tambahan">
            <textarea rows={2} value={form.order_notes} onChange={e => setForm((f: any) => ({ ...f, order_notes: e.target.value }))} placeholder="Catatan khusus porsi, alergi, request warna box, dll." />
          </FormField>
        </div>

        {/* Card 2: Detail Paket & Menu Kustom */}
        <div className="erp-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: 8, marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#374151", margin: 0 }}>
              Daftar Paket & Rincian Lauk
            </h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setForm((f: any) => ({ ...f, items: [...f.items, emptyItem()] }))}>
              <Plus size={11} /> Tambah Paket
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {form.items.map((item: any, idx: number) => (
              <div key={idx} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, background: "#f9fafb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12, alignItems: "flex-end" }}>
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>Pilih Paket Produk</label>
                    <SearchableSelect 
                      value={item.product_id} 
                      onChange={v => updateItem(idx, "product_id", v)}
                      options={[
                        { value: "", label: "-- Pilih Paket Produk --" },
                        ...products.map((p: any) => ({ value: String(p.id), label: p.name }))
                      ]}
                    />
                  </div>
                  
                  <div style={{ width: 80 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>Quantity</label>
                    <input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value))} />
                  </div>

                  <div style={{ width: 130 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>Harga Satuan (Rp)</label>
                    <input type="number" value={item.price} onChange={e => updateItem(idx, "price", Number(e.target.value))} />
                  </div>

                  <div style={{ width: 110 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>Potongan (Rp)</label>
                    <input type="number" value={item.discount} onChange={e => updateItem(idx, "discount", Number(e.target.value))} />
                  </div>

                  <div style={{ minWidth: 100, textAlign: "right" }}>
                    <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Subtotal</label>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#5005A6" }}>{fmt(item.subtotal)}</span>
                  </div>

                  <div>
                    {form.items.length > 1 && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setForm((f: any) => ({ ...f, items: f.items.filter((_: any, i: number) => i !== idx) }))} style={{ height: 35, padding: "0 10px" }} title="Hapus Paket">
                        <Trash2 size={13} color="#E24B4A" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", marginBottom: 4, display: "block" }}>
                    Rincian Lauk / Menu Custom (Tampil di Lembar Konfirmasi)
                  </label>
                  <textarea 
                    rows={4} 
                    value={item.custom_menu} 
                    onChange={e => updateItem(idx, "custom_menu", e.target.value)} 
                    placeholder={"Masukkan lauk pauk dipisah baris baru, contoh:\n1. NASI PUTIH\n2. AYAM SERUNDENG (pot.8)\n3. CAH TAHU BUNCIS\n4. PERKEDEL JAGUNG"} 
                    style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.4 }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Grand Total Bar */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, borderTop: "1px solid #e5e7eb", marginTop: 16, paddingTop: 16 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#4b5563" }}>TOTAL NILAI ORDER:</span>
            <span style={{ fontWeight: 800, color: "#5005A6", fontSize: 18 }}>{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Quick Customer Modal */}
      <Modal show={showQuickCust} onClose={() => setShowQuickCust(false)} title="Tambah Kontak Cepat">
        <FormRow>
          <FormField label="Nama *">
            <input value={quickCustForm.name} onChange={(e) => setQuickCustForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama / kode customer" />
          </FormField>
          <FormField label="No. Telepon / WA">
            <input value={quickCustForm.phone} onChange={(e) => setQuickCustForm((f) => ({ ...f, phone: e.target.value }))} placeholder="08xx..." />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="Tipe Customer">
            <SearchableSelect 
              value={quickCustForm.type} onChange={v => setQuickCustForm((f) => ({ ...f, type: v }))}
              options={["Perorangan", "Corporate", "Instansi"].map(t => ({ value: t, label: t }))}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
          <FormField label="Email">
            <input type="email" value={quickCustForm.email} onChange={(e) => setQuickCustForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@domain.com" />
          </FormField>
        </FormRow>
        <FormField label="Alamat" style={{ marginBottom: 14 }}>
          <input value={quickCustForm.address} onChange={(e) => setQuickCustForm((f) => ({ ...f, address: e.target.value }))} placeholder="Alamat lengkap" />
        </FormField>
        <FormField label="Catatan" style={{ marginBottom: 14 }}>
          <textarea rows={2} value={quickCustForm.notes} onChange={(e) => setQuickCustForm((f) => ({ ...f, notes: e.target.value }))} />
        </FormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={() => setShowQuickCust(false)}>Batal</button>
          <button className="btn btn-primary" onClick={handleSaveQuickCust}>Simpan</button>
        </div>
      </Modal>
    </div>
  );
}
