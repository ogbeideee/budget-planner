"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { categoryDisplay } from "@/lib/categoryRegistry";
import {
  daysInMonth,
  formatDateShort,
  isIsoDate,
  monthKeyFromIso,
  parseMonth,
  todayIso,
} from "@/lib/date";
import { formatMoney } from "@/lib/money";
import {
  detectRecurringPatterns,
  isPatternDue,
  patternsDueBetween,
} from "@/lib/recurringPatterns";
import type { Month, TransactionPrefill } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

const CADENCE_LABEL: Record<string, string> = {
  weekly: "every week",
  biweekly: "every 2 weeks",
  monthly: "monthly",
  yearly: "yearly",
};

function monthBounds(month: Month): { start: string; end: string } {
  const { year, monthIndex } = parseMonth(month);
  return {
    start: `${month}-01`,
    end: `${month}-${String(daysInMonth(year, monthIndex)).padStart(2, "0")}`,
  };
}

/**
 * FR-25 Planner quick-add suggestions.
 *
 * Renders ONLY when at least one detected recurring pattern projects its
 * next occurrence inside the viewed planner month — otherwise the section
 * does not exist on the page at all. Each row shows the expected amount and
 * the projected date ("due soon" when that date falls within the due window
 * relative to today), and its Add action hands a full prefill to the parent,
 * which opens the ordinary TransactionForm — nothing is ever saved here.
 */
export function RecurringSuggestions({
  month,
  onQuickAdd,
}: {
  month: Month;
  onQuickAdd: (prefill: TransactionPrefill) => void;
}) {
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);

  const dueInMonth = useMemo(() => {
    if (!isIsoDate(`${month}-01`)) return [];
    const { start, end } = monthBounds(month);
    return patternsDueBetween(detectRecurringPatterns(transactions), start, end);
  }, [transactions, month]);

  if (dueInMonth.length === 0) return null;

  const today = todayIso();
  const currentMonth = monthKeyFromIso(today);

  return (
    <Card title="Recurring payments" subtitle="Spotted in your history — one tap to add the next one.">
      <ul className="flex flex-col gap-3">
        {dueInMonth.map((pattern) => {
          const display = categoryDisplay(
            categories.find((category) => category.id === pattern.categoryId),
            "Category",
          );
          const dueSoon =
            pattern.nextExpectedDate.startsWith(currentMonth) &&
            isPatternDue(pattern, today);
          const dueLabel = dueSoon
            ? "Due soon"
            : formatDateShort(pattern.nextExpectedDate);
          return (
            <li
              key={pattern.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span aria-hidden="true">{display.icon}</span>
                  {display.name}
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted">
                    {CADENCE_LABEL[pattern.cadence] ?? pattern.cadence}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Usually{" "}
                  <span className="tabular-nums font-semibold text-ink">
                    {formatMoney(pattern.expectedAmount, currency)}
                  </span>{" "}
                  · next expected {formatDateShort(pattern.nextExpectedDate)}
                  {dueSoon && (
                    <span className="ml-1 font-semibold text-brand-600 dark:text-brand-400">
                      ({dueLabel})
                    </span>
                  )}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  onQuickAdd({
                    categoryId: pattern.categoryId,
                    amountMinor: pattern.expectedAmount,
                    date: pattern.nextExpectedDate,
                    note: pattern.lastNote,
                  })
                }
              >
                Add
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
