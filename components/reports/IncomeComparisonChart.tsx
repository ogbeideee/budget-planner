"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import { isVectorIcon } from "@/components/settings/iconLibrary";
import { formatMonthLabel, formatMonthShort } from "@/lib/date";
import { compactMoney, formatMoney } from "@/lib/money";
import { incomeBreakdownForMonth, incomeTrendSeries } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useChartColors } from "@/hooks/useChartColors";
import { ChartCard } from "./ChartCard";
import { axisTickStyle, tooltipContentStyle } from "./chartStyles";

type View = "source" | "time";

const VIEWS: ReadonlyArray<{ value: View; label: string; subtitle: string }> = [
  { value: "source", label: "By source", subtitle: "This month, by source" },
  { value: "time", label: "Over time", subtitle: "Last 6 months" },
];

const CHART_HEIGHT = 240;

/**
 * One card, two angles on the SAME comparison — planned income vs what actually
 * landed. "By source" breaks the selected month out per income source;
 * "Over time" plots the month totals across the window. These used to be two
 * separate cards ("Expected vs actual" and "Income trend") saying the same
 * thing twice.
 *
 * "By source" is the default: the page opens on the current month, and a
 * six-month trend built from one month of data is a flat line for five of them.
 */
export function IncomeComparisonChart({
  month,
  months,
}: {
  month: Month;
  months: Month[];
}) {
  const transactions = useAppStore((s) => s.state.transactions);
  const plans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);
  const reduced = useReducedMotion();
  const colors = useChartColors();
  const [view, setView] = useState<View>("source");

  const rows = useMemo(
    () =>
      incomeBreakdownForMonth(plans, month)
        .slice(0, 6)
        .map((row) => ({
          key: row.plan.id,
          label:
            `${isVectorIcon(row.plan.icon) ? "" : row.plan.icon} ${row.plan.name}`
              .trim()
              .slice(0, 18),
          expected: row.expected,
          received: row.received,
        })),
    [plans, month],
  );

  const series = useMemo(
    () => incomeTrendSeries(transactions, plans, months),
    [transactions, plans, months],
  );

  const active = VIEWS.find((entry) => entry.value === view)!;
  const hasData =
    view === "source"
      ? rows.some((row) => row.expected > 0 || row.received > 0)
      : series.some((point) => point.received > 0 || point.expected > 0);

  const ariaLabel =
    view === "source"
      ? `Income expected vs received by source: ${rows
          .map(
            (row) =>
              `${row.label} expected ${formatMoney(row.expected, currency)}, received ${formatMoney(row.received, currency)}`,
          )
          .join("; ")}`
      : `Income expected vs received over time: ${series
          .map(
            (point) =>
              `${formatMonthShort(point.month)} expected ${formatMoney(point.expected, currency)}, received ${formatMoney(point.received, currency)}`,
          )
          .join("; ")}`;

  // Same control pattern as the Settings section nav: pill buttons with
  // aria-pressed and a brand tint on the active one.
  const toggle = (
    <div
      role="group"
      aria-label="Income comparison view"
      className="flex items-center gap-1"
    >
      {VIEWS.map((entry) => (
        <button
          key={entry.value}
          type="button"
          aria-pressed={view === entry.value}
          onClick={() => setView(entry.value)}
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors duration-150 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none ${
            view === entry.value
              ? "bg-brand-500/[0.08] text-brand-600 dark:text-brand-300"
              : "text-muted hover:bg-canvas hover:text-ink"
          }`}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );

  return (
    <ChartCard
      title="Income: expected vs received"
      subtitle={active.subtitle}
      action={toggle}
    >
      {!hasData ? (
        <EmptyState
          illustration="chart"
          illustrationClass="bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
          title={
            view === "source"
              ? "No income planned or received"
              : "No income to chart yet"
          }
          description={
            view === "source"
              ? "Plan your income sources on the planner to compare expected vs received here."
              : "Add expected income or record income and your six-month trend will take shape here."
          }
        />
      ) : (
        <>
          {/* One legend for both views — same keys, same colours, so switching
              never reads as a different component. */}
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
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              {view === "source" ? (
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
                    tickFormatter={(value) =>
                      compactMoney(Number(value), currency)
                    }
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
              ) : (
                <LineChart
                  data={series}
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
                    tickFormatter={(value) =>
                      compactMoney(Number(value), currency)
                    }
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
                    labelFormatter={(label) => formatMonthLabel(String(label))}
                    contentStyle={tooltipContentStyle(colors)}
                  />
                  <Line
                    type="monotone"
                    dataKey="expected"
                    name="Expected"
                    stroke={colors.grid}
                    strokeWidth={1.75}
                    strokeDasharray="5 4"
                    dot={false}
                    isAnimationActive={!reduced}
                  />
                  <Line
                    type="monotone"
                    dataKey="received"
                    name="Received"
                    stroke={colors.income}
                    strokeWidth={1.75}
                    dot={{ r: 2.5, fill: colors.income, strokeWidth: 0 }}
                    isAnimationActive={!reduced}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </>
      )}
    </ChartCard>
  );
}
