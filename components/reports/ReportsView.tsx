"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ExpenseBreakdown } from "@/components/planner/ExpenseBreakdown";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  AlertTriangleIcon,
  DownloadIcon,
  FileTextIcon,
  PrintIcon,
  TrendDownIcon,
  TrendingUpIcon,
} from "@/components/ui/icons";
import { useToast } from "@/hooks/useToast";
import { useMonth } from "@/hooks/useMonth";
import {
  currentMonthKey,
  daysInMonth,
  formatMonthLabel,
  formatMonthShort,
  monthKeyFromIso,
  monthOffset,
  parseMonth,
} from "@/lib/date";
import { formatMoney, MINOR_UNITS_PER_UNIT } from "@/lib/money";
import { monthFinance } from "@/lib/finance";
import { monthStats } from "@/lib/monthStats";
import { monthlyPredictions } from "@/lib/predictions";
import { monthsWithTransactions, reportTrends } from "@/lib/reportTrends";
import {
  spendingByCategory,
  totals,
  windowMonths,
} from "@/lib/selectors";
import type { Budget, Category, Currency, Month, Transaction } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { ChartCard } from "./ChartCard";
import { ExpectedVsActualChart } from "./ExpectedVsActualChart";
import { IncomeSourceChart } from "./IncomeSourceChart";
import { IncomeTrendChart } from "./IncomeTrendChart";
import { ReportsInsights } from "./ReportsInsights";

const IncomeExpenseChart = dynamic(
  () => import("./IncomeExpenseChart").then((m) => m.IncomeExpenseChart),
  { ssr: false, loading: () => <ChartSkeleton height={300} /> },
);

const SpendingTrendChart = dynamic(
  () => import("./SpendingTrendChart").then((m) => m.SpendingTrendChart),
  { ssr: false, loading: () => <ChartSkeleton height={240} /> },
);

const SavingsChart = dynamic(
  () => import("./SavingsChart").then((m) => m.SavingsChart),
  { ssr: false, loading: () => <ChartSkeleton height={240} /> },
);

const BudgetUtilizationChart = dynamic(
  () => import("./BudgetUtilizationChart").then((m) => m.BudgetUtilizationChart),
  { ssr: false, loading: () => <ChartSkeleton height={240} /> },
);

const TopCategoriesChart = dynamic(
  () => import("./TopCategoriesChart").then((m) => m.TopCategoriesChart),
  { ssr: false, loading: () => <ChartSkeleton height={240} /> },
);

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse rounded-xl bg-surface shadow-card print-block"
      style={{ height }}
    />
  );
}

