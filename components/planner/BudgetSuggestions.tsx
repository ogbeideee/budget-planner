"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import { budgetSuggestions } from "@/lib/recommendations";
import type { Budget, Month } from "@/lib/types";
import { categoryLabelOr } from "@/lib/categoryDisplay";
import { categoryDisplay } from "@/lib/categoryRegistry";
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

  return (
    <div className="rounded-xl border border-warn/15 bg-warn/[0.06] px-5 py-4">
      <p className="text-sm font-semibold tracking-tight text-ink">
        A few budgets are over their limits
      </p>
      <ul className="mt-2 flex flex-col gap-0.5">
        {suggestions.map((suggestion) => {
          const name = categoryLabelOr(suggestion.category?.name, "Category");
          return (
            <li key={suggestion.budget.id}>
              <button
                type="button"
                onClick={() => onAdjust(suggestion.budget)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 ease-premium hover:bg-surface focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs ${
                    suggestion.category
                      ? categoryDisplay(suggestion.category).chip
                      : "bg-canvas text-muted"
                  }`}
                >
                  {categoryDisplay(suggestion.category).icon}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted">
                  <span className="font-semibold text-ink">{name}</span> →{" "}
                  {suggestion.coveredByRemaining
                    ? `increase limit by ${fmt(suggestion.overspent)} or reduce spending`
                    : `reduce spending by ${fmt(suggestion.overspent)} to stay within limit`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 border-t border-warn/10 pt-2.5">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-caption font-semibold text-brand-600 transition-colors duration-150 ease-premium hover:text-brand-700"
        >
          View recommendations
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}