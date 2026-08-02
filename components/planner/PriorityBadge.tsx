"use client";

import type { Priority } from "@/lib/types";

const LABELS: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const CLASSES: Record<Priority, string> = {
  high: "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300",
  medium: "bg-slate-100 text-muted dark:bg-slate-700/60 dark:text-slate-300",
  low: "text-muted border border-border",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      title={`Priority: ${LABELS[priority]}`}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${CLASSES[priority]}`}
    >
      {LABELS[priority]}
    </span>
  );
}
