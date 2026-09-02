"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CheckIcon } from "@/components/ui/icons";
import { todayIso } from "@/lib/date";
import { categoryDisplay } from "@/lib/categoryRegistry";
import {
  announceQuickAddSaved,
  closeQuickAddWindow,
} from "@/lib/desktopFeatures";
import {
  currencySymbol,
  formatMoney,
  isMinorUnitsValid,
  toMinorUnits,
} from "@/lib/money";
import type { TransactionInput } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

/**
 * Tray quick-add (FR-26 req 2-4).
 *
 * The point of this component is how LITTLE it does. It collects three fields
 * and hands them to `addTransaction` — the same store action the main window's
 * Add Expense flow calls, with the same `TransactionInput` shape. It has no
 * writer of its own, no separate persistence and no categorization logic, so
 * everything downstream of the action (recurring detection, anomaly scoring,
 * learned rules, Planner and Reports totals) sees a row it cannot distinguish
 * from a normally-added one — because it is one (req 3).
 *
 * Deliberately NOT offered here: income, transfers, a date picker. Quick-add is
 * for the expense you just made, and every extra field is a reason to open the
 * main window instead. Anything more involved belongs in the full form.
 */

// How long the confirmation stays up before the window closes itself (req 4).
// Long enough to read, short enough that it never feels stuck.
const CONFIRM_MS = 900;

// Frameless window: this strip is what the user drags.
const DRAG: CSSProperties = { WebkitAppRegion: "drag" } as CSSProperties;
const NO_DRAG: CSSProperties = { WebkitAppRegion: "no-drag" } as CSSProperties;

export function QuickAddPanel() {
  const categories = useAppStore((s) => s.state.categories);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const currency = useAppStore((s) => s.state.settings.currency);

  const [categoryId, setCategoryId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === "expense"),
    [categories],
  );

  // Esc dismisses. A frameless always-on-top window with no title bar needs a
  // keyboard way out, and Esc is what every other dialog in this app uses.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeQuickAddWindow();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (saved === null) return;
    const timer = setTimeout(() => closeQuickAddWindow(), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const amount = toMinorUnits(amountInput);
    if (!isMinorUnitsValid(amount) || amount === 0) {
      setError("Enter an amount greater than 0 with up to 2 decimals.");
      return;
    }
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    const trimmedNote = note.trim();
    const input: TransactionInput = {
      categoryId,
      amount,
      type: "expense",
      // Quick-add is always "just now" — that is the whole reason to reach for
      // the tray instead of the app.
      date: todayIso(),
      note: trimmedNote === "" ? undefined : trimmedNote,
    };
    addTransaction(input);

    // The row is persisted at this point (the storage seam is synchronous).
    // Tell the main window to rehydrate so it reflects the new transaction
    // without a manual refresh (req 5), then confirm and close (req 4).
    void announceQuickAddSaved();
    setSaved(formatMoney(amount, currency));
  };

  if (saved !== null) {
    return (
      <div
        role="status"
        className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center"
        style={DRAG}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-surface text-success-text">
          <CheckIcon className="h-6 w-6" />
        </span>
        <p className="text-base font-semibold tracking-tight text-ink">
          {saved} added
        </p>
        <p className="text-sm text-muted">Closing…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div
        className="flex h-11 shrink-0 items-center justify-between px-4"
        style={DRAG}
      >
        <p className="text-sm font-semibold tracking-tight text-ink">
          Quick add
        </p>
        <button
          type="button"
          onClick={() => closeQuickAddWindow()}
          aria-label="Close quick add"
          style={NO_DRAG}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors duration-150 ease-premium hover:bg-canvas hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none"
        >
          <span aria-hidden="true" className="shrink-0 text-base leading-none">
            ×
          </span>
        </button>
      </div>

      {expenseCategories.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm font-semibold tracking-tight text-ink">
            No expense categories yet
          </p>
          <p className="text-sm leading-relaxed text-muted">
            Open Budget Planner and add a category first — quick add files an
            expense into one of your existing categories.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
        >
          <Input
            label="Amount"
            inputMode="decimal"
            placeholder="0.00"
            autoFocus
            prefix={currencySymbol(currency)}
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            error={error && error.startsWith("Enter") ? error : undefined}
          />
          <Select
            label="Category"
            options={expenseCategories.map((category) => ({
              value: category.id,
              label: `${categoryDisplay(category).icon} ${categoryDisplay(category).name}`,
            }))}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            error={error && error.startsWith("Choose") ? error : undefined}
          />
          <Input
            label="Note (optional)"
            placeholder="What was it for?"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="mt-auto pt-2">
            <Button type="submit" className="w-full">
              Save expense
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
