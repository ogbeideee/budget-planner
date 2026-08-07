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
import { financeSeries } from "@/lib/finance";
import { compactMoney, formatMoney } from "@/lib/money";
import type { Currency, Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useChartColors } from "@/hooks/useChartColors";
import type { ChartColors } from "@/hooks/useChartColors";
import { ChartCard } from "./ChartCard";
import { axisTickStyle, tooltipContentStyle } from "./chartStyles";

interface CashFlowChartProps {
  months: Month[];
}

interface CashFlowPoint {
  month: Month;
  income: number;
  expenses: number;
  expensesTotal: number;
  remaining: number;
  shortfall: number;
}

function CashFlowTooltip({
  active,
  payload,
  label,
  currency,
  colors,
}: {
  active: boolean | undefined;
  payload: Array<{ dataKey: string; value: number }> | undefined;
  label: string;
  currency: Currency;
  colors: ChartColors;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const get = (key: string) =>
    payload.find((entry) => entry.dataKey === key)?.value ?? 0;
  const expenses = get("expenses") + get("shortfall");
  const remaining = get("remaining");
  const shortfall = get("shortfall");
  const income = expenses + remaining - shortfall;
  const rows: Array<{ label: string; value: string; color: string }> = [
    { label: "Money in", value: formatMoney(income, currency), color: colors.income },
    { label: "Expenses", value: formatMoney(expenses, currency), color: colors.expense },
    { label: "Remaining", value: formatMoney(remaining, currency), color: colors.brand },
  ];
  if (shortfall > 0) {
    rows.push({
      label: "Shortfall",
      value: formatMoney(shortfall, currency),
      color: colors.warn,
    });
  }
  return (
    <div
      style={{ ...tooltipContentStyle(colors), padding: "12px 16px", minWidth: 180 }}
    >
      <p className="mb-2 text-xs font-bold text-tooltip-text/70">
        {formatMonthLabel(label)}
      </p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-6 text-xs font-medium text-tooltip-text"
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              {row.label}
            </span>
            <span className="font-bold tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CashFlowChart({ months }: CashFlowChartProps) {
  const transactions = useAppStore((s) => s.state.transactions);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);
  const reduced = useReducedMotion();
  const colors = useChartColors();

  const data = useMemo(
    () =>
      financeSeries(transactions, incomePlans, months).map((point) => {
        const income = point.received;
        const expenses = point.expenses;
        return {
          month: point.month,
          income,
          expenses: Math.min(expenses, income),
          expensesTotal: expenses,
          remaining: Math.max(0, income - expenses),
          shortfall: Math.max(0, expenses - income),
        } satisfies CashFlowPoint;
      }),
    [transactions, incomePlans, months],
  );
  const hasData = data.some((point) => point.income > 0 || point.shortfall > 0);
  const hasShortfall = data.some((point) => point.shortfall > 0);

  if (!hasData) {
    return (
      <ChartCard title="Cash flow" subtitle="Last 6 months">
        <EmptyState
          illustration="chart"
          illustrationClass="bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
          title="No cash flow to chart yet"
          description="Add income and expenses to see how your money flows each month."
        />
      </ChartCard>
    );
  }

  const ariaLabel = `Cash flow: ${data
    .map(
      (point) =>
        `${formatMonthShort(point.month)} income ${formatMoney(point.income, currency)}, expenses ${formatMoney(point.expensesTotal, currency)}, remaining ${formatMoney(point.remaining, currency)}`,
    )
    .join("; ")}`;

  return (
    <ChartCard title="Cash flow" subtitle="Money in, money out and what's left">
      <div className="mb-3 flex items-center gap-5 text-xs font-medium text-muted">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: colors.expense }}
          />
          Expenses
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: colors.brand }}
          />
          Remaining
        </span>
        {hasShortfall && (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colors.warn }}
            />
            Shortfall
          </span>
        )}
      </div>
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            barCategoryGap="24%"
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
              content={
                <CashFlowTooltip
                  currency={currency}
                  colors={colors}
                  active={undefined}
                  payload={undefined}
                  label=""
                />
              }
              cursor={{ fill: "rgb(15 23 42 / 0.03)" }}
            />
            <Bar
              dataKey="expenses"
              name="Expenses"
              stackId="flow"
              fill={colors.expense}
              radius={[0, 0, 0, 0]}
              isAnimationActive={!reduced}
            />
            <Bar
              dataKey="remaining"
              name="Remaining"
              stackId="flow"
              fill={colors.brand}
              radius={[8, 8, 0, 0]}
              isAnimationActive={!reduced}
            />
            <Bar
              dataKey="shortfall"
              name="Shortfall"
              stackId="flow"
              fill={colors.warn}
              radius={[8, 8, 0, 0]}
              isAnimationActive={!reduced}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
