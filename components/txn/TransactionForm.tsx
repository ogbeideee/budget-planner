"use client";

import { useId, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import {
  defaultDateForMonth,
  isIsoDate,
  todayIso,
} from "@/lib/date";
import {
  currencySymbol,
  formatMoney,
  isMinorUnitsValid,
  minorToInput,
  toMinorUnits,
} from "@/lib/money";
import type {
  CategoryKind,
  Month,
  Transaction,
  TransactionInput,
  TransactionPrefill,
} from "@/lib/types";
import { MAX_NOTE_LENGTH } from "@/lib/validate";
import { categoryDisplay } from "@/lib/categoryRegistry";
import { useAppStore } from "@/store/useAppStore";
import { AnomalyNote } from "./AnomalyNote";
import { RecurringQuickFill } from "./RecurringQuickFill";

export interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
  initialType?: CategoryKind;
  /** Planner month the form is opened from; dates default inside its boundaries. */
  defaultMonth?: Month;
  /**
   * FR-25 draft seed for a NEW entry (a detected recurring pattern). Frozen
   * into the draft at mount — callers restart with a keyed remount; the
   * suggestion never auto-saves and every field stays editable.
   */
  initialDraft?: TransactionPrefill | null;
}

type FormKind = "expense" | "transfer" | "income";

const KIND_TABS: { kind: FormKind; label: string }[] = [
  { kind: "expense", label: "Expense" },
  { kind: "transfer", label: "Transfer" },
  { kind: "income", label: "Income" },
];

