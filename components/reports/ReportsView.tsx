"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { categoryLabelOr } from "@/lib/categoryDisplay";
import { useAppStore } from "@/store/useAppStore";
import { CashFlowChart } from "./CashFlowChart";
import { CategoryAnalysisChart } from "./CategoryAnalysisChart";
import { FinancialInsights } from "./FinancialInsights";
import { ForecastCard } from "./ForecastCard";
import { IncomeComparisonChart } from "./IncomeComparisonChart";
import { IncomeSourceChart } from "./IncomeSourceChart";
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

/**
 * Months of recorded history a trend chart needs before it says anything. Below
 * this the "one month so far" banner shows instead, and charts that would
 * degenerate to a single point are omitted entirely.
 */
const MIN_TREND_MONTHS = 2;

export function ReportsView() {
  const { month, setMonth } = useMonth();
  const months = useMemo(() => windowMonths(month), [month]);
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);
  const rollovers = useAppStore((s) => s.state.rollovers);
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
        categoryLabelOr(category?.name, "Uncategorized"),
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
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -right-24 top-14 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(14,165,164,0.06),transparent_65%)]" />
        <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.05),transparent_65%)]" />
        <svg
          className="absolute right-8 top-24 hidden select-none md:block"
          width="280"
          height="160"
          viewBox="0 0 280 160"
          fill="none"
        >
          <circle cx="224" cy="34" r="48" stroke="rgba(14,165,164,0.12)" strokeWidth="2" />
          <circle cx="224" cy="34" r="28" stroke="rgba(14,165,164,0.14)" strokeWidth="2" />
          <path
            d="M32 138 C 90 132, 114 90, 166 86 C 208 82, 232 48, 270 40"
            stroke="rgba(14,165,164,0.2)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M32 152 C 102 146, 132 110, 192 106"
            stroke="rgba(37,99,235,0.13)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="relative z-10 flex flex-col gap-8">
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
            className={`no-print flex min-h-10 items-center gap-2 rounded-md border px-4 text-base font-semibold transition-colors duration-150 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none ${
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
              className="no-print flex min-h-10 items-center gap-2 rounded-md border border-border/80 bg-surface px-4 text-base font-semibold text-ink transition-colors hover:border-border hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none"
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
            rollovers={rollovers}
            categories={categories}
            transactions={transactions}
            currency={currency}
          />
        </section>

        <section
          aria-labelledby="reports-spending-heading"
          className="flex flex-col gap-6"
        >
          <SectionHeading>Spending breakdown</SectionHeading>
          <IncomeExpenseChart months={months} />
          {/* The one category breakdown left on this page. It moved up into
              this section, where the removed "Spending by category" card used
              to sit, but stays FULL WIDTH: its donut centre label needs the
              room, and halving it to sit beside Income vs expenses made the
              amount overlap the ring. */}
          <CategoryAnalysisChart month={month} />
        </section>

        <section
          aria-labelledby="reports-savings-trend-heading"
          className="flex flex-col gap-6"
        >
          <SectionHeading>Savings trend</SectionHeading>
          <SavingsChart months={months} />
        </section>

        <section
          aria-labelledby="reports-trend-heading"
          className="flex flex-col gap-6"
        >
          <SectionHeading>Spending trend</SectionHeading>
          <SpendingTrendChart months={months} />
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
            rollovers={rollovers}
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
          {historyDepth < MIN_TREND_MONTHS && (
            <Card variant="quiet" className="print-block">
              <p className="text-sm leading-relaxed text-muted">
                You&apos;re looking at data from just one month so far. Add{" "}
                {MIN_TREND_MONTHS - historyDepth} more month
                {MIN_TREND_MONTHS - historyDepth === 1 ? "" : "s"} to
                unlock trend comparisons.
              </p>
            </Card>
          )}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Merged card: keeps the slot "Expected vs actual" held, and the
                "Income trend" row below is gone — it was the same comparison
                on a different axis and is now this card's "Over time" view. */}
            <IncomeComparisonChart month={month} months={months} />
            <IncomeSourceChart month={month} />
          </div>
          {/* Gated on the SAME `historyDepth` that drives the banner above, so
              the two can never disagree about what "enough history" means.
              Budget utilization is the one chart here that DROPS months without
              budgets (`budgetUtilizationSeries` flatMaps and returns [] for
              them) instead of zero-filling, so a single month renders as one
              bar spanning the card — a broken-looking block, not a trend. Every
              other months-based chart on this page zero-fills, which reads
              correctly as "nothing yet". Hidden outright rather than shown with
              a placeholder. */}
          {historyDepth >= MIN_TREND_MONTHS && (
            <BudgetUtilizationChart months={months} />
          )}
        </section>
      </div>
      </div>
    </div>
  );
}
