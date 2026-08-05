"use client";

import { useMemo } from "react";
import { InsightList } from "@/components/insights/InsightList";
import { Disclosure } from "@/components/ui/Disclosure";
import { CheckIcon, SparklesIcon } from "@/components/ui/icons";
import { insightsFor } from "@/lib/insights";
import { formatMonthLabel } from "@/lib/date";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export function TodayRecommendations({ month }: { month: Month }) {
  const budgets = useAppStore((s) => s.state.budgets);
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);

  const { hasData, hasActions } = useMemo(() => {
    const all = insightsFor({
      budgets,
      transactions,
      categories,
      incomePlans,
      month,
      currency,
    });
    const hasData =
      transactions.some((transaction) => transaction.date.startsWith(month)) ||
      budgets.some((budget) => budget.month === month);
    return { hasData, hasActions: all.some((insight) => insight.action) };
  }, [budgets, transactions, categories, incomePlans, month, currency]);

  const monthLabel = formatMonthLabel(month);

  const onTrack = (
    <div className="flex animate-[list-in_200ms_var(--ease-premium)] items-center gap-3 rounded-lg bg-canvas px-4 py-3">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-income/10 text-income"
      >
        <CheckIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">
          You&apos;re on track this month.
        </p>
        <p className="text-sm text-muted">
          Nothing needs your attention right now — keep going.
        </p>
      </div>
    </div>
  );

  const readyToPlan = (
    <div className="flex animate-[list-in_200ms_var(--ease-premium)] items-center gap-3 rounded-lg bg-canvas px-4 py-3">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400"
      >
        <SparklesIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">
          Ready to plan {monthLabel}?
        </p>
        <p className="text-sm text-muted">
          Set your monthly income and you&apos;ll get recommendations here.
        </p>
      </div>
    </div>
  );

  const list = (limit?: number) =>
    hasActions ? (
      <InsightList month={month} actionsOnly limit={limit} />
    ) : (
      (hasData ? onTrack : readyToPlan)
    );

  return (
    <Disclosure
      id={`recommendations:${month}`}
      title="Recommendations"
      preview={() => list(1)}
    >
      {list()}
    </Disclosure>
  );
}
