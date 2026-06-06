"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, AlertTriangle, CheckCircle,
  Send, ChefHat, ShoppingCart, RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { fmt, statusBadgeColor } from "@/lib/utils";

export default function ScheduleDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();

  const [sched, setSched] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // BOM — dua mode: Resep & Custom
  const [bomMode, setBomMode] = useState<"resep" | "custom">("resep");
  const [showBomModal, setShowBomModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title?: string; message: string; danger?: boolean; onConfirm: () => void; } | null>(null);

  // Mode Resep
  const [bomResep, setBomResep] = useState({ recipe_id: "", quantity_pax: "" });

  // Mode Custom
  const [bomCustom, setBomCustom] = useState({ item_name: "", quantity: "", uom: "kg", estimated_price: "" });

  const fetchSched = useCallback(() => {
    setLoading(true);
    fetch(`/api/production-schedules/${id}`)
      .then(r => r.json())
      .then(d => setSched(d))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchSched();
    fetch("/api/recipes?limit=100").then(r => r.json()).then(d => setRecipes(d.data || []));
  }, [fetchSched]);

  // ---- HPP Progress Bar ----
  const budgetLimit = Number(sched?.budget_limit || 0);
  const totalHPP = Number(sched?.total_estimated_hpp || 0);
  const totalRevenue = Number(sched?.total_revenue || 0);
  const hppPct = budgetLimit > 0 ? Math.min((totalHPP / budgetLimit) * 100, 100) : 0;
  const isOverBudget = totalHPP > budgetLimit && budgetLimit > 0;
  const isApproved = sched?.status === "Approved";
  const isDraft = sched?.status === "Draft";
  const isOverWarning = sched?.status === "Overbudget Warning";

  // ---- Add Menu (Resep Mode) ----
  const handleAddResep = async () => {
    if (!bomResep.recipe_id || !bomResep.quantity_pax) return alert("Pilih resep dan jumlah porsi");
    setSubmitting(true);
    const res = await fetch(`/api/production-schedules/${id}/menus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: Number(bomResep.recipe_id), quantity_pax: Number(bomResep.quantity_pax) }),
    });
    if (res.ok) {
      setShowBomModal(false);
      setBomResep({ recipe_id: "", quantity_pax: "" });
      fetchSched();
    } else {
      const err = await res.json();
      alert(err.error || "Gagal menambah menu");
    }
    setSubmitting(false);
  };

  // ---- Add Custom Item (langsung ke PR items via schedule) ----
  const handleAddCustom = async () => {
    if (!bomCustom.item_name || !bomCustom.quantity || !bomCustom.estimated_price) {
      return alert("Isi semua field bahan baku");
    }
    setSubmitting(true);
    const subtotal = Number(bomCustom.quantity) * Number(bomCustom.estimated_price);
    const res = await fetch(`/api/production-schedules/${id}/custom-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_name: bomCustom.item_name,
        quantity: Number(bomCustom.quantity),
        uom: bomCustom.uom,
        estimated_price: Number(bomCustom.estimated_price),
        subtotal,
      }),
    });
    if (res.ok) {
      setShowBomModal(false);
      setBomCustom({ item_name: "", quantity: "", uom: "kg", estimated_price: "" });
      fetchSched();
    } else {
      const err = await res.json();
      alert(err.error || "Gagal menambah item");
    }
    setSubmitting(false);
  };

  // ---- Remove Menu ----
  const handleRemoveMenu = async (menuId: number) => {
    setConfirmAction({
      title: "Hapus Menu",
      message: "Yakin ingin menghapus menu ini dari BOM?",
      onConfirm: async () => {
        await fetch(`/api/production-schedules/${id}/menus?menu_id=${menuId}`, { method: "DELETE" });
        fetchSched();
        setConfirmAction(null);
      }
    });
  };

  // ---- Remove Custom Item ----
  const handleRemoveCustomItem = async (itemId: number) => {
    setConfirmAction({
      title: "Hapus Bahan",
      message: "Yakin ingin menghapus bahan custom ini dari BOM?",
      onConfirm: async () => {
        await fetch(`/api/production-schedules/${id}/custom-items?item_id=${itemId}`, { method: "DELETE" });
        fetchSched();
        setConfirmAction(null);
      }
    });
  };

  // ---- Manual Approve ----
  const handleApprove = async () => {
    setConfirmAction({
      title: "Approve Manual",
      message: "Approve jadwal ini secara manual? Budget tidak akan dicek ulang.",
      danger: false,
      onConfirm: async () => {
        const res = await fetch(`/api/production-schedules/${id}/approve`, { method: "POST" });
        if (res.ok) fetchSched();
        else { const e = await res.json(); alert(e.error || "Gagal approve"); }
        setConfirmAction(null);
      }
    });
  };

  // ---- Generate PR ----
  const handleGeneratePR = async () => {
    setConfirmAction({
      title: "Kirim PR",
      message: "Kirim Purchase Request ke Purchasing?",
      danger: false,
      onConfirm: async () => {
        setSubmitting(true);
        const res = await fetch(`/api/production-schedules/${id}/generate-pr`, { method: "POST" });
        if (res.ok) {
          alert("✅ PR berhasil dikirim ke Purchasing!");
          fetchSched();
        } else {
          const e = await res.json();
          alert(e.error || "Gagal generate PR");
        }
        setSubmitting(false);
        setConfirmAction(null);
      }
    });
  };

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>Memuat detail jadwal...</div>;
  if (!sched || sched.error) return <div style={{ padding: 48, textAlign: "center", color: "#E24B4A" }}>Jadwal tidak ditemukan.</div>;

  const menus: any[] = sched.menus || [];
  const customItems: any[] = sched.custom_items || [];
  const orders: any[] = sched.orders || [];

  return (
    <div>
      {/* ---- Header ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => router.back()} style={{ padding: "6px 10px" }}>
          <ArrowLeft size={14} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>
            Detail Jadwal Produksi
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
            {String(sched.target_date).slice(0, 10)} &nbsp;·&nbsp; Chef: {sched.chef_name}
          </p>
        </div>
        <Badge color={statusBadgeColor(sched.status)}>{sched.status}</Badge>
      </div>

      {/* ---- Info Cards ---- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="erp-card" style={{ padding: "14px 18px" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Omset (Revenue)</p>
          <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, color: "#5005A6" }}>{fmt(totalRevenue)}</p>
          <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>{orders.length} order terkait</p>
        </div>
        <div className="erp-card" style={{ padding: "14px 18px" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Budget BPP Maks (50%)</p>
          <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, color: "#378ADD" }}>{fmt(budgetLimit)}</p>
          <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>Batas yang diizinkan perusahaan</p>
        </div>
        <div className="erp-card" style={{ padding: "14px 18px" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Estimasi HPP Total</p>
          <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, color: isOverBudget ? "#E24B4A" : "#111827" }}>{fmt(totalHPP)}</p>
          <p style={{ margin: 0, fontSize: 11, color: isOverBudget ? "#E24B4A" : "#5005A6" }}>
            {budgetLimit > 0 ? `${((totalHPP / totalRevenue) * 100).toFixed(1)}% dari omset` : "Belum ada data"}
          </p>
        </div>
      </div>

      {/* ---- PRE-WARNING GATE ---- */}
      <div className="erp-card" style={{
        padding: "16px 20px", marginBottom: 16,
        borderLeft: `4px solid ${isOverBudget ? "#E24B4A" : isApproved ? "#5005A6" : "#378ADD"}`
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isOverBudget ? <AlertTriangle size={16} color="#E24B4A" /> : <CheckCircle size={16} color={isApproved ? "#5005A6" : "#378ADD"} />}
            <span style={{ fontWeight: 600, fontSize: 14, color: isOverBudget ? "#E24B4A" : "#111827" }}>
              {isOverBudget
                ? "⚠ ANGGARAN MELEBIHI BATAS — REVISI MENU SEKARANG"
                : isApproved
                  ? "✓ Budget dalam batas — Jadwal siap dikirim ke Purchasing"
                  : isDraft
                    ? "Tambahkan menu untuk menghitung estimasi HPP"
                    : "Menghitung ulang HPP..."}
            </span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: isOverBudget ? "#E24B4A" : "#5005A6" }}>
            {hppPct.toFixed(1)}% / 100%
          </span>
        </div>
        <div style={{ background: "#f3f4f6", borderRadius: 8, height: 10, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 8,
            width: `${hppPct}%`,
            background: isOverBudget
              ? "linear-gradient(90deg, #E24B4A, #f87171)"
              : hppPct > 80
                ? "linear-gradient(90deg, #BA7517, #f59e0b)"
                : "linear-gradient(90deg, #5005A6, #34d399)",
            transition: "width 0.4s ease, background 0.3s ease"
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 11, color: "#6b7280" }}>Rp 0</span>
          <span style={{ fontSize: 11, color: "#6b7280" }}>Max: {fmt(budgetLimit)}</span>
        </div>
      </div>

      {/* ---- BOM Builder ---- */}
      <div className="erp-card-flush" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>BOM Builder — Rencana Menu & Bahan</h2>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>Input menu masakan (dari Resep) atau bahan baku custom</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowBomModal(true)}>
            <Plus size={13} /> Tambah Item
          </button>
        </div>

        {/* Menus dari Resep */}
        {menus.length > 0 && (
          <>
            <div style={{ padding: "10px 20px 4px", background: "#f9fafb" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <ChefHat size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Menu dari Master Resep
              </span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Nama Menu</th>
                  <th style={{ textAlign: "center" }}>Jumlah Porsi</th>
                  <th style={{ textAlign: "right" }}>Std. Cost/Porsi</th>
                  <th style={{ textAlign: "right" }}>Subtotal HPP</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {menus.map((m: any) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.menu_name}</td>
                    <td style={{ textAlign: "center" }}>{m.quantity_pax} porsi</td>
                    <td style={{ textAlign: "right", color: "#6b7280" }}>{fmt(m.standard_cost)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#5005A6" }}>{fmt(m.hpp_subtotal)}</td>
                    <td>
                      <button style={{ background: "none", border: "none", cursor: "pointer", color: "#E24B4A", padding: "2px 6px" }}
                        onClick={() => handleRemoveMenu(m.id)}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Custom Items */}
        {customItems.length > 0 && (
          <>
            <div style={{ padding: "10px 20px 4px", background: "#fefce8", borderTop: menus.length > 0 ? "1px solid #e5e7eb" : undefined }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <ShoppingCart size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Bahan Baku Custom
              </span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Nama Bahan</th>
                  <th style={{ textAlign: "center" }}>Qty</th>
                  <th style={{ textAlign: "center" }}>Satuan</th>
                  <th style={{ textAlign: "right" }}>Harga Est./Satuan</th>
                  <th style={{ textAlign: "right" }}>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customItems.map((ci: any) => (
                  <tr key={ci.id}>
                    <td style={{ fontWeight: 600 }}>{ci.item_name}</td>
                    <td style={{ textAlign: "center" }}>{ci.quantity}</td>
                    <td style={{ textAlign: "center", color: "#6b7280" }}>{ci.uom}</td>
                    <td style={{ textAlign: "right", color: "#6b7280" }}>{fmt(ci.estimated_price)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#5005A6" }}>{fmt(ci.subtotal)}</td>
                    <td>
                      <button style={{ background: "none", border: "none", cursor: "pointer", color: "#E24B4A", padding: "2px 6px" }}
                        onClick={() => handleRemoveCustomItem(ci.id)}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {menus.length === 0 && customItems.length === 0 && (
          <div style={{ padding: "32px 24px", textAlign: "center", color: "#6b7280", fontSize: 13 }}>
            Belum ada menu atau bahan baku. Klik "Tambah Item" untuk mulai merencanakan.
          </div>
        )}

        {/* Total row */}
        {(menus.length > 0 || customItems.length > 0) && (
          <div style={{ padding: "12px 20px", background: "#f9fafb", borderTop: "2px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Total Estimasi HPP</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: isOverBudget ? "#E24B4A" : "#5005A6" }}>{fmt(totalHPP)}</span>
          </div>
        )}
      </div>

      {/* ---- Action Buttons ---- */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        {/* Manual Approve — untuk Chef & Super Admin, hanya muncul jika belum Approved */}
        {!isApproved && (
          <button className="btn btn-secondary" onClick={handleApprove} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle size={14} />
            {isOverWarning ? "Override & Approve Manual" : "Approve Manual"}
          </button>
        )}
        {/* Reset ke Draft jika Overbudget */}
        {isOverWarning && (
          <button className="btn btn-secondary btn-sm" onClick={async () => {
            await fetch(`/api/production-schedules/${id}`, {
              method: "PUT", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "Draft" })
            });
            fetchSched();
          }}>
            <RefreshCw size={13} /> Reset ke Draft
          </button>
        )}
        {/* Generate PR — hanya aktif jika Approved */}
        <button
          className="btn btn-primary"
          disabled={!isApproved || submitting}
          onClick={handleGeneratePR}
          style={{
            opacity: (!isApproved || submitting) ? 0.5 : 1,
            cursor: !isApproved ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 6
          }}
          title={!isApproved ? "Jadwal harus Approved sebelum Generate PR" : ""}
        >
          <Send size={14} />
          {submitting ? "Mengirim..." : "Kirim PR ke Purchasing"}
        </button>
      </div>

      {/* ---- Orders yang terkait ---- */}
      {orders.length > 0 && (
        <div className="erp-card" style={{ marginTop: 16 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Order yang Dijadwalkan</h3>
          </div>
          <div style={{ padding: "10px 16px" }}>
            {orders.map((o: any) => (
              <div key={o.order_id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f3f4f6", fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>ORD-{o.order_id} — {o.customer}</span>
                <span style={{ color: "#5005A6", fontWeight: 700 }}>{fmt(o.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Modal Tambah BOM Item ---- */}
      <Modal show={showBomModal} onClose={() => setShowBomModal(false)} title="Tambah Item BOM">
        {/* Tab selector */}
        <div style={{ display: "flex", borderBottom: "2px solid #e5e7eb", marginBottom: 16 }}>
          {(["resep", "custom"] as const).map(mode => (
            <button key={mode} onClick={() => setBomMode(mode)}
              style={{
                padding: "8px 16px", border: "none", background: "none", cursor: "pointer",
                fontWeight: 600, fontSize: 13,
                borderBottom: bomMode === mode ? "2px solid #5005A6" : "2px solid transparent",
                color: bomMode === mode ? "#5005A6" : "#6b7280",
                marginBottom: -2,
              }}>
              {mode === "resep" ? "🍽 Dari Master Resep" : "✏️ Bahan Baku Custom"}
            </button>
          ))}
        </div>

        {bomMode === "resep" ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Pilih Resep / Menu
              </label>
              <SearchableSelect
                value={bomResep.recipe_id}
                onChange={v => setBomResep(f => ({ ...f, recipe_id: v }))}
                options={[
                  { value: "", label: "-- Pilih Resep --" },
                  ...recipes.map(r => ({
                    value: String(r.id),
                    label: `${r.menu_name} (Std. Cost: ${fmt(r.standard_cost)}/porsi)`
                  }))
                ]}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Jumlah Porsi
              </label>
              <input type="number" min="1" value={bomResep.quantity_pax}
                onChange={e => setBomResep(f => ({ ...f, quantity_pax: e.target.value }))}
                placeholder="Contoh: 50" style={{ width: "100%" }}
              />
            </div>
            {bomResep.recipe_id && bomResep.quantity_pax && (
              <div className="alert-info" style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 12 }}>
                  Estimasi Subtotal HPP: <strong>{fmt(
                    (recipes.find(r => String(r.id) === bomResep.recipe_id)?.standard_cost || 0) * Number(bomResep.quantity_pax)
                  )}</strong>
                </span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setShowBomModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleAddResep} disabled={submitting}>
                {submitting ? "Menyimpan..." : "Tambah ke BOM"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Nama Bahan Baku</label>
              <input type="text" value={bomCustom.item_name}
                onChange={e => setBomCustom(f => ({ ...f, item_name: e.target.value }))}
                placeholder="Contoh: Daging Sapi, Cabai, Beras" style={{ width: "100%" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Kuantitas</label>
                <input type="number" min="0" step="0.01" value={bomCustom.quantity}
                  onChange={e => setBomCustom(f => ({ ...f, quantity: e.target.value }))}
                  placeholder="10" style={{ width: "100%" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Satuan</label>
                <SearchableSelect
                  value={bomCustom.uom}
                  onChange={v => setBomCustom(f => ({ ...f, uom: v }))}
                  options={["kg", "gram", "liter", "ml", "pcs", "ikat", "bungkus", "karton", "lusin"].map(u => ({ value: u, label: u }))}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Estimasi Harga / Satuan (Rp)</label>
              <input type="number" min="0" value={bomCustom.estimated_price}
                onChange={e => setBomCustom(f => ({ ...f, estimated_price: e.target.value }))}
                placeholder="Contoh: 120000" style={{ width: "100%" }} />
            </div>
            {bomCustom.quantity && bomCustom.estimated_price && (
              <div className="alert-info" style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 12 }}>
                  Subtotal: <strong>{fmt(Number(bomCustom.quantity) * Number(bomCustom.estimated_price))}</strong>
                </span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setShowBomModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleAddCustom} disabled={submitting}>
                {submitting ? "Menyimpan..." : "Tambah ke BOM"}
              </button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmModal
        show={!!confirmAction}
        title={confirmAction?.title}
        message={confirmAction?.message || ""}
        danger={confirmAction?.danger !== false}
        confirmLabel={confirmAction?.danger === false ? "Ya, Lanjutkan" : "Ya, Hapus"}
        onConfirm={() => confirmAction?.onConfirm()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
