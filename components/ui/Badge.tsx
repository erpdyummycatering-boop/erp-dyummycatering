import type { BadgeColor } from "@/lib/utils";

const COLOR_MAP: Record<BadgeColor, { bg: string; text: string }> = {
  green:  { bg: "#EAF3DE", text: "#3B6D11" },
  red:    { bg: "#FCEBEB", text: "#A32D2D" },
  yellow: { bg: "#FAEEDA", text: "#854F0B" },
  blue:   { bg: "#E6F1FB", text: "#185FA5" },
  gray:   { bg: "#F1EFE8", text: "#5F5E5A" },
  purple: { bg: "#EEEDFE", text: "#3C3489" },
  teal:   { bg: "#F0E6FA", text: "#3b047a" },
};

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
}

export function Badge({ children, color = "gray" }: BadgeProps) {
  const c = COLOR_MAP[color] || COLOR_MAP.gray;
  return (
    <span style={{
      background: c.bg,
      color: c.text,
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 15,
      fontWeight: 600,
      whiteSpace: "nowrap",
      display: "inline-block",
    }}>
      {children}
    </span>
  );
}
