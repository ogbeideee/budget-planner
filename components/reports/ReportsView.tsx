"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExpenseBreakdown } from "@/components/planner/ExpenseBreakdown";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  DownloadIcon,
  FileTextIcon,
  PrintIcon,
} from "@/components/ui/icons";
import { useToast } from "@/hooks/useToast";
import { useMonth } from "@/hooks/useMonth";
import { currentMonthKey, monthKeyFromIso } from "@/lib/date";
import { MINOR_UNITS_PER_UNIT } from "@/lib/money";
import { financeSeries } from "@/lib/finance";
import { monthsWithTransactions, reportTrends } from "@/lib/reportTrends";
import { windowMonths } from "@/lib/selectors";
import { useAppStore } from "@/store/useAppStore";
import { CashFlowChart } from "./CashFlowChart";
import { CategoryAnalysisChart } from "./CategoryAnalysisChart";
import { ChartCard } from "./ChartCard";
import { ExpectedVsActualChart } from "./ExpectedVsActualChart";
import { FinancialInsights } from "./FinancialInsights";
import { ForecastCard } from "./ForecastCard";
import { IncomeSourceChart } from "./IncomeSourceChart";
import { IncomeTrendChart } from "./IncomeTrendChart";
import { MonthlyOverview } from "./MonthlyOverview";
import { Recommendations } from "./Recommendations";

const IncomeExpenseChart = dynamic(
  () => import("./IncomeExpenseChart").then((m) => m.IncomeExpenseChart),
  { ssr: false, loading: () => <ChartSkeleton height={380} /> },
);

const SpendingTrendChart = dynamic(
  () => import("./SpendingTrendChart").then((m) => m.SpendingTrendChart),
  { ssr: false, loading: () => <ChartSkeleton height={380} /> },
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
      className="animate-pulse rounded-xl bg-border/40 print-block"
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

export function ReportsView() {
  const { month, setMonth } = useMonth();
  const months = useMemo(() => windowMonths(month), [month]);
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);
  const categories = useAppStore((s) => s.state.categories);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const currency = useAppStore((s) => s.state.settings.currency);
  const { success } = useToast();

  const [compareOpen, setCompareOpen] = useState(false);
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

  const trends = useMemo(
    () => reportTrends({ transactions, categories, incomePlans, months }),
    [transactions, categories, incomePlans, months],
  );
  const historyDepth = useMemo(
    () => monthsWithTransactions(transactions, months),
    [transactions, months],
  );
  const isCurrentMonth = month === currentMonthKey();
  const netHistory = useMemo(
    () =>
      financeSeries(transactions, incomePlans, months).map((point) => ({
        month: point.month,
        net: point.net,
      })),
    [transactions, incomePlans, months],
  );

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Reports"
          description="Understand your spending patterns and financial trends."
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={compareOpen}
            onClick={() => setCompareOpen((open) => !open)}
            className={`no-print flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold transition-colors duration-150 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none ${
              compareOpen
                ? "border-brand-500/60 bg-brand-500/10 text-brand-600 dark:text-brand-400"
                : "border-border/80 bg-surface text-ink hover:border-border hover:bg-canvas"
            }`}
          >
            Compare month
          </button>
          <MonthPicker value={month} onChange={setMonth} />
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              onClick={() => setExportOpen((open) => !open)}
              className="no-print flex h-10 items-center gap-2 rounded-lg border border-border/80 bg-surface px-3.5 text-sm font-semibold text-ink transition-colors hover:border-border hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none"
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

      <div
        key={month}
        className="flex animate-[page-in_220ms_var(--ease-premium)] flex-col gap-6"
      >
        <section
          aria-labelledby="reports-overview-heading"
          className="flex flex-col gap-6"
        >
          <SectionHeading>Monthly overview</SectionHeading>
          <MonthlyOverview
            month={month}
            transactions={transactions}
            incomePlans={incomePlans}
            currency={currency}
            compare={compareOpen}
          />
        </section>

        <section
          aria-labelledby="reports-insights-heading"
          className="flex flex-col gap-6"
        >
          <SectionHeading>Financial insights</SectionHeading>
          <FinancialInsights
            month={month}
            trends={trends}
            budgets={budgets}
            categories={categories}
            transactions={transactions}
            currency={currency}
          />
        </section>

        <section
          aria-labelledby="reports-trend-heading"
          className="flex flex-col gap-6"
        >
          <SectionHeading>Spending trend</SectionHeading>
          <SpendingTrendChart months={months} />
        </section>

        <section
          aria-labelledby="reports-category-heading"
          className="flex flex-col gap-6"
        >
          <SectionHeading>Category analysis</SectionHeading>
          <CategoryAnalysisChart month={month} />
        </section>

        <section
          aria-labelledby="reports-income-expense-heading"
          className="flex flex-col gap-6"
        >
          <SectionHeading>Income vs expenses</SectionHeading>
          <IncomeExpenseChart months={months} />
        </section>

        <section
          aria-labelledby="reports-cashflow-heading"
          className="flex flex-col gap-6"
        >
          <SectionHeading>Cash flow</SectionHeading>
          <CashFlowChart months={months} />
        </section>

        <section
          aria-labelledby="reports-forecast-heading"
          className="flex flex-col gap-6"
        >
          <SectionHeading>Forecast</SectionHeading>
          <ForecastCard
            month={month}
            transactions={transactions}
            incomePlans={incomePlans}
            currency={currency}
            isCurrentMonth={isCurrentMonth}
            netHistory={netHistory}
          />
        </section>

        <section
          aria-labelledby="reports-recommendations-heading"
          className="flex flex-col gap-6"
        >
          <SectionHeading>Recommendations</SectionHeading>
          <Recommendations
            month={month}
            budgets={budgets}
            categories={categories}
            transactions={transactions}
            futureExpenses={futureExpenses}
            incomePlans={incomePlans}
            currency={currency}
          />
        </section>

        <section
          aria-labelledby="reports-breakdown-heading"
          className="flex flex-col gap-6"
        >
          <SectionHeading>Detailed breakdowns</SectionHeading>
          {historyDepth < 2 && (
            <Card variant="quiet" className="print-block">
              <p className="text-sm leading-relaxed text-muted">
                You&apos;re looking at data from just one month so far. Add{" "}
                {2 - historyDepth} more month{2 - historyDepth === 1 ? "" : "s"} to
                unlock trend comparisons.
              </p>
            </Card>
          )}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ExpectedVsActualChart month={month} />
            <IncomeSourceChart month={month} />
          </div>
          <IncomeTrendChart months={months} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SavingsChart months={months} />
            <BudgetUtilizationChart months={months} />
          </div>
          <TopCategoriesChart months={months} />
          <ChartCard title="Spending this month" subtitle="By category">
            <ExpenseBreakdown month={month} bare />
          </ChartCard>
        </section>
      </div>
    </div>
  );
}