function exportCsv(rows: string[][], filename: string) {
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface SnapshotTileProps {
  label: string;
  value: string;
  caption: string;
  tone?: "income" | "expense" | "warn" | "neutral";
  wide?: boolean;
}

function SnapshotTile({ label, value, caption, tone = "neutral", wide }: SnapshotTileProps) {
  const toneClass =
    tone === "income"
      ? "text-income"
      : tone === "expense"
        ? "text-expense"
        : tone === "warn"
          ? "text-warn"
          : "text-ink";
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-xl border border-border/50 bg-surface p-5 shadow-card print-block ${
        wide ? "sm:col-span-2" : ""
      }`}
    >
      <span className="text-sm font-semibold text-muted">{label}</span>
      <span className={`text-2xl font-bold tracking-tight tabular-nums ${toneClass}`}>
        {value}
      </span>
      <span className="text-xs font-medium leading-tight text-muted/80">
        {caption}
      </span>
    </div>
  );
}

function TrendInsights({
  trends,
  budgets,
  categories,
  transactions,
  month,
  currency,
}: {
  trends: ReturnType<typeof reportTrends>;
  budgets: Budget[];
  categories: Category[];
  transactions: Transaction[];
  month: Month;
  currency: Currency;
}) {
  const fmt = (value: number) => formatMoney(value, currency);
  const rows: Array<{
    icon: ReactNode;
    iconClass: string;
    text: string;
  }> = [];

  if (trends.largestIncrease) {
    rows.push({
      icon: <AlertTriangleIcon className="h-4 w-4" />,
      iconClass: "bg-warn/10 text-warn",
      text: `Spending rose ${fmt(trends.largestIncrease.delta)} from ${formatMonthShort(trends.largestIncrease.fromMonth)} to ${formatMonthShort(trends.largestIncrease.toMonth)}.`,
    });
  }
  if (trends.largestDecrease) {
    rows.push({
      icon: <TrendingUpIcon className="h-4 w-4" />,
      iconClass: "bg-income/10 text-income",
      text: `Spending fell ${fmt(Math.abs(trends.largestDecrease.delta))} from ${formatMonthShort(trends.largestDecrease.fromMonth)} to ${formatMonthShort(trends.largestDecrease.toMonth)}.`,
    });
  }
  if (trends.savingsDelta && trends.savingsDelta.delta !== 0) {
    const improved = trends.savingsDelta.delta > 0;
    rows.push({
      icon: improved ? (
        <TrendingUpIcon className="h-4 w-4" />
      ) : (
        <TrendDownIcon className="h-4 w-4" />
      ),
      iconClass: improved ? "bg-income/10 text-income" : "bg-expense/10 text-expense",
      text: `Savings ${improved ? "improved" : "fell"} by ${fmt(Math.abs(trends.savingsDelta.delta))} this month.`,
    });
  }
  if (trends.highestCategory) {
    rows.push({
      icon: <TrendDownIcon className="h-4 w-4" />,
      iconClass: "bg-expense/10 text-expense",
      text: `${trends.highestCategory.category.icon} ${trends.highestCategory.category.name} is your biggest cost this month at ${fmt(trends.highestCategory.amount)}.`,
    });
  }

  const spent = new Map(
    spendingByCategory(transactions, month).map((entry) => [
      entry.categoryId,
      entry.amount,
    ]),
  );
  const overBudget = budgets
    .filter((budget) => budget.month === month)
    .map((budget) => ({
      budget,
      spent: spent.get(budget.categoryId) ?? 0,
    }))
    .filter(({ budget, spent }) => spent > budget.limit)
    .slice(0, 3);
  for (const { budget, spent } of overBudget) {
    const category = categories.find((c) => c.id === budget.categoryId);
    rows.push({
      icon: <AlertTriangleIcon className="h-4 w-4" />,
      iconClass: "bg-warn/10 text-warn",
      text: `"${category?.name ?? "Budget"}" is over budget by ${fmt(spent - budget.limit)}.`,
    });
  }

  if (rows.length === 0) {
    return (
      <Card variant="quiet" className="print-block">
        <SectionHeading>Trends</SectionHeading>
        <EmptyState
          illustration="chart"
          illustrationClass="bg-brand-500/10 text-brand-600 dark:text-brand-400"
          title="Nothing to report yet"
          description="Add a few months of data and this is where your money story appears."
        />
      </Card>
    );
  }

  return (
    <Card variant="quiet" className="print-block">
      <SectionHeading>Trends</SectionHeading>
      <ul className="flex flex-col divide-y divide-border/50">
        {rows.map((row, index) => (
          <li key={index} className="flex items-start gap-3 py-3">
            <span
              aria-hidden="true"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${row.iconClass}`}
            >
              {row.icon}
            </span>
            <span className="text-sm leading-relaxed text-ink">{row.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ReportsView() {
  const { month, setMonth } = useMonth();
  const monthParts = parseMonth(month);
  const months = useMemo(() => windowMonths(month), [month]);
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);
  const categories = useAppStore((s) => s.state.categories);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const currency = useAppStore((s) => s.state.settings.currency);
  const { success } = useToast();

  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setExportOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExportOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const fmt = (value: number) => formatMoney(value, currency);
  const { received, expected, expenses, net } = useMemo(
    () => monthFinance(transactions, incomePlans, month),
    [transactions, incomePlans, month],
  );
  const stats = useMemo(
    () =>
      monthStats({
        month,
        transactions,
        budgets,
        categories,
        futureExpenses,
        incomePlans,
      }),
    [month, transactions, budgets, categories, futureExpenses, incomePlans],
  );
  const predictions = useMemo(
    () => monthlyPredictions(transactions, month, incomePlans),
    [transactions, month, incomePlans],
  );
  const trends = useMemo(
    () => reportTrends({ transactions, categories, incomePlans, months }),
    [transactions, categories, incomePlans, months],
  );
  const historyDepth = useMemo(
    () => monthsWithTransactions(transactions, months),
    [transactions, months],
  );
  const expensesDelta = useMemo(() => {
    const current = totals(transactions, month).expenses;
    const previous = totals(transactions, monthOffset(month, -1)).expenses;
    return { current, previous, delta: current - previous };
  }, [transactions, month]);
  const hasExpenseComparison = expensesDelta.current > 0 || expensesDelta.previous > 0;
  const isCurrentMonth = month === currentMonthKey();
  const expectedDifference = expected - received;
  const savingsRate = stats.savingsRate;

  const handleCsvExport = () => {
    setExportOpen(false);
    const rows: string[][] = [
      ["Date", "Category", "Type", "Amount", "Currency", "Note"],
    ];
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    for (const transaction of transactions) {
      if (!months.includes(monthKeyFromIso(transaction.date))) continue;
      const category = categoryById.get(transaction.categoryId);
      rows.push([
        transaction.date,
        category?.name ?? "Uncategorized",
        transaction.type,
        (transaction.amount / MINOR_UNITS_PER_UNIT).toFixed(2),
        currency,
        transaction.note ?? "",
      ]);
    }
    exportCsv(rows, `budget-report-${month}.csv`);
    success("CSV downloaded.");
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Reports"
          description={`Six months of history, ending ${formatMonthLabel(month)}`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker value={month} onChange={setMonth} />
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              onClick={() => setExportOpen((open) => !open)}
              className="no-print flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3.5 text-sm font-semibold text-ink transition-colors hover:border-border/80 hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand-500/60 focus:outline-none"
            >
              <DownloadIcon className="h-4 w-4" />
              Export
            </button>
            {exportOpen && (
              <div
                role="menu"
                aria-label="Export options"
                ref={exportMenuRef}
                className="absolute right-0 top-full z-20 mt-1.5 w-48 animate-[menu-in_150ms_var(--ease-premium)] overflow-hidden rounded-lg border border-border/70 bg-surface p-1 shadow-pop"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setExportOpen(false);
                    success("Use 'Save as PDF' in the print dialog.");
                    window.print();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none"
                >
                  <DownloadIcon className="h-3.5 w-3.5 text-muted" />
                  PDF export
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleCsvExport}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none"
                >
                  <FileTextIcon className="h-3.5 w-3.5 text-muted" />
                  CSV export
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setExportOpen(false);
                    window.print();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none"
                >
                  <PrintIcon className="h-3.5 w-3.5 text-muted" />
                  Print
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <section
        aria-labelledby="reports-snapshot-heading"
        className="flex flex-col gap-6"
      >
        <SectionHeading>Financial snapshot</SectionHeading>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <SnapshotTile
            wide
            label="Net"
            value={fmt(net)}
            tone={net >= 0 ? "income" : "expense"}
            caption={
              savingsRate !== null
                ? `${savingsRate}% of income kept this month`
                : "Record income and expenses to see your savings rate"
            }
          />
          <SnapshotTile
            label="Income"
            value={fmt(received)}
            tone="income"
            caption={
              expected > 0
                ? `${fmt(expected)} expected · ${expectedDifference >= 0 ? "+" : "−"}${fmt(Math.abs(expectedDifference))} ${expectedDifference >= 0 ? "to collect" : "over received"}`
                : "Set expected income on the planner"
            }
          />
          <SnapshotTile
            label="Expenses"
            value={fmt(expenses)}
            tone="expense"
            caption={
              hasExpenseComparison
                ? `${expensesDelta.delta >= 0 ? "+" : "−"}${fmt(Math.abs(expensesDelta.delta))} vs last month`
                : "No prior month to compare yet"
            }
          />
          <SnapshotTile
            label="Savings"
            value={savingsRate !== null ? `${savingsRate}%` : "—"}
            tone={savingsRate !== null && savingsRate >= 0 ? "income" : "neutral"}
            caption={net >= 0 ? `${fmt(net)} kept this month` : "Spending more than you earn"}
          />
        </div>
      </section>

      <section
        aria-labelledby="reports-income-heading"
        className="flex flex-col gap-6"
      >
        <SectionHeading>Income</SectionHeading>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ExpectedVsActualChart month={month} />
          <IncomeSourceChart month={month} />
        </div>
        <IncomeTrendChart months={months} />
      </section>

      <section
        aria-labelledby="reports-spending-heading"
        className="flex flex-col gap-6"
      >
        <SectionHeading>Spending &amp; savings</SectionHeading>
        <IncomeExpenseChart months={months} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SpendingTrendChart months={months} />
          <SavingsChart months={months} />
        </div>
        <TopCategoriesChart months={months} />
      </section>

      <section
        aria-labelledby="reports-budget-heading"
        className="flex flex-col gap-6"
      >
        <SectionHeading>Budget health</SectionHeading>
        <BudgetUtilizationChart months={months} />
      </section>

      <section
        aria-labelledby="reports-insights-heading"
        className="flex flex-col gap-6"
      >
        <SectionHeading>Insights</SectionHeading>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ReportsInsights month={month} />
          <TrendInsights
            trends={trends}
            budgets={budgets}
            categories={categories}
            transactions={transactions}
            month={month}
            currency={currency}
          />
        </div>
      </section>

      <section
        aria-labelledby="reports-predictions-heading"
        className="flex flex-col gap-6"
      >
        <SectionHeading>Predictions</SectionHeading>
        {isCurrentMonth ? (
          <Card variant="quiet" className="print-block">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Day {predictions.daysElapsed} of{" "}
                  {daysInMonth(monthParts.year, monthParts.monthIndex)}
                </span>
                <span className="text-lg font-bold tracking-tight text-ink">
                  {predictions.avgDailySpending !== null
                    ? fmt(predictions.avgDailySpending)
                    : "—"}
                </span>
                <span className="text-xs font-medium text-muted/80">
                  average spent per day so far
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Projected month-end spending
                </span>
                <span
                  className={`text-lg font-bold tracking-tight tabular-nums ${
                    predictions.projectedSpending !== null &&
                    predictions.projectedSpending > received
                      ? "text-warn"
                      : "text-ink"
                  }`}
                >
                  {predictions.projectedSpending !== null
                    ? fmt(predictions.projectedSpending)
                    : "—"}
                </span>
                <span className="text-xs font-medium text-muted/80">
                  {predictions.projectedSpending !== null
                    ? "if you keep your current pace"
                    : "spend something first"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Projected savings
                </span>
                <span
                  className={`text-lg font-bold tracking-tight tabular-nums ${
                    predictions.projectedSavings !== null
                      ? predictions.projectedSavings >= 0
                        ? "text-income"
                        : "text-expense"
                      : "text-ink"
                  }`}
                >
                  {predictions.projectedSavings !== null
                    ? fmt(predictions.projectedSavings)
                    : "—"}
                </span>
                <span className="text-xs font-medium text-muted/80">
                  {predictions.projectedSavings !== null
                    ? predictions.projectedSavings >= 0
                      ? "left over at month-end"
                      : "shortfall at month-end"
                    : "record income to project"}
                </span>
              </div>
            </div>
          </Card>
        ) : (
          <Card variant="quiet" className="print-block">
            <p className="text-sm leading-relaxed text-muted">
              Predictions compare today against the selected month, so they
              unlock when you view the current month.
            </p>
          </Card>
        )}
      </section>

      <ChartCard title="Spending this month" subtitle="By category">
        <ExpenseBreakdown month={month} bare />
      </ChartCard>

      {historyDepth < 2 && (
        <Card variant="quiet" className="print-block">
          <p className="text-sm leading-relaxed text-muted">
            You&apos;re looking at data from just one month so far. Add{" "}
            {2 - historyDepth} more month{2 - historyDepth === 1 ? "" : "s"} to
            unlock trend comparisons.
          </p>
        </Card>
      )}
    </div>
  );
}
