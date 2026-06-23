interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      marginBottom: 20, flexWrap: "wrap", gap: 8,
    }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>{title}</h1>
        {subtitle && (
          <p style={{ fontSize: 15, color: "#6b7280", marginTop: 2 }}>{subtitle}</p>
        )}
      </div>
      {actions && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {actions}
        </div>
      )}
    </div>
  );
}

interface FormRowProps { children: React.ReactNode; }
export function FormRow({ children }: FormRowProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
      {children}
    </div>
  );
}

interface FormFieldProps { label: string; children: React.ReactNode; style?: React.CSSProperties; }
export function FormField({ label, children, style }: FormFieldProps) {
  return (
    <div style={style}>
      <label>{label}</label>
      {children}
    </div>
  );
}
