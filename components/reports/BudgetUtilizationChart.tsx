"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMonthLabel, formatMonthShort } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { budgetUtilizationSeries } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useChartColors } from "@/hooks/useChartColors";
import { ChartCard } from "./ChartCard";
import { axisTickStyle, tooltipContentStyle } from "./chartStyles";

export function BudgetUtilizationChart({ months }: { months: Month[] }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);
  const currency = useAppStore((s) => s.state.settings.currency);
  const reduced = useReducedMotion();
  const colors = useChartColors();

  const data = useMemo(
    () =>
      budgetUtilizationSeries(budgets, transactions, months).map((point) => ({
        ...point,
        barPct: Math.min(100, point.pct),
      })),
    [budgets, transactions, months],
  );

  if (data.length === 0) {
    return (
      <ChartCard title="Budget utilization" subtitle="Last 6 months">
        <EmptyState
          illustration="target"
          illustrationClass="bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
          title="No budgets in this window"
          description="Set budgets on the Planner and you'll see how each one holds up."
        />
      </ChartCard>
    );
  }

  const ariaLabel = `Budget utilization: ${data
    .map(
      (point) =>
        `${formatMonthShort(point.month)} ${point.pct}% spent ${formatMoney(point.spentTotal, currency)} of limit ${formatMoney(point.limit, currency)}`,
    )
    .join("; ")}`;

  return (
    <ChartCard title="Budget utilization" subtitle="Last 6 months">
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
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
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
              tick={axisTickStyle(colors)}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              formatter={(_value, _name, item) => [
                `${((item as { payload?: { pct?: number } })?.payload?.pct ?? 0)}%`,
                "Utilization",
              ]}
              labelFormatter={(label) => formatMonthLabel(String(label))}
              contentStyle={tooltipContentStyle(colors)}
            />
            <Bar
              dataKey="barPct"
              name="Utilization"
              fill={colors.brand}
              radius={[4, 4, 0, 0]}
              isAnimationActive={!reduced}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
