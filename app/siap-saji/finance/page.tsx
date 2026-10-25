"use client";

import { useState, useEffect, Fragment } from "react";
import { CreditCard, DollarSign, Plus, FileText, PieChart, BookOpen, ArrowUpRight, ArrowDownLeft, X, Check, CheckCircle, RefreshCw, Search, Edit3, Trash2, Calendar, Printer, Download, FileSpreadsheet, Eye, AlertTriangle, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/Pagination";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { formatDate } from "@/lib/utils";
import * as XLSX from "xlsx";

export default function SiapSajiFinancePage() {
  const [activeTab, setActiveTab] = useState<"pl" | "purchases" | "expenses" | "kas_bank" | "journals" | "ledger" | "coa" | "neraca">("pl");

  const [loading, setLoading] = useState(true);
  const [neracaData, setNeracaData] = useState<any[]>([]);

  // ── State Modal List Transaksi Keuangan (Drill-down dari P&L dan Neraca) ──
  const [drillModalOpen, setDrillModalOpen] = useState(false);
  const [drillModalTitle, setDrillModalTitle] = useState("");
  const [drillModalCoaId, setDrillModalCoaId] = useState<number | null>(null);
  const [drillModalCoaCode, setDrillModalCoaCode] = useState("");
  const [drillModalCoaName, setDrillModalCoaName] = useState("");
  const [drillDateFrom, setDrillDateFrom] = useState("");
  const [drillDateTo, setDrillDateTo] = useState("");
  const [drillSearch, setDrillSearch] = useState("");
  const [drillPage, setDrillPage] = useState(1);
  const [drillLimit, setDrillLimit] = useState(10);
  const [drillData, setDrillData] = useState<any[]>([]);
  const [drillTotal, setDrillTotal] = useState(0);
  const [drillTotalNominal, setDrillTotalNominal] = useState(0);
  const [drillLoading, setDrillLoading] = useState(false);

  // Helper functions for Year-to-Date (YTD)
  const getYtdStartStr = () => `${new Date().getFullYear()}-01-01`;
  const getTodayStr = () => new Date().toISOString().split("T")[0];

  // ── State Tab Buku Besar (General Ledger) ──
  const [ledgerCoaId, setLedgerCoaId] = useState<number | "">("");
  const [ledgerDateFrom, setLedgerDateFrom] = useState(getYtdStartStr());
  const [ledgerDateTo, setLedgerDateTo] = useState(getTodayStr());
  const [ledgerPreset, setLedgerPreset] = useState("this_year");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerLimit, setLedgerLimit] = useState(25);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

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

  // Tab 1: P&L Data & Filters
  const [plData, setPlData] = useState<any>(null);
  const [plPeriodMode, setPlPeriodMode] = useState<"month" | "date">("date"); // "month" (Bulan/Tahun) or "date" (Harian / Rentang Tanggal)
  const [plMonth, setPlMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [plYear, setPlYear] = useState<string>(String(new Date().getFullYear()));
  const [plDateFrom, setPlDateFrom] = useState<string>(getYtdStartStr());
  const [plDateTo, setPlDateTo] = useState<string>(getTodayStr());

  // Tab 7: Neraca Date & Cutoff Filters
  const [neracaPreset, setNeracaPreset] = useState<string>("today"); // "today" | "yesterday" | "this_month" | "last_month" | "this_year" | "all" | "custom"
  const [neracaDateTo, setNeracaDateTo] = useState<string>(new Date().toISOString().split("T")[0]);
  const [neracaMonth, setNeracaMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [neracaYear, setNeracaYear] = useState<string>(String(new Date().getFullYear()));

  const handleNeracaShortcutChange = (preset: string) => {
    setNeracaPreset(preset);
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "today") {
      setNeracaDateTo(fmt(today));
    } else if (preset === "yesterday") {
      const y = new Date();
      y.setDate(today.getDate() - 1);
      setNeracaDateTo(fmt(y));
    } else if (preset === "this_month") {
      // End of current month or today
      const lastDayThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setNeracaDateTo(fmt(lastDayThisMonth));
    } else if (preset === "last_month") {
      // End of previous month
      const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      setNeracaDateTo(fmt(lastDayPrevMonth));
    } else if (preset === "this_year") {
      // End of current year
      const endYear = new Date(today.getFullYear(), 11, 31);
      setNeracaDateTo(fmt(endYear));
    } else if (preset === "all") {
      setNeracaDateTo("");
    }
  };

  // Tab 2: Purchases Data & Filters
  const [purchases, setPurchases] = useState<any[]>([]);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [purchaseNotaRef, setPurchaseNotaRef] = useState("");
  const [purchaseKeterangan, setPurchaseKeterangan] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState<number>(0);
  const [purchasePaidAmount, setPurchasePaidAmount] = useState<number>(0); // Pembayaran Parsial / DP
  const [purchaseCoaId, setPurchaseCoaId] = useState<number | "">("");
  const [purchaseKasBankId, setPurchaseKasBankId] = useState<number | "hutang" | "">("");
  const [purSearch, setPurSearch] = useState("");
  const [purDateFrom, setPurDateFrom] = useState(getYtdStartStr());
  const [purDateTo, setPurDateTo] = useState(getTodayStr());

  // Edit Purchase State
  const [isEditPurchaseModalOpen, setIsEditPurchaseModalOpen] = useState(false);
  const [editPurchaseId, setEditPurchaseId] = useState<number | null>(null);
  const [editPurDate, setEditPurDate] = useState("");
  const [editPurNotaRef, setEditPurNotaRef] = useState("");
  const [editPurKeterangan, setEditPurKeterangan] = useState("");
  const [editPurTotalAmount, setEditPurTotalAmount] = useState<number>(0);
  const [editPurPaidAmount, setEditPurPaidAmount] = useState<number>(0);
  const [editPurCoaId, setEditPurCoaId] = useState<number | "">("");
  const [editPurKasBankId, setEditPurKasBankId] = useState<number | "hutang" | "">("");

  // Tab 3: Expenses Data & Filters
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [expenseKeterangan, setExpenseKeterangan] = useState("");
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expensePaidAmount, setExpensePaidAmount] = useState<number>(0); // Pembayaran Parsial / DP
  const [expenseCoaId, setExpenseCoaId] = useState<number | "">("");
  const [expenseKasBankId, setExpenseKasBankId] = useState<number | "hutang" | "">("");
  const [expSearch, setExpSearch] = useState("");
  const [expDateFrom, setExpDateFrom] = useState(getYtdStartStr());
  const [expDateTo, setExpDateTo] = useState(getTodayStr());

  // Edit Expense State
  const [isEditExpenseModalOpen, setIsEditExpenseModalOpen] = useState(false);
  const [editExpenseId, setEditExpenseId] = useState<number | null>(null);
  const [editExpDate, setEditExpDate] = useState("");
  const [editExpKeterangan, setEditExpKeterangan] = useState("");
  const [editExpNominal, setEditExpNominal] = useState<number>(0);
  const [editExpPaidAmount, setEditExpPaidAmount] = useState<number>(0);
  const [editExpCoaId, setEditExpCoaId] = useState<number | "">("");
  const [editExpKasBankId, setEditExpKasBankId] = useState<number | "hutang" | "">("");

  // Shared Detail Modal State (Purchases & Expenses)
  const [detailModalItem, setDetailModalItem] = useState<{ type: "purchase" | "expense"; data: any } | null>(null);

  // Shared Pay Debt / Installment Modal State
  const [payDebtModalItem, setPayDebtModalItem] = useState<{ type: "purchase" | "expense"; data: any } | null>(null);
  const [payDebtNominal, setPayDebtNominal] = useState<number>(0);
  const [payDebtKasBankId, setPayDebtKasBankId] = useState<number | "">("");
  const [payDebtDate, setPayDebtDate] = useState(new Date().toISOString().split("T")[0]);
  const [payDebtKeterangan, setPayDebtKeterangan] = useState("");
  const [isSubmittingPayDebt, setIsSubmittingPayDebt] = useState(false);

  // Bulk Pay State for Purchases (Hutang HPP)
  const [selectedPurIds, setSelectedPurIds] = useState<number[]>([]);
  const [isBulkPayModalOpen, setIsBulkPayModalOpen] = useState(false);
  const [bulkPayKasBankId, setBulkPayKasBankId] = useState<number | "">("");
  const [bulkPayDate, setBulkPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [bulkPayKeterangan, setBulkPayKeterangan] = useState("");
  const [isSubmittingBulkPay, setIsSubmittingBulkPay] = useState(false);

  // Shared Cancel Modal State with Mandatory Reason
  const [cancelModalItem, setCancelModalItem] = useState<{ type: "purchase" | "expense"; data: any } | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [isSubmittingCancelItem, setIsSubmittingCancelItem] = useState(false);

  // Tab 4: Kas & Bank Data & Filters
  const [accounts, setAccounts] = useState<any[]>([]);
  const [mutasi, setMutasi] = useState<any[]>([]);
  const [coaList, setCoaList] = useState<any[]>([]);
  const [mutSearch, setMutSearch] = useState("");
  const [mutJenisFilter, setMutJenisFilter] = useState("");
  const [mutDateFrom, setMutDateFrom] = useState(getYtdStartStr());
  const [mutDateTo, setMutDateTo] = useState(getTodayStr());

  // Tab 5: Journals Data & Filters
  const [journals, setJournals] = useState<any[]>([]);
  const [jouSearch, setJouSearch] = useState("");
  const [jouTypeFilter, setJouTypeFilter] = useState("");
  const [jouDateFrom, setJouDateFrom] = useState(getYtdStartStr());
  const [jouDateTo, setJouDateTo] = useState(getTodayStr());

  // Tab 6: COA Data & Filters
  const [coaListAll, setCoaListAll] = useState<any[]>([]); // Master COA list for all modals & system
  const [coaTableList, setCoaTableList] = useState<any[]>([]); // Filtered list specifically for Tab COA table
  const [coaPage, setCoaPage] = useState(1);
  const [coaLimit, setCoaLimit] = useState(10);
  const [coaSearch, setCoaSearch] = useState("");
  const [coaKelompokFilter, setCoaKelompokFilter] = useState("");
  const [coaKlasifikasiPlFilter, setCoaKlasifikasiPlFilter] = useState("");
  const [isCoaModalOpen, setIsCoaModalOpen] = useState(false);
  const [editingCoa, setEditingCoa] = useState<any | null>(null);
  const [coaFormCode, setCoaFormCode] = useState("");
  const [coaFormName, setCoaFormName] = useState("");
  const [coaFormKelompok, setCoaFormKelompok] = useState("Aset");
  const [coaFormSubKelompok, setCoaFormSubKelompok] = useState("Aset Lancar");
  const [coaFormActive, setCoaFormActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tab 4: Kas & Bank Account Modal (Add & Edit)
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [accFormNama, setAccFormNama] = useState("");
  const [accFormJenis, setAccFormJenis] = useState("Bank");
  const [accFormNamaBank, setAccFormNamaBank] = useState("");
  const [accFormNoRek, setAccFormNoRek] = useState("");
  const [accFormSaldoAwal, setAccFormSaldoAwal] = useState<number>(0);
  const [accFormCoaId, setAccFormCoaId] = useState<number | "">("");
  const [accFormIsDefault, setAccFormIsDefault] = useState(false);

  // Tab 4: Kas Masuk & Kas Keluar Modal State (Req 4 & Screenshot 4)
  const [isKasMutasiModalOpen, setIsKasMutasiModalOpen] = useState(false);
  const [kasMutasiJenis, setKasMutasiJenis] = useState<"Masuk" | "Keluar">("Keluar");
  const [kasMutasiBankId, setKasMutasiBankId] = useState<number | "">("");
  const [kasMutasiDate, setKasMutasiDate] = useState(new Date().toISOString().split("T")[0]);
  const [kasMutasiNominal, setKasMutasiNominal] = useState<number>(0);
  const [kasMutasiCoaId, setKasMutasiCoaId] = useState<number | "">("");
  const [kasMutasiKeterangan, setKasMutasiKeterangan] = useState("");

  // Tab 5: Jurnal Umum Manual Modal State (Req 5 & Screenshot 5)
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [editingJournalId, setEditingJournalId] = useState<number | null>(null);
  const [jouFormDate, setJouFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [jouFormRefNo, setJouFormRefNo] = useState("");
  const [jouFormDebitCoaId, setJouFormDebitCoaId] = useState<number | "">("");
  const [jouFormCreditCoaId, setJouFormCreditCoaId] = useState<number | "">("");
  const [jouFormNominal, setJouFormNominal] = useState<number>(0);
  const [jouFormKeterangan, setJouFormKeterangan] = useState("");

  // Tab 5: Pembatalan Jurnal Umum State & Reason
  const [cancelJournalTarget, setCancelJournalTarget] = useState<any | null>(null);
  const [cancelJournalReason, setCancelJournalReason] = useState("");
  const [isSubmittingCancelJournal, setIsSubmittingCancelJournal] = useState(false);

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
        if (json.coa?.length > 0) {
          setCoaList(json.coa);
          setCoaListAll((prev) => (prev && prev.length > 0 ? prev : json.coa));
        }

        if (json.accounts?.length > 0) {
          if (!purchaseKasBankId) setPurchaseKasBankId(json.accounts[0].id);
          if (!expenseKasBankId) setExpenseKasBankId(json.accounts[0].id);
        }

        if (json.coa?.length > 0) {
          const defaultHpp = json.coa.find((c: any) => c.kode_akun === "5-1001" || c.kode_akun === "5-50000" || c.sub_kelompok === "Beban Pokok Penjualan");
          if (defaultHpp && !purchaseCoaId) setPurchaseCoaId(defaultHpp.id);

          const defaultExpense = json.coa.find((c: any) => c.sub_kelompok === "Beban Operasional" || c.kode_akun?.startsWith("6-") || c.kelompok === "Beban");
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
        const queryParams: Record<string, string> = { type: "pl" };
        if (plPeriodMode === "date") {
          if (plDateFrom) queryParams.date_from = plDateFrom;
          if (plDateTo) queryParams.date_to = plDateTo;
        } else {
          queryParams.month = plMonth;
          queryParams.year = plYear;
        }
        const q = new URLSearchParams(queryParams).toString();
        const res = await fetch(`/api/siap-saji/finance/reports?${q}`);
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
        const qObj: Record<string, string> = {};
        if (coaSearch) qObj.search = coaSearch;
        if (coaKelompokFilter) qObj.kelompok = coaKelompokFilter;
        if (coaKlasifikasiPlFilter) qObj.klasifikasi_pl = coaKlasifikasiPlFilter;
        const q = new URLSearchParams(qObj).toString();
        const res = await fetch(`/api/siap-saji/finance/coa?${q}`);
        if (res.ok) {
          const json = await res.json();
          setCoaTableList(json.data || []);
          // Also initialize master list if still empty
          if (json.data?.length > 0) {
            setCoaListAll((prev) => (prev && prev.length > 0 ? prev : json.data));
            setCoaList((prev) => (prev && prev.length > 0 ? prev : json.data));
          }
        }
      } else if (activeTab === "ledger") {
        await fetchLedgerData();
      } else if (activeTab === "neraca") {
        const qObj: Record<string, string> = { type: "neraca" };
        if (neracaDateTo) qObj.date_to = neracaDateTo;
        const q = new URLSearchParams(qObj).toString();
        const res = await fetch(`/api/siap-saji/finance/reports?${q}`);
        if (res.ok) setNeracaData(await res.json());
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat data keuangan");
    } finally {
      setLoading(false);
    }
  };

  // Fetch data Buku Besar (General Ledger)
  const fetchLedgerData = async (targetCoaId = ledgerCoaId, page = ledgerPage, lim = ledgerLimit, from = ledgerDateFrom, to = ledgerDateTo) => {
    if (!targetCoaId) {
      setLedgerData(null);
      return;
    }
    setLedgerLoading(true);
    try {
      const q = new URLSearchParams({
        type: "ledger",
        coa_id: String(targetCoaId),
        date_from: from,
        date_to: to,
        page: String(page),
        limit: String(lim),
      }).toString();
      const res = await fetch(`/api/siap-saji/finance/reports?${q}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal memuat buku besar");
      }
      setLedgerData(json);
    } catch (e: any) {
      toast.error(e.message || "Gagal memuat buku besar");
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleLedgerShortcutChange = (preset: string) => {
    setLedgerPreset(preset);
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    let from = "";
    let to = "";
    if (preset === "today") {
      from = fmt(today);
      to = fmt(today);
    } else if (preset === "yesterday") {
      const y = new Date();
      y.setDate(today.getDate() - 1);
      from = fmt(y);
      to = fmt(y);
    } else if (preset === "this_month") {
      const startM = new Date(today.getFullYear(), today.getMonth(), 1);
      const endM = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      from = fmt(startM);
      to = fmt(endM);
    } else if (preset === "last_month") {
      const startM = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endM = new Date(today.getFullYear(), today.getMonth(), 0);
      from = fmt(startM);
      to = fmt(endM);
    } else if (preset === "this_year") {
      from = `${today.getFullYear()}-01-01`;
      to = `${today.getFullYear()}-12-31`;
    } else if (preset === "all") {
      from = "";
      to = "";
    }
    setLedgerDateFrom(from);
    setLedgerDateTo(to);
    setLedgerPage(1);
    if (ledgerCoaId) {
      fetchLedgerData(ledgerCoaId, 1, ledgerLimit, from, to);
    }
  };

  // ── Drill-Down Modal Transaksi Keuangan (dari item P&L atau Neraca) ──
  const handleOpenDrillModal = (account: { id?: number; kode_akun: string; nama_akun: string }, customFrom?: string, customTo?: string) => {
    let resolvedId = account.id;
    if (!resolvedId) {
      const master = coaListAll.length > 0 ? coaListAll : coaList;
      const found = master.find((c: any) => c.kode_akun === account.kode_akun || c.nama_akun.toLowerCase() === account.nama_akun.toLowerCase());
      if (found) resolvedId = found.id;
    }

    setDrillModalCoaId(resolvedId || null);
    setDrillModalCoaCode(account.kode_akun);
    setDrillModalCoaName(account.nama_akun);
    setDrillModalTitle(`Rincian Transaksi: (${account.kode_akun}) ${account.nama_akun}`);

    // Compute default date range if not passed
    let from = customFrom !== undefined ? customFrom : "";
    let to = customTo !== undefined ? customTo : "";

    if (customFrom === undefined && customTo === undefined) {
      if (activeTab === "pl") {
        if (plPeriodMode === "date") {
          from = plDateFrom;
          to = plDateTo;
        } else {
          // plPeriodMode === "month"
          const y = Number(plYear) || new Date().getFullYear();
          if (plMonth && plMonth !== "all") {
            const m = Number(plMonth);
            from = `${y}-${String(m).padStart(2, "0")}-01`;
            const lastDay = new Date(y, m, 0).getDate();
            to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
          } else {
            from = `${y}-01-01`;
            to = `${y}-12-31`;
          }
        }
      } else if (activeTab === "neraca") {
        from = "";
        to = neracaDateTo || "";
      }
    }

    setDrillDateFrom(from);
    setDrillDateTo(to);
    setDrillSearch("");
    setDrillPage(1);
    setDrillModalOpen(true);

    fetchDrillData(resolvedId, from, to, "", 1, drillLimit);
  };

  const fetchDrillData = async (coaId = drillModalCoaId, from = drillDateFrom, to = drillDateTo, search = drillSearch, page = drillPage, lim = drillLimit) => {
    setDrillLoading(true);
    try {
      const qObj: Record<string, string> = {
        type: "journals",
        page: String(page),
        limit: String(lim),
      };
      if (coaId) qObj.account_id = String(coaId);
      if (from) qObj.date_from = from;
      if (to) qObj.date_to = to;
      if (search) qObj.search = search;

      const q = new URLSearchParams(qObj).toString();
      const res = await fetch(`/api/siap-saji/finance/reports?${q}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          setDrillData(json);
          setDrillTotal(json.length);
          setDrillTotalNominal(json.reduce((acc: number, it: any) => acc + Number(it.nominal || 0), 0));
        } else {
          setDrillData(json.data || []);
          setDrillTotal(json.total || 0);
          setDrillTotalNominal(json.total_nominal || 0);
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Gagal memuat rincian transaksi");
    } finally {
      setDrillLoading(false);
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
      fetchCoaMaster();
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
      fetchCoaMaster();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus COA");
    }
  };

  const fetchCoaMaster = async () => {
    try {
      const res = await fetch("/api/siap-saji/finance/coa");
      if (res.ok) {
        const json = await res.json();
        if (json.data?.length > 0) {
          setCoaListAll(json.data);
          setCoaList(json.data);

          const defaultHpp = json.data.find((c: any) => c.kode_akun === "5-1001" || c.kode_akun === "5-50000" || c.sub_kelompok === "Beban Pokok Penjualan");
          if (defaultHpp && !purchaseCoaId) setPurchaseCoaId(defaultHpp.id);

          const defaultExpense = json.data.find((c: any) => c.sub_kelompok === "Beban Operasional" || c.kode_akun?.startsWith("6-") || c.kelompok === "Beban");
          if (defaultExpense && !expenseCoaId) setExpenseCoaId(defaultExpense.id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchKasBankMaster();
    fetchCoaMaster();
  }, []);

  useEffect(() => {
    fetchTabData();
  }, [
    activeTab,
    plPeriodMode, plMonth, plYear, plDateFrom, plDateTo,
    purPage, purLimit, purSearch, purDateFrom, purDateTo,
    expPage, expLimit, expSearch, expDateFrom, expDateTo,
    mutSearch, mutJenisFilter, mutDateFrom, mutDateTo,
    jouPage, jouLimit, jouSearch, jouTypeFilter, jouDateFrom, jouDateTo,
    coaSearch, coaKelompokFilter, coaKlasifikasiPlFilter,
    neracaDateTo,
    ledgerCoaId, ledgerDateFrom, ledgerDateTo, ledgerPage, ledgerLimit,
  ]);

  // Submit HPP Purchase
  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseKeterangan || !purchaseAmount || !purchaseKasBankId) {
      return toast.error("Keterangan, Total Nominal, dan Rekening wajib diisi.");
    }

    setIsSubmitting(true);
    try {
      const isHutang = String(purchaseKasBankId) === "hutang" || String(purchaseKasBankId) === "0";
      const paid = isHutang ? 0 : (purchasePaidAmount !== undefined && purchasePaidAmount !== null ? purchasePaidAmount : purchaseAmount);

      const res = await fetch("/api/siap-saji/finance/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchase_date: purchaseDate,
          nota_ref: purchaseNotaRef,
          keterangan: purchaseKeterangan,
          total_amount: purchaseAmount,
          dibayar: paid,
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
      setPurchasePaidAmount(0);
      fetchTabData();
      fetchKasBankMaster();
    } catch (err: any) {
      toast.error(err.message || "Gagal mencatat HPP");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Purchase Modal
  const handleOpenEditPurchase = (item: any) => {
    setEditPurchaseId(item.id);
    setEditPurDate(item.purchase_date ? item.purchase_date.split("T")[0] : new Date().toISOString().split("T")[0]);
    setEditPurNotaRef(item.nota_ref || "");
    setEditPurKeterangan(item.keterangan || "");
    const tot = Number(item.total_amount || 0);
    const dib = Number(item.dibayar !== undefined && item.dibayar !== null ? item.dibayar : tot);
    setEditPurTotalAmount(tot);
    setEditPurPaidAmount(dib);
    setEditPurCoaId(item.coa_id || "");
    setEditPurKasBankId(item.kas_bank_id || (item.status === "Hutang" ? "hutang" : (accounts.length > 0 ? accounts[0].id : "")));
    setIsEditPurchaseModalOpen(true);
  };

  const handleSaveEditPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPurchaseId || !editPurDate || !editPurKeterangan || !editPurTotalAmount) {
      return toast.error("Tanggal, Keterangan, dan Total Nominal wajib diisi.");
    }
    setIsSubmitting(true);
    try {
      const isHutang = String(editPurKasBankId) === "hutang" || String(editPurKasBankId) === "0";
      const paid = isHutang ? 0 : (editPurPaidAmount !== undefined && editPurPaidAmount !== null ? editPurPaidAmount : editPurTotalAmount);

      const res = await fetch("/api/siap-saji/finance/purchases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editPurchaseId,
          purchase_date: editPurDate,
          nota_ref: editPurNotaRef,
          keterangan: editPurKeterangan,
          total_amount: editPurTotalAmount,
          dibayar: paid,
          coa_id: editPurCoaId,
          kas_bank_id: editPurKasBankId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui nota HPP");
      toast.success("Nota HPP berhasil diperbarui!");
      setIsEditPurchaseModalOpen(false);
      fetchTabData();
      fetchKasBankMaster();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui nota HPP");
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
      const isHutang = String(expenseKasBankId) === "hutang" || String(expenseKasBankId) === "0";
      const paid = isHutang ? 0 : (expensePaidAmount !== undefined && expensePaidAmount !== null ? expensePaidAmount : expenseAmount);

      const res = await fetch("/api/siap-saji/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expense_date: expenseDate,
          keterangan: expenseKeterangan,
          nominal: expenseAmount,
          dibayar: paid,
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
      setExpensePaidAmount(0);
      fetchTabData();
      fetchKasBankMaster();
    } catch (err: any) {
      toast.error(err.message || "Gagal mencatat biaya");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditExpense = (item: any) => {
    setEditExpenseId(item.id);
    setEditExpDate(item.journal_date ? item.journal_date.split("T")[0] : new Date().toISOString().split("T")[0]);
    setEditExpKeterangan(item.keterangan ? item.keterangan.replace(/^Biaya Operasional:\s*/i, "") : "");
    const tot = Number(item.nominal || 0);
    const dib = Number(item.dibayar !== undefined && item.dibayar !== null ? item.dibayar : tot);
    setEditExpNominal(tot);
    setEditExpPaidAmount(dib);
    setEditExpCoaId(item.akun_debit || "");
    setEditExpKasBankId(item.kas_bank_id || (item.kredit_nama?.toLowerCase().includes("utang") ? "hutang" : (accounts.length > 0 ? accounts[0].id : "")));
    setIsEditExpenseModalOpen(true);
  };

  const handleSaveEditExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExpenseId || !editExpDate || !editExpKeterangan || !editExpNominal || !editExpCoaId) {
      return toast.error("Tanggal, Keterangan, Nominal, dan Kategori Beban wajib diisi.");
    }
    setIsSubmitting(true);
    try {
      const isHutang = String(editExpKasBankId) === "hutang" || String(editExpKasBankId) === "0";
      const paid = isHutang ? 0 : (editExpPaidAmount !== undefined && editExpPaidAmount !== null ? editExpPaidAmount : editExpNominal);

      const res = await fetch("/api/siap-saji/finance/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editExpenseId,
          expense_date: editExpDate,
          keterangan: editExpKeterangan,
          nominal: editExpNominal,
          dibayar: paid,
          coa_id: editExpCoaId,
          kas_bank_id: editExpKasBankId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui biaya operasional");
      toast.success("Biaya operasional berhasil diperbarui!");
      setIsEditExpenseModalOpen(false);
      fetchTabData();
      fetchKasBankMaster();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui biaya");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Pay Debt Modal (Shared for HPP & Expense)
  const handleOpenPayDebtModal = (type: "purchase" | "expense", item: any) => {
    setPayDebtModalItem({ type, data: item });
    const sisa = Number(item.sisa_hutang !== undefined && item.sisa_hutang !== null ? item.sisa_hutang : (type === "purchase" ? item.total_amount : item.nominal));
    setPayDebtNominal(sisa);
    setPayDebtDate(new Date().toISOString().split("T")[0]);
    setPayDebtKeterangan(`Pembayaran Cicilan/Pelunasan Hutang`);
    setPayDebtKasBankId(accounts.length > 0 ? accounts[0].id : "");
  };

  // Submit Pay Debt (Installment / Full)
  const handleSubmitPayDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payDebtModalItem || !payDebtNominal || !payDebtKasBankId) {
      return toast.error("Nominal bayar dan Rekening Kas/Bank wajib dipilih.");
    }
    setIsSubmittingPayDebt(true);
    try {
      const endpoint = payDebtModalItem.type === "purchase" ? "/api/siap-saji/finance/purchases" : "/api/siap-saji/finance/expenses";
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: payDebtModalItem.data.id,
          nominal_bayar: payDebtNominal,
          kas_bank_id: payDebtKasBankId,
          tanggal_bayar: payDebtDate,
          keterangan: payDebtKeterangan,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mencatat pembayaran hutang");
      toast.success("Pembayaran cicilan/pelunasan hutang berhasil dicatat!");
      setPayDebtModalItem(null);
      fetchTabData();
      fetchKasBankMaster();
    } catch (err: any) {
      toast.error(err.message || "Gagal membayar hutang");
    } finally {
      setIsSubmittingPayDebt(false);
    }
  };

  // Open Bulk Pay Modal for selected purchases
  const handleOpenBulkPayModal = () => {
    if (selectedPurIds.length === 0) {
      return toast.error("Pilih minimal satu nota hutang untuk dibayar.");
    }
    const unpaidSelected = purchases.filter((p) => selectedPurIds.includes(p.id) && Number(p.sisa_hutang || 0) > 0 && p.status !== "Dibatalkan");
    if (unpaidSelected.length === 0) {
      return toast.error("Semua nota yang dipilih sudah lunas atau dibatalkan.");
    }
    setBulkPayDate(new Date().toISOString().split("T")[0]);
    setBulkPayKeterangan(`Bulk Pelunasan ${unpaidSelected.length} Nota Hutang HPP`);
    setBulkPayKasBankId(accounts.length > 0 ? accounts[0].id : "");
    setIsBulkPayModalOpen(true);
  };

  // Submit Bulk Payment
  const handleSubmitBulkPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPurIds.length === 0 || !bulkPayKasBankId) {
      return toast.error("Rekening Kas/Bank wajib dipilih.");
    }
    setIsSubmittingBulkPay(true);
    try {
      const res = await fetch("/api/siap-saji/finance/purchases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedPurIds,
          kas_bank_id: bulkPayKasBankId,
          tanggal_bayar: bulkPayDate,
          keterangan: bulkPayKeterangan,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal melakukan pembayaran massal (bulk bayar)");
      toast.success(data.message || "Bulk pembayaran hutang berhasil dicatat!");
      setIsBulkPayModalOpen(false);
      setSelectedPurIds([]);
      fetchTabData();
      fetchKasBankMaster();
    } catch (err: any) {
      toast.error(err.message || "Gagal melakukan bulk bayar");
    } finally {
      setIsSubmittingBulkPay(false);
    }
  };

  // Open Cancel Modal (Mandatory reason)
  const handleOpenCancelModal = (type: "purchase" | "expense", item: any) => {
    setCancelModalItem({ type, data: item });
    setCancelReasonInput("");
  };

  // Confirm Cancellation
  const handleConfirmCancelItem = async () => {
    if (!cancelModalItem) return;
    if (!cancelReasonInput.trim() || cancelReasonInput.trim().length < 5) {
      return toast.error("Alasan pembatalan wajib diisi (minimal 5 karakter).");
    }
    setIsSubmittingCancelItem(true);
    try {
      const endpoint = cancelModalItem.type === "purchase"
        ? `/api/siap-saji/finance/purchases?id=${cancelModalItem.data.id}&reason=${encodeURIComponent(cancelReasonInput.trim())}`
        : `/api/siap-saji/finance/expenses?id=${cancelModalItem.data.id}&reason=${encodeURIComponent(cancelReasonInput.trim())}`;

      const res = await fetch(endpoint, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membatalkan transaksi");
      toast.success("Transaksi berhasil dibatalkan dan saldo kas dikembalikan!");
      setCancelModalItem(null);
      fetchTabData();
      fetchKasBankMaster();
    } catch (err: any) {
      toast.error(err.message || "Gagal membatalkan transaksi");
    } finally {
      setIsSubmittingCancelItem(false);
    }
  };

  // Helpers for P&L calculations
  const calculatePlCategoryTotal = (kelompok: string, subKelompok?: string) => {
    if (!plData || !plData.details) return 0;
    return plData.details
      .filter((d: any) => d.kelompok === kelompok && (!subKelompok || d.sub_kelompok === subKelompok))
      .reduce((sum: number, d: any) => sum + Number(d.total_nominal || 0), 0);
  };

  // Helper to distinguish Food Cost vs Overhead under HPP
  const isFoodCostAccount = (acc: any) => {
    const code = String(acc.kode_akun || "").trim();
    const name = String(acc.nama_akun || "").toLowerCase();
    // Codes like 5-1001, 5-50000, 5-1002 (Bahan Baku / Kemasan / Food)
    if (code.startsWith("5-1001") || code.startsWith("5-1002") || code.startsWith("5-50000")) return true;
    if (name.includes("bahan baku") || name.includes("bahan") || name.includes("kemasan") || name.includes("food cost")) return true;
    // Overhead keywords: gaji, gas, listrik, air, sewa, transport, bensin, operasional
    if (name.includes("gaji") || name.includes("gas") || name.includes("listrik") || name.includes("air") || name.includes("sewa") || name.includes("bensin") || name.includes("overhead")) return false;
    return true; // Default HPP is food cost if not explicitly overhead
  };

  const totalPendapatan = calculatePlCategoryTotal("Pendapatan");
  const totalHpp = calculatePlCategoryTotal("Beban", "Beban Pokok Penjualan");

  // Split HPP into Food Cost and Overhead
  const hppDetails = (plData?.details || []).filter(
    (d: any) => d.kelompok === "Beban" && d.sub_kelompok === "Beban Pokok Penjualan"
  );
  const totalFoodCost = hppDetails
    .filter(isFoodCostAccount)
    .reduce((sum: number, d: any) => sum + Number(d.total_nominal || 0), 0);
  const totalOverheadHpp = hppDetails
    .filter((d: any) => !isFoodCostAccount(d))
    .reduce((sum: number, d: any) => sum + Number(d.total_nominal || 0), 0);

  const labaKotor = totalPendapatan - totalHpp;
  const totalBiayaOperasional = calculatePlCategoryTotal("Beban", "Beban Operasional");
  const labaBersih = labaKotor - totalBiayaOperasional;

  // Percentage against totalPendapatan (Omset)
  const pctFoodCost = totalPendapatan > 0 ? ((totalFoodCost / totalPendapatan) * 100).toFixed(1) : "0.0";
  const pctOverheadHpp = totalPendapatan > 0 ? ((totalOverheadHpp / totalPendapatan) * 100).toFixed(1) : "0.0";
  const pctTotalHpp = totalPendapatan > 0 ? ((totalHpp / totalPendapatan) * 100).toFixed(1) : "0.0";
  const pctLabaKotor = totalPendapatan > 0 ? ((labaKotor / totalPendapatan) * 100).toFixed(1) : "0.0";
  const pctBiayaOperasional = totalPendapatan > 0 ? ((totalBiayaOperasional / totalPendapatan) * 100).toFixed(1) : "0.0";
  const pctLabaBersih = totalPendapatan > 0 ? ((labaBersih / totalPendapatan) * 100).toFixed(1) : "0.0";

  // Export P&L to Excel (.xlsx) matching Accurate Online format (Screenshot 2)
  const handleExportPlXLSX = () => {
    if (!plData || !plData.details) {
      return toast.error("Data Laba/Rugi belum siap untuk diexport");
    }

    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    let periodStr = "";
    if (plPeriodMode === "date") {
      periodStr = `Dari ${plDateFrom} s/d ${plDateTo}`;
    } else {
      periodStr = plMonth === "all" ? `Tahun ${plYear}` : `Bulan ${monthNames[Number(plMonth) - 1]} ${plYear}`;
    }

    const rows: (string | number)[][] = [
      ["DYUMMY CATERING"],
      ["LABA / RUGI (STANDAR)"],
      [periodStr],
      ["Cabang: [Semua Cabang] | Mata Uang: Indonesian Rupiah"],
      [],
      ["Deskripsi", "Nominal (Rp)"],
      ["PENDAPATAN", ""],
      ["  Pendapatan Operasional", ""],
    ];

    const pendAccounts = plData.details.filter((d: any) => d.kelompok === "Pendapatan");
    pendAccounts.forEach((acc: any) => {
      rows.push([`    (${acc.kode_akun}) ${acc.nama_akun}`, Number(acc.total_nominal || 0)]);
    });
    rows.push(["Jumlah Pendapatan", totalPendapatan]);
    rows.push([]);

    rows.push(["HARGA POKOK PENJUALAN (HPP & OVERHEAD)", ""]);
    rows.push(["  1. Food Cost (Bahan Baku & Kemasan)", ""]);
    const foodCostAccs = hppDetails.filter(isFoodCostAccount);
    foodCostAccs.forEach((acc: any) => {
      rows.push([`    (${acc.kode_akun}) ${acc.nama_akun}`, Number(acc.total_nominal || 0)]);
    });
    rows.push(["  Subtotal Food Cost", totalFoodCost]);

    rows.push(["  2. Overhead Dapur (Gaji, Gas, Operasional Dapur)", ""]);
    const overheadAccs = hppDetails.filter((d: any) => !isFoodCostAccount(d));
    overheadAccs.forEach((acc: any) => {
      rows.push([`    (${acc.kode_akun}) ${acc.nama_akun}`, Number(acc.total_nominal || 0)]);
    });
    rows.push(["  Subtotal Overhead Dapur", totalOverheadHpp]);

    rows.push(["Jumlah Beban Pokok Penjualan (HPP & Overhead)", totalHpp]);
    rows.push([]);

    rows.push(["LABA KOTOR", labaKotor]);
    rows.push([]);

    rows.push(["BEBAN OPERASIONAL", ""]);
    rows.push(["  Beban Operasional", ""]);
    const opexAccs = plData.details.filter((d: any) => d.kelompok === "Beban" && d.sub_kelompok === "Beban Operasional");
    opexAccs.forEach((acc: any) => {
      rows.push([`    (${acc.kode_akun}) ${acc.nama_akun}`, Number(acc.total_nominal || 0)]);
    });
    rows.push(["Jumlah Beban Operasional", totalBiayaOperasional]);
    rows.push([]);

    rows.push(["LABA OPERASIONAL", labaKotor - totalBiayaOperasional]);
    rows.push([]);

    const otherAccs = plData.details.filter(
      (d: any) => d.kelompok === "Beban" && d.sub_kelompok !== "Beban Pokok Penjualan" && d.sub_kelompok !== "Beban Operasional"
    );
    if (otherAccs.length > 0) {
      rows.push(["PENDAPATAN / (BEBAN) LAIN-LAIN", ""]);
      otherAccs.forEach((acc: any) => {
        rows.push([`    (${acc.kode_akun}) ${acc.nama_akun}`, Number(acc.total_nominal || 0)]);
      });
      rows.push([]);
    }

    rows.push(["LABA BERSIH", labaBersih]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    ws["!cols"] = [{ wch: 45 }, { wch: 25 }];

    XLSX.utils.book_append_sheet(wb, ws, "Laba Rugi Standar");
    const safePeriod = periodStr.replace(/[^a-zA-Z0-9_-]/g, "_");
    XLSX.writeFile(wb, `Laporan_Laba_Rugi_DYummy_Catering_${safePeriod}.xlsx`);
    toast.success("Laporan Laba/Rugi berhasil diexport ke Excel (.xlsx)!");
  };

  // Open PDF Print Page matching Accurate Online format (Screenshot 2)
  const handlePrintPlPDF = () => {
    const q = new URLSearchParams();
    if (plPeriodMode === "date") {
      if (plDateFrom) q.append("date_from", plDateFrom);
      if (plDateTo) q.append("date_to", plDateTo);
    } else {
      q.append("month", plMonth);
      q.append("year", plYear);
    }
    window.open(`/print/siap-saji/pl?${q.toString()}`, "_blank");
  };

  // Export Neraca Keuangan ke Excel (.xlsx)
  const handleExportNeracaXLSX = () => {
    if (!neracaData || neracaData.length === 0) {
      return toast.error("Data Neraca belum tersedia untuk diekspor");
    }

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

    const kasBankRows = asetRows.filter((r) => r.kode_akun.startsWith("1-1001") || r.kode_akun.startsWith("1-1002") || r.kode_akun.startsWith("1-1003") || r.nama_akun.toLowerCase().includes("kas") || r.nama_akun.toLowerCase().includes("bank"));
    const asetLancarLainRows = asetRows.filter((r) => (r.sub_kelompok === "Aset Lancar" || !r.sub_kelompok) && !kasBankRows.includes(r));
    const asetTetapRows = asetRows.filter((r) => r.sub_kelompok === "Aset Tetap");
    const asetLainnyaRows = asetRows.filter((r) => r.sub_kelompok === "Aset Lainnya");

    const totalKasBank = kasBankRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0);
    const totalAsetLancarLain = asetLancarLainRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0);
    const totalAsetLancar = totalKasBank + totalAsetLancarLain;
    const totalAsetTetap = asetTetapRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0);
    const totalAsetLainnya = asetLainnyaRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0);

    const liabLancarRows = liabRows.filter((r) => r.sub_kelompok === "Liabilitas Lancar" || !r.sub_kelompok);
    const liabJangkaPanjangRows = liabRows.filter((r) => r.sub_kelompok === "Liabilitas Jangka Panjang");
    const totalLiabLancar = Math.abs(liabLancarRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0));
    const totalLiabJangkaPanjang = Math.abs(liabJangkaPanjangRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0));

    const cutoffLabel = neracaDateTo
      ? new Date(neracaDateTo).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
      : "Semua Waktu (Kumulatif)";

    const rows: (string | number)[][] = [
      ["DYUMMY CATERING — SIAP SAJI"],
      ["NERACA KEUANGAN (BALANCE SHEET)"],
      [`Per Tanggal: ${cutoffLabel}`],
      ["Mata Uang: Indonesian Rupiah (IDR)"],
      [],
      ["DESKRIPSI AKUN", "SALDO (RP)"],
      ["1. ASET (AKTIVA)", ""],
      ["  Kas & Bank", ""],
    ];

    kasBankRows.forEach((r) => rows.push([`    (${r.kode_akun}) ${r.nama_akun}`, Number(r.saldo || 0)]));
    rows.push(["  Total Kas & Bank", totalKasBank]);
    rows.push([]);

    rows.push(["  Aset Lancar Lainnya", ""]);
    asetLancarLainRows.forEach((r) => rows.push([`    (${r.kode_akun}) ${r.nama_akun}`, Number(r.saldo || 0)]));
    rows.push(["  Total Aset Lancar Lainnya", totalAsetLancarLain]);
    rows.push(["JUMLAH ASET LANCAR", totalAsetLancar]);
    rows.push([]);

    rows.push(["  Aset Tetap", ""]);
    asetTetapRows.forEach((r) => rows.push([`    (${r.kode_akun}) ${r.nama_akun}`, Number(r.saldo || 0)]));
    rows.push(["JUMLAH ASET TETAP", totalAsetTetap]);
    rows.push([]);

    if (asetLainnyaRows.length > 0) {
      rows.push(["  Aset Lainnya", ""]);
      asetLainnyaRows.forEach((r) => rows.push([`    (${r.kode_akun}) ${r.nama_akun}`, Number(r.saldo || 0)]));
      rows.push(["JUMLAH ASET LAINNYA", totalAsetLainnya]);
      rows.push([]);
    }

    rows.push(["TOTAL ASET (AKTIVA)", totalAset]);
    rows.push([]);

    rows.push(["2. LIABILITAS (KEWAJIBAN)", ""], ["  Liabilitas Jangka Pendek (Utang Lancar)", ""]);
    liabLancarRows.forEach((r) => rows.push([`    (${r.kode_akun}) ${r.nama_akun}`, Math.abs(Number(r.saldo || 0))]));
    rows.push(["  Total Liabilitas Jangka Pendek", totalLiabLancar]);

    if (liabJangkaPanjangRows.length > 0) {
      rows.push(["  Liabilitas Jangka Panjang", ""]);
      liabJangkaPanjangRows.forEach((r) => rows.push([`    (${r.kode_akun}) ${r.nama_akun}`, Math.abs(Number(r.saldo || 0))]));
      rows.push(["  Total Liabilitas Jangka Panjang", totalLiabJangkaPanjang]);
    }
    rows.push(["JUMLAH LIABILITAS", totalLiabilitas]);
    rows.push([]);

    rows.push(["3. EKUITAS (MODAL)", ""]);
    ekuitasRows.forEach((r) => rows.push([`    (${r.kode_akun}) ${r.nama_akun}`, Math.abs(Number(r.saldo || 0))]));
    rows.push(["    (3-2001) Laba Bersih Berjalan (P&L)", labaBerjalan]);
    rows.push(["JUMLAH EKUITAS", totalEkuitasTotal]);
    rows.push([]);

    rows.push(["TOTAL LIABILITAS & EKUITAS (PASSIVA)", totalPassiva]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 45 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws, "Neraca Keuangan");
    const safeDate = (neracaDateTo || "kumulatif").replace(/[^a-zA-Z0-9_-]/g, "_");
    XLSX.writeFile(wb, `Neraca_Keuangan_DYummy_Catering_${safeDate}.xlsx`);
    toast.success("Laporan Neraca berhasil diexport ke Excel (.xlsx)!");
  };

  const handlePrintNeracaPDF = () => {
    window.print();
  };

  const handleOpenAddAccount = () => {
    setEditingAccountId(null);
    setAccFormNama("");
    setAccFormJenis("Bank");
    setAccFormNamaBank("");
    setAccFormNoRek("");
    setAccFormSaldoAwal(0);
    setAccFormCoaId("");
    setAccFormIsDefault(false);
    setIsAccountModalOpen(true);
  };

  const handleOpenEditAccount = (acc: any) => {
    setEditingAccountId(acc.id);
    setAccFormNama(acc.nama_rekening || "");
    setAccFormJenis(acc.jenis || "Bank");
    setAccFormNamaBank(acc.nama_bank || "");
    setAccFormNoRek(acc.no_rekening || "");
    setAccFormSaldoAwal(Number(acc.saldo_awal || 0));
    setAccFormCoaId(acc.coa_id ? Number(acc.coa_id) : "");
    setAccFormIsDefault(Boolean(acc.is_payment_default));
    setIsAccountModalOpen(true);
  };

  const handleSubmitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accFormNama.trim()) {
      toast.error("Nama rekening wajib diisi.");
      return;
    }
    setIsSubmitting(true);
    try {
      const method = editingAccountId ? "PUT" : "POST";
      const payload = {
        id: editingAccountId,
        nama_rekening: accFormNama.trim(),
        jenis: accFormJenis,
        nama_bank: accFormNamaBank.trim() || null,
        no_rekening: accFormNoRek.trim() || null,
        saldo_awal: accFormSaldoAwal,
        coa_id: accFormCoaId ? Number(accFormCoaId) : null,
        is_payment_default: accFormIsDefault,
      };

      const res = await fetch("/api/siap-saji/finance/kas-bank", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Gagal menyimpan rekening kas/bank");
      }

      toast.success(editingAccountId ? "Rekening kas/bank berhasil diperbarui!" : "Rekening kas/bank berhasil ditambahkan!");
      setIsAccountModalOpen(false);
      fetchKasBankMaster();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan rekening");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers for Kas Masuk / Keluar & Jurnal Umum Manual
  const handleOpenKasMutasiModal = (jenis: "Masuk" | "Keluar") => {
    setKasMutasiJenis(jenis);
    setKasMutasiBankId(accounts.length > 0 ? accounts[0].id : "");
    setKasMutasiDate(new Date().toISOString().split("T")[0]);
    setKasMutasiNominal(0);

    const availableCoa = coaListAll.length > 0 ? coaListAll : coaList;
    if (jenis === "Keluar") {
      const priveAcc = availableCoa.find((c: any) => c.kode_akun === "3-2001");
      setKasMutasiCoaId(priveAcc ? priveAcc.id : (availableCoa.length > 0 ? availableCoa[0].id : ""));
      setKasMutasiKeterangan("Pengambilan prive owner");
    } else {
      const modalAcc = availableCoa.find((c: any) => c.kode_akun === "3-1001");
      setKasMutasiCoaId(modalAcc ? modalAcc.id : (availableCoa.length > 0 ? availableCoa[0].id : ""));
      setKasMutasiKeterangan("Setoran modal owner");
    }
    setIsKasMutasiModalOpen(true);
  };

  const handleSubmitKasMutasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kasMutasiBankId) return toast.error("Pilih rekening Kas/Bank");
    if (!kasMutasiNominal || kasMutasiNominal <= 0) return toast.error("Masukkan nominal valid");

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/siap-saji/finance/kas-mutasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kas_bank_id: Number(kasMutasiBankId),
          jenis: kasMutasiJenis,
          nominal: kasMutasiNominal,
          mutasi_date: kasMutasiDate,
          keterangan: kasMutasiKeterangan,
          target_account_id: kasMutasiCoaId ? Number(kasMutasiCoaId) : null,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Gagal mencatat mutasi kas");
      }

      toast.success(`Mutasi Kas ${kasMutasiJenis} berhasil dicatat!`);
      setIsKasMutasiModalOpen(false);
      fetchKasBankMaster();
      fetchTabData();
    } catch (err: any) {
      toast.error(err.message || "Gagal mencatat mutasi kas");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditJournal = (j: any) => {
    setEditingJournalId(j.id);
    setJouFormDate(j.journal_date ? j.journal_date.split("T")[0] : new Date().toISOString().split("T")[0]);
    setJouFormRefNo(j.ref_no || "");
    setJouFormDebitCoaId(j.akun_debit ? Number(j.akun_debit) : "");
    setJouFormCreditCoaId(j.akun_kredit ? Number(j.akun_kredit) : "");
    setJouFormNominal(Number(j.nominal || 0));
    setJouFormKeterangan(j.keterangan || "");
    setIsJournalModalOpen(true);
  };

  const handleSubmitManualJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jouFormDebitCoaId || !jouFormCreditCoaId) return toast.error("Pilih akun Debet dan Kredit");
    if (jouFormDebitCoaId === jouFormCreditCoaId) return toast.error("Akun Debet dan Kredit tidak boleh sama");
    if (!jouFormNominal || jouFormNominal <= 0) return toast.error("Masukkan nominal valid");

    setIsSubmitting(true);
    try {
      const method = editingJournalId ? "PUT" : "POST";
      const payload: any = {
        journal_date: jouFormDate,
        ref_no: jouFormRefNo,
        akun_debit: Number(jouFormDebitCoaId),
        akun_kredit: Number(jouFormCreditCoaId),
        nominal: jouFormNominal,
        keterangan: jouFormKeterangan,
      };
      if (editingJournalId) {
        payload.id = editingJournalId;
      }

      const res = await fetch("/api/siap-saji/finance/journals", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Gagal menyimpan jurnal umum");
      }

      toast.success(editingJournalId ? "Jurnal umum berhasil diperbarui!" : "Jurnal umum manual berhasil disimpan!");
      setIsJournalModalOpen(false);
      setEditingJournalId(null);
      fetchKasBankMaster();
      fetchTabData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan jurnal umum");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCancelJournal = (j: any) => {
    setCancelJournalTarget(j);
    setCancelJournalReason("");
  };

  const handleConfirmCancelJournal = async () => {
    if (!cancelJournalTarget) return;
    if (!cancelJournalReason || cancelJournalReason.trim().length < 5) {
      return toast.error("Alasan pembatalan wajib diisi (minimal 5 karakter).");
    }

    setIsSubmittingCancelJournal(true);
    try {
      const res = await fetch("/api/siap-saji/finance/journals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cancelJournalTarget.id,
          action: "cancel",
          cancel_reason: cancelJournalReason.trim(),
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Gagal membatalkan jurnal umum");
      }

      toast.success(`Jurnal ${cancelJournalTarget.ref_no || cancelJournalTarget.id} berhasil dibatalkan!`);
      setCancelJournalTarget(null);
      setCancelJournalReason("");
      fetchKasBankMaster();
      fetchTabData();
    } catch (err: any) {
      toast.error(err.message || "Gagal membatalkan jurnal umum");
    } finally {
      setIsSubmittingCancelJournal(false);
    }
  };

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
              onClick={() => {
                const master = coaListAll.length > 0 ? coaListAll : coaList;
                if (!purchaseCoaId && master.length > 0) {
                  const def = master.find((c) => c.sub_kelompok === "Beban Pokok Penjualan" || c.kode_akun === "5-1001" || c.kode_akun === "5-50000");
                  if (def) setPurchaseCoaId(def.id);
                  else setPurchaseCoaId(master[0].id);
                }
                if (!purchaseKasBankId && accounts.length > 0) {
                  setPurchaseKasBankId(accounts[0].id);
                }
                setIsPurchaseModalOpen(true);
              }}
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
              onClick={() => {
                const master = coaListAll.length > 0 ? coaListAll : coaList;
                if (!expenseCoaId && master.length > 0) {
                  const def = master.find((c) => c.sub_kelompok === "Beban Operasional" || c.kode_akun?.startsWith("6-") || c.kelompok === "Beban");
                  if (def) setExpenseCoaId(def.id);
                  else setExpenseCoaId(master[0].id);
                }
                if (!expenseKasBankId && accounts.length > 0) {
                  setExpenseKasBankId(accounts[0].id);
                }
                setIsExpenseModalOpen(true);
              }}
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
        {/* 1. Laporan P&L */}
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

        {/* 2. Neraca Keuangan */}
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
          <PieChart size={15} /> Neraca
        </button>

        {/* 3. Pembelian HPP */}
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

        {/* 4. Biaya Operasional */}
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

        {/* 5. Kas & Bank */}
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
          <CreditCard size={15} /> Kas & Bank
        </button>

        {/* 6. Jurnal Umum */}
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
          <BookOpen size={15} /> Jurnal Umum
        </button>

        {/* 7. Buku Besar */}
        <button
          onClick={() => {
            setActiveTab("ledger");
            const targetId = ledgerCoaId || (coaListAll.length > 0 ? coaListAll[0].id : coaList.length > 0 ? coaList[0].id : "");
            if (targetId && !ledgerCoaId) {
              setLedgerCoaId(targetId);
            }
            if (targetId) {
              fetchLedgerData(targetId, 1, ledgerLimit, ledgerDateFrom, ledgerDateTo);
            }
          }}
          style={{
            padding: "10px 14px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "ledger" ? "3px solid #5005A6" : "3px solid transparent",
            color: activeTab === "ledger" ? "#5005A6" : "#6b7280",
            fontSize: 13,
            fontWeight: activeTab === "ledger" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: -2,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <BookOpen size={15} /> Buku Besar
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

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {/* Toggle Mode: Bulanan vs Harian */}
              <div style={{ background: "#f3f4f6", padding: 3, borderRadius: 8, display: "flex", gap: 3 }}>
                <button
                  type="button"
                  onClick={() => setPlPeriodMode("date")}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: "none",
                    background: plPeriodMode === "date" ? "#5005A6" : "transparent",
                    color: plPeriodMode === "date" ? "white" : "#4b5563",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Calendar size={13} /> Harian / Tanggal
                </button>
                <button
                  type="button"
                  onClick={() => setPlPeriodMode("month")}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: "none",
                    background: plPeriodMode === "month" ? "#5005A6" : "transparent",
                    color: plPeriodMode === "month" ? "white" : "#4b5563",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Bulanan
                </button>
              </div>

              {plPeriodMode === "month" ? (
                <>
                  <select
                    value={plMonth}
                    onChange={(e) => setPlMonth(e.target.value)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "#f9fafb",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#374151",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="all">Semua Bulan (Setahun)</option>
                    <option value="1">Januari</option>
                    <option value="2">Februari</option>
                    <option value="3">Maret</option>
                    <option value="4">April</option>
                    <option value="5">Mei</option>
                    <option value="6">Juni</option>
                    <option value="7">Juli</option>
                    <option value="8">Agustus</option>
                    <option value="9">September</option>
                    <option value="10">Oktober</option>
                    <option value="11">November</option>
                    <option value="12">Desember</option>
                  </select>

                  <select
                    value={plYear}
                    onChange={(e) => setPlYear(e.target.value)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "#f9fafb",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#374151",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f9fafb", padding: "4px 8px", borderRadius: 8, border: "1px solid #d1d5db" }}>
                  <input
                    type="date"
                    value={plDateFrom}
                    onChange={(e) => setPlDateFrom(e.target.value)}
                    style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12, outline: "none" }}
                  />
                  <span style={{ fontSize: 12, color: "#6b7280" }}>s/d</span>
                  <input
                    type="date"
                    value={plDateTo}
                    onChange={(e) => setPlDateTo(e.target.value)}
                    style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12, outline: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().split("T")[0];
                      setPlDateFrom(today);
                      setPlDateTo(today);
                    }}
                    style={{
                      padding: "4px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                      background: "#eef2ff",
                      color: "#4338ca",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                    }}
                    title="Set ke Hari Ini"
                  >
                    Hari Ini
                  </button>
                </div>
              )}

              {/* Action Buttons: Export Excel & PDF */}
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                <button
                  type="button"
                  onClick={handleExportPlXLSX}
                  style={{
                    padding: "7px 12px",
                    background: "#f0fdf4",
                    color: "#15803d",
                    border: "1px solid #bbf7d0",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  title="Export Laporan Laba/Rugi ke format Excel (.xlsx)"
                >
                  <FileSpreadsheet size={15} /> Export Excel
                </button>

                <button
                  type="button"
                  onClick={handlePrintPlPDF}
                  style={{
                    padding: "7px 14px",
                    background: "#5005A6",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 6px rgba(80, 5, 166, 0.2)",
                  }}
                  title="Cetak atau simpan Laporan Laba/Rugi sebagai PDF"
                >
                  <Printer size={15} /> Cetak / Unduh PDF
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* PENDAPATAN */}
            <div style={{ background: "#fafafa", borderRadius: 10, padding: 16, border: "1px solid #f3f4f6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      PENDAPATAN
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#15803d", background: "#dcfce7", padding: "1px 7px", borderRadius: 12, border: "1px solid #bbf7d0" }}>
                      100.0% Omset
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                    Pendapatan Penjualan, Pendapatan Ongkir, & Diskon Penjualan
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, color: totalPendapatan >= 0 ? "#15803d" : "#dc2626", fontSize: 16 }}>
                    {totalPendapatan < 0 ? `-Rp ${Math.abs(totalPendapatan).toLocaleString("id-ID")}` : `Rp ${totalPendapatan.toLocaleString("id-ID")}`}
                  </div>
                  <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>100.0%</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
                {(plData?.details?.filter((d: any) => d.kelompok === "Pendapatan" && Number(d.total_nominal || 0) !== 0) || []).map((acc: any, i: number) => {
                  const nominal = Number(acc.total_nominal || 0);
                  const isNegative = nominal < 0;
                  const accPct = totalPendapatan > 0 ? ((nominal / totalPendapatan) * 100).toFixed(1) : "0.0";
                  return (
                    <div
                      key={i}
                      onClick={() => handleOpenDrillModal(acc)}
                      title={`Klik untuk melihat rincian transaksi akun ${acc.nama_akun}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 13,
                        color: isNegative ? "#dc2626" : "#374151",
                        cursor: "pointer",
                        padding: "3px 6px",
                        borderRadius: 6,
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>({acc.kode_akun}) {acc.nama_akun}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 600, fontFamily: "monospace", color: isNegative ? "#dc2626" : undefined }}>
                          {isNegative ? `-Rp ${Math.abs(nominal).toLocaleString("id-ID")}` : `Rp ${nominal.toLocaleString("id-ID")}`}
                        </span>
                        <span style={{ fontSize: 11, color: isNegative ? "#dc2626" : "#6b7280", minWidth: 42, textAlign: "right" }}>{accPct}%</span>
                      </div>
                    </div>
                  );
                })}
                {(!plData?.details || plData.details.filter((d: any) => d.kelompok === "Pendapatan" && Number(d.total_nominal || 0) !== 0).length === 0) && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#6b7280" }}>
                    <span>Penjualan Bersih (Siap Saji)</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 600, fontFamily: "monospace" }}>Rp {totalPendapatan.toLocaleString("id-ID")}</span>
                      <span style={{ fontSize: 11, color: "#6b7280", minWidth: 42, textAlign: "right" }}>100.0%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* HARGA POKOK PENJUALAN (HPP & OVERHEAD) RINGKASAN ATAS BAWAH */}
            <div style={{ background: "#fafafa", borderRadius: 10, padding: 16, border: "1px solid #f3f4f6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      HARGA POKOK PENJUALAN (HPP & OVERHEAD)
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#b45309", background: "#fef3c7", padding: "1px 7px", borderRadius: 12, border: "1px solid #fde68a" }}>
                      {pctTotalHpp}% Omset
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2 }}>
                    Ringkasan Food Cost (Bahan Baku) dan Overhead Dapur (Gaji, Gas, Operasional)
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, color: "#b45309", fontSize: 17 }}>Rp {totalHpp.toLocaleString("id-ID")}</div>
                  <div style={{ fontSize: 11, color: "#b45309", fontWeight: 700 }}>{pctTotalHpp}% dari Omset</div>
                </div>
              </div>

              {/* Ringkasan Summary Atas - Bawah (Vertical Stack) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                {/* 1. Baris Food Cost (Atas) */}
                <div style={{ background: "white", padding: "10px 14px", borderRadius: 8, border: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>🥗</span>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#15803d" }}>Food Cost</span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#15803d", background: "#dcfce7", padding: "1px 6px", borderRadius: 4 }}>
                          {pctFoodCost}%
                        </span>
                      </div>
                      <span style={{ fontSize: 11.5, color: "#6b7280" }}>
                        Bahan Baku & Kemasan ({hppDetails.filter(isFoodCostAccount).length} Akun)
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, color: "#15803d", fontSize: 14.5, fontFamily: "monospace" }}>
                      Rp {totalFoodCost.toLocaleString("id-ID")}
                    </div>
                    <div style={{ fontSize: 11, color: "#15803d", fontWeight: 700 }}>
                      {pctFoodCost}% dari Omset
                    </div>
                  </div>
                </div>

                {/* 2. Baris Overhead Dapur (Bawah) */}
                <div style={{ background: "white", padding: "10px 14px", borderRadius: 8, border: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>⚡</span>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#b45309" }}>Overhead Dapur</span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#b45309", background: "#fef3c7", padding: "1px 6px", borderRadius: 4 }}>
                          {pctOverheadHpp}%
                        </span>
                      </div>
                      <span style={{ fontSize: 11.5, color: "#6b7280" }}>
                        Gaji, Gas, Listrik & Operasional ({hppDetails.filter((d: any) => !isFoodCostAccount(d)).length} Akun)
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, color: "#b45309", fontSize: 14.5, fontFamily: "monospace" }}>
                      Rp {totalOverheadHpp.toLocaleString("id-ID")}
                    </div>
                    <div style={{ fontSize: 11, color: "#b45309", fontWeight: 700 }}>
                      {pctOverheadHpp}% dari Omset
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Keseluruhan HPP */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 800, color: "#374151", paddingTop: 8, borderTop: "1px dashed #e5e7eb" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>TOTAL HPP & OVERHEAD</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#b45309", background: "#fef3c7", padding: "1px 6px", borderRadius: 4 }}>
                    {pctTotalHpp}%
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "monospace", color: "#b45309" }}>Rp {totalHpp.toLocaleString("id-ID")}</span>
                  <span style={{ fontSize: 11.5, color: "#b45309", fontWeight: 800 }}>({pctTotalHpp}%)</span>
                </div>
              </div>
            </div>

            {/* LABA KOTOR */}
            <div style={{ background: "#fef3c7", borderRadius: 10, padding: "14px 18px", border: "1px solid #fde68a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#92400e" }}>LABA KOTOR</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#92400e", background: "#fde68a", padding: "1px 7px", borderRadius: 12 }}>
                  {pctLabaKotor}% Omset
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#92400e" }}>Rp {labaKotor.toLocaleString("id-ID")}</div>
                <div style={{ fontSize: 11, color: "#92400e", fontWeight: 700 }}>{pctLabaKotor}% dari Omset</div>
              </div>
            </div>

            {/* BIAYA OPERASIONAL */}
            <div style={{ background: "#fafafa", borderRadius: 10, padding: 16, border: "1px solid #f3f4f6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    BIAYA OPERASIONAL (KANTOR & UMUM)
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                    Gaji Karyawan Kantor, ATK, Sewa Kantor, & Operasional Umum
                  </div>
                </div>
                <span style={{ fontWeight: 800, color: "#b91c1c", fontSize: 16 }}>Rp {totalBiayaOperasional.toLocaleString("id-ID")}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4, marginBottom: 8 }}>
                {(plData?.details?.filter((d: any) => d.kelompok === "Beban" && d.sub_kelompok === "Beban Operasional" && Number(d.total_nominal || 0) !== 0) || []).map((acc: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => handleOpenDrillModal(acc)}
                    title={`Klik untuk melihat rincian transaksi akun ${acc.nama_akun}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 13,
                      color: "#374151",
                      cursor: "pointer",
                      padding: "3px 6px",
                      borderRadius: 6,
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>({acc.kode_akun}) {acc.nama_akun}</span>
                    <span style={{ fontWeight: 600, fontFamily: "monospace" }}>Rp {Number(acc.total_nominal || 0).toLocaleString("id-ID")}</span>
                  </div>
                ))}
                {(!plData?.details || plData.details.filter((d: any) => d.kelompok === "Beban" && d.sub_kelompok === "Beban Operasional" && Number(d.total_nominal || 0) !== 0).length === 0) && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#6b7280" }}>
                    <span>Biaya Operasional</span>
                    <span style={{ fontWeight: 600, fontFamily: "monospace" }}>Rp {totalBiayaOperasional.toLocaleString("id-ID")}</span>
                  </div>
                )}
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

            {/* ── RINCIAN STANDAR AKUNTANSI (FORMAT ACCURATE ONLINE) ── */}
            <div style={{ marginTop: 24, borderTop: "2px solid #f3f4f6", paddingTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>
                    Rincian Standar Laba / Rugi (Akun COA)
                  </h3>
                  <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
                    Tampilan berjenjang akun nominal pendapatan & beban dengan pemisahan Food Cost dan Overhead
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePrintPlPDF}
                  style={{
                    padding: "5px 10px",
                    background: "#f9fafb",
                    color: "#4b5563",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Printer size={13} /> Pratinjau PDF
                </button>
              </div>

              <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "18px 20px", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1.5px solid #111827" }}>
                      <th style={{ textAlign: "left", padding: "6px 0", fontWeight: 700, color: "#1e3a8a", width: "62%" }}>
                        Deskripsi
                      </th>
                      <th style={{ textAlign: "right", padding: "6px 12px 6px 0", fontWeight: 700, color: "#1e3a8a", width: "24%" }}>
                        Nominal (Rp)
                      </th>
                      <th style={{ textAlign: "right", padding: "6px 0", fontWeight: 700, color: "#1e3a8a", width: "14%" }}>
                        % Omset
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* PENDAPATAN */}
                    <tr>
                      <td colSpan={3} style={{ padding: "12px 0 4px", fontWeight: 800, color: "#111827" }}>
                        PENDAPATAN
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3} style={{ padding: "2px 0 2px 14px", fontWeight: 700, color: "#4b5563" }}>
                        Pendapatan Operasional
                      </td>
                    </tr>
                    {(plData?.details?.filter((d: any) => d.kelompok === "Pendapatan") || []).map((acc: any, i: number) => {
                      const nom = Number(acc.total_nominal || 0);
                      const isNegative = nom < 0;
                      const pct = totalPendapatan > 0 ? ((nom / totalPendapatan) * 100).toFixed(1) : "0.0";
                      return (
                        <tr
                          key={i}
                          onClick={() => handleOpenDrillModal(acc)}
                          title={`Klik untuk melihat rincian transaksi (${acc.kode_akun}) ${acc.nama_akun}`}
                          style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "4px 0 4px 28px", color: isNegative ? "#dc2626" : "#1d4ed8", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>
                            ({acc.kode_akun}) {acc.nama_akun}
                          </td>
                          <td style={{ textAlign: "right", padding: "4px 12px 4px 0", fontFamily: "monospace", color: isNegative ? "#dc2626" : undefined }}>
                            {isNegative ? `-${Math.abs(nom).toLocaleString("id-ID")}` : nom.toLocaleString("id-ID")}
                          </td>
                          <td style={{ textAlign: "right", padding: "4px 0", color: isNegative ? "#dc2626" : "#15803d", fontWeight: 600, fontSize: 12 }}>
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td style={{ padding: "6px 0 6px 0", fontWeight: 800, color: "#111827" }}>
                        Jumlah Pendapatan
                      </td>
                      <td style={{ textAlign: "right", padding: "6px 12px 6px 0", fontWeight: 800, borderTop: "1px solid #111827", fontFamily: "monospace" }}>
                        {totalPendapatan.toLocaleString("id-ID")}
                      </td>
                      <td style={{ textAlign: "right", padding: "6px 0", fontWeight: 800, borderTop: "1px solid #111827", color: "#15803d", fontSize: 12 }}>
                        100.0%
                      </td>
                    </tr>

                    {/* HPP & OVERHEAD (DIBAGI DUA: FOOD COST & OVERHEAD) */}
                    <tr>
                      <td colSpan={3} style={{ padding: "14px 0 4px", fontWeight: 800, color: "#111827" }}>
                        HARGA POKOK PENJUALAN (HPP & OVERHEAD)
                      </td>
                    </tr>

                    {/* 1. Food Cost */}
                    <tr>
                      <td colSpan={3} style={{ padding: "4px 0 2px 14px", fontWeight: 700, color: "#15803d" }}>
                        Food Cost (Bahan Baku & Kemasan)
                      </td>
                    </tr>
                    {hppDetails.filter(isFoodCostAccount).map((acc: any, i: number) => {
                      const nom = Number(acc.total_nominal || 0);
                      const pct = totalPendapatan > 0 ? ((nom / totalPendapatan) * 100).toFixed(1) : "0.0";
                      return (
                        <tr
                          key={`fc-${i}`}
                          onClick={() => handleOpenDrillModal(acc)}
                          title={`Klik untuk melihat rincian transaksi (${acc.kode_akun}) ${acc.nama_akun}`}
                          style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "4px 0 4px 28px", color: "#15803d", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>
                            ({acc.kode_akun}) {acc.nama_akun}
                          </td>
                          <td style={{ textAlign: "right", padding: "4px 12px 4px 0", fontFamily: "monospace" }}>
                            {nom.toLocaleString("id-ID")}
                          </td>
                          <td style={{ textAlign: "right", padding: "4px 0", color: "#6b7280", fontSize: 12 }}>
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                    {hppDetails.filter(isFoodCostAccount).length === 0 && (
                      <tr>
                        <td style={{ padding: "2px 0 2px 28px", color: "#9ca3af", fontStyle: "italic" }}>
                          (Tidak ada transaksi Food Cost)
                        </td>
                        <td style={{ textAlign: "right", padding: "2px 12px 2px 0", fontFamily: "monospace" }}>0</td>
                        <td style={{ textAlign: "right", padding: "2px 0", color: "#9ca3af", fontSize: 12 }}>0.0%</td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: "4px 0 4px 14px", fontWeight: 700, color: "#15803d" }}>
                        Subtotal Food Cost
                      </td>
                      <td style={{ textAlign: "right", padding: "4px 12px 4px 0", fontWeight: 700, borderTop: "1px dashed #d1d5db", fontFamily: "monospace", color: "#15803d" }}>
                        {totalFoodCost.toLocaleString("id-ID")}
                      </td>
                      <td style={{ textAlign: "right", padding: "4px 0", fontWeight: 700, borderTop: "1px dashed #d1d5db", color: "#15803d", fontSize: 12 }}>
                        {pctFoodCost}%
                      </td>
                    </tr>

                    {/* 2. Overhead Dapur */}
                    <tr>
                      <td colSpan={3} style={{ padding: "8px 0 2px 14px", fontWeight: 700, color: "#b45309" }}>
                        Overhead Dapur (Gaji, Gas, Operasional Dapur)
                      </td>
                    </tr>
                    {hppDetails.filter((d: any) => !isFoodCostAccount(d)).map((acc: any, i: number) => {
                      const nom = Number(acc.total_nominal || 0);
                      const pct = totalPendapatan > 0 ? ((nom / totalPendapatan) * 100).toFixed(1) : "0.0";
                      return (
                        <tr
                          key={`ov-${i}`}
                          onClick={() => handleOpenDrillModal(acc)}
                          title={`Klik untuk melihat rincian transaksi (${acc.kode_akun}) ${acc.nama_akun}`}
                          style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "4px 0 4px 28px", color: "#b45309", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>
                            ({acc.kode_akun}) {acc.nama_akun}
                          </td>
                          <td style={{ textAlign: "right", padding: "4px 12px 4px 0", fontFamily: "monospace" }}>
                            {nom.toLocaleString("id-ID")}
                          </td>
                          <td style={{ textAlign: "right", padding: "4px 0", color: "#6b7280", fontSize: 12 }}>
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                    {hppDetails.filter((d: any) => !isFoodCostAccount(d)).length === 0 && (
                      <tr>
                        <td style={{ padding: "2px 0 2px 28px", color: "#9ca3af", fontStyle: "italic" }}>
                          (Tidak ada transaksi Overhead Dapur)
                        </td>
                        <td style={{ textAlign: "right", padding: "2px 12px 2px 0", fontFamily: "monospace" }}>0</td>
                        <td style={{ textAlign: "right", padding: "2px 0", color: "#9ca3af", fontSize: 12 }}>0.0%</td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: "4px 0 4px 14px", fontWeight: 700, color: "#b45309" }}>
                        Subtotal Overhead Dapur
                      </td>
                      <td style={{ textAlign: "right", padding: "4px 12px 4px 0", fontWeight: 700, borderTop: "1px dashed #d1d5db", fontFamily: "monospace", color: "#b45309" }}>
                        {totalOverheadHpp.toLocaleString("id-ID")}
                      </td>
                      <td style={{ textAlign: "right", padding: "4px 0", fontWeight: 700, borderTop: "1px dashed #d1d5db", color: "#b45309", fontSize: 12 }}>
                        {pctOverheadHpp}%
                      </td>
                    </tr>

                    {/* Total Keseluruhan HPP */}
                    <tr>
                      <td style={{ padding: "8px 0 6px 0", fontWeight: 800, color: "#111827" }}>
                        Jumlah Beban Pokok Penjualan (HPP & Overhead)
                      </td>
                      <td style={{ textAlign: "right", padding: "8px 12px 6px 0", fontWeight: 800, borderTop: "1.5px solid #111827", fontFamily: "monospace" }}>
                        {totalHpp.toLocaleString("id-ID")}
                      </td>
                      <td style={{ textAlign: "right", padding: "8px 0 6px 0", fontWeight: 800, borderTop: "1.5px solid #111827", color: "#b45309", fontSize: 12 }}>
                        {pctTotalHpp}%
                      </td>
                    </tr>

                    {/* LABA KOTOR */}
                    <tr style={{ borderTop: "1.5px solid #111827", borderBottom: "1px solid #d1d5db" }}>
                      <td style={{ padding: "8px 0", fontWeight: 900, color: "#111827" }}>
                        LABA KOTOR
                      </td>
                      <td style={{ textAlign: "right", padding: "8px 12px", fontWeight: 900, color: "#111827", fontFamily: "monospace" }}>
                        {labaKotor.toLocaleString("id-ID")}
                      </td>
                      <td style={{ textAlign: "right", padding: "8px 0", fontWeight: 900, color: "#92400e", fontSize: 12 }}>
                        {pctLabaKotor}%
                      </td>
                    </tr>

                    {/* BEBAN OPERASIONAL */}
                    <tr>
                      <td colSpan={3} style={{ padding: "14px 0 4px", fontWeight: 800, color: "#111827" }}>
                        BEBAN OPERASIONAL
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3} style={{ padding: "2px 0 2px 14px", fontWeight: 700, color: "#4b5563" }}>
                        Beban Operasional
                      </td>
                    </tr>
                    {(plData?.details?.filter((d: any) => d.kelompok === "Beban" && d.sub_kelompok === "Beban Operasional") || []).map((acc: any, i: number) => {
                      const nom = Number(acc.total_nominal || 0);
                      const pct = totalPendapatan > 0 ? ((nom / totalPendapatan) * 100).toFixed(1) : "0.0";
                      return (
                        <tr
                          key={i}
                          onClick={() => handleOpenDrillModal(acc)}
                          title={`Klik untuk melihat rincian transaksi (${acc.kode_akun}) ${acc.nama_akun}`}
                          style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "4px 0 4px 28px", color: "#374151", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>
                            ({acc.kode_akun}) {acc.nama_akun}
                          </td>
                          <td style={{ textAlign: "right", padding: "4px 12px 4px 0", fontFamily: "monospace" }}>
                            {nom.toLocaleString("id-ID")}
                          </td>
                          <td style={{ textAlign: "right", padding: "4px 0", color: "#6b7280", fontSize: 12 }}>
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td style={{ padding: "6px 0 6px 0", fontWeight: 800, color: "#111827" }}>
                        Jumlah Beban Operasional
                      </td>
                      <td style={{ textAlign: "right", padding: "6px 12px 6px 0", fontWeight: 800, borderTop: "1px solid #111827", fontFamily: "monospace" }}>
                        {totalBiayaOperasional.toLocaleString("id-ID")}
                      </td>
                      <td style={{ textAlign: "right", padding: "6px 0", fontWeight: 800, borderTop: "1px solid #111827", color: "#b91c1c", fontSize: 12 }}>
                        {pctBiayaOperasional}%
                      </td>
                    </tr>

                    {/* LABA OPERASIONAL */}
                    <tr style={{ borderTop: "1px solid #111827" }}>
                      <td style={{ padding: "8px 0", fontWeight: 800, color: "#111827" }}>
                        LABA OPERASIONAL
                      </td>
                      <td style={{ textAlign: "right", padding: "8px 12px", fontWeight: 800, color: "#111827", fontFamily: "monospace" }}>
                        {(labaKotor - totalBiayaOperasional).toLocaleString("id-ID")}
                      </td>
                      <td style={{ textAlign: "right", padding: "8px 0", fontWeight: 800, color: "#111827", fontSize: 12 }}>
                        {totalPendapatan > 0 ? (((labaKotor - totalBiayaOperasional) / totalPendapatan) * 100).toFixed(1) : "0.0"}%
                      </td>
                    </tr>

                    {/* LABA BERSIH */}
                    <tr>
                      <td style={{ padding: "12px 0 6px", fontWeight: 900, color: "#111827", borderTop: "2px solid #111827", borderBottom: "3px double #111827" }}>
                        LABA BERSIH
                      </td>
                      <td style={{ textAlign: "right", padding: "12px 12px 6px 0", fontWeight: 900, color: labaBersih >= 0 ? "#15803d" : "#b91c1c", borderTop: "2px solid #111827", borderBottom: "3px double #111827", fontFamily: "monospace" }}>
                        Rp {labaBersih.toLocaleString("id-ID")}
                      </td>
                      <td style={{ textAlign: "right", padding: "12px 0 6px", fontWeight: 900, color: labaBersih >= 0 ? "#15803d" : "#b91c1c", borderTop: "2px solid #111827", borderBottom: "3px double #111827", fontSize: 13 }}>
                        {pctLabaBersih}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PEMBELIAN HPP (NOTA BELANJA) ────────────────────── */}
      {activeTab === "purchases" && (
        <div>
            {/* Filter Toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 300px", overflowX: "auto", whiteSpace: "nowrap" }}>
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
                {(purSearch || purDateFrom !== getYtdStartStr() || purDateTo !== getTodayStr()) && (
                  <button
                    onClick={() => { setPurSearch(""); setPurDateFrom(getYtdStartStr()); setPurDateTo(getTodayStr()); setPurPage(1); }}
                    style={{ padding: "7px 12px", background: "#f3f4f6", color: "#4b5563", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600, flexShrink: 0 }}
                    title="Reset Filter ke YTD"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Bulk Pay Action Button */}
              {selectedPurIds.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "6px 14px", borderRadius: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>
                    {selectedPurIds.length} Nota Dipilih (Total Hutang: Rp {
                      purchases
                        .filter((p) => selectedPurIds.includes(p.id))
                        .reduce((acc, p) => acc + Number(p.sisa_hutang || 0), 0)
                        .toLocaleString("id-ID")
                    })
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenBulkPayModal}
                    style={{
                      padding: "6px 14px",
                      background: "#639922",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      boxShadow: "0 2px 4px rgba(99, 153, 34, 0.3)",
                    }}
                  >
                    <DollarSign size={14} /> Bulk Bayar Hutang
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPurIds([])}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#6b7280",
                      fontSize: 12,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Batal Pilih
                  </button>
                </div>
              )}
            </div>

          <div className="datagrid-sticky-container" style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", maxHeight: "65vh" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14, whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 14px", width: 40, textAlign: "center" }}>
                    {(() => {
                      const curPageItems = purchases.slice((purPage - 1) * purLimit, purPage * purLimit);
                      const payableItems = curPageItems.filter((p) => Number(p.sisa_hutang || 0) > 0 && p.status !== "Dibatalkan" && p.status_pembayaran !== "Dibatalkan");
                      const allSelected = payableItems.length > 0 && payableItems.every((p) => selectedPurIds.includes(p.id));
                      return (
                        <input
                          type="checkbox"
                          checked={allSelected}
                          disabled={payableItems.length === 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const newIds = Array.from(new Set([...selectedPurIds, ...payableItems.map((p) => p.id)]));
                              setSelectedPurIds(newIds);
                            } else {
                              const removeIds = new Set(payableItems.map((p) => p.id));
                              setSelectedPurIds(selectedPurIds.filter((id) => !removeIds.has(id)));
                            }
                          }}
                          style={{ cursor: payableItems.length === 0 ? "not-allowed" : "pointer", width: 16, height: 16, accentColor: "#639922" }}
                          title={payableItems.length > 0 ? "Pilih semua nota hutang di halaman ini" : "Tidak ada nota hutang di halaman ini"}
                        />
                      );
                    })()}
                  </th>
                  <th style={{ padding: "12px 14px", width: 45 }}>No.</th>
                  <th style={{ padding: "12px 16px" }}>Tanggal</th>
                  <th style={{ padding: "12px 16px" }}>Ref Nota</th>
                  <th style={{ padding: "12px 16px" }}>Keterangan Belanja</th>
                  <th style={{ padding: "12px 16px" }}>Kategori HPP</th>
                  <th style={{ padding: "12px 16px" }}>Rekening / Sumber</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Status Bayar</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Total Nota</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Dibayar</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Sisa Hutang</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", width: 140 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                      Memuat data nota HPP...
                    </td>
                  </tr>
                ) : purchases.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                      Belum ada riwayat pembelian HPP.
                    </td>
                  </tr>
                ) : (
                  purchases.slice((purPage - 1) * purLimit, purPage * purLimit).map((p, idx) => {
                    const isCancelled = p.status === "Dibatalkan" || p.status_pembayaran === "Dibatalkan";
                    const sisa = Number(p.sisa_hutang || 0);
                    const dibayar = Number(p.dibayar || 0);
                    const total = Number(p.total_amount || 0);
                    const statusBayar = isCancelled ? "Dibatalkan" : (p.status_pembayaran || (sisa > 0 ? (dibayar > 0 ? "Sebagian" : "Belum Lunas") : "Lunas"));

                    const isPayable = !isCancelled && sisa > 0;
                    const isSelected = selectedPurIds.includes(p.id);

                    return (
                      <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6", opacity: isCancelled ? 0.6 : 1, background: isSelected ? "#f0fdf4" : "transparent" }}>
                        <td style={{ padding: "14px 14px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!isPayable}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPurIds([...selectedPurIds, p.id]);
                              } else {
                                setSelectedPurIds(selectedPurIds.filter((id) => id !== p.id));
                              }
                            }}
                            style={{ cursor: !isPayable ? "not-allowed" : "pointer", width: 16, height: 16, accentColor: "#639922" }}
                            title={isPayable ? "Pilih untuk bayar hutang" : (isCancelled ? "Nota dibatalkan" : "Sudah Lunas")}
                          />
                        </td>
                        <td style={{ padding: "14px 14px", color: "#6b7280" }}>{(purPage - 1) * purLimit + idx + 1}</td>
                        <td style={{ padding: "14px 16px", fontWeight: 600 }}>{formatDate(p.purchase_date)}</td>
                        <td style={{ padding: "14px 16px", fontFamily: "monospace", color: "#5005A6", fontWeight: 700 }}>
                          {p.nota_ref || `NOTA-${p.id}`}
                        </td>
                        <td style={{ padding: "14px 16px", color: "#111827", fontWeight: 600, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                          <div>{p.keterangan}</div>
                          {isCancelled && p.cancel_reason && (
                            <div style={{ fontSize: 11, color: "#dc2626", fontStyle: "italic", marginTop: 2 }}>
                              Alasan Batal: &ldquo;{p.cancel_reason}&rdquo;
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px", color: "#4b5563" }}>
                          {p.coa_kode} - {p.coa_nama}
                        </td>
                        <td style={{ padding: "14px 16px", color: "#374151" }}>{p.kas_bank_nama || "Hutang Usaha"}</td>
                        <td style={{ padding: "14px 16px", textAlign: "center" }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: isCancelled
                                ? "#fee2e2"
                                : statusBayar === "Lunas"
                                ? "#f0fdf4"
                                : statusBayar === "Sebagian"
                                ? "#fef3c7"
                                : "#fee2e2",
                              color: isCancelled
                                ? "#991b1b"
                                : statusBayar === "Lunas"
                                ? "#15803d"
                                : statusBayar === "Sebagian"
                                ? "#b45309"
                                : "#b91c1c",
                              border: isCancelled
                                ? "1px solid #fecaca"
                                : statusBayar === "Lunas"
                                ? "1px solid #bbf7d0"
                                : statusBayar === "Sebagian"
                                ? "1px solid #fde68a"
                                : "1px solid #fecaca",
                            }}
                          >
                            {statusBayar}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 800, color: isCancelled ? "#9ca3af" : "#111827", textDecoration: isCancelled ? "line-through" : "none" }}>
                          Rp {total.toLocaleString("id-ID")}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, color: isCancelled ? "#9ca3af" : "#15803d" }}>
                          Rp {dibayar.toLocaleString("id-ID")}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 800, color: isCancelled ? "#9ca3af" : (sisa > 0 ? "#E24B4A" : "#6b7280") }}>
                          Rp {sisa.toLocaleString("id-ID")}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "center" }}>
                          <div style={{ display: "flex", justifyContent: "center", gap: 5 }}>
                            {/* Detail */}
                            <button
                              onClick={() => setDetailModalItem({ type: "purchase", data: p })}
                              style={{
                                padding: "6px 8px",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                background: "#f9fafb",
                                color: "#374151",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                              title="Lihat Detail Nota"
                            >
                              <FileText size={14} />
                            </button>

                            {/* Bayar Hutang / Cicilan (if not cancelled & sisa > 0) */}
                            {!isCancelled && sisa > 0 && (
                              <button
                                onClick={() => handleOpenPayDebtModal("purchase", p)}
                                style={{
                                  padding: "6px 9px",
                                  borderRadius: 6,
                                  border: "none",
                                  background: "#639922",
                                  color: "white",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                                title="Bayar Cicilan / Pelunasan Hutang"
                              >
                                <DollarSign size={13} /> Bayar
                              </button>
                            )}

                            {/* Edit (if not cancelled) */}
                            {!isCancelled && (
                              <button
                                onClick={() => handleOpenEditPurchase(p)}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #d1d5db",
                                  background: "#f9fafb",
                                  color: "#4b5563",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                                title="Edit Nota HPP"
                              >
                                <Edit3 size={14} />
                              </button>
                            )}

                            {/* Batal dengan Alasan */}
                            {!isCancelled && (
                              <button
                                onClick={() => handleOpenCancelModal("purchase", p)}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #fecaca",
                                  background: "#fef2f2",
                                  color: "#dc2626",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                                title="Batalkan Nota HPP"
                              >
                                <Trash2 size={14} />
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
          </div>

          <Pagination
            page={purPage}
            totalPages={Math.ceil(purchases.length / purLimit) || 1}
            total={purchases.length}
            limit={purLimit}
            onChange={(p) => setPurPage(p)}
            onLimitChange={(lim) => { setPurLimit(lim); setPurPage(1); }}
          />
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
            {(expSearch || expDateFrom !== getYtdStartStr() || expDateTo !== getTodayStr()) && (
              <button
                onClick={() => { setExpSearch(""); setExpDateFrom(getYtdStartStr()); setExpDateTo(getTodayStr()); setExpPage(1); }}
                style={{ padding: "7px 12px", background: "#f3f4f6", color: "#4b5563", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600, flexShrink: 0 }}
                title="Reset Filter ke YTD"
              >
                Reset
              </button>
            )}
          </div>

          <div className="datagrid-sticky-container" style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", maxHeight: "65vh" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14, whiteSpace: "nowrap" }}>
            <thead>
              <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>
                <th style={{ padding: "12px 16px", width: 50 }}>No.</th>
                <th style={{ padding: "12px 16px" }}>Tanggal</th>
                <th style={{ padding: "12px 16px" }}>Keterangan Biaya</th>
                <th style={{ padding: "12px 16px" }}>Kategori Beban</th>
                <th style={{ padding: "12px 16px" }}>Sumber / Rekening</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Status Bayar</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Total Biaya</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Dibayar</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Sisa Hutang</th>
                <th style={{ padding: "12px 16px", textAlign: "center", width: 140 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                    Memuat biaya operasional...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                    Belum ada riwayat biaya operasional.
                  </td>
                </tr>
              ) : (
                expenses.slice((expPage - 1) * expLimit, expPage * expLimit).map((e, idx) => {
                  const isCancelled = e.status === "dibatalkan" || e.status_pembayaran === "Dibatalkan";
                  const sisa = Number(e.sisa_hutang || 0);
                  const dibayar = Number(e.dibayar || 0);
                  const total = (dibayar + sisa) > 0 ? (dibayar + sisa) : Number(e.nominal || 0);
                  const statusBayar = isCancelled ? "Dibatalkan" : (e.status_pembayaran || (sisa > 0 ? (dibayar > 0 ? "Sebagian" : "Belum Lunas") : "Lunas"));
                  const cleanKeterangan = (e.keterangan || "").replace(/^Biaya Operasional \([^)]+\):\s*/i, "");

                  return (
                    <tr key={e.id} style={{ borderBottom: "1px solid #f3f4f6", opacity: isCancelled ? 0.6 : 1 }}>
                      <td style={{ padding: "14px 16px", color: "#6b7280" }}>{(expPage - 1) * expLimit + idx + 1}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 600 }}>{formatDate(e.journal_date)}</td>
                      <td style={{ padding: "14px 16px", color: "#111827", fontWeight: 600, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                        <div>{cleanKeterangan || e.keterangan}</div>
                        {isCancelled && e.cancel_reason && (
                          <div style={{ fontSize: 11, color: "#dc2626", fontStyle: "italic", marginTop: 2 }}>
                            Alasan Batal: &ldquo;{e.cancel_reason}&rdquo;
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#4b5563" }}>
                        ({e.beban_kode}) {e.beban_nama}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#374151" }}>{e.kredit_nama || "Hutang Usaha"}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: isCancelled
                              ? "#fee2e2"
                              : statusBayar === "Lunas"
                              ? "#f0fdf4"
                              : statusBayar === "Sebagian"
                              ? "#fef3c7"
                              : "#fee2e2",
                            color: isCancelled
                              ? "#991b1b"
                              : statusBayar === "Lunas"
                              ? "#15803d"
                              : statusBayar === "Sebagian"
                              ? "#b45309"
                              : "#b91c1c",
                            border: isCancelled
                              ? "1px solid #fecaca"
                              : statusBayar === "Lunas"
                              ? "1px solid #bbf7d0"
                              : statusBayar === "Sebagian"
                              ? "1px solid #fde68a"
                              : "1px solid #fecaca",
                          }}
                        >
                          {statusBayar}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 800, color: isCancelled ? "#9ca3af" : "#111827", textDecoration: isCancelled ? "line-through" : "none" }}>
                        Rp {total.toLocaleString("id-ID")}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, color: isCancelled ? "#9ca3af" : "#15803d" }}>
                        Rp {dibayar.toLocaleString("id-ID")}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 800, color: isCancelled ? "#9ca3af" : (sisa > 0 ? "#E24B4A" : "#6b7280") }}>
                        Rp {sisa.toLocaleString("id-ID")}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center", gap: 5 }}>
                          {/* Detail */}
                          <button
                            onClick={() => setDetailModalItem({ type: "expense", data: e })}
                            style={{
                              padding: "6px 8px",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              background: "#f9fafb",
                              color: "#374151",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                            title="Lihat Detail Biaya"
                          >
                            <FileText size={14} />
                          </button>

                          {/* Bayar Hutang / Cicilan (if not cancelled & sisa > 0) */}
                          {!isCancelled && sisa > 0 && (
                            <button
                              onClick={() => handleOpenPayDebtModal("expense", e)}
                              style={{
                                padding: "6px 9px",
                                borderRadius: 6,
                                border: "none",
                                background: "#639922",
                                color: "white",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                              title="Bayar Cicilan / Pelunasan Hutang"
                            >
                              <DollarSign size={13} /> Bayar
                            </button>
                          )}

                          {/* Edit (if not cancelled) */}
                          {!isCancelled && (
                            <button
                              onClick={() => handleOpenEditExpense(e)}
                              style={{
                                padding: "6px 8px",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                background: "#f9fafb",
                                color: "#4b5563",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                              title="Edit Biaya Operasional"
                            >
                              <Edit3 size={14} />
                            </button>
                          )}

                          {/* Batal dengan Alasan */}
                          {!isCancelled && (
                            <button
                              onClick={() => handleOpenCancelModal("expense", e)}
                              style={{
                                padding: "6px 8px",
                                borderRadius: 6,
                                border: "1px solid #fecaca",
                                background: "#fef2f2",
                                color: "#dc2626",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                              title="Batalkan Biaya Operasional"
                            >
                              <Trash2 size={14} />
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
          {/* Account Cards Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>
              Daftar Rekening Kas & Bank
            </h3>
            <button
              onClick={handleOpenAddAccount}
              style={{
                padding: "8px 14px",
                background: "#5005A6",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 6px rgba(80, 5, 166, 0.2)",
              }}
            >
              <Plus size={15} /> Tambah Rekening Baru
            </button>
          </div>

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
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#374151", display: "block" }}>{acc.nama_rekening}</span>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>
                      {acc.jenis === "Kas" ? "Uang Kas Tunai" : (acc.nama_bank || "Bank")} • {acc.no_rekening || "-"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {acc.is_payment_default && (
                      <span style={{ fontSize: 10, fontWeight: 800, background: "#f0fdf4", color: "#639922", padding: "2px 6px", borderRadius: 4 }}>
                        Default Order
                      </span>
                    )}
                    <button
                      onClick={() => handleOpenEditAccount(acc)}
                      style={{
                        padding: "4px 8px",
                        background: "#f3f4f6",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        color: "#4b5563",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      title="Edit Rekening & Akun CoA"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <p style={{ fontSize: 22, fontWeight: 800, color: "#5005A6", marginTop: 12, marginBottom: 6 }}>
                  Rp {Number(acc.saldo_kini).toLocaleString("id-ID")}
                </p>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, borderTop: "1px dashed #e5e7eb", paddingTop: 8 }}>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>Akun CoA Buku Besar:</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: acc.coa_kode ? "#2563eb" : "#ef4444", background: acc.coa_kode ? "#eff6ff" : "#fef2f2", padding: "2px 6px", borderRadius: 4 }}>
                    {acc.coa_kode ? `(${acc.coa_kode}) ${acc.coa_nama}` : "⚠️ Belum Terhubung CoA"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Mutasi Table */}
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>
                Riwayat Mutasi Kas & Bank Terbaru
              </h3>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => handleOpenKasMutasiModal("Masuk")}
                  style={{
                    padding: "8px 14px",
                    background: "#639922",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 6px rgba(99, 153, 34, 0.2)",
                  }}
                >
                  <Plus size={15} /> Kas Masuk
                </button>

                <button
                  onClick={() => handleOpenKasMutasiModal("Keluar")}
                  style={{
                    padding: "8px 14px",
                    background: "#E24B4A",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 6px rgba(226, 75, 74, 0.2)",
                  }}
                >
                  <Plus size={15} /> Kas Keluar (Prive)
                </button>
              </div>
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

              {(mutSearch || mutJenisFilter || mutDateFrom !== getYtdStartStr() || mutDateTo !== getTodayStr()) && (
                <button
                  onClick={() => { setMutSearch(""); setMutJenisFilter(""); setMutDateFrom(getYtdStartStr()); setMutDateTo(getTodayStr()); setMutPage(1); }}
                  style={{ padding: "7px 12px", background: "#e5e7eb", color: "#4b5563", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600, flexShrink: 0 }}
                  title="Reset Filter ke YTD"
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

            {(jouSearch || jouTypeFilter || jouDateFrom !== getYtdStartStr() || jouDateTo !== getTodayStr()) && (
              <button
                onClick={() => { setJouSearch(""); setJouTypeFilter(""); setJouDateFrom(getYtdStartStr()); setJouDateTo(getTodayStr()); setJouPage(1); }}
                style={{ padding: "7px 12px", background: "#f3f4f6", color: "#4b5563", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600, flexShrink: 0 }}
                title="Reset Filter ke YTD"
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
              <button
                onClick={() => {
                  const list = coaListAll.length > 0 ? coaListAll : coaList;
                  setJouFormDate(new Date().toISOString().split("T")[0]);
                  setJouFormRefNo(`JU-${Date.now().toString().slice(-6)}`);
                  setJouFormDebitCoaId(list.length > 0 ? list[0].id : "");
                  setJouFormCreditCoaId(list.length > 1 ? list[1].id : "");
                  setJouFormNominal(0);
                  setJouFormKeterangan("");
                  setIsJournalModalOpen(true);
                }}
                style={{
                  padding: "8px 16px",
                  background: "#5005A6",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 6px rgba(80, 5, 166, 0.2)",
                }}
              >
                <BookOpen size={15} /> + Jurnal Umum
              </button>
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
                <th style={{ padding: "12px 16px", textAlign: "center", width: 140 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                    Memuat entri buku jurnal...
                  </td>
                </tr>
              ) : journals.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                    Belum ada entri jurnal tercatat.
                  </td>
                </tr>
              ) : (
                journals.slice((jouPage - 1) * jouLimit, jouPage * jouLimit).map((j, idx) => {
                  const itemNo = (jouPage - 1) * jouLimit + idx + 1;
                  const isCancelled = j.status === "dibatalkan";
                  return (
                    <Fragment key={j.id}>
                      {/* BARIS 1: ENTRI DEBIT */}
                      <tr style={{ borderTop: idx > 0 ? "2px solid #e5e7eb" : "none", background: isCancelled ? "#fffbfa" : "#ffffff", opacity: isCancelled ? 0.78 : 1 }}>
                        <td rowSpan={2} style={{ padding: "12px 16px", verticalAlign: "top", color: "#6b7280", fontWeight: 600, borderRight: "1px solid #f3f4f6" }}>
                          {itemNo}
                        </td>
                        <td rowSpan={2} style={{ padding: "12px 16px", verticalAlign: "top", fontWeight: 600, color: "#374151", borderRight: "1px solid #f3f4f6" }}>
                          <div>{formatDate(j.journal_date)}</div>
                          {isCancelled && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "#fee2e2", color: "#b91c1c", display: "inline-block", marginTop: 4 }}>
                              DIBATALKAN
                            </span>
                          )}
                        </td>
                        <td rowSpan={2} style={{ padding: "12px 16px", verticalAlign: "top", borderRight: "1px solid #f3f4f6" }}>
                          <p style={{ fontFamily: "monospace", fontWeight: 700, color: isCancelled ? "#9ca3af" : "#5005A6", textDecoration: isCancelled ? "line-through" : "none", margin: 0 }}>
                            {j.ref_no || `JRNL-${j.id}`}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#f3f4f6", color: "#4b5563", textTransform: "uppercase" }}>
                              {j.ref_type || "umum"}
                            </span>
                          </div>
                        </td>
                        {/* Status & Nama Akun Debit */}
                        <td style={{ padding: "10px 16px 4px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 700, color: isCancelled ? "#6b7280" : "#15803d", fontSize: 13, textDecoration: isCancelled ? "line-through" : "none" }}>
                              [{j.debit_kode}] {j.debit_nama}
                            </span>
                            <span style={{ background: isCancelled ? "#f3f4f6" : "#dcfce7", color: isCancelled ? "#6b7280" : "#15803d", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4 }}>
                              DEBIT
                            </span>
                          </div>
                        </td>
                        {/* Nominal Debit */}
                        <td style={{ padding: "10px 16px 4px 16px", textAlign: "right", fontWeight: 800, color: isCancelled ? "#9ca3af" : "#15803d", textDecoration: isCancelled ? "line-through" : "none" }}>
                          Rp {Number(j.nominal).toLocaleString("id-ID")}
                        </td>
                        {/* Column Kredit (-) */}
                        <td style={{ padding: "10px 16px 4px 16px", textAlign: "right", color: "#9ca3af" }}>
                          -
                        </td>
                        {/* Aksi Edit & Batal */}
                        <td rowSpan={2} style={{ padding: "12px 16px", verticalAlign: "top", textAlign: "center", borderLeft: "1px solid #f3f4f6" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                            {!isCancelled ? (
                              <>
                                <button
                                  onClick={() => handleOpenEditJournal(j)}
                                  title="Edit Jurnal Umum"
                                  style={{
                                    padding: "5px 10px",
                                    background: "#eff6ff",
                                    color: "#2563eb",
                                    border: "1px solid #bfdbfe",
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    width: "100%",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Edit3 size={12} /> Edit
                                </button>
                                <button
                                  onClick={() => handleOpenCancelJournal(j)}
                                  title="Batalkan Jurnal Umum"
                                  style={{
                                    padding: "5px 10px",
                                    background: "#fef2f2",
                                    color: "#dc2626",
                                    border: "1px solid #fecaca",
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    width: "100%",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Trash2 size={12} /> Batal
                                </button>
                              </>
                            ) : (
                              <span style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic", fontWeight: 600 }}>
                                Dibatalkan
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* BARIS 2: ENTRI KREDIT (MENYOROK KE DALAM) */}
                      <tr style={{ background: isCancelled ? "#fff8f7" : "#fafafa", opacity: isCancelled ? 0.78 : 1 }}>
                        {/* Status & Nama Akun Kredit */}
                        <td style={{ padding: "4px 16px 10px 36px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 700, color: isCancelled ? "#6b7280" : "#b91c1c", fontSize: 13, textDecoration: isCancelled ? "line-through" : "none" }}>
                              [{j.kredit_kode}] {j.kredit_nama}
                            </span>
                            <span style={{ background: isCancelled ? "#f3f4f6" : "#fee2e2", color: isCancelled ? "#6b7280" : "#b91c1c", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4 }}>
                              KREDIT
                            </span>
                          </div>
                          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6b7280", fontStyle: "italic" }}>
                            Keterangan: {j.keterangan || "-"}
                          </p>
                          {isCancelled && j.cancel_reason && (
                            <div style={{ marginTop: 6, background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "#b91c1c" }}>
                              <strong>Alasan Batal:</strong> &ldquo;{j.cancel_reason}&rdquo;
                            </div>
                          )}
                        </td>
                        {/* Column Debit (-) */}
                        <td style={{ padding: "4px 16px 10px 16px", textAlign: "right", color: "#9ca3af" }}>
                          -
                        </td>
                        {/* Nominal Kredit */}
                        <td style={{ padding: "4px 16px 10px 16px", textAlign: "right", fontWeight: 800, color: isCancelled ? "#9ca3af" : "#b91c1c", textDecoration: isCancelled ? "line-through" : "none" }}>
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
                    TOTAL BUKU JURNAL AKTIF SEIMBANG (BALANCED):
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#15803d", fontSize: 14 }}>
                    Rp {journals.filter(j => j.status !== "dibatalkan").reduce((sum, j) => sum + Number(j.nominal || 0), 0).toLocaleString("id-ID")}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#b91c1c", fontSize: 14 }}>
                    Rp {journals.filter(j => j.status !== "dibatalkan").reduce((sum, j) => sum + Number(j.nominal || 0), 0).toLocaleString("id-ID")}
                  </td>
                  <td></td>
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
                {(() => {
                  const master = coaListAll.length > 0 ? coaListAll : coaList;
                  const filtered = master.filter((c) =>
                    c.sub_kelompok === "Beban Pokok Penjualan" ||
                    c.kode_akun?.startsWith("5-")
                  );
                  const listToRender = filtered.length > 0 ? filtered : master;
                  return (
                    <SearchableSelect
                      options={listToRender.map((c) => ({
                        value: c.id,
                        label: `(${c.kode_akun}) ${c.nama_akun}`,
                        category: c.sub_kelompok || c.kelompok,
                      }))}
                      value={purchaseCoaId}
                      onChange={(val) => setPurchaseCoaId(val ? Number(val) : "")}
                      placeholder="-- Ketik / Pilih Kategori HPP --"
                    />
                  );
                })()}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Rekening Pembayaran / Metode *
                </label>
                <SearchableSelect
                  options={[
                    { value: "hutang", label: "💳 Hutang Usaha / Tempo (Belum Dibayar)", category: "Tempo" },
                    ...accounts.map((a) => ({
                      value: a.id,
                      label: `${a.nama_rekening} (Saldo: Rp${Number(a.saldo_kini).toLocaleString("id-ID")})`,
                      category: "Kas/Bank",
                    })),
                  ]}
                  value={purchaseKasBankId}
                  onChange={(val) => setPurchaseKasBankId(val === "hutang" ? "hutang" : (val ? Number(val) : ""))}
                  placeholder="-- Pilih Rekening Kas / Hutang --"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Total Nominal Belanja (Rp) *
                </label>
                <input
                  type="text"
                  placeholder="0"
                  value={formatThousand(purchaseAmount)}
                  onChange={(e) => {
                    const val = parseThousand(e.target.value);
                    setPurchaseAmount(val);
                    if (purchaseKasBankId !== "hutang" && purchaseKasBankId !== 0 && purchaseKasBankId !== "") {
                      setPurchasePaidAmount(val);
                    }
                  }}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, fontWeight: 700, textAlign: "right" }}
                />
              </div>

              {/* Opsi Pembayaran Parsial / DP jika bukan Hutang murni */}
              {purchaseKasBankId !== "hutang" && purchaseKasBankId !== 0 && purchaseKasBankId !== "" && (
                <div style={{ marginBottom: 16, background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                      Nominal Dibayar (DP / Parsial) (Rp)
                    </label>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      Sisa Hutang: <strong>Rp {Math.max(0, purchaseAmount - (purchasePaidAmount || 0)).toLocaleString("id-ID")}</strong>
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="0"
                    value={purchasePaidAmount === 0 ? "0" : formatThousand(purchasePaidAmount)}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (raw === "" || raw === "0") {
                        setPurchasePaidAmount(0);
                      } else {
                        setPurchasePaidAmount(Math.min(purchaseAmount, parseThousand(raw)));
                      }
                    }}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, fontWeight: 700, textAlign: "right", background: "white" }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setPurchasePaidAmount(purchaseAmount)}
                      style={{ fontSize: 11, padding: "3px 8px", background: purchasePaidAmount === purchaseAmount && purchaseAmount > 0 ? "#e0e7ff" : "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                    >
                      Bayar Lunas (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPurchasePaidAmount(Math.round(purchaseAmount * 0.5))}
                      style={{ fontSize: 11, padding: "3px 8px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                    >
                      DP 50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPurchasePaidAmount(0)}
                      style={{ fontSize: 11, padding: "3px 8px", background: purchasePaidAmount === 0 ? "#fee2e2" : "#f1f5f9", color: purchasePaidAmount === 0 ? "#dc2626" : "#475569", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer", fontWeight: 700 }}
                    >
                      Belum Dibayar (Rp 0 / Tempo)
                    </button>
                  </div>
                </div>
              )}

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

      {/* ── MODAL: EDIT NOTA HPP ────────────────────────────── */}
      {isEditPurchaseModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, maxWidth: 480, width: "100%", padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Edit Nota Pembelian HPP</h3>
              <button onClick={() => setIsEditPurchaseModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditPurchase}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Tanggal Belanja *
                </label>
                <input
                  type="date"
                  value={editPurDate}
                  onChange={(e) => setEditPurDate(e.target.value)}
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
                  value={editPurNotaRef}
                  onChange={(e) => setEditPurNotaRef(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Keterangan Belanja *
                </label>
                <input
                  type="text"
                  value={editPurKeterangan}
                  onChange={(e) => setEditPurKeterangan(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Kategori HPP *
                </label>
                {(() => {
                  const master = coaListAll.length > 0 ? coaListAll : coaList;
                  const filtered = master.filter((c) =>
                    c.sub_kelompok === "Beban Pokok Penjualan" ||
                    c.kode_akun?.startsWith("5-")
                  );
                  const listToRender = filtered.length > 0 ? filtered : master;
                  return (
                    <SearchableSelect
                      options={listToRender.map((c) => ({
                        value: c.id,
                        label: `(${c.kode_akun}) ${c.nama_akun}`,
                        category: c.sub_kelompok || c.kelompok,
                      }))}
                      value={editPurCoaId}
                      onChange={(val) => setEditPurCoaId(val ? Number(val) : "")}
                      placeholder="-- Ketik / Pilih Kategori HPP --"
                    />
                  );
                })()}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Rekening Pembayaran / Metode *
                </label>
                <SearchableSelect
                  options={[
                    { value: "hutang", label: "💳 Hutang Usaha / Tempo (Belum Dibayar)", category: "Tempo" },
                    ...accounts.map((a) => ({
                      value: a.id,
                      label: `${a.nama_rekening} (Saldo: Rp${Number(a.saldo_kini).toLocaleString("id-ID")})`,
                      category: "Kas/Bank",
                    })),
                  ]}
                  value={editPurKasBankId}
                  onChange={(val) => setEditPurKasBankId(val === "hutang" ? "hutang" : (val ? Number(val) : ""))}
                  placeholder="-- Pilih Rekening Kas / Hutang --"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Total Nominal (Rp) *
                </label>
                <input
                  type="text"
                  value={formatThousand(editPurTotalAmount)}
                  onChange={(e) => {
                    const val = parseThousand(e.target.value);
                    setEditPurTotalAmount(val);
                    if (editPurKasBankId !== "hutang" && editPurKasBankId !== 0 && editPurKasBankId !== "") {
                      setEditPurPaidAmount(Math.min(val, editPurPaidAmount || val));
                    }
                  }}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, fontWeight: 700, textAlign: "right" }}
                />
              </div>

              {/* Opsi Pembayaran Parsial di Edit */}
              {editPurKasBankId !== "hutang" && editPurKasBankId !== 0 && editPurKasBankId !== "" && (
                <div style={{ marginBottom: 16, background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                      Nominal Dibayar (DP / Parsial) (Rp)
                    </label>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      Sisa Hutang: <strong>Rp {Math.max(0, editPurTotalAmount - (editPurPaidAmount || 0)).toLocaleString("id-ID")}</strong>
                    </span>
                  </div>
                  <input
                    type="text"
                    value={editPurPaidAmount === 0 ? "0" : formatThousand(editPurPaidAmount)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      if (raw === "" || raw === "0") {
                        setEditPurPaidAmount(0);
                      } else {
                        setEditPurPaidAmount(Math.min(editPurTotalAmount, parseInt(raw, 10)));
                      }
                    }}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, fontWeight: 700, textAlign: "right", background: "white" }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={() => setEditPurPaidAmount(editPurTotalAmount)}
                      style={{ fontSize: 11, padding: "2px 8px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer" }}
                    >
                      Bayar Lunas (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPurPaidAmount(Math.round(editPurTotalAmount * 0.5))}
                      style={{ fontSize: 11, padding: "2px 8px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer" }}
                    >
                      DP 50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPurPaidAmount(0)}
                      style={{ fontSize: 11, padding: "2px 8px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                    >
                      Belum Dibayar (Rp 0 / Tempo)
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setIsEditPurchaseModalOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", cursor: "pointer" }}>
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5005A6", color: "white", fontWeight: 700, cursor: "pointer" }}>
                  {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: INPUT EXPENSE ────────────────────────────── */}
      {isExpenseModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, maxWidth: 480, width: "100%", padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#111827" }}>Catat Biaya Operasional</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
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
                  placeholder="Gaji staf kantor, ATK, Biaya harian..."
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
                {(() => {
                  const master = coaListAll.length > 0 ? coaListAll : coaList;
                  const filtered = master.filter((c) =>
                    c.sub_kelompok === "Beban Operasional" ||
                    c.kelompok === "Beban" ||
                    c.kode_akun?.startsWith("6-")
                  );
                  const listToRender = filtered.length > 0 ? filtered : master;
                  return (
                    <SearchableSelect
                      options={listToRender.map((c) => ({
                        value: c.id,
                        label: `(${c.kode_akun}) ${c.nama_akun}`,
                        category: c.sub_kelompok || c.kelompok,
                      }))}
                      value={expenseCoaId}
                      onChange={(val) => setExpenseCoaId(val ? Number(val) : "")}
                      placeholder="-- Ketik / Pilih Kategori Beban --"
                    />
                  );
                })()}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Sumber Dana Kas/Bank / Metode *
                </label>
                <SearchableSelect
                  options={[
                    { value: "hutang", label: "💳 Hutang Usaha / Tempo (Belum Dibayar)", category: "Tempo" },
                    ...accounts.map((a) => ({
                      value: a.id,
                      label: `${a.nama_rekening} (Saldo: Rp${Number(a.saldo_kini).toLocaleString("id-ID")})`,
                      category: "Kas/Bank",
                    })),
                  ]}
                  value={expenseKasBankId}
                  onChange={(val) => setExpenseKasBankId(val === "hutang" ? "hutang" : (val ? Number(val) : ""))}
                  placeholder="-- Pilih Rekening Kas / Hutang --"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Total Nominal Biaya (Rp) *
                </label>
                <input
                  type="text"
                  placeholder="0"
                  value={formatThousand(expenseAmount)}
                  onChange={(e) => {
                    const val = parseThousand(e.target.value);
                    setExpenseAmount(val);
                    if (expenseKasBankId !== "hutang" && expenseKasBankId !== 0 && expenseKasBankId !== "") {
                      setExpensePaidAmount(val);
                    }
                  }}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, fontWeight: 700, textAlign: "right" }}
                />
              </div>

              {/* Opsi Pembayaran Parsial di Expense Input */}
              {expenseKasBankId !== "hutang" && expenseKasBankId !== 0 && expenseKasBankId !== "" && (
                <div style={{ marginBottom: 16, background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                      Nominal Dibayar (DP / Parsial) (Rp)
                    </label>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      Sisa Hutang: <strong>Rp {Math.max(0, expenseAmount - (expensePaidAmount || 0)).toLocaleString("id-ID")}</strong>
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="0"
                    value={expensePaidAmount === 0 ? "0" : formatThousand(expensePaidAmount)}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (raw === "" || raw === "0") {
                        setExpensePaidAmount(0);
                      } else {
                        setExpensePaidAmount(Math.min(expenseAmount, parseThousand(raw)));
                      }
                    }}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, fontWeight: 700, textAlign: "right", background: "white" }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setExpensePaidAmount(expenseAmount)}
                      style={{ fontSize: 11, padding: "3px 8px", background: expensePaidAmount === expenseAmount && expenseAmount > 0 ? "#e0e7ff" : "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                    >
                      Bayar Lunas (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpensePaidAmount(Math.round(expenseAmount * 0.5))}
                      style={{ fontSize: 11, padding: "3px 8px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                    >
                      DP 50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpensePaidAmount(0)}
                      style={{ fontSize: 11, padding: "3px 8px", background: expensePaidAmount === 0 ? "#fee2e2" : "#f1f5f9", color: expensePaidAmount === 0 ? "#dc2626" : "#475569", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer", fontWeight: 700 }}
                    >
                      Belum Dibayar (Rp 0 / Tempo)
                    </button>
                  </div>
                </div>
              )}

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

      {/* ── MODAL: EDIT EXPENSE ──────────────────────────────── */}
      {isEditExpenseModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, maxWidth: 480, width: "100%", padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#111827" }}>Edit Biaya Operasional</h3>
              <button onClick={() => setIsEditExpenseModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditExpense}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Tanggal Transaksi *
                </label>
                <input
                  type="date"
                  value={editExpDate}
                  onChange={(e) => setEditExpDate(e.target.value)}
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
                  placeholder="Gaji staf kantor, ATK, Biaya harian..."
                  value={editExpKeterangan}
                  onChange={(e) => setEditExpKeterangan(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Kategori Beban Operasional *
                </label>
                {(() => {
                  const master = coaListAll.length > 0 ? coaListAll : coaList;
                  const filtered = master.filter((c) =>
                    c.sub_kelompok === "Beban Operasional" ||
                    c.kelompok === "Beban" ||
                    c.kode_akun?.startsWith("6-")
                  );
                  const listToRender = filtered.length > 0 ? filtered : master;
                  return (
                    <SearchableSelect
                      options={listToRender.map((c) => ({
                        value: c.id,
                        label: `(${c.kode_akun}) ${c.nama_akun}`,
                        category: c.sub_kelompok || c.kelompok,
                      }))}
                      value={editExpCoaId}
                      onChange={(val) => setEditExpCoaId(val ? Number(val) : "")}
                      placeholder="-- Ketik / Pilih Kategori Beban --"
                    />
                  );
                })()}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Sumber Dana Kas/Bank / Metode *
                </label>
                <SearchableSelect
                  options={[
                    { value: "hutang", label: "💳 Hutang Usaha / Tempo (Belum Dibayar)", category: "Tempo" },
                    ...accounts.map((a) => ({
                      value: a.id,
                      label: `${a.nama_rekening} (Saldo: Rp${Number(a.saldo_kini).toLocaleString("id-ID")})`,
                      category: "Kas/Bank",
                    })),
                  ]}
                  value={editExpKasBankId}
                  onChange={(val) => setEditExpKasBankId(val === "hutang" ? "hutang" : (val ? Number(val) : ""))}
                  placeholder="-- Pilih Rekening Kas / Hutang --"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Total Nominal Biaya (Rp) *
                </label>
                <input
                  type="text"
                  value={formatThousand(editExpNominal)}
                  onChange={(e) => {
                    const val = parseThousand(e.target.value);
                    setEditExpNominal(val);
                    if (editExpKasBankId !== "hutang" && editExpKasBankId !== 0 && editExpKasBankId !== "") {
                      setEditExpPaidAmount(Math.min(val, editExpPaidAmount || val));
                    }
                  }}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, fontWeight: 700, textAlign: "right" }}
                />
              </div>

              {/* Opsi Pembayaran Parsial di Edit Expense */}
              {editExpKasBankId !== "hutang" && editExpKasBankId !== 0 && editExpKasBankId !== "" && (
                <div style={{ marginBottom: 16, background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                      Nominal Dibayar (DP / Parsial) (Rp)
                    </label>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      Sisa Hutang: <strong>Rp {Math.max(0, editExpNominal - (editExpPaidAmount || 0)).toLocaleString("id-ID")}</strong>
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="0"
                    value={editExpPaidAmount === 0 ? "0" : formatThousand(editExpPaidAmount)}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (raw === "" || raw === "0") {
                        setEditExpPaidAmount(0);
                      } else {
                        setEditExpPaidAmount(Math.min(editExpNominal, parseThousand(raw)));
                      }
                    }}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, fontWeight: 700, textAlign: "right", background: "white" }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setEditExpPaidAmount(editExpNominal)}
                      style={{ fontSize: 11, padding: "3px 8px", background: editExpPaidAmount === editExpNominal && editExpNominal > 0 ? "#e0e7ff" : "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                    >
                      Set Lunas (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditExpPaidAmount(Math.round(editExpNominal * 0.5))}
                      style={{ fontSize: 11, padding: "3px 8px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
                    >
                      DP 50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditExpPaidAmount(0)}
                      style={{ fontSize: 11, padding: "3px 8px", background: editExpPaidAmount === 0 ? "#fee2e2" : "#f1f5f9", color: editExpPaidAmount === 0 ? "#dc2626" : "#475569", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer", fontWeight: 700 }}
                    >
                      Belum Dibayar (Rp 0 / Tempo)
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setIsEditExpenseModalOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", cursor: "pointer" }}>
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5005A6", color: "white", fontWeight: 700, cursor: "pointer" }}>
                  {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
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
              onChange={(e) => {
                setCoaKelompokFilter(e.target.value);
                setCoaPage(1);
              }}
              style={{ width: 150, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white" }}
            >
              <option value="">Semua Kelompok</option>
              <option value="Aset">🔵 Aset</option>
              <option value="Liabilitas">🔴 Liabilitas</option>
              <option value="Ekuitas">🟢 Ekuitas</option>
              <option value="Pendapatan">🟣 Pendapatan</option>
              <option value="Beban">🟠 Beban & COGS</option>
            </select>

            <select
              value={coaKlasifikasiPlFilter}
              onChange={(e) => {
                setCoaKlasifikasiPlFilter(e.target.value);
                setCoaPage(1);
              }}
              style={{ width: 190, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white" }}
            >
              <option value="">Semua Klasifikasi P&L</option>
              <option value="Pendapatan">🟣 Pendapatan</option>
              <option value="Food Cost">🟢 Food Cost (Bahan & Kemasan)</option>
              <option value="Overhead Dapur">🟡 Overhead Dapur</option>
              <option value="Beban Operasional">🟠 Beban Operasional</option>
            </select>
          </div>

          {/* COA Table */}
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 14px", width: 45 }}>No.</th>
                  <th style={{ padding: "12px 14px", width: 110 }}>Kode Akun</th>
                  <th style={{ padding: "12px 14px" }}>Nama Akun</th>
                  <th style={{ padding: "12px 14px", width: 120 }}>Kelompok</th>
                  <th style={{ padding: "12px 14px", width: 150 }}>Sub Kelompok</th>
                  <th style={{ padding: "12px 14px", width: 165 }}>Klasifikasi P&L</th>
                  <th style={{ padding: "12px 14px", width: 90 }}>Status</th>
                  <th style={{ padding: "12px 14px", width: 100, textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                      Memuat daftar Chart of Accounts...
                    </td>
                  </tr>
                ) : (coaTableList.length > 0 ? coaTableList : (coaSearch || coaKelompokFilter || coaKlasifikasiPlFilter ? [] : coaListAll)).length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                      Tidak ada akun COA ditemukan.
                    </td>
                  </tr>
                ) : (
                  (coaTableList.length > 0 ? coaTableList : coaListAll)
                    .slice((coaPage - 1) * coaLimit, coaPage * coaLimit)
                    .map((c, idx) => {
                      let plTag = "-";
                      let plColor = "#6b7280";
                      let plBg = "#f3f4f6";

                      if (c.kelompok === "Pendapatan") {
                        plTag = "Pendapatan";
                        plColor = "#7e22ce";
                        plBg = "#f3e8ff";
                      } else if (c.kelompok === "Beban" && c.sub_kelompok === "Beban Pokok Penjualan") {
                        if (isFoodCostAccount(c)) {
                          plTag = "HPP - Food Cost";
                          plColor = "#15803d";
                          plBg = "#dcfce7";
                        } else {
                          plTag = "HPP - Overhead Dapur";
                          plColor = "#b45309";
                          plBg = "#fef3c7";
                        }
                      } else if (c.kelompok === "Beban" && c.sub_kelompok === "Beban Operasional") {
                        plTag = "Beban Operasional";
                        plColor = "#c2410c";
                        plBg = "#ffedd5";
                      } else if (c.kelompok === "Aset" || c.kelompok === "Liabilitas" || c.kelompok === "Ekuitas") {
                        plTag = "Neraca Saldo";
                        plColor = "#2563eb";
                        plBg = "#eff6ff";
                      }

                      return (
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
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                background: plBg,
                                color: plColor,
                                border: `1px solid ${plColor}33`,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {plTag}
                            </span>
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
                      );
                    })
                )}
              </tbody>
            </table>

            {/* COA Table Pagination */}
            {(coaTableList.length > 0 ? coaTableList : coaListAll).length > 0 && (
              <Pagination
                page={coaPage}
                totalPages={Math.ceil((coaTableList.length > 0 ? coaTableList : coaListAll).length / coaLimit)}
                total={(coaTableList.length > 0 ? coaTableList : coaListAll).length}
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
          {/* Filter Toolbar Rentang / Cutoff Waktu Neraca */}
          <div
            style={{
              background: "white",
              borderRadius: 14,
              padding: "12px 18px",
              border: "1px solid #e5e7eb",
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Calendar size={16} color="#5005A6" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Posisi Neraca Per Tanggal (Cut-off):</span>
              </div>

              {/* Preset Shortcuts */}
              <div style={{ background: "#f3f4f6", padding: 3, borderRadius: 8, display: "flex", gap: 3, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleNeracaShortcutChange("today")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: neracaPreset === "today" ? "#5005A6" : "transparent",
                    color: neracaPreset === "today" ? "white" : "#4b5563",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => handleNeracaShortcutChange("yesterday")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: neracaPreset === "yesterday" ? "#5005A6" : "transparent",
                    color: neracaPreset === "yesterday" ? "white" : "#4b5563",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Kemarin
                </button>
                <button
                  type="button"
                  onClick={() => handleNeracaShortcutChange("this_month")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: neracaPreset === "this_month" ? "#5005A6" : "transparent",
                    color: neracaPreset === "this_month" ? "white" : "#4b5563",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Akhir Bulan Ini
                </button>
                <button
                  type="button"
                  onClick={() => handleNeracaShortcutChange("last_month")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: neracaPreset === "last_month" ? "#5005A6" : "transparent",
                    color: neracaPreset === "last_month" ? "white" : "#4b5563",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Akhir Bulan Lalu
                </button>
                <button
                  type="button"
                  onClick={() => handleNeracaShortcutChange("this_year")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: neracaPreset === "this_year" ? "#5005A6" : "transparent",
                    color: neracaPreset === "this_year" ? "white" : "#4b5563",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Tahun Ini
                </button>
                <button
                  type="button"
                  onClick={() => handleNeracaShortcutChange("all")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: neracaPreset === "all" ? "#5005A6" : "transparent",
                    color: neracaPreset === "all" ? "white" : "#4b5563",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Semua Waktu
                </button>
              </div>

              {/* Date Input */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f9fafb", padding: "4px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}>
                <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Per:</span>
                <input
                  type="date"
                  value={neracaDateTo}
                  onChange={(e) => {
                    setNeracaDateTo(e.target.value);
                    setNeracaPreset("custom");
                  }}
                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12, outline: "none" }}
                />
              </div>
            </div>

            {/* Action Buttons: Export Excel & PDF */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={handleExportNeracaXLSX}
                style={{
                  padding: "7px 14px",
                  background: "#f0fdf4",
                  color: "#15803d",
                  border: "1px solid #bbf7d0",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                title="Export Neraca Keuangan ke Excel (.xlsx)"
              >
                <FileSpreadsheet size={15} /> Export Excel
              </button>

              <button
                type="button"
                onClick={handlePrintNeracaPDF}
                style={{
                  padding: "7px 14px",
                  background: "#5005A6",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 6px rgba(80, 5, 166, 0.2)",
                }}
                title="Cetak atau simpan Neraca Keuangan sebagai PDF"
              >
                <Printer size={15} /> Cetak / Unduh PDF
              </button>
            </div>
          </div>

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

                {/* ── VERTICAL HIERARCHICAL BALANCE SHEET (FORMAT AKUNTANSI STANDAR ATAS-BAWAH) ── */}
                {(() => {
                  // Aset sub-categories
                  const kasBankRows = asetRows.filter((r) => r.kode_akun.startsWith("1-1001") || r.kode_akun.startsWith("1-1002") || r.kode_akun.startsWith("1-1003") || r.nama_akun.toLowerCase().includes("kas") || r.nama_akun.toLowerCase().includes("bank"));
                  const asetLancarLainRows = asetRows.filter((r) => (r.sub_kelompok === "Aset Lancar" || !r.sub_kelompok) && !kasBankRows.includes(r));
                  const asetTetapRows = asetRows.filter((r) => r.sub_kelompok === "Aset Tetap");
                  const asetLainnyaRows = asetRows.filter((r) => r.sub_kelompok === "Aset Lainnya");

                  const totalKasBank = kasBankRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0);
                  const totalAsetLancarLain = asetLancarLainRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0);
                  const totalAsetLancar = totalKasBank + totalAsetLancarLain;
                  const totalAsetTetap = asetTetapRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0);
                  const totalAsetLainnya = asetLainnyaRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0);

                  // Liabilitas sub-categories
                  const liabLancarRows = liabRows.filter((r) => r.sub_kelompok === "Liabilitas Lancar" || !r.sub_kelompok);
                  const liabJangkaPanjangRows = liabRows.filter((r) => r.sub_kelompok === "Liabilitas Jangka Panjang");
                  const totalLiabLancar = Math.abs(liabLancarRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0));
                  const totalLiabJangkaPanjang = Math.abs(liabJangkaPanjangRows.reduce((acc, r) => acc + Number(r.saldo || 0), 0));

                  const cutoffDisplay = neracaDateTo
                    ? new Date(neracaDateTo).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                    : "Semua Waktu (Kumulatif)";

                  return (
                    <div style={{ background: "white", borderRadius: 14, border: "1px solid #e5e7eb", padding: "24px 28px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                      <div style={{ textAlign: "center", borderBottom: "2px solid #e5e7eb", paddingBottom: 16, marginBottom: 20 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 900, color: "#111827", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          NERACA KEUANGAN (BALANCE SHEET)
                        </h2>
                        <p style={{ fontSize: 13, color: "#4b5563", margin: "4px 0 0", fontWeight: 600 }}>
                          SIAP SAJI — DYUMMY CATERING
                        </p>
                        <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>
                          Per Tanggal: {cutoffDisplay} | Mata Uang: Rupiah (IDR)
                        </p>
                      </div>

                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: "2px solid #111827", color: "#1e3a8a", fontWeight: 800 }}>
                            <th style={{ textAlign: "left", padding: "8px 0", width: "70%" }}>DESKRIPSI AKUN</th>
                            <th style={{ textAlign: "right", padding: "8px 0", width: "30%" }}>SALDO (RP)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* ═════════════════════════════════════════════════════ */}
                          {/* 1. BAGIAN ASET (AKTIVA)                              */}
                          {/* ═════════════════════════════════════════════════════ */}
                          <tr>
                            <td colSpan={2} style={{ padding: "16px 0 6px", fontWeight: 900, fontSize: 15, color: "#1e40af", background: "#f8fafc" }}>
                              ASET
                            </td>
                          </tr>

                          {/* 1A. Kas & Bank */}
                          <tr>
                            <td colSpan={2} style={{ padding: "6px 0 2px 14px", fontWeight: 800, color: "#1f2937" }}>
                              Kas & Bank
                            </td>
                          </tr>
                          {kasBankRows.map((r) => (
                            <tr
                              key={r.kode_akun}
                              onClick={() => handleOpenDrillModal(r, "", neracaDateTo)}
                              title={`Klik untuk melihat rincian transaksi (${r.kode_akun}) ${r.nama_akun}`}
                              style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <td style={{ padding: "4px 0 4px 28px", color: "#1d4ed8" }}>
                                <span style={{ fontFamily: "monospace", color: "#3b82f6", marginRight: 8, textDecoration: "underline", textDecorationStyle: "dotted" }}>({r.kode_akun})</span>
                                <span style={{ textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>{r.nama_akun}</span>
                              </td>
                              <td style={{ textAlign: "right", padding: "4px 0", fontFamily: "monospace", fontWeight: 600 }}>
                                {Number(r.saldo || 0).toLocaleString("id-ID")}
                              </td>
                            </tr>
                          ))}
                          <tr>
                            <td style={{ padding: "4px 0 8px 14px", fontWeight: 700, color: "#1f2937" }}>
                              Total Kas & Bank
                            </td>
                            <td style={{ textAlign: "right", padding: "4px 0 8px 0", fontWeight: 700, borderTop: "1px dashed #cbd5e1", fontFamily: "monospace" }}>
                              Rp{totalKasBank.toLocaleString("id-ID")}
                            </td>
                          </tr>

                          {/* 1B. Aset Lancar Lainnya (Piutang Usaha, dll) */}
                          <tr>
                            <td colSpan={2} style={{ padding: "8px 0 2px 14px", fontWeight: 800, color: "#1f2937" }}>
                              Aset Lancar Lainnya
                            </td>
                          </tr>
                          {asetLancarLainRows.map((r) => (
                            <tr
                              key={r.kode_akun}
                              onClick={() => handleOpenDrillModal(r, "", neracaDateTo)}
                              title={`Klik untuk melihat rincian transaksi (${r.kode_akun}) ${r.nama_akun}`}
                              style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <td style={{ padding: "4px 0 4px 28px", color: "#1d4ed8" }}>
                                <span style={{ fontFamily: "monospace", color: "#3b82f6", marginRight: 8, textDecoration: "underline", textDecorationStyle: "dotted" }}>({r.kode_akun})</span>
                                <span style={{ textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>{r.nama_akun}</span>
                              </td>
                              <td style={{ textAlign: "right", padding: "4px 0", fontFamily: "monospace", fontWeight: 600 }}>
                                {Number(r.saldo || 0).toLocaleString("id-ID")}
                              </td>
                            </tr>
                          ))}
                          <tr>
                            <td style={{ padding: "4px 0 8px 14px", fontWeight: 700, color: "#1f2937" }}>
                              Total Aset Lancar Lainnya
                            </td>
                            <td style={{ textAlign: "right", padding: "4px 0 8px 0", fontWeight: 700, borderTop: "1px dashed #cbd5e1", fontFamily: "monospace" }}>
                              Rp{totalAsetLancarLain.toLocaleString("id-ID")}
                            </td>
                          </tr>

                          {/* Subtotal Total Aset Lancar */}
                          <tr style={{ background: "#f1f5f9" }}>
                            <td style={{ padding: "8px 0 8px 14px", fontWeight: 800, color: "#0f172a" }}>
                              JUMLAH ASET LANCAR
                            </td>
                            <td style={{ textAlign: "right", padding: "8px 0", fontWeight: 800, color: "#0f172a", fontFamily: "monospace" }}>
                              Rp{totalAsetLancar.toLocaleString("id-ID")}
                            </td>
                          </tr>

                          {/* 1C. Aset Tetap */}
                          <tr>
                            <td colSpan={2} style={{ padding: "12px 0 2px 14px", fontWeight: 800, color: "#1f2937" }}>
                              Aset Tetap
                            </td>
                          </tr>
                          {asetTetapRows.map((r) => (
                            <tr
                              key={r.kode_akun}
                              onClick={() => handleOpenDrillModal(r, "", neracaDateTo)}
                              title={`Klik untuk melihat rincian transaksi (${r.kode_akun}) ${r.nama_akun}`}
                              style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <td style={{ padding: "4px 0 4px 28px", color: "#1d4ed8" }}>
                                <span style={{ fontFamily: "monospace", color: "#3b82f6", marginRight: 8, textDecoration: "underline", textDecorationStyle: "dotted" }}>({r.kode_akun})</span>
                                <span style={{ textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>{r.nama_akun}</span>
                              </td>
                              <td style={{ textAlign: "right", padding: "4px 0", fontFamily: "monospace", fontWeight: 600 }}>
                                {Number(r.saldo || 0).toLocaleString("id-ID")}
                              </td>
                            </tr>
                          ))}
                          <tr>
                            <td style={{ padding: "4px 0 8px 14px", fontWeight: 700, color: "#1f2937" }}>
                              Total Aset Tetap
                            </td>
                            <td style={{ textAlign: "right", padding: "4px 0 8px 0", fontWeight: 700, borderTop: "1px dashed #cbd5e1", fontFamily: "monospace" }}>
                              Rp{totalAsetTetap.toLocaleString("id-ID")}
                            </td>
                          </tr>

                          {/* 1D. Aset Lainnya */}
                          {asetLainnyaRows.length > 0 && (
                            <>
                              <tr>
                                <td colSpan={2} style={{ padding: "8px 0 2px 14px", fontWeight: 800, color: "#1f2937" }}>
                                  Aset Lainnya
                                </td>
                              </tr>
                              {asetLainnyaRows.map((r) => (
                                <tr
                                  key={r.kode_akun}
                                  onClick={() => handleOpenDrillModal(r, "", neracaDateTo)}
                                  title={`Klik untuk melihat rincian transaksi (${r.kode_akun}) ${r.nama_akun}`}
                                  style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                  <td style={{ padding: "4px 0 4px 28px", color: "#1d4ed8" }}>
                                    <span style={{ fontFamily: "monospace", color: "#3b82f6", marginRight: 8, textDecoration: "underline", textDecorationStyle: "dotted" }}>({r.kode_akun})</span>
                                    <span style={{ textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>{r.nama_akun}</span>
                                  </td>
                                  <td style={{ textAlign: "right", padding: "4px 0", fontFamily: "monospace", fontWeight: 600 }}>
                                    {Number(r.saldo || 0).toLocaleString("id-ID")}
                                  </td>
                                </tr>
                              ))}
                              <tr>
                                <td style={{ padding: "4px 0 8px 14px", fontWeight: 700, color: "#1f2937" }}>
                                  Total Aset Lainnya
                                </td>
                                <td style={{ textAlign: "right", padding: "4px 0 8px 0", fontWeight: 700, borderTop: "1px dashed #cbd5e1", fontFamily: "monospace" }}>
                                  Rp{totalAsetLainnya.toLocaleString("id-ID")}
                                </td>
                              </tr>
                            </>
                          )}

                          {/* TOTAL ASET */}
                          <tr style={{ background: "#dbeafe", borderTop: "1.5px solid #1e40af", borderBottom: "2px solid #1e40af" }}>
                            <td style={{ padding: "10px 0 10px 10px", fontWeight: 900, fontSize: 14, color: "#1e3a8a" }}>
                              TOTAL ASET (AKTIVA)
                            </td>
                            <td style={{ textAlign: "right", padding: "10px 10px 10px 0", fontWeight: 900, fontSize: 15, color: "#1e3a8a", fontFamily: "monospace" }}>
                              Rp{totalAset.toLocaleString("id-ID")}
                            </td>
                          </tr>

                          {/* ═════════════════════════════════════════════════════ */}
                          {/* 2. BAGIAN LIABILITAS & EKUITAS (PASSIVA)             */}
                          {/* ═════════════════════════════════════════════════════ */}
                          <tr>
                            <td colSpan={2} style={{ padding: "24px 0 6px", fontWeight: 900, fontSize: 15, color: "#991b1b", background: "#f8fafc" }}>
                              LIABILITAS (KEWAJIBAN)
                            </td>
                          </tr>

                          {/* 2A. Liabilitas Jangka Pendek / Lancar */}
                          <tr>
                            <td colSpan={2} style={{ padding: "6px 0 2px 14px", fontWeight: 800, color: "#1f2937" }}>
                              Liabilitas Jangka Pendek (Utang Lancar)
                            </td>
                          </tr>
                          {liabLancarRows.map((r) => (
                            <tr
                              key={r.kode_akun}
                              onClick={() => handleOpenDrillModal(r, "", neracaDateTo)}
                              title={`Klik untuk melihat rincian transaksi (${r.kode_akun}) ${r.nama_akun}`}
                              style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <td style={{ padding: "4px 0 4px 28px", color: "#991b1b" }}>
                                <span style={{ fontFamily: "monospace", color: "#dc2626", marginRight: 8, textDecoration: "underline", textDecorationStyle: "dotted" }}>({r.kode_akun})</span>
                                <span style={{ textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>{r.nama_akun}</span>
                              </td>
                              <td style={{ textAlign: "right", padding: "4px 0", fontFamily: "monospace", fontWeight: 600 }}>
                                {Math.abs(Number(r.saldo || 0)).toLocaleString("id-ID")}
                              </td>
                            </tr>
                          ))}
                          <tr>
                            <td style={{ padding: "4px 0 8px 14px", fontWeight: 700, color: "#1f2937" }}>
                              Total Liabilitas Jangka Pendek
                            </td>
                            <td style={{ textAlign: "right", padding: "4px 0 8px 0", fontWeight: 700, borderTop: "1px dashed #cbd5e1", fontFamily: "monospace" }}>
                              Rp{totalLiabLancar.toLocaleString("id-ID")}
                            </td>
                          </tr>

                          {/* 2B. Liabilitas Jangka Panjang */}
                          {liabJangkaPanjangRows.length > 0 && (
                            <>
                              <tr>
                                <td colSpan={2} style={{ padding: "8px 0 2px 14px", fontWeight: 800, color: "#1f2937" }}>
                                  Liabilitas Jangka Panjang
                                </td>
                              </tr>
                              {liabJangkaPanjangRows.map((r) => (
                                <tr
                                  key={r.kode_akun}
                                  onClick={() => handleOpenDrillModal(r, "", neracaDateTo)}
                                  title={`Klik untuk melihat rincian transaksi (${r.kode_akun}) ${r.nama_akun}`}
                                  style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                  <td style={{ padding: "4px 0 4px 28px", color: "#991b1b" }}>
                                    <span style={{ fontFamily: "monospace", color: "#dc2626", marginRight: 8, textDecoration: "underline", textDecorationStyle: "dotted" }}>({r.kode_akun})</span>
                                    <span style={{ textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>{r.nama_akun}</span>
                                  </td>
                                  <td style={{ textAlign: "right", padding: "4px 0", fontFamily: "monospace", fontWeight: 600 }}>
                                    {Math.abs(Number(r.saldo || 0)).toLocaleString("id-ID")}
                                  </td>
                                </tr>
                              ))}
                              <tr>
                                <td style={{ padding: "4px 0 8px 14px", fontWeight: 700, color: "#1f2937" }}>
                                  Total Liabilitas Jangka Panjang
                                </td>
                                <td style={{ textAlign: "right", padding: "4px 0 8px 0", fontWeight: 700, borderTop: "1px dashed #cbd5e1", fontFamily: "monospace" }}>
                                  Rp{totalLiabJangkaPanjang.toLocaleString("id-ID")}
                                </td>
                              </tr>
                            </>
                          )}

                          {/* Subtotal Jumlah Liabilitas */}
                          <tr style={{ background: "#fef2f2" }}>
                            <td style={{ padding: "8px 0 8px 14px", fontWeight: 800, color: "#991b1b" }}>
                              JUMLAH LIABILITAS
                            </td>
                            <td style={{ textAlign: "right", padding: "8px 0", fontWeight: 800, color: "#991b1b", fontFamily: "monospace" }}>
                              Rp{totalLiabilitas.toLocaleString("id-ID")}
                            </td>
                          </tr>

                          {/* ═════════════════════════════════════════════════════ */}
                          {/* 3. EKUITAS (MODAL)                                  */}
                          {/* ═════════════════════════════════════════════════════ */}
                          <tr>
                            <td colSpan={2} style={{ padding: "20px 0 6px", fontWeight: 900, fontSize: 15, color: "#15803d", background: "#f8fafc" }}>
                              EKUITAS (MODAL)
                            </td>
                          </tr>
                          {ekuitasRows.map((r) => (
                            <tr
                              key={r.kode_akun}
                              onClick={() => handleOpenDrillModal(r, "", neracaDateTo)}
                              title={`Klik untuk melihat rincian transaksi (${r.kode_akun}) ${r.nama_akun}`}
                              style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0fdf4")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <td style={{ padding: "4px 0 4px 28px", color: "#166534" }}>
                                <span style={{ fontFamily: "monospace", color: "#15803d", marginRight: 8, textDecoration: "underline", textDecorationStyle: "dotted" }}>({r.kode_akun})</span>
                                <span style={{ textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>{r.nama_akun}</span>
                              </td>
                              <td style={{ textAlign: "right", padding: "4px 0", fontFamily: "monospace", fontWeight: 600 }}>
                                {Math.abs(Number(r.saldo || 0)).toLocaleString("id-ID")}
                              </td>
                            </tr>
                          ))}
                          {/* Laba Bersih Berjalan P&L */}
                          <tr
                            onClick={() => setActiveTab("pl")}
                            title="Klik untuk membuka Laporan Laba/Rugi (P&L)"
                            style={{ background: "#f0fdf4", cursor: "pointer" }}
                          >
                            <td style={{ padding: "5px 0 5px 28px", fontWeight: 700, color: "#15803d" }}>
                              <span style={{ fontFamily: "monospace", color: "#16a34a", marginRight: 8 }}>(3-2001)</span>
                              <span style={{ textDecoration: "underline", textDecorationStyle: "dotted" }}>Laba Bersih Berjalan (P&L) ↗</span>
                            </td>
                            <td style={{ textAlign: "right", padding: "5px 0", fontWeight: 800, color: "#15803d", fontFamily: "monospace" }}>
                              Rp{labaBerjalan.toLocaleString("id-ID")}
                            </td>
                          </tr>

                          {/* Subtotal Jumlah Ekuitas */}
                          <tr style={{ background: "#dcfce7" }}>
                            <td style={{ padding: "8px 0 8px 14px", fontWeight: 800, color: "#166534" }}>
                              JUMLAH EKUITAS
                            </td>
                            <td style={{ textAlign: "right", padding: "8px 0", fontWeight: 800, color: "#166534", fontFamily: "monospace" }}>
                              Rp{totalEkuitasTotal.toLocaleString("id-ID")}
                            </td>
                          </tr>

                          {/* TOTAL LIABILITAS & EKUITAS (PASSIVA) */}
                          <tr style={{ background: "#fae8ff", borderTop: "1.5px solid #86198f", borderBottom: "2px solid #86198f" }}>
                            <td style={{ padding: "10px 0 10px 10px", fontWeight: 900, fontSize: 14, color: "#86198f" }}>
                              TOTAL LIABILITAS & EKUITAS (PASSIVA)
                            </td>
                            <td style={{ textAlign: "right", padding: "10px 10px 10px 0", fontWeight: 900, fontSize: 15, color: "#86198f", fontFamily: "monospace" }}>
                              Rp{totalPassiva.toLocaleString("id-ID")}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </>
            );
          })()}
          </>
          )}
        </div>
      )}

      {/* ── TAB BUKU BESAR (GENERAL LEDGER) ───────────────────────────── */}
      {activeTab === "ledger" && (
        <div>
          {/* Filter Toolbar: COA Selector & Periode Waktu */}
          <div
            style={{
              background: "white",
              borderRadius: 14,
              padding: "16px 20px",
              border: "1px solid #e5e7eb",
              marginBottom: 20,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 320px" }}>
                <BookOpen size={18} color="#5005A6" />
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 3 }}>
                    Pilih Akun Buku Besar (COA):
                  </label>
                  <SearchableSelect
                    options={(coaListAll.length > 0 ? coaListAll : coaList).map((c) => ({
                      value: c.id,
                      label: `[${c.kode_akun}] ${c.nama_akun}`,
                      category: `${c.kelompok} - ${c.sub_kelompok || ""}`,
                    }))}
                    value={ledgerCoaId}
                    onChange={(val) => {
                      const cid = val ? Number(val) : "";
                      setLedgerCoaId(cid);
                      setLedgerPage(1);
                      if (cid) fetchLedgerData(cid, 1, ledgerLimit, ledgerDateFrom, ledgerDateTo);
                    }}
                    placeholder="-- Ketik / Pilih Akun COA --"
                  />
                </div>
              </div>

              {/* Action Buttons: Refresh, Export Excel, Print PDF */}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => fetchLedgerData(ledgerCoaId, ledgerPage, ledgerLimit, ledgerDateFrom, ledgerDateTo)}
                  style={{
                    padding: "7px 12px",
                    background: "#f9fafb",
                    color: "#374151",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                  title="Muat ulang data buku besar"
                >
                  <RefreshCw size={13} className={ledgerLoading ? "animate-spin" : ""} /> Refresh
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!ledgerData?.entries || ledgerData.entries.length === 0) {
                      toast.error("Tidak ada data transaksi untuk diexport");
                      return;
                    }
                    const exportRows = ledgerData.entries.map((it: any) => ({
                      Tanggal: it.journal_date ? new Date(it.journal_date).toLocaleDateString("id-ID") : "-",
                      No_Ref: it.ref_no || "-",
                      Tipe: it.ref_type || "-",
                      Keterangan: it.keterangan || "-",
                      Akun_Lawan: it.akun_lawan || "-",
                      Debit: Number(it.debit || 0),
                      Kredit: Number(it.kredit || 0),
                    }));
                    const ws = XLSX.utils.json_to_sheet(exportRows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Buku_Besar");
                    XLSX.writeFile(wb, `Buku_Besar_${ledgerData.account?.kode_akun || "ledger"}_${ledgerDateFrom || "all"}.xlsx`);
                  }}
                  style={{
                    padding: "7px 12px",
                    background: "#f0fdf4",
                    color: "#15803d",
                    border: "1px solid #bbf7d0",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                  title="Export data buku besar ke Excel (.xlsx)"
                >
                  <FileSpreadsheet size={14} /> Export Excel
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    padding: "7px 14px",
                    background: "#5005A6",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    boxShadow: "0 2px 6px rgba(80, 5, 166, 0.2)",
                  }}
                  title="Cetak Buku Besar"
                >
                  <Printer size={14} /> Cetak PDF
                </button>
              </div>
            </div>

            {/* Filter Rentang Tanggal Toolbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, paddingTop: 10, borderTop: "1px solid #f3f4f6" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#4b5563" }}>Rentang Waktu:</span>
                <div style={{ background: "#f3f4f6", padding: 3, borderRadius: 8, display: "flex", gap: 3, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => handleLedgerShortcutChange("today")}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: "none",
                      background: ledgerPreset === "today" ? "#5005A6" : "transparent",
                      color: ledgerPreset === "today" ? "white" : "#4b5563",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLedgerShortcutChange("yesterday")}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: "none",
                      background: ledgerPreset === "yesterday" ? "#5005A6" : "transparent",
                      color: ledgerPreset === "yesterday" ? "white" : "#4b5563",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Kemarin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLedgerShortcutChange("this_month")}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: "none",
                      background: ledgerPreset === "this_month" ? "#5005A6" : "transparent",
                      color: ledgerPreset === "this_month" ? "white" : "#4b5563",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Bulan Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLedgerShortcutChange("last_month")}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: "none",
                      background: ledgerPreset === "last_month" ? "#5005A6" : "transparent",
                      color: ledgerPreset === "last_month" ? "white" : "#4b5563",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Bulan Lalu
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLedgerShortcutChange("this_year")}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: "none",
                      background: ledgerPreset === "this_year" ? "#5005A6" : "transparent",
                      color: ledgerPreset === "this_year" ? "white" : "#4b5563",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Tahun Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLedgerShortcutChange("all")}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: "none",
                      background: ledgerPreset === "all" ? "#5005A6" : "transparent",
                      color: ledgerPreset === "all" ? "white" : "#4b5563",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Semua Waktu
                  </button>
                </div>
              </div>

              {/* Custom Date Range Inputs */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f9fafb", padding: "4px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}>
                <input
                  type="date"
                  value={ledgerDateFrom}
                  onChange={(e) => {
                    setLedgerDateFrom(e.target.value);
                    setLedgerPreset("custom");
                  }}
                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12, outline: "none" }}
                />
                <span style={{ fontSize: 12, color: "#6b7280" }}>s/d</span>
                <input
                  type="date"
                  value={ledgerDateTo}
                  onChange={(e) => {
                    setLedgerDateTo(e.target.value);
                    setLedgerPreset("custom");
                  }}
                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12, outline: "none" }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setLedgerPage(1);
                    if (ledgerCoaId) fetchLedgerData(ledgerCoaId, 1, ledgerLimit, ledgerDateFrom, ledgerDateTo);
                  }}
                  style={{ padding: "4px 10px", background: "#5005A6", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>

          {/* Ledger Cards & Table Display */}
          {ledgerLoading ? (
            <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e7eb", padding: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <RefreshCw size={36} className="animate-spin" style={{ color: "#5005A6", marginBottom: 16 }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Memuat Buku Besar Akun...</p>
              <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Menghitung saldo awal, mutasi debit/kredit, dan saldo akhir akun</p>
            </div>
          ) : !ledgerCoaId ? (
            <div style={{ background: "white", borderRadius: 14, border: "1px dashed #d1d5db", padding: 48, textAlign: "center", color: "#6b7280" }}>
              <BookOpen size={42} style={{ margin: "0 auto 12px", color: "#9ca3af" }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>Silakan Pilih Akun COA di Atas</div>
              <p style={{ fontSize: 13, marginTop: 4 }}>Pilih akun untuk menampilkan buku besar, rincian mutasi, dan saldo kumulatifnya.</p>
            </div>
          ) : (
            <div>
              {/* Summary Scorecards: Saldo Awal, Total Debit, Total Kredit, Saldo Akhir */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 20 }}>
                <div style={{ background: "white", borderRadius: 12, padding: "16px 20px", border: "1px solid #e5e7eb" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Saldo Awal (Sebelum Periode)</span>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#1f2937", marginTop: 4, fontFamily: "monospace" }}>
                    Rp{Number(ledgerData?.initial_balance || 0).toLocaleString("id-ID")}
                  </div>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>Normal: {ledgerData?.account?.kelompok === "Aset" || ledgerData?.account?.kelompok === "Beban" ? "Debit" : "Kredit"}</span>
                </div>

                <div style={{ background: "white", borderRadius: 12, padding: "16px 20px", border: "1px solid #e5e7eb" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" }}>Total Mutasi Debit</span>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#1e40af", marginTop: 4, fontFamily: "monospace" }}>
                    Rp{Number(ledgerData?.total_debit || 0).toLocaleString("id-ID")}
                  </div>
                  <span style={{ fontSize: 11, color: "#60a5fa" }}>Periode yang dipilih</span>
                </div>

                <div style={{ background: "white", borderRadius: 12, padding: "16px 20px", border: "1px solid #e5e7eb" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#b45309", textTransform: "uppercase" }}>Total Mutasi Kredit</span>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#b45309", marginTop: 4, fontFamily: "monospace" }}>
                    Rp{Number(ledgerData?.total_kredit || 0).toLocaleString("id-ID")}
                  </div>
                  <span style={{ fontSize: 11, color: "#fbbf24" }}>Periode yang dipilih</span>
                </div>

                <div style={{ background: "#faf5ff", borderRadius: 12, padding: "16px 20px", border: "1.5px solid #d8b4fe" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#5005A6", textTransform: "uppercase" }}>Saldo Akhir (Per Penutupan)</span>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#5005A6", marginTop: 4, fontFamily: "monospace" }}>
                    Rp{Number(ledgerData?.ending_balance || 0).toLocaleString("id-ID")}
                  </div>
                  <span style={{ fontSize: 11, color: "#7e22ce", fontWeight: 600 }}>Saldo Awal + Net Pergerakan</span>
                </div>
              </div>

              {/* Table Entries */}
              <div style={{ background: "white", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: 0 }}>
                      Buku Besar: [{ledgerData?.account?.kode_akun}] {ledgerData?.account?.nama_akun}
                    </h3>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
                      Kelompok: {ledgerData?.account?.kelompok} &bull; Sub: {ledgerData?.account?.sub_kelompok} &bull; Total: {ledgerData?.total || 0} Baris Jurnal
                    </p>
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>
                        <th style={{ padding: "10px 14px", textAlign: "left" }}>TANGGAL</th>
                        <th style={{ padding: "10px 14px", textAlign: "left" }}>NO. REF / TIPE</th>
                        <th style={{ padding: "10px 14px", textAlign: "left" }}>KETERANGAN</th>
                        <th style={{ padding: "10px 14px", textAlign: "left" }}>AKUN LAWAN</th>
                        <th style={{ padding: "10px 14px", textAlign: "right" }}>DEBIT (RP)</th>
                        <th style={{ padding: "10px 14px", textAlign: "right" }}>KREDIT (RP)</th>
                        <th style={{ padding: "10px 14px", textAlign: "center" }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Baris Saldo Awal */}
                      <tr style={{ background: "#f8fafc", fontWeight: 700, borderBottom: "1px dashed #e2e8f0" }}>
                        <td style={{ padding: "10px 14px", color: "#64748b" }}>{ledgerDateFrom ? formatDate(ledgerDateFrom) : "-"}</td>
                        <td style={{ padding: "10px 14px", color: "#64748b" }}>-</td>
                        <td style={{ padding: "10px 14px", color: "#0f172a" }}>[SALDO AWAL SEBELUM PERIODE]</td>
                        <td style={{ padding: "10px 14px", color: "#64748b" }}>-</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "monospace" }}>-</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "monospace" }}>-</td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#e2e8f0", color: "#475569" }}>
                            Saldo Awal: Rp{Number(ledgerData?.initial_balance || 0).toLocaleString("id-ID")}
                          </span>
                        </td>
                      </tr>

                      {(!ledgerData?.entries || ledgerData.entries.length === 0) ? (
                        <tr>
                          <td colSpan={7} style={{ padding: "36px 14px", textAlign: "center", color: "#9ca3af" }}>
                            Tidak ada transaksi mutasi buku besar pada rentang tanggal ini.
                          </td>
                        </tr>
                      ) : (
                        ledgerData.entries.map((item: any, idx: number) => {
                          const isDebit = Number(item.debit || 0) > 0;
                          return (
                            <tr
                              key={item.id || idx}
                              style={{ borderBottom: "1px solid #f1f5f9" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                                {item.journal_date ? formatDate(item.journal_date) : "-"}
                              </td>
                              <td style={{ padding: "10px 14px" }}>
                                <div style={{ fontWeight: 700, color: "#1e3a8a", fontFamily: "monospace" }}>{item.ref_no || "-"}</div>
                                <span style={{ fontSize: 11, color: "#6b7280" }}>{item.ref_type || "Jurnal"}</span>
                              </td>
                              <td style={{ padding: "10px 14px", maxWidth: 280 }}>
                                <div style={{ color: "#1f2937" }}>{item.keterangan || "-"}</div>
                              </td>
                              <td style={{ padding: "10px 14px", color: "#4b5563" }}>
                                {item.akun_lawan ? (
                                  <span style={{ background: "#f3f4f6", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>
                                    {item.akun_lawan}
                                  </span>
                                ) : "-"}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "monospace", fontWeight: isDebit ? 700 : 400, color: isDebit ? "#1e40af" : "#94a3b8" }}>
                                {isDebit ? Number(item.debit).toLocaleString("id-ID") : "-"}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "monospace", fontWeight: !isDebit ? 700 : 400, color: !isDebit ? "#b45309" : "#94a3b8" }}>
                                {!isDebit ? Number(item.kredit).toLocaleString("id-ID") : "-"}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                <span
                                  style={{
                                    fontSize: 11,
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    fontWeight: 700,
                                    background: item.status === "dibatalkan" ? "#fee2e2" : "#dcfce7",
                                    color: item.status === "dibatalkan" ? "#dc2626" : "#16a34a",
                                  }}
                                >
                                  {item.status || "posted"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Ledger Pagination */}
                {ledgerData && ledgerData.total > 0 && (
                  <div style={{ padding: "12px 18px", borderTop: "1px solid #e5e7eb" }}>
                    <Pagination
                      page={ledgerPage}
                      totalPages={ledgerData.totalPages || Math.ceil(ledgerData.total / ledgerLimit) || 1}
                      total={ledgerData.total}
                      limit={ledgerLimit}
                      onChange={(p: number) => {
                        setLedgerPage(p);
                        if (ledgerCoaId) fetchLedgerData(ledgerCoaId, p, ledgerLimit, ledgerDateFrom, ledgerDateTo);
                      }}
                      onLimitChange={(l: number) => {
                        setLedgerLimit(l);
                        setLedgerPage(1);
                        if (ledgerCoaId) fetchLedgerData(ledgerCoaId, 1, l, ledgerDateFrom, ledgerDateTo);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
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
      {/* MODAL TAMBAH / EDIT REKENING KAS & BANK DENGAN PILIHAN COA DINAMIS */}
      {isAccountModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, maxWidth: 500, width: "100%", padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
                {editingAccountId ? "✏️ Edit Rekening Kas / Bank" : "➕ Tambah Rekening Kas / Bank Baru"}
              </h3>
              <button onClick={() => setIsAccountModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitAccount}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Nama Rekening / Akun *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Bank BCA SS, Bank BSI Operasional, Kas Kasir 1"
                  value={accFormNama}
                  onChange={(e) => setAccFormNama(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Jenis Rekening *
                  </label>
                  <select
                    value={accFormJenis}
                    onChange={(e) => setAccFormJenis(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                  >
                    <option value="Bank">Bank (Rekening Transfer/QRIS)</option>
                    <option value="Kas">Kas (Uang Tunai/Cash Drawer)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Nama Bank / Vendor
                  </label>
                  <input
                    type="text"
                    placeholder="BCA, Mandiri, BSI, CIMB..."
                    value={accFormNamaBank}
                    onChange={(e) => setAccFormNamaBank(e.target.value)}
                    disabled={accFormJenis === "Kas"}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, background: accFormJenis === "Kas" ? "#f3f4f6" : "white" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Nomor Rekening
                </label>
                <input
                  type="text"
                  placeholder={accFormJenis === "Kas" ? "Tidak diperlukan untuk Kas" : "Nomor rekening bank..."}
                  value={accFormNoRek}
                  onChange={(e) => setAccFormNoRek(e.target.value)}
                  disabled={accFormJenis === "Kas"}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, background: accFormJenis === "Kas" ? "#f3f4f6" : "white" }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#5005A6", marginBottom: 4 }}>
                  🔗 Hubungkan ke Akun Buku Besar CoA * (Penting untuk Jurnal)
                </label>
                {(() => {
                  const master = coaListAll.length > 0 ? coaListAll : coaList;
                  const asetLancarCoas = master.filter((c: any) =>
                    c.kelompok === "Aset" && (c.sub_kelompok === "Aset Lancar" || c.kode_akun?.startsWith("1-0") || c.kode_akun?.startsWith("1-1"))
                  );
                  const listToRender = asetLancarCoas.length > 0 ? asetLancarCoas : master;
                  return (
                    <SearchableSelect
                      options={listToRender.map((c: any) => ({
                        value: c.id,
                        label: `(${c.kode_akun}) ${c.nama_akun}`,
                        category: c.sub_kelompok || c.kelompok,
                      }))}
                      value={accFormCoaId}
                      onChange={(val) => setAccFormCoaId(val ? Number(val) : "")}
                      placeholder="-- Pilih Akun CoA Aset Lancar / Kas & Bank --"
                    />
                  );
                })()}
                <span style={{ fontSize: 11, color: "#6b7280", marginTop: 4, display: "block" }}>
                  Semua transaksi masuk/keluar dari rekening ini akan otomatis dibukukan ke akun CoA yang dipilih.
                </span>
              </div>

              {!editingAccountId && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Saldo Awal (Rp)
                  </label>
                  <input
                    type="number"
                    value={accFormSaldoAwal || ""}
                    onChange={(e) => setAccFormSaldoAwal(Number(e.target.value) || 0)}
                    placeholder="0"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                  />
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={accFormIsDefault}
                    onChange={(e) => setAccFormIsDefault(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  Gunakan sebagai rekening pembayaran default untuk Order Siap Saji
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", cursor: "pointer", fontSize: 13 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#5005A6", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                >
                  {isSubmitting ? "Menyimpan..." : (editingAccountId ? "Simpan Perubahan" : "Tambah Rekening")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KAS MASUK / KAS KELUAR (REQ 4 & SCREENSHOT 4) */}
      {isKasMutasiModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, maxWidth: 500, width: "100%", padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: kasMutasiJenis === "Masuk" ? "#166534" : "#991b1b", margin: 0 }}>
                {kasMutasiJenis === "Masuk" ? "📥 Transaksi Kas Masuk" : "📤 Transaksi Kas Keluar (Prive Owner / Lainnya)"}
              </h3>
              <button onClick={() => setIsKasMutasiModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitKasMutasi}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Rekening Kas / Bank *
                </label>
                <SearchableSelect
                  options={accounts.map((acc) => ({
                    value: acc.id,
                    label: `${acc.nama_bank || acc.nama_rekening} (Rp ${Number(acc.saldo_saat_ini || acc.saldo_kini || 0).toLocaleString("id-ID")})`,
                    category: "Kas/Bank",
                  }))}
                  value={kasMutasiBankId}
                  onChange={(val) => setKasMutasiBankId(val ? Number(val) : "")}
                  placeholder="-- Ketik / Pilih Rekening Kas/Bank --"
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Tanggal Transaksi *
                </label>
                <input
                  type="date"
                  value={kasMutasiDate}
                  onChange={(e) => setKasMutasiDate(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Akun Lawan COA ({kasMutasiJenis === "Keluar" ? "Debet" : "Kredit"}) *
                </label>
                <SearchableSelect
                  options={(coaListAll.length > 0 ? coaListAll : coaList).map((c) => ({
                    value: c.id,
                    label: `(${c.kode_akun}) ${c.nama_akun}`,
                    category: c.sub_kelompok || c.kelompok,
                  }))}
                  value={kasMutasiCoaId}
                  onChange={(val) => setKasMutasiCoaId(val ? Number(val) : "")}
                  placeholder="-- Ketik / Pilih Akun Lawan COA --"
                />
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                  {kasMutasiJenis === "Keluar"
                    ? "✓ Jurnal Otomatis: Debet [Akun Lawan], Kredit [Kas/Bank]"
                    : "✓ Jurnal Otomatis: Debet [Kas/Bank], Kredit [Akun Lawan]"}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Nominal (Rp) *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 500.000"
                  value={formatThousand(kasMutasiNominal)}
                  onChange={(e) => setKasMutasiNominal(parseThousand(e.target.value))}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontWeight: 700 }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Keterangan Transaksi *
                </label>
                <input
                  type="text"
                  placeholder={kasMutasiJenis === "Keluar" ? "Pengambilan prive owner..." : "Setoran modal owner..."}
                  value={kasMutasiKeterangan}
                  onChange={(e) => setKasMutasiKeterangan(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setIsKasMutasiModalOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}>
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: kasMutasiJenis === "Masuk" ? "#639922" : "#E24B4A",
                    color: "white",
                    fontWeight: 700,
                  }}
                >
                  {isSubmitting ? "Menyimpan..." : `Simpan Kas ${kasMutasiJenis}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL JURNAL UMUM MANUAL (REQ 5 & SCREENSHOT 5) */}
      {isJournalModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, maxWidth: 550, width: "100%", padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <BookOpen size={18} color="#5005A6" /> {editingJournalId ? "Edit Jurnal Umum Manual" : "+ Input Jurnal Umum Manual"}
              </h3>
              <button onClick={() => { setIsJournalModalOpen(false); setEditingJournalId(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitManualJournal}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Tanggal Jurnal *
                  </label>
                  <input
                    type="date"
                    value={jouFormDate}
                    onChange={(e) => setJouFormDate(e.target.value)}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    No. Referensi / Bukti
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: JU-2026-001"
                    value={jouFormRefNo}
                    onChange={(e) => setJouFormRefNo(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#15803d", marginBottom: 4 }}>
                  Pilih Akun Debet *
                </label>
                <SearchableSelect
                  options={(coaListAll.length > 0 ? coaListAll : coaList).map((c) => ({
                    value: c.id,
                    label: `(${c.kode_akun}) ${c.nama_akun}`,
                    category: c.sub_kelompok || c.kelompok,
                    color: "#15803d",
                  }))}
                  value={jouFormDebitCoaId}
                  onChange={(val) => setJouFormDebitCoaId(val ? Number(val) : "")}
                  placeholder="-- Ketik / Cari Akun Debet --"
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#b91c1c", marginBottom: 4 }}>
                  Pilih Akun Kredit *
                </label>
                <SearchableSelect
                  options={(coaListAll.length > 0 ? coaListAll : coaList).map((c) => ({
                    value: c.id,
                    label: `(${c.kode_akun}) ${c.nama_akun}`,
                    category: c.sub_kelompok || c.kelompok,
                    color: "#b91c1c",
                  }))}
                  value={jouFormCreditCoaId}
                  onChange={(val) => setJouFormCreditCoaId(val ? Number(val) : "")}
                  placeholder="-- Ketik / Cari Akun Kredit --"
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Nominal (Rp) *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 500.000"
                  value={formatThousand(jouFormNominal)}
                  onChange={(e) => setJouFormNominal(parseThousand(e.target.value))}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontWeight: 700 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Keterangan Jurnal *
                </label>
                <input
                  type="text"
                  placeholder="Deskripsi transaksi jurnal umum..."
                  value={jouFormKeterangan}
                  onChange={(e) => setJouFormKeterangan(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              {/* Status Validasi Keseimbangan Double-Entry */}
              <div style={{
                marginBottom: 20,
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 12.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: (!jouFormDebitCoaId || !jouFormCreditCoaId || jouFormDebitCoaId === jouFormCreditCoaId || !jouFormNominal || jouFormNominal <= 0)
                  ? "#fef2f2"
                  : "#f0fdf4",
                border: (!jouFormDebitCoaId || !jouFormCreditCoaId || jouFormDebitCoaId === jouFormCreditCoaId || !jouFormNominal || jouFormNominal <= 0)
                  ? "1px solid #fecaca"
                  : "1px solid #bbf7d0",
                color: (!jouFormDebitCoaId || !jouFormCreditCoaId || jouFormDebitCoaId === jouFormCreditCoaId || !jouFormNominal || jouFormNominal <= 0)
                  ? "#991b1b"
                  : "#166534",
              }}>
                <div>
                  <strong>Aturan Double-Entry:</strong>{" "}
                  {!jouFormDebitCoaId || !jouFormCreditCoaId
                    ? "Akun Debet & Kredit harus dipilih keduanya."
                    : jouFormDebitCoaId === jouFormCreditCoaId
                    ? "Akun Debet dan Kredit tidak boleh sama."
                    : !jouFormNominal || jouFormNominal <= 0
                    ? "Nominal harus lebih dari Rp 0."
                    : `Debet (Rp ${jouFormNominal.toLocaleString("id-ID")}) = Kredit (Rp ${jouFormNominal.toLocaleString("id-ID")})`}
                </div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: 4,
                  background: (!jouFormDebitCoaId || !jouFormCreditCoaId || jouFormDebitCoaId === jouFormCreditCoaId || !jouFormNominal || jouFormNominal <= 0) ? "#fee2e2" : "#dcfce7",
                }}>
                  {(!jouFormDebitCoaId || !jouFormCreditCoaId || jouFormDebitCoaId === jouFormCreditCoaId || !jouFormNominal || jouFormNominal <= 0) ? "BELUM VALID" : "SEIMBANG (BALANCED)"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setIsJournalModalOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}>
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5005A6", color: "white", fontWeight: 700 }}>
                  {isSubmitting ? "Menyimpan..." : editingJournalId ? "Simpan Perubahan" : "Simpan Jurnal Umum"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: PEMBATALAN JURNAL UMUM ────────────────────────── */}
      {cancelJournalTarget && (
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
          <div style={{ background: "white", borderRadius: 16, maxWidth: 460, width: "100%", padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#dc2626", margin: 0 }}>
                  Batalkan Jurnal Umum
                </h3>
                <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
                  Ref: <strong style={{ color: "#111827", fontFamily: "monospace" }}>{cancelJournalTarget.ref_no || `JRNL-${cancelJournalTarget.id}`}</strong> ({formatDate(cancelJournalTarget.journal_date)})
                </p>
              </div>
              <button
                onClick={() => setCancelJournalTarget(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#991b1b" }}>
              ⚠️ Mutasi Kas/Bank yang terkait dengan jurnal ini akan dibatalkan dan saldo rekening akan dikembalikan otomatis.
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                Alasan Pembatalan (Wajib diisi) *
              </label>
              <textarea
                rows={3}
                placeholder="Contoh: Salah input akun beban/debit, transaksi dibatalkan oleh pihak terkait..."
                value={cancelJournalReason}
                onChange={(e) => setCancelJournalReason(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setCancelJournalTarget(null)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", fontSize: 14, cursor: "pointer" }}
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelJournal}
                disabled={isSubmittingCancelJournal}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#dc2626",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isSubmittingCancelJournal ? "Memproses..." : "Konfirmasi Pembatalan"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── MODAL SHARED: DETAIL TRANSAKSI (HPP & BIAYA) ────────────── */}
      {detailModalItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, maxWidth: 540, width: "100%", padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid #e5e7eb", paddingBottom: 12 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={18} color="#5005A6" /> Detail {detailModalItem.type === "purchase" ? "Nota Pembelian HPP" : "Biaya Operasional"}
              </h3>
              <button onClick={() => setDetailModalItem(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16, fontSize: 13 }}>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: 11 }}>Tanggal Transaksi:</span>
                <span style={{ fontWeight: 700, color: "#111827" }}>
                  {formatDate(detailModalItem.type === "purchase" ? detailModalItem.data.purchase_date : detailModalItem.data.journal_date)}
                </span>
              </div>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: 11 }}>Nomor Ref / ID:</span>
                <span style={{ fontWeight: 700, fontFamily: "monospace", color: "#5005A6" }}>
                  {detailModalItem.type === "purchase" ? (detailModalItem.data.nota_ref || `NOTA-${detailModalItem.data.id}`) : (detailModalItem.data.ref_no || `EXP-${detailModalItem.data.id}`)}
                </span>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <span style={{ color: "#6b7280", display: "block", fontSize: 11 }}>Keterangan:</span>
                <span style={{ fontWeight: 600, color: "#111827" }}>
                  {(detailModalItem.data.keterangan || "-").replace(/^Biaya Operasional \([^)]+\):\s*/i, "")}
                </span>
              </div>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: 11 }}>Akun Beban / CoA:</span>
                <span style={{ fontWeight: 600, color: "#374151" }}>
                  {detailModalItem.type === "purchase"
                    ? `${detailModalItem.data.coa_kode || ""} ${detailModalItem.data.coa_nama || "-"}`
                    : `(${detailModalItem.data.beban_kode || ""}) ${detailModalItem.data.beban_nama || "-"}`}
                </span>
              </div>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: 11 }}>Rekening Sumber / Metode:</span>
                <span style={{ fontWeight: 600, color: "#374151" }}>
                  {detailModalItem.type === "purchase"
                    ? (detailModalItem.data.kas_bank_nama || "Hutang Usaha")
                    : (detailModalItem.data.kredit_nama || "Hutang Usaha")}
                </span>
              </div>
            </div>

            {/* Rincian Finansial Card */}
            {(() => {
              const modalDibayar = Number(detailModalItem.data.dibayar || (detailModalItem.data.status_pembayaran === "Lunas" ? (detailModalItem.type === "purchase" ? detailModalItem.data.total_amount : detailModalItem.data.nominal) : 0));
              const modalSisa = Number(detailModalItem.data.sisa_hutang || 0);
              const modalTotal = detailModalItem.type === "purchase"
                ? Number(detailModalItem.data.total_amount || 0)
                : ((modalDibayar + modalSisa) > 0 ? (modalDibayar + modalSisa) : Number(detailModalItem.data.nominal || 0));

              return (
                <div style={{ background: "#f8fafc", borderRadius: 12, padding: 14, border: "1px solid #e2e8f0", marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: "#64748b" }}>Total Nilai Biaya / Hutang:</span>
                    <strong style={{ color: "#111827", fontFamily: "monospace", fontSize: 14 }}>
                      Rp {modalTotal.toLocaleString("id-ID")}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: "#16a34a" }}>- Sudah Dibayar (DP / Cicilan):</span>
                    <strong style={{ color: "#16a34a", fontFamily: "monospace" }}>
                      Rp {modalDibayar.toLocaleString("id-ID")}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px dashed #cbd5e1", fontSize: 14 }}>
                    <span style={{ fontWeight: 700, color: "#334155" }}>Sisa Hutang:</span>
                    <strong style={{ color: modalSisa > 0 ? "#E24B4A" : "#64748b", fontFamily: "monospace", fontSize: 15 }}>
                      Rp {modalSisa.toLocaleString("id-ID")}
                    </strong>
                  </div>
                </div>
              );
            })()}

            {/* Status Info */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Status Pembayaran:</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  padding: "3px 10px",
                  borderRadius: 6,
                  background: (detailModalItem.data.status === "Dibatalkan" || detailModalItem.data.status === "dibatalkan" || detailModalItem.data.status_pembayaran === "Dibatalkan")
                    ? "#fee2e2"
                    : detailModalItem.data.status_pembayaran === "Lunas"
                    ? "#f0fdf4"
                    : "#fef3c7",
                  color: (detailModalItem.data.status === "Dibatalkan" || detailModalItem.data.status === "dibatalkan" || detailModalItem.data.status_pembayaran === "Dibatalkan")
                    ? "#991b1b"
                    : detailModalItem.data.status_pembayaran === "Lunas"
                    ? "#15803d"
                    : "#b45309",
                }}
              >
                {(detailModalItem.data.status === "Dibatalkan" || detailModalItem.data.status === "dibatalkan" || detailModalItem.data.status_pembayaran === "Dibatalkan")
                  ? "Dibatalkan"
                  : (detailModalItem.data.status_pembayaran || "Lunas")}
              </span>
            </div>

            {/* Riwayat Pembayaran / Cicilan */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                  <Receipt size={15} color="#5005A6" /> Riwayat Pembayaran / Cicilan:
                </span>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {(detailModalItem.data.cicilan_history && detailModalItem.data.cicilan_history.length > 0)
                    ? `${detailModalItem.data.cicilan_history.length} Kali Pembayaran`
                    : "Belum Ada Pembayaran"}
                </span>
              </div>

              {detailModalItem.data.cicilan_history && detailModalItem.data.cicilan_history.length > 0 ? (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", background: "#fafafa" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>
                        <th style={{ padding: "8px 10px", width: 35 }}>No</th>
                        <th style={{ padding: "8px 10px" }}>Tanggal</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>Nominal</th>
                        <th style={{ padding: "8px 10px" }}>Rekening / Bank</th>
                        <th style={{ padding: "8px 10px" }}>Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailModalItem.data.cicilan_history.map((c: any, cIdx: number) => (
                        <tr key={c.id || cIdx} style={{ borderBottom: "1px solid #f1f5f9", background: "white" }}>
                          <td style={{ padding: "8px 10px", color: "#64748b" }}>{cIdx + 1}</td>
                          <td style={{ padding: "8px 10px", fontWeight: 600, color: "#334155" }}>{formatDate(c.tanggal)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#16a34a" }}>
                            Rp {Number(c.nominal || 0).toLocaleString("id-ID")}
                          </td>
                          <td style={{ padding: "8px 10px", color: "#475569" }}>
                            {c.rekening || c.bank || "-"}
                          </td>
                          <td style={{ padding: "8px 10px", color: "#64748b", fontSize: 11, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.keterangan || ""}>
                            {c.keterangan || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: "12px 14px", background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 8, textAlign: "center", color: "#64748b", fontSize: 12 }}>
                  {Number(detailModalItem.data.dibayar || 0) === 0 ? (
                    <span>Transaksi ini berstatus <strong>Tempo / Belum Dibayar (Rp 0)</strong>. Belum ada pembayaran dicatat.</span>
                  ) : (
                    <span>Belum ada rincian mutasi cicilan. Pembayaran dilakukan lunas saat pembuatan awal.</span>
                  )}
                </div>
              )}
            </div>

            {(detailModalItem.data.cancel_reason) && (
              <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#991b1b" }}>
                <strong>Alasan Pembatalan:</strong> &ldquo;{detailModalItem.data.cancel_reason}&rdquo;
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", fontSize: 14, cursor: "pointer", fontWeight: 600 }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SHARED: BAYAR CICILAN / PELUNASAN HUTANG ───────────── */}
      {payDebtModalItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, maxWidth: 480, width: "100%", padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <DollarSign size={18} color="#639922" /> Bayar Cicilan / Pelunasan Hutang
              </h3>
              <button onClick={() => setPayDebtModalItem(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#166534" }}>
              <div>Transaksi: <strong>{payDebtModalItem.type === "purchase" ? (payDebtModalItem.data.nota_ref || `NOTA-${payDebtModalItem.data.id}`) : `EXP-${payDebtModalItem.data.id}`}</strong></div>
              <div style={{ fontSize: 12, marginTop: 2 }}>{payDebtModalItem.data.keterangan}</div>
              <div style={{ marginTop: 6, fontWeight: 700, fontSize: 13 }}>
                Sisa Hutang Saat Ini: Rp {Number(payDebtModalItem.data.sisa_hutang || (payDebtModalItem.type === "purchase" ? payDebtModalItem.data.total_amount : payDebtModalItem.data.nominal)).toLocaleString("id-ID")}
              </div>
            </div>

            <form onSubmit={handleSubmitPayDebt}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Tanggal Pembayaran *
                </label>
                <input
                  type="date"
                  value={payDebtDate}
                  onChange={(e) => setPayDebtDate(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Rekening Kas/Bank Pembayaran *
                </label>
                <SearchableSelect
                  options={accounts.map((a) => ({
                    value: a.id,
                    label: `${a.nama_rekening || a.nama_bank} (Saldo: Rp${Number(a.saldo_kini || a.saldo_saat_ini || 0).toLocaleString("id-ID")})`,
                    category: "Kas/Bank",
                  }))}
                  value={payDebtKasBankId}
                  onChange={(val) => setPayDebtKasBankId(val ? Number(val) : "")}
                  placeholder="-- Ketik / Pilih Rekening Kas/Bank --"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Nominal Pembayaran (Rp) *
                </label>
                <input
                  type="text"
                  value={formatThousand(payDebtNominal)}
                  onChange={(e) => {
                    const maxSisa = Number(payDebtModalItem.data.sisa_hutang || (payDebtModalItem.type === "purchase" ? payDebtModalItem.data.total_amount : payDebtModalItem.data.nominal));
                    setPayDebtNominal(Math.min(maxSisa, parseThousand(e.target.value)));
                  }}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, fontWeight: 700, textAlign: "right" }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Catatan / Keterangan Pembayaran
                </label>
                <input
                  type="text"
                  placeholder="Cicilan ke-2, Pelunasan nota, transfer via BCA..."
                  value={payDebtKeterangan}
                  onChange={(e) => setPayDebtKeterangan(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setPayDebtModalItem(null)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", cursor: "pointer" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayDebt}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#639922", color: "white", fontWeight: 700, cursor: "pointer" }}
                >
                  {isSubmittingPayDebt ? "Menyimpan..." : "Catat Pembayaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: BULK BAYAR HUTANG HPP (MASSAL) ────────────────────── */}
      {isBulkPayModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, maxWidth: 520, width: "100%", padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <DollarSign size={20} color="#639922" /> Bulk Bayar / Pelunasan Hutang HPP
              </h3>
              <button onClick={() => setIsBulkPayModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <X size={20} />
              </button>
            </div>

            {(() => {
              const selectedItems = purchases.filter((p) => selectedPurIds.includes(p.id) && Number(p.sisa_hutang || 0) > 0);
              const totalHutangSelected = selectedItems.reduce((acc, p) => acc + Number(p.sisa_hutang || 0), 0);

              return (
                <form onSubmit={handleSubmitBulkPay}>
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "#166534", fontWeight: 600 }}>Jumlah Nota Dipilih:</span>
                      <strong style={{ fontSize: 14, color: "#166534" }}>{selectedItems.length} Nota</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 6, borderTop: "1px dashed #bbf7d0" }}>
                      <span style={{ fontSize: 13, color: "#166534", fontWeight: 700 }}>Total Pembayaran Pelunasan:</span>
                      <strong style={{ fontSize: 18, color: "#15803d", fontFamily: "monospace", fontWeight: 900 }}>
                        Rp {totalHutangSelected.toLocaleString("id-ID")}
                      </strong>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                      Tanggal Pembayaran *
                    </label>
                    <input
                      type="date"
                      value={bulkPayDate}
                      onChange={(e) => setBulkPayDate(e.target.value)}
                      required
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                      Rekening Kas/Bank Pembayaran *
                    </label>
                    <SearchableSelect
                      options={accounts.map((a) => ({
                        value: a.id,
                        label: `${a.nama_rekening || a.nama_bank} (Saldo: Rp${Number(a.saldo_kini || a.saldo_saat_ini || 0).toLocaleString("id-ID")})`,
                        category: "Kas/Bank",
                      }))}
                      value={bulkPayKasBankId}
                      onChange={(val) => setBulkPayKasBankId(val ? Number(val) : "")}
                      placeholder="-- Pilih Rekening Kas/Bank --"
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                      Catatan / Keterangan Bulk Bayar
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Pembayaran dadan sayur 10 nota..."
                      value={bulkPayKeterangan}
                      onChange={(e) => setBulkPayKeterangan(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                    />
                  </div>

                  <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, marginBottom: 16, background: "#fafafa" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                      Rincian Nota Yang Akan Dilunasi:
                    </div>
                    {selectedItems.map((item, i) => (
                      <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: i < selectedItems.length - 1 ? "1px dashed #e5e7eb" : "none" }}>
                        <span style={{ color: "#374151" }}>
                          <strong>{item.nota_ref || `NOTA-${item.id}`}</strong> - {item.keterangan}
                        </span>
                        <span style={{ fontWeight: 700, color: "#b91c1c", fontFamily: "monospace" }}>
                          Rp {Number(item.sisa_hutang || 0).toLocaleString("id-ID")}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setIsBulkPayModalOpen(false)}
                      style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", cursor: "pointer" }}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingBulkPay || totalHutangSelected <= 0}
                      style={{
                        padding: "8px 20px",
                        borderRadius: 8,
                        border: "none",
                        background: "#639922",
                        color: "white",
                        fontWeight: 700,
                        cursor: isSubmittingBulkPay || totalHutangSelected <= 0 ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <DollarSign size={16} /> {isSubmittingBulkPay ? "Memproses..." : `Bayar Lunas ${selectedItems.length} Nota (Rp ${totalHutangSelected.toLocaleString("id-ID")})`}
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── MODAL SHARED: PEMBATALAN TRANSAKSI DENGAN ALASAN WAJIB ─── */}
      {cancelModalItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, maxWidth: 480, width: "100%", padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#b91c1c", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={20} color="#dc2626" /> Konfirmasi Pembatalan {cancelModalItem.type === "purchase" ? "Nota HPP" : "Biaya Operasional"}
              </h3>
              <button onClick={() => setCancelModalItem(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#991b1b" }}>
              <div>Transaksi: <strong>{cancelModalItem.type === "purchase" ? (cancelModalItem.data.nota_ref || `NOTA-${cancelModalItem.data.id}`) : `EXP-${cancelModalItem.data.id}`}</strong></div>
              <div style={{ fontSize: 12, marginTop: 2 }}>{cancelModalItem.data.keterangan}</div>
              <div style={{ marginTop: 6, fontSize: 11.5, color: "#b91c1c" }}>
                ⚠️ Jika transaksi sudah dibayar via Kas/Bank, nominal pembayaran akan dikembalikan (refund) otomatis ke saldo kas terkait.
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                Alasan Pembatalan (Wajib diisi, min. 5 karakter) *
              </label>
              <textarea
                rows={3}
                placeholder="Contoh: Barang retur, salah input akun beban, dibatalkan supplier..."
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setCancelModalItem(null)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", fontSize: 14, cursor: "pointer" }}
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelItem}
                disabled={isSubmittingCancelItem}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#dc2626",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isSubmittingCancelItem ? "Memproses..." : "Konfirmasi Pembatalan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL LIST TRANSAKSI KEUANGAN (DRILL-DOWN DARI P&L DAN NERACA) ── */}
      {drillModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div
            style={{
              background: "white",
              borderRadius: 16,
              width: "100%",
              maxWidth: 960,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1.5px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, background: "#ede9fe", color: "#5005A6", fontWeight: 800, padding: "2px 8px", borderRadius: 6, fontFamily: "monospace" }}>
                    {drillModalCoaCode || "AKUN"}
                  </span>
                  <h3 style={{ fontSize: 17, fontWeight: 900, color: "#111827", margin: 0 }}>
                    {drillModalCoaName || "Rincian Transaksi Keuangan"}
                  </h3>
                </div>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>
                  Daftar seluruh jurnal pembukuan yang memuat akun ini &bull; Total: <strong>{drillTotal} Transaksi</strong> &bull; Akumulasi Nominal: <strong>Rp{drillTotalNominal.toLocaleString("id-ID")}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrillModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 6, borderRadius: 6 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Filter Toolbar */}
            <div style={{ padding: "12px 24px", borderBottom: "1px solid #f1f5f9", background: "white", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flex: "1 1 320px" }}>
                <div style={{ position: "relative", flex: "1 1 200px" }}>
                  <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                  <input
                    type="text"
                    placeholder="Cari Ref No, Keterangan, Akun Lawan..."
                    value={drillSearch}
                    onChange={(e) => setDrillSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setDrillPage(1);
                        fetchDrillData(drillModalCoaId, drillDateFrom, drillDateTo, drillSearch, 1, drillLimit);
                      }
                    }}
                    style={{ width: "100%", padding: "6px 10px 6px 32px", borderRadius: 7, border: "1px solid #d1d5db", fontSize: 12.5, outline: "none" }}
                  />
                </div>

                {/* Filter Tanggal */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#f9fafb", padding: "3px 8px", borderRadius: 7, border: "1px solid #d1d5db" }}>
                  <span style={{ fontSize: 11.5, color: "#6b7280", fontWeight: 600 }}>Periode:</span>
                  <input
                    type="date"
                    value={drillDateFrom}
                    onChange={(e) => setDrillDateFrom(e.target.value)}
                    style={{ padding: "3px 6px", borderRadius: 5, border: "1px solid #d1d5db", fontSize: 11.5, outline: "none" }}
                  />
                  <span style={{ fontSize: 11.5, color: "#6b7280" }}>s/d</span>
                  <input
                    type="date"
                    value={drillDateTo}
                    onChange={(e) => setDrillDateTo(e.target.value)}
                    style={{ padding: "3px 6px", borderRadius: 5, border: "1px solid #d1d5db", fontSize: 11.5, outline: "none" }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDrillPage(1);
                    fetchDrillData(drillModalCoaId, drillDateFrom, drillDateTo, drillSearch, 1, drillLimit);
                  }}
                  style={{ padding: "6px 12px", background: "#5005A6", color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Terapkan
                </button>

                {(drillSearch || drillDateFrom || drillDateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDrillSearch("");
                      setDrillDateFrom("");
                      setDrillDateTo("");
                      setDrillPage(1);
                      fetchDrillData(drillModalCoaId, "", "", "", 1, drillLimit);
                    }}
                    style={{ padding: "6px 10px", background: "#f3f4f6", color: "#4b5563", border: "none", borderRadius: 7, fontSize: 12, cursor: "pointer" }}
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Export Excel Button for this account */}
              <button
                type="button"
                onClick={() => {
                  if (drillData.length === 0) {
                    toast.error("Tidak ada data untuk diexport");
                    return;
                  }
                  const exportRows = drillData.map((it: any) => ({
                    Tanggal: it.journal_date ? new Date(it.journal_date).toLocaleDateString("id-ID") : "-",
                    No_Ref: it.ref_no || "-",
                    Tipe: it.ref_type || "-",
                    Keterangan: it.keterangan || "-",
                    Debit_Akun: it.debit_nama ? `(${it.debit_kode}) ${it.debit_nama}` : "-",
                    Kredit_Akun: it.kredit_nama ? `(${it.kredit_kode}) ${it.kredit_nama}` : "-",
                    Nominal: Number(it.nominal || 0),
                    Status: it.status || "posted",
                  }));
                  const ws = XLSX.utils.json_to_sheet(exportRows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
                  XLSX.writeFile(wb, `Transaksi_${drillModalCoaCode || "akun"}.xlsx`);
                }}
                style={{
                  padding: "6px 12px",
                  background: "#f0fdf4",
                  color: "#15803d",
                  border: "1px solid #bbf7d0",
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <FileSpreadsheet size={13} /> Export Excel
              </button>
            </div>

            {/* Modal Body / Table */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {drillLoading ? (
                <div style={{ padding: "60px 0", textAlign: "center" }}>
                  <RefreshCw size={32} className="animate-spin" style={{ color: "#5005A6", margin: "0 auto 12px" }} />
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>Memuat transaksi keuangan...</p>
                </div>
              ) : drillData.length === 0 ? (
                <div style={{ padding: "50px 0", textAlign: "center", color: "#9ca3af" }}>
                  <FileText size={40} style={{ margin: "0 auto 10px", color: "#cbd5e1" }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>Belum Ada Transaksi</div>
                  <p style={{ fontSize: 12.5, marginTop: 4 }}>Tidak ada jurnal pembukuan untuk akun ini pada filter yang dipilih.</p>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>
                      <th style={{ padding: "9px 12px", textAlign: "left" }}>TANGGAL</th>
                      <th style={{ padding: "9px 12px", textAlign: "left" }}>REF NO / TIPE</th>
                      <th style={{ padding: "9px 12px", textAlign: "left" }}>KETERANGAN</th>
                      <th style={{ padding: "9px 12px", textAlign: "left" }}>AKUN LAWAN</th>
                      <th style={{ padding: "9px 12px", textAlign: "center" }}>POSISI</th>
                      <th style={{ padding: "9px 12px", textAlign: "right" }}>NOMINAL (RP)</th>
                      <th style={{ padding: "9px 12px", textAlign: "center" }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillData.map((row: any, i: number) => {
                      const isTargetDebit = row.akun_debit === drillModalCoaId || row.debit_kode === drillModalCoaCode;
                      const lawanNama = isTargetDebit ? row.kredit_nama : row.debit_nama;
                      const lawanKode = isTargetDebit ? row.kredit_kode : row.debit_kode;
                      return (
                        <tr
                          key={row.id || i}
                          style={{ borderBottom: "1px solid #f1f5f9" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: "#374151" }}>
                            {row.journal_date ? formatDate(row.journal_date) : "-"}
                          </td>
                          <td style={{ padding: "9px 12px" }}>
                            <div style={{ fontWeight: 700, color: "#1e3a8a", fontFamily: "monospace" }}>{row.ref_no || "-"}</div>
                            <span style={{ fontSize: 11, color: "#6b7280" }}>{row.ref_type || "Jurnal"}</span>
                          </td>
                          <td style={{ padding: "9px 12px", maxWidth: 260 }}>
                            <div style={{ color: "#111827" }}>{row.keterangan || "-"}</div>
                          </td>
                          <td style={{ padding: "9px 12px", color: "#4b5563" }}>
                            {lawanNama ? (
                              <div>
                                <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>({lawanKode}) </span>
                                <span>{lawanNama}</span>
                              </div>
                            ) : "-"}
                          </td>
                          <td style={{ padding: "9px 12px", textAlign: "center" }}>
                            <span
                              style={{
                                fontSize: 11,
                                padding: "2px 7px",
                                borderRadius: 4,
                                fontWeight: 800,
                                background: isTargetDebit ? "#eff6ff" : "#fef3c7",
                                color: isTargetDebit ? "#1d4ed8" : "#b45309",
                              }}
                            >
                              {isTargetDebit ? "DEBIT" : "KREDIT"}
                            </span>
                          </td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#111827" }}>
                            {Number(row.nominal || 0).toLocaleString("id-ID")}
                          </td>
                          <td style={{ padding: "9px 12px", textAlign: "center" }}>
                            <span
                              style={{
                                fontSize: 11,
                                padding: "2px 7px",
                                borderRadius: 4,
                                fontWeight: 700,
                                background: row.status === "dibatalkan" ? "#fee2e2" : "#dcfce7",
                                color: row.status === "dibatalkan" ? "#dc2626" : "#16a34a",
                              }}
                            >
                              {row.status || "posted"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer / Pagination */}
            <div style={{ padding: "12px 24px", borderTop: "1.5px solid #e5e7eb", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 12.5, color: "#4b5563" }}>
                Total <strong>{drillTotal}</strong> transaksi &bull; Halaman <strong>{drillPage}</strong> dari <strong>{Math.ceil(drillTotal / drillLimit) || 1}</strong>
              </div>

              {drillTotal > 0 && (
                <Pagination
                  page={drillPage}
                  totalPages={Math.ceil(drillTotal / drillLimit) || 1}
                  total={drillTotal}
                  limit={drillLimit}
                  onChange={(p: number) => {
                    setDrillPage(p);
                    fetchDrillData(drillModalCoaId, drillDateFrom, drillDateTo, drillSearch, p, drillLimit);
                  }}
                  onLimitChange={(l: number) => {
                    setDrillLimit(l);
                    setDrillPage(1);
                    fetchDrillData(drillModalCoaId, drillDateFrom, drillDateTo, drillSearch, 1, l);
                  }}
                />
              )}

              <button
                type="button"
                onClick={() => setDrillModalOpen(false)}
                style={{ padding: "6px 16px", borderRadius: 7, border: "1px solid #d1d5db", background: "white", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
