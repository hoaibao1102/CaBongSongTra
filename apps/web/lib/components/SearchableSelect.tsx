"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";

export interface SearchOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

export interface SearchableSelectProps {
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Chọn một mục...",
  disabled = false,
  id,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(query.toLowerCase()) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(query.toLowerCase())) ||
      (opt.badge && opt.badge.toLowerCase().includes(query.toLowerCase())),
  );

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleSelect = (val: string, e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onChange(val);
    setIsOpen(false);
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setQuery("");
  };

  return (
    <div
      ref={containerRef}
      className={`cbst-searchable-select ${disabled ? "disabled" : ""}`}
      id={id}
    >
      <div
        className={`cbst-select-trigger ${isOpen ? "focused" : ""}`}
        onClick={handleOpen}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpen();
          }
        }}
      >
        <div className="cbst-select-display">
          {selectedOption ? (
            <div className="cbst-select-selected-content">
              <span className="cbst-select-label">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className="cbst-select-badge">{selectedOption.badge}</span>
              )}
              {selectedOption.sublabel && (
                <span className="cbst-select-sublabel">
                  ({selectedOption.sublabel})
                </span>
              )}
            </div>
          ) : (
            <span className="cbst-select-placeholder">{placeholder}</span>
          )}
        </div>

        <div className="cbst-select-actions">
          {value && !disabled && (
            <button
              type="button"
              className="cbst-select-clear"
              onClick={handleClear}
              aria-label="Xóa chọn"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={16}
            className={`cbst-select-arrow ${isOpen ? "open" : ""}`}
          />
        </div>
      </div>

      {isOpen && (
        <div className="cbst-select-dropdown">
          <div className="cbst-select-search-box">
            <Search size={16} className="cbst-select-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="cbst-select-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Gõ để tìm kiếm..."
            />
          </div>

          <div className="cbst-select-options-list">
            {filteredOptions.length === 0 ? (
              <div className="cbst-select-empty">Không tìm thấy kết quả</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    className={`cbst-select-option ${isSelected ? "selected" : ""}`}
                    onMouseDown={(e) => handleSelect(opt.value, e)}
                    onClick={(e) => handleSelect(opt.value, e)}
                  >
                    <div className="cbst-select-option-text">
                      <div className="cbst-select-option-main">
                        <span className="cbst-select-option-label">
                          {opt.label}
                        </span>
                        {opt.badge && (
                          <span className="cbst-select-badge">{opt.badge}</span>
                        )}
                      </div>
                      {opt.sublabel && (
                        <span className="cbst-select-option-sub">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check size={16} className="cbst-select-check" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
