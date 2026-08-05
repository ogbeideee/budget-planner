"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { currentMonthKey, formatMonthLabel, monthOffset } from "@/lib/date";
import type { Month } from "@/lib/types";

export interface MonthPickerProps {
  value: Month;
  onChange: (month: Month) => void;
}

export function MonthPicker({ value, onChange }: MonthPickerProps) {
  const isCurrent = value === currentMonthKey();
  return (
    <div className="flex items-center rounded-lg border border-border bg-surface shadow-card">
      <button
        type="button"
        onClick={() => onChange(monthOffset(value, -1))}
        aria-label="Previous month"
        className="flex h-11 w-11 items-center justify-center rounded-l-lg text-muted transition-colors duration-200 ease-premium hover:bg-canvas hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset focus:outline-none"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>
      <span
        aria-live="polite"
        className="min-w-32 whitespace-nowrap px-2 text-center text-sm font-semibold tabular-nums"
      >
        {formatMonthLabel(value)}
      </span>
      <button
        type="button"
        onClick={() => onChange(monthOffset(value, 1))}
        aria-label="Next month"
        className="flex h-11 w-11 items-center justify-center rounded-r-lg text-muted transition-colors duration-200 ease-premium hover:bg-canvas hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset focus:outline-none"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </button>
      {!isCurrent && (
        <button
          type="button"
          onClick={() => onChange(currentMonthKey())}
          className="mr-1 flex h-11 items-center rounded-md px-2.5 text-xs font-semibold text-brand-600 transition-colors duration-200 ease-premium hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset dark:text-brand-400 dark:hover:bg-brand-950"
        >
          This month
        </button>
      )}
    </div>
  );
}
