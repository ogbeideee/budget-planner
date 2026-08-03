"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrendingUpIcon } from "@/components/ui/icons";
import { formatMonthLabel, formatMonthShort } from "@/lib/date";
import { compactMoney, formatMoney } from "@/lib/money";
import { monthlySeries } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useChartColors } from "@/hooks/useChartColors";
import { ChartCard } from "./ChartCard";

export function SavingsChart({ months }: { months: Month[] }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const currency = useAppStore((s) => s.state.settings.currency);
  const reduced = useReducedMotion();
  const colors = useChartColors();

  const data = useMemo(
    () => monthlySeries(transactions, months),
    [transactions, months],
  );
  const hasData = data.some((point) => point.net !== 0);

  if (!hasData) {
    return (
      <ChartCard title="Savings over time" subtitle="Per month">
<EmptyState
        icon={<TrendingUpIcon className="h-5 w-5" />}
        iconClass="bg-income/10 text-income"
        title="No data for this window"
        description="Add income or expenses to start tracking your savings trend."
      />
      </ChartCard>
    );
  }

  const ariaLabel = `Net savings per month: ${data
    .map(
      (point) =>
        `${formatMonthShort(point.month)} ${formatMoney(point.net, currency)}`,
    )
    .join("; ")}`;

  return (
    <ChartCard title="Savings over time" subtitle="Per month">
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={260}>
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
              formatter={(value) => [
                formatMoney(Number(value), currency),
                "Net savings",
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
            <ReferenceLine
              y={0}
              stroke={colors.grid}
              strokeDasharray="3 3"
            />
            <Line
              type="monotone"
              dataKey="net"
              name="Net savings"
              stroke={colors.brand}
              strokeWidth={2}
              dot={{ r: 3, fill: colors.brand }}
              isAnimationActive={!reduced}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
