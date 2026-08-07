"use client";

import type { ReactNode } from "react";

export interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}

export function Tooltip({
  label,
  children,
  side = "top",
  className = "",
}: TooltipProps) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-sm bg-tooltip px-3.5 py-2 text-caption font-medium text-tooltip-text opacity-0 shadow-card-hover transition-opacity duration-150 ease-premium group-hover:opacity-100 group-focus-visible:opacity-100 ${
          side === "top" ? "bottom-full mb-2" : "top-full mt-2"
        }`}
      >
        {label}
      </span>
    </span>
  );
}
