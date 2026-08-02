"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/money";
import { totals } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export function SnapshotCards({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const currency = useAppStore((s) => s.state.settings.currency);

  const { net } = useMemo(
    () => totals(transactions, month),
    [transactions, month],
  );
  const remaining = Math.max(0, net);

  const cards = [
    {
      label: "Savings",
      value: net,
      icon: "💰",
      valueClass: net >= 0 ? "text-income" : "text-expense",
    },
    {
      label: "Remaining balance",
      value: remaining,
      icon: "🎯",
      valueClass: "text-ink",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <p className={`text-2xl font-bold tabular-nums ${card.valueClass}`}>
            {formatMoney(card.value, currency)}
          </p>
        </Card>
      ))}
    </div>
  );
}
