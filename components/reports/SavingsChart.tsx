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
import { formatMonthLabel, formatMonthShort } from "@/lib/date";
import { financeSeries } from "@/lib/finance";
import { compactMoney, formatMoney } from "@/lib/money";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useChartColors } from "@/hooks/useChartColors";
import { ChartCard } from "./ChartCard";
import { axisTickStyle, tooltipContentStyle } from "./chartStyles";

export function SavingsChart({ months }: { months: Month[] }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);
  const reduced = useReducedMotion();
  const colors = useChartColors();

  const data = useMemo(
    () => financeSeries(transactions, incomePlans, months),
    [transactions, incomePlans, months],
  );
  const hasData = data.some((point) => point.net !== 0);

  if (!hasData) {
    return (
      <ChartCard title="Savings over time" subtitle="Last 6 months">
        <EmptyState
          illustration="chart"
          illustrationClass="bg-income/[0.08] text-income"
          title="No savings to track yet"
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
    <ChartCard title="Savings over time" subtitle="Last 6 months">
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
              formatter={(value) => [
                formatMoney(Number(value), currency),
                "Net savings",
              ]}
              labelFormatter={(label) => formatMonthLabel(String(label))}
              contentStyle={tooltipContentStyle(colors)}
            />
            <ReferenceLine
              y={0}
              stroke={colors.grid}
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <Line
              type="monotone"
              dataKey="net"
              name="Net savings"
              stroke={colors.brand}
              strokeWidth={1.75}
              dot={{ r: 2.5, fill: colors.brand, strokeWidth: 0 }}
              isAnimationActive={!reduced}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
