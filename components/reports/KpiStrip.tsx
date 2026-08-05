"use client";

import { useMemo } from "react";
import { monthFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { monthStats } from "@/lib/monthStats";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

interface KpiCell {
  label: string;
  value: string;
  valueClass?: string;
}

export function KpiStrip({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);
  const categories = useAppStore((s) => s.state.categories);
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);

  const { received: income, expenses, net } = useMemo(
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

  const cells: KpiCell[] = [
    {
      label: "Income",
      value: formatMoney(income, currency),
      valueClass: "text-income",
    },
    {
      label: "Expenses",
      value: formatMoney(expenses, currency),
      valueClass: "text-expense",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="flex flex-col gap-1 rounded-xl border border-border/50 bg-surface p-5 shadow-card"
        >
          <span className="text-sm font-semibold text-muted">{cell.label}</span>
          <span
            className={`text-2xl font-bold tracking-tight tabular-nums ${
              cell.valueClass ?? "text-ink"
            }`}
          >
            {cell.value}
          </span>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-border/50 bg-surface p-5 shadow-card sm:col-span-2">
        <div className="flex min-w-44 flex-col gap-1">
          <span className="text-sm font-semibold text-muted">Net</span>
          <span
            className={`text-3xl font-bold tracking-tight tabular-nums ${
              net >= 0 ? "text-income" : "text-expense"
            }`}
          >
            {formatMoney(net, currency)}
          </span>
        </div>
        {stats.savingsRate !== null && (
          <>
            <div
              aria-hidden="true"
              className="hidden h-10 w-px self-center bg-border/70 sm:block"
            />
            <div className="flex min-w-36 flex-col gap-1">
              <span className="text-sm font-semibold text-muted">
                Savings rate
              </span>
              <span
                className={`text-2xl font-bold tracking-tight tabular-nums ${
                  stats.savingsRate >= 0 ? "text-income" : "text-expense"
                }`}
              >
                {stats.savingsRate}%
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
