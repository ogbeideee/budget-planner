"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
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

  return (
    <Card
      title="Deferred expenses"
      action={
        <Link
          href={`/history?month=${month}`}
          className="text-sm font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
        >
          View in History
        </Link>
      }
    >
      {deferred.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          Nothing was deferred into this month.
        </p>
      ) : (
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
                  <span aria-hidden="true">{category?.icon}</span>
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
            Total deferred: {formatMoney(total, currency)}
          </p>
        </>
      )}
    </Card>
  );
}
