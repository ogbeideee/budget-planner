"use client";

import { useEffect, useState } from "react";

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

export function BarChart({ items, ariaLabel }: BarChartProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div role="img" aria-label={ariaLabel} className="flex flex-col gap-3">
      {items.map((item) => {
        const width =
          item.max > 0 ? Math.min(100, Math.round((item.value / item.max) * 100)) : 0;
        return (
          <div key={item.label} aria-hidden="true" className="flex items-center gap-3">
            <span className="w-28 truncate text-sm text-ink">{item.label}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-canvas">
              <div
                className="h-full rounded-full transition-[width] duration-150 ease-out motion-reduce:transition-none"
                style={{
                  width: ready ? `${width}%` : "0%",
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
      })}
    </div>
  );
}
