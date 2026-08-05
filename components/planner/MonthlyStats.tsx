"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import {
  ArrowUpRightIcon,
  TrendDownIcon,
  WalletIcon,
} from "@/components/ui/icons";
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
  indicator?: ReactNode;
}

const PREVIEW_PREFERRED = ["Largest expense", "Savings rate", "Projected remaining"];

export function MonthlyStats({
  month,
  bare = false,
  preview = false,
}: {
  month: Month;
  bare?: boolean;
  preview?: boolean;
}) {
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);
  const categories = useAppStore((s) => s.state.categories);
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);

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

  const cells = useMemo(() => {
    const fmt = (value: number) => formatMoney(value, currency);
    const list: StatCell[] = [];
    if (stats.largestExpense) {
      const category = categories.find(
        (c) => c.id === stats.largestExpense?.categoryId,
      );
      list.push({
        label: "Largest expense",
        value: fmt(stats.largestExpense.amount),
        caption: stats.largestExpense.label,
        indicator: category ? (
          <span
            aria-hidden="true"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs"
            style={{
              backgroundColor: `${category.color}1f`,
              color: category.color,
            }}
          >
            {category.icon}
          </span>
        ) : undefined,
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
        indicator:
          stats.savingsRate >= 0 ? (
            <ArrowUpRightIcon
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-income"
            />
          ) : (
            <TrendDownIcon
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-expense"
            />
          ),
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
        indicator: (
          <WalletIcon
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted"
          />
        ),
      });
    }
    return list;
  }, [stats, currency, month, categories]);

  if (cells.length === 0) return null;

  const display = preview
    ? (() => {
        const byLabel = new Map(cells.map((cell) => [cell.label, cell]));
        const picked: StatCell[] = [];
        for (const label of PREVIEW_PREFERRED) {
          const cell = byLabel.get(label);
          if (cell) picked.push(cell);
        }
        for (const cell of cells) {
          if (picked.length >= 3) break;
          if (!picked.includes(cell)) picked.push(cell);
        }
        return picked;
      })()
    : cells;

  const grid = (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {display.map((cell) => (
        <div key={cell.label} className="min-w-0">
          <dt className="text-[11px] font-medium tracking-wide text-muted/80">
            {cell.label}
          </dt>
          <dd
            className={`mt-0.5 flex items-center gap-1.5 text-2xl font-bold tracking-tight tabular-nums ${
              cell.valueClass ?? ""
            }`}
          >
            {cell.indicator}
            <span className="min-w-0 truncate">{cell.value}</span>
          </dd>
          {cell.caption && (
            <p className="truncate text-xs text-muted">{cell.caption}</p>
          )}
        </div>
      ))}
    </dl>
  );

  if (bare) return grid;

  return (
    <Card title="Month at a glance">
      {grid}
    </Card>
  );
}
