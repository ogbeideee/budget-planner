"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMonthLabel, formatMonthShort } from "@/lib/date";
import { compactMoney, formatMoney } from "@/lib/money";
import { incomeTrendSeries } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useChartColors } from "@/hooks/useChartColors";
import { ChartCard } from "./ChartCard";
import { axisTickStyle, tooltipContentStyle } from "./chartStyles";

export function IncomeTrendChart({ months }: { months: Month[] }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const plans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);
  const reduced = useReducedMotion();
  const colors = useChartColors();

  const data = useMemo(
    () => incomeTrendSeries(transactions, plans, months),
    [transactions, plans, months],
  );
  const hasData = data.some((point) => point.received > 0 || point.expected > 0);

  if (!hasData) {
    return (
      <ChartCard title="Income trend" subtitle="Last 6 months">
        <EmptyState
          illustration="chart"
          illustrationClass="bg-brand-500/10 text-brand-600 dark:text-brand-400"
          title="No income to chart yet"
          description="Add expected income or record income and your six-month trend will take shape here."
        />
      </ChartCard>
    );
  }

  const ariaLabel = `Income trend: ${data
    .map(
      (point) =>
        `${formatMonthShort(point.month)} expected ${formatMoney(point.expected, currency)}, received ${formatMoney(point.received, currency)}`,
    )
    .join("; ")}`;

  return (
    <ChartCard title="Income trend" subtitle="Last 6 months">
      <div className="mb-3 flex items-center gap-5 text-xs font-medium text-muted">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-border"
          />
          Expected
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: colors.income }}
          />
          Received
        </span>
      </div>
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
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
            <Line
              type="monotone"
              dataKey="expected"
              name="Expected"
              stroke={colors.grid}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={!reduced}
            />
            <Line
              type="monotone"
              dataKey="received"
              name="Received"
              stroke={colors.income}
              strokeWidth={2}
              dot={{ r: 3, fill: colors.income }}
              isAnimationActive={!reduced}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
