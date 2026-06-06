"use client";
import Select from "react-select";

export interface OptionType {
  value: string | number;
  label: string;
  category?: string; 
  color?: string; 
  isBold?: boolean; 
}

interface Props {
  options: OptionType[];
  value: string | number;
  onChange: (val: any) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  menuPortalTarget?: HTMLElement | null;
}

export function SearchableSelect({ options, value, onChange, placeholder, className, style, disabled, menuPortalTarget }: Props) {
  const selectedObj = options.find(o => String(o.value) === String(value)) || null;

  return (
    <div style={{ ...style, width: style?.width || '100%' }} className={className}>
      <Select
        isDisabled={disabled}
        options={options}
        value={selectedObj}
        onChange={(val: any) => onChange(val ? val.value : "")}
        placeholder={placeholder || "-- Pilih --"}
        isClearable
        menuPortalTarget={menuPortalTarget}
        formatOptionLabel={(option: OptionType) => (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <span>{option.label}</span>
            {option.category && (
              <span style={{
                background: "#f0e6fa",
                color: "#5005A6",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "10px",
                fontWeight: 600,
                marginLeft: "8px"
              }}>
                {option.category}
              </span>
            )}
          </div>
        )}
        styles={{
          control: (base) => ({
            ...base,
            borderRadius: '8px',
            borderColor: '#d1d5db',
            fontSize: '13px',
            minHeight: '34px',
            boxShadow: 'none',
            '&:hover': {
              borderColor: '#9ca3af'
            }
          }),
          menu: (base) => ({
            ...base,
            fontSize: '13px',
            zIndex: 9999
          }),
          menuPortal: base => ({ ...base, zIndex: 9999 }),
          option: (base, { data }) => ({
            ...base,
            color: data.color || base.color,
            fontWeight: data.isBold ? 'bold' : base.fontWeight,
            cursor: 'pointer'
          }),
          singleValue: (base, { data }) => ({
            ...base,
            color: data.color || base.color,
            fontWeight: data.isBold ? 'bold' : base.fontWeight,
          })
        }}
      />
    </div>
  );
}
