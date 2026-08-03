"use client";

import type { ReactNode } from "react";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/types";

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
    <span className={className}>
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
    <span className={className}>{formatMoney(Math.round(display), currency)}</span>
  );
}