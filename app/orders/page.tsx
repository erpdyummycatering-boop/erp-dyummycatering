"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Printer, Trash2, Download, Eye, FileText, Upload } from "lucide-react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PageHeader, FormRow, FormField } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { fmt, statusBadgeColor } from "@/lib/utils";
import { exportToExcel } from "@/lib/export";
import * as XLSX from "xlsx";

const STATUS_ORDER = ["Baru", "Diproses", "Selesai", "Batal"];
const STATUS_PAY = ["Belum Lunas", "DP 50%", "Lunas"];

const emptyItem = () => ({ product_id: "", product_name: "", price: 0, quantity: 50, discount: 0, subtotal: 0, custom_menu: "", notes: "" });
const emptyForm = (userRole?: string, userId?: string) => ({
  customer_id: "",
  customer_name: "",
  customer_phone: "",
  pic_id: userRole === "CS / Sales" ? String(userId) : "",
  order_date: new Date().toISOString().split("T")[0],
  delivery_date: "",
  departure_time: "",
  arrival_time: "",
  shipping_fee: 0,
  additional_menu_price: 0,
  venue: "",
  order_notes: "",
  status_payment: "Belum Lunas",
  items: [emptyItem()]
});

export default function OrdersPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [customers, setCustomers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [form, setForm] = useState(() => emptyForm(userRole, userId));

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
      setForm((f) => ({ ...f, customer_id: newCust.id }));
      setShowQuickCust(false);
    } else {
      const err = await res.json();
      alert("Gagal menambahkan kontak: " + (err.error || "Unknown error"));
    }
  };

  useEffect(() => {
    if (userRole === "CS / Sales" && !form.pic_id) {
      setForm(f => ({ ...f, pic_id: String(userId) }));
    }
  }, [userRole, userId, form.pic_id]);
  const [fStatus, setFStatus] = useState("");
  const [fPay, setFPay] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const [previewOrders, setPreviewOrders] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);

  const downloadTemplate = () => {
    const html = `
      <table>
        <thead>
          <tr>
            <th style="background-color: #3b047a; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Nama Customer</th>
            <th style="background-color: #3b047a; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">No. Telepon</th>
            <th style="background-color: #3b047a; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Tipe Customer</th>
            <th style="background-color: #3b047a; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Nama CS / PIC</th>
            <th style="background-color: #3b047a; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Tanggal Order</th>
            <th style="background-color: #3b047a; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Tanggal Kirim</th>
            <th style="background-color: #3b047a; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Jam Keberangkatan</th>
            <th style="background-color: #3b047a; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Jam Tiba</th>
            <th style="background-color: #3b047a; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Venue / Lokasi</th>
            <th style="background-color: #3b047a; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Catatan Order</th>
            <th style="background-color: #3b047a; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Status Order</th>
            <th style="background-color: #3b047a; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Status Pembayaran</th>
            <th style="background-color: #3b047a; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Grand Total</th>
            
            <th style="background-color: #378ADD; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Item 1: Produk</th>
            <th style="background-color: #378ADD; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Item 1: Kuantitas</th>
            <th style="background-color: #378ADD; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Item 1: Harga Satuan</th>
            <th style="background-color: #378ADD; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Item 1: Catatan</th>
            <th style="background-color: #378ADD; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Item 1: Lauk Custom</th>
            
            <th style="background-color: #639922; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Item 2: Produk</th>
            <th style="background-color: #639922; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Item 2: Kuantitas</th>
            <th style="background-color: #639922; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Item 2: Harga Satuan</th>
            <th style="background-color: #639922; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Item 2: Catatan</th>
            <th style="background-color: #639922; color: #ffffff; font-weight: bold; border: 1px solid #ddd;">Item 2: Lauk Custom</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #ddd;">Ahmad Yani</td>
            <td style="border: 1px solid #ddd;">08123456789</td>
            <td style="border: 1px solid #ddd;">Personal</td>
            <td style="border: 1px solid #ddd;">Siti Rahayu</td>
            <td style="border: 1px solid #ddd;">2026-05-27</td>
            <td style="border: 1px solid #ddd;">2026-05-30</td>
            <td style="border: 1px solid #ddd;">09:00:00</td>
            <td style="border: 1px solid #ddd;">10:00:00</td>
            <td style="border: 1px solid #ddd;">Aula Masjid Agung</td>
            <td style="border: 1px solid #ddd;">Minta sambal dipisah</td>
            <td style="border: 1px solid #ddd;">Draft</td>
            <td style="border: 1px solid #ddd;">Belum Lunas</td>
            <td style="border: 1px solid #ddd;">300000</td>
            <td style="border: 1px solid #ddd;">Paket Spesial Ayam</td>
            <td style="border: 1px solid #ddd;">10</td>
            <td style="border: 1px solid #ddd;">30000</td>
            <td style="border: 1px solid #ddd;">Level pedas sedang</td>
            <td style="border: 1px solid #ddd;">1. NASI PUTIH&#10;2. AYAM BAKAR MADU&#10;3. CAH TAHU BUNCIS</td>
            <td style="border: 1px solid #ddd;"></td>
            <td style="border: 1px solid #ddd;"></td>
            <td style="border: 1px solid #ddd;"></td>
            <td style="border: 1px solid #ddd;"></td>
            <td style="border: 1px solid #ddd;"></td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd;">Budi Santoso</td>
            <td style="border: 1px solid #ddd;">08771234567</td>
            <td style="border: 1px solid #ddd;">Corporate</td>
            <td style="border: 1px solid #ddd;">Rina Marlina</td>
            <td style="border: 1px solid #ddd;">2026-05-27</td>
            <td style="border: 1px solid #ddd;">2026-05-31</td>
            <td style="border: 1px solid #ddd;">11:00:00</td>
            <td style="border: 1px solid #ddd;">12:00:00</td>
            <td style="border: 1px solid #ddd;">Kantor BNI Sudirman</td>
            <td style="border: 1px solid #ddd;">Acara Rapat Direksi</td>
            <td style="border: 1px solid #ddd;">Dikonfirmasi</td>
            <td style="border: 1px solid #ddd;">DP 50%</td>
            <td style="border: 1px solid #ddd;">2100000</td>
            <td style="border: 1px solid #ddd;">Paket Spesial Sapi</td>
            <td style="border: 1px solid #ddd;">20</td>
            <td style="border: 1px solid #ddd;">75000</td>
            <td style="border: 1px solid #ddd;">Sendok & garpu disediakan</td>
            <td style="border: 1px solid #ddd;">1. NASI PUTIH&#10;2. SAPI LADA HITAM (VIP)&#10;3. SOUP KIMLO (VIP)</td>
            <td style="border: 1px solid #ddd;">Paket Spesial Ayam</td>
            <td style="border: 1px solid #ddd;">20</td>
            <td style="border: 1px solid #ddd;">30000</td>
            <td style="border: 1px solid #ddd;">Box premium warna putih</td>
            <td style="border: 1px solid #ddd;">1. NASI PUTIH&#10;2. AYAM BAKAR MADU&#10;3. CAH TAHU BUNCIS</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd;">Citra Lestari</td>
            <td style="border: 1px solid #ddd;">08529876543</td>
            <td style="border: 1px solid #ddd;">Personal</td>
            <td style="border: 1px solid #ddd;"></td>
            <td style="border: 1px solid #ddd;">2026-05-20</td>
            <td style="border: 1px solid #ddd;">2026-05-25</td>
            <td style="border: 1px solid #ddd;">13:00:00</td>
            <td style="border: 1px solid #ddd;">14:00:00</td>
            <td style="border: 1px solid #ddd;">RPTRA Meruya</td>
            <td style="border: 1px solid #ddd;">Ulang tahun anak</td>
            <td style="border: 1px solid #ddd;">Selesai</td>
            <td style="border: 1px solid #ddd;">Lunas</td>
            <td style="border: 1px solid #ddd;">600000</td>
            <td style="border: 1px solid #ddd;">Paket Spesial Ayam</td>
            <td style="border: 1px solid #ddd;">20</td>
            <td style="border: 1px solid #ddd;">30000</td>
            <td style="border: 1px solid #ddd;">Bonus stiker Ultah</td>
            <td style="border: 1px solid #ddd;">1. NASI PUTIH&#10;2. AYAM BAKAR MADU&#10;3. TELUR BALADO</td>
            <td style="border: 1px solid #ddd;"></td>
            <td style="border: 1px solid #ddd;"></td>
            <td style="border: 1px solid #ddd;"></td>
            <td style="border: 1px solid #ddd;"></td>
            <td style="border: 1px solid #ddd;"></td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd;">Dewa Gede</td>
            <td style="border: 1px solid #ddd;">08998877665</td>
            <td style="border: 1px solid #ddd;">Personal</td>
            <td style="border: 1px solid #ddd;"></td>
            <td style="border: 1px solid #ddd;">2026-05-22</td>
            <td style="border: 1px solid #ddd;">2026-05-28</td>
            <td style="border: 1px solid #ddd;">08:00:00</td>
            <td style="border: 1px solid #ddd;">09:00:00</td>
            <td style="border: 1px solid #ddd;">Hotel Mulia</td>
            <td style="border: 1px solid #ddd;">Dibatalkan sepihak</td>
            <td style="border: 1px solid #ddd;">Batal</td>
            <td style="border: 1px solid #ddd;">Belum Lunas</td>
            <td style="border: 1px solid #ddd;">0</td>
            <td style="border: 1px solid #ddd;">Paket Spesial Ayam</td>
            <td style="border: 1px solid #ddd;">0</td>
            <td style="border: 1px solid #ddd;">30000</td>
            <td style="border: 1px solid #ddd;">Cancel</td>
            <td style="border: 1px solid #ddd;"></td>
            <td style="border: 1px solid #ddd;"></td>
            <td style="border: 1px solid #ddd;"></td>
            <td style="border: 1px solid #ddd;"></td>
            <td style="border: 1px solid #ddd;"></td>
          </tr>
        </tbody>
      </table>
    `;
    const el = document.createElement("div");
    el.innerHTML = html;
    const table = el.querySelector("table");
    const ws = XLSX.utils.table_to_sheet(table);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Order");

    // Generate array buffer
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "Template_Upload_Order.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (rows.length < 2) {
          alert("File Excel kosong atau tidak memiliki data");
          return;
        }

        const parsedOrders: any[] = [];

        const parseExcelDate = (val: any) => {
          if (!val) return "";
          if (typeof val === "number") {
            const date = new Date((val - 25569) * 86400 * 1000);
            return date.toISOString().slice(0, 10);
          }
          if (typeof val === "string") {
            const m = val.match(/^\d{4}-\d{2}-\d{2}/);
            if (m) return m[0];
          }
          return String(val);
        };

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || row.length === 0 || !row[0]) continue;

          const customer_name = String(row[0] || "").trim();
          const customer_phone = row[1] ? String(row[1]).trim() : "";
          const customer_type = row[2] ? String(row[2]).trim() : "Personal";
          const pic_name = row[3] ? String(row[3]).trim() : "";
          const order_date = parseExcelDate(row[4]);
          const delivery_date = parseExcelDate(row[5]);
          const departure_time = row[6] ? String(row[6]).trim() : "";
          const arrival_time = row[7] ? String(row[7]).trim() : "";
          const venue = row[8] ? String(row[8]).trim() : "";
          const order_notes = row[9] ? String(row[9]).trim() : "";
          const status_order = row[10] ? String(row[10]).trim() : "Baru";
          const status_payment = row[11] ? String(row[11]).trim() : "Belum Lunas";
          const grand_total = row[12] ? Number(row[12]) : 0;

          const items: any[] = [];
          for (let itemIdx = 0; itemIdx < 10; itemIdx++) {
            const startOffset = 13 + itemIdx * 5;
            if (startOffset >= row.length) break;

            const product_name = row[startOffset] ? String(row[startOffset]).trim() : "";
            if (!product_name) continue;

            const quantity = row[startOffset + 1] ? Number(row[startOffset + 1]) : 1;
            const price = row[startOffset + 2] ? Number(row[startOffset + 2]) : 0;
            const notes = row[startOffset + 3] ? String(row[startOffset + 3]).trim() : "";
            const custom_menu = row[startOffset + 4] ? String(row[startOffset + 4]).trim() : "";

            items.push({
              product_name,
              quantity,
              price,
              notes,
              custom_menu
            });
          }

          parsedOrders.push({
            customer_name,
            customer_phone,
            customer_type,
            pic_name,
            order_date,
            delivery_date,
            departure_time,
            arrival_time,
            venue,
            order_notes,
            status_order,
            status_payment,
            grand_total,
            items
          });
        }

        if (parsedOrders.length === 0) {
          alert("Tidak ada baris data order valid yang bisa dibaca");
          return;
        }

        setPreviewOrders(parsedOrders);
        setShowPreview(true);
      } catch (err) {
        console.error(err);
        alert("Gagal membaca file Excel. Pastikan format file sesuai.");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const buildQs = useCallback((page = 1, lim = meta.limit) => {
    const p = new URLSearchParams({ page: String(page), limit: String(lim) });
    if (search) p.set("search", search);
    if (fStatus) p.set("status_order", fStatus);
    if (fPay) p.set("status_payment", fPay);
    if (userRole === "CS / Sales") {
      p.set("pic_id", String(userId));
    }
    if (fDateFrom) p.set("date_from", fDateFrom);
    if (fDateTo) p.set("date_to", fDateTo);
    return p.toString();
  }, [search, fStatus, fPay, fDateFrom, fDateTo, userRole, userId, meta.limit]);

  const fetchOrders = useCallback((page = 1, lim = meta.limit, signal?: AbortSignal) => {
    setLoading(true);
    fetch(`/api/orders?${buildQs(page, lim)}`, { signal })
      .then(r => r.json())
      .then(d => {
        setRows(d.data || []);
        setMeta({ total: d.total, page: d.page, limit: d.limit, totalPages: d.totalPages });
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          console.error(err);
        }
      })
      .finally(() => setLoading(false));
  }, [buildQs, meta.limit]);

  useEffect(() => {
    const controller = new AbortController();
    fetchOrders(1, meta.limit, controller.signal);
    return () => controller.abort();
  }, [fetchOrders]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/customers?limit=100", { signal: controller.signal })
      .then(r => r.json())
      .then(d => setCustomers(d.data || []))
      .catch(() => { });
    fetch("/api/users", { signal: controller.signal })
      .then(r => r.json())
      .then(setUsers)
      .catch(() => { });
    fetch("/api/products?limit=100", { signal: controller.signal })
      .then(r => r.json())
      .then(d => setProducts(d.data || []))
      .catch(() => { });
    return () => controller.abort();
  }, []);

  const totalRevenue = rows.reduce((s, o) => s + Number(o.grand_total || 0), 0);
  const activeCount = rows.filter(o => o.status_order !== "Selesai" && o.status_order !== "Batal").length;
  const unpaidCount = rows.filter(o => o.status_payment === "Belum Lunas").length;

  const updateItem = (idx: number, field: string, val: any) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: val };
    if (field === "product_id") {
      const p = products.find((p: any) => String(p.id) === String(val));
      if (p) {
        items[idx].price = Number(p.price);
        items[idx].product_name = p.name;
        items[idx].custom_menu = "";
      }
    }
    items[idx].subtotal = Number(items[idx].price) * Number(items[idx].quantity) - Number(items[idx].discount || 0);
    setForm(f => ({ ...f, items }));
  };

  const grandTotal = form.items.reduce((s, i) => s + (i.subtotal || 0), 0) + Number(form.shipping_fee || 0) + Number(form.additional_menu_price || 0);

  const handleSave = async () => {
    if (!form.customer_id || !form.delivery_date) return alert("Customer dan tanggal kirim wajib");
    if (form.customer_id === "new" && !form.customer_name) return alert("Nama customer baru wajib diisi");
    if (!form.items.some(i => i.product_id)) return alert("Minimal 1 item produk");
    const validItems = form.items.filter(i => i.product_id);

    const finalForm = { ...form };
    if (userRole === "CS / Sales") {
      finalForm.pic_id = String(userId);
    }

    try {
      const res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...finalForm, items: validItems }) });
      if (res.ok) { 
        setShowModal(false); 
        setForm(emptyForm(userRole, userId)); 
        fetchOrders(1); 
        fetch("/api/customers?limit=100").then(r => r.json()).then(d => setCustomers(d.data || []));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Gagal menyimpan order.");
      }
    } catch (e) {
      alert("Terjadi kesalahan saat menyimpan order.");
    }
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(`/api/orders/${itemToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setItemToDelete(null);
        fetchOrders(meta.page);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Gagal menghapus order.");
      }
    } catch (e) {
      alert("Terjadi kesalahan saat menghapus order.");
    }
  };

  const handleExport = async () => {
    const p = new URLSearchParams({ page: "1", limit: "1000" });
    if (search) p.set("search", search);
    if (fStatus) p.set("status_order", fStatus);
    if (fPay) p.set("status_payment", fPay);
    if (userRole === "CS / Sales") {
      p.set("pic_id", String(userId));
    }
    if (fDateFrom) p.set("date_from", fDateFrom);
    if (fDateTo) p.set("date_to", fDateTo);
    const res = await fetch(`/api/orders?${p}`);
    const d = await res.json();
    exportToExcel(d.data || [], "Data_Orders");
  };

  return (
    <div>
      <PageHeader title="Rekap Order" subtitle={`${meta.total} total order`}
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-secondary btn-sm" onClick={downloadTemplate} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              📥 Template Excel
            </button>
            <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, margin: 0 }}>
              📤 Upload Excel
              <input
                id="excel-upload-input"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleExcelUpload}
                style={{ display: "none" }}
              />
            </label>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={14} /> Export Excel</button>
            <button className="btn btn-primary" onClick={() => { setForm(emptyForm(userRole, userId)); setShowModal(true); }}><Plus size={14} /> Buat Order</button>
          </div>
        }
      />

      {/* Summary mini cards */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { label: "Total Nilai (halaman ini)", val: fmt(totalRevenue), color: "#5005A6" },
          { label: "Order Aktif", val: activeCount, color: "#378ADD" },
          { label: "Belum Lunas", val: unpaidCount, color: "#E24B4A" },
        ].map(c => (
          <div key={c.label} style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: 10, padding: "8px 16px", display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
            <p style={{ fontSize: 12, color: "#6b7280" }}>{c.label}:</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="erp-card" style={{ marginBottom: 12, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="🔍 Customer / venue..." style={{ width: 200 }} />
          <SearchableSelect
            value={fStatus} onChange={setFStatus}
            options={[{ value: "", label: "Semua Status Order" }, ...STATUS_ORDER.map(s => ({ value: s, label: s }))]}
            style={{ width: 160 }}
          />
          <SearchableSelect
            value={fPay} onChange={setFPay}
            options={[{ value: "", label: "Semua Pembayaran" }, ...STATUS_PAY.map(s => ({ value: s, label: s }))]}
            style={{ width: 160 }}
          />
          <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} style={{ width: 140 }} title="Kirim dari" />
          <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} style={{ width: 140 }} title="Kirim sampai" />
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearchInput(""); setSearch(""); setFStatus(""); setFPay(""); setFDateFrom(""); setFDateTo(""); }}>Reset</button>
        </div>
      </div>

      <div className="erp-card-flush">
        {loading ? <p style={{ padding: 24, color: "#6b7280", fontSize: 13 }}>Memuat...</p> : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr><th>No.</th><th>No. Order</th><th>Customer</th><th>PIC CS</th><th>Tgl Kirim</th><th>Tgl Closing</th><th>Jenis</th><th>Item</th><th>Total</th><th>Status</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={11} style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>Tidak ada order</td></tr>
                  ) : rows.map((o: any, idx: number) => (
                    <tr key={o.id}>
                      <td style={{ fontSize: 12, color: "#6b7280" }}>{(meta.page - 1) * meta.limit + idx + 1}</td>
                      <td style={{ fontWeight: 700, color: "#5005A6", fontSize: 12 }}>ORD-{String(o.id).padStart(3, "0")}</td>
                      <td style={{ fontWeight: 500 }}>{o.customer_name}</td>
                      <td style={{ fontSize: 12, color: "#6b7280" }}>{o.pic_name || "-"}</td>
                      <td style={{ fontSize: 12 }}>{String(o.delivery_date || "").slice(0, 10)}</td>
                      <td style={{ fontSize: 12 }}>{o.closing_date ? String(o.closing_date).slice(0, 10) : "-"}</td>
                      <td style={{ fontSize: 12 }}>
                        {o.jenis_order ? (
                          <Badge color={o.jenis_order === "New Order" ? "green" : "purple"}>
                            {o.jenis_order}
                          </Badge>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>-</span>
                        )}
                      </td>
                      <td style={{ fontSize: 11, color: "#6b7280" }}>{(o.items || []).length} item</td>
                      <td style={{ fontWeight: 700, color: "#5005A6" }}>{fmt(o.grand_total)}</td>
                      <td><Badge color={statusBadgeColor(o.status_order)}>{o.status_order}</Badge></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Link href={`/orders/${o.id}`}>
                            <button className="btn btn-secondary btn-sm" title="Detail / Edit">
                              <Eye size={11} /> Edit
                            </button>
                          </Link>
                          <button className="btn btn-secondary btn-sm" onClick={() => window.open(`/print/konfirmasi/${o.id}`, "_blank")} title="Konfirmasi PDF">
                            <FileText size={11} /> Konfirmasi
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setItemToDelete(o)} title="Hapus">
                            <Trash2 size={11} color="#E24B4A" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit}
              onChange={(p) => fetchOrders(p, meta.limit)}
              onLimitChange={(lim) => fetchOrders(1, lim)}
            />
          </>
        )}
      </div>

      {/* Create Order Modal */}
      <Modal show={showModal} onClose={() => setShowModal(false)} title="Buat Order Baru" width={1050}>
        <FormRow>
          <FormField label="Customer">
            <div style={{ display: "flex", gap: 6, width: "100%" }}>
              <div style={{ flex: 1 }}>
                <SearchableSelect
                  value={form.customer_id} onChange={v => setForm(f => ({ ...f, customer_id: v }))}
                  options={[
                    { value: "", label: "-- Pilih Customer --" },
                    { value: "new", label: "+ Tambah Baru (via WA)", color: "#5005A6", isBold: true },
                    ...customers.map((c: any) => ({ value: c.id, label: c.name }))
                  ]}
                  onCreateClick={(typedText) => openQuickCust(typedText)}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
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
                value={form.pic_id} onChange={v => setForm(f => ({ ...f, pic_id: v }))}
                options={[
                  { value: "", label: "-- Pilih CS --" },
                  ...users.filter((u: any) => u.role === "CS / Sales").map((u: any) => ({ value: u.id, label: u.name }))
                ]}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              />
            </FormField>
          )}
        </FormRow>

        {form.customer_id === "new" && (
          <FormRow>
            <FormField label="Nama Customer Baru">
              <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Nama Lengkap / Instansi" />
            </FormField>
            <FormField label="Nomor WhatsApp">
              <input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} placeholder="08123456789" />
            </FormField>
          </FormRow>
        )}
        <FormRow>
          <FormField label="Tanggal Order"><input type="date" value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} /></FormField>
          <FormField label="Tanggal Kirim"><input type="date" value={form.delivery_date} onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))} /></FormField>
        </FormRow>
        <FormRow>
          <FormField label="Jam Berangkat"><input type="time" value={form.departure_time} onChange={e => setForm(f => ({ ...f, departure_time: e.target.value }))} /></FormField>
          <FormField label="Jam Tiba (Arrival)"><input type="time" value={form.arrival_time || ""} onChange={e => setForm(f => ({ ...f, arrival_time: e.target.value }))} /></FormField>
        </FormRow>
        <FormRow>
          <FormField label="Biaya Ongkir (Rp)"><input type="number" value={form.shipping_fee || ""} onChange={e => setForm(f => ({ ...f, shipping_fee: Number(e.target.value) }))} placeholder="0" /></FormField>
          <FormField label="Tambahan Harga Menu (Rp)"><input type="number" value={form.additional_menu_price || ""} onChange={e => setForm(f => ({ ...f, additional_menu_price: Number(e.target.value) }))} placeholder="0" /></FormField>
        </FormRow>
        <FormField label="Venue / Lokasi" style={{ marginBottom: 14 }}>
          <input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} placeholder="Gedung, alamat lengkap..." />
        </FormField>

        {/* Multi-Item Table */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700 }}>Item Pesanan</p>
            <button className="btn btn-secondary btn-sm" onClick={() => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }))}>+ Tambah Baris</button>
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "x-auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 12 }}>Paket</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 12 }}>Menu (Rincian)</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 12 }}>Harga</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontSize: 12 }}>Jumlah</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 12 }}>Diskon</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 12 }}>Total</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 12 }}>Catatan</th>
                  <th style={{ padding: "8px 12px", width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ verticalAlign: "top", padding: "8px" }}>
                      <SearchableSelect
                        value={item.product_id} onChange={v => updateItem(idx, "product_id", v)}
                        options={[
                          { value: "", label: "-- Pilih Paket --" },
                          ...products.map((p: any) => ({ value: p.id, label: p.name, category: p.category }))
                        ]}
                        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                        style={{ minWidth: 150 }}
                      />
                    </td>
                    <td style={{ verticalAlign: "top", padding: "8px" }}>
                      <textarea
                        value={item.custom_menu || ""}
                        onChange={e => updateItem(idx, "custom_menu", e.target.value)}
                        placeholder="Rincian lauk..."
                        style={{ width: "100%", minWidth: "150px", height: "70px", fontSize: "11px", fontFamily: "monospace", padding: "4px", border: "1px solid #d1d5db", borderRadius: "4px" }}
                      />
                    </td>
                    <td style={{ verticalAlign: "top", padding: "8px" }}>
                      <input
                        type="number"
                        value={item.price}
                        onChange={e => updateItem(idx, "price", Number(e.target.value))}
                        style={{ width: "90px", padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: "4px" }}
                      />
                    </td>
                    <td style={{ verticalAlign: "top", padding: "8px" }}>
                      <input
                        type="number"
                        value={item.quantity}
                        min={1}
                        onChange={e => updateItem(idx, "quantity", Number(e.target.value))}
                        style={{ width: "70px", padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: "4px", textAlign: "center" }}
                      />
                    </td>
                    <td style={{ verticalAlign: "top", padding: "8px" }}>
                      <input
                        type="number"
                        value={item.discount}
                        onChange={e => updateItem(idx, "discount", Number(e.target.value))}
                        style={{ width: "80px", padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: "4px" }}
                      />
                    </td>
                    <td style={{ verticalAlign: "top", padding: "12px 8px", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap", textAlign: "right" }}>
                      {fmt(item.subtotal)}
                    </td>
                    <td style={{ verticalAlign: "top", padding: "8px" }}>
                      <input
                        type="text"
                        value={item.notes || ""}
                        onChange={e => updateItem(idx, "notes", e.target.value)}
                        placeholder="Catatan..."
                        style={{ width: "120px", padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: "4px" }}
                      />
                    </td>
                    <td style={{ verticalAlign: "top", padding: "8px", textAlign: "center" }}>
                      {form.items.length > 1 && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} style={{ padding: "6px" }}>
                          <Trash2 size={12} color="#E24B4A" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: "#f9fafb" }}>
                  <td colSpan={5} style={{ fontWeight: 700, fontSize: 13, textAlign: "right", padding: "12px 16px" }}>GRAND TOTAL</td>
                  <td style={{ fontWeight: 700, color: "#5005A6", fontSize: 15, textAlign: "right", padding: "12px 8px" }}>{fmt(grandTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <FormField label="Catatan Order" style={{ marginBottom: 14 }}>
          <textarea rows={2} value={form.order_notes} onChange={e => setForm(f => ({ ...f, order_notes: e.target.value }))} />
        </FormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
          <button className="btn btn-primary" onClick={handleSave}>Simpan Order</button>
        </div>
      </Modal>

      <ConfirmModal
        show={!!itemToDelete}
        title="Hapus Order"
        message={`Yakin ingin menghapus pesanan ORD-${String(itemToDelete?.id || "").padStart(3, "0")} dari ${itemToDelete?.customer_name}? Data yang dihapus tidak dapat dikembalikan.`}
        onConfirm={executeDelete}
        onCancel={() => setItemToDelete(null)}
      />

      {/* Excel Preview Modal */}
      <Modal show={showPreview} onClose={() => setShowPreview(false)} title="Preview Import Order (Excel)" width={1200}>
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13, color: "#4b5563", margin: 0 }}>
            Berikut adalah data order hasil pembacaan file Excel. Silakan periksa status deteksi customer dan kecocokan katalog produk sebelum melakukan konfirmasi penyimpanan.
          </p>
        </div>

        <div style={{ overflowX: "auto", maxHeight: 450, border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 16 }}>
          <table style={{ minWidth: 1000 }}>
            <thead style={{ backgroundColor: "#f9fafb", position: "sticky", top: 0 }}>
              <tr>
                <th>Customer</th>
                <th>Tgl Order & Kirim</th>
                <th>Venue & Catatan</th>
                <th>Status Order/Bayar</th>
                <th>Items (Lauk Custom)</th>
                <th style={{ textAlign: "right" }}>Total Nilai</th>
              </tr>
            </thead>
            <tbody>
              {previewOrders.map((o, idx) => {
                const isNewCustomer = !customers.some(
                  c => c.name.toLowerCase() === o.customer_name.toLowerCase()
                );
                return (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.customer_name}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        {o.customer_phone} &middot; {o.customer_type}
                      </div>
                      {o.pic_name && (
                        <div style={{ fontSize: 11, color: "#5005A6", marginTop: 2 }}>
                          CS/PIC: <span style={{ fontWeight: 600 }}>{o.pic_name}</span>
                        </div>
                      )}
                      <div style={{ marginTop: 4 }}>
                        {isNewCustomer ? (
                          <Badge color="yellow">Customer Baru</Badge>
                        ) : (
                          <Badge color="green">Customer Terdaftar</Badge>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>Order: {o.order_date || "-"}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#5005A6" }}>
                        Kirim: {o.delivery_date || "-"}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        {o.departure_time || o.arrival_time ? `${o.departure_time} - ${o.arrival_time}` : ""}
                      </div>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <div><strong>Venue:</strong> {o.venue || "-"}</div>
                      <div style={{ fontSize: 11, color: "#6b7280", fontStyle: "italic" }}>
                        Notes: {o.order_notes || "-"}
                      </div>
                    </td>
                    <td>
                      <div style={{ marginBottom: 4 }}>
                        <Badge color={statusBadgeColor(o.status_order)}>{o.status_order}</Badge>
                      </div>
                      <div>
                        <Badge color={statusBadgeColor(o.status_payment)}>{o.status_payment}</Badge>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {o.items.map((it: any, iIdx: number) => {
                          const isProductValid = products.some(
                            p => p.name.toLowerCase() === it.product_name.toLowerCase()
                          );
                          return (
                            <div key={iIdx} style={{ fontSize: 11, padding: 6, backgroundColor: "#f3f4f6", borderRadius: 4 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                                <span style={{ color: isProductValid ? "#111827" : "#E24B4A" }}>
                                  {it.product_name} {!isProductValid && " (⚠ Produk Tidak Terdaftar)"}
                                </span>
                                <span>{it.quantity} x {fmt(it.price)}</span>
                              </div>
                              {it.custom_menu && (
                                <div style={{ fontSize: 10, color: "#4b5563", marginTop: 2, whiteSpace: "pre-line", fontFamily: "monospace" }}>
                                  {it.custom_menu}
                                </div>
                              )}
                              {it.notes && (
                                <div style={{ fontSize: 10, color: "#854d0e", marginTop: 2 }}>
                                  Note: {it.notes}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#5005A6" }}>
                      {fmt(o.grand_total || o.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={() => setShowPreview(false)} disabled={importing}>
            Batal
          </button>
          <button
            className="btn btn-primary"
            disabled={importing || previewOrders.some(o => o.items.some((it: any) => !products.some(p => p.name.toLowerCase() === it.product_name.toLowerCase())))}
            onClick={async () => {
              setImporting(true);
              try {
                const res = await fetch("/api/orders/import", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ orders: previewOrders })
                });
                if (res.ok) {
                  alert("✅ Berhasil mengimpor " + previewOrders.length + " order!");
                  setShowPreview(false);
                  fetchOrders(1);
                  fetch("/api/customers?limit=100").then(r => r.json()).then(d => setCustomers(d.data || []));
                } else {
                  const err = await res.json();
                  alert(err.error || "Gagal mengimpor order");
                }
              } catch (err) {
                alert("Terjadi kesalahan saat menyimpan data order");
              } finally {
                setImporting(false);
              }
            }}
          >
            {importing ? "Mengimpor..." : "Konfirmasi Simpan ke DB"}
          </button>
        </div>
      </Modal>

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
