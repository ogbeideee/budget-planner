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
import { isVectorIcon } from "@/components/settings/iconLibrary";
import { compactMoney, formatMoney } from "@/lib/money";
import { incomeBreakdownForMonth } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useChartColors } from "@/hooks/useChartColors";
import { ChartCard } from "./ChartCard";
import { axisTickStyle, tooltipContentStyle } from "./chartStyles";

export function ExpectedVsActualChart({ month }: { month: Month }) {
  const plans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);
  const reduced = useReducedMotion();
  const colors = useChartColors();

  const rows = useMemo(
    () =>
      incomeBreakdownForMonth(plans, month)
        .slice(0, 6)
        .map((row) => ({
          key: row.plan.id,
          label:
            `${isVectorIcon(row.plan.icon) ? "" : row.plan.icon} ${row.plan.name}`.trim().slice(0, 18),
          expected: row.expected,
          received: row.received,
        })),
    [plans, month],
  );

  const hasData = rows.some((row) => row.expected > 0 || row.received > 0);

  if (!hasData) {
    return (
      <ChartCard
        title="Expected vs actual"
        subtitle="This month"
      >
        <EmptyState
          illustration="chart"
          illustrationClass="bg-income/[0.08] text-income"
          title="No income planned or received"
          description="Plan your income sources on the planner to compare expected vs received here."
        />
      </ChartCard>
    );
  }

  const ariaLabel = `Expected vs actual income: ${rows
    .map(
      (row) =>
        `${row.label} expected ${formatMoney(row.expected, currency)}, received ${formatMoney(row.received, currency)}`,
    )
    .join("; ")}`;

  return (
    <ChartCard
      title="Expected vs actual"
      subtitle="Planned vs received income, by source"
    >
      <div className="mb-3 flex items-center gap-5 text-xs font-medium text-muted">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-border"
          />
          Expected
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: colors.income }}
          />
          Received
        </span>
      </div>
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={rows}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            barGap={2}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={colors.grid}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: colors.tick, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              interval={0}
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
              contentStyle={tooltipContentStyle(colors)}
            />
            <Bar
              dataKey="expected"
              name="Expected"
              fill={colors.grid}
              radius={[4, 4, 0, 0]}
              isAnimationActive={!reduced}
            />
            <Bar
              dataKey="received"
              name="Received"
              fill={colors.income}
              radius={[4, 4, 0, 0]}
              isAnimationActive={!reduced}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
