"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, ShoppingBag, BarChart2,
  CalendarDays, BookOpen, ClipboardList, TrendingUp, CreditCard,
  PieChart, Settings, Menu, X, Utensils, Target,
  ShoppingCart, Layers, LogIn, LogOut, MapPin, Truck, ChevronRight,
  UserCheck, DollarSign, UploadCloud, FileText, Clock, Building
} from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import { getRoleConfig, ROLES } from "@/lib/roleConfig";

// Structuring Rumpun (Primary Module Categories for Left Panel)
export interface ModuleGroup {
  id: string;
  label: string;
  icon: any;
  sections: {
    section: string;
    items: {
      href: string;
      label: string;
      icon: any;
    }[];
  }[];
}

const RUMPUN_MENU: ModuleGroup[] = [
  {
    id: "dashboard",
    label: "OVERVIEW",
    icon: LayoutDashboard,
    sections: [
      {
        section: "Dashboard Main",
        items: [
          { href: "/cs-performance", label: "Performa CS", icon: LayoutDashboard },
        ],
      },
    ],
  },
  {
    id: "hr",
    label: "HR & PAYROLL",
    icon: UserCheck,
    sections: [
      {
        section: "Master Data HR",
        items: [
          { href: "/hr/karyawan", label: "Data Karyawan", icon: Users },
          { href: "/hr/jabatan", label: "Jabatan & Dept", icon: Building },
          { href: "/hr/struktur-gaji", label: "Struktur Gaji", icon: DollarSign },
          { href: "/hr/shift", label: "Jadwal Shift", icon: Clock },
          { href: "/hr/konfigurasi-aturan", label: "Aturan & Override", icon: Settings },
        ],
      },
      {
        section: "Presensi & Kehadiran",
        items: [
          { href: "/hr/presensi/upload", label: "Upload Presensi", icon: UploadCloud },
          { href: "/hr/presensi/rekap", label: "Rekap Kehadiran", icon: CalendarDays },
          { href: "/hr/presensi/koreksi", label: "Koreksi Presensi", icon: ClipboardList },
        ],
      },
      {
        section: "Penggajian & Slip",
        items: [
          { href: "/hr/driver-trips", label: "Trip & KM Driver", icon: Truck },
          { href: "/hr/payroll/proses", label: "Proses Payroll", icon: DollarSign },
          { href: "/hr/payroll/riwayat", label: "Riwayat Payroll", icon: FileText },
        ],
      },
    ],
  },
  {
    id: "siap-saji",
    label: "SIAP SAJI",
    icon: ShoppingCart,
    sections: [
      {
        section: "Operasional Penjualan",
        items: [
          { href: "/siap-saji/dashboard", label: "Dashboard SS", icon: LayoutDashboard },
          { href: "/siap-saji/orders", label: "Order Siap Saji", icon: ShoppingCart },
          { href: "/siap-saji/shipping-monitoring", label: "Monitoring Pengiriman", icon: Truck },
          { href: "/siap-saji/documents", label: "Dokumen Harian", icon: ClipboardList },
        ],
      },
      {
        section: "Analisa & Laporan",
        items: [
          { href: "/siap-saji/analytics/products", label: "Analisa Produk", icon: BarChart2 },
          { href: "/siap-saji/analytics/customers", label: "Analisa Customer (RFM)", icon: PieChart },
          { href: "/siap-saji/finance", label: "Laporan Keuangan", icon: CreditCard },
        ],
      },
      {
        section: "Master Data SS",
        items: [
          { href: "/siap-saji/shipping", label: "Master Ongkir", icon: MapPin },
          { href: "/siap-saji/drivers", label: "Master Driver", icon: Truck },
          { href: "/siap-saji/customers", label: "Master Pelanggan", icon: Users },
          { href: "/siap-saji/products", label: "Katalog Produk", icon: Layers },
          { href: "/siap-saji/master-data", label: "Wilayah & Channel", icon: Settings },
        ],
      },
    ],
  },
  {
    id: "crm",
    label: "CATERING",
    icon: ShoppingBag,
    sections: [
      {
        section: "CRM Catering",
        items: [
          { href: "/customers", label: "Data Kontak", icon: Users },
          { href: "/orders", label: "Order Catering", icon: ShoppingBag },
        ],
      },
    ],
  },
  {
    id: "kitchen",
    label: "KITCHEN",
    icon: BookOpen,
    sections: [
      {
        section: "Cost Control — Chef",
        items: [
          { href: "/production-schedules", label: "Jadwal Produksi", icon: CalendarDays },
          { href: "/recipes", label: "Master Resep", icon: BookOpen },
        ],
      },
    ],
  },
  {
    id: "purchasing",
    label: "PURCHASING",
    icon: ClipboardList,
    sections: [
      {
        section: "Purchasing",
        items: [
          { href: "/purchasing", label: "PR & PO", icon: ClipboardList },
          { href: "/market-prices", label: "Harga Pasar", icon: TrendingUp },
        ],
      },
    ],
  },
  {
    id: "finance",
    label: "KEUANGAN",
    icon: CreditCard,
    sections: [
      {
        section: "Keuangan",
        items: [
          { href: "/finance", label: "Realisasi Cost", icon: CreditCard },
        ],
      },
    ],
  },
  {
    id: "admin",
    label: "ADMIN",
    icon: Settings,
    sections: [
      {
        section: "Owner / Admin",
        items: [
          { href: "/pl-dashboard", label: "P&L Dashboard", icon: PieChart },
          { href: "/targets", label: "Target & Realisasi", icon: Target },
          { href: "/settings", label: "Manajemen User", icon: Settings },
          { href: "/products", label: "Katalog Produk", icon: Layers },
        ],
      },
    ],
  },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { activeRole, user, loading, logout } = useRole();
  const roleConfig = getRoleConfig(activeRole);

  // Active module state for double sidebar
  const [activeModuleId, setActiveModuleId] = useState<string>("siap-saji");

  // Auto detect active module based on current pathname
  useEffect(() => {
    if (!pathname) return;
    for (const mod of RUMPUN_MENU) {
      for (const sec of mod.sections) {
        if (sec.items.some(item => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/")))) {
          setActiveModuleId(mod.id);
          return;
        }
      }
    }
  }, [pathname]);

  // Hide sidebar on login/print pages
  const isPublicPage =
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/print");

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [pathname, isMobile]);

  // Route protection and landing redirect based on role config
  useEffect(() => {
    if (loading || isPublicPage) return;

    const allowedHrefs = roleConfig.allowedHrefs;
    const currentPath = pathname || "";
    const isAllowed = allowedHrefs === "*" || (allowedHrefs as string[]).some(href => {
      if (currentPath === href) return true;
      if (href !== "/" && currentPath.startsWith(href + "/")) return true;
      return false;
    });

    if (currentPath === "/" || currentPath === "/dashboard") {
      router.replace(roleConfig.firstPage);
    } else if (!isAllowed) {
      router.replace(roleConfig.firstPage);
    }
  }, [pathname, activeRole, roleConfig.firstPage, roleConfig.allowedHrefs, loading, isPublicPage, router]);

  if (loading && !isPublicPage) {
    return (
      <div style={{
        display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center",
        background: "#3b047a", color: "white", flexDirection: "column", gap: 16
      }}>
        <div style={{
          width: 40, height: 40, border: "3px solid rgba(255,255,255,0.2)",
          borderTopColor: "white", borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }} />
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)" }}>Memuat sesi...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (isPublicPage) {
    return <>{children}</>;
  }

  // Filter modules & sub-sections allowed for active role
  const allowedHrefs = roleConfig.allowedHrefs;
  const filterHrefs = (href: string) => allowedHrefs === "*" || (allowedHrefs as string[]).includes(href);

  const visibleModules = RUMPUN_MENU.map(mod => {
    const validSections = mod.sections.map(sec => ({
      ...sec,
      items: sec.items.filter(item => filterHrefs(item.href))
    })).filter(sec => sec.items.length > 0);

    return {
      ...mod,
      sections: validSections
    };
  }).filter(mod => mod.sections.length > 0);

  // Active module data
  const currentModule = visibleModules.find(m => m.id === activeModuleId) || visibleModules[0];

  // Active page label
  const allItems = RUMPUN_MENU.flatMap(m => m.sections.flatMap(s => s.items));
  const activeLabel = allItems.find(i => i.href === pathname)?.label || "Dashboard";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6", position: "relative" }}>
      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div
          style={{ display: "block", position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 98 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── DOUBLE SIDEBAR CONTAINER ────────────────────────── */}
      <aside
        style={{
          display: "flex",
          position: isMobile ? "fixed" : "sticky",
          height: "100vh",
          top: 0,
          left: 0,
          zIndex: 99,
          width: sidebarOpen ? 288 : 0,
          minWidth: sidebarOpen ? 288 : 0,
          overflow: "hidden",
          transition: "all 0.22s ease",
          boxShadow: isMobile && sidebarOpen ? "4px 0 20px rgba(0,0,0,0.2)" : "none",
          flexShrink: 0,
        }}
      >
        {/* ── PRIMARY SLIM PANEL (RUMPUN MENU) ────────────────────── */}
        <div
          style={{
            width: 78,
            minWidth: 78,
            background: "#800688", // Darker magenta tone for left primary panel
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 16,
            paddingBottom: 16,
            borderRight: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
            overflowY: "auto",
          }}
        >
          {/* Brand Logo Icon */}
          <div
            title="Dyummy Catering ERP"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
              flexShrink: 0,
              cursor: "pointer",
            }}
          >
            <Utensils size={22} color="white" />
          </div>

          {/* Rumpun Icon List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", padding: "0 8px" }}>
            {visibleModules.map((mod) => {
              const Icon = mod.icon;
              const isSelected = mod.id === (currentModule?.id || activeModuleId);

              return (
                <button
                  key={mod.id}
                  onClick={() => {
                    setActiveModuleId(mod.id);
                    // Navigate to first item if current route not in module
                    const firstHref = mod.sections[0]?.items[0]?.href;
                    if (firstHref) router.push(firstHref);
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "10px 4px",
                    borderRadius: 12,
                    background: isSelected ? "#ffffff" : "transparent",
                    color: isSelected ? "#B10FBD" : "rgba(255,255,255,0.75)",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: isSelected ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                  }}
                >
                  <Icon size={20} style={{ marginBottom: 4 }} />
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      textAlign: "center",
                      lineHeight: 1.1,
                      textTransform: "uppercase",
                    }}
                  >
                    {mod.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── SECONDARY SUB-MENU PANEL ────────────────────────────── */}
        <div
          style={{
            width: 210,
            minWidth: 210,
            background: "#B10FBD", // Original rich Magenta
            display: "flex",
            flexDirection: "column",
            overflowX: "hidden",
            flexShrink: 0,
          }}
        >
          {/* Top Brand Name */}
          <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.12)", flexShrink: 0 }}>
            <p style={{ fontWeight: 800, fontSize: 17, color: "white", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              Dyummy Catering
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 500, marginTop: 4 }}>
              {currentModule?.label || "SIAP SAJI"} MODULE
            </p>
          </div>

          {/* Role badge */}
          <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
            <div
              style={{
                background: "rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "6px 10px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: roleConfig.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 800,
                  color: "white",
                  flexShrink: 0,
                }}
              >
                {roleConfig.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {roleConfig.label}
                </p>
              </div>
            </div>
          </div>

          {/* Sub Navigation Items */}
          <nav style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "10px 0" }}>
            {currentModule?.sections.map((section) => (
              <div key={section.section} style={{ marginBottom: 12 }}>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.5)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    padding: "8px 16px 4px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {section.section}
                </p>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href + "/"));

                  return (
                    <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                          padding: "8px 16px",
                          background: isActive ? "rgba(255,255,255,0.22)" : "transparent",
                          color: "white",
                          fontSize: 13,
                          fontWeight: isActive ? 700 : 400,
                          borderLeft: isActive ? "3px solid #ffffff" : "3px solid transparent",
                          opacity: isActive ? 1 : 0.85,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          transition: "all 0.12s",
                        }}
                      >
                        <Icon size={15} style={{ flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                        {isActive && <ChevronRight size={13} style={{ flexShrink: 0, opacity: 0.8 }} />}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {/* Topbar */}
        <header
          style={{
            height: 52,
            background: "white",
            borderBottom: "0.5px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: 12,
            flexShrink: 0,
            position: "sticky",
            top: 0,
            zIndex: 90,
          }}
        >
          <button
            id="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 4, display: "flex", alignItems: "center" }}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Current page title */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>
              {currentModule?.label}
            </span>
            <span style={{ fontSize: 13, color: "#d1d5db" }}>/</span>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{activeLabel}</h2>
          </div>

          <div style={{ flex: 1 }} />

          {/* Role switcher badge dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 20,
                background: roleConfig.bgColor,
                border: `1px solid ${roleConfig.color}40`,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: roleConfig.color,
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 600, color: roleConfig.color }}>
                {roleConfig.label}
              </span>
            </div>

            {/* User Profile */}
            {user && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 8, borderLeft: "1px solid #e5e7eb" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "#5005A6",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {user.name ? user.name.slice(0, 2).toUpperCase() : "U"}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{user.name}</span>
                <button
                  onClick={() => logout()}
                  title="Keluar"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "#fef2f2",
                    color: "#dc2626",
                    border: "1px solid #fecaca",
                    borderRadius: 6,
                    padding: "4px 8px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    marginLeft: 4,
                  }}
                >
                  <LogOut size={13} />
                  <span>Keluar</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ padding: isMobile ? "16px 12px" : "24px 32px", maxWidth: "1600px", margin: "0 auto", width: "100%" }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
