"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  Printer,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Phone,
  MapPin,
  Building,
  CreditCard,
  Trash2,
  Eye,
  Copy,
  ChevronDown,
  RefreshCw,
  FileText,
  ClipboardList,
  Edit2,
} from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/Pagination";
import { formatDate, getWhatsAppUrl } from "@/lib/utils";
import { normalizePhoneNumber, isSamePhoneNumber, formatPhoneForDisplay } from "@/lib/phoneUtils";
import * as XLSX from "xlsx";

interface Product {
  id: number;
  sku: string;
  name: string;
  category_id: number;
  price: number;
  is_half_portion: boolean;
  parent_sku: string | null;
  channel_prices?: { channel_id: number; harga_override: number | null }[];
}

interface Driver {
  id: number;
  name: string;
  phone?: string;
  status: string;
}

interface Channel {
  id: number;
  name: string;
  harga_type: string;
}

interface Area {
  id: number;
  kecamatan: string;
  kota: string;
  shipping_zone: string;
}

interface KasBank {
  id: number;
  nama_rekening: string;
  no_rekening: string;
  nama_bank: string;
  is_payment_default: boolean;
}

interface OrderItemInput {
  product_id: number;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  discount: number;
  notes: string;
  is_half_portion: boolean;
}

interface DraftOrder {
  id: string;
  savedAt: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerPatokan: string;
  selectedAreaId: number | "";
  selectedChannelId: number | "";
  selectedBankId: number | "";
  orderDate: string;
  deliveryDate: string;
  shippingFee: number;
  discountType: "nominal" | "percent";
  discountValue: number;
  orderNotes: string;
  cartItems: OrderItemInput[];
}

interface Order {
  id: number;
  no_struk: string;
  order_date: string;
  delivery_date: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_patokan: string;
  area_kecamatan: string;
  area_kota: string;
  channel_name: string;
  shipping_fee: number;
  grand_total: number;
  payment_bank: string;
  payment_account: string;
  status_order: string;
  status_payment: string;
  shipping_status?: string;
  driver_name?: string;
  cancel_reason?: string;
  created_at: string;
  items?: any[];
}

