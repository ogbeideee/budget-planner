"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import {
  formatMoney,
  isMinorUnitsValid,
  minorToInput,
  toMinorUnits,
} from "@/lib/money";
import type { CategoryKind, RecurrenceFrequency, RecurrenceRule } from "@/lib/types";
import { MAX_NOTE_LENGTH } from "@/lib/validate";
import { useAppStore } from "@/store/useAppStore";

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export interface RecurrenceFormProps {
  open: boolean;
  onClose: () => void;
  rule?: RecurrenceRule | null;
}

export function RecurrenceForm({ open, onClose, rule }: RecurrenceFormProps) {
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);
  const addRecurrenceRule = useAppStore((s) => s.addRecurrenceRule);
  const updateRecurrenceRule = useAppStore((s) => s.updateRecurrenceRule);

  const [type, setType] = useState<CategoryKind>(rule?.type ?? "expense");
  const [categoryId, setCategoryId] = useState(
    rule?.categoryId ??
      categories.find((category) => category.kind === "expense")?.id ??
      "",
  );
  const [amount, setAmount] = useState(rule ? minorToInput(rule.amount) : "");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(
    rule?.frequency ?? "monthly",
  );
  const [anchorDate, setAnchorDate] = useState(() =>
    (rule?.anchorDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
  );
  const [note, setNote] = useState(rule?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = useMemo(
    () =>
      categories
        .filter((category) => category.kind === type)
        .map((category) => ({ value: category.id, label: category.name })),
    [categories, type],
  );

  const amountMinor = toMinorUnits(amount);

  const handleSubmit = () => {
    const minor = toMinorUnits(amount);
    if (!isMinorUnitsValid(minor)) {
      setError("Enter a valid amount, e.g. 25.00.");
      return;
    }
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    if (!anchorDate) {
      setError("Pick an anchor date.");
      return;
    }
    const input = {
      categoryId,
      amount: minor,
      type,
      frequency,
      anchorDate,
      note: note.trim() || undefined,
    };
    if (rule) updateRecurrenceRule(rule.id, input);
    else addRecurrenceRule(input);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={rule ? "Edit recurring" : "New recurring"}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">Type</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={type === "expense"}
              onClick={() => {
                setType("expense");
                setCategoryId(
                  categories.find((category) => category.kind === "expense")?.id ?? "",
                );
              }}
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                type === "expense"
                  ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                  : "border-border text-muted hover:bg-canvas"
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              aria-pressed={type === "income"}
              onClick={() => {
                setType("income");
                setCategoryId(
                  categories.find((category) => category.kind === "income")?.id ?? "",
                );
              }}
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                type === "income"
                  ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                  : "border-border text-muted hover:bg-canvas"
              }`}
            >
              Income
            </button>
          </div>
        </fieldset>

        <Select
          label="Category"
          value={categoryId}
          options={categoryOptions}
          error={error && error.startsWith("Choose") ? error : undefined}
          onChange={(event) => setCategoryId(event.target.value)}
        />

        <Input
          label="Amount"
          type="text"
          inputMode="decimal"
          value={amount}
          placeholder="0.00"
          aria-valuetext={isMinorUnitsValid(amountMinor) ? formatMoney(amountMinor, currency) : undefined}
          onChange={(event) => setAmount(event.target.value)}
          error={error && !error.startsWith("Choose") && !error.startsWith("Pick") ? error : undefined}
        />
        {isMinorUnitsValid(amountMinor) && (
          <p className="-mt-2 text-sm text-muted">
            Preview: {formatMoney(amountMinor, currency)}
          </p>
        )}

        <Select
          label="Frequency"
          value={frequency}
          options={FREQUENCY_OPTIONS}
          onChange={(event) => setFrequency(event.target.value as RecurrenceFrequency)}
        />

        <Input
          label="Anchor date"
          type="date"
          value={anchorDate}
          onChange={(event) => setAnchorDate(event.target.value)}
          error={error?.startsWith("Pick") ? error : undefined}
        />

        <Input
          label="Note (optional)"
          type="text"
          maxLength={MAX_NOTE_LENGTH}
          value={note}
          placeholder="e.g. Salary"
          onChange={(event) => setNote(event.target.value)}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {rule ? "Save changes" : "Add recurring"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
