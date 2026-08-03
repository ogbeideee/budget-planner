"use client";

import { useMemo } from "react";
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
import { ChartIcon } from "@/components/ui/icons";
import { formatMonthLabel, formatMonthShort } from "@/lib/date";
import { compactMoney, formatMoney } from "@/lib/money";
import { monthlySeries } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useChartColors } from "@/hooks/useChartColors";
import { ChartCard } from "./ChartCard";

export function SpendingTrendChart({ months }: { months: Month[] }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const currency = useAppStore((s) => s.state.settings.currency);
  const reduced = useReducedMotion();
  const colors = useChartColors();

  const data = useMemo(
    () => monthlySeries(transactions, months),
    [transactions, months],
  );
  const hasData = data.some((point) => point.expenses > 0);

  if (!hasData) {
    return (
      <ChartCard title="Monthly spending trend" subtitle="Total expenses per month">
<EmptyState
        icon={<ChartIcon className="h-5 w-5" />}
        iconClass="bg-brand-500/10 text-brand-600 dark:text-brand-400"
        title="No data for this window"
        description="Add expenses to see your monthly spending trend take shape."
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
      subtitle="Total expenses per month"
    >
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart
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
            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke={colors.brand}
              strokeWidth={2}
              fill={colors.brand}
              fillOpacity={0.12}
              isAnimationActive={!reduced}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
