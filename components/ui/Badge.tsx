"use client";

import type { ReactNode } from "react";

export type BadgeTone = "income" | "expense" | "neutral";

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
}

const TONES: Record<BadgeTone, string> = {
  income: "bg-income/10 text-income",
  expense: "bg-expense/10 text-expense",
  neutral: "bg-canvas text-muted",
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
