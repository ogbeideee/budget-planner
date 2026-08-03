"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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

export function IncomeExpenseChart({ months }: { months: Month[] }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const currency = useAppStore((s) => s.state.settings.currency);
  const reduced = useReducedMotion();
  const colors = useChartColors();

  const data = useMemo(
    () => monthlySeries(transactions, months),
    [transactions, months],
  );
  const hasData = data.some((point) => point.income > 0 || point.expenses > 0);

  if (!hasData) {
    return (
      <ChartCard title="Income vs expenses" subtitle="Per month">
        <EmptyState
          title="No data for this window"
          description="Add income or expenses to see the comparison."
        />
      </ChartCard>
    );
  }

  const ariaLabel = `Income vs expenses: ${data
    .map(
      (point) =>
        `${formatMonthShort(point.month)} income ${formatMoney(point.income, currency)}, expenses ${formatMoney(point.expenses, currency)}`,
    )
    .join("; ")}`;

  return (
    <ChartCard title="Income vs expenses" subtitle="Per month">
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            barGap={2}
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
              tickFormatter={(value) => compactMoney(Number(value), currency)}
              tick={{ fill: colors.tick, fontSize: 12 }}
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
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                fontSize: 13,
                color: colors.ink,
              }}
            />
            <Legend wrapperStyle={{ color: colors.ink }} />
            <Bar
              dataKey="income"
              name="Income"
              fill={colors.income}
              radius={[3, 3, 0, 0]}
              isAnimationActive={!reduced}
            />
            <Bar
              dataKey="expenses"
              name="Expenses"
              fill={colors.expense}
              radius={[3, 3, 0, 0]}
              isAnimationActive={!reduced}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
