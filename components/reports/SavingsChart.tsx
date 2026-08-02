"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
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
    () =>
      monthlySeries(transactions, months).map((point) => ({
        ...point,
        remaining: Math.max(0, point.net),
      })),
    [transactions, months],
  );
  const hasData = data.some((point) => point.net !== 0);

  if (!hasData) {
    return (
      <ChartCard title="Savings & remaining" subtitle="Per month">
        <EmptyState
          title="No data for this window"
          description="Add income or expenses to see savings over time."
        />
      </ChartCard>
    );
  }

  const ariaLabel = `Savings and remaining balance: ${data
    .map(
      (point) =>
        `${formatMonthShort(point.month)} savings ${formatMoney(point.net, currency)}, remaining ${formatMoney(point.remaining, currency)}`,
    )
    .join("; ")}`;

  return (
    <ChartCard title="Savings & remaining" subtitle="Per month">
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
              width={64}
            />
            <Tooltip
              formatter={(value) => [
                formatMoney(Number(value), currency),
                undefined,
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
            <ReferenceLine
              y={0}
              stroke={colors.grid}
              strokeDasharray="3 3"
            />
            <Line
              type="monotone"
              dataKey="net"
              name="Savings"
              stroke={colors.ink}
              strokeWidth={2}
              dot={{ r: 3, fill: colors.ink }}
              isAnimationActive={!reduced}
            />
            <Line
              type="monotone"
              dataKey="remaining"
              name="Remaining"
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
