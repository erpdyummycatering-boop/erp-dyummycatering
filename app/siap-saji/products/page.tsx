"use client";

import { useState, useEffect, useRef } from "react";
import {
  Layers,
  Plus,
  Search,
  Filter,
  Edit3,
  Trash2,
  Tag,
  Check,
  X,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Pagination } from "@/components/ui/Pagination";

interface Category {
  id: number;
  name: string;
}

interface Channel {
  id: number;
  name: string;
}

interface Product {
  id: number;
  sku: string;
  name: string;
  category_id: number;
  category_name?: string;
  description: string;
  price: number;
  is_half_portion: boolean;
  parent_sku: string | null;
  status: string;
  channel_prices?: { channel_id: number; channel_name?: string; harga_override: number | null }[];
}

interface ParsedImportRow {
  sku: string;
  autoSkuPreview: string;
  name: string;
  category_id: number | null;
  category_name: string;
  price: number;
  is_half_portion: boolean;
  parent_sku: string;
  description: string;
  channel_prices: { channel_id: number; channel_name: string; harga_override: number | null }[];
  isValid: boolean;
  errorMsg?: string;
}

export default function SiapSajiProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [porsiFilter, setPorsiFilter] = useState("");

  // Modal Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);

  const [sku, setSku] = useState("");
  const [baseAutoSku, setBaseAutoSku] = useState("");
  const [baseAutoHalfSku, setBaseAutoHalfSku] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [isHalfPortion, setIsHalfPortion] = useState(false);
  const [parentSku, setParentSku] = useState("");
  const [channelPricesInput, setChannelPricesInput] = useState<{ [chId: number]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Category CRUD
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [isSavingCat, setIsSavingCat] = useState(false);

  // Modal Upload XLSX
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = async (page = meta.page, lim = meta.limit) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.append("page", String(page));
      q.append("limit", String(lim));
      if (search) q.append("search", search);
      if (categoryFilter) q.append("category_id", categoryFilter);
      if (porsiFilter) q.append("is_half", porsiFilter);

      const res = await fetch(`/api/siap-saji/products?${q.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat katalog produk");
      const json = await res.json();
      setProducts(json.data || []);
      setMeta({
        total: json.total || 0,
        page: json.page || page,
        limit: json.limit || lim,
        totalPages: json.totalPages || 1,
      });
      setCategories(json.categories || []);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat produk");
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const res = await fetch("/api/siap-saji/master");
      if (res.ok) {
        const json = await res.json();
        setChannels(json.channels || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/siap-saji/categories");
      if (res.ok) {
        const json = await res.json();
        setCategories(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchChannels();
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [search, categoryFilter, porsiFilter]);

  const handleOpenAdd = async () => {
    setEditingProd(null);
    setSku("");
    setName("");
    setCategoryId(categories.length > 0 ? categories[0].id : "");
    setDescription("");
    setPrice(0);
    setIsHalfPortion(false);
    setParentSku("");
    setChannelPricesInput({});
    setIsModalOpen(true);

    try {
      const res = await fetch("/api/siap-saji/products/next-sku");
      if (res.ok) {
        const json = await res.json();
        if (json.next_sku) {
          setBaseAutoSku(json.next_sku);
          setBaseAutoHalfSku(json.next_half_sku);
          setSku(json.next_sku);
        }
      }
    } catch (err) {
      console.error("Gagal auto-fetch SKU:", err);
    }
  };

  const handleToggleHalfPortion = (checked: boolean) => {
    setIsHalfPortion(checked);
    if (!editingProd && baseAutoSku) {
      if (checked && baseAutoHalfSku) {
        setSku(baseAutoHalfSku);
      } else {
        setSku(baseAutoSku);
      }
    }
  };

  const handleOpenEdit = (prod: Product) => {
    setEditingProd(prod);
    setSku(prod.sku || "");
    setName(prod.name);
    setCategoryId(prod.category_id || "");
    setDescription(prod.description || "");
    setPrice(Number(prod.price || 0));
    setIsHalfPortion(Boolean(prod.is_half_portion));
    setParentSku(prod.parent_sku || "");

    const cpInput: { [chId: number]: string } = {};
    if (prod.channel_prices) {
      prod.channel_prices.forEach((cp) => {
        if (cp.harga_override !== null && cp.harga_override !== undefined) {
          cpInput[cp.channel_id] = String(cp.harga_override);
        }
      });
    }
    setChannelPricesInput(cpInput);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku || !name || price === undefined) {
      return toast.error("SKU, Nama Produk, dan Harga Normal wajib diisi.");
    }

    setIsSubmitting(true);
    try {
      const url = editingProd ? `/api/siap-saji/products/${editingProd.id}` : "/api/siap-saji/products";
      const method = editingProd ? "PUT" : "POST";

      const channel_prices = channels.map((ch) => ({
        channel_id: ch.id,
        harga_override: channelPricesInput[ch.id] ? Number(channelPricesInput[ch.id]) : null,
      }));

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          name,
          category_id: categoryId ? Number(categoryId) : null,
          description,
          price: Number(price),
          is_half_portion: isHalfPortion,
          parent_sku: isHalfPortion ? parentSku : null,
          channel_prices,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Gagal menyimpan produk");
      }

      toast.success(editingProd ? "Produk berhasil diperbarui!" : "Produk baru berhasil ditambahkan!");
      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan produk");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ──────────────────────────────────────────────────────────
  // EXCEL SAMPLE TEMPLATE GENERATION
  // ──────────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // 1. Main Data Sheet: Katalog_Produk
    const channelHeaders = channels.map((ch) => `Harga ${ch.name} (ID: ${ch.id})`);
    const headers = [
      "SKU",
      "Nama Produk",
      "ID Kategori",
      "Nama Kategori",
      "Harga Normal (Rp)",
      "Varian Porsi",
      "Parent SKU",
      "Deskripsi",
      ...channelHeaders,
    ];

    const catAyam = categories.find((c) => c.name.toLowerCase().includes("ayam")) || categories[0] || { id: 1, name: "Lauk Ayam" };
    const catDaging = categories.find((c) => c.name.toLowerCase().includes("daging")) || categories[1] || { id: 2, name: "Lauk Daging" };

    const sampleRow1 = [
      "", // Left empty for automatic SKU generation (e.g. SP-A07)
      "Ayam Bakar Madu Special",
      catAyam.id,
      catAyam.name,
      95000,
      "Penuh",
      "",
      "Ayam bakar bumbu madu pilihan porsi utuh",
      ...channels.map((ch) => (ch.name.toLowerCase().includes("marketplace") ? 115000 : "")),
    ];

    const sampleRow2 = [
      "", // Left empty for auto SKU (e.g. SP-A07H)
      "Ayam Bakar Madu Special (½ Porsi)",
      catAyam.id,
      catAyam.name,
      50000,
      "Setengah",
      "SP-A07",
      "Varian setengah porsi ayam bakar madu",
      ...channels.map((ch) => (ch.name.toLowerCase().includes("marketplace") ? 60000 : "")),
    ];

    const sampleRow3 = [
      "SP-D05", // Manual SKU example
      "Empal Gentong Daging Sapi",
      catDaging.id,
      catDaging.name,
      85000,
      "Penuh",
      "",
      "Empal gentong daging kuah santan gurih",
      ...channels.map(() => ""),
    ];

    const wsData = XLSX.utils.aoa_to_sheet([headers, sampleRow1, sampleRow2, sampleRow3]);
    wsData["!cols"] = [
      { wch: 14 },
      { wch: 32 },
      { wch: 14 },
      { wch: 22 },
      { wch: 18 },
      { wch: 15 },
      { wch: 14 },
      { wch: 35 },
      ...channels.map(() => ({ wch: 26 })),
    ];
    XLSX.utils.book_append_sheet(wb, wsData, "Katalog_Produk");

    // 2. Reference Sheet: Referensi_Kategori
    const catHeaders = ["ID Kategori", "Nama Kategori", "Petunjuk Kodifikasi"];
    const catRows = categories.map((c) => [c.id, c.name, `Gunakan ID '${c.id}' untuk kategori ${c.name}`]);
    const wsCat = XLSX.utils.aoa_to_sheet([catHeaders, ...catRows]);
    wsCat["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, wsCat, "Referensi_Kategori");

    // 3. Reference Sheet: Referensi_Channel
    const chHeaders = ["ID Channel", "Nama Channel", "Format Header Kolom", "Keterangan"];
    const chRows = channels.map((ch) => [
      ch.id,
      ch.name,
      `Harga ${ch.name} (ID: ${ch.id})`,
      "Isi nominal harga khusus channel ini. Kosongkan jika menggunakan Harga Normal.",
    ]);
    const wsCh = XLSX.utils.aoa_to_sheet([chHeaders, ...chRows]);
    wsCh["!cols"] = [{ wch: 14 }, { wch: 25 }, { wch: 32 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsCh, "Referensi_Channel");

    // 4. Reference Sheet: Petunjuk_Pengisian
    const guideRows = [
      ["PANDUAN & PETUNJUK IMPOR PRODUK SIAP SAJI"],
      [""],
      ["Nama Kolom", "Status", "Panduan Pengisian Data"],
      ["SKU", "Opsional", "Kosongkan jika ingin sistem secara otomatis men-generate SKU (contoh: SP-A07 / SP-A07H)."],
      ["Nama Produk", "Wajib", "Nama lengkap produk retail."],
      ["ID Kategori", "Rekomendasi", "Isi dengan angka ID Kategori sesuai tabel di sheet 'Referensi_Kategori'."],
      ["Nama Kategori", "Opsional", "Nama kategori produk. Jika ID Kategori kosong, sistem otomatis mencocokkan nama ini."],
      ["Harga Normal (Rp)", "Wajib", "Harga dasar porsi penuh dalam angka tanpa titik/Rp (contoh: 100000)."],
      ["Varian Porsi", "Wajib", "Isi 'Penuh' untuk porsi utuh, atau 'Setengah' / '½ Porsi' / '1/2' untuk varian setengah."],
      ["Parent SKU", "Opsional", "Jika Varian Porsi = 'Setengah', isi SKU dari produk porsi penuhnya."],
      ["Harga Channel", "Opsional", "Isi override harga di kolom 'Harga [Channel] (ID: X)'. Kosongkan jika sama dengan Harga Normal."],
    ];
    const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
    wsGuide["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, "Petunjuk_Pengisian");

    XLSX.writeFile(wb, "Template_Import_Produk_SiapSaji.xlsx");
    toast.success("Template sample Excel berhasil diunduh!");
  };

  // ──────────────────────────────────────────────────────────
  // PARSE UPLOADED EXCEL FILE
  // ──────────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const sheetName = wb.SheetNames.includes("Katalog_Produk") ? "Katalog_Produk" : wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rawData.length < 2) {
          toast.error("File Excel kosong atau tidak memiliki baris data.");
          return;
        }

        const headers: string[] = rawData[0].map((h) => String(h || "").trim());

        // Find column indices
        const skuIdx = headers.findIndex((h) => /^sku$/i.test(h));
        const nameIdx = headers.findIndex((h) => /nama\s*produk/i.test(h) || /^name$/i.test(h));
        const catIdIdx = headers.findIndex((h) => /id\s*kategori/i.test(h) || /category_id/i.test(h));
        const catNameIdx = headers.findIndex((h) => /nama\s*kategori/i.test(h) || /category_name/i.test(h));
        const priceIdx = headers.findIndex((h) => /harga\s*normal/i.test(h) || /price/i.test(h));
        const porsiIdx = headers.findIndex((h) => /porsi|varian/i.test(h));
        const parentSkuIdx = headers.findIndex((h) => /parent\s*sku/i.test(h));
        const descIdx = headers.findIndex((h) => /deskripsi|description/i.test(h));

        // Find Channel columns in header by ID pattern e.g. (ID: 1) or channel names
        const channelColMap: { colIdx: number; channelId: number; channelName: string }[] = [];
        headers.forEach((h, colIdx) => {
          const matchId = h.match(/\(ID:\s*(\d+)\)/i);
          if (matchId) {
            const chId = parseInt(matchId[1], 10);
            const foundCh = channels.find((c) => c.id === chId);
            if (foundCh) {
              channelColMap.push({ colIdx, channelId: foundCh.id, channelName: foundCh.name });
            }
          } else {
            // Check by exact channel name match
            const foundCh = channels.find((c) => h.toLowerCase().includes(c.name.toLowerCase()));
            if (foundCh) {
              channelColMap.push({ colIdx, channelId: foundCh.id, channelName: foundCh.name });
            }
          }
        });

        const rowsParsed: ParsedImportRow[] = [];
        let autoSkuCounter = 1;

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0 || row.every((c) => c === undefined || c === null || String(c).trim() === "")) {
            continue; // Skip empty rows
          }

          const rawSku = skuIdx >= 0 ? String(row[skuIdx] || "").trim() : "";
          const prodName = nameIdx >= 0 ? String(row[nameIdx] || "").trim() : "";
          const rawCatId = catIdIdx >= 0 && row[catIdIdx] !== undefined && row[catIdIdx] !== null ? Number(row[catIdIdx]) : null;
          const catNameVal = catNameIdx >= 0 ? String(row[catNameIdx] || "").trim() : "";
          const priceVal = priceIdx >= 0 ? Number(row[priceIdx] || 0) : 0;
          const porsiVal = porsiIdx >= 0 ? String(row[porsiIdx] || "").trim().toLowerCase() : "";
          const parentSkuVal = parentSkuIdx >= 0 ? String(row[parentSkuIdx] || "").trim() : "";
          const descVal = descIdx >= 0 ? String(row[descIdx] || "").trim() : "";

          const isHalf = porsiVal.includes("setengah") || porsiVal.includes("½") || porsiVal.includes("1/2") || porsiVal.includes("half") || porsiVal === "true" || porsiVal === "1";

          // Match Category Name if catId is null
          let matchedCatName = catNameVal;
          if (rawCatId) {
            const foundCat = categories.find((c) => c.id === rawCatId);
            if (foundCat) matchedCatName = foundCat.name;
          } else if (catNameVal) {
            const foundCat = categories.find((c) => c.name.toLowerCase() === catNameVal.toLowerCase());
            if (foundCat) matchedCatName = foundCat.name;
          }

          // Channel price overrides
          const chPrices: { channel_id: number; channel_name: string; harga_override: number | null }[] = [];
          channelColMap.forEach((cMap) => {
            const cellVal = row[cMap.colIdx];
            const numVal = cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== "" ? Number(cellVal) : null;
            chPrices.push({
              channel_id: cMap.channelId,
              channel_name: cMap.channelName,
              harga_override: numVal !== null && !isNaN(numVal) ? numVal : null,
            });
          });

          // SKU Preview
          let autoSkuPreview = rawSku;
          if (!rawSku) {
            autoSkuPreview = isHalf ? `SP-A[AUTO]H` : `SP-A[AUTO]`;
            autoSkuCounter++;
          }

          // SKU & Name check against existing products
          const existingSkuMatch = rawSku ? products.find((p) => p.sku.toLowerCase() === rawSku.toLowerCase()) : null;
          const existingNameMatch = products.find((p) => p.name.toLowerCase() === prodName.toLowerCase());

          let isValid = Boolean(prodName) && priceVal >= 0;
          let errorMsg = "";
          if (!prodName) {
            errorMsg = "Nama Produk wajib diisi";
          } else if (existingSkuMatch) {
            isValid = false;
            errorMsg = `SKU '${rawSku}' sudah digunakan produk '${existingSkuMatch.name}'`;
          } else if (existingNameMatch) {
            isValid = false;
            errorMsg = `Nama produk '${prodName}' sudah terdaftar (${existingNameMatch.sku})`;
          }

          rowsParsed.push({
            sku: rawSku,
            autoSkuPreview,
            name: prodName,
            category_id: rawCatId && !isNaN(rawCatId) ? rawCatId : null,
            category_name: matchedCatName,
            price: priceVal,
            is_half_portion: isHalf,
            parent_sku: parentSkuVal,
            description: descVal,
            channel_prices: chPrices,
            isValid,
            errorMsg,
          });
        }

        // Secondary pass: Check internal duplicates within uploaded file
        const skuCounts = new Map<string, number>();
        const nameCounts = new Map<string, number>();
        rowsParsed.forEach((r) => {
          if (r.sku) skuCounts.set(r.sku.toLowerCase(), (skuCounts.get(r.sku.toLowerCase()) || 0) + 1);
          if (r.name) nameCounts.set(r.name.toLowerCase(), (nameCounts.get(r.name.toLowerCase()) || 0) + 1);
        });

        rowsParsed.forEach((r) => {
          if (r.sku && (skuCounts.get(r.sku.toLowerCase()) || 0) > 1) {
            r.isValid = false;
            r.errorMsg = `SKU '${r.sku}' ganda dalam file Excel`;
          } else if (r.name && (nameCounts.get(r.name.toLowerCase()) || 0) > 1) {
            r.isValid = false;
            r.errorMsg = `Nama produk '${r.name}' ganda dalam file Excel`;
          }
        });

        setParsedRows(rowsParsed);
      } catch (err: any) {
        console.error("Gagal membaca file Excel:", err);
        toast.error("Gagal membaca file Excel: " + (err.message || "Format file tidak valid"));
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleProcessImport = async () => {
    if (parsedRows.length === 0) return toast.error("Belum ada data produk yang di-parse.");

    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) return toast.error("Semua baris data memiliki kesalahan.");

    setIsImporting(true);

    try {
      const payload = {
        products: validRows.map((r) => ({
          sku: r.sku,
          name: r.name,
          category_id: r.category_id,
          category_name: r.category_name,
          price: r.price,
          is_half_portion: r.is_half_portion,
          parent_sku: r.parent_sku,
          description: r.description,
          channel_prices: r.channel_prices,
        })),
      };

      const res = await fetch("/api/siap-saji/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Gagal mengimpor produk");
      }

      const json = await res.json();
      toast.success(`Berhasil mengimpor ${json.count || validRows.length} produk Siap Saji!`);
      setIsUploadModalOpen(false);
      setParsedRows([]);
      setFileName("");
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat mengimpor produk");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.02em" }}>
            Katalog Produk Siap Saji
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Kelola SKU produk retail, varian ½ porsi, dan penyesuaian harga per channel
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setIsCatModalOpen(true)}
            style={{
              background: "#f9f5ff",
              color: "#5005A6",
              border: "1.5px solid #d8b4fe",
              borderRadius: 10,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Tag size={18} /> Kelola Kategori
          </button>

          <button
            onClick={() => {
              setParsedRows([]);
              setFileName("");
              setIsUploadModalOpen(true);
            }}
            style={{
              background: "#ffffff",
              color: "#5005A6",
              border: "1.5px solid #5005A6",
              borderRadius: 10,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.2s",
            }}
          >
            <Upload size={18} /> Import XLSX
          </button>

          <button
            onClick={handleOpenAdd}
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
            }}
          >
            <Plus size={18} /> Tambah Produk
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
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
          overflowX: "auto",
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ flex: "1 1 240px", minWidth: 180, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Cari SKU atau Nama Produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "7px 12px 7px 34px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }}
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ width: 160, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white", flexShrink: 0 }}
        >
          <option value="">Semua Kategori</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <select
          value={porsiFilter}
          onChange={(e) => setPorsiFilter(e.target.value)}
          style={{ width: 160, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white", flexShrink: 0 }}
        >
          <option value="">Semua Varian Porsi</option>
          <option value="false">Porsi Penuh</option>
          <option value="true">½ Porsi</option>
        </select>
      </div>

      {/* Products Table */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14, whiteSpace: "nowrap" }}>
          <thead>
            <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>
              <th style={{ padding: "12px 16px", width: 50 }}>No.</th>
              <th style={{ padding: "12px 16px" }}>SKU</th>
              <th style={{ padding: "12px 16px" }}>Nama Produk</th>
              <th style={{ padding: "12px 16px" }}>Kategori</th>
              <th style={{ padding: "12px 16px" }}>Varian Porsi</th>
              <th style={{ padding: "12px 16px" }}>Harga Normal</th>
              <th style={{ padding: "12px 16px" }}>Harga Channel</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  Memuat katalog produk...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  Tidak ada produk Siap Saji ditemukan.
                </td>
              </tr>
            ) : (
              products.map((p, idx) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "14px 16px", color: "#6b7280" }}>{(meta.page - 1) * meta.limit + idx + 1}</td>
                  <td style={{ padding: "14px 16px", fontFamily: "monospace", fontWeight: 700, color: "#5005A6" }}>
                    {p.sku || "-"}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <p style={{ fontWeight: 700, color: "#111827", margin: 0 }}>{p.name}</p>
                    {p.description && <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>{p.description}</p>}
                  </td>
                  <td style={{ padding: "14px 16px", color: "#4b5563" }}>{p.category_name || "-"}</td>
                  <td style={{ padding: "14px 16px" }}>
                    {p.is_half_portion ? (
                      <span style={{ padding: "3px 8px", background: "#fdf4ff", color: "#b10fbd", border: "1px solid #f5d0fe", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                        ½ Porsi {p.parent_sku ? `(${p.parent_sku})` : ""}
                      </span>
                    ) : (
                      <span style={{ padding: "3px 8px", background: "#f3f4f6", color: "#4b5563", borderRadius: 6, fontSize: 12 }}>
                        Penuh
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 800, color: "#111827" }}>
                    Rp {Number(p.price).toLocaleString("id-ID")}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 12 }}>
                    {p.channel_prices && p.channel_prices.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {p.channel_prices.map((cp, i) =>
                          cp.harga_override !== null ? (
                            <span key={i} style={{ background: "#eff6ff", color: "#1d4ed8", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                              {cp.channel_name}: Rp{Number(cp.harga_override).toLocaleString("id-ID")}
                            </span>
                          ) : null
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "#9ca3af" }}>Normal</span>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right" }}>
                    <button
                      onClick={() => handleOpenEdit(p)}
                      style={{ padding: "6px 12px", background: "#5005A6", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      <Edit3 size={14} /> Edit
                    </button>
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
          onChange={(p) => fetchProducts(p, meta.limit)}
          onLimitChange={(lim) => fetchProducts(1, lim)}
        />
      </div>

      {/* ── MODAL: UPLOAD / IMPORT XLSX ──────────────────────────── */}
      {isUploadModalOpen && (
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
          <div style={{ background: "white", borderRadius: 16, maxWidth: 900, width: "100%", padding: 24, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            {/* Header Modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <FileSpreadsheet color="#5005A6" size={22} /> Import Produk dari Excel (.xlsx)
                </h3>
                <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
                  Gunakan template sample multi-sheet untuk pengisian kode kategori & ID channel dengan tepat.
                </p>
              </div>
              <button onClick={() => setIsUploadModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={20} />
              </button>
            </div>

            {/* Action Buttons & Dropzone */}
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16, border: "1px dashed #cbd5e1", marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", display: "block", marginBottom: 4 }}>
                  1. Unduh Template XLSX Sample
                </span>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Terdiri dari sheet Katalog Data, Referensi Kategori, Referensi Channel & Panduan
                </span>
              </div>
              <button
                onClick={handleDownloadTemplate}
                style={{
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Download size={16} /> Unduh Template Sample
              </button>
            </div>

            <div style={{ background: "#f9fafb", borderRadius: 12, padding: 20, border: "2px dashed #d1d5db", textAlign: "center", marginBottom: 16 }}>
              <Upload size={32} color="#9ca3af" style={{ margin: "0 auto 8px" }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: "#374151", margin: 0 }}>
                2. Pilih atau Drop File Excel (.xlsx / .xls)
              </p>
              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                {fileName ? `File terpilih: ${fileName}` : "Format didukung: .xlsx, .xls"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  marginTop: 10,
                  padding: "8px 20px",
                  background: "#5005A6",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Pilih File Excel
              </button>
            </div>

            {/* Preview Table */}
            {parsedRows.length > 0 && (
              <div style={{ flex: 1, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 16 }}>
                <div style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                    Pratinjau Hasil Parsing ({parsedRows.length} Produk)
                  </span>
                  <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
                    <CheckCircle2 size={14} style={{ display: "inline", marginRight: 4 }} />
                    {parsedRows.filter((r) => r.isValid).length} Baris Valid
                  </span>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left", whiteSpace: "nowrap" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", color: "#475569", fontWeight: 700 }}>
                      <th style={{ padding: "8px 12px" }}>No.</th>
                      <th style={{ padding: "8px 12px" }}>SKU Status</th>
                      <th style={{ padding: "8px 12px" }}>Nama Produk</th>
                      <th style={{ padding: "8px 12px" }}>Kategori</th>
                      <th style={{ padding: "8px 12px" }}>Varian Porsi</th>
                      <th style={{ padding: "8px 12px" }}>Harga Normal</th>
                      <th style={{ padding: "8px 12px" }}>Harga Channel Overrides</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", background: row.isValid ? "white" : "#fff1f2" }}>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>{idx + 1}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <input
                            type="text"
                            value={row.sku}
                            placeholder={row.autoSkuPreview}
                            onChange={(e) => {
                              const newSku = e.target.value;
                              const updated = [...parsedRows];
                              updated[idx].sku = newSku;
                              // re-validate
                              const existingSku = newSku ? products.find((p) => p.sku.toLowerCase() === newSku.toLowerCase()) : null;
                              if (existingSku) {
                                updated[idx].isValid = false;
                                updated[idx].errorMsg = `SKU '${newSku}' sudah terpakai oleh '${existingSku.name}'`;
                              } else {
                                updated[idx].isValid = Boolean(updated[idx].name);
                                updated[idx].errorMsg = updated[idx].name ? "" : "Nama Produk wajib diisi";
                              }
                              setParsedRows(updated);
                            }}
                            style={{
                              width: 90,
                              padding: "4px 8px",
                              fontSize: 12,
                              fontFamily: "monospace",
                              fontWeight: 700,
                              border: row.errorMsg && row.errorMsg.includes("SKU") ? "1px solid #ef4444" : "1px solid #d1d5db",
                              borderRadius: 6,
                            }}
                          />
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => {
                              const newName = e.target.value;
                              const updated = [...parsedRows];
                              updated[idx].name = newName;
                              const existingName = products.find((p) => p.name.toLowerCase() === newName.toLowerCase());
                              if (existingName) {
                                updated[idx].isValid = false;
                                updated[idx].errorMsg = `Nama '${newName}' sudah terdaftar`;
                              } else {
                                updated[idx].isValid = Boolean(newName) && !updated[idx].errorMsg?.includes("SKU");
                                updated[idx].errorMsg = newName ? "" : "Nama Produk wajib diisi";
                              }
                              setParsedRows(updated);
                            }}
                            style={{
                              width: "100%",
                              minWidth: 150,
                              padding: "4px 8px",
                              fontSize: 12,
                              fontWeight: 600,
                              border: row.errorMsg && row.errorMsg.includes("Nama") ? "1px solid #ef4444" : "1px solid #d1d5db",
                              borderRadius: 6,
                            }}
                          />
                          {row.errorMsg && (
                            <div style={{ fontSize: 10, color: "#dc2626", marginTop: 2, fontWeight: 600 }}>
                              ⚠️ {row.errorMsg}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {row.category_name ? (
                            <span>{row.category_name} {row.category_id ? `(#${row.category_id})` : ""}</span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {row.is_half_portion ? (
                            <span style={{ padding: "2px 6px", background: "#fdf4ff", color: "#b10fbd", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                              ½ Porsi {row.parent_sku ? `(${row.parent_sku})` : ""}
                            </span>
                          ) : (
                            <span style={{ padding: "2px 6px", background: "#f1f5f9", color: "#475569", borderRadius: 4, fontSize: 11 }}>
                              Penuh
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px 12px", fontWeight: 700 }}>
                          Rp {Number(row.price).toLocaleString("id-ID")}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {row.channel_prices && row.channel_prices.some((cp) => cp.harga_override !== null) ? (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {row.channel_prices.map((cp, i) =>
                                cp.harga_override !== null ? (
                                  <span key={i} style={{ background: "#eff6ff", color: "#1d4ed8", padding: "1px 5px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                    {cp.channel_name}: Rp{Number(cp.harga_override).toLocaleString("id-ID")}
                                  </span>
                                ) : null
                              )}
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>Normal</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer Modal */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", fontSize: 14, cursor: "pointer" }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleProcessImport}
                disabled={isImporting || parsedRows.length === 0}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: parsedRows.length > 0 ? "#5005A6" : "#9ca3af",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: parsedRows.length > 0 ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {isImporting ? "Memproses Import..." : `Proses Import (${parsedRows.filter((r) => r.isValid).length} Produk)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT PRODUCT ────────────────────────────── */}
      {isModalOpen && (
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
          <div style={{ background: "white", borderRadius: 16, maxWidth: 600, width: "100%", padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
                {editingProd ? "Edit Produk Siap Saji" : "Tambah Produk Siap Saji"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    SKU Unik *
                  </label>
                  <input
                    type="text"
                    placeholder="SP-A01 / SP-A01H"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "monospace" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Nama Produk *
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Ayam Goreng Terasi Jeruk"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Kategori Produk
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Harga Normal (Rp) *
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                  />
                </div>
              </div>

              {/* Varian Porsi Toggle */}
              <div style={{ background: "#fdf4ff", border: "1px solid #f5d0fe", borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 700, color: "#b10fbd", fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={isHalfPortion}
                    onChange={(e) => handleToggleHalfPortion(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "#b10fbd" }}
                  />
                  Produk ini Varian ½ Porsi (SKU terpisah & harga berbeda)
                </label>

                {isHalfPortion && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                      Parent SKU Porsi Penuh
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: SP-A01"
                      value={parentSku}
                      onChange={(e) => setParentSku(e.target.value)}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, fontFamily: "monospace" }}
                    />
                  </div>
                )}
              </div>

              {/* Channel Pricing Override */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                  Harga Override per Channel (Opsional)
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "#f9fafb", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}>
                  {channels.map((ch) => (
                    <div key={ch.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{ch.name}:</span>
                      <input
                        type="number"
                        placeholder="Biarkan kosong jika sama"
                        value={channelPricesInput[ch.id] || ""}
                        onChange={(e) =>
                          setChannelPricesInput({
                            ...channelPricesInput,
                            [ch.id]: e.target.value,
                          })
                        }
                        style={{ width: 200, padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", fontSize: 14, cursor: "pointer" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5005A6", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  {isSubmitting ? "Simpan..." : "Simpan Produk"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CATEGORY CRUD ────────────────────────────── */}
      {isCatModalOpen && (
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
          <div style={{ background: "white", borderRadius: 16, maxWidth: 500, width: "100%", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
                Kelola Kategori Siap Saji
              </h3>
              <button onClick={() => setIsCatModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={20} />
              </button>
            </div>

            {/* Form Add / Edit Category */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Nama Kategori Baru..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
              />
              <button
                type="button"
                disabled={isSavingCat || !newCatName.trim()}
                onClick={async () => {
                  if (!newCatName.trim()) return;
                  setIsSavingCat(true);
                  try {
                    const url = editingCat ? `/api/siap-saji/categories/${editingCat.id}` : "/api/siap-saji/categories";
                    const method = editingCat ? "PUT" : "POST";
                    const res = await fetch(url, {
                      method,
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: newCatName }),
                    });
                    if (!res.ok) {
                      const err = await res.json();
                      throw new Error(err.error || "Gagal menyimpan kategori");
                    }
                    toast.success(editingCat ? "Kategori berhasil diperbarui" : "Kategori baru berhasil ditambahkan");
                    setNewCatName("");
                    setEditingCat(null);
                    fetchCategories();
                  } catch (e: any) {
                    toast.error(e.message);
                  } finally {
                    setIsSavingCat(false);
                  }
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "#5005A6",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {editingCat ? "Update" : "+ Tambah"}
              </button>
              {editingCat && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCat(null);
                    setNewCatName("");
                  }}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", fontSize: 13, cursor: "pointer" }}
                >
                  Batal
                </button>
              )}
            </div>

            {/* List Existing Categories */}
            <div style={{ maxHeight: 250, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
              {categories.length === 0 ? (
                <div style={{ padding: 12, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                  Belum ada kategori khusus Siap Saji.
                </div>
              ) : (
                categories.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderBottom: "1px solid #f3f4f6",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "#1f2937", fontSize: 14 }}>{c.name}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCat(c);
                          setNewCatName(c.name);
                        }}
                        style={{ background: "none", border: "none", color: "#378ADD", cursor: "pointer", padding: 4 }}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Hapus kategori '${c.name}'?`)) return;
                          try {
                            const res = await fetch(`/api/siap-saji/categories/${c.id}`, { method: "DELETE" });
                            if (res.ok) {
                              toast.success("Kategori berhasil dihapus");
                              fetchCategories();
                            } else {
                              const err = await res.json();
                              toast.error(err.error || "Gagal menghapus kategori");
                            }
                          } catch (err: any) {
                            toast.error(err.message);
                          }
                        }}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
