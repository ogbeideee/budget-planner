"use client";

import { memo } from "react";

export interface BarChartItem {
  label: string;
  value: number;
  max: number;
  color: string;
  valueLabel: string;
  pct?: string;
}

export interface BarChartProps {
  items: BarChartItem[];
  ariaLabel?: string;
}

interface BarRowProps {
  item: BarChartItem;
}

const BarRow = memo(function BarRow({ item }: BarRowProps) {
  const width =
    item.max > 0 ? Math.min(100, Math.round((item.value / item.max) * 100)) : 0;
  return (
    <div aria-hidden="true" className="flex items-center gap-3">
      <span className="w-28 truncate text-sm text-ink">{item.label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-canvas">
        <div
          className="h-full rounded-full transition-[width] duration-150 ease-out motion-reduce:transition-none"
          style={{
            width: `${width}%`,
            backgroundColor: item.color,
          }}
        />
      </div>
      <span className="w-28 shrink-0 text-right text-sm tabular-nums text-muted">
        {item.valueLabel}
        {item.pct ? ` · ${item.pct}` : ""}
      </span>
    </div>
  );
});

export function BarChart({ items, ariaLabel }: BarChartProps) {
  return (
    <div role="img" aria-label={ariaLabel} className="flex flex-col gap-3">
      {items.map((item) => (
        <BarRow key={item.label} item={item} />
      ))}
    </div>
  );
}
