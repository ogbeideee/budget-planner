"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SparklesIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import { budgetSuggestions } from "@/lib/recommendations";
import type { Budget, Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export interface BudgetSuggestionsProps {
  month: Month;
  onAdjust: (budget: Budget) => void;
}

export function BudgetSuggestions({ month, onAdjust }: BudgetSuggestionsProps) {
  const budgets = useAppStore((s) => s.state.budgets);
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);

  const suggestions = useMemo(
    () => budgetSuggestions({ month, budgets, transactions, categories }),
    [month, budgets, transactions, categories],
  );

  if (suggestions.length === 0) return null;

  const fmt = (value: number) => formatMoney(value, currency);

  return (
    <Card
      title="Ways to get back on track"
      action={
        <SparklesIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
      }
    >
      <ul className="flex flex-col divide-y divide-border/70">
        {suggestions.map((suggestion) => (
          <li key={suggestion.budget.id} className="py-3.5 first:pt-0 last:pb-0">
            <p className="text-sm font-semibold text-ink">
              <span aria-hidden="true">{suggestion.category?.icon ?? ""}</span>{" "}
              {suggestion.category?.name ?? "Category"}
            </p>
            <ul className="mt-2 flex flex-col gap-2 text-sm text-muted">
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Raise the limit to {fmt(suggestion.suggestedLimit)} to cover
                  what you&apos;ve spent.
                </span>
                <Button
                  variant="secondary"
                  className="min-h-8 px-3 py-1 text-xs"
                  onClick={() => onAdjust(suggestion.budget)}
                >
                  Adjust
                </Button>
              </li>
              {suggestion.trim && (
                <li className="flex items-center justify-between gap-3">
                  <span>
                    Trim{" "}
                    <strong className="font-semibold text-ink">
                      {suggestion.trim.category?.name ?? "a category"}
                    </strong>{" "}
                    — it still has{" "}
                    <span className="font-semibold tabular-nums text-ink">
                      {fmt(suggestion.trim.remaining)}
                    </span>{" "}
                    left.
                  </span>
                </li>
              )}
              <li>
                Remaining income{" "}
                <span className="font-semibold tabular-nums text-ink">
                  {fmt(suggestion.remainingIncome)}
                </span>{" "}
                {suggestion.coveredByRemaining ? "covers" : "falls short of"}{" "}
                the{" "}
                <span className="font-semibold tabular-nums text-danger">
                  {fmt(suggestion.overspent)}
                </span>{" "}
                overage.
              </li>
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  );
}