export function TransactionForm({
  open,
  onClose,
  transaction,
  initialType = "expense",
  defaultMonth,
  initialDraft,
}: TransactionFormProps) {
  const categories = useAppStore((s) => s.state.categories);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const updateTransaction = useAppStore((s) => s.updateTransaction);
  const currency = useAppStore((s) => s.state.settings.currency);

  // Editing freezes the existing record; a new entry freezes `initialDraft`
  // when present. Both are documented lazy-initializer cases.
  const [kind, setKind] = useState<FormKind>(() =>
    transaction
      ? transaction.type === "income"
        ? "income"
        : transaction.deferred === true
          ? "transfer"
          : "expense"
      : initialType === "income"
        ? "income"
        : "expense",
  );
  const [categoryId, setCategoryId] = useState(
    transaction?.categoryId ?? initialDraft?.categoryId ?? "",
  );
  const [amountInput, setAmountInput] = useState(() =>
    transaction
      ? minorToInput(transaction.amount)
      : initialDraft?.amountMinor != null &&
          Number.isInteger(initialDraft.amountMinor) &&
          initialDraft.amountMinor > 0
        ? minorToInput(initialDraft.amountMinor)
        : "",
  );
  const [date, setDate] = useState(
    transaction?.date ??
      (isIsoDate(initialDraft?.date ?? "")
        ? (initialDraft?.date as string)
        : defaultMonth
          ? defaultDateForMonth(defaultMonth)
          : todayIso()),
  );
  const [note, setNote] = useState(
    transaction?.note ?? initialDraft?.note ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  const amountMinor = toMinorUnits(amountInput);

  const kindCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.kind === (kind === "income" ? "income" : "expense"),
      ),
    [categories, kind],
  );
  const preview = isMinorUnitsValid(amountMinor)
    ? formatMoney(amountMinor, currency)
    : null;

  // FR-25 — a tapped suggestion pours its prefill into the existing draft;
  // the user still confirms through the ordinary submit path.
  const applyQuickFill = (draft: TransactionPrefill) => {
    if (draft.categoryId !== undefined) setCategoryId(draft.categoryId);
    if (
      draft.amountMinor != null &&
      Number.isInteger(draft.amountMinor) &&
      draft.amountMinor > 0
    ) {
      setAmountInput(minorToInput(draft.amountMinor));
    }
    if (draft.note !== undefined && draft.note !== "") setNote(draft.note);
    if (draft.date !== undefined) setDate(draft.date);
  };

  const handleKindChange = (next: FormKind) => {
    setKind(next);
    setCategoryId("");
    setError(null);
  };

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
    if (!isIsoDate(date)) {
      setError("Choose a valid date.");
      return;
    }
    const trimmedNote = note.trim();
    const input: TransactionInput = {
      categoryId,
      amount,
      type: kind === "income" ? "income" : "expense",
      date,
      note: trimmedNote === "" ? undefined : trimmedNote,
      deferred: kind === "transfer" ? true : undefined,
    };
    if (transaction) updateTransaction(transaction.id, input);
    else addTransaction(input);
    onClose();
  };

  const submitLabel = transaction
    ? "Save changes"
    : kind === "transfer"
      ? "Add Transfer"
      : kind === "income"
        ? "Add Income"
        : "Add Expense";

  const dialogTitle = transaction
    ? "Edit transaction"
    : kind === "transfer"
      ? "Add Transfer"
      : kind === "income"
        ? "Add Income"
        : "Add Expense";

  const noteId = useId();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={dialogTitle}
      closeButton
      panelClassName="border border-border shadow-card"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="txn-form">
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id="txn-form"
        onSubmit={handleSubmit}
        className="relative flex flex-col gap-4 overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 select-none"
        >
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(14,165,164,0.09),transparent_70%)]" />
          <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.08),transparent_70%)]" />
          <svg
            className="absolute -top-2 right-8 hidden select-none sm:block"
            width="190"
            height="80"
            viewBox="0 0 190 80"
            fill="none"
          >
            <circle
              cx="160"
              cy="16"
              r="20"
              stroke="rgba(14,165,164,0.15)"
              strokeWidth="2"
            />
            <path
              d="M4 72 C 50 68, 74 46, 118 42 C 150 39, 168 24, 186 20"
              stroke="rgba(14,165,164,0.2)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M4 62 C 46 58, 70 36, 112 32"
              stroke="rgba(37,99,235,0.14)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="relative z-10 mt-2 flex flex-col gap-4">
          <div className="flex items-center gap-1 border-b border-border/70">
            {KIND_TABS.map(({ kind: tabKind, label }) => (
              <button
                key={tabKind}
                type="button"
                aria-pressed={kind === tabKind}
                onClick={() => handleKindChange(tabKind)}
                className={`-mb-px border-b-2 px-3 pb-2.5 pt-1 text-sm font-semibold transition-colors duration-150 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none motion-reduce:transition-none ${
                  kind === tabKind
                    ? "border-brand-500 text-ink"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {kind === "transfer" && (
            <p className="text-xs text-muted">
              Transfers record an expense to roll into next month — it shows
              under Transfers on the timeline until you move it.
            </p>
          )}
          {!transaction && kind !== "transfer" && (
            <RecurringQuickFill
              kind={kind === "income" ? "income" : "expense"}
              onApply={applyQuickFill}
            />
          )}
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            <Input
              label="Amount"
              inputMode="decimal"
              placeholder="0.00"
              prefix={currencySymbol(currency)}
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              error={error && error.startsWith("Enter") ? error : undefined}
            />
            <Select
              label="Category"
              options={kindCategories.map((category) => ({
                value: category.id,
                label: `${categoryDisplay(category).icon} ${categoryDisplay(category).name}`,
              }))}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              error={error && error.startsWith("Choose") ? error : undefined}
            />
            <Input
              label="Date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              error={error && error.startsWith("Choose a valid") ? error : undefined}
            />
            <div className="flex items-end pb-1 text-xs text-muted">
              {preview ? `Preview: ${preview}` : "\u00A0"}
            </div>
            {!transaction && kind !== "transfer" && (
              <AnomalyNote categoryId={categoryId} amountMinor={amountMinor} />
            )}
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label
                htmlFor={noteId}
                className="text-label font-semibold text-ink"
              >
                Note (optional)
              </label>
              <div className="relative">
                <textarea
                  id={noteId}
                  rows={3}
                  maxLength={MAX_NOTE_LENGTH}
                  placeholder="Add a note..."
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="min-h-[96px] w-full resize-none rounded-md border border-border bg-surface px-4 pb-7 pt-3 text-input text-ink transition-[border-color,box-shadow] duration-150 ease-premium placeholder:text-muted focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/15 focus:outline-none"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-2 right-4 text-xs tabular-nums text-muted"
                >
                  {note.length}/{MAX_NOTE_LENGTH}
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
