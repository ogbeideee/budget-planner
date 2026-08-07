"use client";

import type { ReactNode } from "react";

export interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  id?: string;
  variant?: "standard" | "quiet" | "brand";
  className?: string;
}

const CHROME = {
  standard: "rounded-xl border border-border/70 bg-surface shadow-card",
  quiet: "rounded-xl border border-border/50 bg-canvas/40",
  brand: "rounded-xl border border-brand-500/20 bg-surface shadow-card",
} as const;

export function Card({
  children,
  title,
  subtitle,
  action,
  id,
  variant = "standard",
  className = "",
}: CardProps) {
  const hasHeader = title !== undefined || subtitle !== undefined || action;
  return (
    <section id={id} className={`${CHROME[variant]} ${className}`}>
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-4 px-6 pb-1 pt-6">
          <div className="min-w-0">
            {title && (
              <h2 className="text-card-title font-semibold tracking-tight text-ink">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-sm font-medium text-muted">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={hasHeader ? "px-6 pb-6 pt-2" : "p-6"}>{children}</div>
    </section>
  );
}
