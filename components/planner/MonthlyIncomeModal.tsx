"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatMonthLabel, monthKeyFromIso } from "@/lib/date";
import {
  formatMoney,
  isMinorUnitsValid,
  minorToInput,
  toMinorUnits,
} from "@/lib/money";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/hooks/useToast";

function MonthlyIncomeForm({
  month,
  onSaved,
  onCancel,
}: {
  month: Month;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const transactions = useAppStore((s) => s.state.transactions);
  const currency = useAppStore((s) => s.state.settings.currency);
  const setMonthlyIncome = useAppStore((s) => s.setMonthlyIncome);
  const { success } = useToast();

  const current = transactions.find(
    (transaction) =>
      transaction.monthlyIncome === true &&
      transaction.type === "income" &&
      monthKeyFromIso(transaction.date) === month,
  );

  const [amount, setAmount] = useState(
    current ? minorToInput(current.amount) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const preview = isMinorUnitsValid(toMinorUnits(amount, currency))
    ? formatMoney(toMinorUnits(amount, currency), currency)
    : null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const minor = toMinorUnits(amount, currency);
    if (!isMinorUnitsValid(minor)) {
      setError("Enter an amount with up to 2 decimals.");
      return;
    }
    setMonthlyIncome(month, minor);
    success("Monthly income saved.");
    onSaved();
  };

  return (
    <form
      id="monthly-income-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-muted">
        Income for {formatMonthLabel(month)}. This is recorded as an income
        entry and flows into Net, Remaining, budgets and reports.
      </p>
      <Input
        label="Amount"
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        error={error ?? undefined}
      />
      {preview && <p className="-mt-2 text-sm text-muted">Preview: {preview}</p>}
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}

export function MonthlyIncomeModal({
  month,
  open,
  onClose,
}: {
  month: Month;
  open: boolean;
  onClose: () => void;
}) {
  const categories = useAppStore((s) => s.state.categories);
  const incomeCategories = categories.filter(
    (category) => category.kind === "income",
  );

  return (
    <Modal open={open} onClose={onClose} title="Monthly Income">
      {incomeCategories.length === 0 ? (
        <p className="text-sm text-muted">
          Add an income category in Settings to set monthly income.
        </p>
      ) : (
        <MonthlyIncomeForm
          month={month}
          onSaved={onClose}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}
