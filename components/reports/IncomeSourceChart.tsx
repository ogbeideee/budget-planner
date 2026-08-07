"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

export function IncomeSourceChart({ month }: { month: Month }) {
  const plans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);
  const reduced = useReducedMotion();
  const colors = useChartColors();

  const data = useMemo(() => {
    const rows = incomeBreakdownForMonth(plans, month);
    const received = rows
      .filter((row) => row.received > 0)
      .sort((a, b) => b.received - a.received)
      .slice(0, 6)
      .map((row) => ({
        key: row.plan.id,
        label: `${
          isVectorIcon(row.plan.icon) ? "" : row.plan.icon
        } ${row.plan.name}`.trim().slice(0, 26),
        amount: row.received,
      }));
    return received;
  }, [plans, month]);

  if (data.length === 0) {
    return (
      <ChartCard title="Income sources" subtitle="This month">
        <EmptyState
          illustration="chart"
          illustrationClass="bg-income/[0.08] text-income"
          title="No income received yet"
          description="Plan your income sources on the planner and they'll be ranked here by amount received."
        />
      </ChartCard>
    );
  }

  const ariaLabel = `Income sources: ${data
    .map((entry) => `${entry.label} ${formatMoney(entry.amount, currency)}`)
    .join("; ")}`;

  return (
    <ChartCard title="Income sources" subtitle="This month">
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            barCategoryGap={10}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={colors.grid}
              horizontal={false}
            />
            <XAxis
              type="number"
              tickFormatter={(value) => compactMoney(Number(value), currency)}
              tick={axisTickStyle(colors)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fill: colors.ink, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={130}
            />
            <Tooltip
              formatter={(value) => [
                formatMoney(Number(value), currency),
                undefined,
              ]}
              contentStyle={tooltipContentStyle(colors)}
            />
            <Bar
              dataKey="amount"
              name="Received"
              radius={[0, 4, 4, 0]}
              fill={colors.income}
              isAnimationActive={!reduced}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.key}
                  fill={colors.income}
                  fillOpacity={1 - 0.4 * (index / Math.max(1, data.length - 1))}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
