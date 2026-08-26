"use client";

import type { ReactNode } from "react";

export interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
  /**
   * Let a long label wrap onto several lines instead of staying on one row.
   * Use for sentence-length help text; leave off for short labels.
   */
  wrap?: boolean;
}

export function Tooltip({
  label,
  children,
  side = "top",
  className = "",
  wrap = false,
}: TooltipProps) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 rounded-sm bg-tooltip px-3.5 py-2 text-caption font-medium leading-relaxed text-tooltip-text opacity-0 shadow-card-hover transition-opacity duration-150 ease-premium group-hover:opacity-100 group-focus-within:opacity-100 group-focus-visible:opacity-100 ${
          wrap ? "w-64 whitespace-normal text-left" : "whitespace-nowrap"
        } ${side === "top" ? "bottom-full mb-2" : "top-full mt-2"}`}
      >
        {label}
      </span>
    </span>
  );
}
