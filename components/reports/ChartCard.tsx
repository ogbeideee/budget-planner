"use client";

import type { ReactNode } from "react";

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <section className="flex min-h-[300px] flex-col rounded-xl border border-border/70 bg-surface p-6 shadow-card">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-card-title font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {subtitle && (
          <span className="text-sm font-medium text-muted">{subtitle}</span>
        )}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
