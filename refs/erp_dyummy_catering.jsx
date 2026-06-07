import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, RadialBarChart, RadialBar
} from "recharts";
import {
  LayoutDashboard, Inbox, Users, ShoppingBag, BarChart2,
  CalendarDays, BookOpen, ClipboardList, TrendingUp, CreditCard,
  PieChart as PieIcon, Settings, Menu, ChevronRight,
  Plus, Printer, Download, Edit2, Trash2, AlertTriangle,
  CheckCircle, XCircle, ArrowUpRight, ArrowDownRight, Target,
  Utensils, ShoppingCart, DollarSign, Package, Bell, Send,
  RefreshCw, Lock, Eye, UserPlus, ChefHat, Truck,
  AlertCircle, TrendingDown, BarChart3, Gauge
} from "lucide-react";

const COLORS = {
  primary: "#5005A6", primaryDark: "#3b047a",
  secondary: "#378ADD", warning: "#BA7517",
  danger: "#E24B4A", success: "#639922",
  purple: "#7F77DD", coral: "#D85A30",
  amber: "#EF9F27", gray: "#888780",
  white: "#ffffff", border: "#e5e7eb",
  textPrimary: "#1a1a1a", textSecondary: "#6b7280",
  bgSecondary: "#f9fafb", bgTertiary: "#f3f4f6",
  sidebar: "#B10FBD",
};
const FONT = "'Source Sans 3','Source Sans Pro',sans-serif";

const globalStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;font-family:${FONT};}
  body{background:#f3f4f6;color:#1a1a1a;}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-track{background:#f1f1f1;}
  ::-webkit-scrollbar-thumb{background:#c1c1c1;border-radius:3px;}
  table{border-collapse:collapse;width:100%;}
  th,td{text-align:left;padding:10px 12px;font-size:13px;}
  th{background:#f9fafb;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;}
  td{border-bottom:0.5px solid #f3f4f6;color:#374151;}
  tr:hover td{background:#f9fafb;}
  input,select,textarea{font-family:${FONT};font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;outline:none;width:100%;background:white;color:#1a1a1a;}
  input:focus,select:focus,textarea:focus{border-color:#5005A6;box-shadow:0 0 0 3px rgba(80, 5, 166,0.1);}
  label{font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;}
  button{font-family:${FONT};cursor:pointer;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:500;transition:all 0.15s;}
  @media(max-width:768px){
    .sidebar-overlay{display:block!important;}
    .main-content{margin-left:0!important;}
  }
`;

// ── DATA ─────────────────────────────────────────────────────────────────────
const customers = [
  { id: 1, name: "Ressa Amalia", phone: "085220073373", type: "Instansi", email: "ressa@email.com", address: "Jl. Merdeka 12, Jakarta", notes: "VIP regular", status: "Aktif", lastOrder: "2026-05-18" },
  { id: 2, name: "APTIKOM", phone: "081233445566", type: "Corporate", email: "apt@aptikom.or.id", address: "Jl. Sudirman 45, Jakarta", notes: "Langganan bulanan", status: "Aktif", lastOrder: "2026-05-18" },
  { id: 3, name: "Budi Santoso", phone: "082111222333", type: "Perorangan", email: "budi@mail.com", address: "Jl. Kebon Jeruk 7", notes: "", status: "Aktif", lastOrder: "2026-05-15" },
  { id: 4, name: "Lead-20260518-001", phone: "087800112233", type: "Unknown", email: "", address: "", notes: "Nanya harga nasi box, blm kasih nama", status: "Prospek", lastOrder: null },
  { id: 5, name: "PT Sinar Mas", phone: "021-5550011", type: "Corporate", email: "event@sinarmas.com", address: "Jl. MH Thamrin 51", notes: "Event tahunan", status: "Aktif", lastOrder: "2026-05-10" },
];
const leads = [
  { id: 1, customerId: 1, customer: "Ressa Amalia", pic: "Siti (CS 1)", date: "2026-05-18", source: "WhatsApp", status: "Closing", pax: 50, value: 1500000, notes: "Nasi box premium" },
  { id: 2, customerId: 2, customer: "APTIKOM", pic: "Siti (CS 1)", date: "2026-05-18", source: "Referral", status: "Closing", pax: 100, value: 7500000, notes: "Prasmanan VIP" },
  { id: 3, customerId: 4, customer: "Lead-20260518-001", pic: "Siti (CS 1)", date: "2026-05-18", source: "WhatsApp", status: "Follow Up", pax: 0, value: 0, notes: "Nanya harga" },
  { id: 4, customerId: 3, customer: "Budi Santoso", pic: "Rina (CS 2)", date: "2026-05-18", source: "Instagram", status: "Negosiasi", pax: 30, value: 900000, notes: "Minta diskon 10%" },
  { id: 5, customerId: 5, customer: "PT Sinar Mas", pic: "Siti (CS 1)", date: "2026-05-17", source: "Referral", status: "Closing", pax: 200, value: 15000000, notes: "Event annual, closing hari ini" },
];
const orders = [
  { id: "ORD-001", customer: "Ressa Amalia", pic: "Siti", orderDate: "2026-05-18", deliveryDate: "2026-05-19", venue: "Gedung Serbaguna Senayan", pax: 50, total: 1500000, statusOrder: "Konfirmasi", statusPayment: "DP 50%", items: "50x Nasi Box Premium" },
  { id: "ORD-002", customer: "APTIKOM", pic: "Siti", orderDate: "2026-05-18", deliveryDate: "2026-05-19", venue: "Hotel Borobudur Jakarta", pax: 100, total: 7500000, statusOrder: "Konfirmasi", statusPayment: "Lunas", items: "100x Prasmanan VIP" },
  { id: "ORD-003", customer: "PT Sinar Mas", pic: "Siti", orderDate: "2026-05-17", deliveryDate: "2026-05-25", venue: "Ballroom Grand Hyatt", pax: 200, total: 15000000, statusOrder: "Baru", statusPayment: "Belum Lunas", items: "200x Prasmanan VIP" },
  { id: "ORD-004", customer: "Budi Santoso", pic: "Rina", orderDate: "2026-05-16", deliveryDate: "2026-05-21", venue: "Rumah Pribadi", pax: 30, total: 810000, statusOrder: "Selesai", statusPayment: "Lunas", items: "30x Nasi Box Premium (disc 10%)" },
];
const productionSchedules = [
  { id: 1, date: "2026-05-19", chef: "Chef Juna", revenue: 9000000, budgetLimit: 4500000, estimatedHPP: 4100000, status: "Approved", orders: ["ORD-001", "ORD-002"] },
  { id: 2, date: "2026-05-25", chef: "Chef Juna", revenue: 15000000, budgetLimit: 7500000, estimatedHPP: 8200000, status: "Overbudget Warning", orders: ["ORD-003"] },
];
const scheduleMenus = [
  { schedule: 1, menu: "Ayam Bakar Madu", pax: 50, hppUnit: 12000, hppTotal: 600000 },
  { schedule: 1, menu: "Telur Balado", pax: 50, hppUnit: 4000, hppTotal: 200000 },
  { schedule: 1, menu: "Sapi Lada Hitam (VIP)", pax: 100, hppUnit: 25000, hppTotal: 2500000 },
  { schedule: 1, menu: "Soup Kimlo (VIP)", pax: 100, hppUnit: 8000, hppTotal: 800000 },
];
const purchaseRequests = [
  {
    id: "PR-001", schedule: 1, chef: "Chef Juna", date: "2026-05-18", total: 4100000, status: "Sent to Purchasing", items: [
      { name: "Daging Sapi", qty: 20, uom: "Kg", estPrice: 125000, subtotal: 2500000 },
      { name: "Ayam Potong", qty: 15, uom: "Ekor", estPrice: 40000, subtotal: 600000 },
      { name: "Bahan Lainnya", qty: 1, uom: "Paket", estPrice: 1000000, subtotal: 1000000 },
    ]
  },
];
const purchaseOrders = [
  { id: "PO-001", prId: "PR-001", purchasing: "Bagas Purchasing", finance: "Andi Finance", poDate: "2026-05-18", estimatedCost: 4100000, actualCost: 4600000, statusPO: "Selesai Belanja", statusCost: "Overbudget", variance: 500000, notes: "Harga Sapi potong mendadak langka, naik 20rb/kg" },
];
const ingredientPrices = [
  { id: 1, name: "Daging Sapi", category: "Protein", uom: "Kg", lastPrice: 125000, currentPrice: 145000, updatedBy: "Bagas", updatedAt: "2026-05-18", change: 16 },
  { id: 2, name: "Ayam Potong", category: "Protein", uom: "Ekor", lastPrice: 40000, currentPrice: 40000, updatedBy: "Bagas", updatedAt: "2026-05-17", change: 0 },
  { id: 3, name: "Cabai Merah", category: "Bumbu", uom: "Kg", lastPrice: 40000, currentPrice: 80000, updatedBy: "Bagas", updatedAt: "2026-05-18", change: 100 },
  { id: 4, name: "Telur Ayam", category: "Protein", uom: "Kg", lastPrice: 28000, currentPrice: 27000, updatedBy: "Bagas", updatedAt: "2026-05-16", change: -3.6 },
  { id: 5, name: "Beras", category: "Pokok", uom: "Kg", lastPrice: 14000, currentPrice: 14500, updatedBy: "Bagas", updatedAt: "2026-05-15", change: 3.6 },
];
const overheads = [
  { id: 1, date: "2026-05-19", category: "Kemasan", amount: 200000, notes: "Beli Box & Mika VIP", finance: "Andi Finance" },
  { id: 2, date: "2026-05-19", category: "Transportasi", amount: 100000, notes: "Bensin operasional kiriman", finance: "Andi Finance" },
  { id: 3, date: "2026-05-18", category: "Gas", amount: 350000, notes: "Isi gas dapur 2 tabung", finance: "Andi Finance" },
  { id: 4, date: "2026-05-18", category: "Uang Makan", amount: 200000, notes: "Uang makan karyawan", finance: "Andi Finance" },
];
const users = [
  { id: 1, name: "Siti Nurhaliza", email: "siti@catering.com", role: "CS / Sales", status: "Aktif", avatar: "SN" },
  { id: 2, name: "Rina Marlina", email: "rina@catering.com", role: "CS / Sales", status: "Aktif", avatar: "RM" },
  { id: 3, name: "Andi Finance", email: "finance@catering.com", role: "Finance", status: "Aktif", avatar: "AF" },
  { id: 4, name: "Super Admin", email: "admin@catering.com", role: "Super Admin", status: "Aktif", avatar: "SA" },
  { id: 5, name: "Chef Juna", email: "chef@catering.com", role: "Kitchen", status: "Aktif", avatar: "CJ" },
  { id: 6, name: "Bagas Purchasing", email: "purchasing@catering.com", role: "Purchasing", status: "Aktif", avatar: "BP" },
];
const plData = [
  { date: "18 Mei", revenue: 9000000, bpp: 4600000, overhead: 550000, grossProfit: 3850000, margin: 42.8 },
  { date: "19 Mei", revenue: 9000000, bpp: 4200000, overhead: 300000, grossProfit: 4500000, margin: 50 },
  { date: "20 Mei", revenue: 4500000, bpp: 2100000, overhead: 250000, grossProfit: 2150000, margin: 47.8 },
  { date: "21 Mei", revenue: 7200000, bpp: 3600000, overhead: 400000, grossProfit: 3200000, margin: 44.4 },
  { date: "22 Mei", revenue: 6000000, bpp: 2800000, overhead: 320000, grossProfit: 2880000, margin: 48 },
  { date: "23 Mei", revenue: 8100000, bpp: 4000000, overhead: 480000, grossProfit: 3620000, margin: 44.7 },
  { date: "24 Mei", revenue: 5400000, bpp: 2500000, overhead: 290000, grossProfit: 2610000, margin: 48.3 },
];
const csPerformance = [
  { name: "Siti Nurhaliza", week1: { leads: 14, closing: 5, rate: 35.7 }, week2: { leads: 12, closing: 4, rate: 33.3 }, week3: { leads: 16, closing: 5, rate: 31.3 }, week4: { leads: 10, closing: 3, rate: 30 }, monthLeads: 52, monthClosing: 17, monthRate: 32.7 },
  { name: "Rina Marlina", week1: { leads: 10, closing: 2, rate: 20 }, week2: { leads: 8, closing: 2, rate: 25 }, week3: { leads: 9, closing: 2, rate: 22.2 }, week4: { leads: 11, closing: 2, rate: 18.2 }, monthLeads: 38, monthClosing: 8, monthRate: 21.1 },
];
const recipes = [
  { id: 1, menuName: "Ayam Bakar Madu", product: "Nasi Box Premium", ingredients: "Ayam Potong, Bumbu Madu, Kecap", standardCost: 12000 },
  { id: 2, menuName: "Telur Balado", product: "Nasi Box Premium", ingredients: "Telur Ayam, Cabai, Tomat", standardCost: 4000 },
  { id: 3, menuName: "Sapi Lada Hitam (VIP)", product: "Prasmanan VIP", ingredients: "Daging Sapi Pilihan, Paprika, Lada Hitam", standardCost: 25000 },
  { id: 4, menuName: "Soup Kimlo (VIP)", product: "Prasmanan VIP", ingredients: "Ayam, Jamur, Soun, Wortel", standardCost: 8000 },
  { id: 5, menuName: "Rendang Daging", product: "Prasmanan VIP", ingredients: "Daging Sapi, Kelapa, Bumbu Rendang", standardCost: 28000 },
];

// ── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = n => "Rp " + Number(n).toLocaleString("id-ID");
const pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "0%";

const Badge = ({ children, color = "gray" }) => {
  const colors = {
    green: { bg: "#EAF3DE", text: "#3B6D11" }, red: { bg: "#FCEBEB", text: "#A32D2D" },
    yellow: { bg: "#FAEEDA", text: "#854F0B" }, blue: { bg: "#E6F1FB", text: "#185FA5" },
    gray: { bg: "#F1EFE8", text: "#5F5E5A" }, purple: { bg: "#EEEDFE", text: "#3C3489" }, teal: { bg: "#F0E6FA", text: "#3b047a" },
  };
  const c = colors[color] || colors.gray;
  return <span style={{ background: c.bg, color: c.text, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>;
};
const statusBadge = s => {
  const map = {
    "Closing": "green", "Approved": "green", "Lunas": "green", "Aktif": "green", "Safe": "green", "Selesai Belanja": "green", "Selesai": "green", "Sehat": "green",
    "Overbudget Warning": "red", "Overbudget": "red", "Belum Lunas": "red", "Reject": "red", "Perlu Perhatian": "red",
    "Follow Up": "yellow", "Negosiasi": "yellow", "DP 50%": "yellow", "Draft": "yellow", "OK": "yellow",
    "Konfirmasi": "blue", "Baru": "blue", "Sent to Purchasing": "blue",
    "Repeat": "teal", "Prospek": "purple",
  };
  return <Badge color={map[s] || "gray"}>{s}</Badge>;
};
const Card = ({ children, style = {} }) => (
  <div style={{ background: "white", borderRadius: 12, border: "0.5px solid #e5e7eb", padding: "16px 20px", ...style }}>{children}</div>
);
const StatCard = ({ label, value, sub, color = COLORS.primary, icon: Icon }) => (
  <div style={{ background: "white", borderRadius: 12, border: "0.5px solid #e5e7eb", padding: "14px 16px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: COLORS.textPrimary, lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>{sub}</p>}
      </div>
      {Icon && <div style={{ width: 36, height: 36, borderRadius: 10, background: color + "20", display: "flex", alignItems: "center", justifyContent: "center", color }}><Icon size={18} /></div>}
    </div>
  </div>
);
const PageHeader = ({ title, subtitle, actions }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
    <div><h1 style={{ fontSize: 20, fontWeight: 700, color: COLORS.textPrimary }}>{title}</h1>{subtitle && <p style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>{subtitle}</p>}</div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>
  </div>
);
const Btn = ({ children, onClick, color = "primary", size = "md", style = {}, disabled }) => {
  const bg = { primary: COLORS.primary, secondary: "white", danger: COLORS.danger, warning: COLORS.warning };
  const tc = { primary: "white", secondary: COLORS.textPrimary, danger: "white", warning: "white" };
  const bd = { primary: "none", secondary: `1px solid ${COLORS.border}`, danger: "none", warning: "none" };
  const pad = size === "sm" ? "6px 12px" : "9px 18px";
  return <button onClick={onClick} disabled={disabled} style={{ background: bg[color], color: tc[color], border: bd[color], padding: pad, fontSize: size === "sm" ? 12 : 13, fontWeight: 500, borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, ...style }}>{children}</button>;
};
const Modal = ({ show, onClose, title, children, width = 540 }) => {
  if (!show) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: width, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}><XCircle size={20} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
};
const FormRow = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>{children}</div>;
const FormField = ({ label, children, style = {} }) => <div style={style}><label>{label}</label>{children}</div>;

// ── GAUGE COMPONENT ───────────────────────────────────────────────────────────
const GaugeChart = ({ value, max = 100, label, color = COLORS.primary, size = 130 }) => {
  const pctVal = Math.min((value / max) * 100, 100);
  const radius = 45;
  const circ = 2 * Math.PI * radius;
  const arc = circ * 0.75;
  const offset = arc - (pctVal / 100) * arc;
  const gaugeColor = pctVal >= 80 ? COLORS.primary : pctVal >= 50 ? COLORS.warning : COLORS.danger;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size * 0.75} viewBox="0 0 110 82">
        <path d={`M 10 78 A 45 45 0 1 1 100 78`} fill="none" stroke="#f3f4f6" strokeWidth="10" strokeLinecap="round" />
        <path d={`M 10 78 A 45 45 0 1 1 100 78`} fill="none" stroke={gaugeColor} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={arc} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.5s ease" }} />
        <text x="55" y="68" textAnchor="middle" fontSize="15" fontWeight="700" fill={gaugeColor} fontFamily="inherit">{pctVal.toFixed(0)}%</text>
      </svg>
      <p style={{ fontSize: 11, fontWeight: 600, color: COLORS.textSecondary, textAlign: "center" }}>{label}</p>
    </div>
  );
};

// ── TARGET CRUD ───────────────────────────────────────────────────────────────
const initTargets = [
  { id: 1, periode: "Mei 2026", jenis: "Revenue", target: 60000000, realisasi: 49200000, satuan: "Rp" },
  { id: 2, periode: "Mei 2026", jenis: "Closing Rate", target: 30, realisasi: 26.9, satuan: "%" },
  { id: 3, periode: "Mei 2026", jenis: "Order Count", target: 25, realisasi: 18, satuan: "order" },
  { id: 4, periode: "Mei 2026", jenis: "Gross Margin", target: 45, realisasi: 46.6, satuan: "%" },
  { id: 5, periode: "Mei 2026", jenis: "Lead Masuk", target: 100, realisasi: 90, satuan: "lead" },
];

const TargetManagement = () => {
  const [targets, setTargets] = useState(initTargets);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ periode: "Mei 2026", jenis: "Revenue", target: "", realisasi: "", satuan: "Rp" });

  const openAdd = () => { setEditItem(null); setForm({ periode: "Mei 2026", jenis: "Revenue", target: "", realisasi: "", satuan: "Rp" }); setShowModal(true); };
  const openEdit = t => { setEditItem(t); setForm({ periode: t.periode, jenis: t.jenis, target: t.target, realisasi: t.realisasi, satuan: t.satuan }); setShowModal(true); };
  const save = () => {
    if (editItem) {
      setTargets(prev => prev.map(t => t.id === editItem.id ? { ...t, ...form, target: Number(form.target), realisasi: Number(form.realisasi) } : t));
    } else {
      setTargets(prev => [...prev, { id: Date.now(), ...form, target: Number(form.target), realisasi: Number(form.realisasi) }]);
    }
    setShowModal(false);
  };
  const del = id => setTargets(prev => prev.filter(t => t.id !== id));

  const chartData = targets.map(t => ({ name: t.jenis, Target: t.target, Realisasi: t.realisasi, pct: ((t.realisasi / t.target) * 100).toFixed(1) }));

  return (
    <div>
      <PageHeader title="Target & Realisasi" subtitle="CRUD target KPI, chart realisasi, dan scorecard capaian" actions={[<Btn key="add" onClick={openAdd}><Plus size={14} style={{ marginRight: 4 }} />Tambah Target</Btn>]} />

      {/* SCORECARD GAUGE GRID */}
      <Card style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Scorecard Capaian — Gauge Persentase</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 16 }}>
          {targets.map(t => {
            const pctVal = (t.realisasi / t.target) * 100;
            return (
              <div key={t.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 8px", border: "0.5px solid #f3f4f6", borderRadius: 10, background: "#fafafa" }}>
                <GaugeChart value={t.realisasi} max={t.target} label={t.jenis} size={120} />
                <div style={{ marginTop: 4, textAlign: "center" }}>
                  <p style={{ fontSize: 11, color: COLORS.textSecondary }}>Real: <b style={{ color: COLORS.textPrimary }}>{t.satuan === "Rp" ? fmt(t.realisasi) : t.realisasi + t.satuan}</b></p>
                  <p style={{ fontSize: 11, color: COLORS.textSecondary }}>Target: <b style={{ color: COLORS.textPrimary }}>{t.satuan === "Rp" ? fmt(t.target) : t.target + t.satuan}</b></p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* CHART TARGET VS REALISASI */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Chart Target vs Realisasi</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Target" fill={COLORS.border} name="Target" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Realisasi" fill={COLORS.primary} name="Realisasi" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Persentase Capaian (%)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis type="number" domain={[0, 130]} tickFormatter={v => v + "%"} tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
              <Tooltip formatter={v => v + "%"} />
              <Bar dataKey="pct" name="Capaian %" radius={[0, 4, 4, 0]}
                fill={COLORS.primary}
                label={{ position: "right", fontSize: 10, formatter: v => v + "%", fill: COLORS.textSecondary }}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* TABLE CRUD */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 13, fontWeight: 700 }}>Tabel Target KPI</p>
          <Btn size="sm" onClick={openAdd}><Plus size={12} style={{ marginRight: 4 }} />Tambah</Btn>
        </div>
        <table>
          <thead><tr><th>Periode</th><th>KPI</th><th>Target</th><th>Realisasi</th><th>Capaian</th><th>Progress</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {targets.map(t => {
              const pctVal = ((t.realisasi / t.target) * 100);
              const fmtVal = v => t.satuan === "Rp" ? fmt(v) : v + (t.satuan || "");
              const statusLabel = pctVal >= 100 ? "Tercapai" : pctVal >= 80 ? "Hampir" : pctVal >= 50 ? "On Track" : "Di Bawah";
              const statusColor = pctVal >= 100 ? "green" : pctVal >= 80 ? "teal" : pctVal >= 50 ? "yellow" : "red";
              return (
                <tr key={t.id}>
                  <td style={{ fontSize: 12, color: COLORS.textSecondary }}>{t.periode}</td>
                  <td style={{ fontWeight: 600 }}>{t.jenis}</td>
                  <td style={{ fontWeight: 600 }}>{fmtVal(t.target)}</td>
                  <td style={{ fontWeight: 600, color: COLORS.primary }}>{fmtVal(t.realisasi)}</td>
                  <td style={{ fontWeight: 700, color: pctVal >= 100 ? COLORS.primary : pctVal >= 80 ? COLORS.success : pctVal >= 50 ? COLORS.warning : COLORS.danger }}>{pctVal.toFixed(1)}%</td>
                  <td style={{ minWidth: 100 }}>
                    <div style={{ height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: Math.min(pctVal, 100) + "%", background: pctVal >= 100 ? COLORS.primary : pctVal >= 80 ? COLORS.success : pctVal >= 50 ? COLORS.warning : COLORS.danger, borderRadius: 4, transition: "width 0.3s" }} />
                    </div>
                  </td>
                  <td>{statusBadge(statusLabel)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Btn size="sm" color="secondary" onClick={() => openEdit(t)}><Edit2 size={11} /></Btn>
                      <Btn size="sm" color="danger" onClick={() => del(t.id)}><Trash2 size={11} /></Btn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Modal show={showModal} onClose={() => setShowModal(false)} title={editItem ? "Edit Target" : "Tambah Target KPI"}>
        <FormRow>
          <FormField label="Periode"><input value={form.periode} onChange={e => setForm(f => ({ ...f, periode: e.target.value }))} placeholder="Mei 2026" /></FormField>
          <FormField label="Jenis KPI">
            <select value={form.jenis} onChange={e => setForm(f => ({ ...f, jenis: e.target.value }))}>
              <option>Revenue</option><option>Closing Rate</option><option>Order Count</option><option>Gross Margin</option><option>Lead Masuk</option><option>BPP %</option>
            </select>
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="Target (Angka)"><input type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} placeholder="contoh: 60000000" /></FormField>
          <FormField label="Realisasi (Angka)"><input type="number" value={form.realisasi} onChange={e => setForm(f => ({ ...f, realisasi: e.target.value }))} placeholder="contoh: 49200000" /></FormField>
        </FormRow>
        <FormField label="Satuan">
          <select value={form.satuan} onChange={e => setForm(f => ({ ...f, satuan: e.target.value }))}>
            <option value="Rp">Rp (Rupiah)</option><option value="%">% (Persen)</option><option value="order">order</option><option value="lead">lead</option>
          </select>
        </FormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn color="secondary" onClick={() => setShowModal(false)}>Batal</Btn>
          <Btn onClick={save}>{editItem ? "Update Target" : "Simpan Target"}</Btn>
        </div>
      </Modal>
    </div>
  );
};

// ── PAGES (EXISTING — UNCHANGED) ─────────────────────────────────────────────
const Dashboard = () => {
  const totalRevenue = plData.reduce((a, b) => a + b.revenue, 0);
  const totalBPP = plData.reduce((a, b) => a + b.bpp, 0);
  const totalProfit = plData.reduce((a, b) => a + b.grossProfit, 0);
  const todayLeads = leads.filter(l => l.date === "2026-05-18").length;
  const todayClosing = leads.filter(l => l.date === "2026-05-18" && l.status === "Closing").length;
  return (
    <div>
      <PageHeader title="Dashboard Utama" subtitle="Ringkasan operasional & keuangan hari ini — 24 Mei 2026" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="Revenue Minggu Ini" value={fmt(totalRevenue)} sub="7 hari terakhir" icon={TrendingUp} color={COLORS.primary} />
        <StatCard label="Laba Kotor" value={fmt(totalProfit)} sub={`Margin ${pct(totalProfit, totalRevenue)}`} icon={DollarSign} color={COLORS.secondary} />
        <StatCard label="Lead Hari Ini" value={todayLeads} sub={`${todayClosing} closing (${pct(todayClosing, todayLeads)})`} icon={Inbox} color={COLORS.purple} />
        <StatCard label="Order Aktif" value={orders.filter(o => o.statusOrder !== "Selesai").length} sub="Perlu tindak lanjut" icon={ShoppingCart} color={COLORS.coral} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: COLORS.textPrimary }}>Revenue vs BPP vs Laba Kotor (7 Hari)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={plData} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tickFormatter={v => "Rp" + (v / 1000000).toFixed(1) + "Jt"} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => fmt(v)} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="revenue" name="Revenue" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="bpp" name="BPP Aktual" fill={COLORS.coral} radius={[4, 4, 0, 0]} />
              <Bar dataKey="grossProfit" name="Laba Kotor" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: COLORS.textPrimary }}>Margin Laba (%) Harian</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={plData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} tickFormatter={v => v + "%"} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => v + "%"} />
              <Line type="monotone" dataKey="margin" name="Margin %" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 4, fill: COLORS.primary }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: COLORS.textPrimary }}>Lead & Order Harian</p>
          <table>
            <thead><tr><th>Customer</th><th>CS</th><th>Status</th><th>Nilai</th></tr></thead>
            <tbody>{leads.filter(l => l.date === "2026-05-18").map(l => (
              <tr key={l.id}>
                <td style={{ fontWeight: 500, fontSize: 12 }}>{l.customer}</td>
                <td style={{ fontSize: 12, color: COLORS.textSecondary }}>{l.pic}</td>
                <td>{statusBadge(l.status)}</td>
                <td style={{ fontSize: 12, fontWeight: 600, color: l.value > 0 ? COLORS.primary : COLORS.textSecondary }}>{l.value > 0 ? fmt(l.value) : "-"}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
        <Card>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: COLORS.textPrimary }}>Peringatan Sistem</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {productionSchedules.filter(p => p.status === "Overbudget Warning").map(p => (
              <div key={p.id} style={{ background: "#FCEBEB", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <AlertTriangle size={16} color="#A32D2D" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontWeight: 600, color: "#A32D2D", fontSize: 12 }}>OVERBUDGET: Jadwal Produksi {p.date}</p>
                    <p style={{ fontSize: 11, color: "#A32D2D", marginTop: 2 }}>Est. HPP {fmt(p.estimatedHPP)} melebihi limit {fmt(p.budgetLimit)}. Chef wajib revisi menu.</p>
                  </div>
                </div>
              </div>
            ))}
            {purchaseOrders.filter(p => p.statusCost === "Overbudget").map(p => (
              <div key={p.id} style={{ background: "#FAEEDA", border: "1px solid #FAC775", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <DollarSign size={16} color="#854F0B" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontWeight: 600, color: "#854F0B", fontSize: 12 }}>Variance Belanja: {p.id}</p>
                    <p style={{ fontSize: 11, color: "#854F0B", marginTop: 2 }}>Aktual {fmt(p.actualCost)} vs Est {fmt(p.estimatedCost)} (+{fmt(p.variance)}). {p.notes}</p>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ background: "#F0E6FA", border: "1px solid #D3BDF3", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <CheckCircle size={16} color="#3b047a" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontWeight: 600, color: "#3b047a", fontSize: 12 }}>Jadwal Produksi 19 Mei — Approved</p>
                  <p style={{ fontSize: 11, color: "#3b047a", marginTop: 2 }}>Est. HPP Rp 4.1Jt dalam batas 50% dari revenue Rp 9Jt.</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

const CRMLeads = () => {
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? leads : leads.filter(l => l.status === filter);
  return (
    <div>
      <PageHeader title="Manajemen Lead" subtitle="Semua lead masuk — WhatsApp, Referral, Instagram"
        actions={[<Btn key="add" onClick={() => setShowModal(true)}><Plus size={14} style={{ marginRight: 4 }} />Tambah Lead</Btn>]} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 16 }}>
        <StatCard label="Total Lead Hari Ini" value={leads.filter(l => l.date === "2026-05-18").length} icon={Inbox} color={COLORS.purple} />
        <StatCard label="Closing Hari Ini" value={leads.filter(l => l.status === "Closing").length} icon={CheckCircle} color={COLORS.primary} />
        <StatCard label="Follow Up" value={leads.filter(l => l.status === "Follow Up").length} icon={Bell} color={COLORS.warning} />
        <StatCard label="Closing Rate" value="40%" sub="Target: 30%" icon={BarChart2} color={COLORS.secondary} />
        <StatCard label="Nilai Closing" value="Rp 9Jt" sub="Hari ini" icon={DollarSign} color={COLORS.success} />
      </div>
      <Card>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {["all", "Follow Up", "Negosiasi", "Closing"].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: "5px 14px", borderRadius: 20, border: "1px solid", fontSize: 12, fontWeight: 500, cursor: "pointer", background: filter === s ? COLORS.primary : "white", color: filter === s ? "white" : COLORS.textSecondary, borderColor: filter === s ? COLORS.primary : COLORS.border }}>
              {s === "all" ? "Semua" : s}
            </button>
          ))}
        </div>
        <table>
          <thead><tr><th>Customer</th><th>PIC CS</th><th>Tanggal</th><th>Sumber</th><th>Status</th><th>Pax</th><th>Nilai</th><th>Aksi</th></tr></thead>
          <tbody>{filtered.map(l => (
            <tr key={l.id}>
              <td style={{ fontWeight: 500 }}>{l.customer}</td>
              <td style={{ color: COLORS.textSecondary }}>{l.pic}</td>
              <td style={{ color: COLORS.textSecondary }}>{l.date}</td>
              <td><Badge color="blue">{l.source}</Badge></td>
              <td>{statusBadge(l.status)}</td>
              <td>{l.pax > 0 ? l.pax + " pax" : "-"}</td>
              <td style={{ fontWeight: 600, color: l.value > 0 ? COLORS.primary : COLORS.textSecondary }}>{l.value > 0 ? fmt(l.value) : "-"}</td>
              <td><Btn size="sm" color="secondary">Detail</Btn></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
      <Modal show={showModal} onClose={() => setShowModal(false)} title="Tambah Lead Baru">
        <FormRow>
          <FormField label="Nama / Kode Customer"><input placeholder="Nama atau tanggal jika anonim" /></FormField>
          <FormField label="No. WhatsApp"><input placeholder="08xx..." /></FormField>
        </FormRow>
        <FormRow>
          <FormField label="Sumber Lead"><select><option>WhatsApp</option><option>Instagram</option><option>Referral</option><option>Google</option></select></FormField>
          <FormField label="PIC CS"><select>{users.filter(u => u.role === "CS / Sales").map(u => <option key={u.id}>{u.name}</option>)}</select></FormField>
        </FormRow>
        <FormRow>
          <FormField label="Status"><select><option>Follow Up</option><option>Negosiasi</option><option>Closing</option></select></FormField>
          <FormField label="Tanggal Lead"><input type="date" defaultValue="2026-05-24" /></FormField>
        </FormRow>
        <FormField label="Catatan"><textarea rows={2} placeholder="Detail kebutuhan customer..." style={{ marginBottom: 0 }} /></FormField>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <Btn color="secondary" onClick={() => setShowModal(false)}>Batal</Btn>
          <Btn onClick={() => setShowModal(false)}>Simpan Lead</Btn>
        </div>
      </Modal>
    </div>
  );
};

const CRMCustomers = () => {
  const [showModal, setShowModal] = useState(false);
  return (
    <div>
      <PageHeader title="Data Kontak Customer" subtitle="Semua kontak — prospek, belum closing, maupun reguler"
        actions={[
          <Btn key="dl" color="secondary"><Download size={14} style={{ marginRight: 4 }} />Download</Btn>,
          <Btn key="add" onClick={() => setShowModal(true)}><Plus size={14} style={{ marginRight: 4 }} />Tambah Kontak</Btn>
        ]} />
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input placeholder="Cari nama, telepon, tipe..." style={{ maxWidth: 300 }} />
        <select style={{ width: "auto" }}><option>Semua Tipe</option><option>Perorangan</option><option>Corporate</option><option>Instansi</option></select>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead><tr><th>Nama</th><th>Telepon</th><th>Tipe</th><th>Email</th><th>Terakhir Order</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>{customers.map(c => (
            <tr key={c.id}>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS.primary + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: COLORS.primary, flexShrink: 0 }}>{c.name.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</p>
                    <p style={{ fontSize: 11, color: COLORS.textSecondary }}>{c.address || "Alamat belum diisi"}</p>
                  </div>
                </div>
              </td>
              <td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.phone}</td>
              <td><Badge color={c.type === "Corporate" ? "blue" : c.type === "Instansi" ? "purple" : "gray"}>{c.type}</Badge></td>
              <td style={{ fontSize: 12, color: COLORS.textSecondary }}>{c.email || "-"}</td>
              <td style={{ fontSize: 12 }}>{c.lastOrder || <span style={{ color: COLORS.textSecondary }}>Belum pernah order</span>}</td>
              <td>{statusBadge(c.status)}</td>
              <td><div style={{ display: "flex", gap: 4 }}><Btn size="sm" color="secondary"><Edit2 size={11} /></Btn><Btn size="sm" color="secondary">Order</Btn></div></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
      <Modal show={showModal} onClose={() => setShowModal(false)} title="Tambah Kontak">
        <FormRow><FormField label="Nama"><input placeholder="Nama / Kode (wajib isi)" /></FormField><FormField label="No. Telepon / WA"><input placeholder="08xx..." /></FormField></FormRow>
        <FormRow><FormField label="Tipe Customer"><select><option>Perorangan</option><option>Corporate</option><option>Instansi</option><option>Unknown</option></select></FormField><FormField label="Email"><input type="email" placeholder="email@domain.com" /></FormField></FormRow>
        <FormField label="Alamat"><input placeholder="Alamat lengkap" /></FormField>
        <FormField label="Catatan" style={{ marginTop: 12 }}><textarea rows={2} /></FormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn color="secondary" onClick={() => setShowModal(false)}>Batal</Btn>
          <Btn onClick={() => setShowModal(false)}>Simpan</Btn>
        </div>
      </Modal>
    </div>
  );
};

const CRMOrders = () => {
  const [showModal, setShowModal] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const toggle = id => setSelectedOrders(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  return (
    <div>
      <PageHeader title="Rekap Order" subtitle="Semua order aktif & historis"
        actions={[
          <Btn key="bulk" color="secondary"><Printer size={14} style={{ marginRight: 4 }} />Print Konfirmasi ({selectedOrders.length})</Btn>,
          <Btn key="add" onClick={() => setShowModal(true)}><Plus size={14} style={{ marginRight: 4 }} />Buat Order Baru</Btn>
        ]} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 16 }}>
        <StatCard label="Total Order Aktif" value={orders.filter(o => o.statusOrder !== "Selesai").length} icon={Package} color={COLORS.primary} />
        <StatCard label="Belum Lunas" value={orders.filter(o => o.statusPayment === "Belum Lunas").length} icon={CreditCard} color={COLORS.danger} />
        <StatCard label="DP 50%" value={orders.filter(o => o.statusPayment === "DP 50%").length} icon={AlertCircle} color={COLORS.warning} />
        <StatCard label="Nilai Total" value="Rp 24.8Jt" sub="Bulan ini" icon={DollarSign} color={COLORS.secondary} />
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead><tr>
            <th style={{ width: 36 }}><input type="checkbox" /></th>
            <th>No. Order</th><th>Customer</th><th>PIC</th><th>Tgl Kirim</th><th>Venue</th><th>Pax</th><th>Total</th><th>Status</th><th>Bayar</th><th>Aksi</th>
          </tr></thead>
          <tbody>{orders.map(o => (
            <tr key={o.id}>
              <td><input type="checkbox" checked={selectedOrders.includes(o.id)} onChange={() => toggle(o.id)} /></td>
              <td style={{ fontWeight: 700, color: COLORS.primary, fontSize: 12 }}>{o.id}</td>
              <td style={{ fontWeight: 500 }}>{o.customer}</td>
              <td style={{ fontSize: 12, color: COLORS.textSecondary }}>{o.pic}</td>
              <td style={{ fontSize: 12 }}>{o.deliveryDate}</td>
              <td style={{ fontSize: 12, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.venue}</td>
              <td style={{ textAlign: "center" }}>{o.pax}</td>
              <td style={{ fontWeight: 600, color: COLORS.primary }}>{fmt(o.total)}</td>
              <td>{statusBadge(o.statusOrder)}</td>
              <td>{statusBadge(o.statusPayment)}</td>
              <td><div style={{ display: "flex", gap: 4 }}><Btn size="sm" color="secondary">Detail</Btn><Btn size="sm" color="secondary"><Printer size={11} /></Btn></div></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
      <Modal show={showModal} onClose={() => setShowModal(false)} title="Buat Order Baru" width={620}>
        <FormRow>
          <FormField label="Customer"><select><option>Pilih Customer...</option>{customers.map(c => <option key={c.id}>{c.name}</option>)}</select></FormField>
          <FormField label="PIC CS"><select>{users.filter(u => u.role === "CS / Sales").map(u => <option key={u.id}>{u.name}</option>)}</select></FormField>
        </FormRow>
        <FormRow>
          <FormField label="Tanggal Order"><input type="date" defaultValue="2026-05-24" /></FormField>
          <FormField label="Tanggal Pengiriman"><input type="date" /></FormField>
        </FormRow>
        <FormRow>
          <FormField label="Waktu Berangkat"><input type="time" /></FormField>
          <FormField label="Waktu Tiba"><input type="time" /></FormField>
        </FormRow>
        <FormField label="Venue / Lokasi Acara"><input placeholder="Nama gedung, alamat lengkap..." /></FormField>
        <div style={{ margin: "14px 0 6px", fontSize: 12, fontWeight: 700, color: COLORS.textPrimary }}>Item Order</div>
        <table style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
          <thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
          <tbody><tr>
            <td><select style={{ border: "none", borderRadius: 0, background: "transparent", padding: 0, width: "100%" }}><option>Nasi Box Premium</option><option>Prasmanan VIP</option></select></td>
            <td><input type="number" style={{ border: "none", borderRadius: 0, textAlign: "center", padding: 0, width: 60 }} defaultValue={50} /></td>
            <td style={{ fontFamily: "monospace" }}>Rp 30.000</td>
            <td style={{ fontFamily: "monospace", fontWeight: 600 }}>Rp 1.500.000</td>
          </tr></tbody>
        </table>
        <Btn color="secondary" size="sm"><Plus size={12} style={{ marginRight: 4 }} />Tambah Item</Btn>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn color="secondary" onClick={() => setShowModal(false)}>Batal</Btn>
          <Btn onClick={() => setShowModal(false)}>Simpan Order</Btn>
        </div>
      </Modal>
    </div>
  );
};

const CSPerformance = () => {
  const weeklyData = [
    { week: "Pekan 1", Siti: 35.7, Rina: 20 }, { week: "Pekan 2", Siti: 33.3, Rina: 25 },
    { week: "Pekan 3", Siti: 31.3, Rina: 22.2 }, { week: "Pekan 4", Siti: 30, Rina: 18.2 },
  ];
  return (
    <div>
      <PageHeader title="Performa CS" subtitle="Closing rate & evaluasi per CS — pekanan & bulanan" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 16 }}>
        <StatCard label="CS Terbaik Bulan Ini" value="Siti N." sub="Closing rate 32.7%" icon={TrendingUp} color={COLORS.primary} />
        <StatCard label="Perlu Perhatian" value="Rina M." sub="Under perform 4 pekan" icon={AlertTriangle} color={COLORS.danger} />
        <StatCard label="Avg. Closing Rate" value="26.9%" sub="Target: 30%" icon={BarChart2} color={COLORS.secondary} />
        <StatCard label="Total Closing Bulan" value="25 Order" sub="52 + 38 lead masuk" icon={Target} color={COLORS.purple} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Tren Closing Rate (%) per Pekan</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} /><YAxis domain={[0, 50]} tickFormatter={v => v + "%"} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => v.toFixed(1) + "%"} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Siti" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Rina" stroke={COLORS.danger} strokeWidth={2} dot={{ r: 4 }} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
          <p style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>Garis putus = target minimum 30%</p>
        </Card>
        <Card>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Detail Performa Bulanan</p>
          <table>
            <thead><tr><th>CS</th><th>Lead</th><th>Closing</th><th>Rate</th><th>Status</th></tr></thead>
            <tbody>{csPerformance.map(cs => {
              const rate = cs.monthRate;
              const perf = rate >= 30 ? { label: "Bagus", color: "green" } : rate >= 25 ? { label: "Standar", color: "yellow" } : { label: "Under Perform", color: "red" };
              return (
                <tr key={cs.name}>
                  <td style={{ fontWeight: 500 }}>{cs.name}</td>
                  <td style={{ textAlign: "center" }}>{cs.monthLeads}</td>
                  <td style={{ textAlign: "center" }}>{cs.monthClosing}</td>
                  <td style={{ fontWeight: 700, color: rate >= 30 ? COLORS.primary : rate >= 25 ? COLORS.warning : COLORS.danger }}>{rate}%</td>
                  <td><Badge color={perf.color}>{perf.label}</Badge></td>
                </tr>
              );
            })}</tbody>
          </table>
          <div style={{ marginTop: 16, background: "#FCEBEB", borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#A32D2D" }}>Alert: Rina Marlina</p>
            <p style={{ fontSize: 11, color: "#A32D2D", marginTop: 4 }}>Under perform selama 4 pekan berturut-turut (target: 3 pekan). Segera dijadwalkan coaching session.</p>
          </div>
        </Card>
      </div>
      <Card>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Detail Per Pekan</p>
        <table>
          <thead>
            <tr>
              <th rowSpan={2}>Nama CS</th>
              {[1, 2, 3, 4].map(w => <th key={w} colSpan={3} style={{ textAlign: "center", borderBottom: "none" }}>Pekan {w}</th>)}
            </tr>
            <tr>{[1, 2, 3, 4].map(w => <><th key={`l${w}`}>Lead</th><th key={`c${w}`}>Closing</th><th key={`r${w}`}>Rate</th></>)}</tr>
          </thead>
          <tbody>{csPerformance.map(cs => (
            <tr key={cs.name}>
              <td style={{ fontWeight: 600 }}>{cs.name}</td>
              {[cs.week1, cs.week2, cs.week3, cs.week4].map((w, i) => <>
                <td key={`l${i}`} style={{ textAlign: "center" }}>{w.leads}</td>
                <td key={`c${i}`} style={{ textAlign: "center" }}>{w.closing}</td>
                <td key={`r${i}`} style={{ textAlign: "center", fontWeight: 600, color: w.rate >= 30 ? COLORS.primary : w.rate >= 25 ? COLORS.warning : COLORS.danger }}>{w.rate}%</td>
              </>)}
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
};

const ChefSchedule = () => {
  const [showModal, setShowModal] = useState(false);
  return (
    <div>
      <PageHeader title="Jadwal Menu Produksi" subtitle="Chef — Perencanaan menu & estimasi HPP sebelum belanja"
        actions={[<Btn key="add" onClick={() => setShowModal(true)}><Plus size={14} style={{ marginRight: 4 }} />Buat Jadwal Menu</Btn>]} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 16 }}>
        <StatCard label="Jadwal Aktif" value={productionSchedules.length} icon={CalendarDays} color={COLORS.primary} />
        <StatCard label="Sudah Approved" value={productionSchedules.filter(p => p.status === "Approved").length} icon={CheckCircle} color={COLORS.success} />
        <StatCard label="Overbudget Warning" value={productionSchedules.filter(p => p.status === "Overbudget Warning").length} icon={AlertTriangle} color={COLORS.danger} />
        <StatCard label="Total Est. HPP" value={fmt(productionSchedules.reduce((a, b) => a + b.estimatedHPP, 0))} icon={DollarSign} color={COLORS.secondary} />
      </div>
      {productionSchedules.map(ps => {
        const pct_hpp = ((ps.estimatedHPP / ps.budgetLimit) * 100).toFixed(1);
        const isOver = ps.estimatedHPP > ps.budgetLimit;
        const barColor = isOver ? COLORS.danger : ps.estimatedHPP / ps.budgetLimit > 0.8 ? COLORS.warning : COLORS.primary;
        const menus = scheduleMenus.filter(m => m.schedule === ps.id);
        return (
          <Card key={ps.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <p style={{ fontSize: 15, fontWeight: 700 }}>Jadwal Produksi — {ps.date}</p>
                  {statusBadge(ps.status)}
                </div>
                <p style={{ fontSize: 12, color: COLORS.textSecondary }}>Chef: {ps.chef} | Orders: {ps.orders.join(", ")}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 12, color: COLORS.textSecondary }}>Revenue Agregat</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: COLORS.primary }}>{fmt(ps.revenue)}</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px" }}>
                <p style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: 600 }}>BUDGET LIMIT (50%)</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: COLORS.textPrimary, marginTop: 2 }}>{fmt(ps.budgetLimit)}</p>
              </div>
              <div style={{ background: isOver ? "#FCEBEB" : "#f9fafb", borderRadius: 8, padding: "10px 14px" }}>
                <p style={{ fontSize: 11, color: isOver ? "#A32D2D" : COLORS.textSecondary, fontWeight: 600 }}>EST. HPP CHEF</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: isOver ? COLORS.danger : COLORS.textPrimary, marginTop: 2 }}>{fmt(ps.estimatedHPP)}</p>
              </div>
              <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px" }}>
                <p style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: 600 }}>SISA ANGGARAN</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: isOver ? COLORS.danger : COLORS.primary, marginTop: 2 }}>{fmt(ps.budgetLimit - ps.estimatedHPP)}</p>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>
                <span>Progress HPP vs Budget</span>
                <span style={{ fontWeight: 700, color: barColor }}>{pct_hpp}% dari budget</span>
              </div>
              <div style={{ height: 10, background: "#f3f4f6", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: Math.min(pct_hpp, 100) + "%", background: barColor, borderRadius: 5, transition: "width 0.3s" }} />
              </div>
            </div>
            {isOver && (
              <div style={{ background: "#FCEBEB", border: "1px solid #F7C1C1", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#A32D2D" }}>ANGGARAN MELEBIHI BATAS — TOMBOL KIRIM PR TERKUNCI</p>
                <p style={{ fontSize: 11, color: "#A32D2D", marginTop: 2 }}>Est. HPP melebihi budget limit sebesar {fmt(ps.estimatedHPP - ps.budgetLimit)}. Chef wajib merevisi menu.</p>
              </div>
            )}
            {menus.length > 0 && (
              <table style={{ marginBottom: 12 }}>
                <thead><tr><th>Menu</th><th>Pax</th><th>HPP/Porsi</th><th>Subtotal HPP</th></tr></thead>
                <tbody>
                  {menus.map((m, i) => (
                    <tr key={i}><td>{m.menu}</td><td>{m.pax} pax</td><td>{fmt(m.hppUnit)}</td><td style={{ fontWeight: 600 }}>{fmt(m.hppTotal)}</td></tr>
                  ))}
                  <tr style={{ background: "#f9fafb" }}>
                    <td colSpan={3} style={{ fontWeight: 700 }}>TOTAL EST. HPP</td>
                    <td style={{ fontWeight: 700, fontSize: 14, color: isOver ? COLORS.danger : COLORS.primary }}>{fmt(ps.estimatedHPP)}</td>
                  </tr>
                </tbody>
              </table>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <Btn size="sm" color="secondary"><Plus size={12} style={{ marginRight: 4 }} />Tambah Menu</Btn>
              {!isOver && ps.status === "Approved" && <Btn size="sm"><Send size={12} style={{ marginRight: 4 }} />Generate Purchase Request</Btn>}
              {isOver && <Btn size="sm" color="secondary" disabled><Lock size={12} style={{ marginRight: 4 }} />Generate PR (Terkunci)</Btn>}
            </div>
          </Card>
        );
      })}
      <Modal show={showModal} onClose={() => setShowModal(false)} title="Buat Jadwal Menu Produksi" width={580}>
        <div style={{ background: "#F0E6FA", borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: "#3b047a", fontWeight: 600 }}>Budget akan otomatis dihitung 50% dari total revenue order yang dipilih</p>
        </div>
        <FormField label="Tanggal Produksi"><input type="date" /></FormField>
        <div style={{ margin: "12px 0 6px", fontSize: 12, fontWeight: 700 }}>Pilih Order (Agregasi)</div>
        {orders.filter(o => o.statusOrder !== "Selesai").map(o => (
          <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer", fontWeight: 400 }}>
            <input type="checkbox" style={{ width: "auto" }} /><span style={{ fontSize: 13 }}>{o.id} — {o.customer} — {fmt(o.total)} ({o.pax} pax)</span>
          </label>
        ))}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn color="secondary" onClick={() => setShowModal(false)}>Batal</Btn>
          <Btn onClick={() => setShowModal(false)}>Buat Jadwal</Btn>
        </div>
      </Modal>
    </div>
  );
};

const MasterResep = () => {
  const [showModal, setShowModal] = useState(false);
  return (
    <div>
      <PageHeader title="Master Resep & HPP Standar" subtitle="Database menu & harga pokok per porsi"
        actions={[<Btn key="add" onClick={() => setShowModal(true)}><Plus size={14} style={{ marginRight: 4 }} />Tambah Resep</Btn>]} />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead><tr><th>#</th><th>Nama Menu</th><th>Produk</th><th>Bahan Utama</th><th>HPP Standar/Porsi</th><th>Aksi</th></tr></thead>
          <tbody>{recipes.map(r => (
            <tr key={r.id}>
              <td style={{ color: COLORS.textSecondary, fontSize: 12 }}>{r.id}</td>
              <td style={{ fontWeight: 600 }}>{r.menuName}</td>
              <td><Badge color="blue">{r.product}</Badge></td>
              <td style={{ fontSize: 12, color: COLORS.textSecondary }}>{r.ingredients}</td>
              <td style={{ fontWeight: 700, color: COLORS.primary }}>{fmt(r.standardCost)}</td>
              <td><Btn size="sm" color="secondary"><Edit2 size={11} /></Btn></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
      <Modal show={showModal} onClose={() => setShowModal(false)} title="Tambah Resep Menu">
        <FormField label="Nama Menu"><input placeholder="Contoh: Rendang Daging Sapi" /></FormField>
        <FormField label="Produk"><select style={{ marginTop: 8 }}><option>Nasi Box Premium</option><option>Prasmanan VIP</option></select></FormField>
        <FormField label="Bahan-Bahan"><textarea rows={3} placeholder="Daging Sapi 200gr, Bumbu Rendang, Kelapa..." style={{ marginTop: 8 }} /></FormField>
        <FormField label="HPP Standar per Porsi (Rp)"><input type="number" placeholder="25000" style={{ marginTop: 8 }} /></FormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn color="secondary" onClick={() => setShowModal(false)}>Batal</Btn>
          <Btn onClick={() => setShowModal(false)}>Simpan</Btn>
        </div>
      </Modal>
    </div>
  );
};

const PurchasingPRPO = () => {
  const [showModal, setShowModal] = useState(false);
  return (
    <div>
      <PageHeader title="Purchase Request & Purchase Order" subtitle="Kelola PR dari Chef & eksekusi PO ke supplier"
        actions={[<Btn key="add" onClick={() => setShowModal(true)}><Plus size={14} style={{ marginRight: 4 }} />Buat PO</Btn>]} />
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: COLORS.textPrimary }}>Purchase Requests Masuk</p>
        {purchaseRequests.map(pr => (
          <Card key={pr.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14 }}>{pr.id} — Jadwal Produksi #{pr.schedule}</p>
                <p style={{ fontSize: 12, color: COLORS.textSecondary }}>Chef: {pr.chef} | {pr.date}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                {statusBadge(pr.status)}
                <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.primary, marginTop: 6 }}>{fmt(pr.total)}</p>
              </div>
            </div>
            <table>
              <thead><tr><th>Item</th><th>Qty</th><th>Satuan</th><th>Est. Harga</th><th>Subtotal</th></tr></thead>
              <tbody>{pr.items.map((item, i) => (
                <tr key={i}><td style={{ fontWeight: 500 }}>{item.name}</td><td>{item.qty}</td><td>{item.uom}</td><td>{fmt(item.estPrice)}</td><td style={{ fontWeight: 600 }}>{fmt(item.subtotal)}</td></tr>
              ))}</tbody>
            </table>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Btn size="sm"><Printer size={12} style={{ marginRight: 4 }} />Print PDF</Btn>
              <Btn size="sm" color="secondary">Buat PO dari PR ini</Btn>
            </div>
          </Card>
        ))}
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: COLORS.textPrimary }}>Purchase Orders</p>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead><tr><th>No. PO</th><th>PR Ref.</th><th>Purchasing</th><th>Tanggal</th><th>Est. Biaya</th><th>Aktual</th><th>Variance</th><th>Status</th><th>Catatan</th></tr></thead>
            <tbody>{purchaseOrders.map(po => (
              <tr key={po.id}>
                <td style={{ fontWeight: 700, color: COLORS.primary }}>{po.id}</td>
                <td>{po.prId}</td>
                <td style={{ fontSize: 12 }}>{po.purchasing}</td>
                <td style={{ fontSize: 12 }}>{po.poDate}</td>
                <td>{fmt(po.estimatedCost)}</td>
                <td style={{ fontWeight: 600, color: po.statusCost === "Overbudget" ? COLORS.danger : COLORS.primary }}>{fmt(po.actualCost)}</td>
                <td style={{ fontWeight: 700, color: COLORS.danger }}>+{fmt(po.variance)}</td>
                <td>{statusBadge(po.statusCost)}</td>
                <td style={{ fontSize: 11, color: COLORS.textSecondary, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{po.notes}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      </div>
      <Modal show={showModal} onClose={() => setShowModal(false)} title="Buat Purchase Order" width={580}>
        <FormRow>
          <FormField label="PR Referensi"><select><option>PR-001 — 19 Mei 2026</option></select></FormField>
          <FormField label="Tanggal Belanja"><input type="date" defaultValue="2026-05-18" /></FormField>
        </FormRow>
        <FormField label="Supplier/Pasar"><input placeholder="Pasar Induk, Supplier Langsung..." /></FormField>
        <FormField label="Purchasing" style={{ marginTop: 8 }}><select>{users.filter(u => u.role === "Purchasing").map(u => <option key={u.id}>{u.name}</option>)}</select></FormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn color="secondary" onClick={() => setShowModal(false)}>Batal</Btn>
          <Btn onClick={() => setShowModal(false)}>Buat PO</Btn>
        </div>
      </Modal>
    </div>
  );
};

const HargaPasar = () => {
  const [showModal, setShowModal] = useState(false);
  return (
    <div>
      <PageHeader title="Katalog Harga Pasar" subtitle="Update harga bahan baku — referensi kalkulasi HPP Chef"
        actions={[<Btn key="add" onClick={() => setShowModal(true)}><Plus size={14} style={{ marginRight: 4 }} />Update Harga</Btn>]} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 16 }}>
        <StatCard label="Item Naik Harga" value={ingredientPrices.filter(i => i.change > 0).length} sub="vs update sebelumnya" icon={TrendingUp} color={COLORS.danger} />
        <StatCard label="Item Turun Harga" value={ingredientPrices.filter(i => i.change < 0).length} icon={TrendingDown} color={COLORS.success} />
        <StatCard label="Item Harga Stabil" value={ingredientPrices.filter(i => i.change === 0).length} icon={RefreshCw} color={COLORS.gray} />
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead><tr><th>Nama Bahan</th><th>Kategori</th><th>Satuan</th><th>Harga Lalu</th><th>Harga Terkini</th><th>Perubahan</th><th>Update By</th><th>Tanggal</th><th>Aksi</th></tr></thead>
          <tbody>{ingredientPrices.map(item => (
            <tr key={item.id}>
              <td style={{ fontWeight: 600 }}>{item.name}</td>
              <td><Badge color="gray">{item.category}</Badge></td>
              <td style={{ fontSize: 12 }}>{item.uom}</td>
              <td style={{ fontSize: 12, color: COLORS.textSecondary }}>{fmt(item.lastPrice)}</td>
              <td style={{ fontWeight: 700 }}>{fmt(item.currentPrice)}</td>
              <td>
                <span style={{ fontWeight: 700, color: item.change > 10 ? COLORS.danger : item.change > 0 ? COLORS.warning : item.change < 0 ? COLORS.success : COLORS.textSecondary, display: "flex", alignItems: "center", gap: 4 }}>
                  {item.change > 0 ? <ArrowUpRight size={13} /> : item.change < 0 ? <ArrowDownRight size={13} /> : null}
                  {Math.abs(item.change).toFixed(1)}%
                </span>
              </td>
              <td style={{ fontSize: 12 }}>{item.updatedBy}</td>
              <td style={{ fontSize: 12, color: COLORS.textSecondary }}>{item.updatedAt}</td>
              <td><Btn size="sm" color="secondary"><Edit2 size={11} /></Btn></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
      <Modal show={showModal} onClose={() => setShowModal(false)} title="Update Harga Pasar">
        <FormRow>
          <FormField label="Nama Bahan"><input placeholder="Daging Sapi, Cabai, dll..." /></FormField>
          <FormField label="Kategori"><select><option>Protein</option><option>Bumbu</option><option>Pokok</option><option>Sayuran</option></select></FormField>
        </FormRow>
        <FormRow>
          <FormField label="Harga Terkini (Rp)"><input type="number" placeholder="125000" /></FormField>
          <FormField label="Satuan (UoM)"><select><option>Kg</option><option>Ekor</option><option>Ikat</option><option>Buah</option><option>Liter</option></select></FormField>
        </FormRow>
        <FormField label="Catatan"><input placeholder="Sumber harga, kondisi pasar..." /></FormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn color="secondary" onClick={() => setShowModal(false)}>Batal</Btn>
          <Btn onClick={() => setShowModal(false)}>Simpan Harga</Btn>
        </div>
      </Modal>
    </div>
  );
};

const FinanceRealisasi = () => {
  const [showModal, setShowModal] = useState(false);
  return (
    <div>
      <PageHeader title="Realisasi Cost & Overhead" subtitle="Keuangan — Input nota aktual & biaya overhead harian"
        actions={[
          <Btn key="oh" color="secondary" onClick={() => setShowModal(true)}><Plus size={14} style={{ marginRight: 4 }} />Overhead</Btn>,
          <Btn key="bpp"><Plus size={14} style={{ marginRight: 4 }} />Input BPP Aktual</Btn>
        ]} />
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Realisasi Purchase Order</p>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead><tr><th>PO ID</th><th>PR Ref</th><th>Est. HPP Chef</th><th>Aktual Nota</th><th>Variance</th><th>Status</th><th>Keterangan Selisih</th><th>Aksi</th></tr></thead>
            <tbody>{purchaseOrders.map(po => (
              <tr key={po.id}>
                <td style={{ fontWeight: 700, color: COLORS.primary }}>{po.id}</td>
                <td>{po.prId}</td>
                <td>{fmt(po.estimatedCost)}</td>
                <td style={{ fontWeight: 700, color: po.statusCost === "Overbudget" ? COLORS.danger : COLORS.primary }}>{fmt(po.actualCost)}</td>
                <td style={{ fontWeight: 700, color: COLORS.danger }}>+{fmt(po.variance)}</td>
                <td>{statusBadge(po.statusCost)}</td>
                <td style={{ fontSize: 11, color: COLORS.textSecondary, maxWidth: 200 }}>{po.notes}</td>
                <td><Btn size="sm" color="secondary"><Edit2 size={11} /></Btn></td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Biaya Overhead Harian</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 12 }}>
          {["Kemasan", "Transportasi", "Gas", "Uang Makan"].map(cat => {
            const total = overheads.filter(o => o.category === cat).reduce((a, b) => a + b.amount, 0);
            return <StatCard key={cat} label={cat} value={fmt(total)} color={COLORS.warning} />;
          })}
        </div>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead><tr><th>Tanggal</th><th>Kategori</th><th>Nominal</th><th>Catatan</th><th>Diinput Oleh</th></tr></thead>
            <tbody>{overheads.map(o => (
              <tr key={o.id}>
                <td>{o.date}</td>
                <td><Badge color="yellow">{o.category}</Badge></td>
                <td style={{ fontWeight: 600 }}>{fmt(o.amount)}</td>
                <td style={{ fontSize: 12, color: COLORS.textSecondary }}>{o.notes}</td>
                <td style={{ fontSize: 12 }}>{o.finance}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      </div>
      <Modal show={showModal} onClose={() => setShowModal(false)} title="Tambah Biaya Overhead">
        <FormRow>
          <FormField label="Tanggal"><input type="date" defaultValue="2026-05-24" /></FormField>
          <FormField label="Kategori"><select><option>Gas</option><option>Listrik</option><option>Transportasi</option><option>Kemasan</option><option>Uang Makan</option><option>Lainnya</option></select></FormField>
        </FormRow>
        <FormField label="Nominal (Rp)"><input type="number" placeholder="200000" /></FormField>
        <FormField label="Catatan"><input placeholder="Keterangan pengeluaran..." style={{ marginTop: 8 }} /></FormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn color="secondary" onClick={() => setShowModal(false)}>Batal</Btn>
          <Btn onClick={() => setShowModal(false)}>Simpan</Btn>
        </div>
      </Modal>
    </div>
  );
};

const PLDashboard = () => {
  const totalRevenue = plData.reduce((a, b) => a + b.revenue, 0);
  const totalBPP = plData.reduce((a, b) => a + b.bpp, 0);
  const totalOH = plData.reduce((a, b) => a + b.overhead, 0);
  const totalProfit = plData.reduce((a, b) => a + b.grossProfit, 0);
  const pieData = [
    { name: "BPP Aktual", value: totalBPP },
    { name: "Overhead", value: totalOH },
    { name: "Laba Kotor", value: totalProfit },
  ];
  const PIE_COLORS = [COLORS.coral, COLORS.warning, COLORS.primary];
  return (
    <div>
      <PageHeader title="Daily Catering Profit Report (P&L)" subtitle="Owner — Monitoring laba rugi real-time" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 16 }}>
        <StatCard label="Total Revenue" value={fmt(totalRevenue)} sub="7 hari" icon={TrendingUp} color={COLORS.primary} />
        <StatCard label="Total BPP Aktual" value={fmt(totalBPP)} sub={pct(totalBPP, totalRevenue)} icon={ShoppingCart} color={COLORS.coral} />
        <StatCard label="Total Overhead" value={fmt(totalOH)} sub={pct(totalOH, totalRevenue)} icon={Settings} color={COLORS.warning} />
        <StatCard label="Laba Kotor" value={fmt(totalProfit)} sub={pct(totalProfit, totalRevenue)} icon={DollarSign} color={COLORS.secondary} />
        <StatCard label="Avg. Margin" value="46.6%" sub="Target: ≥40%" icon={Target} color={COLORS.success} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Laporan P&L Harian (Area Chart)</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={plData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.1} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tickFormatter={v => (v / 1000000).toFixed(1) + "Jt"} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => fmt(v)} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke={COLORS.primary} fill="url(#revGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="bpp" name="BPP" stroke={COLORS.coral} fill="none" strokeWidth={2} strokeDasharray="4 2" />
              <Area type="monotone" dataKey="grossProfit" name="Laba Kotor" stroke={COLORS.secondary} fill="url(#profGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Komposisi Biaya</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} /><Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
        <table>
          <thead><tr><th>Tanggal</th><th>Revenue</th><th>BPP Aktual</th><th>% BPP</th><th>Overhead</th><th>Laba Kotor</th><th>Margin %</th><th>Status</th></tr></thead>
          <tbody>
            {plData.map((d, i) => {
              const bppPct = ((d.bpp / d.revenue) * 100).toFixed(1);
              const status = d.margin >= 45 ? { label: "Sehat", color: "green" } : d.margin >= 40 ? { label: "OK", color: "yellow" } : { label: "Perlu Perhatian", color: "red" };
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{d.date}</td>
                  <td style={{ fontWeight: 600, color: COLORS.primary }}>{fmt(d.revenue)}</td>
                  <td>{fmt(d.bpp)}</td>
                  <td style={{ color: bppPct > 55 ? COLORS.danger : bppPct > 50 ? COLORS.warning : COLORS.success, fontWeight: 700 }}>{bppPct}%</td>
                  <td>{fmt(d.overhead)}</td>
                  <td style={{ fontWeight: 700 }}>{fmt(d.grossProfit)}</td>
                  <td style={{ fontWeight: 700, color: d.margin >= 45 ? COLORS.primary : d.margin >= 40 ? COLORS.warning : COLORS.danger }}>{d.margin}%</td>
                  <td>{statusBadge(status.label)}</td>
                </tr>
              );
            })}
            <tr style={{ background: "#f9fafb", borderTop: "2px solid #e5e7eb" }}>
              <td style={{ fontWeight: 800 }}>TOTAL</td>
              <td style={{ fontWeight: 800, color: COLORS.primary }}>{fmt(totalRevenue)}</td>
              <td style={{ fontWeight: 700 }}>{fmt(totalBPP)}</td>
              <td style={{ fontWeight: 700 }}>{((totalBPP / totalRevenue) * 100).toFixed(1)}%</td>
              <td style={{ fontWeight: 700 }}>{fmt(totalOH)}</td>
              <td style={{ fontWeight: 800, color: COLORS.secondary }}>{fmt(totalProfit)}</td>
              <td style={{ fontWeight: 800, color: COLORS.primary }}>46.6%</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </Card>
      <Card>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Leakage Log — Catatan Kebocoran Anggaran</p>
        {purchaseOrders.filter(po => po.statusCost === "Overbudget").map(po => (
          <div key={po.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: "0.5px solid #f3f4f6" }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FCEBEB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <DollarSign size={16} color={COLORS.danger} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <p style={{ fontSize: 12, fontWeight: 700 }}>{po.id} — Est: {fmt(po.estimatedCost)} → Aktual: {fmt(po.actualCost)}</p>
                <Badge color="red">+{fmt(po.variance)}</Badge>
              </div>
              <p style={{ fontSize: 11, color: COLORS.textSecondary }}>{po.notes}</p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
};

const UserManagement = () => {
  const [showModal, setShowModal] = useState(false);
  const roleColors = { "Super Admin": "purple", "CS / Sales": "blue", "Kitchen": "teal", "Finance": "yellow", "Purchasing": "gray" };
  return (
    <div>
      <PageHeader title="Manajemen Pengguna" subtitle="Kelola akun & role semua pengguna sistem"
        actions={[<Btn key="add" onClick={() => setShowModal(true)}><UserPlus size={14} style={{ marginRight: 4 }} />Tambah User</Btn>]} />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>{users.map(u => (
            <tr key={u.id}>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS.primary + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: COLORS.primary }}>{u.avatar}</div>
                  <p style={{ fontWeight: 500 }}>{u.name}</p>
                </div>
              </td>
              <td style={{ fontSize: 12, fontFamily: "monospace" }}>{u.email}</td>
              <td><Badge color={roleColors[u.role] || "gray"}>{u.role}</Badge></td>
              <td>{statusBadge(u.status)}</td>
              <td><div style={{ display: "flex", gap: 4 }}><Btn size="sm" color="secondary"><Edit2 size={11} /></Btn><Btn size="sm" color="secondary"><Lock size={11} /></Btn></div></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
      <Modal show={showModal} onClose={() => setShowModal(false)} title="Tambah User Baru">
        <FormRow>
          <FormField label="Nama Lengkap"><input placeholder="Nama pengguna" /></FormField>
          <FormField label="Email"><input type="email" placeholder="email@catering.com" /></FormField>
        </FormRow>
        <FormRow>
          <FormField label="Role"><select><option>CS / Sales</option><option>Kitchen</option><option>Purchasing</option><option>Finance</option><option>Super Admin</option></select></FormField>
          <FormField label="Password Awal"><input type="password" placeholder="Min. 8 karakter" /></FormField>
        </FormRow>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn color="secondary" onClick={() => setShowModal(false)}>Batal</Btn>
          <Btn onClick={() => setShowModal(false)}>Buat Akun</Btn>
        </div>
      </Modal>
    </div>
  );
};

// ── MENU & ROUTING ────────────────────────────────────────────────────────────
const MENU = [
  { section: "Dashboard", items: [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    section: "CRM", items: [
      { key: "crm-leads", label: "Lead Harian", icon: Inbox },
      { key: "crm-customers", label: "Data Kontak", icon: Users },
      { key: "crm-orders", label: "Order", icon: ShoppingBag },
      { key: "crm-performance", label: "Performa CS", icon: BarChart2 },
    ]
  },
  {
    section: "Cost Control — Chef", items: [
      { key: "chef-schedule", label: "Jadwal Produksi", icon: CalendarDays },
      { key: "chef-recipes", label: "Master Resep", icon: BookOpen },
    ]
  },
  {
    section: "Purchasing", items: [
      { key: "purchasing-prpo", label: "PR & PO", icon: ClipboardList },
      { key: "purchasing-prices", label: "Harga Pasar", icon: TrendingUp },
    ]
  },
  {
    section: "Keuangan", items: [
      { key: "finance-cost", label: "Realisasi Cost", icon: CreditCard },
    ]
  },
  {
    section: "Owner / Admin", items: [
      { key: "owner-pl", label: "P&L Dashboard", icon: PieIcon },
      { key: "target-kpi", label: "Target & Realisasi", icon: Target },
      { key: "admin-users", label: "Manajemen User", icon: Settings },
    ]
  },
];
const PAGE_MAP = {
  dashboard: Dashboard, "crm-leads": CRMLeads, "crm-customers": CRMCustomers,
  "crm-orders": CRMOrders, "crm-performance": CSPerformance,
  "chef-schedule": ChefSchedule, "chef-recipes": MasterResep,
  "purchasing-prpo": PurchasingPRPO, "purchasing-prices": HargaPasar,
  "finance-cost": FinanceRealisasi, "owner-pl": PLDashboard,
  "target-kpi": TargetManagement, "admin-users": UserManagement,
};

// ── APP SHELL ─────────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const ActivePage = PAGE_MAP[active] || Dashboard;

  const navClick = key => { setActive(key); if (window.innerWidth < 768) setSidebarOpen(false); };

  return (
    <>
      <style>{globalStyle}</style>
      <div style={{ display: "flex", minHeight: "100vh", fontFamily: FONT, background: "#f3f4f6", position: "relative" }}>

        {/* MOBILE OVERLAY */}
        {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ display: "none", position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 98 }} className="sidebar-overlay" />}

        {/* SIDEBAR — solid green */}
        <div style={{
          width: sidebarOpen ? 220 : 0, minWidth: sidebarOpen ? 220 : 0,
          background: COLORS.sidebar,
          display: "flex", flexDirection: "column",
          overflowX: "hidden", transition: "all 0.22s ease",
          flexShrink: 0, zIndex: 99,
          position: window.innerWidth < 768 ? "fixed" : "relative",
          height: window.innerWidth < 768 ? "100vh" : "auto",
          top: 0, left: 0,
        }}>
          {/* Brand */}
          <div style={{ padding: "20px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Utensils size={18} color="white" />
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: 15, color: "white", lineHeight: 1 }}>Dyummy</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>Catering ERP</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
            {MENU.map(section => (
              <div key={section.section}>
                <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "10px 16px 4px" }}>{section.section}</p>
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive = active === item.key;
                  return (
                    <button key={item.key} onClick={() => navClick(item.key)} style={{
                      display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 16px",
                      background: isActive ? "rgba(255,255,255,0.18)" : "transparent",
                      color: "white", fontSize: 13, fontWeight: isActive ? 600 : 400,
                      border: "none", borderRadius: 0, cursor: "pointer", textAlign: "left",
                      borderLeft: isActive ? "3px solid white" : "3px solid transparent",
                      opacity: isActive ? 1 : 0.8,
                    }}>
                      <Icon size={15} style={{ flexShrink: 0 }} />{item.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* User */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white" }}>SA</div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "white" }}>Super Admin</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>admin@catering.com</p>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Topbar */}
          <div style={{ height: 52, background: "white", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0, position: "sticky", top: 0, zIndex: 90 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textSecondary, padding: 4, display: "flex" }}>
              <Menu size={20} />
            </button>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: COLORS.textSecondary }}>
                {MENU.flatMap(s => s.items).find(i => i.key === active)?.label || "Dashboard"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 11, color: COLORS.textSecondary, background: "#f9fafb", border: "0.5px solid #e5e7eb", padding: "4px 10px", borderRadius: 20 }}>Super Admin Mode</div>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.success }} />
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>
            <ActivePage />
          </div>
        </div>
      </div>
    </>
  );
}
