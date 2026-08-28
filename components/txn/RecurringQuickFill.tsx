"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { todayIso } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import {
  detectRecurringPatterns,
  isPatternDue,
} from "@/lib/recurringPatterns";
import type { CategoryKind, TransactionPrefill } from "@/lib/types";
import { categoryDisplay } from "@/lib/categoryRegistry";
import { useAppStore } from "@/store/useAppStore";

/**
 * FR-25 quick-fill hints inside the Add Expense / Add Income flow.
 *
 * While the form is open for a NEW entry, any detected recurring pattern for
 * the active tab's kind whose next expected date falls inside the due window
 * (see `isPatternDue`) renders as one tappable hint:
 * "This looks like your recurring {category} payment of ₦X — add it?".
 *
 * Tapping PRE-FILLS amount, category, description and date into the form's
 * existing draft via `onApply` — it never saves anything. The user confirms
 * or adjusts through the ordinary submit path exactly as before.
 */
export function RecurringQuickFill({
  kind,
  onApply,
}: {
  kind: CategoryKind;
  onApply: (prefill: TransactionPrefill) => void;
}) {
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);

  const suggestions = useMemo(() => {
    const today = todayIso();
    return detectRecurringPatterns(transactions)
      .filter((pattern) => pattern.type === kind && isPatternDue(pattern, today))
      .slice(0, 3);
  }, [transactions, kind]);

  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" data-testid="recurring-quickfill">
      {suggestions.map((pattern) => {
        const display = categoryDisplay(
          categories.find((category) => category.id === pattern.categoryId),
          "Category",
        );
        return (
          <div
            key={pattern.id}
            className="flex items-center justify-between gap-3 rounded-md border border-brand-500/25 bg-brand-500/[0.04] px-3 py-2"
          >
            <p className="text-xs text-muted">
              This looks like your recurring{" "}
              <span className="font-semibold text-ink">{display.name}</span>{" "}
              {pattern.type === "income" ? "income" : "payment"} of{" "}
              <span className="font-semibold tabular-nums text-ink">
                {formatMoney(pattern.expectedAmount, currency)}
              </span>{" "}
              — add it?
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                onApply({
                  categoryId: pattern.categoryId,
                  amountMinor: pattern.expectedAmount,
                  date: pattern.nextExpectedDate,
                  note: pattern.lastNote,
                })
              }
            >
              Fill in
            </Button>
          </div>
        );
      })}
    </div>
  );
}
