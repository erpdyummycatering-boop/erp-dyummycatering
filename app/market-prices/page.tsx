"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Plus, Edit2, ArrowUpRight, ArrowDownRight, Trash2 } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PageHeader, FormRow, FormField } from "@/components/ui/PageHeader";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { fmt } from "@/lib/utils";

// Market prices stored in DB later — for now using ingredient_prices from DB via a custom table
// We use a local state with static seed data for demo (can be extended with a market_prices table)
const initPrices = [
  { id: 1, name: "Daging Sapi", category: "Protein", uom: "Kg", lastPrice: 125000, currentPrice: 145000, updatedBy: "Bagas", updatedAt: "2026-05-18", change: 16 },
  { id: 2, name: "Ayam Potong", category: "Protein", uom: "Ekor", lastPrice: 40000, currentPrice: 40000, updatedBy: "Bagas", updatedAt: "2026-05-17", change: 0 },
  { id: 3, name: "Cabai Merah", category: "Bumbu", uom: "Kg", lastPrice: 40000, currentPrice: 80000, updatedBy: "Bagas", updatedAt: "2026-05-18", change: 100 },
  { id: 4, name: "Telur Ayam", category: "Protein", uom: "Kg", lastPrice: 28000, currentPrice: 27000, updatedBy: "Bagas", updatedAt: "2026-05-16", change: -3.6 },
  { id: 5, name: "Beras", category: "Pokok", uom: "Kg", lastPrice: 14000, currentPrice: 14500, updatedBy: "Bagas", updatedAt: "2026-05-15", change: 3.6 },
];

const C = { primary: "#5005A6", danger: "#E24B4A", warning: "#BA7517", success: "#639922" };

export default function MarketPricesPage() {
  const [prices, setPrices] = useState(initPrices);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [form, setForm] = useState({ name: "", category: "Protein", uom: "Kg", currentPrice: "", notes: "" });

  const naik = prices.filter((p) => p.change > 0).length;
  const turun = prices.filter((p) => p.change < 0).length;
  const stabil = prices.filter((p) => p.change === 0).length;

  const openEdit = (p: any) => {
    setEditItem(p);
    setForm({ name: p.name, category: p.category, uom: p.uom, currentPrice: String(p.currentPrice), notes: "" });
    setShowModal(true);
  };

  const handleSave = () => {
    const newPrice = Number(form.currentPrice);
    if (editItem) {
      setPrices((prev) => prev.map((p) => p.id === editItem.id ? {
        ...p, lastPrice: p.currentPrice, currentPrice: newPrice,
        change: Number(((newPrice - p.currentPrice) / p.currentPrice * 100).toFixed(1)),
        updatedAt: new Date().toISOString().split("T")[0], updatedBy: "Admin",
      } : p));
    } else {
      setPrices((prev) => [...prev, {
        id: Date.now(), name: form.name, category: form.category, uom: form.uom,
        lastPrice: newPrice, currentPrice: newPrice, change: 0,
        updatedAt: new Date().toISOString().split("T")[0], updatedBy: "Admin",
      }]);
    }
    setShowModal(false);
  };

  const executeDelete = () => {
    if (!itemToDelete) return;
    setPrices((prev) => prev.filter((p) => p.id !== itemToDelete.id));
    setItemToDelete(null);
  };

  return (
    <div>
      <PageHeader
        title="Katalog Harga Pasar"
        subtitle="Update harga bahan baku — referensi kalkulasi HPP Chef"
        actions={<button className="btn btn-primary" onClick={() => { setEditItem(null); setForm({ name: "", category: "Protein", uom: "Kg", currentPrice: "", notes: "" }); setShowModal(true); }}><Plus size={14} /> Update Harga</button>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
        <StatCard label="Item Naik Harga" value={naik} sub="vs update sebelumnya" icon={TrendingUp} color={C.danger} />
        <StatCard label="Item Turun Harga" value={turun} icon={TrendingDown} color={C.success} />
        <StatCard label="Harga Stabil" value={stabil} icon={RefreshCw} color="#888780" />
      </div>

      <div className="erp-card-flush">
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Nama Bahan</th><th>Kategori</th><th>Satuan</th>
                <th>Harga Lalu</th><th>Harga Terkini</th><th>Perubahan</th>
                <th>Update By</th><th>Tanggal</th><th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td><Badge color="gray">{item.category}</Badge></td>
                  <td style={{ fontSize: 12 }}>{item.uom}</td>
                  <td style={{ fontSize: 12, color: "#6b7280" }}>{fmt(item.lastPrice)}</td>
                  <td style={{ fontWeight: 700 }}>{fmt(item.currentPrice)}</td>
                  <td>
                    <span style={{
                      fontWeight: 700,
                      color: item.change > 10 ? C.danger : item.change > 0 ? C.warning : item.change < 0 ? C.success : "#6b7280",
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      {item.change > 0 ? <ArrowUpRight size={13} /> : item.change < 0 ? <ArrowDownRight size={13} /> : null}
                      {Math.abs(item.change).toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{item.updatedBy}</td>
                  <td style={{ fontSize: 12, color: "#6b7280" }}>{item.updatedAt}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(item)}><Edit2 size={11} /></button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setItemToDelete(item)} title="Hapus"><Trash2 size={11} color="#E24B4A" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal show={showModal} onClose={() => setShowModal(false)} title={editItem ? "Update Harga Pasar" : "Tambah Bahan Baru"}>
        <FormRow>
          <FormField label="Nama Bahan"><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Daging Sapi, Cabai, dll..." disabled={!!editItem} /></FormField>
          <FormField label="Kategori">
            <SearchableSelect 
              value={form.category} onChange={v => setForm((f) => ({ ...f, category: v }))}
              options={["Protein", "Bumbu", "Pokok", "Sayuran"].map(c => ({ value: c, label: c }))}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="Harga Terkini (Rp)"><input type="number" value={form.currentPrice} onChange={(e) => setForm((f) => ({ ...f, currentPrice: e.target.value }))} placeholder="125000" /></FormField>
          <FormField label="Satuan (UoM)">
            <SearchableSelect 
              value={form.uom} onChange={v => setForm((f) => ({ ...f, uom: v }))}
              options={["Kg", "Ekor", "Ikat", "Buah", "Liter"].map(u => ({ value: u, label: u }))}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
        </FormRow>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
          <button className="btn btn-primary" onClick={handleSave}>Simpan Harga</button>
        </div>
      </Modal>

      <ConfirmModal
        show={!!itemToDelete}
        title="Hapus Harga Bahan"
        message={`Yakin ingin menghapus harga bahan ${itemToDelete?.name}? Data yang dihapus tidak dapat dikembalikan.`}
        onConfirm={executeDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}
