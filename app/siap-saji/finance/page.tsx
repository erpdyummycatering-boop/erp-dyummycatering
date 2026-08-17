"use client";

import { useState, useEffect, Fragment } from "react";
import { CreditCard, DollarSign, Plus, FileText, PieChart, BookOpen, ArrowUpRight, ArrowDownLeft, X, CheckCircle, RefreshCw, Search, Edit3, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/Pagination";
import { formatDate } from "@/lib/utils";

export default function SiapSajiFinancePage() {
  const [activeTab, setActiveTab] = useState<"pl" | "purchases" | "expenses" | "kas_bank" | "journals" | "coa" | "neraca">("pl");

  const [loading, setLoading] = useState(true);
  const [neracaData, setNeracaData] = useState<any[]>([]);

  // Thousand Separator Formatter Helpers
  const formatThousand = (val: number | string) => {
    if (val === "" || val === undefined || val === null || val === 0) return "";
    const num = typeof val === "number" ? val : Number(String(val).replace(/[^0-9]/g, ""));
    if (isNaN(num) || num === 0) return "";
    return num.toLocaleString("id-ID");
  };

  const parseThousand = (str: string): number => {
    const clean = str.replace(/[^0-9]/g, "");
    return clean ? Number(clean) : 0;
  };

  // Pagination states
  const [purPage, setPurPage] = useState(1);
  const [purLimit, setPurLimit] = useState(10);
  const [expPage, setExpPage] = useState(1);
  const [expLimit, setExpLimit] = useState(10);
  const [mutPage, setMutPage] = useState(1);
  const [mutLimit, setMutLimit] = useState(10);
  const [jouPage, setJouPage] = useState(1);
  const [jouLimit, setJouLimit] = useState(10);

  // Tab 1: P&L Data
  const [plData, setPlData] = useState<any>(null);

  // Tab 2: Purchases Data & Filters
  const [purchases, setPurchases] = useState<any[]>([]);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [purchaseNotaRef, setPurchaseNotaRef] = useState("");
  const [purchaseKeterangan, setPurchaseKeterangan] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState<number>(0);
  const [purchaseCoaId, setPurchaseCoaId] = useState<number | "">("");
  const [purchaseKasBankId, setPurchaseKasBankId] = useState<number | "hutang" | "">("");
  const [purSearch, setPurSearch] = useState("");
  const [purDateFrom, setPurDateFrom] = useState("");
  const [purDateTo, setPurDateTo] = useState("");

  // Tab 3: Expenses Data & Filters
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [expenseKeterangan, setExpenseKeterangan] = useState("");
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseCoaId, setExpenseCoaId] = useState<number | "">("");
  const [expenseKasBankId, setExpenseKasBankId] = useState<number | "hutang" | "">("");
  const [expSearch, setExpSearch] = useState("");
  const [expDateFrom, setExpDateFrom] = useState("");
  const [expDateTo, setExpDateTo] = useState("");

  // Tab 4: Kas & Bank Data & Filters
  const [accounts, setAccounts] = useState<any[]>([]);
  const [mutasi, setMutasi] = useState<any[]>([]);
  const [coaList, setCoaList] = useState<any[]>([]);
  const [mutSearch, setMutSearch] = useState("");
  const [mutJenisFilter, setMutJenisFilter] = useState("");
  const [mutDateFrom, setMutDateFrom] = useState("");
  const [mutDateTo, setMutDateTo] = useState("");

  // Tab 5: Journals Data & Filters
  const [journals, setJournals] = useState<any[]>([]);
  const [jouSearch, setJouSearch] = useState("");
  const [jouTypeFilter, setJouTypeFilter] = useState("");
  const [jouDateFrom, setJouDateFrom] = useState("");
  const [jouDateTo, setJouDateTo] = useState("");

  // Tab 6: COA Data & Filters
  const [coaListAll, setCoaListAll] = useState<any[]>([]);
  const [coaPage, setCoaPage] = useState(1);
  const [coaLimit, setCoaLimit] = useState(10);
  const [coaSearch, setCoaSearch] = useState("");
  const [coaKelompokFilter, setCoaKelompokFilter] = useState("");
  const [isCoaModalOpen, setIsCoaModalOpen] = useState(false);
  const [editingCoa, setEditingCoa] = useState<any | null>(null);
  const [coaFormCode, setCoaFormCode] = useState("");
  const [coaFormName, setCoaFormName] = useState("");
  const [coaFormKelompok, setCoaFormKelompok] = useState("Aset");
  const [coaFormSubKelompok, setCoaFormSubKelompok] = useState("Aset Lancar");
  const [coaFormActive, setCoaFormActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Master Accounts & Kas Bank
  const fetchKasBankMaster = async () => {
    try {
      const q = new URLSearchParams({
        search: mutSearch,
        jenis: mutJenisFilter,
        date_from: mutDateFrom,
        date_to: mutDateTo,
      }).toString();
      const res = await fetch(`/api/siap-saji/finance/kas-bank?${q}`);
      if (res.ok) {
        const json = await res.json();
        setAccounts(json.accounts || []);
        setMutasi(json.mutasi || []);
        setCoaList(json.coa || []);

        if (json.accounts?.length > 0) {
          if (!purchaseKasBankId) setPurchaseKasBankId(json.accounts[0].id);
          if (!expenseKasBankId) setExpenseKasBankId(json.accounts[0].id);
        }

        if (json.coa?.length > 0) {
          const defaultHpp = json.coa.find((c: any) => c.kode_akun === "5-1001");
          if (defaultHpp && !purchaseCoaId) setPurchaseCoaId(defaultHpp.id);

          const defaultExpense = json.coa.find((c: any) => c.kode_akun.startsWith("6-"));
          if (defaultExpense && !expenseCoaId) setExpenseCoaId(defaultExpense.id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === "pl") {
        const res = await fetch("/api/siap-saji/finance/reports?type=pl");
        if (res.ok) setPlData(await res.json());
      } else if (activeTab === "purchases") {
        const q = new URLSearchParams({
          page: String(purPage),
          limit: String(purLimit),
          search: purSearch,
          date_from: purDateFrom,
          date_to: purDateTo,
        }).toString();
        const res = await fetch(`/api/siap-saji/finance/purchases?${q}`);
        if (res.ok) {
          const json = await res.json();
          setPurchases(json.data || []);
        }
      } else if (activeTab === "expenses") {
        const q = new URLSearchParams({
          page: String(expPage),
          limit: String(expLimit),
          search: expSearch,
          date_from: expDateFrom,
          date_to: expDateTo,
        }).toString();
        const res = await fetch(`/api/siap-saji/finance/expenses?${q}`);
        if (res.ok) {
          const json = await res.json();
          setExpenses(json.data || []);
        }
      } else if (activeTab === "kas_bank") {
        await fetchKasBankMaster();
      } else if (activeTab === "journals") {
        const q = new URLSearchParams({
          type: "journals",
          search: jouSearch,
          ref_type: jouTypeFilter,
          date_from: jouDateFrom,
          date_to: jouDateTo,
        }).toString();
        const res = await fetch(`/api/siap-saji/finance/reports?${q}`);
        if (res.ok) setJournals(await res.json());
      } else if (activeTab === "coa") {
        const q = new URLSearchParams({
          search: coaSearch,
          kelompok: coaKelompokFilter,
        }).toString();
        const res = await fetch(`/api/siap-saji/finance/coa?${q}`);
        if (res.ok) {
          const json = await res.json();
          setCoaListAll(json.data || []);
        }
      } else if (activeTab === "neraca") {
        const res = await fetch("/api/siap-saji/finance/reports?type=neraca");
        if (res.ok) setNeracaData(await res.json());
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat data keuangan");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddCoa = () => {
    setEditingCoa(null);
    setCoaFormCode("");
    setCoaFormName("");
    setCoaFormKelompok("Aset");
    setCoaFormSubKelompok("Aset Lancar");
    setCoaFormActive(true);
    setIsCoaModalOpen(true);
  };

  const handleOpenEditCoa = (c: any) => {
    setEditingCoa(c);
    setCoaFormCode(c.kode_akun);
    setCoaFormName(c.nama_akun);
    setCoaFormKelompok(c.kelompok || "Aset");
    setCoaFormSubKelompok(c.sub_kelompok || "Aset Lancar");
    setCoaFormActive(c.is_active !== false);
    setIsCoaModalOpen(true);
  };

  const handleSaveCoa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coaFormCode || !coaFormName || !coaFormKelompok) {
      return toast.error("Kode Akun, Nama Akun, dan Kelompok wajib diisi.");
    }
    setIsSubmitting(true);
    try {
      const method = editingCoa ? "PUT" : "POST";
      const payload = {
        id: editingCoa?.id,
        kode_akun: coaFormCode,
        nama_akun: coaFormName,
        kelompok: coaFormKelompok,
        sub_kelompok: coaFormSubKelompok,
        is_active: coaFormActive,
      };
      const res = await fetch("/api/siap-saji/finance/coa", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan Akun COA");
      toast.success(editingCoa ? "Akun COA berhasil diperbarui!" : "Akun COA baru berhasil ditambahkan!");
      setIsCoaModalOpen(false);
      fetchTabData();
      fetchKasBankMaster();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan COA");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCoa = async (id: number, code: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus akun COA ${code}?`)) return;
    try {
      const res = await fetch(`/api/siap-saji/finance/coa?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus Akun COA");
      toast.success("Akun COA berhasil dihapus.");
      fetchTabData();
      fetchKasBankMaster();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus COA");
    }
  };

  useEffect(() => {
    fetchKasBankMaster();
  }, []);

  useEffect(() => {
    fetchTabData();
  }, [
    activeTab,
    purPage, purLimit, purSearch, purDateFrom, purDateTo,
    expPage, expLimit, expSearch, expDateFrom, expDateTo,
    mutSearch, mutJenisFilter, mutDateFrom, mutDateTo,
    jouPage, jouLimit, jouSearch, jouTypeFilter, jouDateFrom, jouDateTo,
    coaSearch, coaKelompokFilter,
  ]);

  // Submit HPP Purchase
  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseKeterangan || !purchaseAmount || !purchaseKasBankId) {
      return toast.error("Keterangan, Total Nominal, dan Rekening wajib diisi.");
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/siap-saji/finance/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchase_date: purchaseDate,
          nota_ref: purchaseNotaRef,
          keterangan: purchaseKeterangan,
          total_amount: purchaseAmount,
          coa_id: purchaseCoaId,
          kas_bank_id: purchaseKasBankId,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Gagal mencatat nota HPP");
      }

      toast.success("Nota HPP berhasil dicatat ke jurnal & mutasi kas!");
      setIsPurchaseModalOpen(false);
      setPurchaseKeterangan("");
      setPurchaseNotaRef("");
      setPurchaseAmount(0);
      fetchTabData();
      fetchKasBankMaster();
    } catch (err: any) {
      toast.error(err.message || "Gagal mencatat HPP");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Expense
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseKeterangan || !expenseAmount || !expenseCoaId || !expenseKasBankId) {
      return toast.error("Keterangan, Nominal, Kategori Beban, dan Rekening wajib diisi.");
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/siap-saji/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expense_date: expenseDate,
          keterangan: expenseKeterangan,
          nominal: expenseAmount,
          coa_id: expenseCoaId,
          kas_bank_id: expenseKasBankId,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Gagal mencatat biaya operasional");
      }

      toast.success("Biaya operasional berhasil dicatat ke jurnal!");
      setIsExpenseModalOpen(false);
      setExpenseKeterangan("");
      setExpenseAmount(0);
      fetchTabData();
      fetchKasBankMaster();
    } catch (err: any) {
      toast.error(err.message || "Gagal mencatat biaya");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helpers for P&L calculations
  const calculatePlCategoryTotal = (kelompok: string, subKelompok?: string) => {
    if (!plData || !plData.details) return 0;
    return plData.details
      .filter((d: any) => d.kelompok === kelompok && (!subKelompok || d.sub_kelompok === subKelompok))
      .reduce((sum: number, d: any) => sum + Number(d.total_nominal || 0), 0);
  };

  const totalPendapatan = calculatePlCategoryTotal("Pendapatan");
  const totalHpp = calculatePlCategoryTotal("Beban", "Beban Pokok Penjualan");
  const labaKotor = totalPendapatan - totalHpp;
  const totalBiayaOperasional = calculatePlCategoryTotal("Beban", "Beban Operasional");
  const labaBersih = labaKotor - totalBiayaOperasional;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.02em" }}>
            Keuangan & Akuntansi Siap Saji
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Laporan P&L Laba Rugi, Pembelian HPP, Biaya Operasional, Kas & Bank, serta Buku Jurnal Double-Entry
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {activeTab === "purchases" && (
            <button
              onClick={() => setIsPurchaseModalOpen(true)}
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
              }}
            >
              <Plus size={18} /> Catat Nota HPP
            </button>
          )}

          {activeTab === "expenses" && (
            <button
              onClick={() => setIsExpenseModalOpen(true)}
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
              }}
            >
              <Plus size={18} /> Catat Biaya Operasional
            </button>
          )}

          {activeTab === "coa" && (
            <button
              onClick={handleOpenAddCoa}
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
              }}
            >
              <Plus size={18} /> Tambah Akun COA
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, borderBottom: "2px solid #e5e7eb", marginBottom: 20, overflowX: "auto", flexWrap: "nowrap" }}>
        <button
          onClick={() => setActiveTab("pl")}
          style={{
            padding: "10px 14px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "pl" ? "3px solid #5005A6" : "3px solid transparent",
            color: activeTab === "pl" ? "#5005A6" : "#6b7280",
            fontSize: 13,
            fontWeight: activeTab === "pl" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: -2,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <PieChart size={15} /> Laporan P&L (Laba Rugi)
        </button>

        <button
          onClick={() => setActiveTab("purchases")}
          style={{
            padding: "10px 14px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "purchases" ? "3px solid #5005A6" : "3px solid transparent",
            color: activeTab === "purchases" ? "#5005A6" : "#6b7280",
            fontSize: 13,
            fontWeight: activeTab === "purchases" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: -2,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <FileText size={15} /> Pembelian HPP
        </button>

        <button
          onClick={() => setActiveTab("expenses")}
          style={{
            padding: "10px 14px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "expenses" ? "3px solid #5005A6" : "3px solid transparent",
            color: activeTab === "expenses" ? "#5005A6" : "#6b7280",
            fontSize: 13,
            fontWeight: activeTab === "expenses" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: -2,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <DollarSign size={15} /> Biaya Operasional
        </button>

        <button
          onClick={() => setActiveTab("kas_bank")}
          style={{
            padding: "10px 14px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "kas_bank" ? "3px solid #5005A6" : "3px solid transparent",
            color: activeTab === "kas_bank" ? "#5005A6" : "#6b7280",
            fontSize: 13,
            fontWeight: activeTab === "kas_bank" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: -2,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <CreditCard size={15} /> Kas & Rekening Bank
        </button>

        <button
          onClick={() => setActiveTab("journals")}
          style={{
            padding: "10px 14px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "journals" ? "3px solid #5005A6" : "3px solid transparent",
            color: activeTab === "journals" ? "#5005A6" : "#6b7280",
            fontSize: 13,
            fontWeight: activeTab === "journals" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: -2,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <BookOpen size={15} /> Buku Jurnal
        </button>

        <button
          onClick={() => setActiveTab("neraca")}
          style={{
            padding: "10px 14px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "neraca" ? "3px solid #5005A6" : "3px solid transparent",
            color: activeTab === "neraca" ? "#5005A6" : "#6b7280",
            fontSize: 13,
            fontWeight: activeTab === "neraca" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: -2,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <PieChart size={15} /> Neraca Keuangan
        </button>

        <button
          onClick={() => setActiveTab("coa")}
          style={{
            padding: "10px 14px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "coa" ? "3px solid #5005A6" : "3px solid transparent",
            color: activeTab === "coa" ? "#5005A6" : "#6b7280",
            fontSize: 13,
            fontWeight: activeTab === "coa" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: -2,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <CreditCard size={15} /> Master Chart of Accounts (COA)
        </button>
      </div>

      {/* ── TAB 1: P&L (LABA RUGI) — MATCHING MOCKUP 09 ───────────────── */}
      {activeTab === "pl" && (
        <div style={{ background: "white", borderRadius: 16, padding: 28, border: "1px solid #e5e7eb", maxWidth: 840, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: "2px solid #f3f4f6", paddingBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>
                Laporan Keuangan (Laba Rugi)
              </h2>
              <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                Ringkasan performa pendapatan, HPP, biaya operasional, dan laba bersih Siap Saji
              </p>
            </div>

            <div style={{ background: "#f3f4f6", padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#374151" }}>
              Periode: Juni 2026
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* PENDAPATAN */}
            <div style={{ background: "#fafafa", borderRadius: 10, padding: 16, border: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                PENDAPATAN
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 15, fontWeight: 600, color: "#111827" }}>
                <span>Penjualan Bersih (Siap Saji)</span>
                <span style={{ fontWeight: 800, color: "#15803d" }}>Rp {totalPendapatan.toLocaleString("id-ID")}</span>
              </div>
            </div>

            {/* HARGA POKOK PENJUALAN (HPP) */}
            <div style={{ background: "#fafafa", borderRadius: 10, padding: 16, border: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                HARGA POKOK PENJUALAN (HPP)
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 15, fontWeight: 600, color: "#111827" }}>
                <span>Total HPP (Bahan & Kemasan)</span>
                <span style={{ fontWeight: 800, color: "#b45309" }}>Rp {totalHpp.toLocaleString("id-ID")}</span>
              </div>
            </div>

            {/* LABA KOTOR */}
            <div style={{ background: "#fef3c7", borderRadius: 10, padding: "14px 18px", border: "1px solid #fde68a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#92400e" }}>LABA KOTOR</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: "#92400e" }}>Rp {labaKotor.toLocaleString("id-ID")}</span>
            </div>

            {/* BIAYA OPERASIONAL */}
            <div style={{ background: "#fafafa", borderRadius: 10, padding: 16, border: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                BIAYA OPERASIONAL
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 8 }}>
                <span>Biaya Operasional & Overhead</span>
                <span style={{ fontWeight: 800, color: "#b91c1c" }}>Rp {totalBiayaOperasional.toLocaleString("id-ID")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, fontWeight: 700, color: "#374151", paddingTop: 8, borderTop: "1px dashed #e5e7eb" }}>
                <span>LABA OPERASIONAL</span>
                <span>Rp {(labaKotor - totalBiayaOperasional).toLocaleString("id-ID")}</span>
              </div>
            </div>

            {/* PENDAPATAN LAIN / BEBAN LAIN */}
            <div style={{ background: "#fafafa", borderRadius: 10, padding: 16, border: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                PENDAPATAN LAIN / (BEBAN LAIN)
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 15, fontWeight: 600, color: "#111827" }}>
                <span>Pendapatan Lain-lain</span>
                <span>Rp 0</span>
              </div>
            </div>

            {/* LABA BERSIH */}
            <div style={{ background: "linear-gradient(135deg, #5005A6 0%, #B10FBD 100%)", color: "white", borderRadius: 12, padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 14px rgba(177, 15, 189, 0.3)" }}>
              <span style={{ fontSize: 18, fontWeight: 800 }}>LABA BERSIH</span>
              <span style={{ fontSize: 24, fontWeight: 900 }}>Rp {labaBersih.toLocaleString("id-ID")}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PEMBELIAN HPP (NOTA BELANJA) ────────────────────── */}
      {activeTab === "purchases" && (
        <div>
          {/* Filter Toolbar */}
          <div style={{ background: "white", borderRadius: 12, padding: "12px 16px", border: "1px solid #e5e7eb", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, overflowX: "auto", whiteSpace: "nowrap" }}>
            <div style={{ flex: "1 1 240px", minWidth: 180, position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                type="text"
                placeholder="Cari Ref Nota, Keterangan, Akun, Rekening..."
                value={purSearch}
                onChange={(e) => { setPurSearch(e.target.value); setPurPage(1); }}
                style={{ width: "100%", padding: "7px 12px 7px 34px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Dari:</span>
              <input
                type="date"
                value={purDateFrom}
                onChange={(e) => { setPurDateFrom(e.target.value); setPurPage(1); }}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>s/d:</span>
              <input
                type="date"
                value={purDateTo}
                onChange={(e) => { setPurDateTo(e.target.value); setPurPage(1); }}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
              />
            </div>
            {(purSearch || purDateFrom || purDateTo) && (
              <button
                onClick={() => { setPurSearch(""); setPurDateFrom(""); setPurDateTo(""); setPurPage(1); }}
                style={{ padding: "7px 12px", background: "#f3f4f6", color: "#4b5563", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600, flexShrink: 0 }}
              >
                Reset
              </button>
            )}
          </div>

          <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14, whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px", width: 50 }}>No.</th>
                  <th style={{ padding: "12px 16px" }}>Tanggal</th>
                  <th style={{ padding: "12px 16px" }}>Ref Nota</th>
                  <th style={{ padding: "12px 16px" }}>Keterangan Belanja</th>
                  <th style={{ padding: "12px 16px" }}>Kategori HPP</th>
                  <th style={{ padding: "12px 16px" }}>Rekening Kas/Bank</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Nominal</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                      Memuat data nota HPP...
                    </td>
                  </tr>
                ) : purchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                      Belum ada riwayat pembelian HPP.
                    </td>
                  </tr>
                ) : (
                  purchases.slice((purPage - 1) * purLimit, purPage * purLimit).map((p, idx) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "14px 16px", color: "#6b7280" }}>{(purPage - 1) * purLimit + idx + 1}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 600 }}>{formatDate(p.purchase_date)}</td>
                      <td style={{ padding: "14px 16px", fontFamily: "monospace", color: "#5005A6" }}>
                        {p.nota_ref || `NOTA-${p.id}`}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#111827", fontWeight: 600 }}>{p.keterangan}</td>
                      <td style={{ padding: "14px 16px", color: "#4b5563" }}>
                        {p.coa_kode} - {p.coa_nama}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#374151" }}>{p.kas_bank_nama}</td>
                      <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 800, color: "#E24B4A" }}>
                        Rp {Number(p.total_amount).toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <Pagination
              page={purPage}
              totalPages={Math.ceil(purchases.length / purLimit) || 1}
              total={purchases.length}
              limit={purLimit}
              onChange={(p) => setPurPage(p)}
              onLimitChange={(lim) => { setPurLimit(lim); setPurPage(1); }}
            />
          </div>
        </div>
      )}

      {/* ── TAB 3: BIAYA OPERASIONAL ────────────────────────────────── */}
      {activeTab === "expenses" && (
        <div>
          {/* Filter Toolbar */}
          <div style={{ background: "white", borderRadius: 12, padding: "12px 16px", border: "1px solid #e5e7eb", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, overflowX: "auto", whiteSpace: "nowrap" }}>
            <div style={{ flex: "1 1 240px", minWidth: 180, position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                type="text"
                placeholder="Cari Keterangan Biaya, Beban, Sumber..."
                value={expSearch}
                onChange={(e) => { setExpSearch(e.target.value); setExpPage(1); }}
                style={{ width: "100%", padding: "7px 12px 7px 34px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Dari:</span>
              <input
                type="date"
                value={expDateFrom}
                onChange={(e) => { setExpDateFrom(e.target.value); setExpPage(1); }}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>s/d:</span>
              <input
                type="date"
                value={expDateTo}
                onChange={(e) => { setExpDateTo(e.target.value); setExpPage(1); }}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
              />
            </div>
            {(expSearch || expDateFrom || expDateTo) && (
              <button
                onClick={() => { setExpSearch(""); setExpDateFrom(""); setExpDateTo(""); setExpPage(1); }}
                style={{ padding: "7px 12px", background: "#f3f4f6", color: "#4b5563", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600, flexShrink: 0 }}
              >
                Reset
              </button>
            )}
          </div>

          <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14, whiteSpace: "nowrap" }}>
            <thead>
              <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>
                <th style={{ padding: "12px 16px", width: 50 }}>No.</th>
                <th style={{ padding: "12px 16px" }}>Tanggal</th>
                <th style={{ padding: "12px 16px" }}>Keterangan Biaya</th>
                <th style={{ padding: "12px 16px" }}>Kategori Beban</th>
                <th style={{ padding: "12px 16px" }}>Sumber Dana</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                    Memuat biaya operasional...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                    Belum ada riwayat biaya operasional.
                  </td>
                </tr>
              ) : (
                expenses.slice((expPage - 1) * expLimit, expPage * expLimit).map((e, idx) => (
                  <tr key={e.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "14px 16px", color: "#6b7280" }}>{(expPage - 1) * expLimit + idx + 1}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 600 }}>{formatDate(e.journal_date)}</td>
                    <td style={{ padding: "14px 16px", color: "#111827", fontWeight: 600 }}>{e.keterangan}</td>
                    <td style={{ padding: "14px 16px", color: "#4b5563" }}>
                      {e.beban_kode} - {e.beban_nama}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#374151" }}>{e.kredit_nama}</td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 800, color: "#E24B4A" }}>
                      Rp {Number(e.nominal).toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <Pagination
            page={expPage}
            totalPages={Math.ceil(expenses.length / expLimit) || 1}
            total={expenses.length}
            limit={expLimit}
            onChange={(p) => setExpPage(p)}
            onLimitChange={(lim) => { setExpLimit(lim); setExpPage(1); }}
          />
        </div>
      </div>
      )}

      {/* ── TAB 4: KAS & REKENING BANK ────────────────────────────── */}
      {activeTab === "kas_bank" && (
        <div>
          {/* Account Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
            {accounts.map((acc) => (
              <div
                key={acc.id}
                style={{
                  background: "white",
                  borderRadius: 12,
                  padding: "16px 20px",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{acc.nama_rekening}</span>
                  {acc.is_payment_default && (
                    <span style={{ fontSize: 10, fontWeight: 800, background: "#f0fdf4", color: "#639922", padding: "2px 6px", borderRadius: 4 }}>
                      Default Order
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 22, fontWeight: 800, color: "#5005A6", marginTop: 8 }}>
                  Rp {Number(acc.saldo_kini).toLocaleString("id-ID")}
                </p>
                <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  No. Rek: {acc.no_rekening || "Kas Tunai"}
                </p>
              </div>
            ))}
          </div>

          {/* Mutasi Table */}
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>
                Riwayat Mutasi Kas & Bank Terbaru
              </h3>
            </div>

            {/* Filter Toolbar Mutasi */}
            <div style={{ background: "#fafafa", borderRadius: 10, padding: "10px 14px", border: "1px solid #e5e7eb", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, overflowX: "auto", whiteSpace: "nowrap" }}>
              <div style={{ flex: "1 1 220px", minWidth: 160, position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                <input
                  type="text"
                  placeholder="Cari Keterangan, Rekening..."
                  value={mutSearch}
                  onChange={(e) => { setMutSearch(e.target.value); setMutPage(1); }}
                  style={{ width: "100%", padding: "7px 12px 7px 34px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white" }}
                />
              </div>

              <select
                value={mutJenisFilter}
                onChange={(e) => { setMutJenisFilter(e.target.value); setMutPage(1); }}
                style={{ width: 140, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white", flexShrink: 0 }}
              >
                <option value="">Semua Jenis</option>
                <option value="Masuk">Mutasi Masuk</option>
                <option value="Keluar">Mutasi Keluar</option>
              </select>

              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Dari:</span>
                <input
                  type="date"
                  value={mutDateFrom}
                  onChange={(e) => { setMutDateFrom(e.target.value); setMutPage(1); }}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "white" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>s/d:</span>
                <input
                  type="date"
                  value={mutDateTo}
                  onChange={(e) => { setMutDateTo(e.target.value); setMutPage(1); }}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "white" }}
                />
              </div>

              {(mutSearch || mutJenisFilter || mutDateFrom || mutDateTo) && (
                <button
                  onClick={() => { setMutSearch(""); setMutJenisFilter(""); setMutDateFrom(""); setMutDateTo(""); setMutPage(1); }}
                  style={{ padding: "7px 12px", background: "#e5e7eb", color: "#4b5563", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600, flexShrink: 0 }}
                >
                  Reset
                </button>
              )}
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, whiteSpace: "nowrap" }}>
                <thead>
                  <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
                    <th style={{ padding: "10px 12px", width: 50 }}>No.</th>
                    <th style={{ padding: "10px 12px" }}>Tanggal</th>
                    <th style={{ padding: "10px 12px" }}>Rekening</th>
                    <th style={{ padding: "10px 12px" }}>Jenis</th>
                    <th style={{ padding: "10px 12px" }}>Keterangan</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {mutasi.slice((mutPage - 1) * mutLimit, mutPage * mutLimit).map((m, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>{(mutPage - 1) * mutLimit + idx + 1}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{formatDate(m.mutasi_date)}</td>
                      <td style={{ padding: "10px 12px", color: "#374151" }}>{m.kas_bank_nama}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {m.jenis === "Masuk" ? (
                          <span style={{ color: "#639922", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                            <ArrowDownLeft size={14} /> Masuk
                          </span>
                        ) : (
                          <span style={{ color: "#E24B4A", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                            <ArrowUpRight size={14} /> Keluar
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#111827" }}>{m.keterangan}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: m.jenis === "Masuk" ? "#639922" : "#E24B4A" }}>
                        Rp {Number(m.nominal).toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={mutPage}
              totalPages={Math.ceil(mutasi.length / mutLimit) || 1}
              total={mutasi.length}
              limit={mutLimit}
              onChange={(p) => setMutPage(p)}
              onLimitChange={(lim) => { setMutLimit(lim); setMutPage(1); }}
            />
          </div>
        </div>
      )}

      {/* ── TAB 5: BUKU JURNAL GENERAL LEDGER (DOUBLE-ENTRY ACCOUNTING) ── */}
      {activeTab === "journals" && (
        <div>
          {/* Filter Toolbar Journals */}
          <div style={{ background: "white", borderRadius: 12, padding: "12px 16px", border: "1px solid #e5e7eb", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, overflowX: "auto", whiteSpace: "nowrap" }}>
            <div style={{ flex: "1 1 240px", minWidth: 180, position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                type="text"
                placeholder="Cari Ref No, Keterangan Jurnal, Nama Akun..."
                value={jouSearch}
                onChange={(e) => { setJouSearch(e.target.value); setJouPage(1); }}
                style={{ width: "100%", padding: "7px 12px 7px 34px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }}
              />
            </div>

            <select
              value={jouTypeFilter}
              onChange={(e) => { setJouTypeFilter(e.target.value); setJouPage(1); }}
              style={{ width: 150, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white", flexShrink: 0 }}
            >
              <option value="">Semua Tipe Jurnal</option>
              <option value="penjualan">Penjualan SS</option>
              <option value="pembelian">Pembelian HPP</option>
              <option value="biaya">Biaya Operasional</option>
              <option value="koreksi">Koreksi Batal</option>
            </select>

            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Dari:</span>
              <input
                type="date"
                value={jouDateFrom}
                onChange={(e) => { setJouDateFrom(e.target.value); setJouPage(1); }}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>s/d:</span>
              <input
                type="date"
                value={jouDateTo}
                onChange={(e) => { setJouDateTo(e.target.value); setJouPage(1); }}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
              />
            </div>

            {(jouSearch || jouTypeFilter || jouDateFrom || jouDateTo) && (
              <button
                onClick={() => { setJouSearch(""); setJouTypeFilter(""); setJouDateFrom(""); setJouDateTo(""); setJouPage(1); }}
                style={{ padding: "7px 12px", background: "#f3f4f6", color: "#4b5563", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600, flexShrink: 0 }}
              >
                Reset
              </button>
            )}
          </div>

          <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>
                Buku Jurnal Umum (Double-Entry Accounting)
              </h3>
              <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
                Jurnal pencatatan berpasangan Debit dan Kredit sesuai standar akuntansi baku.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, background: "#f0fdf4", color: "#166534", padding: "4px 10px", borderRadius: 20, border: "1px solid #bbf7d0" }}>
                ✓ Debet & Kredit Seimbang (Balanced)
              </span>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13, whiteSpace: "nowrap" }}>
            <thead>
              <tr style={{ background: "#fafafa", borderBottom: "2px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ padding: "12px 16px", width: 50 }}>No.</th>
                <th style={{ padding: "12px 16px", width: 110 }}>Tanggal</th>
                <th style={{ padding: "12px 16px", width: 140 }}>Ref No / Tipe</th>
                <th style={{ padding: "12px 16px" }}>Posisi Akun & Keterangan Jurnal</th>
                <th style={{ padding: "12px 16px", textAlign: "right", width: 140, color: "#15803d" }}>Debit (Rp)</th>
                <th style={{ padding: "12px 16px", textAlign: "right", width: 140, color: "#b91c1c" }}>Kredit (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                    Memuat entri buku jurnal...
                  </td>
                </tr>
              ) : journals.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                    Belum ada entri jurnal tercatat.
                  </td>
                </tr>
              ) : (
                journals.slice((jouPage - 1) * jouLimit, jouPage * jouLimit).map((j, idx) => {
                  const itemNo = (jouPage - 1) * jouLimit + idx + 1;
                  return (
                    <Fragment key={j.id}>
                      {/* BARIS 1: ENTRI DEBIT */}
                      <tr style={{ borderTop: idx > 0 ? "2px solid #e5e7eb" : "none", background: "#ffffff" }}>
                        <td rowSpan={2} style={{ padding: "12px 16px", verticalAlign: "top", color: "#6b7280", fontWeight: 600, borderRight: "1px solid #f3f4f6" }}>
                          {itemNo}
                        </td>
                        <td rowSpan={2} style={{ padding: "12px 16px", verticalAlign: "top", fontWeight: 600, color: "#374151", borderRight: "1px solid #f3f4f6" }}>
                          {formatDate(j.journal_date)}
                        </td>
                        <td rowSpan={2} style={{ padding: "12px 16px", verticalAlign: "top", borderRight: "1px solid #f3f4f6" }}>
                          <p style={{ fontFamily: "monospace", fontWeight: 700, color: "#5005A6", margin: 0 }}>
                            {j.ref_no || `JRNL-${j.id}`}
                          </p>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#f3f4f6", color: "#4b5563", textTransform: "uppercase" }}>
                            {j.ref_type || "umum"}
                          </span>
                        </td>
                        {/* Status & Nama Akun Debit */}
                        <td style={{ padding: "10px 16px 4px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 700, color: "#15803d", fontSize: 13 }}>
                              [{j.debit_kode}] {j.debit_nama}
                            </span>
                            <span style={{ background: "#dcfce7", color: "#15803d", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4 }}>
                              DEBIT
                            </span>
                          </div>
                        </td>
                        {/* Nominal Debit */}
                        <td style={{ padding: "10px 16px 4px 16px", textAlign: "right", fontWeight: 800, color: "#15803d" }}>
                          Rp {Number(j.nominal).toLocaleString("id-ID")}
                        </td>
                        {/* Column Kredit (-) */}
                        <td style={{ padding: "10px 16px 4px 16px", textAlign: "right", color: "#9ca3af" }}>
                          -
                        </td>
                      </tr>

                      {/* BARIS 2: ENTRI KREDIT (MENYOROK KE DALAM) */}
                      <tr style={{ background: "#fafafa" }}>
                        {/* Status & Nama Akun Kredit */}
                        <td style={{ padding: "4px 16px 10px 36px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 700, color: "#b91c1c", fontSize: 13 }}>
                              [{j.kredit_kode}] {j.kredit_nama}
                            </span>
                            <span style={{ background: "#fee2e2", color: "#b91c1c", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4 }}>
                              KREDIT
                            </span>
                          </div>
                          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6b7280", fontStyle: "italic" }}>
                            Keterangan: {j.keterangan || "-"}
                          </p>
                        </td>
                        {/* Column Debit (-) */}
                        <td style={{ padding: "4px 16px 10px 16px", textAlign: "right", color: "#9ca3af" }}>
                          -
                        </td>
                        {/* Nominal Kredit */}
                        <td style={{ padding: "4px 16px 10px 16px", textAlign: "right", fontWeight: 800, color: "#b91c1c" }}>
                          Rp {Number(j.nominal).toLocaleString("id-ID")}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })
              )}
            </tbody>
            {journals.length > 0 && (
              <tfoot>
                <tr style={{ background: "#f8fafc", borderTop: "2px solid #e5e7eb", fontWeight: 800 }}>
                  <td colSpan={4} style={{ padding: "12px 16px", textAlign: "right", color: "#374151" }}>
                    TOTAL BUKU JURNAL SEIMBANG (BALANCED):
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#15803d", fontSize: 14 }}>
                    Rp {journals.reduce((sum, j) => sum + Number(j.nominal || 0), 0).toLocaleString("id-ID")}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#b91c1c", fontSize: 14 }}>
                    Rp {journals.reduce((sum, j) => sum + Number(j.nominal || 0), 0).toLocaleString("id-ID")}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          <Pagination
            page={jouPage}
            totalPages={Math.ceil(journals.length / jouLimit) || 1}
            total={journals.length}
            limit={jouLimit}
            onChange={(p) => setJouPage(p)}
            onLimitChange={(lim) => { setJouLimit(lim); setJouPage(1); }}
          />
        </div>
      </div>
      )}

      {/* ── MODAL: INPUT NOTA HPP ────────────────────────────── */}
      {isPurchaseModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, maxWidth: 480, width: "100%", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Catat Nota Pembelian HPP</h3>
              <button onClick={() => setIsPurchaseModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitPurchase}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Tanggal Belanja *
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  No. Ref / Struk Nota
                </label>
                <input
                  type="text"
                  placeholder="Kosongkan untuk auto-generate (Opsional)"
                  value={purchaseNotaRef}
                  onChange={(e) => setPurchaseNotaRef(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Keterangan Belanja *
                </label>
                <input
                  type="text"
                  placeholder="Beli ayam potong 10kg, bumbu dapur, mika kemasan..."
                  value={purchaseKeterangan}
                  onChange={(e) => setPurchaseKeterangan(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Kategori HPP *
                </label>
                <select
                  value={purchaseCoaId}
                  onChange={(e) => setPurchaseCoaId(Number(e.target.value))}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                >
                  {coaList
                    .filter((c) => c.sub_kelompok === "Beban Pokok Penjualan")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.kode_akun}] {c.nama_akun}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Rekening Pembayaran / Metode *
                </label>
                <select
                  value={purchaseKasBankId}
                  onChange={(e) => setPurchaseKasBankId(e.target.value === "hutang" ? "hutang" : Number(e.target.value))}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                >
                  <option value="hutang">💳 Hutang Usaha / Tempo (Belum Dibayar)</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nama_rekening} (Saldo: Rp{Number(a.saldo_kini).toLocaleString("id-ID")})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Total Nominal (Rp) *
                </label>
                <input
                  type="text"
                  placeholder="0"
                  value={formatThousand(purchaseAmount)}
                  onChange={(e) => setPurchaseAmount(parseThousand(e.target.value))}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 16, fontWeight: 700, textAlign: "right" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setIsPurchaseModalOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}>
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5005A6", color: "white", fontWeight: 700 }}>
                  {isSubmitting ? "Simpan..." : "Simpan Nota HPP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: INPUT EXPENSE ────────────────────────────── */}
      {isExpenseModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, maxWidth: 480, width: "100%", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Catat Biaya Operasional</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitExpense}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Tanggal Transaksi *
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Keterangan Biaya *
                </label>
                <input
                  type="text"
                  placeholder="Gaji staf CS, Token listrik dapur, Bensin kurir..."
                  value={expenseKeterangan}
                  onChange={(e) => setExpenseKeterangan(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Kategori Beban Operasional *
                </label>
                <select
                  value={expenseCoaId}
                  onChange={(e) => setExpenseCoaId(Number(e.target.value))}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                >
                  {coaList
                    .filter((c) => c.sub_kelompok === "Beban Operasional")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.kode_akun}] {c.nama_akun}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Sumber Dana Kas/Bank / Metode *
                </label>
                <select
                  value={expenseKasBankId}
                  onChange={(e) => setExpenseKasBankId(e.target.value === "hutang" ? "hutang" : Number(e.target.value))}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                >
                  <option value="hutang">💳 Hutang Usaha / Tempo (Belum Dibayar)</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nama_rekening} (Saldo: Rp{Number(a.saldo_kini).toLocaleString("id-ID")})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Nominal Biaya (Rp) *
                </label>
                <input
                  type="text"
                  placeholder="0"
                  value={formatThousand(expenseAmount)}
                  onChange={(e) => setExpenseAmount(parseThousand(e.target.value))}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 16, fontWeight: 700, textAlign: "right" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setIsExpenseModalOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}>
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5005A6", color: "white", fontWeight: 700 }}>
                  {isSubmitting ? "Simpan..." : "Simpan Biaya"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TAB 6: MASTER CHART OF ACCOUNTS (COA) ───────────────────── */}
      {activeTab === "coa" && (
        <div>
          {/* Toolbar */}
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
            }}
          >
            <div style={{ flex: "1 1 240px", minWidth: 180, position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                type="text"
                placeholder="Cari Kode Akun, Nama Akun..."
                value={coaSearch}
                onChange={(e) => setCoaSearch(e.target.value)}
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
              value={coaKelompokFilter}
              onChange={(e) => setCoaKelompokFilter(e.target.value)}
              style={{ width: 160, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white" }}
            >
              <option value="">Semua Kelompok</option>
              <option value="Aset">🔵 Aset</option>
              <option value="Liabilitas">🔴 Liabilitas</option>
              <option value="Ekuitas">🟢 Ekuitas</option>
              <option value="Pendapatan">🟣 Pendapatan</option>
              <option value="Beban">🟠 Beban & COGS</option>
            </select>
          </div>

          {/* COA Table */}
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 14px", width: 50 }}>No.</th>
                  <th style={{ padding: "12px 14px", width: 120 }}>Kode Akun</th>
                  <th style={{ padding: "12px 14px" }}>Nama Akun</th>
                  <th style={{ padding: "12px 14px", width: 140 }}>Kelompok</th>
                  <th style={{ padding: "12px 14px", width: 180 }}>Sub Kelompok</th>
                  <th style={{ padding: "12px 14px", width: 100 }}>Status</th>
                  <th style={{ padding: "12px 14px", width: 110, textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                      Memuat daftar Chart of Accounts...
                    </td>
                  </tr>
                ) : coaListAll.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                      Tidak ada akun COA ditemukan.
                    </td>
                  </tr>
                ) : (
                  coaListAll
                    .slice((coaPage - 1) * coaLimit, coaPage * coaLimit)
                    .map((c, idx) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "12px 14px", color: "#6b7280" }}>
                          {(coaPage - 1) * coaLimit + idx + 1}
                        </td>
                        <td style={{ padding: "12px 14px", fontWeight: 800, color: "#5005A6", fontFamily: "monospace", fontSize: 13 }}>
                          {c.kode_akun}
                        </td>
                        <td style={{ padding: "12px 14px", fontWeight: 700, color: "#111827" }}>
                          {c.nama_akun}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              background:
                                c.kelompok === "Aset"
                                  ? "#eff6ff"
                                  : c.kelompok === "Liabilitas"
                                  ? "#fef2f2"
                                  : c.kelompok === "Ekuitas"
                                  ? "#f0fdf4"
                                  : c.kelompok === "Pendapatan"
                                  ? "#fdf4ff"
                                  : "#fff7ed",
                              color:
                                c.kelompok === "Aset"
                                  ? "#1d4ed8"
                                  : c.kelompok === "Liabilitas"
                                  ? "#b91c1c"
                                  : c.kelompok === "Ekuitas"
                                  ? "#15803d"
                                  : c.kelompok === "Pendapatan"
                                  ? "#b10fbd"
                                  : "#c2410c",
                            }}
                          >
                            {c.kelompok}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#4b5563", fontSize: 12 }}>
                          {c.sub_kelompok}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          {c.is_active !== false ? (
                            <span style={{ color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              Aktif
                            </span>
                          ) : (
                            <span style={{ color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>
                              Non-Aktif
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                            <button
                              onClick={() => handleOpenEditCoa(c)}
                              title="Edit Akun COA"
                              style={{ padding: "5px 8px", background: "#5005A6", color: "white", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteCoa(c.id, c.kode_akun)}
                              title="Hapus Akun COA"
                              style={{ padding: "5px 8px", background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 11, cursor: "pointer" }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>

            {/* COA Table Pagination */}
            {coaListAll.length > 0 && (
              <Pagination
                page={coaPage}
                totalPages={Math.ceil(coaListAll.length / coaLimit)}
                total={coaListAll.length}
                limit={coaLimit}
                onChange={(p: number) => setCoaPage(p)}
                onLimitChange={(l: number) => {
                  setCoaLimit(l);
                  setCoaPage(1);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* ── TAB 7: NERACA KEUANGAN (BALANCE SHEET) ───────────────────── */}
      {activeTab === "neraca" && (
        <div>
          {loading ? (
            <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e7eb", padding: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <RefreshCw size={36} className="animate-spin" style={{ color: "#5005A6", marginBottom: 16 }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Memuat Neraca Keuangan Siap Saji...</p>
              <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Kalkulasi otomatis Aktiva (Aset) vs Passiva (Liabilitas & Ekuitas)</p>
            </div>
          ) : (
            <>
              {/* Summary Scorecards */}
          {(() => {
            const asetRows = neracaData.filter((r) => r.kelompok === "Aset");
            const liabRows = neracaData.filter((r) => r.kelompok === "Liabilitas");
            const ekuitasRows = neracaData.filter((r) => r.kelompok === "Ekuitas");
            const pendRows = neracaData.filter((r) => r.kelompok === "Pendapatan");
            const bebanRows = neracaData.filter((r) => r.kelompok === "Beban");

            const totalAset = asetRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0);
            const totalLiabilitas = Math.abs(liabRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0));
            const totalEkuitasAwal = Math.abs(ekuitasRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0));
            const totalPendapatan = Math.abs(pendRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0));
            const totalBeban = bebanRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0);
            const labaBerjalan = totalPendapatan - totalBeban;
            const totalEkuitasTotal = totalEkuitasAwal + labaBerjalan;
            const totalPassiva = totalLiabilitas + totalEkuitasTotal;

            const isBalanced = Math.abs(totalAset - totalPassiva) < 1;

            return (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
                  <div style={{ background: "white", borderRadius: 12, padding: "16px 20px", border: "1px solid #e5e7eb" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" }}>🔷 Total Aktiva (Aset)</span>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#1e3a8a", marginTop: 4 }}>
                      Rp{totalAset.toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div style={{ background: "white", borderRadius: 12, padding: "16px 20px", border: "1px solid #e5e7eb" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", textTransform: "uppercase" }}>🔴 Total Liabilitas (Utang)</span>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#991b1b", marginTop: 4 }}>
                      Rp{totalLiabilitas.toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div style={{ background: "white", borderRadius: 12, padding: "16px 20px", border: "1px solid #e5e7eb" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#15803d", textTransform: "uppercase" }}>🟢 Total Ekuitas (Modal & Laba)</span>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#166534", marginTop: 4 }}>
                      Rp{totalEkuitasTotal.toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div style={{ background: "white", borderRadius: 12, padding: "16px 20px", border: "1px solid #e5e7eb" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>⚖️ Status Neraca</span>
                    <div style={{ fontSize: 18, fontWeight: 800, color: isBalanced ? "#16a34a" : "#dc2626", marginTop: 4 }}>
                      {isBalanced ? "BALANCED (Seimbang)" : "TIDAK SEIMBANG"}
                    </div>
                  </div>
                </div>

                {/* Balance Sheet 2 Columns: Aktiva vs Passiva */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  {/* Left Column: AKTIVA (ASET) */}
                  <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                    <div style={{ padding: "14px 16px", background: "#eff6ff", borderBottom: "1px solid #dbeafe" }}>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#1e40af" }}>AKTIVA / ASET</h4>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>
                          <th style={{ padding: "8px 12px", textAlign: "left" }}>Kode</th>
                          <th style={{ padding: "8px 12px", textAlign: "left" }}>Nama Akun</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Saldo (Rp)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asetRows.map((r) => (
                          <tr key={r.kode_akun} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#3b82f6", fontWeight: 700 }}>{r.kode_akun}</td>
                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.nama_akun}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>Rp{Number(r.saldo || 0).toLocaleString("id-ID")}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "#eff6ff", fontWeight: 900 }}>
                          <td colSpan={2} style={{ padding: "12px", color: "#1e40af" }}>TOTAL AKTIVA (ASET)</td>
                          <td style={{ padding: "12px", textAlign: "right", color: "#1e40af" }}>Rp{totalAset.toLocaleString("id-ID")}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Right Column: PASSIVA (LIABILITAS & EKUITAS) */}
                  <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                    <div style={{ padding: "14px 16px", background: "#fdf4ff", borderBottom: "1px solid #fae8ff" }}>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#86198f" }}>PASSIVA (LIABILITAS & EKUITAS)</h4>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>
                          <th style={{ padding: "8px 12px", textAlign: "left" }}>Kode</th>
                          <th style={{ padding: "8px 12px", textAlign: "left" }}>Nama Akun / Komponen</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Saldo (Rp)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Liabilitas Rows */}
                        {liabRows.map((r) => (
                          <tr key={r.kode_akun} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#ef4444", fontWeight: 700 }}>{r.kode_akun}</td>
                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.nama_akun}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>Rp{Math.abs(Number(r.saldo || 0)).toLocaleString("id-ID")}</td>
                          </tr>
                        ))}
                        {/* Ekuitas Rows */}
                        {ekuitasRows.map((r) => (
                          <tr key={r.kode_akun} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#10b981", fontWeight: 700 }}>{r.kode_akun}</td>
                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.nama_akun}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>Rp{Math.abs(Number(r.saldo || 0)).toLocaleString("id-ID")}</td>
                          </tr>
                        ))}
                        {/* Laba Berjalan Line */}
                        <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#f0fdf4" }}>
                          <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#15803d", fontWeight: 700 }}>3-2001</td>
                          <td style={{ padding: "10px 12px", fontWeight: 700, color: "#15803d" }}>Laba Bersih Berjalan (P&L)</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "#15803d" }}>Rp{labaBerjalan.toLocaleString("id-ID")}</td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "#fdf4ff", fontWeight: 900 }}>
                          <td colSpan={2} style={{ padding: "12px", color: "#86198f" }}>TOTAL PASSIVA (LIABILITAS + EKUITAS)</td>
                          <td style={{ padding: "12px", textAlign: "right", color: "#86198f" }}>Rp{totalPassiva.toLocaleString("id-ID")}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
          </>
          )}
        </div>
      )}

      {/* ── MODAL COA (TAMBAH / EDIT) ─────────────────────────────────── */}
      {isCoaModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 480, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
                {editingCoa ? "Edit Akun COA" : "Tambah Akun COA Baru"}
              </h3>
              <button onClick={() => setIsCoaModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color="#6b7280" />
              </button>
            </div>

            <form onSubmit={handleSaveCoa}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Kode Akun * (Contoh: 1-1005, 5-1002, 6-1005)
                </label>
                <input
                  type="text"
                  placeholder="Kode Akun"
                  value={coaFormCode}
                  onChange={(e) => setCoaFormCode(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "monospace" }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Nama Akun *
                </label>
                <input
                  type="text"
                  placeholder="Nama Akun COA"
                  value={coaFormName}
                  onChange={(e) => setCoaFormName(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Kelompok *
                  </label>
                  <select
                    value={coaFormKelompok}
                    onChange={(e) => {
                      const k = e.target.value;
                      setCoaFormKelompok(k);
                      if (k === "Aset") setCoaFormSubKelompok("Aset Lancar");
                      else if (k === "Liabilitas") setCoaFormSubKelompok("Liabilitas Lancar");
                      else if (k === "Ekuitas") setCoaFormSubKelompok("Modal");
                      else if (k === "Pendapatan") setCoaFormSubKelompok("Penjualan");
                      else if (k === "Beban") setCoaFormSubKelompok("Beban Operasional");
                    }}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                  >
                    <option value="Aset">Aset</option>
                    <option value="Liabilitas">Liabilitas</option>
                    <option value="Ekuitas">Ekuitas</option>
                    <option value="Pendapatan">Pendapatan</option>
                    <option value="Beban">Beban</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Sub Kelompok *
                  </label>
                  <select
                    value={coaFormSubKelompok}
                    onChange={(e) => setCoaFormSubKelompok(e.target.value)}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                  >
                    {coaFormKelompok === "Aset" && (
                      <>
                        <option value="Aset Lancar">Aset Lancar</option>
                        <option value="Aset Tetap">Aset Tetap</option>
                      </>
                    )}
                    {coaFormKelompok === "Liabilitas" && (
                      <>
                        <option value="Liabilitas Lancar">Liabilitas Lancar</option>
                        <option value="Liabilitas Jangka Panjang">Liabilitas Jangka Panjang</option>
                      </>
                    )}
                    {coaFormKelompok === "Ekuitas" && (
                      <>
                        <option value="Modal">Modal</option>
                        <option value="Laba Ditahan">Laba Ditahan</option>
                      </>
                    )}
                    {coaFormKelompok === "Pendapatan" && (
                      <>
                        <option value="Penjualan">Penjualan</option>
                        <option value="Pendapatan Lain">Pendapatan Lain</option>
                      </>
                    )}
                    {coaFormKelompok === "Beban" && (
                      <>
                        <option value="Beban Pokok Penjualan">Beban Pokok Penjualan (HPP)</option>
                        <option value="Beban Operasional">Beban Operasional</option>
                        <option value="Beban Non-Operasional">Beban Non-Operasional</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  <input
                    type="checkbox"
                    checked={coaFormActive}
                    onChange={(e) => setCoaFormActive(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "#5005A6" }}
                  />
                  Status Akun Aktif
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setIsCoaModalOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}>
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5005A6", color: "white", fontWeight: 700 }}>
                  {isSubmitting ? "Simpan..." : "Simpan Akun COA"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
