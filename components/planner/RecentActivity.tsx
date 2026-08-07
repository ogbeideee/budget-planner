"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { categoryAccent } from "@/lib/accents";
import { formatDateShort } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { deferredExpenses, sortByDateDesc } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { DeferredSection } from "./DeferredSection";

export function RecentActivity({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);

  const recent = useMemo(
    () =>
      sortByDateDesc(
        transactions.filter((transaction) =>
          transaction.date.startsWith(month),
        ),
      ).slice(0, 5),
    [transactions, month],
  );

  const deferred = useMemo(
    () => deferredExpenses(transactions, month),
    [transactions, month],
  );

  return (
    <Card
      title="Recent Activity"
      subtitle="Your latest five transactions."
      action={
        <Link
          href={`/history?month=${month}`}
          className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-ink transition-all duration-150 ease-premium hover:bg-sidebar-hover hover:border-border focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2"
        >
          View Full Timeline
        </Link>
      }
    >
      {recent.length === 0 ? (
        <EmptyState
          illustration="wallet"
          illustrationClass="bg-canvas text-muted"
          title="No activity this month yet"
          description="Add an expense or income and your latest five transactions will appear here."
          action={
            <Link
              href={`/history?month=${month}`}
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-ink transition-all duration-150 ease-premium hover:bg-sidebar-hover hover:border-border focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2"
            >
              View Full Timeline
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-1">
          {recent.map((transaction) => {
            const category = categories.find(
              (c) => c.id === transaction.categoryId,
            );
            const title =
              transaction.note ?? category?.name ?? "Transaction";
            return (
              <li
                key={transaction.id}
                className="group flex h-14 items-center gap-4 rounded-lg transition-colors duration-150 ease-premium hover:bg-sidebar-hover"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-base ${
                    category
                      ? categoryAccent(category.name).chip
                      : "bg-canvas text-muted"
                  }`}
                >
                  {category?.icon}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-base font-semibold text-ink">
                    {title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-caption font-medium text-muted">
                    <span className="truncate">
                      {category?.name ?? (transaction.type === "income" ? "Income" : "Expense")}{" "}
                      · {formatDateShort(transaction.date)}
                    </span>
                    {transaction.deferred && (
                      <span className="shrink-0 rounded-full bg-warn/[0.1] px-2 py-0.5 text-micro font-semibold text-warn">
                        Moved
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-base font-bold tabular-nums ${
                    transaction.type === "income"
                      ? "text-income"
                      : "text-expense"
                  }`}
                >
                  {transaction.type === "income" ? "+" : "−"}
                  {formatMoney(transaction.amount, currency)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {deferred.length > 0 && (
        <div className="mt-6 border-t border-border/60 pt-5">
          <DeferredSection month={month} />
        </div>
      )}
    </Card>
  );
}
