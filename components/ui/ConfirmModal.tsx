"use client";

import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  show: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  show,
  title = "Konfirmasi",
  message,
  confirmLabel = "Ya, Hapus",
  cancelLabel = "Batal",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1200,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "white", borderRadius: 16,
          width: "100%", maxWidth: 400,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          padding: 28,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: danger ? "#fef2f2" : "#fffbeb",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <AlertTriangle size={24} color={danger ? "#E24B4A" : "#BA7517"} />
        </div>

        {/* Title */}
        <h3 style={{ textAlign: "center", margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "#111827" }}>
          {title}
        </h3>

        {/* Message */}
        <p style={{ textAlign: "center", margin: "0 0 24px", fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
          {message}
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ flex: 1 }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: "9px 16px",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              background: danger ? "#E24B4A" : "#BA7517",
              color: "white",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
