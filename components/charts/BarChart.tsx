"use client";

import { memo } from "react";
import type { ReactNode } from "react";

/** Longest bar spans this % of the track; shorter bars keep the same ratios. */
const MAX_BAR_SPAN = 80;

export interface BarChartItem {
  label: string;
  value: number;
  max: number;
  color: string;
  valueLabel: string;
  pct?: string;
  /** Formatted budget limit for the tooltip; `null` renders "Not budgeted". */
  budget?: string | null;
  /** Formatted spent-for-tooltip string; falls back to `valueLabel`. */
  spent?: string;
  overBudget?: boolean;
  /** Optional leading icon tile rendered before the label. */
  icon?: ReactNode;
  iconClass?: string;
}

export interface BarChartProps {
  items: BarChartItem[];
  ariaLabel?: string;
  /** Rows at or after this index animate in (e.g. expanded categories). */
  animateFrom?: number;
}

interface BarRowProps {
  item: BarChartItem;
  animate: boolean;
}

const BarRow = memo(function BarRow({ item, animate }: BarRowProps) {
  const width =
    item.max > 0 ? Math.round((item.value / item.max) * MAX_BAR_SPAN) : 0;
  return (
    <div
      aria-hidden="true"
      className={`group relative flex items-center gap-4 ${
        animate ? "animate-[list-in_220ms_var(--ease-premium)]" : ""
      }`}
    >
      {item.icon && (
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-base ${
            item.iconClass ?? "bg-sidebar-hover text-muted"
          }`}
        >
          {item.icon}
        </span>
      )}
      <span className="w-28 truncate text-sm text-ink">{item.label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.06] dark:bg-white/[0.08]">
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-premium motion-reduce:transition-none"
          style={{
            width: `${width}%`,
            backgroundColor: item.color,
          }}
        />
      </div>
      <div className="w-24 shrink-0 text-right">
        <p className="text-sm font-medium tabular-nums text-ink">
          {item.valueLabel}
        </p>
        {item.pct && (
          <p className="text-xs tabular-nums text-muted">{item.pct}</p>
        )}
      </div>
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-max whitespace-nowrap rounded-lg border border-border/40 bg-ink px-3 py-2 text-left text-canvas opacity-0 shadow-pop transition-opacity duration-100 group-hover:opacity-100 motion-reduce:transition-none"
      >
        <p className="text-sm font-semibold">{item.label}</p>
        <dl className="mt-1.5 space-y-0.5 text-xs">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-canvas/60">Amount</dt>
            <dd className="tabular-nums">{item.valueLabel}</dd>
          </div>
          {item.pct && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-canvas/60">Percentage</dt>
              <dd className="tabular-nums">{item.pct}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-canvas/60">Budget limit</dt>
            <dd className="tabular-nums">{item.budget ?? "Not budgeted"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-canvas/60">Spent</dt>
            <dd
              className={`tabular-nums ${
                item.overBudget ? "font-semibold text-danger" : ""
              }`}
            >
              {item.spent ?? item.valueLabel}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
});

export function BarChart({ items, ariaLabel, animateFrom }: BarChartProps) {
  return (
    <div role="img" aria-label={ariaLabel} className="flex flex-col gap-4">
      {items.map((item, index) => (
        <BarRow
          key={item.label}
          item={item}
          animate={animateFrom !== undefined && index >= animateFrom}
        />
      ))}
    </div>
  );
}
