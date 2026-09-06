"use client";

import { useState } from "react";
import { FileSpreadsheet, Download, RefreshCw, UploadCloud, AlertTriangle, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/ui/PageHeader";

export default function UploadPresensiPage() {
  const [file, setFile] = useState<File | null>(null);
  const [periodeTahun, setPeriodeTahun] = useState("2026");
  const [periodeBulan, setPeriodeBulan] = useState("9");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch("/api/hr/employees");
      const employees = await res.json();

      const rows = Array.isArray(employees) && employees.length > 0
        ? employees.map((emp: any) => ({
            "No Fingerprint": emp.no_fingerprint || "",
            "Nama Karyawan": emp.nama_fingerprint || emp.nama_lengkap,
            "Tanggal": `${periodeTahun}-${String(periodeBulan).padStart(2, "0")}-01`,
            "Jam Masuk": "08:00",
            "Jam Keluar": "17:00",
            "Keterangan": "Hadir",
          }))
        : [
            {
              "No Fingerprint": "40",
              "Nama Karyawan": "Wiwi Sumiati",
              "Tanggal": `${periodeTahun}-${String(periodeBulan).padStart(2, "0")}-01`,
              "Jam Masuk": "08:00",
              "Jam Keluar": "17:00",
              "Keterangan": "Hadir",
            },
          ];

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template_Presensi");
      XLSX.writeFile(wb, `Template_Presensi_Manual_${periodeTahun}_${periodeBulan}.xlsx`);
    } catch (err: any) {
      alert("Gagal mengunduh template karyawan: " + err.message);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert("Pilih file Excel terlebih dahulu!");
      return;
    }

    setUploading(true);
    setResult(null);
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("periode_tahun", periodeTahun);
      formData.append("periode_bulan", periodeBulan);

      const res = await fetch("/api/hr/attendance/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setErrorMsg(data.error || "Gagal memproses file upload");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Upload Presensi Fingerprint"
        subtitle="Unggah file .xlsx / .xls dari mesin fingerprint (Format A AttendanceRecord atau Format B AllReport)"
      />

      {/* Upload Form */}
      <div className="erp-card" style={{ padding: 24 }}>
        <form onSubmit={handleUpload} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Periode Tahun</label>
              <select
                value={periodeTahun}
                onChange={(e) => setPeriodeTahun(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Periode Bulan</label>
              <select
                value={periodeBulan}
                onChange={(e) => setPeriodeBulan(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              >
                {[
                  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
                ].map((m, idx) => (
                  <option key={idx + 1} value={String(idx + 1)}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* File Dropzone */}
          <div className="border-2 border-dashed border-purple-200 rounded-2xl p-8 text-center bg-purple-50/20 hover:bg-purple-50/50 transition-all">
            <input
              type="file"
              accept=".xlsx, .xls"
              id="file-upload"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center text-[#5005A6]">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <div>
                <span className="font-bold text-[#5005A6] hover:underline">Klik untuk memilih file</span>
                <span className="text-gray-500 text-sm"> atau drag and drop file di sini</span>
              </div>
              <p className="text-xs text-gray-400">Format yang didukung: .xlsx, .xls (Maksimal 10MB)</p>
            </label>
            {file && (
              <div className="mt-4 p-3 bg-white rounded-lg border border-purple-200 text-sm font-medium text-purple-900 inline-block">
                📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="text-xs text-[#5005A6] font-semibold hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0"
            >
              <Download size={14} /> Download Template Excel Manual (Semua Karyawan)
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="btn btn-primary"
            >
              {uploading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Memproses File...
                </>
              ) : (
                <>
                  <UploadCloud size={14} /> Process & Import Presensi
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-lg">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            {result.message}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="bg-gray-50 p-4 rounded-xl text-center">
              <div className="text-xs text-gray-500 font-semibold">Total Baris</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{result.summary?.total_rows || 0}</div>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl text-center">
              <div className="text-xs text-emerald-700 font-semibold">Matched</div>
              <div className="text-2xl font-bold text-emerald-800 mt-1">{result.summary?.matched || 0}</div>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl text-center">
              <div className="text-xs text-amber-700 font-semibold">Anomali</div>
              <div className="text-2xl font-bold text-amber-800 mt-1">{result.summary?.anomali || 0}</div>
            </div>
            <div className="bg-rose-50 p-4 rounded-xl text-center">
              <div className="text-xs text-rose-700 font-semibold">Unmatched</div>
              <div className="text-2xl font-bold text-rose-800 mt-1">{result.summary?.unmatched || 0}</div>
            </div>
          </div>

          {result.summary?.unmatched_names?.length > 0 && (
            <div className="mt-4 p-4 bg-rose-50/50 rounded-xl border border-rose-100 text-xs">
              <div className="font-bold text-rose-800 mb-1">
                ⚠️ Nama di Fingerprint Tidak Ditemukan di Master ({result.summary.unmatched_names.length}):
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {result.summary.unmatched_names.map((name: string, idx: number) => (
                  <span key={idx} className="bg-white px-2 py-1 rounded border border-rose-200 font-mono text-rose-900">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
