"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { currentMonthKey, todayIso } from "@/lib/date";
import { isMinorUnitsValid, toMinorUnits } from "@/lib/money";
import { effectiveLimit, spent } from "@/lib/selectors";
import { categoryDisplay } from "@/lib/categoryRegistry";
import { MAX_NOTE_LENGTH } from "@/lib/validate";
import type { Category, Currency, RolloverRecord, SavingsPlan, Transaction } from "@/lib/types";
import type { Budget } from "@/lib/types";

export interface ContributionInput {
  categoryId: string;
  amount: number;
  date: string;
  note?: string;
}

export interface SavingsContributionModalProps {
  open: boolean;
  onClose: () => void;
  plan: SavingsPlan;
  currency: Currency;
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  rollovers: RolloverRecord[];
  /** Called with the form values; the caller writes through the ordinary
   *  `addTransaction` path, tagged with the plan id. */
  onSubmit: (input: ContributionInput) => void;
}

/** Log a contribution to a savings plan (FR-28). The write is an ORDINARY
 *  expense transaction tagged `savingsPlanId` — this form never has its own
 *  save path. A category with rollover enabled shows how much carried-over
 *  money is still available this month: contributing against it is how the
 *  user allocates that rollover into the plan. */
export function SavingsContributionModal({
  open,
  onClose,
  plan,
  currency,
  categories,
  transactions,
  budgets,
  rollovers,
  onSubmit,
}: SavingsContributionModalProps) {
  const symbol = currency === "NGN" ? "₦" : "$";
  const expenseCategories = useMemo(
    () =>
      [...categories]
        .filter((category) => category.kind === "expense")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );
  // Default to a category actually named "savings" when one exists — the
  // common home for goal money — otherwise the first expense category.
  const defaultCategoryId = useMemo(() => {
    const savings = expenseCategories.find(
      (category) => category.name.trim().toLowerCase() === "savings",
    );
    return savings?.id ?? expenseCategories[0]?.id ?? "";
  }, [expenseCategories]);

  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [amountInput, setAmountInput] = useState("");
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");

  const amount = toMinorUnits(amountInput);
  const amountError =
    amountInput.trim() === "" || !isMinorUnitsValid(amount) || amount <= 0
      ? "Enter the amount to contribute"
      : undefined;
  const categoryError =
    expenseCategories.length === 0
      ? undefined
      : categoryId === ""
        ? "Choose a category the contribution comes from"
        : undefined;
  const valid = !amountError && !categoryError;

  // Rollover integration (FR-28 + FR-19): the chosen category's spendable
  // envelope this month, and how much of it is carryover. Read-only display —
  // the contribution consumes the envelope through the ordinary budget math;
  // no rollover record is ever written here.
  const rolloverHint = useMemo(() => {
    if (categoryId === "") return null;
    const category = categories.find((entry) => entry.id === categoryId);
    if (!category?.rollover) return null;
    const month = currentMonthKey();
    const budget = budgets.find(
      (entry) => entry.categoryId === categoryId && entry.month === month,
    );
    if (!budget) return null;
    const limit = effectiveLimit(budget, rollovers);
    const available = limit - spent(transactions, categoryId, month);
    return { available, hasCarryover: budget.limit < limit };
  }, [categoryId, categories, budgets, rollovers, transactions]);

  const submit = () => {
    if (!valid) return;
    const trimmedNote = note.trim();
    onSubmit({
      categoryId,
      amount,
      date,
      note:
        trimmedNote !== ""
          ? trimmedNote.slice(0, MAX_NOTE_LENGTH)
          : `Savings contribution — ${plan.name}`.slice(0, MAX_NOTE_LENGTH),
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add contribution — ${plan.name}`}
      closeButton
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid}>
            Log contribution
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Amount"
          prefix={symbol}
          value={amountInput}
          onChange={(event) => setAmountInput(event.target.value)}
          placeholder="0.00"
          inputMode="decimal"
          error={amountError}
        />
        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <Select
          label="From category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          error={categoryError}
          placeholder={
            expenseCategories.length === 0
              ? "No expense categories yet"
              : undefined
          }
          options={expenseCategories.map((category) => ({
            value: category.id,
            label: categoryDisplay(category).name,
          }))}
        />
        {rolloverHint && (
          <p className="rounded-md bg-savings-surface px-3 py-2 text-xs text-savings-text">
            {rolloverHint.hasCarryover
              ? `${categoryDisplay(categories.find((entry) => entry.id === categoryId)!).name} has carryover funds still available this month. Logging the contribution against it moves that rollover money into this plan.`
              : `This category has rollover enabled — unspent funds carry forward, and contributing against this month's envelope allocates them here.`}
          </p>
        )}
        <Input
          label="Note (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={`Savings contribution — ${plan.name}`}
          maxLength={MAX_NOTE_LENGTH}
        />
        <p className="text-xs text-muted">
          Contributions are excluded from expense and income totals in Reports,
          but they still draw down the chosen category&apos;s budget envelope.
        </p>
      </div>
    </Modal>
  );
}
