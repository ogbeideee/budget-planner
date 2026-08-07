"use client";

import { useMemo, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import { categoryColor } from "@/lib/accents";
import { formatMonthShort, monthOffset } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { spendingByCategory, totals } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useChartColors } from "@/hooks/useChartColors";
import { ChartCard } from "./ChartCard";
import { tooltipContentStyle } from "./chartStyles";

interface CategoryAnalysisChartProps {
  month: Month;
}

const TOP_COUNT = 6;

export function CategoryAnalysisChart({ month }: CategoryAnalysisChartProps) {
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);
  const reduced = useReducedMotion();
  const colors = useChartColors();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const rows = useMemo(
    () =>
      spendingByCategory(transactions, month)
        .slice(0, TOP_COUNT)
        .map((entry) => ({
          ...entry,
          category: categories.find((c) => c.id === entry.categoryId),
        }))
        .filter((entry) => entry.category !== undefined),
    [transactions, categories, month],
  );

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + row.amount, 0),
    [rows],
  );

  const previousExpenses = useMemo(
    () => totals(transactions, monthOffset(month, -1)).expenses,
    [transactions, month],
  );
  const trend =
    previousExpenses > 0
      ? Math.round(((total - previousExpenses) / previousExpenses) * 100)
      : null;

  if (rows.length === 0) {
    return (
      <ChartCard title="Category analysis" subtitle="This month">
        <EmptyState
          illustration="chart"
          illustrationClass="bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
          title="No spending to analyze yet"
          description="Add expenses and your top categories will be ranked here."
        />
      </ChartCard>
    );
  }

  const data = rows.map((row) => ({
    key: row.categoryId,
    name: row.category!.name,
    value: row.amount,
    color: categoryColor(row.category),
  }));

  const ariaLabel = `Category analysis: ${data
    .map(
      (entry) =>
        `${entry.name} ${formatMoney(entry.value, currency)} (${Math.round((100 * entry.value) / total)}%)`,
    )
    .join("; ")}`;

  return (
    <ChartCard title="Category analysis" subtitle="This month">
      <div
        role="img"
        aria-label={ariaLabel}
        className="grid items-center gap-6 lg:grid-cols-[minmax(0,280px)_1fr]"
      >
        <div className="relative mx-auto w-full max-w-[280px]">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Tooltip
                formatter={(value, name) => [
                  formatMoney(Number(value), currency),
                  name,
                ]}
                contentStyle={tooltipContentStyle(colors)}
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="86%"
                paddingAngle={2}
                cornerRadius={8}
                stroke="none"
                isAnimationActive={!reduced}
                onMouseEnter={(_data, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.key}
                    fill={entry.color}
                    fillOpacity={
                      activeIndex === null || activeIndex === index ? 1 : 0.3
                    }
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-kpi-tertiary font-bold tracking-[-0.03em] tabular-nums text-ink">
              {formatMoney(total, currency)}
            </span>
            <span className="mt-0.5 text-caption font-medium text-muted">
              top categories spent
            </span>
            {trend !== null && (
              <span
                className={`mt-1 text-xs font-bold tabular-nums ${
                  trend <= 0 ? "text-income" : "text-expense"
                }`}
              >
                {trend <= 0 ? "▲" : "▼"} {Math.abs(trend)}% vs{" "}
                {formatMonthShort(monthOffset(month, -1))}
              </span>
            )}
          </div>
        </div>

        <ul className="flex flex-col gap-2.5">
          {rows.map((row, index) => {
            const pct = Math.round((100 * row.amount) / total);
            const highlighted = activeIndex === null || activeIndex === index;
            return (
              <li
                key={row.categoryId}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                className={`flex cursor-default items-center gap-3 rounded-lg px-2.5 py-2 transition-colors duration-150 ease-premium ${
                  highlighted ? "bg-sidebar-hover" : "opacity-60"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base"
                  style={{ backgroundColor: `${row.category!.color}1a` }}
                >
                  {row.category!.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-ink">
                      {row.category!.name}
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
                      {formatMoney(row.amount, currency)}
                    </span>
                  </span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
                      <span
                        className="block h-full rounded-full transition-[width] duration-500 ease-premium"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: row.category!.color,
                        }}
                      />
                    </span>
                    <span className="w-9 shrink-0 text-right text-caption font-medium tabular-nums text-muted">
                      {pct}%
                    </span>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </ChartCard>
  );
}