export default function SiapSajiOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total_penjualan: 0, total_orders: 0, orders_today: 0 });

  // Helper today YYYY-MM-DD
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [productFilter, setProductFilter] = useState<number | "">("");
  const [filterProductSearchQuery, setFilterProductSearchQuery] = useState("");
  const [isFilterProductDropdownOpen, setIsFilterProductDropdownOpen] = useState(false);
  const [timeShortcut, setTimeShortcut] = useState<string>("today");
  const [dateFrom, setDateFrom] = useState(getTodayStr());
  const [dateTo, setDateTo] = useState(getTodayStr());

  const handleTimeShortcutChange = (val: string) => {
    setTimeShortcut(val);
    if (val === "today") {
      const today = getTodayStr();
      setDateFrom(today);
      setDateTo(today);
    } else if (val === "yesterday") {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toISOString().split("T")[0];
      setDateFrom(yestStr);
      setDateTo(yestStr);
    } else if (val === "week") {
      const now = new Date();
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diffToMonday));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setDateFrom(monday.toISOString().split("T")[0]);
      setDateTo(sunday.toISOString().split("T")[0]);
    } else if (val === "month") {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      setDateFrom(`${y}-${m}-01`);
      setDateTo(`${y}-${m}-${String(lastDay).padStart(2, "0")}`);
    } else if (val === "year") {
      const y = new Date().getFullYear();
      setDateFrom(`${y}-01-01`);
      setDateTo(`${y}-12-31`);
    } else if (val === "all") {
      setDateFrom("");
      setDateTo("");
    }
  };

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStruk, setSelectedStruk] = useState<Order | null>(null);
  const [cancelOrderTarget, setCancelOrderTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Bulk Print Selection State
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [bulkStrukOrders, setBulkStrukOrders] = useState<Order[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isLoadingBulk, setIsLoadingBulk] = useState(false);
  const [bulkPaperSize, setBulkPaperSize] = useState<"80mm" | "A4">("80mm");

  // Master Data state for Form Order
  const [masterChannels, setMasterChannels] = useState<Channel[]>([]);
  const [masterAreas, setMasterAreas] = useState<Area[]>([]);
  const [masterKasBank, setMasterKasBank] = useState<KasBank[]>([]);
  const [masterProducts, setMasterProducts] = useState<Product[]>([]);
  const [masterCustomers, setMasterCustomers] = useState<any[]>([]);
  const [masterDrivers, setMasterDrivers] = useState<Driver[]>([]);

  // Form Order State
  const [selectedChannelId, setSelectedChannelId] = useState<number | "">("");
  const [selectedDriverId, setSelectedDriverId] = useState<number | "">("");
  const [customerMode, setCustomerMode] = useState<"new" | "select">("new");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "new">("new");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isCustDropdownOpen, setIsCustDropdownOpen] = useState(false);
  const [duplicatePhoneCust, setDuplicatePhoneCust] = useState<any | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<number | "">("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPatokan, setCustomerPatokan] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"nominal" | "percent">("nominal");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [isShippingAuto, setIsShippingAuto] = useState(true);
  const [selectedBankId, setSelectedBankId] = useState<number | "">("");
  const [orderNotes, setOrderNotes] = useState("");
  const [cartItems, setCartItems] = useState<OrderItemInput[]>([]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [areaSearchQuery, setAreaSearchQuery] = useState("");
  const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false);

  // Edit Order State
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);

  // Multi-Draft Sales Order State & Engine
  const DRAFTS_KEY = "siap_saji_order_drafts_v2";
  const [drafts, setDrafts] = useState<DraftOrder[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Load drafts on mount
  useEffect(() => {
    try {
      const listRaw = localStorage.getItem(DRAFTS_KEY);
      let list: DraftOrder[] = listRaw ? JSON.parse(listRaw) : [];

      // Backward compatibility with legacy single draft key
      const legacy = localStorage.getItem("siap_saji_order_draft");
      if (legacy) {
        const p = JSON.parse(legacy);
        if (p && (p.customerName || p.customerPhone || (p.cartItems && p.cartItems.length > 0))) {
          const migrated: DraftOrder = {
            id: "draft_legacy_" + Date.now(),
            savedAt: p.savedAt || "Terbaru",
            customerName: p.customerName || "",
            customerPhone: p.customerPhone || "",
            customerAddress: p.customerAddress || "",
            customerPatokan: p.customerPatokan || "",
            selectedAreaId: p.selectedAreaId || "",
            selectedChannelId: p.selectedChannelId || "",
            selectedBankId: p.selectedBankId || "",
            orderDate: p.orderDate || getTodayStr(),
            deliveryDate: p.deliveryDate || getTodayStr(),
            shippingFee: p.shippingFee || 0,
            discountType: p.discountType || "nominal",
            discountValue: p.discountValue || 0,
            orderNotes: p.orderNotes || "",
            cartItems: p.cartItems || [],
          };
          list.unshift(migrated);
          localStorage.setItem(DRAFTS_KEY, JSON.stringify(list));
        }
        localStorage.removeItem("siap_saji_order_draft");
      }
      setDrafts(list);
    } catch (e) {
      console.error("Gagal memuat drafts:", e);
    }
  }, []);

  // Auto-Save Effect
  useEffect(() => {
    if (editingOrderId) return;
    const hasContent = Boolean(
      customerName.trim() ||
        customerPhone.trim() ||
        customerAddress.trim() ||
        cartItems.length > 0 ||
        shippingFee > 0 ||
        orderNotes.trim()
    );

    if (!hasContent) return;

    const nowStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
    const draftId = currentDraftId || `draft_${Date.now()}`;
    if (!currentDraftId) setCurrentDraftId(draftId);

    const draftData: DraftOrder = {
      id: draftId,
      savedAt: nowStr,
      customerName,
      customerPhone,
      customerAddress,
      customerPatokan,
      selectedAreaId,
      selectedChannelId,
      selectedBankId,
      orderDate,
      deliveryDate,
      shippingFee,
      discountType,
      discountValue,
      orderNotes,
      cartItems,
    };

    setDrafts((prev) => {
      const idx = prev.findIndex((d) => d.id === draftId);
      let updated: DraftOrder[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = draftData;
      } else {
        updated = [draftData, ...prev];
      }
      try {
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error("Gagal menyimpan draft ke localStorage", err);
      }
      return updated;
    });
    setLastSavedTime(nowStr);
  }, [
    selectedChannelId,
    customerName,
    customerPhone,
    selectedAreaId,
    customerAddress,
    customerPatokan,
    orderDate,
    deliveryDate,
    shippingFee,
    discountType,
    discountValue,
    selectedBankId,
    orderNotes,
    cartItems,
    editingOrderId,
    currentDraftId,
  ]);

  const handleRestoreDraft = (d: DraftOrder) => {
    try {
      setCurrentDraftId(d.id);
      setSelectedChannelId(d.selectedChannelId);
      setCustomerName(d.customerName);
      setCustomerPhone(d.customerPhone);
      setSelectedAreaId(d.selectedAreaId);
      setCustomerAddress(d.customerAddress);
      setCustomerPatokan(d.customerPatokan);
      setOrderDate(d.orderDate || getTodayStr());
      setDeliveryDate(d.deliveryDate || getTodayStr());
      setShippingFee(d.shippingFee || 0);
      setDiscountType(d.discountType || "nominal");
      setDiscountValue(d.discountValue || 0);
      setSelectedBankId(d.selectedBankId);
      setOrderNotes(d.orderNotes || "");
      setCartItems(Array.isArray(d.cartItems) ? d.cartItems : []);
      setLastSavedTime(d.savedAt);
      setIsDraftModalOpen(false);
      setIsFormOpen(true);
      toast.success(`Draft order ${d.customerName ? `"${d.customerName}"` : ""} dipulihkan!`);
    } catch (e) {
      toast.error("Gagal memulihkan draft order");
    }
  };

  const handleDeleteDraft = (draftId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDrafts((prev) => {
      const updated = prev.filter((d) => d.id !== draftId);
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
      return updated;
    });
    if (currentDraftId === draftId) {
      setCurrentDraftId(null);
    }
    toast.info("Draft order dihapus.");
  };

  const handleSaveDraftAndClose = () => {
    if (currentDraftId) {
      toast.success("Draft order berhasil tersimpan.");
    } else {
      toast.info("Form order dikosongkan.");
    }
    setIsFormOpen(false);
    setCurrentDraftId(null);
  };

  // Import Excel State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isUploadingImport, setIsUploadingImport] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importPreviewData, setImportPreviewData] = useState<any[] | null>(null);
  const [importPreviewSummary, setImportPreviewSummary] = useState<{
    totalRows: number;
    totalOrders: number;
  } | null>(null);

  const handleFileSelect = async (file: File | null) => {
    setImportFile(file);
    setImportResult(null);
    setImportPreviewData(null);
    setImportPreviewSummary(null);

    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName =
        workbook.SheetNames.find(
          (s) => s.toUpperCase().includes("DATA") || s.toUpperCase().includes("ORDER")
        ) || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return;

      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (rows.length < 2) return;

      const rawData = rows.slice(1).filter((r) => r && r.length > 0 && (r[1] || r[2]));

      const groupsMap = new Map<string, any>();
      rawData.forEach((row) => {
        const deliveryDateRaw = row[0] ? String(row[0]).trim() : new Date().toISOString().split("T")[0];
        let deliveryDate = deliveryDateRaw;
        if (typeof row[0] === "number") {
          const parsedD = XLSX.SSF.parse_date_code(row[0]);
          if (parsedD) {
            const m = String(parsedD.m).padStart(2, "0");
            const d = String(parsedD.d).padStart(2, "0");
            deliveryDate = `${parsedD.y}-${m}-${d}`;
          }
        }

        const name = row[1] ? String(row[1]).trim() : "Pelanggan Import";
        const phone = row[2] ? String(row[2]).trim().replace(/[^0-9]/g, "") : "";
        const area = row[3] ? String(row[3]).trim() : "-";
        const shippingFee = Number(row[8] || 0);
        const discount = Number(row[9] || 0);
        const product = row[10] ? String(row[10]).trim() : "-";
        const price = Number(row[11] || 0);
        const qty = Number(row[12] || 1);

        const key = `${phone}_${deliveryDate}`;
        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            deliveryDate,
            name,
            phone,
            area,
            shippingFee,
            discount,
            items: [],
          });
        }

        const g = groupsMap.get(key);
        g.items.push({ product, price, qty, subtotal: price * qty });
      });

      const previewArray: any[] = [];
      groupsMap.forEach((g) => {
        const itemsSubtotal = g.items.reduce((acc: number, it: any) => acc + it.subtotal, 0);
        const grandTotal = Math.max(0, itemsSubtotal + g.shippingFee - g.discount);
        previewArray.push({
          ...g,
          itemsCount: g.items.length,
          grandTotal,
          itemsSummary: g.items.map((it: any) => `${it.product} (x${it.qty})`).join(", "),
        });
      });

      setImportPreviewData(previewArray);
      setImportPreviewSummary({
        totalRows: rawData.length,
        totalOrders: previewArray.length,
      });
    } catch (err: any) {
      console.error("Preview error:", err);
      toast.error("Gagal membaca preview file excel");
    }
  };

  // Fetch Orders
  const fetchOrders = async (page = meta.page, lim = meta.limit) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.append("page", String(page));
      q.append("limit", String(lim));
      if (search) q.append("search", search);
      if (statusFilter) q.append("status_order", statusFilter);
      if (channelFilter) q.append("channel_id", channelFilter);
      if (productFilter) q.append("product_id", String(productFilter));
      if (dateFrom) q.append("date_from", dateFrom);
      if (dateTo) q.append("date_to", dateTo);

      const res = await fetch(`/api/siap-saji/orders?${q.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat daftar transaksi");
      const json = await res.json();
      setOrders(json.data || []);
      setMeta({
        total: json.total || 0,
        page: json.page || page,
        limit: json.limit || lim,
        totalPages: json.totalPages || 1,
      });
      if (json.summary) setSummary(json.summary);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch Master Data
  const fetchMasterData = async () => {
    try {
      const [res, custRes] = await Promise.all([
        fetch("/api/siap-saji/master"),
        fetch("/api/siap-saji/customers?dropdown=true&limit=1000"),
      ]);

      if (res.ok) {
        const data = await res.json();
        setMasterChannels(data.channels || []);
        setMasterAreas(data.areas || []);
        setMasterKasBank(data.kas_bank || []);
        setMasterProducts(data.products || []);
        setMasterDrivers(data.drivers || []);

        if (data.channels?.length > 0 && !selectedChannelId) {
          setSelectedChannelId(data.channels[0].id);
        }
        if (data.kas_bank?.length > 0 && !selectedBankId) {
          const def = data.kas_bank.find((k: KasBank) => k.is_payment_default) || data.kas_bank[0];
          setSelectedBankId(def.id);
        }
      }

      if (custRes.ok) {
        const custData = await custRes.json();
        setMasterCustomers(custData.data || []);
      }
    } catch (e) {
      console.error("Master data fetch error:", e);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchMasterData();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [search, statusFilter, channelFilter, productFilter, dateFrom, dateTo]);

  // Recalculate Shipping Fee when Area or Channel changes in Form
  useEffect(() => {
    if (selectedAreaId && selectedChannelId && isShippingAuto) {
      fetch(`/api/siap-saji/shipping-fee?area_id=${selectedAreaId}&channel_id=${selectedChannelId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.shipping_fee !== undefined) {
            setShippingFee(data.shipping_fee);
          }
        })
        .catch((e) => console.error(e));
    }
  }, [selectedAreaId, selectedChannelId, isShippingAuto]);

  // Handle Cart item addition / adjustment
  const handleAddProductToCart = (prod: Product) => {
    let effectivePrice = prod.price;
    if (selectedChannelId && prod.channel_prices) {
      const overrideObj = prod.channel_prices.find((cp) => cp.channel_id === Number(selectedChannelId));
      if (overrideObj && overrideObj.harga_override !== null) {
        effectivePrice = overrideObj.harga_override;
      }
    }

    const existingIdx = cartItems.findIndex((it) => it.product_id === prod.id);
    if (existingIdx >= 0) {
      const updated = [...cartItems];
      updated[existingIdx].quantity += 1;
      setCartItems(updated);
    } else {
      setCartItems([
        ...cartItems,
        {
          product_id: prod.id,
          sku: prod.sku,
          name: prod.name,
          price: effectivePrice,
          quantity: 1,
          discount: 0,
          notes: "",
          is_half_portion: prod.is_half_portion,
        },
      ]);
    }
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      setCartItems(cartItems.filter((_, i) => i !== index));
    } else {
      const updated = [...cartItems];
      updated[index].quantity = newQty;
      setCartItems(updated);
    }
  };

  const handleUpdateItemNotes = (index: number, notes: string) => {
    const updated = [...cartItems];
    updated[index].notes = notes;
    setCartItems(updated);
  };

  // Cart total calculations & discount calculation (% or nominal)
  const cartSubtotal = cartItems.reduce((acc, it) => acc + (it.price * it.quantity - it.discount), 0);

  const calculatedDiscount = useMemo(() => {
    if (discountType === "percent") {
      return Math.round((cartSubtotal * (Number(discountValue) || 0)) / 100);
    }
    return Number(discountValue) || 0;
  }, [cartSubtotal, discountType, discountValue]);

  const cartGrandTotal = Math.max(0, cartSubtotal - calculatedDiscount + Number(shippingFee || 0));

  // Helper handlers for Create, Edit, & Import Order
  const handleOpenCreateOrder = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEditOrder = async (orderId: number) => {
    try {
      toast.loading("Memuat detail pesanan untuk diedit...", { id: "load-edit-order" });
      const res = await fetch(`/api/siap-saji/orders/${orderId}`);
      if (!res.ok) throw new Error("Gagal memuat detail pesanan");
      const data = await res.json();
      toast.dismiss("load-edit-order");

      setEditingOrderId(data.id);
      setCustomerName(data.customer_name || "");
      setCustomerPhone(data.customer_phone || "");
      setCustomerAddress(data.customer_address || "");
      setCustomerPatokan(data.customer_patokan || "");
      setSelectedAreaId(data.area_id || (masterAreas.length > 0 ? masterAreas[0].id : ""));
      setSelectedChannelId(data.channel_id || (masterChannels.length > 0 ? masterChannels[0].id : ""));
      setSelectedDriverId(data.driver_id || "");
      setSelectedBankId(data.kas_bank_id || (masterKasBank.length > 0 ? masterKasBank[0].id : ""));
      setDeliveryDate(data.delivery_date ? data.delivery_date.split("T")[0] : getTodayStr());
      setShippingFee(Number(data.shipping_fee || 0));
      setDiscountType(data.discount_type || "nominal");
      setDiscountValue(Number(data.discount_value || data.discount || 0));

      if (data.items && Array.isArray(data.items)) {
        setCartItems(
          data.items.map((it: any) => ({
            product_id: it.product_id,
            sku: it.sku || "",
            name: it.product_name || "Produk",
            price: Number(it.price || 0),
            quantity: Number(it.quantity || 1),
            discount: Number(it.discount || 0),
            notes: it.notes || "",
            is_half_portion: !!it.is_half_portion,
          }))
        );
      } else {
        setCartItems([]);
      }

      setProductSearchQuery("");
      setIsFormOpen(true);
    } catch (err: any) {
      toast.dismiss("load-edit-order");
      toast.error(err.message || "Gagal memuat detail pesanan");
    }
  };

  const resetForm = () => {
    setEditingOrderId(null);
    setCurrentDraftId(null);
    setDeliveryDate(getTodayStr());
    setOrderDate(getTodayStr());
    setCustomerName("");
    setCustomerPhone("");
    setSelectedDriverId("");
    setSelectedAreaId(masterAreas.length > 0 ? masterAreas[0].id : "");
    setCustomerAddress("");
    setCustomerPatokan("");
    setShippingFee(0);
    setDiscountType("nominal");
    setDiscountValue(0);
    setOrderNotes("");
    setCartItems([]);
    setProductSearchQuery("");
    setLastSavedTime(null);
  };

  // Submit Order Form (Create POST / Edit PUT)
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannelId) return toast.error("Pilih channel penjualan");
    if (!customerName || !customerPhone || !selectedAreaId) {
      return toast.error("Nama, No HP, dan Kecamatan customer wajib diisi");
    }
    if (cartItems.length === 0) return toast.error("Pilih minimal 1 produk");

    setIsSubmittingOrder(true);
    try {
      if (editingOrderId) {
        // EDIT MODE (PUT)
        const payload = {
          channel_id: Number(selectedChannelId),
          driver_id: selectedDriverId ? Number(selectedDriverId) : null,
          kas_bank_id: selectedBankId ? Number(selectedBankId) : null,
          delivery_date: deliveryDate,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: customerAddress,
          customer_patokan: customerPatokan,
          area_id: Number(selectedAreaId),
          shipping_fee: shippingFee,
          discount: calculatedDiscount,
          discount_type: discountType,
          discount_value: discountValue,
          items: cartItems.map((it) => ({
            product_id: it.product_id,
            price: it.price,
            quantity: it.quantity,
            discount: it.discount,
            notes: it.notes,
          })),
        };

        const res = await fetch(`/api/siap-saji/orders/${editingOrderId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.error || "Gagal memperbarui order");
        }

        toast.success("Pesanan berhasil diperbarui!");
        setIsFormOpen(false);
        resetForm();
        fetchOrders();
      } else {
        // CREATE MODE (POST)
        const payload = {
          channel_id: Number(selectedChannelId),
          driver_id: selectedDriverId ? Number(selectedDriverId) : null,
          customer_id: "new",
          customer_name: customerName,
          customer_phone: customerPhone,
          area_id: Number(selectedAreaId),
          address: customerAddress,
          patokan: customerPatokan,
          order_date: orderDate,
          delivery_date: deliveryDate,
          shipping_fee: shippingFee,
          discount: calculatedDiscount,
          discount_type: discountType,
          discount_value: discountValue,
          payment_bank_id: selectedBankId ? Number(selectedBankId) : null,
          order_notes: orderNotes,
          items: cartItems.map((it) => ({
            product_id: it.product_id,
            price: it.price,
            quantity: it.quantity,
            discount: it.discount,
            notes: it.notes,
          })),
        };

        const res = await fetch("/api/siap-saji/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.error || "Gagal membuat order");
        }

        const createdOrder = await res.json();
        toast.success(`Penjualan Siap Saji berhasil disimpan! No Struk: ${createdOrder.no_struk}`);

        if (currentDraftId) {
          handleDeleteDraft(currentDraftId);
        }
        setIsFormOpen(false);
        resetForm();
        fetchOrders();

        const detailRes = await fetch(`/api/siap-saji/orders/${createdOrder.id}`);
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          setSelectedStruk(detailData);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan order");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Process Excel Import Submit
  const handleProcessImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      toast.error("Silakan pilih file Excel (.xlsx) terlebih dahulu.");
      return;
    }
    setIsUploadingImport(true);
    setImportResult(null);

    try {
      const fd = new FormData();
      fd.append("file", importFile);

      const res = await fetch("/api/siap-saji/orders/import", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengimpor excel");

      setImportResult(json.summary);
      toast.success(json.message || "Berhasil mengimpor data!");
      fetchOrders(1);
    } catch (err: any) {
      toast.error(err.message || "Gagal mengimpor file");
    } finally {
      setIsUploadingImport(false);
    }
  };

  // Handle Cancel Order
  const handleConfirmCancel = async () => {
    if (!cancelOrderTarget) return;
    if (!cancelReason || cancelReason.trim().length < 10) {
      return toast.error("Alasan pembatalan wajib diisi minimal 10 karakter.");
    }

    setIsSubmittingCancel(true);
    try {
      const res = await fetch(`/api/siap-saji/orders/${cancelOrderTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", cancel_reason: cancelReason }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Gagal membatalkan order");
      }

      toast.success(`Order ${cancelOrderTarget.no_struk} berhasil dibatalkan.`);
      setCancelOrderTarget(null);
      setCancelReason("");
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Gagal membatalkan order");
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Copy Struk Text to Clipboard (Format WhatsApp)
  const copyStrukToClipboard = (order: Order) => {
    const lines = [
      `*DYUMMY CATERING — STRUK PENJUALAN*`,
      `No. Struk: ${order.no_struk}`,
      `Tanggal: ${order.delivery_date}`,
      `Customer: ${order.customer_name}`,
      `No. HP: ${order.customer_phone}`,
      `Alamat: ${order.customer_address}`,
      order.customer_patokan ? `Patokan: ${order.customer_patokan}` : null,
      `Kecamatan: ${order.area_kecamatan} (${order.area_kota})`,
      `---------------------------------`,
      ...(order.items || []).map(
        (it: any) => `${it.product_name} x${it.quantity} @ Rp${it.price.toLocaleString("id-ID")}`
      ),
      `---------------------------------`,
      `Biaya Kirim: Rp${order.shipping_fee.toLocaleString("id-ID")}`,
      `*TOTAL: Rp${order.grand_total.toLocaleString("id-ID")}*`,
      `Rekening: ${order.payment_bank} (${order.payment_account})`,
      `Status: ${order.status_payment}`,
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(lines);
    toast.success("Teks Struk berhasil disalin ke clipboard!");
  };

  // Open Bulk Print Modal & Fetch details for selected orders
  const handleOpenBulkPrint = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsLoadingBulk(true);
    try {
      const details = await Promise.all(
        selectedOrderIds.map(async (id) => {
          const res = await fetch(`/api/siap-saji/orders/${id}`);
          if (res.ok) return await res.json();
          const found = orders.find((o) => o.id === id);
          return found || null;
        })
      );
      const valid = details.filter((d): d is Order => Boolean(d));
      setBulkStrukOrders(valid);
      setIsBulkModalOpen(true);
    } catch (err: any) {
      toast.error("Gagal memuat detail transaksi untuk cetak masal");
    } finally {
      setIsLoadingBulk(false);
    }
  };

  // Copy All WA Text for Bulk Selected Orders
  const copyAllWA = () => {
    if (bulkStrukOrders.length === 0) return;
    const text = bulkStrukOrders
      .map((order, idx) => {
        return [
          `*==============================*`,
          `*STRUK PESANAN #${idx + 1} DARI ${bulkStrukOrders.length}*`,
          `*DYUMMY CATERING — STRUK PENJUALAN*`,
          `No. Struk: ${order.no_struk}`,
          `Tanggal: ${formatDate(order.delivery_date)}`,
          `Customer: ${order.customer_name}`,
          `No. HP: ${order.customer_phone}`,
          `Alamat: ${order.customer_address}`,
          order.customer_patokan ? `Patokan: ${order.customer_patokan}` : null,
          `Kecamatan: ${order.area_kecamatan || "-"} (${order.area_kota || "-"})`,
          `---------------------------------`,
          ...(order.items || []).map(
            (it: any) => `${it.product_name} x${it.quantity} @ Rp${Number(it.price).toLocaleString("id-ID")}`
          ),
          `---------------------------------`,
          `Biaya Kirim: Rp${Number(order.shipping_fee).toLocaleString("id-ID")}`,
          `*TOTAL: Rp${Number(order.grand_total).toLocaleString("id-ID")}*`,
          `Rekening: ${order.payment_bank} (${order.payment_account})`,
          `Status: ${order.status_order}`,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n\n");

    navigator.clipboard.writeText(text);
    toast.success(`Teks Struk untuk ${bulkStrukOrders.length} pesanan berhasil disalin!`);
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 40 }}>
      {/* ── HEADER & STATS ────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.02em" }}>
            Penjualan Siap Saji
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Kelola transaksi harian retail Siap Saji & cetak struk pengiriman
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setIsDraftModalOpen(true)}
            style={{
              background: drafts.length > 0 ? "#fffbe6" : "white",
              color: drafts.length > 0 ? "#b45309" : "#374151",
              border: drafts.length > 0 ? "2px solid #f59e0b" : "1px solid #d1d5db",
              borderRadius: 10,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
              transition: "transform 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
          >
            <ClipboardList size={18} color={drafts.length > 0 ? "#b45309" : "#5005A6"} />
            📋 Menu Draft
            {drafts.length > 0 && (
              <span
                style={{
                  background: "#d97706",
                  color: "white",
                  borderRadius: 10,
                  padding: "2px 8px",
                  fontSize: 12,
                  fontWeight: 800,
                  marginLeft: 2,
                }}
              >
                {drafts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setImportFile(null);
              setImportResult(null);
              setIsImportModalOpen(true);
            }}
            style={{
              background: "white",
              color: "#5005A6",
              border: "2px solid #5005A6",
              borderRadius: 10,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 2px 8px rgba(80, 5, 166, 0.12)",
              transition: "transform 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
          >
            <FileText size={18} />
            📥 Import Excel Order
          </button>

          <button
            onClick={handleOpenCreateOrder}
            style={{
              background: "linear-gradient(135deg, #5005A6 0%, #B10FBD 100%)",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 12px rgba(177, 15, 189, 0.25)",
              transition: "transform 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
          >
            <Plus size={18} />
            Buat Penjualan
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "white", borderRadius: 12, padding: "16px 20px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <p style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>Total Omset Siap Saji</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: "#5005A6", marginTop: 6 }}>
            Rp {summary.total_penjualan.toLocaleString("id-ID")}
          </p>
        </div>
        <div style={{ background: "white", borderRadius: 12, padding: "16px 20px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <p style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>Total Transaksi Aktif</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: "#378ADD", marginTop: 6 }}>
            {summary.total_orders} Pesanan
          </p>
        </div>
        <div style={{ background: "white", borderRadius: 12, padding: "16px 20px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <p style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>Order Hari Ini</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: "#639922", marginTop: 6 }}>
            {summary.orders_today} Transaksi
          </p>
        </div>
      </div>

      {/* ── FILTERS BAR ────────────────────────────────────────── */}
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: "12px 16px",
          border: "1px solid #e5e7eb",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          position: "relative",
          zIndex: 20,
        }}
      >
        <div style={{ flex: "1 1 200px", minWidth: 160, maxWidth: 280, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Cari No Struk, Customer, HP..."
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
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          style={{ width: 140, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white" }}
        >
          <option value="">Semua Channel</option>
          {masterChannels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}
            </option>
          ))}
        </select>

        {/* Searchable Select2 Autocomplete Combobox for Menu Filter */}
        <div style={{ position: "relative", width: 210, flexShrink: 0 }}>
          <div
            onClick={() => setIsFilterProductDropdownOpen((prev) => !prev)}
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "white",
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: isFilterProductDropdownOpen ? "0 0 0 2px rgba(80, 5, 166, 0.2)" : "none",
            }}
          >
            {(() => {
              const selP = masterProducts.find((p) => p.id === Number(productFilter));
              return (
                <span style={{ color: selP ? "#5005A6" : "#6b7280", fontWeight: selP ? 700 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {selP ? `🍲 ${selP.name}` : "Semua Menu / Produk"}
                </span>
              );
            })()}
            <ChevronDown size={16} color="#6b7280" />
          </div>

          {/* Floating Dropdown */}
          {isFilterProductDropdownOpen && (
            <>
              <div
                onClick={() => setIsFilterProductDropdownOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 90, background: "transparent" }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  width: 280,
                  zIndex: 100,
                  marginTop: 4,
                  background: "white",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25)",
                  padding: 8,
                }}
              >
              <div style={{ position: "relative", marginBottom: 6 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: 9, color: "#9ca3af" }} />
                <input
                  type="text"
                  placeholder="Ketik nama menu / SKU..."
                  value={filterProductSearchQuery}
                  onChange={(e) => setFilterProductSearchQuery(e.target.value)}
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "6px 10px 6px 30px",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {/* Option for All Products */}
                <div
                  onClick={() => {
                    setProductFilter("");
                    setIsFilterProductDropdownOpen(false);
                    setFilterProductSearchQuery("");
                  }}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: "pointer",
                    background: productFilter === "" ? "#f3e8ff" : "transparent",
                    color: productFilter === "" ? "#5005A6" : "#4b5563",
                    fontWeight: productFilter === "" ? 700 : 500,
                    marginBottom: 2,
                  }}
                >
                  ✨ Semua Menu / Produk
                </div>

                {(() => {
                  const filtered = masterProducts.filter((p) => {
                    const q = filterProductSearchQuery.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      p.name.toLowerCase().includes(q) ||
                      (p.sku && p.sku.toLowerCase().includes(q))
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div style={{ padding: "10px", textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
                        Tidak ada menu yang cocok
                      </div>
                    );
                  }

                  return filtered.map((p) => {
                    const isSelected = p.id === Number(productFilter);
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setProductFilter(p.id);
                          setIsFilterProductDropdownOpen(false);
                          setFilterProductSearchQuery("");
                        }}
                        style={{
                          padding: "7px 10px",
                          borderRadius: 6,
                          fontSize: 12,
                          cursor: "pointer",
                          background: isSelected ? "#f3e8ff" : "transparent",
                          color: isSelected ? "#5005A6" : "#374151",
                          fontWeight: isSelected ? 700 : 500,
                          marginBottom: 2,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.name}
                        </span>
                        {p.sku && (
                          <span style={{ fontSize: 10, color: isSelected ? "#7e22ce" : "#9ca3af", marginLeft: 6, flexShrink: 0 }}>
                            {p.sku}
                          </span>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </>
        )}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 130, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white" }}
        >
          <option value="">Semua Status</option>
          <option value="Aktif">Aktif</option>
          <option value="Dibatalkan">Dibatalkan</option>
        </select>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <select
            value={timeShortcut}
            onChange={(e) => handleTimeShortcutChange(e.target.value)}
            style={{ width: 140, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white" }}
          >
            <option value="today">📅 Hari Ini</option>
            <option value="yesterday">📅 Hari Kemarin</option>
            <option value="week">📅 Pekan Ini</option>
            <option value="month">📅 Bulan Ini</option>
            <option value="year">📅 Tahun Ini</option>
            <option value="all">📅 Semua Waktu</option>
            <option value="custom">📅 Custom Tanggal</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setTimeShortcut("custom");
            }}
            style={{ width: 130, padding: "7px 8px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }}
          />
          <span style={{ color: "#9ca3af", fontSize: 12 }}>s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setTimeShortcut("custom");
            }}
            style={{ width: 130, padding: "7px 8px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }}
          />
        </div>

        <button
          onClick={() => {
            const q = new URLSearchParams();
            if (dateFrom) q.append("date_from", dateFrom);
            if (dateTo) q.append("date_to", dateTo);
            const url = `/api/siap-saji/orders/recap-pdf?${q.toString()}`;
            window.open(url, "_blank");
          }}
          style={{
            padding: "7px 12px",
            background: "#eff6ff",
            color: "#1d4ed8",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 700,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          title="Cetak rekap akumulasi kuantitas produk & catatan untuk dapur"
        >
          <ClipboardList size={15} /> 🍳 Rekap Dapur A4
        </button>

        {(search || statusFilter || channelFilter || productFilter || timeShortcut !== "today" || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setChannelFilter("");
              setProductFilter("");
              setTimeShortcut("today");
              const today = getTodayStr();
              setDateFrom(today);
              setDateTo(today);
            }}
            style={{
              padding: "7px 12px",
              background: "#f3f4f6",
              color: "#4b5563",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* ── BULK ACTION BAR ────────────────────────────────────── */}
      {selectedOrderIds.length > 0 && (
        <div
          style={{
            background: "linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)",
            border: "1.5px solid #378ADD",
            borderRadius: 12,
            padding: "12px 18px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 4px 12px rgba(55, 138, 221, 0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
              ✓ <span style={{ color: "#5005A6" }}>{selectedOrderIds.length}</span> pesanan terpilih
            </span>
            <button
              onClick={() => setSelectedOrderIds([])}
              style={{
                fontSize: 13,
                color: "#64748b",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                textDecoration: "underline",
              }}
            >
              Batal Pilih
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                const url = `/api/siap-saji/orders/bulk-pdf?ids=${selectedOrderIds.join(",")}&mode=exact`;
                window.open(url, "_blank");
              }}
              style={{
                background: "linear-gradient(135deg, #5005A6 0%, #B10FBD 100%)",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 4px 12px rgba(80, 5, 166, 0.25)",
              }}
            >
              <FileText size={15} />
              PDF Pas Ukuran ({selectedOrderIds.length} Struk)
            </button>

            <button
              onClick={() => {
                const url = `/api/siap-saji/orders/bulk-pdf?ids=${selectedOrderIds.join(",")}&mode=roll`;
                window.open(url, "_blank");
              }}
              style={{
                background: "#15803d",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 4px 12px rgba(21, 128, 61, 0.25)",
              }}
            >
              <Printer size={15} />
              PDF Roll Kontinu (Kassen BTP3100)
            </button>

            <button
              onClick={() => {
                const url = `/api/siap-saji/orders/recap-pdf?ids=${selectedOrderIds.join(",")}`;
                window.open(url, "_blank");
              }}
              style={{
                background: "#378ADD",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 4px 12px rgba(55, 138, 221, 0.25)",
              }}
            >
              <ClipboardList size={15} />
              🍳 Cetak Rekap Dapur (A4)
            </button>
            <button
              onClick={handleOpenBulkPrint}
              disabled={isLoadingBulk}
              style={{
                background: "#white",
                color: "#374151",
                border: "1px solid #d1d5db",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Printer size={15} />
              {isLoadingBulk ? "Memuat..." : "Preview Web Modal"}
            </button>
          </div>
        </div>
      )}

      {/* ── TRANSACTIONS TABLE ────────────────────────────────── */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14, whiteSpace: "nowrap" }}>
          <thead>
            <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>
              <th style={{ padding: "12px 10px", width: 40, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={orders.length > 0 && orders.every((o) => selectedOrderIds.includes(o.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedOrderIds(orders.map((o) => o.id));
                    } else {
                      setSelectedOrderIds([]);
                    }
                  }}
                  title="Pilih Semua Halaman Ini"
                  style={{ cursor: "pointer", width: 16, height: 16, accentColor: "#5005A6" }}
                />
              </th>
              <th style={{ padding: "12px 16px", width: 50 }}>No.</th>
              <th style={{ padding: "12px 16px" }}>No. Struk</th>
              <th style={{ padding: "12px 16px" }}>Tanggal</th>
              <th style={{ padding: "12px 16px" }}>Pelanggan</th>
              <th style={{ padding: "12px 16px" }}>Kecamatan</th>
              <th style={{ padding: "12px 16px" }}>Channel</th>
              <th style={{ padding: "12px 16px" }}>Total</th>
              <th style={{ padding: "12px 16px" }}>Rekening</th>
              <th style={{ padding: "12px 16px" }}>Status Order</th>
              <th style={{ padding: "12px 16px" }}>Status Pengiriman</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  Memuat data penjualan...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  Tidak ada transaksi Siap Saji ditemukan.
                </td>
              </tr>
            ) : (
              orders.map((o, idx) => (
                <tr key={o.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "14px 10px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(o.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrderIds([...selectedOrderIds, o.id]);
                        } else {
                          setSelectedOrderIds(selectedOrderIds.filter((id) => id !== o.id));
                        }
                      }}
                      style={{ cursor: "pointer", width: 16, height: 16, accentColor: "#5005A6" }}
                    />
                  </td>
                  <td style={{ padding: "14px 16px", color: "#6b7280" }}>{(meta.page - 1) * meta.limit + idx + 1}</td>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#5005A6" }}>{o.no_struk || "-"}</td>
                  <td style={{ padding: "14px 16px", color: "#374151" }}>{formatDate(o.delivery_date)}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <p style={{ fontWeight: 600, color: "#111827", margin: 0 }}>{o.customer_name}</p>
                    <a
                      href={getWhatsAppUrl(o.customer_phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12,
                        color: "#25D366",
                        fontWeight: 700,
                        margin: "2px 0 0",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                      title="Chat WhatsApp (Buka Tab Baru)"
                    >
                      💬 {o.customer_phone}
                    </a>
                  </td>
                  <td style={{ padding: "14px 16px", color: "#4b5563" }}>
                    {o.area_kecamatan ? `${o.area_kecamatan}` : "-"}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: "rgba(55, 138, 221, 0.1)",
                        color: "#378ADD",
                      }}
                    >
                      {o.channel_name || "Gojek"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#111827" }}>
                    Rp {Number(o.grand_total).toLocaleString("id-ID")}
                  </td>
                  <td style={{ padding: "14px 16px", color: "#4b5563", fontSize: 13 }}>
                    {o.payment_bank} ({o.payment_account})
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        background: o.status_order === "Dibatalkan" ? "#fef2f2" : "#f0fdf4",
                        color: o.status_order === "Dibatalkan" ? "#E24B4A" : "#639922",
                        border: `1px solid ${o.status_order === "Dibatalkan" ? "#fecaca" : "#bbf7d0"}`,
                      }}
                    >
                      {o.status_order}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div>
                      {(() => {
                        const st = o.shipping_status || "Menunggu";
                        let bg = "#f3f4f6";
                        let clr = "#4b5563";
                        if (st === "Selesai" || st === "Terkirim") { bg = "#dcfce7"; clr = "#15803d"; }
                        else if (st === "Dalam Pengiriman" || st === "Dikirim") { bg = "#dbeafe"; clr = "#1d4ed8"; }
                        else if (st === "Diproses") { bg = "#fef3c7"; clr = "#b45309"; }
                        return (
                          <span style={{ padding: "3px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: bg, color: clr }}>
                            {st}
                          </span>
                        );
                      })()}
                      {o.driver_name && (
                        <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0", fontWeight: 600 }}>
                          🛵 {o.driver_name}
                        </p>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      {o.status_order !== "Dibatalkan" && (
                        <button
                          onClick={() => handleOpenEditOrder(o.id)}
                          style={{
                            padding: "6px 10px",
                            background: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#1d4ed8",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          title="Edit Rincian Order"
                        >
                          <Edit2 size={14} /> Edit
                        </button>
                      )}

                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/siap-saji/orders/${o.id}`);
                          if (res.ok) setSelectedStruk(await res.json());
                        }}
                        style={{
                          padding: "6px 10px",
                          background: "#f3f4f6",
                          border: "1px solid #d1d5db",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#374151",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Printer size={14} /> Struk
                      </button>
                      {o.status_order !== "Dibatalkan" && (
                        <button
                          onClick={() => {
                            setCancelOrderTarget(o);
                            setCancelReason("");
                          }}
                          style={{
                            padding: "6px 10px",
                            background: "rgba(226, 75, 74, 0.1)",
                            border: "1px solid rgba(226, 75, 74, 0.3)",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#E24B4A",
                            cursor: "pointer",
                          }}
                        >
                          Batal
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={meta.limit}
          onChange={(p) => fetchOrders(p, meta.limit)}
          onLimitChange={(lim) => fetchOrders(1, lim)}
        />
      </div>

      {/* ── MODAL: FORM ORDER BARU ────────────────────────────────── */}
      {isFormOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              maxWidth: 900,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: 16, marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>
                  {editingOrderId ? `Edit Penjualan Siap Saji (#${editingOrderId})` : "Buat Penjualan Siap Saji"}
                </h2>
                <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0 0" }}>
                  Struk otomatis ter-generate dan jurnal penjualan tercatat
                </p>
              </div>
              <button onClick={() => setIsFormOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={20} />
              </button>
            </div>

            {/* AUTO-SAVE DRAFT STATUS BANNER */}
            {!editingOrderId && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 10,
                  padding: "8px 14px",
                  marginBottom: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#166534", fontWeight: 600 }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }}></span>
                  <span>
                    Auto-Draft Aktif: Input tersimpan otomatis {lastSavedTime ? `pukul ${lastSavedTime}` : "saat mengetik"}
                  </span>
                </div>
                {drafts.length > 0 && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsFormOpen(false);
                        setIsDraftModalOpen(true);
                      }}
                      style={{ background: "none", border: "none", color: "#15803d", fontWeight: 700, cursor: "pointer", fontSize: 12, textDecoration: "underline" }}
                    >
                      Lihat Semua Draft ({drafts.length})
                    </button>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmitOrder}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
                {/* 1. Tanggal Kirim / Order */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                    Tanggal Transaksi / Kirim *
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => {
                      setDeliveryDate(e.target.value);
                      setOrderDate(e.target.value);
                    }}
                    required
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" }}
                  />
                </div>

                {/* 2. Channel Penjualan */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                    Channel Penjualan *
                  </label>
                  <select
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(Number(e.target.value))}
                    required
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" }}
                  >
                    {masterChannels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Driver Pengiriman */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#5005A6", marginBottom: 6 }}>
                    Driver Pengemudi (Kurir)
                  </label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value ? Number(e.target.value) : "")}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #5005A6", fontSize: 14, outline: "none", background: "#fdf4ff" }}
                  >
                    <option value="">-- Pilih Driver --</option>
                    {masterDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        🛵 {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Rekening Pembayaran */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                    Rekening Pembayaran *
                  </label>
                  <select
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(Number(e.target.value))}
                    required
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" }}
                  >
                    {masterKasBank.map((kb) => (
                      <option key={kb.id} value={kb.id}>
                        {kb.nama_rekening} ({kb.no_rekening})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Customer Information */}
              <div style={{ background: "#f9fafb", borderRadius: 12, padding: 16, border: "1px solid #e5e7eb", marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Phone size={16} color="#5005A6" /> Data Pelanggan & Pengiriman
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
                  {/* Nama Pelanggan with Autocomplete Search (Req 5a) */}
                  <div style={{ position: "relative" }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>
                      Nama Pelanggan *
                    </label>
                    <input
                      type="text"
                      placeholder="Ketik nama untuk cari/input..."
                      value={customerName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomerName(val);
                        setIsCustDropdownOpen(val.trim().length > 0);
                        if (selectedCustomerId !== "new") {
                          setSelectedCustomerId("new");
                        }
                      }}
                      onFocus={() => {
                        if (customerName.trim().length > 0) setIsCustDropdownOpen(true);
                      }}
                      required
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                    />

                    {/* Autocomplete Dropdown List */}
                    {isCustDropdownOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          background: "white",
                          border: "1px solid #d1d5db",
                          borderRadius: 8,
                          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                          maxHeight: 200,
                          overflowY: "auto",
                          zIndex: 50,
                          marginTop: 4,
                        }}
                      >
                        {(() => {
                          const matched = masterCustomers.filter(
                            (c) =>
                              c.name.toLowerCase().includes(customerName.toLowerCase()) ||
                              (c.phone && c.phone.includes(customerName))
                          );

                          if (matched.length === 0) {
                            return (
                              <div
                                onClick={() => {
                                  setSelectedCustomerId("new");
                                  setIsCustDropdownOpen(false);
                                  toast.info(`Membuat customer baru: "${customerName}"`);
                                }}
                                style={{
                                  padding: "8px 12px",
                                  fontSize: 12,
                                  color: "#5005A6",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  background: "#f9f5ff",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#f3e8ff")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "#f9f5ff")}
                              >
                                ➕ Buat sebagai Customer Baru: &quot;<strong>{customerName}</strong>&quot;
                              </div>
                            );
                          }

                          return matched.slice(0, 10).map((c) => {
                            const selArea = masterAreas.find((a) => a.id === Number(c.area_id));
                            const kecName = c.area_kecamatan || selArea?.kecamatan || "";
                            return (
                              <div
                                key={c.id}
                                onClick={() => {
                                  setCustomerName(c.name);
                                  setCustomerPhone(c.phone || "");
                                  if (c.address) setCustomerAddress(c.address);
                                  if (c.patokan) setCustomerPatokan(c.patokan);
                                  if (c.area_id) {
                                    setSelectedAreaId(c.area_id);
                                    setIsShippingAuto(true);
                                  }
                                  setSelectedCustomerId(c.id);
                                  setIsCustDropdownOpen(false);
                                  setDuplicatePhoneCust(null);
                                }}
                                style={{
                                  padding: "8px 12px",
                                  borderBottom: "1px solid #f3f4f6",
                                  cursor: "pointer",
                                  fontSize: 13,
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                              >
                                <div style={{ fontWeight: 700, color: "#111827" }}>{c.name}</div>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>
                                  📞 {c.phone || "-"} {kecName ? `• Kec. ${kecName}` : ""} {c.address ? `• ${c.address}` : ""}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  {/* No WhatsApp Input with Duplicate Phone Check (Req 5b) */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>
                      No. WhatsApp / HP *
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 08111100004 / 62811..."
                      value={customerPhone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomerPhone(val);
                        const normInput = normalizePhoneNumber(val);
                        if (normInput.length >= 8) {
                          const found = masterCustomers.find(
                            (c) =>
                              isSamePhoneNumber(c.phone, normInput) &&
                              c.name.toLowerCase() !== customerName.toLowerCase()
                          );
                          if (found) {
                            setDuplicatePhoneCust(found);
                          } else {
                            setDuplicatePhoneCust(null);
                          }
                        } else {
                          setDuplicatePhoneCust(null);
                        }
                      }}
                      required
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: duplicatePhoneCust ? "1px solid #f59e0b" : "1px solid #d1d5db",
                        fontSize: 14,
                      }}
                    />

                    {/* Duplicate Phone Notice (Req 5b) */}
                    {duplicatePhoneCust && (
                      <div
                        style={{
                          marginTop: 6,
                          padding: "8px 10px",
                          background: "#fffbe6",
                          border: "1px solid #ffe58f",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "#854d0e",
                          lineHeight: 1.4,
                        }}
                      >
                        <div>
                          ⚠️ Nomor WA ini sudah terdaftar atas nama: <strong>{duplicatePhoneCust.name}</strong>!
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerName(duplicatePhoneCust.name);
                            setCustomerPhone(duplicatePhoneCust.phone || customerPhone);
                            if (duplicatePhoneCust.address) setCustomerAddress(duplicatePhoneCust.address);
                            if (duplicatePhoneCust.patokan) setCustomerPatokan(duplicatePhoneCust.patokan);
                            if (duplicatePhoneCust.area_id) setSelectedAreaId(duplicatePhoneCust.area_id);
                            setSelectedCustomerId(duplicatePhoneCust.id);
                            setDuplicatePhoneCust(null);
                            toast.success(`Menggunakan data customer ${duplicatePhoneCust.name}`);
                          }}
                          style={{
                            marginTop: 4,
                            background: "#faad14",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            padding: "3px 8px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Gunakan Customer Ini
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
                  <div style={{ position: "relative" }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>
                      Kecamatan (Lookup Ongkir) *
                    </label>

                    {/* Combobox Trigger Box */}
                    <div
                      onClick={() => setIsAreaDropdownOpen((prev) => !prev)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        background: "white",
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        boxShadow: isAreaDropdownOpen ? "0 0 0 2px rgba(80, 5, 166, 0.2)" : "none",
                      }}
                    >
                      {(() => {
                        const selArea = masterAreas.find((a) => a.id === Number(selectedAreaId));
                        return (
                          <span style={{ color: selArea ? "#111827" : "#9ca3af", fontWeight: selArea ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {selArea
                              ? `${selArea.kecamatan} (${selArea.kota}) — [${selArea.shipping_zone}]`
                              : "-- Cari & Pilih Kecamatan --"}
                          </span>
                        );
                      })()}
                      <ChevronDown size={16} color="#6b7280" />
                    </div>

                    {/* Select2 Autocomplete Floating Dropdown */}
                    {isAreaDropdownOpen && (
                      <>
                        <div
                          onClick={() => setIsAreaDropdownOpen(false)}
                          style={{ position: "fixed", inset: 0, zIndex: 90, background: "transparent" }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            right: 0,
                            zIndex: 100,
                            marginTop: 4,
                            background: "white",
                            borderRadius: 10,
                            border: "1px solid #d1d5db",
                            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25)",
                            padding: 8,
                          }}
                        >
                          <div style={{ position: "relative", marginBottom: 6 }}>
                            <Search size={14} style={{ position: "absolute", left: 10, top: 9, color: "#9ca3af" }} />
                            <input
                              type="text"
                              placeholder="Ketik nama kecamatan / kota..."
                              value={areaSearchQuery}
                              onChange={(e) => setAreaSearchQuery(e.target.value)}
                              autoFocus
                              style={{
                                width: "100%",
                                padding: "6px 10px 6px 30px",
                                borderRadius: 6,
                                border: "1px solid #e5e7eb",
                                fontSize: 12,
                                outline: "none",
                              }}
                            />
                          </div>

                          <div style={{ maxHeight: 210, overflowY: "auto" }}>
                            {(() => {
                              const filtered = masterAreas.filter((a) => {
                                const q = areaSearchQuery.toLowerCase().trim();
                                if (!q) return true;
                                return (
                                  a.kecamatan.toLowerCase().includes(q) ||
                                  a.kota.toLowerCase().includes(q) ||
                                  a.shipping_zone.toLowerCase().includes(q)
                                );
                              });

                              if (filtered.length === 0) {
                                return (
                                  <div style={{ padding: "10px", textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
                                    Tidak ada kecamatan yang cocok
                                  </div>
                                );
                              }

                              return filtered.map((a) => {
                                const isSelected = a.id === Number(selectedAreaId);
                                return (
                                  <div
                                    key={a.id}
                                    onClick={() => {
                                      setSelectedAreaId(a.id);
                                      setIsShippingAuto(true);
                                      setIsAreaDropdownOpen(false);
                                      setAreaSearchQuery("");
                                    }}
                                    style={{
                                      padding: "8px 10px",
                                      borderRadius: 6,
                                      fontSize: 12,
                                      cursor: "pointer",
                                      background: isSelected ? "#f3e8ff" : "transparent",
                                      color: isSelected ? "#5005A6" : "#374151",
                                      fontWeight: isSelected ? 700 : 500,
                                      marginBottom: 2,
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                    }}
                                  >
                                    <span>
                                      <strong>{a.kecamatan}</strong> ({a.kota})
                                    </span>
                                    <span style={{ fontSize: 10, color: isSelected ? "#7e22ce" : "#6b7280", background: isSelected ? "#e9d5ff" : "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>
                                      {a.shipping_zone}
                                    </span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>
                      Biaya Kirim (Ongkir Otomatis)
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="number"
                        value={shippingFee}
                        onChange={(e) => {
                          setShippingFee(Number(e.target.value));
                          setIsShippingAuto(false);
                        }}
                        style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                      />
                      <button
                        type="button"
                        onClick={() => setIsShippingAuto(true)}
                        title="Hitung ulang otomatis dari matriks ongkir"
                        style={{ padding: "8px 12px", background: "#e5e7eb", border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer" }}
                      >
                        Auto
                      </button>
                    </div>
                  </div>
                </div>

                {/* Diskon Promo Row */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>
                    Diskon Promo Transaksi (Diskon % atau Nominal Rp)
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as "nominal" | "percent")}
                      style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#f9fafb", outline: "none", fontWeight: 600 }}
                    >
                      <option value="nominal">Nominal (Rp)</option>
                      <option value="percent">Persentase (%)</option>
                    </select>
                    <input
                      type="number"
                      placeholder={discountType === "percent" ? "Misal: 17 (untuk promo 17%)" : "Misal: 15000"}
                      value={discountValue || ""}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                      style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                    />
                  </div>
                  {discountType === "percent" && discountValue > 0 && (
                    <div style={{ fontSize: 11, color: "#059669", marginTop: 4, fontWeight: 600 }}>
                      ✓ Potongan Diskon {discountValue}% = -Rp {calculatedDiscount.toLocaleString("id-ID")}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>
                    Alamat Lengkap *
                  </label>
                  <input
                    type="text"
                    placeholder="Jl Pluto I Blok C No 5 Kel Margasari"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>
                    Patokan / Landmark Lokasi (Khusus Kurir)
                  </label>
                  <input
                    type="text"
                    placeholder="Dekat Griya Margahayuraya, depan puskesmas gerbang putih..."
                    value={customerPatokan}
                    onChange={(e) => setCustomerPatokan(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                  />
                </div>
              </div>

              {/* Product Selection */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>
                    Pilih Produk & Qty
                  </h3>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    Total {masterProducts.length} Produk Tersedia
                  </span>
                </div>

                {/* 🔍 Autocomplete Product Search Input */}
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <div style={{ position: "relative" }}>
                    <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#5005A6" }} />
                    <input
                      type="text"
                      placeholder="🔍 Cari & Tambah Produk (Ketik Nama / SKU Produk)..."
                      value={productSearchQuery}
                      onChange={(e) => {
                        setProductSearchQuery(e.target.value);
                        setIsProductDropdownOpen(true);
                      }}
                      onFocus={() => setIsProductDropdownOpen(true)}
                      style={{
                        width: "100%",
                        padding: "10px 36px 10px 36px",
                        borderRadius: 10,
                        border: "2px solid #5005A6",
                        fontSize: 14,
                        fontWeight: 600,
                        outline: "none",
                        boxShadow: "0 2px 8px rgba(80, 5, 166, 0.12)",
                        background: "#fdf8ff",
                      }}
                    />
                    {productSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setProductSearchQuery("");
                          setIsProductDropdownOpen(false);
                        }}
                        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Autocomplete Dropdown List */}
                  {isProductDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 60,
                        background: "white",
                        borderRadius: 10,
                        border: "1px solid #d1d5db",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
                        maxHeight: 240,
                        overflowY: "auto",
                        marginTop: 4,
                      }}
                    >
                      {(() => {
                        const filtered = masterProducts.filter((p) => {
                          if (!productSearchQuery.trim()) return true;
                          const q = productSearchQuery.toLowerCase().trim();
                          return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
                        });

                        if (filtered.length === 0) {
                          return (
                            <div style={{ padding: "12px 16px", fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
                              Tidak ada produk ditemukan untuk &quot;{productSearchQuery}&quot;
                            </div>
                          );
                        }

                        return filtered.map((p) => {
                          let displayPrice = p.price;
                          if (selectedChannelId && p.channel_prices) {
                            const ov = p.channel_prices.find((cp) => cp.channel_id === Number(selectedChannelId));
                            if (ov && ov.harga_override !== null) displayPrice = ov.harga_override;
                          }
                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                handleAddProductToCart(p);
                                setProductSearchQuery("");
                                setIsProductDropdownOpen(false);
                              }}
                              style={{
                                padding: "10px 14px",
                                borderBottom: "1px solid #f3f4f6",
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                transition: "background 0.1s",
                                background: p.is_half_portion ? "#fdf4ff" : "white",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f3e8ff")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = p.is_half_portion ? "#fdf4ff" : "white")}
                            >
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                                  {p.name}
                                  {p.is_half_portion && (
                                    <span style={{ fontSize: 10, fontWeight: 800, background: "#b10fbd", color: "white", padding: "1px 5px", borderRadius: 4 }}>
                                      ½ Porsi
                                    </span>
                                  )}
                                </p>
                                <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0" }}>SKU: {p.sku}</p>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <p style={{ fontSize: 13, fontWeight: 800, color: "#5005A6", margin: 0 }}>
                                  Rp {displayPrice.toLocaleString("id-ID")}
                                </p>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>+ Tambah</span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>

                {/* Product Catalog Grid (Filtered live by search query) */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, maxHeight: 180, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, marginBottom: 16 }}>
                  {masterProducts
                    .filter((p) => {
                      if (!productSearchQuery.trim()) return true;
                      const q = productSearchQuery.toLowerCase().trim();
                      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
                    })
                    .map((p) => {
                      let displayPrice = p.price;
                      if (selectedChannelId && p.channel_prices) {
                        const ov = p.channel_prices.find((cp) => cp.channel_id === Number(selectedChannelId));
                        if (ov && ov.harga_override !== null) displayPrice = ov.harga_override;
                      }
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleAddProductToCart(p)}
                          style={{
                            border: p.is_half_portion ? "1px dashed #b10fbd" : "1px solid #e5e7eb",
                            borderRadius: 8,
                            padding: "10px 12px",
                            background: p.is_half_portion ? "#fdf4ff" : "white",
                            cursor: "pointer",
                            transition: "all 0.12s",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>{p.name}</p>
                            {p.is_half_portion && (
                              <span style={{ fontSize: 10, fontWeight: 800, background: "#b10fbd", color: "white", padding: "1px 4px", borderRadius: 4 }}>
                                ½ Porsi
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "#5005A6", marginTop: 4 }}>
                            Rp {displayPrice.toLocaleString("id-ID")}
                          </p>
                        </div>
                      );
                    })}
                </div>

                {/* Cart Selected Items Table */}
                {cartItems.length > 0 && (
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#f3f4f6", borderBottom: "1px solid #e5e7eb", textTransform: "uppercase", fontSize: 11, color: "#6b7280" }}>
                          <th style={{ padding: "8px 12px", textAlign: "left" }}>Item</th>
                          <th style={{ padding: "8px 12px", textAlign: "center" }}>Harga</th>
                          <th style={{ padding: "8px 12px", textAlign: "center" }}>Qty</th>
                          <th style={{ padding: "8px 12px", textAlign: "left" }}>Catatan Item</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Subtotal</th>
                          <th style={{ padding: "8px 12px", textAlign: "center" }}>Hapus</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cartItems.map((it, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                            <td style={{ padding: "8px 12px", fontWeight: 600 }}>
                              {it.name} {it.is_half_portion && <span style={{ color: "#b10fbd", fontSize: 11 }}>(½)</span>}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "center" }}>
                              Rp {it.price.toLocaleString("id-ID")}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "center" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(idx, it.quantity - 1)}
                                  style={{ width: 22, height: 22, border: "1px solid #d1d5db", borderRadius: 4, background: "#f9fafb", cursor: "pointer" }}
                                >
                                  -
                                </button>
                                <span>{it.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(idx, it.quantity + 1)}
                                  style={{ width: 22, height: 22, border: "1px solid #d1d5db", borderRadius: 4, background: "#f9fafb", cursor: "pointer" }}
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              <input
                                type="text"
                                placeholder="Misal: pedas, kuah pisah..."
                                value={it.notes}
                                onChange={(e) => handleUpdateItemNotes(idx, e.target.value)}
                                style={{ width: "100%", padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12 }}
                              />
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>
                              Rp {(it.price * it.quantity - it.discount).toLocaleString("id-ID")}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(idx, 0)}
                                style={{ background: "none", border: "none", color: "#E24B4A", cursor: "pointer" }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Order Summary & Submit */}
              <div style={{ background: "#f3f4f6", borderRadius: 12, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                    Subtotal Item: Rp {cartSubtotal.toLocaleString("id-ID")} | Diskon Promo: {discountType === "percent" ? `${discountValue}%` : ""} (-Rp {calculatedDiscount.toLocaleString("id-ID")}) | Biaya Kirim: Rp {Number(shippingFee).toLocaleString("id-ID")}
                  </p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: "#5005A6", marginTop: 4 }}>
                    Total Akhir: Rp {cartGrandTotal.toLocaleString("id-ID")}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={handleSaveDraftAndClose}
                    style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#374151" }}
                  >
                    Simpan ke Draft & Tutup
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingOrder}
                    style={{
                      padding: "10px 24px",
                      borderRadius: 8,
                      border: "none",
                      background: "linear-gradient(135deg, #5005A6 0%, #B10FBD 100%)",
                      color: "white",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {isSubmittingOrder ? "Menyimpan..." : "Simpan & Cetak Struk"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: MENU DRAFT PENJUALAN ────────────────────────── */}
      {isDraftModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              maxWidth: 640,
              width: "100%",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
          >
            {/* Header Modal */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#fafafa",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "rgba(80, 5, 166, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#5005A6",
                  }}
                >
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
                    Draft Order Penjualan ({drafts.length})
                  </h2>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                    Kelola input transaksi Siap Saji yang belum diselesaikan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDraftModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* List Body */}
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              {drafts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📥</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#374151", margin: 0 }}>
                    Belum ada draft order tersimpan
                  </h3>
                  <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6, maxWidth: 380, marginInline: "auto" }}>
                    Saat CS menginput penjualan dan belum menyelesaikannya, sistem akan menyimpan draf secara otomatis.
                  </p>
                  <button
                    onClick={() => {
                      setIsDraftModalOpen(false);
                      handleOpenCreateOrder();
                    }}
                    style={{
                      marginTop: 16,
                      background: "linear-gradient(135deg, #5005A6 0%, #B10FBD 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 18px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    + Buat Penjualan Baru
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {drafts.map((d, idx) => {
                    const totalItems = d.cartItems ? d.cartItems.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0) : 0;
                    const subtotal = d.cartItems ? d.cartItems.reduce((acc, item) => acc + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0) : 0;
                    let discount = Number(d.discountValue) || 0;
                    if (d.discountType === "percent") {
                      discount = Math.round((subtotal * discount) / 100);
                    }
                    const estimatedTotal = Math.max(0, subtotal - discount + Number(d.shippingFee || 0));

                    return (
                      <div
                        key={d.id || idx}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          padding: 16,
                          background: "#ffffff",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 16,
                          transition: "border-color 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#c084fc")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: "#1f2937" }}>
                              {d.customerName ? d.customerName : "Pelanggan Tanpa Nama"}
                            </span>
                            {d.customerPhone && (
                              <span style={{ fontSize: 12, background: "#f3f4f6", color: "#4b5563", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
                                📞 {d.customerPhone}
                              </span>
                            )}
                            <span style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
                              🕒 Tersimpan {d.savedAt}
                            </span>
                          </div>

                          <div style={{ fontSize: 13, color: "#4b5563", marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <span>
                              🛒 <strong>{totalItems} item</strong> ({d.cartItems?.length || 0} produk)
                            </span>
                            <span>
                              💰 Total Est: <strong style={{ color: "#5005A6" }}>Rp {estimatedTotal.toLocaleString("id-ID")}</strong>
                            </span>
                          </div>

                          {d.cartItems && d.cartItems.length > 0 && (
                            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              Rincian: {d.cartItems.map((it) => `${it.name} (${it.quantity}x)`).join(", ")}
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button
                            onClick={() => handleRestoreDraft(d)}
                            style={{
                              background: "linear-gradient(135deg, #5005A6 0%, #B10FBD 100%)",
                              color: "white",
                              border: "none",
                              borderRadius: 8,
                              padding: "8px 14px",
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              boxShadow: "0 2px 6px rgba(80, 5, 166, 0.2)",
                            }}
                          >
                            🚀 Lanjutkan
                          </button>
                          <button
                            onClick={(e) => handleDeleteDraft(d.id, e)}
                            title="Hapus draft"
                            style={{
                              background: "#fee2e2",
                              color: "#dc2626",
                              border: "none",
                              borderRadius: 8,
                              padding: "8px 10px",
                              fontSize: 13,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid #e5e7eb",
                background: "#fafafa",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <button
                onClick={() => {
                  setIsDraftModalOpen(false);
                  handleOpenCreateOrder();
                }}
                style={{
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + Buat Order Baru (Kosong)
              </button>
              <button
                onClick={() => setIsDraftModalOpen(false)}
                style={{
                  background: "white",
                  color: "#4b5563",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: STRUK DIGITAL PENJUALAN ────────────────────────── */}
      {selectedStruk && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              maxWidth: 440,
              width: "100%",
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }}
          >
            {/* POS 80mm Thermal Receipt Print CSS */}
            <style>{`
              @media print {
                @page {
                  size: 80mm auto; /* POS Thermal Receipt Paper Size (80mm) */
                  margin: 0;
                }
                body * {
                  visibility: hidden;
                }
                #struk-print-area, #struk-print-area * {
                  visibility: visible;
                }
                #struk-print-area {
                  position: fixed;
                  left: 0;
                  top: 0;
                  width: 80mm !important;
                  max-width: 80mm !important;
                  padding: 8px !important;
                  border: none !important;
                  box-shadow: none !important;
                  background: white !important;
                }
              }
            `}</style>

            {/* Struk Card View */}
            <div
              id="struk-print-area"
              style={{
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: 13,
                color: "#111827",
                background: "#fefefe",
                padding: 16,
                border: "1px dashed #9ca3af",
                borderRadius: 8,
                lineHeight: 1.4,
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <p style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>DYummy Catering</p>
                <p style={{ fontSize: 11, color: "#4b5563", margin: "2px 0 0" }}>
                  Jl Sindangsari 4 No 48 Kota Bandung Jawa Barat
                </p>
              </div>

              <div style={{ borderBottom: "1px dashed #9ca3af", paddingBottom: 8, marginBottom: 8, fontSize: 12 }}>
                <p style={{ margin: 0 }}>
                  <strong>{selectedStruk.no_struk}</strong> - {formatDate(selectedStruk.delivery_date)}
                </p>
              </div>

              <div style={{ borderBottom: "1px dashed #9ca3af", paddingBottom: 8, marginBottom: 8 }}>
                <p style={{ fontWeight: 700, margin: 0 }}>{selectedStruk.customer_name}</p>
                <p style={{ margin: "2px 0 0" }}>{selectedStruk.customer_address}</p>
                {selectedStruk.customer_patokan && (
                  <p style={{ margin: "2px 0 0", color: "#4b5563" }}>
                    -Patokan : {selectedStruk.customer_patokan}
                  </p>
                )}
                <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0" }}>
                  Kec. {selectedStruk.area_kecamatan || "-"} ({selectedStruk.area_kota || "-"})
                </p>
              </div>

              <table style={{ width: "100%", fontSize: 12, marginBottom: 8 }}>
                <thead>
                  <tr style={{ borderBottom: "1px dashed #9ca3af", textTransform: "uppercase" }}>
                    <th style={{ textAlign: "left", paddingBottom: 4 }}>Nama Barang</th>
                    <th style={{ textAlign: "right", paddingBottom: 4 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedStruk.items || []).map((it: any, i: number) => (
                    <tr key={i}>
                      <td style={{ paddingTop: 4 }}>
                        {it.product_name}
                        <br />
                        <span style={{ fontSize: 11, color: "#6b7280" }}>
                          {it.quantity} x {Number(it.price).toLocaleString("id-ID")}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", verticalAlign: "top", paddingTop: 4 }}>
                        {Number(it.subtotal).toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: "1px dashed #9ca3af", paddingTop: 8, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Biaya Kirim</span>
                  <span>{Number(selectedStruk.shipping_fee).toLocaleString("id-ID")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 14, marginTop: 4 }}>
                  <span>Total</span>
                  <span>Rp {Number(selectedStruk.grand_total).toLocaleString("id-ID")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#4b5563", marginTop: 4 }}>
                  <span>Pembayaran</span>
                  <span>{selectedStruk.payment_bank} ({selectedStruk.payment_account})</span>
                </div>
              </div>

              <div style={{ borderTop: "1px dashed #9ca3af", marginTop: 12, paddingTop: 6, textAlign: "center", fontSize: 11, color: "#6b7280" }}>
                Wanti Nova, {new Date(selectedStruk.created_at || Date.now()).toLocaleDateString("id-ID")}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#5005A6",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Printer size={16} /> Cetak (POS Thermal 80mm)
                </button>

                <button
                  onClick={() => window.open(`/api/siap-saji/orders/${selectedStruk.id}/pdf`, "_blank")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#b10fbd",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <FileText size={16} /> Live PDF Preview (Native)
                </button>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => copyStrukToClipboard(selectedStruk)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#f3f4f6",
                    color: "#374151",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Copy size={16} /> Salin WA
                </button>
                <button
                  onClick={() => setSelectedStruk(null)}
                  style={{ padding: "10px 18px", background: "#e5e7eb", color: "#4b5563", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PEMBATALAN ORDER ────────────────────────────── */}
      {cancelOrderTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div style={{ background: "white", borderRadius: 16, maxWidth: 440, width: "100%", padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#E24B4A", margin: 0 }}>
              Batalkan Order {cancelOrderTarget.no_struk}
            </h3>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
              Jurnal akuntansi dan mutasi kas akan di-reverse secara otomatis.
            </p>

            <div style={{ marginTop: 16, marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                Alasan Pembatalan (Wajib min. 10 karakter) *
              </label>
              <textarea
                rows={3}
                placeholder="Contoh: Customer membatalkan secara mendadak karena perubahan jadwal..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setCancelOrderTarget(null)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", fontSize: 14, cursor: "pointer" }}
              >
                Batal
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isSubmittingCancel}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#E24B4A", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                {isSubmittingCancel ? "Proses..." : "Konfirmasi Pembatalan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CETAK MASAL STRUK (BULK PRINT MULTI-PAGE) ────── */}
      {isBulkModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 130,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          {/* Modal Header & Controls Bar */}
          <div
            style={{
              background: "white",
              borderRadius: "16px 16px 0 0",
              maxWidth: 760,
              width: "100%",
              padding: "16px 24px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Printer size={20} color="#5005A6" /> Cetak Masal Struk ({bulkStrukOrders.length} Pesanan / {bulkStrukOrders.length} Halaman)
              </h2>
              <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
                1 tampilan dokumen langsung terbuat {bulkStrukOrders.length} halaman (1 pesanan per halaman saat diprint).
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f3f4f6", padding: "6px 10px", borderRadius: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>Ukuran:</span>
                <select
                  value={bulkPaperSize}
                  onChange={(e) => setBulkPaperSize(e.target.value as "80mm" | "A4")}
                  style={{ border: "none", background: "transparent", fontSize: 12, fontWeight: 700, outline: "none", cursor: "pointer" }}
                >
                  <option value="80mm">POS Thermal 80mm</option>
                  <option value="A4">A4 Portrait (Surat Jalan)</option>
                </select>
              </div>

              <button
                onClick={copyAllWA}
                style={{
                  padding: "8px 14px",
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Copy size={15} /> Salin Semua WA
              </button>

              <button
                onClick={() => {
                  const url = `/api/siap-saji/orders/bulk-pdf?ids=${selectedOrderIds.join(",")}&mode=exact`;
                  window.open(url, "_blank");
                }}
                style={{
                  padding: "8px 14px",
                  background: "#b10fbd",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <FileText size={15} /> PDF Pas Ukuran (Zero Space)
              </button>

              <button
                onClick={() => {
                  const url = `/api/siap-saji/orders/bulk-pdf?ids=${selectedOrderIds.join(",")}&mode=roll`;
                  window.open(url, "_blank");
                }}
                style={{
                  padding: "8px 14px",
                  background: "#15803d",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Printer size={15} /> PDF Roll Kontinu (Kassen BTP3100)
              </button>

              <button
                onClick={() => window.print()}
                style={{
                  padding: "8px 18px",
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
                  boxShadow: "0 4px 12px rgba(80, 5, 166, 0.25)",
                }}
              >
                <Printer size={15} /> Cetak Web ({bulkStrukOrders.length} Halaman)
              </button>

              <button
                onClick={() => setIsBulkModalOpen(false)}
                style={{ background: "#e5e7eb", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", color: "#4b5563" }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Scrollable Multi-Page Container */}
          <div
            style={{
              background: "#e2e8f0",
              maxWidth: 760,
              width: "100%",
              height: "75vh",
              overflowY: "auto",
              padding: 24,
              borderRadius: "0 0 16px 16px",
            }}
          >
            {/* CSS Print Rules for Multi-Page Page Break */}
            <style>{`
              @media print {
                @page {
                  size: ${bulkPaperSize === "80mm" ? "80mm auto" : "A4 portrait"};
                  margin: ${bulkPaperSize === "80mm" ? "0" : "10mm"};
                }
                body * {
                  visibility: hidden !important;
                }
                #bulk-struk-print-area, #bulk-struk-print-area * {
                  visibility: visible !important;
                }
                #bulk-struk-print-area {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: ${bulkPaperSize === "80mm" ? "80mm !important" : "100% !important"};
                  max-width: ${bulkPaperSize === "80mm" ? "80mm !important" : "100% !important"};
                  margin: 0 !important;
                  padding: 0 !important;
                  background: white !important;
                }
                .bulk-struk-page {
                  page-break-after: always !important;
                  break-after: page !important;
                  margin: 0 !important;
                  padding: ${bulkPaperSize === "80mm" ? "8px" : "16px"} !important;
                  border: none !important;
                  box-shadow: none !important;
                  background: white !important;
                }
                .screen-page-header {
                  display: none !important;
                }
              }
            `}</style>

            <div id="bulk-struk-print-area" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {bulkStrukOrders.map((order, index) => (
                <div key={order.id} className="bulk-struk-page">
                  {/* Screen Page Number Divider Header */}
                  <div
                    className="screen-page-header"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "#3b047a",
                      color: "white",
                      padding: "6px 14px",
                      borderRadius: "8px 8px 0 0",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <span>📄 HALAMAN {index + 1} DARI {bulkStrukOrders.length}</span>
                    <span>No Struk: {order.no_struk}</span>
                  </div>

                  {/* Individual Struk Card Content */}
                  <div
                    style={{
                      fontFamily: "'Courier New', Courier, monospace",
                      fontSize: 13,
                      color: "#111827",
                      background: "white",
                      padding: 18,
                      border: "1px dashed #9ca3af",
                      borderRadius: "0 0 8px 8px",
                      lineHeight: 1.4,
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                  >
                    <div style={{ textAlign: "center", marginBottom: 12 }}>
                      <p style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>DYummy Catering</p>
                      <p style={{ fontSize: 11, color: "#4b5563", margin: "2px 0 0" }}>
                        Jl Sindangsari 4 No 48 Kota Bandung Jawa Barat
                      </p>
                    </div>

                    <div style={{ borderBottom: "1px dashed #9ca3af", paddingBottom: 8, marginBottom: 8, fontSize: 12 }}>
                      <p style={{ margin: 0 }}>
                        <strong>{order.no_struk}</strong> - {formatDate(order.delivery_date)}
                      </p>
                    </div>

                    <div style={{ borderBottom: "1px dashed #9ca3af", paddingBottom: 8, marginBottom: 8 }}>
                      <p style={{ fontWeight: 700, margin: 0 }}>{order.customer_name}</p>
                      <p style={{ margin: "2px 0 0" }}>{order.customer_address}</p>
                      {order.customer_patokan && (
                        <p style={{ margin: "2px 0 0", color: "#4b5563" }}>
                          -Patokan : {order.customer_patokan}
                        </p>
                      )}
                      <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0" }}>
                        Kec. {order.area_kecamatan || "-"} ({order.area_kota || "-"})
                      </p>
                    </div>

                    <table style={{ width: "100%", fontSize: 12, marginBottom: 8 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px dashed #9ca3af", textTransform: "uppercase" }}>
                          <th style={{ textAlign: "left", paddingBottom: 4 }}>Nama Barang</th>
                          <th style={{ textAlign: "right", paddingBottom: 4 }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(order.items || []).map((it: any, i: number) => (
                          <tr key={i}>
                            <td style={{ paddingTop: 4 }}>
                              {it.product_name}
                              <br />
                              <span style={{ fontSize: 11, color: "#6b7280" }}>
                                {it.quantity} x {Number(it.price).toLocaleString("id-ID")}
                              </span>
                            </td>
                            <td style={{ textAlign: "right", verticalAlign: "top", paddingTop: 4 }}>
                              {Number(it.subtotal).toLocaleString("id-ID")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ borderTop: "1px dashed #9ca3af", paddingTop: 8, fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Biaya Kirim</span>
                        <span>{Number(order.shipping_fee).toLocaleString("id-ID")}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 14, marginTop: 4 }}>
                        <span>Total</span>
                        <span>Rp {Number(order.grand_total).toLocaleString("id-ID")}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#4b5563", marginTop: 4 }}>
                        <span>Pembayaran</span>
                        <span>{order.payment_bank} ({order.payment_account})</span>
                      </div>
                    </div>

                    <div style={{ borderTop: "1px dashed #9ca3af", marginTop: 12, paddingTop: 6, textAlign: "center", fontSize: 11, color: "#6b7280" }}>
                      Wanti Nova, {new Date(order.created_at || Date.now()).toLocaleDateString("id-ID")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: IMPORT EXCEL ORDER ───────────────────────────── */}
      {isImportModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              maxWidth: 760,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: 16, marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
                  📥 Import Transaksi Order via Excel (.xlsx)
                </h2>
                <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
                  Otomatis identifikasi retensi pelanggan lama (No HP) & pengelompokan porsi multi-item
                </p>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={20} />
              </button>
            </div>

            {/* Download Template Banner */}
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#166534", margin: 0 }}>
                  Belum Memiliki File Template?
                </p>
                <p style={{ fontSize: 12, color: "#15803d", margin: "2px 0 0" }}>
                  Unduh file template lengkap dengan sheet master produk, channel, area, & kas bank
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.open("/api/siap-saji/orders/import/template", "_blank")}
                style={{
                  background: "#16a34a",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                }}
              >
                <FileText size={15} /> Unduh Template (.xlsx)
              </button>
            </div>

            <form onSubmit={handleProcessImport}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                  Pilih File Excel (.xlsx / .xls) *
                </label>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  required
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 10,
                    border: "2px dashed #d1d5db",
                    fontSize: 13,
                    cursor: "pointer",
                    background: "#f9fafb",
                  }}
                />
                {importFile && (
                  <p style={{ fontSize: 12, color: "#5005A6", fontWeight: 700, marginTop: 6 }}>
                    File Terpilih: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {/* Real-time Data Preview Table */}
              {importPreviewData && importPreviewSummary && (
                <div style={{ marginBottom: 20, border: "1px solid #c084fc", borderRadius: 12, overflow: "hidden", background: "#faf5ff" }}>
                  <div style={{ padding: "10px 14px", background: "#f3e8ff", borderBottom: "1px solid #e9d5ff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#6b21a8", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      👁️ PREVIEW DATA EXCEL ({importPreviewSummary.totalOrders} Transaksi Terdeteksi)
                    </p>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#7e22ce", background: "white", padding: "2px 8px", borderRadius: 12, border: "1px solid #d8b4fe" }}>
                      {importPreviewSummary.totalRows} Baris Excel
                    </span>
                  </div>

                  <div style={{ maxHeight: 220, overflowY: "auto", padding: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "#f5f3ff", color: "#5b21b6", fontWeight: 700, borderBottom: "1px solid #ddd6fe" }}>
                          <th style={{ padding: "8px 10px" }}>Delivery</th>
                          <th style={{ padding: "8px 10px" }}>Customer & WA</th>
                          <th style={{ padding: "8px 10px" }}>Item Produk</th>
                          <th style={{ padding: "8px 10px", textAlign: "right" }}>Est. Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreviewData.map((p, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f3e8ff" }}>
                            <td style={{ padding: "8px 10px", color: "#374151", fontWeight: 600 }}>{p.deliveryDate}</td>
                            <td style={{ padding: "8px 10px" }}>
                              <p style={{ fontWeight: 700, color: "#111827", margin: 0 }}>{p.name}</p>
                              {p.phone && (
                                <a
                                  href={getWhatsAppUrl(p.phone)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: "#25D366", fontSize: 11, fontWeight: 700, textDecoration: "none" }}
                                >
                                  💬 {p.phone}
                                </a>
                              )}
                            </td>
                            <td style={{ padding: "8px 10px", color: "#4b5563", maxWidth: 260, wordBreak: "break-word" }}>
                              {p.itemsSummary}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#6b21a8" }}>
                              Rp {p.grandTotal.toLocaleString("id-ID")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importResult && (
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 14, marginBottom: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#1d4ed8", margin: "0 0 6px" }}>
                    🎉 Ringkasan Hasil Import Excel:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#1e40af", lineHeight: 1.6 }}>
                    <li>Total Baris Terbaca: <strong>{importResult.total_rows}</strong></li>
                    <li>Order/Transaksi Dibuat: <strong>{importResult.created_orders} Pesanan</strong></li>
                    <li>Total Item Produk Terpasang: <strong>{importResult.inserted_items} Item</strong></li>
                    <li>Customer Lama (Retensi No HP): <strong>{importResult.retained_customers} Pelanggan</strong></li>
                    <li>Customer Baru Terdaftar: <strong>{importResult.new_customers} Pelanggan</strong></li>
                  </ul>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={isUploadingImport || !importFile}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "linear-gradient(135deg, #5005A6 0%, #B10FBD 100%)",
                    color: "white",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: isUploadingImport || !importFile ? "not-allowed" : "pointer",
                    opacity: isUploadingImport || !importFile ? 0.6 : 1,
                  }}
                >
                  {isUploadingImport ? "Memproses Import..." : "Proses Upload & Import"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
