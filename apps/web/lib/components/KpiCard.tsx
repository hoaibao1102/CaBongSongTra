"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  variant?: "brand" | "emerald" | "amber" | "purple" | "blue" | "red" | "neutral";
}

export function KpiCard({
  title,
  value,
  subtext,
  icon: Icon,
  variant = "brand",
}: KpiCardProps) {
  const variantClass = `kpi-${variant}`;

  return (
    <div className={`cbst-kpi-card ${variantClass}`}>
      <div className="cbst-kpi-content">
        <span className="cbst-kpi-title">{title}</span>
        <div className="cbst-kpi-value">{value}</div>
        {subtext && <span className="cbst-kpi-subtext">{subtext}</span>}
      </div>
      {Icon && (
        <div className="cbst-kpi-icon-badge">
          <Icon size={22} strokeWidth={1.8} />
        </div>
      )}
    </div>
  );
}
