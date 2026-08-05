"use client";

import { useMemo } from "react";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { formatMoney } from "@/lib/money";
import { currentMonthKey, formatMonthLabel, isoToDate, todayIso } from "@/lib/date";
import { monthStats } from "@/lib/monthStats";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export function Hero({
  month,
  onMonthChange,
}: {
  month: Month;
  onMonthChange: (month: Month) => void;
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

  const dateLine = useMemo(() => {
    const iso = month === currentMonthKey() ? todayIso() : `${month}-01`;
    const date = isoToDate(iso);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [month]);

  const projected = stats.projectedRemaining;

  return (
    <div className="animate-[page-in_200ms_var(--ease-premium)]">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            {formatMonthLabel(month)} Budget
          </h1>
          <p className="mt-2 text-sm text-muted">{dateLine}</p>
          <p className="mt-1 text-sm text-muted">
            {projected === null ? (
              "Set your expected income to start planning"
            ) : (
              <>
                Projected month-end balance:{" "}
                <span
                  className={`font-semibold tabular-nums ${
                    projected < 0 ? "text-expense" : "text-ink"
                  }`}
                >
                  {formatMoney(projected, currency)}
                </span>
                {projected < 0 && " — short after planned expenses"}
              </>
            )}
          </p>
        </div>
        <MonthPicker value={month} onChange={onMonthChange} />
      </div>
    </div>
  );
}
