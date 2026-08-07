"use client";

import { useMemo } from "react";
import {
  AnimatedMoney,
} from "@/components/ui/AnimatedNumber";
import { Card } from "@/components/ui/Card";
import { monthFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export function MonthlyStats({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);

  const finance = useMemo(
    () => monthFinance(transactions, incomePlans, month),
    [transactions, incomePlans, month],
  );

  const count = useMemo(
    () => transactions.filter((t) => t.date.startsWith(month)).length,
    [transactions, month],
  );

  const fmt = (value: number) => formatMoney(value, currency);

  const columns = [
    {
      label: "Income",
      value: (
        <AnimatedMoney
          value={finance.received}
          currency={currency}
          className="text-income"
        />
      ),
      caption: `received of ${fmt(finance.expected)} expected`,
    },
    {
      label: "Expenses",
      value: (
        <AnimatedMoney
          value={finance.expenses}
          currency={currency}
          className="text-ink"
        />
      ),
      caption: `${count} ${count === 1 ? "transaction" : "transactions"} this month`,
    },
    {
      label: "Remaining",
      value: (
        <AnimatedMoney
          value={finance.remaining}
          currency={currency}
          className={finance.net < 0 ? "text-warn" : "text-ink"}
        />
      ),
      caption:
        finance.net >= 0
          ? "income left after expenses"
          : `over income by ${fmt(Math.abs(finance.net))}`,
    },
  ];

  const grid = (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-0">
      {columns.map((column, index) => (
        <div
          key={column.label}
          className={`flex flex-col gap-2 sm:px-6 ${
            index > 0 ? "sm:border-l sm:border-border/60" : ""
          } ${index === 0 ? "sm:pl-0" : ""} ${index === columns.length - 1 ? "sm:pr-0" : ""}`}
        >
          <span className="text-caption font-medium text-muted">
            {column.label}
          </span>
          <span className="whitespace-nowrap text-kpi-secondary font-bold leading-none tracking-[-0.03em] tabular-nums">
            {column.value}
          </span>
          <span className="text-caption font-medium text-muted">
            {column.caption}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <Card title="Month at a glance" subtitle="Income, expenses and what's left this month.">
      {grid}
    </Card>
  );
}
