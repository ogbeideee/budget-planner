"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { TargetIcon, TrendingUpIcon } from "@/components/ui/icons";
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

  const cards: Array<{
    label: string;
    value: number;
    icon: ReactNode;
    iconClass: string;
    valueClass: string;
  }> = [
    {
      label: "Net savings",
      value: net,
      icon: <TrendingUpIcon className="h-4 w-4" />,
      iconClass: net >= 0 ? "bg-income/10 text-income" : "bg-expense/10 text-expense",
      valueClass: net >= 0 ? "text-income" : "text-expense",
    },
    {
      label: "Remaining balance",
      value: remaining,
      icon: <TargetIcon className="h-4 w-4" />,
      iconClass: "bg-brand-500/10 text-brand-600 dark:text-brand-400",
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
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconClass}`}
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
