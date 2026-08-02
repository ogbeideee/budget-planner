"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/money";
import { totals } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { MonthlyIncomeModal } from "./MonthlyIncomeModal";

export function SummaryCards({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const currency = useAppStore((s) => s.state.settings.currency);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);

  const { income, expenses, net } = useMemo(
    () => totals(transactions, month),
    [transactions, month],
  );
  const remaining = Math.max(0, net);

  const fmt = (value: number) => formatMoney(value, currency);
  const cards = [
    { label: "Expenses", value: fmt(expenses), icon: "🧾", valueClass: "text-expense" },
    {
      label: "Net",
      value: fmt(net),
      icon: "📊",
      valueClass: net >= 0 ? "text-income" : "text-expense",
    },
    {
      label: "Remaining",
      value: fmt(remaining),
      icon: "🎯",
      valueClass: net < 0 ? "text-warn" : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite">
      <button
        type="button"
        onClick={() => setIncomeModalOpen(true)}
        className="flex flex-col gap-2 rounded-lg bg-surface p-5 text-left shadow-card transition-colors hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus:outline-none"
        title="Set monthly income"
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-canvas text-base"
          >
            💵
          </span>
          <span className="text-sm text-muted">
            {income > 0 ? "Income" : "Set Monthly Income"}
          </span>
        </span>
        <span
          className={`text-2xl font-bold tabular-nums ${
            income > 0 ? "" : "text-muted"
          }`}
        >
          {fmt(income)}
        </span>
      </button>
      {cards.map((card) => (
        <Card key={card.label} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-md bg-canvas text-base"
            >
              {card.icon}
            </span>
            <p className="text-sm text-muted">{card.label}</p>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${card.valueClass ?? ""}`}>
            {card.value}
          </p>
        </Card>
      ))}
      <MonthlyIncomeModal
        month={month}
        open={incomeModalOpen}
        onClose={() => setIncomeModalOpen(false)}
      />
    </div>
  );
}
