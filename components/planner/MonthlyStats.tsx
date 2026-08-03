"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { formatDateShort, formatMonthShort, monthOffset } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { monthStats } from "@/lib/monthStats";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

interface StatCell {
  label: string;
  value: string;
  caption?: string;
  valueClass?: string;
}

export function MonthlyStats({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);
  const categories = useAppStore((s) => s.state.categories);
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const currency = useAppStore((s) => s.state.settings.currency);

  const stats = useMemo(
    () => monthStats({ month, transactions, budgets, categories, futureExpenses }),
    [month, transactions, budgets, categories, futureExpenses],
  );

  const cells = useMemo(() => {
    const fmt = (value: number) => formatMoney(value, currency);
    const list: StatCell[] = [];
    if (stats.largestExpense) {
      list.push({
        label: "Largest expense",
        value: fmt(stats.largestExpense.amount),
        caption: stats.largestExpense.label,
      });
    }
    if (stats.mostFunded) {
      list.push({
        label: "Most funded",
        value: fmt(stats.mostFunded.limit),
        caption: stats.mostFunded.categoryName,
      });
    }
    if (stats.upcomingPayment) {
      list.push({
        label: "Upcoming payment",
        value: fmt(stats.upcomingPayment.amount),
        caption: `${stats.upcomingPayment.title} · ${formatDateShort(stats.upcomingPayment.dueDate)}`,
      });
    }
    if (stats.savingsRate !== null) {
      list.push({
        label: "Savings rate",
        value: `${stats.savingsRate}%`,
        caption: "of income saved",
        valueClass: stats.savingsRate >= 0 ? "text-income" : "text-expense",
      });
    }
    if (stats.vsLastMonth) {
      list.push({
        label: "vs last month",
        value: `${stats.vsLastMonth.delta >= 0 ? "+" : ""}${fmt(stats.vsLastMonth.delta)}`,
        caption: `${formatMonthShort(monthOffset(month, -1))} net ${fmt(stats.vsLastMonth.lastNet)}`,
        valueClass: stats.vsLastMonth.delta >= 0 ? "text-income" : "text-expense",
      });
    }
    if (stats.projectedRemaining !== null) {
      list.push({
        label: "Projected remaining",
        value: fmt(stats.projectedRemaining),
        caption: "after upcoming payments",
        valueClass: stats.projectedRemaining < 0 ? "text-expense" : undefined,
      });
    }
    return list;
  }, [stats, currency, month]);

  if (cells.length === 0) return null;

  return (
    <Card title="Month at a glance">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
              {cell.label}
            </dt>
            <dd
              className={`mt-0.5 truncate text-lg font-bold tracking-tight tabular-nums ${
                cell.valueClass ?? ""
              }`}
            >
              {cell.value}
            </dd>
            {cell.caption && (
              <p className="truncate text-xs text-muted">{cell.caption}</p>
            )}
          </div>
        ))}
      </dl>
    </Card>
  );
}
