import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon?: LucideIcon;
}

export function StatCard({ label, value, sub, color = "#5005A6", icon: Icon }: StatCardProps) {
  return (
    <div style={{
      background: "white",
      borderRadius: 12,
      border: "0.5px solid #e5e7eb",
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{
            fontSize: 15, fontWeight: 600, color: "#6b7280",
            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6,
          }}>
            {label}
          </p>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", lineHeight: 1 }}>
            {value}
          </p>
          {sub && (
            <p style={{ fontSize: 15, color: "#6b7280", marginTop: 4 }}>{sub}</p>
          )}
        </div>
        {Icon && (
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: color + "20",
            display: "flex", alignItems: "center", justifyContent: "center",
            color,
          }}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
  );
}
