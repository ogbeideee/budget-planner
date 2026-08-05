"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangleIcon, ChevronRightIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import { overBudgetCategories } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export function OverBudgetAlert({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);

  const entries = useMemo(
    () => overBudgetCategories(budgets, transactions, month),
    [budgets, transactions, month],
  );
  if (entries.length === 0) return null;

  return (
    <div
      role="alert"
      className="animate-[list-in_200ms_var(--ease-premium)] rounded-xl border border-danger/25 bg-danger/[0.04] px-5 py-4 shadow-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger"
          >
            <AlertTriangleIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">
              Over budget this month
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {entries.length === 1
                ? "One category is over its limit."
                : `${entries.length} categories are over their limits.`}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {entries.map((entry) => {
                const category = categories.find(
                  (c) => c.id === entry.budget.categoryId,
                );
                return (
                  <li
                    key={entry.budget.id}
                    className="flex items-center gap-1.5 rounded-full border border-danger/20 bg-surface px-2.5 py-1 text-xs font-medium text-ink"
                  >
                    <span aria-hidden="true" className="text-danger">
                      {category?.icon ?? ""}
                    </span>
                    <span className="truncate">
                      {category?.name ?? "Category"}
                    </span>
                    <span className="font-semibold tabular-nums text-danger">
                      {formatMoney(
                        entry.spent - entry.budget.limit,
                        currency,
                      )}{" "}
                      over
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <Link
          href="/?focus=over"
          className="inline-flex items-center gap-1 rounded-md text-sm font-semibold text-brand-600 underline-offset-2 transition-colors duration-200 hover:text-brand-700 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus:outline-none dark:text-brand-400 dark:hover:text-brand-300"
        >
          Review budgets
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}