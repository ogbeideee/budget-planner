"use client";

import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMonthLabel, formatMonthShort } from "@/lib/date";
import { compactMoney, formatMoney } from "@/lib/money";
import { monthlySeries } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useChartColors } from "@/hooks/useChartColors";
import { ChartCard } from "./ChartCard";
import { axisTickStyle, tooltipContentStyle } from "./chartStyles";

export function SpendingTrendChart({ months }: { months: Month[] }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const currency = useAppStore((s) => s.state.settings.currency);
  const reduced = useReducedMotion();
  const colors = useChartColors();
  const gradientId = useId();

  const data = useMemo(
    () => monthlySeries(transactions, months),
    [transactions, months],
  );
  const hasData = data.some((point) => point.expenses > 0);

  if (!hasData) {
    return (
      <ChartCard title="Monthly spending trend" subtitle="Last 6 months">
        <EmptyState
          illustration="chart"
          illustrationClass="bg-brand-500/10 text-brand-600 dark:text-brand-400"
          title="No spending to chart yet"
          description="Add expenses to see your monthly spending take shape."
        />
      </ChartCard>
    );
  }

  const ariaLabel = `Monthly spending trend: ${data
    .map(
      (point) =>
        `${formatMonthShort(point.month)} ${formatMoney(point.expenses, currency)}`,
    )
    .join("; ")}`;

  return (
    <ChartCard
      title="Monthly spending trend"
      subtitle="Expenses by month"
    >
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.brand} stopOpacity={0.22} />
                <stop offset="100%" stopColor={colors.brand} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={colors.grid}
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthShort}
              tick={axisTickStyle(colors)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(value) => compactMoney(Number(value), currency)}
              tick={axisTickStyle(colors)}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              formatter={(value, name) => [
                formatMoney(Number(value), currency),
                name,
              ]}
              labelFormatter={(label) => formatMonthLabel(String(label))}
              contentStyle={tooltipContentStyle(colors)}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke={colors.brand}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={!reduced}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
