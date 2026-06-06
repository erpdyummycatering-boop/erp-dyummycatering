"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X, Download, Loader2 } from "lucide-react";

interface XlsxImportModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** API endpoint untuk batch import, e.g. "/api/customers/import" */
  importUrl: string;
  /** Nama entitas untuk label, e.g. "Customer" */
  entityLabel: string;
  /** Kolom yang akan ditampilkan di preview table (key: header DB, label: label tampil) */
  columns: { key: string; label: string }[];
  /** Template download: array of object contoh */
  templateData: Record<string, string>[];
  /** Nama file template yang didownload */
  templateFileName: string;
}

type ImportStep = "upload" | "preview" | "result";

export function XlsxImportModal({
  show,
  onClose,
  onSuccess,
  importUrl,
  entityLabel,
  columns,
  templateData,
  templateFileName,
}: XlsxImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>("upload");
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number; errors: string[]; total: number } | null>(null);
  const [parseError, setParseError] = useState("");

  const reset = () => {
    setStep("upload");
    setParsedRows([]);
    setFileName("");
    setImporting(false);
    setResult(null);
    setParseError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (file: File) => {
    setParseError("");
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
        if (!json.length) { setParseError("File kosong atau format tidak dikenali."); return; }
        // Normalize keys: lowercase + underscore
        const normalized = json.map((row: any) => {
          const out: any = {};
          Object.keys(row).forEach(k => {
            const norm = k.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
            out[norm] = row[k];
          });
          return out;
        });
        setParsedRows(normalized);
        setStep("preview");
      } catch (err) {
        setParseError("Gagal membaca file. Pastikan format .xlsx atau .xls.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await fetch(importUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows }),
      });
      const data = await res.json();
      if (!res.ok) { setParseError(data.error || "Import gagal"); setImporting(false); return; }
      setResult(data);
      setStep("result");
      onSuccess();
    } catch {
      setParseError("Terjadi kesalahan jaringan.");
    }
    setImporting(false);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, templateFileName);
  };

  if (!show) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={handleClose}
    >
      <div
        style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 760, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#5005A620", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileSpreadsheet size={18} color="#5005A6" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>Import {entityLabel} dari Excel</h3>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                {step === "upload" && "Upload file .xlsx atau .xls"}
                {step === "preview" && `${parsedRows.length} baris siap diimport — periksa sebelum lanjut`}
                {step === "result" && "Import selesai"}
              </p>
            </div>
          </div>
          <button onClick={handleClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 4, display: "flex" }}>
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", padding: "10px 20px", gap: 8, borderBottom: "1px solid #f3f4f6" }}>
          {(["upload", "preview", "result"] as ImportStep[]).map((s, i) => {
            const labels = ["Upload File", "Preview Data", "Hasil Import"];
            const active = s === step;
            const done = (step === "preview" && s === "upload") || (step === "result" && s !== "result");
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  background: done ? "#5005A6" : active ? "#5005A620" : "#f3f4f6",
                  color: done ? "white" : active ? "#5005A6" : "#9ca3af",
                  border: active ? "2px solid #5005A6" : "2px solid transparent",
                }}>
                  {done ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? "#111827" : "#9ca3af" }}>{labels[i]}</span>
                {i < 2 && <span style={{ color: "#e5e7eb", margin: "0 4px" }}>›</span>}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          {/* ---- STEP: UPLOAD ---- */}
          {step === "upload" && (
            <div>
              {/* Download template */}
              <div style={{ marginBottom: 16, padding: "12px 16px", background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#166534" }}>Download Template Excel</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#15803d" }}>
                    Isi data mengikuti format kolom yang sudah tersedia
                  </p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={downloadTemplate} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Download size={13} /> Template
                </button>
              </div>

              {/* Kolom info */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "#374151" }}>Kolom yang dikenali:</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {columns.map(c => (
                    <span key={c.key} style={{ padding: "3px 10px", background: "#f3f4f6", borderRadius: 20, fontSize: 11, fontWeight: 500, color: "#374151", border: "1px solid #e5e7eb" }}>
                      <code style={{ fontFamily: "monospace" }}>{c.key}</code>
                    </span>
                  ))}
                </div>
              </div>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: "2px dashed #d1d5db", borderRadius: 12, padding: "40px 24px",
                  textAlign: "center", cursor: "pointer", transition: "all 0.2s",
                  background: "#fafafa",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#5005A6")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#d1d5db")}
              >
                <Upload size={32} color="#9ca3af" style={{ marginBottom: 12 }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#374151" }}>Drag & drop file Excel di sini</p>
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6b7280" }}>atau klik untuk pilih file (.xlsx, .xls)</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              </div>

              {parseError && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca" }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#dc2626", display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={13} /> {parseError}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ---- STEP: PREVIEW ---- */}
          {step === "preview" && (
            <div>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FileSpreadsheet size={16} color="#5005A6" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{fileName}</span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>— {parsedRows.length} baris</span>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={reset}>Ganti File</button>
              </div>
              <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
                <table style={{ fontSize: 12, minWidth: "100%" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 600, width: 40 }}>No.</th>
                      {columns.map(c => (
                        <th key={c.key} style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 50).map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                        <td style={{ padding: "7px 12px", color: "#9ca3af" }}>{i + 1}</td>
                        {columns.map(c => (
                          <td key={c.key} style={{ padding: "7px 12px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {String(row[c.key] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 50 && (
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "#6b7280", textAlign: "center" }}>
                  Menampilkan 50 dari {parsedRows.length} baris. Semua baris akan diimport.
                </p>
              )}
              {parseError && (
                <div style={{ marginTop: 10, padding: "10px 14px", background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca" }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#dc2626" }}>{parseError}</p>
                </div>
              )}
            </div>
          )}

          {/* ---- STEP: RESULT ---- */}
          {step === "result" && result && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <CheckCircle size={32} color="#5005A6" />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#111827" }}>Import Selesai!</h3>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>Data berhasil diproses</p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}>
                <div style={{ padding: "14px 24px", background: "#f0fdf4", borderRadius: 12, border: "1px solid #bbf7d0" }}>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#5005A6" }}>{result.inserted}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#166534" }}>Baris ditambahkan</p>
                </div>
                <div style={{ padding: "14px 24px", background: "#fffbeb", borderRadius: 12, border: "1px solid #fde68a" }}>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#92400e" }}>{result.skipped}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#78350f" }}>Diperbarui / Dilewati</p>
                </div>
                <div style={{ padding: "14px 24px", background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#374151" }}>{result.total}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>Total diproses</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div style={{ textAlign: "left", background: "#fef2f2", borderRadius: 10, padding: "12px 16px", border: "1px solid #fecaca" }}>
                  <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "#dc2626" }}>
                    <AlertTriangle size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    {result.errors.length} baris dengan masalah:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {result.errors.slice(0, 10).map((e, i) => (
                      <li key={i} style={{ fontSize: 11, color: "#b91c1c", marginBottom: 2 }}>{e}</li>
                    ))}
                    {result.errors.length > 10 && <li style={{ fontSize: 11, color: "#9ca3af" }}>... dan {result.errors.length - 10} lainnya</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button className="btn btn-secondary" onClick={handleClose}>
            {step === "result" ? "Tutup" : "Batal"}
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {step === "preview" && (
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={importing}
                style={{ display: "flex", alignItems: "center", gap: 6, opacity: importing ? 0.7 : 1 }}
              >
                {importing ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Mengimport...</> : <><Upload size={14} /> Import {parsedRows.length} Baris</>}
              </button>
            )}
            {step === "result" && (
              <button className="btn btn-secondary" onClick={reset} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Upload size={14} /> Import Lagi
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
