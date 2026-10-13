"use client";

import React from "react";

export interface CurrencyInputProps {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  id?: string;
  className?: string;
}

export function formatVndString(val: number): string {
  if (!Number.isFinite(val) || val === 0) return "";
  return new Intl.NumberFormat("vi-VN").format(Math.round(val));
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = "0",
  disabled = false,
  required = false,
  min = 0,
  max = 1_000_000_000,
  id,
  className = "",
}: CurrencyInputProps) {
  const displayString = value ? formatVndString(value) : "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      onChange(0);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
    }
  };

  return (
    <div className={`cbst-currency-input-wrapper ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        id={id}
        value={displayString}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="cbst-currency-input"
      />
      <span className="cbst-currency-suffix">đ</span>
    </div>
  );
}
