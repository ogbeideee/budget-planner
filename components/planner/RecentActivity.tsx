"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/hooks/useToast";
import { formatDateShort } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { deferredExpenses, sortByDateDesc } from "@/lib/selectors";
import type { Month, Transaction } from "@/lib/types";
import { categoryLabelOr } from "@/lib/categoryDisplay";
import { useAppStore } from "@/store/useAppStore";
import { categoryDisplay } from "@/lib/categoryRegistry";
import { TransactionForm } from "../txn/TransactionForm";
import { DeferredSection } from "./DeferredSection";

export function RecentActivity({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);
  const { success } = useToast();

  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formSession, setFormSession] = useState(0);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteTransaction(pendingDelete.id);
    success("Transaction deleted.");
    setPendingDelete(null);
  };

  const recent = useMemo(
    () =>
      sortByDateDesc(
        transactions.filter((transaction) =>
          transaction.date.startsWith(month),
        ),
      ).slice(0, 3),
    [transactions, month],
  );

  const deferred = useMemo(
    () => deferredExpenses(transactions, month),
    [transactions, month],
  );

  return (
    <Card
      title="Recent Activity"
      subtitle="Your latest three transactions."
      action={
        <Link
          href={`/history?month=${month}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-ink transition-all duration-150 ease-premium hover:bg-sidebar-hover hover:border-border focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2"
        >
          View all
        </Link>
      }
    >
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -right-16 -top-20 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(14,165,164,0.07),transparent_70%)]" />
          <div className="absolute -bottom-20 -left-16 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.06),transparent_70%)]" />
          <svg
            className="absolute -top-1 right-8 hidden select-none sm:block"
            width="220"
            height="80"
            viewBox="0 0 220 80"
            fill="none"
          >
            <circle cx="186" cy="18" r="22" stroke="rgba(14,165,164,0.14)" strokeWidth="2" />
            <circle cx="186" cy="18" r="11" stroke="rgba(14,165,164,0.16)" strokeWidth="2" />
            <path
              d="M6 76 C 60 72, 88 48, 138 44 C 172 41, 194 26, 214 22"
              stroke="rgba(14,165,164,0.2)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M6 66 C 56 62, 84 38, 132 34"
              stroke="rgba(37,99,235,0.14)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="relative z-10">
          {recent.length === 0 ? (
        <EmptyState
          illustration="wallet"
          illustrationClass="bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
          title="No activity this month yet"
          description="Add an expense or income and your latest three transactions will appear here."
          action={
            <Link
              href={`/history?month=${month}`}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-ink transition-all duration-150 ease-premium hover:bg-sidebar-hover hover:border-border focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2"
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
              transaction.note ?? categoryLabelOr(category?.name, "Transaction");
            return (
              <li
                key={transaction.id}
                className="group flex h-14 items-center gap-4 rounded-lg transition-colors duration-150 ease-premium hover:bg-sidebar-hover"
              >
                <button
                  type="button"
                  onClick={() => {
                    setEditing(transaction);
                    setFormSession((session) => session + 1);
                  }}
                  className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-4 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-base ${
                      category
                        ? categoryDisplay(category).chip
                        : "bg-canvas text-muted"
                    }`}
                  >
                    {categoryDisplay(category).icon}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-base font-semibold text-ink">
                      {title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-caption font-medium text-muted">
                      <span className="truncate">
                        {categoryLabelOr(category?.name, transaction.type === "income" ? "Income" : "Expense")}{" "}
                        · {formatDateShort(transaction.date)}
                      </span>
                      {transaction.deferred && (
                        <span className="shrink-0 rounded-full bg-warn/[0.1] px-2.5 py-0.5 text-xs font-semibold text-warn">
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
                </button>
                <button
                  type="button"
                  aria-label="Edit transaction"
                  onClick={() => {
                    setEditing(transaction);
                    setFormSession((session) => session + 1);
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-premium hover:bg-brand-500/10 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 dark:hover:text-brand-400"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Delete transaction"
                  onClick={() => setPendingDelete(transaction)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-premium hover:bg-expense/10 hover:text-expense focus-visible:ring-2 focus-visible:ring-expense/50 focus:outline-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
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
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete transaction"
        message={
          pendingDelete
            ? "Delete this transaction? This cannot be undone."
            : ""
        }
        confirmLabel="Delete transaction"
        danger
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />

      <TransactionForm
        key={formSession}
        open={editing !== null}
        onClose={() => setEditing(null)}
        transaction={editing}
        defaultMonth={month}
      />
    </Card>
  );
}
