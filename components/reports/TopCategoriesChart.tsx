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
import { categoryColor } from "@/lib/accents";
import { compactMoney, formatMoney } from "@/lib/money";
import { spendingByCategoryInMonths } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useChartColors } from "@/hooks/useChartColors";
import { ChartCard } from "./ChartCard";
import { axisTickStyle, tooltipContentStyle } from "./chartStyles";

const TOP_COUNT = 5;

export function TopCategoriesChart({ months }: { months: Month[] }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);
  const reduced = useReducedMotion();
  const colors = useChartColors();

  const data = useMemo(() => {
    const spends = spendingByCategoryInMonths(transactions, months);
    const total = spends.reduce((sum, spend) => sum + spend.amount, 0);
    return spends.slice(0, TOP_COUNT).map((spend) => {
      const category = categories.find((c) => c.id === spend.categoryId);
      const pct = total > 0 ? Math.round((100 * spend.amount) / total) : 0;
      const rawLabel = `${category?.icon ?? ""} ${category?.name ?? "Category"}`;
      return {
        categoryId: spend.categoryId,
        label:
          rawLabel.length > 26 ? `${rawLabel.slice(0, 25)}…` : rawLabel,
        amount: spend.amount,
        pct,
        color: categoryColor(category),
      };
    });
  }, [transactions, categories, months]);

  if (data.length === 0) {
    return (
      <ChartCard title="Top categories" subtitle="Last 6 months">
        <EmptyState
          illustration="chart"
          illustrationClass="bg-brand-500/10 text-brand-600 dark:text-brand-400"
          title="No spending in this window"
          description="Add expenses and your biggest categories will surface here."
        />
      </ChartCard>
    );
  }

  const ariaLabel = `Top categories: ${data
    .map(
      (entry) =>
        `${entry.label} ${formatMoney(entry.amount, currency)} (${entry.pct}%)`,
    )
    .join("; ")}`;

  return (
    <ChartCard title="Top categories" subtitle="Last 6 months">
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 48)}>
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
              tick={{ fill: colors.ink, fontSize: 12.5 }}
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
              name="Spent"
              radius={[0, 6, 6, 0]}
              isAnimationActive={!reduced}
            >
              {data.map((entry) => (
                <Cell key={entry.categoryId} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
