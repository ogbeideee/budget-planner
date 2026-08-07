"use client";

import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  AlertTriangleIcon,
  SparklesIcon,
  TrendDownIcon,
  TrendingUpIcon,
} from "@/components/ui/icons";
import { formatMonthShort } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { spendingByCategory } from "@/lib/selectors";
import type { ReportTrendsData } from "@/lib/reportTrends";
import type { Budget, Category, Currency, Month, Transaction } from "@/lib/types";

interface FinancialInsightsProps {
  month: Month;
  trends: ReportTrendsData;
  budgets: Budget[];
  categories: Category[];
  transactions: Transaction[];
  currency: Currency;
}

export function FinancialInsights({
  month,
  trends,
  budgets,
  categories,
  transactions,
  currency,
}: FinancialInsightsProps) {
  const fmt = useCallback(
    (value: number) => formatMoney(value, currency),
    [currency],
  );

  const spent = useMemo(
    () =>
      new Map(
        spendingByCategory(transactions, month).map((entry) => [
          entry.categoryId,
          entry.amount,
        ]),
      ),
    [transactions, month],
  );
  const overBudget = useMemo(
    () =>
      budgets
        .filter((budget) => budget.month === month)
        .map((budget) => ({
          budget,
          spent: spent.get(budget.categoryId) ?? 0,
        }))
        .filter(({ budget, spent }) => spent > budget.limit)
        .slice(0, 3),
    [budgets, month, spent],
  );

  const observations = useMemo(() => {
    const rows: Array<{
      key: string;
      icon: ReactNode;
      iconClass: string;
      text: string;
    }> = [];

    if (trends.largestIncrease) {
      rows.push({
        key: "increase",
        icon: <TrendingUpIcon className="h-4 w-4" />,
        iconClass: "bg-warn/[0.08] text-warn",
        text: `Spending rose ${fmt(trends.largestIncrease.delta)} from ${formatMonthShort(trends.largestIncrease.fromMonth)} to ${formatMonthShort(trends.largestIncrease.toMonth)}.`,
      });
    }
    if (trends.largestDecrease) {
      rows.push({
        key: "decrease",
        icon: <TrendingUpIcon className="h-4 w-4" />,
        iconClass: "bg-income/[0.08] text-income",
        text: `Spending fell ${fmt(Math.abs(trends.largestDecrease.delta))} from ${formatMonthShort(trends.largestDecrease.fromMonth)} to ${formatMonthShort(trends.largestDecrease.toMonth)}.`,
      });
    }
    if (trends.savingsDelta && trends.savingsDelta.delta !== 0) {
      const improved = trends.savingsDelta.delta > 0;
      rows.push({
        key: "savings",
        icon: improved ? (
          <TrendingUpIcon className="h-4 w-4" />
        ) : (
          <TrendDownIcon className="h-4 w-4" />
        ),
        iconClass: improved
          ? "bg-income/[0.08] text-income"
          : "bg-expense/[0.08] text-expense",
        text: `Savings ${improved ? "improved" : "fell"} by ${fmt(Math.abs(trends.savingsDelta.delta))} this month.`,
      });
    }
    if (trends.highestCategory) {
      rows.push({
        key: "top-category",
        icon: <TrendDownIcon className="h-4 w-4" />,
        iconClass: "bg-expense/[0.08] text-expense",
        text: `${trends.highestCategory.category.icon} ${trends.highestCategory.category.name} is your biggest cost this month at ${fmt(trends.highestCategory.amount)}.`,
      });
    }

    const overBudgetRows = overBudget.map(({ budget, spent }) => {
      const category = categories.find((c) => c.id === budget.categoryId);
      return {
        key: `over-${budget.id}`,
        icon: <AlertTriangleIcon className="h-4 w-4" />,
        iconClass: "bg-warn/[0.08] text-warn",
        text: `"${category?.name ?? "Budget"}" is over budget by ${fmt(spent - budget.limit)}.`,
      } as const;
    });
    for (const row of overBudgetRows) rows.push(row);

    return rows.slice(0, 3);
  }, [trends, overBudget, categories, fmt]);

  const headline = useMemo(() => {
    if (trends.savingsDelta && trends.savingsDelta.delta !== 0) {
      const improved = trends.savingsDelta.delta > 0;
      return improved
        ? `Your savings improved by ${fmt(Math.abs(trends.savingsDelta.delta))} this month`
        : `Savings dipped ${fmt(Math.abs(trends.savingsDelta.delta))} this month`;
    }
    if (trends.largestIncrease) {
      return `Spending climbed ${fmt(trends.largestIncrease.delta)} from ${formatMonthShort(trends.largestIncrease.fromMonth)} to ${formatMonthShort(trends.largestIncrease.toMonth)}`;
    }
    if (trends.largestDecrease) {
      return `Spending fell ${fmt(Math.abs(trends.largestDecrease.delta))} from ${formatMonthShort(trends.largestDecrease.fromMonth)} to ${formatMonthShort(trends.largestDecrease.toMonth)}`;
    }
    if (trends.highestCategory) {
      return `${trends.highestCategory.category.name} is your biggest cost this month`;
    }
    return "A steady month so far";
  }, [trends, fmt]);

  const totalExpenses = useMemo(
    () =>
      spendingByCategory(transactions, month).reduce(
        (sum, entry) => sum + entry.amount,
        0,
      ),
    [transactions, month],
  );
  const topShare =
    totalExpenses > 0 && trends.highestCategory
      ? Math.round((100 * trends.highestCategory.amount) / totalExpenses)
      : null;
  const overBudgetCount = overBudget.length;

  const paragraphParts: string[] = [];
  if (trends.highestCategory && topShare !== null) {
    paragraphParts.push(
      `${trends.highestCategory.category.name} takes ${topShare}% of this month's spending.`,
    );
  }
  if (overBudgetCount > 0) {
    paragraphParts.push(
      `${overBudgetCount} budget${overBudgetCount === 1 ? " is" : "s are"} over their limits.`,
    );
  }
  if (trends.savingsDelta && trends.savingsDelta.delta === 0) {
    paragraphParts.push("Savings held steady this month.");
  }
  if (paragraphParts.length === 0) {
    paragraphParts.push(
      "Add a few months of data and your money story will start taking shape here.",
    );
  }

  return (
    <Card className="print-block">
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400"
          >
            <SparklesIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-amount font-bold leading-7 tracking-tight text-ink">
              {headline}
            </p>
            <p className="mt-1.5 text-base font-medium leading-6 text-secondary">
              {paragraphParts.join(" ")}
            </p>
          </div>
        </div>
        {observations.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 border-t border-border/60 pt-5 md:grid-cols-3">
            {observations.map((row) => (
              <li
                key={row.key}
                className="flex items-start gap-3 rounded-lg bg-canvas/50 p-3.5"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${row.iconClass}`}
                >
                  {row.icon}
                </span>
                <span className="text-sm font-medium leading-relaxed text-ink">
                  {row.text}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            illustration="chart"
            illustrationClass="bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
            title="Nothing to report yet"
            description="Add a few months of data and this is where your money story appears."
          />
        )}
      </div>
    </Card>
  );
}
