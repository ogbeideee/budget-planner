"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMonthLabel, formatMonthShort } from "@/lib/date";
import { financeSeries } from "@/lib/finance";
import { compactMoney, formatMoney } from "@/lib/money";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useChartColors } from "@/hooks/useChartColors";
import { ChartCard } from "./ChartCard";
import { axisTickStyle, tooltipContentStyle } from "./chartStyles";

export function IncomeExpenseChart({ months }: { months: Month[] }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);
  const reduced = useReducedMotion();
  const colors = useChartColors();

  const data = useMemo(
    () => financeSeries(transactions, incomePlans, months),
    [transactions, incomePlans, months],
  );
  const hasData = data.some((point) => point.received > 0 || point.expenses > 0);

  if (!hasData) {
    return (
      <ChartCard title="Income vs expenses" subtitle="Last 6 months">
        <EmptyState
          illustration="chart"
          illustrationClass="bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
          title="Nothing to compare yet"
          description="Add income or expenses and this chart will compare them by month."
        />
      </ChartCard>
    );
  }

  const ariaLabel = `Income vs expenses: ${data
    .map(
      (point) =>
        `${formatMonthShort(point.month)} income ${formatMoney(point.received, currency)}, expenses ${formatMoney(point.expenses, currency)}`,
    )
    .join("; ")}`;

  return (
    <ChartCard title="Income vs expenses" subtitle="Income and expenses, per month">
      <div className="mb-3 flex items-center gap-5 text-xs font-medium text-muted">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: colors.income }}
          />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: colors.expense }}
          />
          Expenses
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: colors.brand }}
          />
          Net
        </span>
      </div>
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            barGap={3}
            barCategoryGap="22%"
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
              domain={["auto", "auto"]}
            />
            <Tooltip
              formatter={(value, name) => [
                formatMoney(Number(value), currency),
                name,
              ]}
              labelFormatter={(label) => formatMonthLabel(String(label))}
              contentStyle={tooltipContentStyle(colors)}
            />
            <Bar
              dataKey="received"
              name="Income"
              fill={colors.income}
              radius={[6, 6, 0, 0]}
              isAnimationActive={!reduced}
            />
            <Bar
              dataKey="expenses"
              name="Expenses"
              fill={colors.expense}
              radius={[6, 6, 0, 0]}
              isAnimationActive={!reduced}
            />
            <Line
              type="monotone"
              dataKey="net"
              name="Net"
              stroke={colors.brand}
              strokeWidth={2.25}
              strokeLinecap="round"
              dot={{ r: 3, fill: colors.brand, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={!reduced}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
