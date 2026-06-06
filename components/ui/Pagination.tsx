"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
}

export function Pagination({ page, totalPages, total, limit, onChange, onLimitChange }: Props) {
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i);
    else if (pages[pages.length - 1] !== "...") pages.push("...");
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "0.5px solid #f3f4f6", flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <p style={{ fontSize: 12, color: "#6b7280", margin: 0, whiteSpace: "nowrap" }}>Menampilkan {from}–{to} dari {total} data</p>
        {onLimitChange && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>| Baris per hal:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              style={{ fontSize: 12, padding: "2px 4px", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer" }}
            >
              {[10, 20, 50, 100].map(val => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => onChange(page - 1)} disabled={page === 1}>
          <ChevronLeft size={12} />
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={i} style={{ padding: "4px 8px", fontSize: 12, color: "#9ca3af" }}>…</span>
          ) : (
            <button key={i} className="btn btn-sm" onClick={() => onChange(p as number)}
              style={{ background: p === page ? "var(--primary)" : "white", color: p === page ? "white" : "#374151", border: "1px solid", borderColor: p === page ? "var(--primary)" : "#e5e7eb" }}>
              {p}
            </button>
          )
        )}
        <button className="btn btn-secondary btn-sm" onClick={() => onChange(page + 1)} disabled={page === totalPages}>
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
