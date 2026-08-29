"use client";

import { useState, useEffect } from "react";
import { MapPin, Search, Filter, Edit3, CheckCircle, RefreshCw, X, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/Pagination";

interface MatrixRow {
  area_id: number;
  kecamatan: string;
  kota: string;
  shipping_zone: string;
  zone_label: string;
  fee_default: number;
  channel_id: number;
  channel_name: string;
  fee_override: number | null;
  fee_efektif: number;
  sumber_fee: "spesifik" | "zona_default";
  notes: string | null;
}

interface ShippingZone {
  zone_key: string;
  label: string;
  fee: number;
  keterangan: string;
}

interface Channel {
  id: number;
  name: string;
}

export default function SiapSajiShippingPage() {
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Filters
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");

  // Edit Modal State
  const [editingRow, setEditingRow] = useState<MatrixRow | null>(null);
  const [newFee, setNewFee] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default Zone Edit Modal
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
  const [zoneFeeInput, setZoneFeeInput] = useState<number>(0);

  const fetchMatrix = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.append("search", search);
      if (zoneFilter) q.append("shipping_zone", zoneFilter);
      if (channelFilter) q.append("channel_id", channelFilter);

      const res = await fetch(`/api/siap-saji/shipping?${q.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat matriks shipping");
      const json = await res.json();
      setMatrix(json.matrix || []);
      setZones(json.zones || []);
      setChannels(json.channels || []);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat data matriks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, [search, zoneFilter, channelFilter]);

  // Submit Override Tariff
  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/siap-saji/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_override",
          area_id: editingRow.area_id,
          channel_id: editingRow.channel_id,
          shipping_fee: newFee,
          notes,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Gagal memperbarui tarif");
      }

      toast.success(
        `Tarif ${editingRow.kecamatan} × ${editingRow.channel_name} diperbarui ke Rp${newFee.toLocaleString("id-ID")}`
      );
      setEditingRow(null);
      fetchMatrix();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui tarif");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Default Zone Fee
  const handleSaveZoneFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZone) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/siap-saji/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_zone_default",
          zone_key: editingZone.zone_key,
          shipping_fee: zoneFeeInput,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Gagal memperbarui tarif zona");
      }

      toast.success(`Tarif zona ${editingZone.label} diperbarui ke Rp${zoneFeeInput.toLocaleString("id-ID")}`);
      setEditingZone(null);
      fetchMatrix();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui tarif zona");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOverride = async (row: any) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus tarif ongkir untuk ${row.kecamatan} (${row.channel_name})?`)) return;
    try {
      const res = await fetch(`/api/siap-saji/shipping?area_id=${row.area_id}&channel_id=${row.channel_id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Gagal menghapus tarif ongkir");
      }
      toast.success("Tarif ongkir berhasil dihapus!");
      fetchMatrix();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus tarif");
    }
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 40 }}>
      {/* ── HEADER & ZONES SUMMARY ────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.02em" }}>
            Master Tarif Ongkir Siap Saji
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Matriks tarif ongkir dinamis per Area × Channel dengan hierarki 3-level (v4.0)
          </p>
        </div>
      </div>

      {/* Default Zone Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 24 }}>
        {zones.map((z) => (
          <div
            key={z.zone_key}
            style={{
              background: "white",
              borderRadius: 12,
              padding: "16px 20px",
              border: "1px solid #e5e7eb",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>
                Zona Default: {z.label}
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, color: "#5005A6", marginTop: 4 }}>
                Rp {Number(z.fee).toLocaleString("id-ID")}
              </p>
              <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{z.keterangan}</p>
            </div>
            <button
              onClick={() => {
                setEditingZone(z);
                setZoneFeeInput(Number(z.fee));
              }}
              style={{
                padding: "6px 12px",
                background: "#f3f4f6",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Edit3 size={14} /> Ubah
            </button>
          </div>
        ))}
      </div>

      {/* ── FILTER TOOLBAR ────────────────────────────────────────── */}
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
            placeholder="Cari Kecamatan, Kota, Channel..."
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
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          style={{ width: 140, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white", flexShrink: 0 }}
        >
          <option value="">Semua Zona</option>
          <option value="dalam_kota">Dalam Kota</option>
          <option value="luar_kota">Luar Kota</option>
        </select>

        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          style={{ width: 150, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", background: "white", flexShrink: 0 }}
        >
          <option value="">Semua Channel</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── SHIPPING MATRIX TABLE ────────────────────────────────── */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
              <th style={{ padding: "10px 10px", width: 40 }}>No.</th>
              <th style={{ padding: "10px 10px", width: 130 }}>Kecamatan</th>
              <th style={{ padding: "10px 10px", width: 130 }}>Kota</th>
              <th style={{ padding: "10px 10px", width: 150 }}>Zona Default</th>
              <th style={{ padding: "10px 10px", width: 140 }}>Channel Penjualan</th>
              <th style={{ padding: "10px 10px", width: 110 }}>Tarif Efektif</th>
              <th style={{ padding: "10px 10px", width: 130 }}>Sumber Tarif</th>
              <th style={{ padding: "10px 10px", width: 180 }}>Catatan</th>
              <th style={{ padding: "10px 10px", width: 110, textAlign: "right" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  Memuat matriks tarif ongkir...
                </td>
              </tr>
            ) : matrix.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                  Tidak ada kombinasi tarif ditemukan.
                </td>
              </tr>
            ) : (
              matrix.slice((page - 1) * limit, page * limit).map((row, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 10px", color: "#6b7280" }}>{(page - 1) * limit + idx + 1}</td>
                  <td style={{ padding: "10px 10px", fontWeight: 700, color: "#111827", whiteSpace: "nowrap" }}>{row.kecamatan}</td>
                  <td style={{ padding: "10px 10px", color: "#4b5563", whiteSpace: "nowrap" }}>{row.kota}</td>
                  <td style={{ padding: "10px 10px" }}>
                    <span style={{ fontSize: 11, background: "#f3f4f6", padding: "2px 8px", borderRadius: 4, color: "#4b5563", whiteSpace: "nowrap" }}>
                      {row.zone_label} (Rp{Number(row.fee_default).toLocaleString("id-ID")})
                    </span>
                  </td>
                  <td style={{ padding: "10px 10px", fontWeight: 600, color: "#378ADD", whiteSpace: "nowrap" }}>{row.channel_name}</td>
                  <td style={{ padding: "10px 10px", fontWeight: 800, color: "#5005A6", fontSize: 14, whiteSpace: "nowrap" }}>
                    Rp {Number(row.fee_efektif).toLocaleString("id-ID")}
                  </td>
                  <td style={{ padding: "10px 10px" }}>
                    {row.sumber_fee === "spesifik" ? (
                      <span style={{ background: "#fdf4ff", color: "#b10fbd", border: "1px solid #f5d0fe", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                        ✎ Override Spesifik
                      </span>
                    ) : (
                      <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: 6, fontSize: 11, whiteSpace: "nowrap" }}>
                        Default Zona
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "10px 10px", color: "#6b7280", fontSize: 12, wordBreak: "break-word" }}>{row.notes || "-"}</td>
                  <td style={{ padding: "10px 10px", textAlign: "right" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                      <button
                        onClick={() => {
                          setEditingRow(row);
                          setNewFee(Number(row.fee_efektif));
                          setNotes(row.notes || "");
                        }}
                        style={{
                          padding: "5px 8px",
                          background: "#5005A6",
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                        title="Ubah tarif ongkir"
                      >
                        <Edit3 size={12} /> Ubah
                      </button>

                      <button
                        onClick={() => handleDeleteOverride(row)}
                        style={{
                          padding: "5px 8px",
                          background: "#fee2e2",
                          color: "#dc2626",
                          border: "1px solid #fca5a5",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                        title={row.sumber_fee === "spesifik" ? "Hapus override (kembalikan ke default zona)" : "Hapus / set tarif ke Rp 0"}
                      >
                        <Trash2 size={12} /> Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <Pagination
          page={page}
          totalPages={Math.ceil(matrix.length / limit) || 1}
          total={matrix.length}
          limit={limit}
          onChange={(p) => setPage(p)}
          onLimitChange={(lim) => { setLimit(lim); setPage(1); }}
        />
      </div>

      {/* ── MODAL: EDIT OVERRIDE TARIFF ────────────────────────────── */}
      {editingRow && (
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
          <div style={{ background: "white", borderRadius: 16, maxWidth: 460, width: "100%", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
                Kelola Tarif Spesifik
              </h3>
              <button onClick={() => setEditingRow(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: "#4b5563", marginBottom: 16 }}>
              Kecamatan: <strong>{editingRow.kecamatan}</strong> ({editingRow.kota}) <br />
              Channel: <strong>{editingRow.channel_name}</strong>
            </p>

            <form onSubmit={handleSaveOverride}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                  Tarif Ongkir (Rp) *
                </label>
                <input
                  type="number"
                  value={newFee}
                  onChange={(e) => setNewFee(Number(e.target.value))}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, outline: "none" }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                  Keterangan / Alasan Override
                </label>
                <input
                  type="text"
                  placeholder="Misal: Akses jalan susah, gratis ongkir..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", fontSize: 14, cursor: "pointer" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5005A6", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  {isSubmitting ? "Simpan..." : "Simpan Tarif"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT DEFAULT ZONE FEE ────────────────────────────── */}
      {editingZone && (
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
          <div style={{ background: "white", borderRadius: 16, maxWidth: 440, width: "100%", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
                Ubah Tarif Zona Default
              </h3>
              <button onClick={() => setEditingZone(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: "#4b5563", marginBottom: 16 }}>
              Zona: <strong>{editingZone.label}</strong> ({editingZone.zone_key})
            </p>

            <form onSubmit={handleSaveZoneFee}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                  Tarif Ongkir Default Zona (Rp) *
                </label>
                <input
                  type="number"
                  value={zoneFeeInput}
                  onChange={(e) => setZoneFeeInput(Number(e.target.value))}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, outline: "none" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditingZone(null)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", fontSize: 14, cursor: "pointer" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5005A6", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  {isSubmitting ? "Simpan..." : "Simpan Tarif Zona"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
