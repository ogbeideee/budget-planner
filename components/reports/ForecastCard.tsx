"use client";

import { useMemo, useId } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SparklesIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import { monthlyPredictions } from "@/lib/predictions";
import { formatMonthLabel } from "@/lib/date";
import type { Currency, IncomePlan, Month, Transaction } from "@/lib/types";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useChartColors } from "@/hooks/useChartColors";

interface ForecastCardProps {
  month: Month;
  transactions: Transaction[];
  incomePlans: IncomePlan[];
  currency: Currency;
  isCurrentMonth: boolean;
  netHistory: Array<{ month: Month; net: number }>;
}

function confidenceLevel(daysElapsed: number): {
  label: string;
  variant: "success" | "info" | "neutral";
} {
  if (daysElapsed >= 20) return { label: "High confidence", variant: "success" };
  if (daysElapsed >= 10) return { label: "Medium confidence", variant: "info" };
  return { label: "Early estimate", variant: "neutral" };
}

export function ForecastCard({
  month,
  transactions,
  incomePlans,
  currency,
  isCurrentMonth,
  netHistory,
}: ForecastCardProps) {
  const fmt = (value: number) => formatMoney(value, currency);
  const reduced = useReducedMotion();
  const colors = useChartColors();
  const gradientId = useId();

  const predictions = useMemo(
    () => monthlyPredictions(transactions, month, incomePlans),
    [transactions, month, incomePlans],
  );

  if (!isCurrentMonth) {
    return (
      <Card variant="quiet" className="print-block">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400"
          >
            <SparklesIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-card-title font-bold tracking-tight text-ink">
              Forecasted month-end balance
            </p>
            <p className="mt-1 text-base font-medium leading-6 text-muted">
              Predictions compare today against the selected month, so they
              unlock when you view the current month.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const balance = predictions.projectedSavings;
  const confidence = confidenceLevel(predictions.daysElapsed);
  const hasTrend = netHistory.some((point) => point.net !== 0);

  return (
    <Card className="print-block">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400"
          >
            <SparklesIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-card-title font-bold tracking-tight text-ink">
                Forecasted month-end balance
              </p>
              <Badge variant={confidence.variant}>{confidence.label}</Badge>
            </div>
            <p
              className={`mt-3 text-kpi-tertiary font-bold tracking-[-0.03em] tabular-nums ${
                balance !== null
                  ? balance >= 0
                    ? "text-income"
                    : "text-expense"
                  : "text-ink"
              }`}
            >
              {balance !== null ? fmt(balance) : "—"}
            </p>
            <p className="mt-2 max-w-md text-base font-medium leading-6 text-secondary">
              {balance !== null
                ? predictions.avgDailySpending !== null
                  ? `On your current pace of ${fmt(predictions.avgDailySpending)} a day, you're on track to end ${formatMonthLabel(month)} with ${fmt(balance)}.`
                  : `If income stays put, you should end ${formatMonthLabel(month)} with ${fmt(balance)}.`
                : "Record income and spending to unlock your forecast."}
            </p>
          </div>
        </div>
        {hasTrend && balance !== null && (
          <div className="w-full shrink-0 lg:w-64" aria-hidden="true">
            <p className="mb-2 text-caption font-medium text-muted">
              Net savings over the last 6 months
            </p>
            <ResponsiveContainer width="100%" height={64}>
              <AreaChart data={netHistory} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.brand} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={colors.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke={colors.brand}
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill={`url(#${gradientId})`}
                  isAnimationActive={!reduced}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
