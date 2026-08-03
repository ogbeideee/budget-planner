"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangleIcon } from "@/components/ui/icons";
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
      className="rounded-lg border border-danger/30 bg-danger/10 px-5 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-danger">
          <AlertTriangleIcon className="h-4 w-4" />
          Over budget this month
        </p>
        <Link
          href="/"
          className="rounded-sm text-sm font-semibold text-brand-600 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus:outline-none dark:text-brand-400"
        >
          View budgets
        </Link>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {entries.map((entry) => {
          const category = categories.find((c) => c.id === entry.budget.categoryId);
          return (
            <li key={entry.budget.id} className="text-sm text-ink">
              {category?.icon ?? ""} {category?.name ?? "Category"} ·{" "}
              {formatMoney(entry.spent - entry.budget.limit, currency)} over
            </li>
          );
        })}
      </ul>
    </div>
  );
}
