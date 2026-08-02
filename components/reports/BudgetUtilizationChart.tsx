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
        pct: Math.round((100 * point.spentTotal) / point.limit),
      })),
    [budgets, transactions, months],
  );

  if (data.length === 0) {
    return (
      <ChartCard title="Budget utilization" subtitle="Spent vs. limits">
        <EmptyState
          title="No budgets in this window"
          description="Create budgets on the Planner to see utilization."
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
    <ChartCard title="Budget utilization" subtitle="Spent vs. limits">
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={260}>
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
              tick={{ fill: colors.tick, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
              tick={{ fill: colors.tick, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              formatter={(value) => [`${value}%`, "Utilization"]}
              labelFormatter={(label) => formatMonthLabel(String(label))}
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                fontSize: 13,
                color: colors.ink,
              }}
            />
            <Bar
              dataKey="pct"
              name="Utilization"
              fill={colors.brand}
              radius={[3, 3, 0, 0]}
              isAnimationActive={!reduced}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
