"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
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
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);

  const suggestions = useMemo(
    () => budgetSuggestions({ month, budgets, transactions, categories, incomePlans }),
    [month, budgets, transactions, categories, incomePlans],
  );

  if (suggestions.length === 0) return null;

  const fmt = (value: number) => formatMoney(value, currency);
  const remainingIncome = suggestions[0]?.remainingIncome ?? 0;
  const totalOverage = suggestions.reduce((sum, s) => sum + s.overspent, 0);
  const allCovered = totalOverage <= remainingIncome;
  const coveredCount = suggestions.filter((s) => s.coveredByRemaining).length;

  return (
    <div className="mb-4 rounded-lg border border-warn/15 bg-warn/[0.04] px-4 py-3">
      <p className="text-sm font-semibold text-ink">
        A few budgets are over their limits
      </p>
      <ul className="mt-2 flex flex-col gap-2 text-sm text-muted">
        {suggestions.map((suggestion) => (
          <li
            key={suggestion.budget.id}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <div className="min-w-0 flex-1">
              <p>
                <span aria-hidden="true">{suggestion.category?.icon ?? ""}</span>{" "}
                <span className="font-medium text-ink">
                  {suggestion.category?.name ?? "Category"}
                </span>{" "}
                — raise the limit to {fmt(suggestion.suggestedLimit)} to cover
                what you&apos;ve spent.
              </p>
              {suggestion.trim && (
                <p className="mt-0.5 text-xs">
                  Trim{" "}
                  <span className="font-medium text-ink">
                    {suggestion.trim.category?.name ?? "a category"}
                  </span>{" "}
                  — it still has {fmt(suggestion.trim.remaining)} left.
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => onAdjust(suggestion.budget)}
            >
              Adjust
            </Button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        {allCovered
          ? "Your remaining income covers these overages."
          : coveredCount === 0
            ? "Your remaining income won't cover these overages yet."
            : "Your remaining income covers some of these overages."}
      </p>
    </div>
  );
}
