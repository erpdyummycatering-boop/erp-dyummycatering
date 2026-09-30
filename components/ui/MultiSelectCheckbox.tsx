"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Check } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectCheckboxProps {
  options: Option[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  allLabel?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function MultiSelectCheckbox({
  options,
  selectedValues,
  onChange,
  placeholder = "Semua Channel",
  allLabel = "Semua Channel",
  style,
  className,
}: MultiSelectCheckboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const isAllSelected = selectedValues.length === 0 || selectedValues.length === options.length;

  const handleToggleAll = () => {
    if (isAllSelected) {
      // If currently all selected, toggle to empty
      onChange([]);
    } else {
      // Select all
      onChange(options.map((o) => o.value));
    }
  };

  const handleToggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      const next = selectedValues.filter((v) => v !== val);
      onChange(next);
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  // Label to display on button
  let displayLabel = placeholder;
  if (selectedValues.length === 1) {
    const found = options.find((o) => o.value === selectedValues[0]);
    displayLabel = found ? found.label : selectedValues[0];
  } else if (selectedValues.length > 1 && selectedValues.length < options.length) {
    displayLabel = `${selectedValues.length} Terpilih`;
  } else if (selectedValues.length === options.length && options.length > 0) {
    displayLabel = allLabel;
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", display: "inline-block", zIndex: isOpen ? 9999 : "auto", ...style }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: "100%",
          padding: "6px 10px",
          background: "white",
          border: isOpen ? "1.5px solid #5005A6" : "1px solid #d1d5db",
          borderRadius: 8,
          fontSize: 13,
          color: selectedValues.length > 0 ? "#111827" : "#4b5563",
          fontWeight: selectedValues.length > 0 ? 600 : 500,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          boxShadow: isOpen ? "0 0 0 3px rgba(80, 5, 166, 0.1)" : "none",
          transition: "border-color 0.15s ease",
          minHeight: 34,
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "left",
            flex: 1,
          }}
        >
          {displayLabel}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {selectedValues.length > 0 && (
            <span
              onClick={handleClear}
              title="Reset Filter"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 2,
                borderRadius: 4,
                color: "#9ca3af",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#E24B4A")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown
            size={14}
            color="#6b7280"
            style={{
              transform: isOpen ? "rotate(180deg)" : "none",
              transition: "transform 0.15s ease",
            }}
          />
        </div>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 9999,
            minWidth: 200,
            width: "100%",
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.15)",
            padding: "4px 0",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {/* Semua Channel Option */}
          <div
            onClick={handleToggleAll}
            style={{
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              borderBottom: "1px solid #f3f4f6",
              background: isAllSelected ? "#fbf7ff" : "white",
              fontWeight: 600,
              fontSize: 13,
              color: "#374151",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f3e8ff")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = isAllSelected ? "#fbf7ff" : "white")
            }
          >
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={() => {}} // Handled by div click
              style={{
                width: 15,
                height: 15,
                accentColor: "#5005A6",
                cursor: "pointer",
              }}
            />
            <span>{allLabel}</span>
          </div>

          {/* Individual Options */}
          {options.map((opt) => {
            const checked = selectedValues.includes(opt.value);
            return (
              <div
                key={opt.value}
                onClick={() => handleToggleOption(opt.value)}
                style={{
                  padding: "7px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  color: checked ? "#111827" : "#4b5563",
                  background: checked ? "#fbf7ff" : "white",
                  fontWeight: checked ? 600 : 400,
                  transition: "background 0.1s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f3ff")}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = checked ? "#fbf7ff" : "white")
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {}} // Handled by div click
                  style={{
                    width: 15,
                    height: 15,
                    accentColor: "#5005A6",
                    cursor: "pointer",
                  }}
                />
                <span style={{ flex: 1 }}>{opt.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
