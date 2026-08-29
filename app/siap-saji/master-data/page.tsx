"use client";

import { useState, useEffect } from "react";
import { Settings, MapPin, Share2, Plus, Edit3, Trash2, Search, X, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/Pagination";

interface Area {
  id: number;
  kecamatan: string;
  kota: string;
  provinsi: string;
  shipping_zone: string;
  is_active: boolean;
}

interface Channel {
  id: number;
  name: string;
  harga_type: string;
  platform_key: string | null;
  urutan: number;
  is_active: boolean;
}

export default function SiapSajiMasterDataPage() {
  const [activeTab, setActiveTab] = useState<"areas" | "channels">("areas");

  const [areas, setAreas] = useState<Area[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [areaPage, setAreaPage] = useState(1);
  const [areaLimit, setAreaLimit] = useState(10);
  const [channelPage, setChannelPage] = useState(1);
  const [channelLimit, setChannelLimit] = useState(10);

  // Area Filters & Modal State
  const [areaSearch, setAreaSearch] = useState("");
  const [areaZoneFilter, setAreaZoneFilter] = useState("");
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);

  const [kecamatan, setKecamatan] = useState("");
  const [kota, setKota] = useState("");
  const [shippingZone, setShippingZone] = useState("dalam_kota");

  // Channel Modal State
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  const [channelName, setChannelName] = useState("");
  const [hargaType, setHargaType] = useState("normal");
  const [platformKey, setPlatformKey] = useState("");
  const [urutan, setUrutan] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAreas = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (areaSearch) q.append("search", areaSearch);
      if (areaZoneFilter) q.append("shipping_zone", areaZoneFilter);

      const res = await fetch(`/api/siap-saji/areas?${q.toString()}`);
      if (res.ok) setAreas(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/siap-saji/channels");
      if (res.ok) setChannels(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "areas") fetchAreas();
    else fetchChannels();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "areas") fetchAreas();
  }, [areaSearch, areaZoneFilter]);

  // Handle Area Submit
  const handleSubmitArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kecamatan || !kota) return toast.error("Kecamatan dan Kota wajib diisi.");

    setIsSubmitting(true);
    try {
      const url = editingArea ? `/api/siap-saji/areas/${editingArea.id}` : "/api/siap-saji/areas";
      const method = editingArea ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kecamatan, kota, shipping_zone: shippingZone }),
      });

      if (!res.ok) throw new Error("Gagal menyimpan area");

      toast.success(editingArea ? "Area berhasil diperbarui!" : "Area baru berhasil ditambahkan!");
      setIsAreaModalOpen(false);
      fetchAreas();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan area");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteArea = async (id: number, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus wilayah/kecamatan "${name}"?`)) return;
    try {
      const res = await fetch(`/api/siap-saji/areas/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Gagal menghapus kecamatan");
      }
      toast.success(`Kecamatan "${name}" berhasil dihapus!`);
      fetchAreas();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus kecamatan");
    }
  };

  // Handle Channel Submit
  const handleSubmitChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName) return toast.error("Nama Channel wajib diisi.");

    setIsSubmitting(true);
    try {
      const url = editingChannel ? `/api/siap-saji/channels/${editingChannel.id}` : "/api/siap-saji/channels";
      const method = editingChannel ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: channelName,
          harga_type: hargaType,
          platform_key: platformKey || null,
          urutan: Number(urutan),
        }),
      });

      if (!res.ok) throw new Error("Gagal menyimpan channel");

      toast.success(editingChannel ? "Channel berhasil diperbarui!" : "Channel baru berhasil ditambahkan!");
      setIsChannelModalOpen(false);
      fetchChannels();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan channel");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1f2937", margin: 0, letterSpacing: "-0.02em" }}>
            Master Wilayah & Channel Penjualan
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Kelola master 32 Kecamatan jangkauan kirim dan Channel Penjualan Siap Saji
          </p>
        </div>

        <div>
          {activeTab === "areas" ? (
            <button
              onClick={() => {
                setEditingArea(null);
                setKecamatan("");
                setKota("Kota Bandung");
                setShippingZone("dalam_kota");
                setIsAreaModalOpen(true);
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
              <Plus size={18} /> Tambah Wilayah
            </button>
          ) : (
            <button
              onClick={() => {
                setEditingChannel(null);
                setChannelName("");
                setHargaType("normal");
                setPlatformKey("");
                setUrutan(channels.length + 1);
                setIsChannelModalOpen(true);
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
              <Plus size={18} /> Tambah Channel
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 12, borderBottom: "2px solid #e5e7eb", marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab("areas")}
          style={{
            padding: "12px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "areas" ? "3px solid #5005A6" : "3px solid transparent",
            color: activeTab === "areas" ? "#5005A6" : "#6b7280",
            fontSize: 15,
            fontWeight: activeTab === "areas" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: -2,
          }}
        >
          <MapPin size={18} /> Master Wilayah / Kecamatan ({areas.length})
        </button>

        <button
          onClick={() => setActiveTab("channels")}
          style={{
            padding: "12px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "channels" ? "3px solid #5005A6" : "3px solid transparent",
            color: activeTab === "channels" ? "#5005A6" : "#6b7280",
            fontSize: 15,
            fontWeight: activeTab === "channels" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: -2,
          }}
        >
          <Share2 size={18} /> Channel Penjualan ({channels.length})
        </button>
      </div>

      {/* TAB 1: MASTER AREAS */}
      {activeTab === "areas" ? (
        <div>
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: "12px 16px",
              border: "1px solid #e5e7eb",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 12,
              overflowX: "auto",
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ flex: "1 1 260px", minWidth: 180, position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                type="text"
                placeholder="Cari Kecamatan atau Kota..."
                value={areaSearch}
                onChange={(e) => setAreaSearch(e.target.value)}
                style={{ width: "100%", padding: "7px 12px 7px 34px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }}
              />
            </div>

            <select
              value={areaZoneFilter}
              onChange={(e) => setAreaZoneFilter(e.target.value)}
              style={{ width: 170, padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "white", flexShrink: 0 }}
            >
              <option value="">Semua Zona Default</option>
              <option value="dalam_kota">Dalam Kota</option>
              <option value="luar_kota">Luar Kota</option>
            </select>
          </div>

          <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14, whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px", width: 50 }}>No.</th>
                  <th style={{ padding: "12px 16px" }}>Kecamatan</th>
                  <th style={{ padding: "12px 16px" }}>Kota / Kabupaten</th>
                  <th style={{ padding: "12px 16px" }}>Provinsi</th>
                  <th style={{ padding: "12px 16px" }}>Zona Default</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                      Memuat master wilayah...
                    </td>
                  </tr>
                ) : areas.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                      Tidak ada wilayah ditemukan.
                    </td>
                  </tr>
                ) : (
                  areas.slice((areaPage - 1) * areaLimit, areaPage * areaLimit).map((a, idx) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "14px 16px", color: "#6b7280" }}>{(areaPage - 1) * areaLimit + idx + 1}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 700, color: "#111827" }}>{a.kecamatan}</td>
                      <td style={{ padding: "14px 16px", color: "#374151" }}>{a.kota}</td>
                      <td style={{ padding: "14px 16px", color: "#6b7280" }}>{a.provinsi}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 700,
                            background: a.shipping_zone === "dalam_kota" ? "#eff6ff" : "#fdf4ff",
                            color: a.shipping_zone === "dalam_kota" ? "#1d4ed8" : "#b10fbd",
                          }}
                        >
                          {a.shipping_zone === "dalam_kota" ? "Dalam Kota (12k)" : "Luar Kota (14k)"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ color: a.is_active ? "#639922" : "#9ca3af", fontWeight: 600, fontSize: 13 }}>
                          {a.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                          <button
                            onClick={() => {
                              setEditingArea(a);
                              setKecamatan(a.kecamatan);
                              setKota(a.kota);
                              setShippingZone(a.shipping_zone);
                              setIsAreaModalOpen(true);
                            }}
                            style={{ padding: "6px 12px", background: "#5005A6", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteArea(a.id, a.kecamatan)}
                            style={{ padding: "6px 12px", background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination Bar for Areas */}
            <Pagination
              page={areaPage}
              totalPages={Math.ceil(areas.length / areaLimit) || 1}
              total={areas.length}
              limit={areaLimit}
              onChange={(p) => setAreaPage(p)}
              onLimitChange={(lim) => { setAreaLimit(lim); setAreaPage(1); }}
            />
          </div>
        </div>
      ) : (
        /* TAB 2: MASTER CHANNELS */
        <div>
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14, whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px", width: 50 }}>No.</th>
                  <th style={{ padding: "12px 16px", width: 60 }}>Urutan</th>
                  <th style={{ padding: "12px 16px" }}>Nama Channel</th>
                  <th style={{ padding: "12px 16px" }}>Tipe Harga</th>
                  <th style={{ padding: "12px 16px" }}>Platform Key</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                      Memuat channel...
                    </td>
                  </tr>
                ) : channels.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                      Tidak ada channel ditemukan.
                    </td>
                  </tr>
                ) : (
                  channels.slice((channelPage - 1) * channelLimit, channelPage * channelLimit).map((c, idx) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "14px 16px", color: "#6b7280" }}>{(channelPage - 1) * channelLimit + idx + 1}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: 700 }}>{c.urutan}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 700, color: "#111827" }}>{c.name}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ padding: "3px 8px", background: "#f3f4f6", borderRadius: 6, fontSize: 12 }}>
                          {c.harga_type}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", fontFamily: "monospace", color: "#5005A6" }}>
                        {c.platform_key || "-"}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ color: c.is_active ? "#639922" : "#9ca3af", fontWeight: 600, fontSize: 13 }}>
                          {c.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <button
                          onClick={() => {
                            setEditingChannel(c);
                            setChannelName(c.name);
                            setHargaType(c.harga_type);
                            setPlatformKey(c.platform_key || "");
                            setUrutan(c.urutan);
                            setIsChannelModalOpen(true);
                          }}
                          style={{ padding: "6px 12px", background: "#5005A6", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination Bar for Channels */}
            <Pagination
              page={channelPage}
              totalPages={Math.ceil(channels.length / channelLimit) || 1}
              total={channels.length}
              limit={channelLimit}
              onChange={(p) => setChannelPage(p)}
              onLimitChange={(lim) => { setChannelLimit(lim); setChannelPage(1); }}
            />
          </div>
        </div>
      )}

      {/* ── MODAL: AREA EDIT/ADD ────────────────────────────── */}
      {isAreaModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, maxWidth: 440, width: "100%", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                {editingArea ? "Edit Wilayah" : "Tambah Wilayah Baru"}
              </h3>
              <button onClick={() => setIsAreaModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitArea}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Nama Kecamatan *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Rancasari"
                  value={kecamatan}
                  onChange={(e) => setKecamatan(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Kota / Kabupaten *
                </label>
                <input
                  type="text"
                  placeholder="Kota Bandung / Kota Cimahi / Kabupaten Bandung"
                  value={kota}
                  onChange={(e) => setKota(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Zona Default Ongkir *
                </label>
                <select
                  value={shippingZone}
                  onChange={(e) => setShippingZone(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                >
                  <option value="dalam_kota">dalam_kota (Rp12.000)</option>
                  <option value="luar_kota">luar_kota (Rp14.000)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setIsAreaModalOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}>
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5005A6", color: "white", fontWeight: 700 }}>
                  {isSubmitting ? "Simpan..." : "Simpan Wilayah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CHANNEL EDIT/ADD ────────────────────────────── */}
      {isChannelModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, maxWidth: 440, width: "100%", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                {editingChannel ? "Edit Channel" : "Tambah Channel Baru"}
              </h3>
              <button onClick={() => setIsChannelModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitChannel}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Nama Channel *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: GrabFood"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Tipe Harga
                </label>
                <select
                  value={hargaType}
                  onChange={(e) => setHargaType(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                >
                  <option value="normal">normal</option>
                  <option value="marketplace">marketplace</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Platform Key (Slug)
                </label>
                <input
                  type="text"
                  placeholder="gojek / ahsan / grabfood"
                  value={platformKey}
                  onChange={(e) => setPlatformKey(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Urutan Tampilan
                </label>
                <input
                  type="number"
                  value={urutan}
                  onChange={(e) => setUrutan(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setIsChannelModalOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}>
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#5005A6", color: "white", fontWeight: 700 }}>
                  {isSubmitting ? "Simpan..." : "Simpan Channel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
