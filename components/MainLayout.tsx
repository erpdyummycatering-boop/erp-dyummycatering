"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Inbox, Users, ShoppingBag, BarChart2,
  CalendarDays, BookOpen, ClipboardList, TrendingUp, CreditCard,
  PieChart, Settings, Menu, X, Utensils, Target, ChefHat,
  ShoppingCart, DollarSign, Layers, LogIn, LogOut,
} from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import { getRoleConfig, ROLES } from "@/lib/roleConfig";

const ALL_MENU = [
  {
    section: "Dashboard",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    section: "CRM",
    items: [
      { href: "/leads", label: "Lead Harian", icon: Inbox },
      { href: "/customers", label: "Data Kontak", icon: Users },
      { href: "/orders", label: "Order", icon: ShoppingBag },
      { href: "/cs-performance", label: "Performa CS", icon: BarChart2 },
    ],
  },
  {
    section: "Cost Control — Chef",
    items: [
      { href: "/production-schedules", label: "Jadwal Produksi", icon: CalendarDays },
      { href: "/recipes", label: "Master Resep", icon: BookOpen },
    ],
  },
  {
    section: "Purchasing",
    items: [
      { href: "/purchasing", label: "PR & PO", icon: ClipboardList },
      { href: "/market-prices", label: "Harga Pasar", icon: TrendingUp },
    ],
  },
  {
    section: "Keuangan",
    items: [
      { href: "/finance", label: "Realisasi Cost", icon: CreditCard },
    ],
  },
  {
    section: "Owner / Admin",
    items: [
      { href: "/pl-dashboard", label: "P&L Dashboard", icon: PieChart },
      { href: "/targets", label: "Target & Realisasi", icon: Target },
      { href: "/settings", label: "Manajemen User", icon: Settings },
      { href: "/products", label: "Katalog Produk", icon: Layers },
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
      if (activeRole !== "super_admin") {
        router.replace(roleConfig.firstPage);
      }
    } else if (!isAllowed) {
      router.replace(roleConfig.firstPage);
    }
  }, [pathname, activeRole, roleConfig.firstPage, roleConfig.allowedHrefs, loading, isPublicPage, router]);

  if (loading && !isPublicPage) {
    return (
      <div style={{
        display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center",
        background: "#0d011e", color: "white", flexDirection: "column", gap: 16
      }}>
        <div style={{
          width: 40, height: 40, border: "3px solid rgba(255,255,255,0.2)",
          borderTopColor: "white", borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }} />
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Memuat sesi...</p>
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

  // Filter menu by role
  const allowedHrefs = roleConfig.allowedHrefs;
  const visibleMenu = allowedHrefs === "*"
    ? ALL_MENU
    : ALL_MENU.map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          (allowedHrefs as string[]).includes(item.href)
        ),
      })).filter((section) => section.items.length > 0);

  const activeLabel =
    ALL_MENU.flatMap((s) => s.items).find((i) => i.href === pathname)?.label || "Dashboard";

  // Redirect if current page not accessible by this role
  // (handled gracefully — just shows empty content, no hard redirect)

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6", position: "relative" }}>
      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div
          style={{ display: "block", position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 98 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ────────────────────────────────────────── */}
      <aside
        style={{
          width: sidebarOpen ? 224 : 0,
          minWidth: sidebarOpen ? 224 : 0,
          background: "#3b047a",
          display: "flex",
          flexDirection: "column",
          overflowX: "hidden",
          transition: "all 0.22s ease",
          flexShrink: 0,
          zIndex: 99,
          position: isMobile ? "fixed" : "relative",
          height: isMobile ? "100vh" : "auto",
          top: 0,
          left: 0,
        }}
      >
        {/* Brand */}
        <div style={{ padding: "20px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Utensils size={18} color="white" />
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 15, color: "white", lineHeight: 1, letterSpacing: "-0.02em" }}>
                Dyummy
              </p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 500, marginTop: 2 }}>
                Catering ERP
              </p>
            </div>
          </div>
        </div>

        {/* Role badge in sidebar */}
        <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{
            background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: roleConfig.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 800, color: "white", flexShrink: 0,
            }}>
              {roleConfig.initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {roleConfig.label}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
          {visibleMenu.map((section) => (
            <div key={section.section}>
              <p style={{
                fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase", letterSpacing: "0.08em",
                padding: "10px 16px 4px", whiteSpace: "nowrap",
              }}>
                {section.section}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 9,
                      padding: "8px 16px",
                      background: isActive ? "rgba(255,255,255,0.18)" : "transparent",
                      color: "white",
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      borderLeft: isActive ? "3px solid white" : "3px solid transparent",
                      opacity: isActive ? 1 : 0.82,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 0.12s",
                    }}>
                      <Icon size={15} style={{ flexShrink: 0 }} />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}

        </nav>

      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {/* Topbar */}
        <header style={{
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
        }}>
          <button
            id="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 4, display: "flex", alignItems: "center" }}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{activeLabel}</p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* Role chip */}
            <span style={{
              fontSize: 11,
              background: roleConfig.bgColor,
              color: roleConfig.color,
              border: `1px solid ${roleConfig.color}40`,
              padding: "4px 10px",
              borderRadius: 20,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: roleConfig.color, display: "inline-block",
              }} />
              {roleConfig.label}
            </span>

            {/* Profile Avatar and Name */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: "1px solid #e5e7eb", paddingLeft: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: roleConfig.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, color: "white",
              }}>
                {roleConfig.initials}
              </div>
              {!isMobile && (
                <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
                  {user?.name || "User"}
                </span>
              )}
            </div>

            {/* Logout Button */}
            <button
              onClick={() => logout()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                background: "rgba(226, 75, 74, 0.1)",
                color: "#E24B4A",
                border: "1px solid rgba(226, 75, 74, 0.2)",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(226, 75, 74, 0.2)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(226, 75, 74, 0.1)";
              }}
            >
              <LogOut size={13} />
              {!isMobile && <span>Keluar</span>}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
