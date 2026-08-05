"use client";

import type { ReactNode } from "react";

export interface CardProps {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  id?: string;
  variant?: "standard" | "quiet" | "brand";
  className?: string;
}

const CHROME = {
  standard: "rounded-xl bg-surface shadow-card",
  quiet: "rounded-xl border border-border/60 bg-canvas/40 shadow-none",
  brand: "rounded-xl border border-brand-500/20 shadow-card",
} as const;

export function Card({
  children,
  title,
  action,
  id,
  variant = "standard",
  className = "",
}: CardProps) {
  return (
    <section
      id={id}
      className={`${CHROME[variant]} ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
          {title && (
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">
              {title}
            </h2>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
