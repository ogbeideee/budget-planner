"use client";

import { formatMonthLabel, monthOffset, currentMonthKey } from "@/lib/date";
import type { Month } from "@/lib/types";

export interface MonthPickerProps {
  value: Month;
  onChange: (month: Month) => void;
}

export function MonthPicker({ value, onChange }: MonthPickerProps) {
  const isCurrent = value === currentMonthKey();
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(monthOffset(value, -1))}
        aria-label="Previous month"
        className="flex h-11 w-11 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        ←
      </button>
      <span
        aria-live="polite"
        className="min-w-36 px-2 text-center text-sm font-semibold"
      >
        {formatMonthLabel(value)}
      </span>
      <button
        type="button"
        onClick={() => onChange(monthOffset(value, 1))}
        aria-label="Next month"
        className="flex h-11 w-11 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        →
      </button>
      {!isCurrent && (
        <button
          type="button"
          onClick={() => onChange(currentMonthKey())}
          className="ml-1 h-11 rounded-md px-3 text-sm font-semibold text-brand-600 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-brand-400 dark:hover:bg-brand-950"
        >
          This month
        </button>
      )}
    </div>
  );
}
