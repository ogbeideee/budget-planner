"use client";

import { useMemo, useState } from "react";
import { checkAnomaly } from "@/lib/anomalies";
import { categoryDisplay } from "@/lib/categoryRegistry";
import type { ID } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

/**
 * FR-25 anomaly note — soft, informational, non-blocking.
 *
 * Rendered beside a new entry's amount once the user has picked a category
 * and typed a parseable amount. When the amount clears the category's
 * documented anomaly threshold (lib/anomalies.ts) it shows ONE dismissible
 * sentence and nothing more: no dialog, no validation error, no change to
 * how submission works. Dismissing hides the note for that exact
 * (category, amount) pair — editing the amount re-evaluates naturally.
 */
export function AnomalyNote({
  categoryId,
  amountMinor,
}: {
  categoryId: ID | "";
  amountMinor: number;
}) {
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const verdict = useMemo(
    () =>
      Number.isInteger(amountMinor) && amountMinor > 0 && categoryId !== ""
        ? checkAnomaly(transactions, {
            categoryId,
            amount: amountMinor,
          })
        : null,
    [transactions, categoryId, amountMinor],
  );

  const category =
    categoryId === ""
      ? undefined
      : categories.find((candidate) => candidate.id === categoryId);
  if (!category || !verdict?.flagged) return null;

  const key = `${categoryId}:${amountMinor}`;
  if (dismissedKey === key) return null;

  return (
    <div
      role="note"
      data-testid="anomaly-note"
      className="flex items-start justify-between gap-3 rounded-md border border-border/70 bg-canvas px-3 py-2 text-xs text-muted sm:col-span-2"
    >
      <span>
        This is notably higher than your usual{" "}
        {categoryDisplay(category).name} spending — just flagging in case of a
        typo.
      </span>
      <button
        type="button"
        onClick={() => setDismissedKey(key)}
        className="shrink-0 font-semibold text-ink hover:underline"
      >
        Dismiss
      </button>
    </div>
  );
}
