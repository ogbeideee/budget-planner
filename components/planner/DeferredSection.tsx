"use client";

import { useMemo } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { categoryAccent } from "@/lib/accents";
import { formatDateShort } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { deferredExpenses } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export function DeferredSection({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);

  const deferred = useMemo(
    () => deferredExpenses(transactions, month),
    [transactions, month],
  );
  const total = useMemo(
    () => deferred.reduce((sum, transaction) => sum + transaction.amount, 0),
    [deferred],
  );

  if (deferred.length === 0) {
    return (
      <EmptyState
        illustration="wallet"
        illustrationClass="bg-canvas text-muted"
        title="Nothing has been pushed into this month"
        description="Expenses you moved forward from an earlier month will show up here."
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-1">
        {deferred.map((transaction) => {
          const category = categories.find(
            (c) => c.id === transaction.categoryId,
          );
          return (
            <li
              key={transaction.id}
              className="flex items-center gap-3 py-1.5"
            >
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base ${
                  category
                    ? categoryAccent(category.name).chip
                    : "bg-canvas text-muted"
                }`}
              >
                {category?.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {transaction.note ?? category?.name ?? "Expense"}
                </p>
                <p className="text-xs text-muted">
                  {formatDateShort(transaction.date)}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-expense">
                {formatMoney(transaction.amount, currency)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 border-t border-border pt-3 text-sm font-semibold tabular-nums text-ink">
        Moved into this month: {formatMoney(total, currency)}
      </p>
    </>
  );
}
