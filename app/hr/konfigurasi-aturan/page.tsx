"use client";

import { useState, useEffect } from "react";
import { Save, Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function KonfigurasiAturanPage() {
  const [globalRule, setGlobalRule] = useState<any>({
    potongan_terlambat_aktif: false,
    potongan_mode: "PER_MENIT",
    potongan_tarif_per_menit: 0,
    potongan_tarif_per_kejadian: 0,
    potongan_toleransi_menit: 0,
    potongan_maks_per_hari: 0,
    lembur_maks_aktif: false,
    lembur_maks_jam_per_hari: 0,
    lembur_maks_jam_per_bulan: 0,
    lembur_perilaku_melewati: "TANDAI_SAJA",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hr/rules");
      const data = await res.json();
      if (data && !data.error) {
        setGlobalRule(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleSaveGlobalRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg("");
    try {
      const res = await fetch("/api/hr/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(globalRule),
      });
      if (res.ok) {
        setSuccessMsg("Konfigurasi aturan berhasil diperbarui!");
        setTimeout(() => setSuccessMsg(""), 4000);
        fetchRules();
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menyimpan aturan");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Konfigurasi Aturan Potongan & Lembur"
        subtitle="Aturan bersifat opt-in (default OFF). Perusahaan dapat mengaktifkan potongan Keterlambatan dan Batas Lembur secara fleksibel"
      />

      {successMsg && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "#EAF3DE", border: "1px solid #c0ed9d", color: "#3B6D11", borderRadius: 8, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <Shield size={16} />
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="erp-card p-12 text-center text-gray-400">Memuat konfigurasi...</div>
      ) : (
        <form onSubmit={handleSaveGlobalRule} className="space-y-6">
          {/* Card 1: Potongan Keterlambatan */}
          <div className="erp-card space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">1. Potongan Keterlambatan</h3>
                <p className="text-xs text-gray-500 mt-0.5">Hitung pemotongan gaji secara otomatis bila karyawan terlambat hadir.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalRule.potongan_terlambat_aktif}
                  onChange={(e) => setGlobalRule({ ...globalRule, potongan_terlambat_aktif: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5005A6]"></div>
              </label>
            </div>

            {globalRule.potongan_terlambat_aktif && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-purple-50/40 p-4 rounded-xl border border-purple-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Mode Potongan</label>
                  <select
                    value={globalRule.potongan_mode}
                    onChange={(e) => setGlobalRule({ ...globalRule, potongan_mode: e.target.value })}
                  >
                    <option value="PER_MENIT">Per Menit Terlambat (Rp/Menit)</option>
                    <option value="PER_KEJADIAN">Per Kejadian Hari Terlambat (Flat Rp)</option>
                  </select>
                </div>

                {globalRule.potongan_mode === "PER_MENIT" ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tarif Potongan / Menit (Rp)</label>
                    <input
                      type="number"
                      value={globalRule.potongan_tarif_per_menit}
                      onChange={(e) => setGlobalRule({ ...globalRule, potongan_tarif_per_menit: parseInt(e.target.value, 10) || 0 })}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tarif Flat Per Kejadian (Rp)</label>
                    <input
                      type="number"
                      value={globalRule.potongan_tarif_per_kejadian}
                      onChange={(e) => setGlobalRule({ ...globalRule, potongan_tarif_per_kejadian: parseInt(e.target.value, 10) || 0 })}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Batas Toleransi Keterlambatan (Menit)</label>
                  <input
                    type="number"
                    value={globalRule.potongan_toleransi_menit}
                    onChange={(e) => setGlobalRule({ ...globalRule, potongan_toleransi_menit: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Batas Maksimum Lembur */}
          <div className="erp-card space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">2. Batas Maksimum Lembur</h3>
                <p className="text-xs text-gray-500 mt-0.5">Batasi akumulasi jam lembur yang diakui/dibayar kepada karyawan.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalRule.lembur_maks_aktif}
                  onChange={(e) => setGlobalRule({ ...globalRule, lembur_maks_aktif: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5005A6]"></div>
              </label>
            </div>

            {globalRule.lembur_maks_aktif && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-purple-50/40 p-4 rounded-xl border border-purple-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Maksimum Jam Lembur / Bulan</label>
                  <input
                    type="number"
                    step="0.5"
                    value={globalRule.lembur_maks_jam_per_bulan}
                    onChange={(e) => setGlobalRule({ ...globalRule, lembur_maks_jam_per_bulan: parseFloat(e.target.value) || 0 })}
                    placeholder="misal: 40 jam"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Perilaku Jika Melewati Batas</label>
                  <select
                    value={globalRule.lembur_perilaku_melewati}
                    onChange={(e) => setGlobalRule({ ...globalRule, lembur_perilaku_melewati: e.target.value })}
                  >
                    <option value="POTONG">POTONG (Jam berlebih tidak dibayar)</option>
                    <option value="TANDAI_SAJA">TANDAI SAJA (Tetap dibayar, tandai untuk review HRD)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              <Save size={16} />
              {saving ? "Menyimpan..." : "Simpan Konfigurasi Aturan"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
