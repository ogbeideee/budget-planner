"use client";

import type { ReactNode } from "react";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/types";

/**
 * Tabular figures are baked in here rather than left to each call site: these
 * two render every animated amount in the app, and proportional digits make a
 * value jitter as it animates and misalign row to row in a column. Callers can
 * still pass their own classes; a caller repeating "tabular-nums" is harmless.
 */
const TABULAR = "tabular-nums";

export interface AnimatedNumberProps {
  value: number;
  className?: string;
  children?: (display: number) => ReactNode;
}

export function AnimatedNumber({
  value,
  className,
  children,
}: AnimatedNumberProps) {
  const display = useAnimatedNumber(value);
  return (
    <span className={`${TABULAR} ${className ?? ""}`.trim()}>
      {children ? children(display) : display.toLocaleString("en-US")}
    </span>
  );
}

export interface AnimatedMoneyProps {
  value: number;
  currency: Currency;
  className?: string;
}

export function AnimatedMoney({
  value,
  currency,
  className,
}: AnimatedMoneyProps) {
  const display = useAnimatedNumber(value);
  return (
    <span className={`${TABULAR} ${className ?? ""}`.trim()}>
      {formatMoney(Math.round(display), currency)}
    </span>
  );
}
