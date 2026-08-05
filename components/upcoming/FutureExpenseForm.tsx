"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { CheckIcon, SparklesIcon } from "@/components/ui/icons";
import { useToast } from "@/hooks/useToast";
import { rememberMapping, suggestCategory } from "@/lib/categorize";
import { todayIso } from "@/lib/date";
import { formatMoney, isMinorUnitsValid, minorToInput, toMinorUnits } from "@/lib/money";
import type { FutureExpense, Priority } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export interface FutureExpenseFormProps {
  open: boolean;
  onClose: () => void;
  editing: FutureExpense | null;
}

const PRIORITY_OPTIONS: ReadonlyArray<{ value: Priority; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function FutureExpenseForm({
  open,
  onClose,
  editing,
}: FutureExpenseFormProps) {
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);
  const addFutureExpense = useAppStore((s) => s.addFutureExpense);
  const updateFutureExpense = useAppStore((s) => s.updateFutureExpense);
  const { success } = useToast();

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === "expense"),
    [categories],
  );

  const [title, setTitle] = useState(editing?.title ?? "");
  const [categoryId, setCategoryId] = useState(
    editing?.categoryId ?? expenseCategories[0]?.id ?? "",
  );
  const [amount, setAmount] = useState(
    editing ? minorToInput(editing.amount) : "",
  );
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? todayIso());
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [recurring, setRecurring] = useState(editing?.recurring ?? false);
  const [priority, setPriority] = useState<Priority>(editing?.priority ?? "medium");
  const [error, setError] = useState<string | null>(null);
  const [suggestionAccepted, setSuggestionAccepted] = useState(false);

  const suggestion = useMemo(() => {
    if (title.trim().length === 0) return null;
    return suggestCategory(title, expenseCategories);
  }, [title, expenseCategories]);

  const preview = isMinorUnitsValid(toMinorUnits(amount, currency))
    ? formatMoney(toMinorUnits(amount, currency), currency)
    : null;

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setSuggestionAccepted(false);
    const next = suggestCategory(value, expenseCategories);
    if (next && next.confidence === "high") {
      setCategoryId(next.categoryId);
    }
  };

  const acceptSuggestion = () => {
    if (!suggestion) return;
    setCategoryId(suggestion.categoryId);
    rememberMapping(title, suggestion.categoryId);
    setSuggestionAccepted(true);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (title.trim().length === 0) {
      setError("Give this expense a name.");
      return;
    }
    const minor = toMinorUnits(amount, currency);
    if (!isMinorUnitsValid(minor) || minor === 0) {
      setError("Enter an amount greater than 0 with up to 2 decimals.");
      return;
    }
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    if (!dueDate) {
      setError("Choose a due date.");
      return;
    }
    const input = {
      categoryId,
      amount: minor,
      title: title.trim(),
      dueDate,
      notes: notes.trim() || undefined,
      recurring,
      priority,
    };
    if (editing) {
      updateFutureExpense(editing.id, input);
      rememberMapping(title.trim(), categoryId);
      success("Upcoming expense updated.");
    } else {
      addFutureExpense(input);
      rememberMapping(title.trim(), categoryId);
      success("Upcoming expense added.");
    }
    onClose();
  };

  const suggestionCategory = suggestion
    ? expenseCategories.find((category) => category.id === suggestion.categoryId)
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit upcoming expense" : "Add upcoming expense"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Name"
          type="text"
          maxLength={60}
          placeholder="e.g. Netflix subscription"
          value={title}
          onChange={(event) => handleTitleChange(event.target.value)}
          error={error?.startsWith("Give") ? error : undefined}
        />
        {suggestion && !suggestionAccepted && suggestionCategory && (
          <div className="-mt-2 flex flex-wrap items-center gap-2 rounded-md bg-brand-50 px-3 py-2 text-sm dark:bg-brand-950">
            <SparklesIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <p className="min-w-0 flex-1 text-brand-800 dark:text-brand-200">
              {suggestion.confidence === "high" ? (
                <>
                  Assigned to <strong>{suggestionCategory.name}</strong> based on
                  &ldquo;{suggestion.keyword}&rdquo;.
                </>
              ) : (
                <>
                  This looks like a <strong>{suggestionCategory.name}</strong>{" "}
                  expense.
                </>
              )}
            </p>
            {suggestion.confidence === "low" && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={acceptSuggestion}
              >
                <CheckIcon className="h-3.5 w-3.5" />
                Accept
              </Button>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Category"
            value={categoryId}
            options={expenseCategories.map((category) => ({
              value: category.id,
              label: `${category.icon} ${category.name}`,
            }))}
            onChange={(event) => setCategoryId(event.target.value)}
            error={error?.startsWith("Choose") ? error : undefined}
          />
          <Input
            label="Amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={error?.startsWith("Enter") ? error : undefined}
          />
        </div>
        {preview && (
          <p className="-mt-2 text-sm text-muted">Preview: {preview}</p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Due date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            error={error?.startsWith("Choose a due") ? error : undefined}
          />
          <Select
            label="Priority"
            value={priority}
            options={PRIORITY_OPTIONS.map((option) => ({ ...option }))}
            onChange={(event) => setPriority(event.target.value as Priority)}
          />
        </div>
        <Input
          label="Notes (optional)"
          type="text"
          maxLength={200}
          placeholder="Anything worth remembering?"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(event) => setRecurring(event.target.checked)}
            className="h-4 w-4 rounded accent-brand-600"
          />
          Repeats (e.g. monthly)
        </label>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{editing ? "Save changes" : "Add expense"}</Button>
        </div>
      </form>
    </Modal>
  );
}
