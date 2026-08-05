"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { todayIso } from "@/lib/date";
import { formatMonthLabel } from "@/lib/date";
import { formatMoney, isMinorUnitsValid, toMinorUnits } from "@/lib/money";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/hooks/useToast";

export function QuickAddExpense({ month }: { month: Month }) {
  const categories = useAppStore((s) => s.state.categories);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const currency = useAppStore((s) => s.state.settings.currency);
  const { success } = useToast();

  const [categoryId, setCategoryId] = useState(
    categories.find((category) => category.kind === "expense")?.id ?? "",
  );
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const expenseCategories = categories.filter(
    (category) => category.kind === "expense",
  );

  const preview = isMinorUnitsValid(toMinorUnits(amount, currency))
    ? formatMoney(toMinorUnits(amount, currency), currency)
    : null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const minor = toMinorUnits(amount, currency);
    if (!isMinorUnitsValid(minor) || minor === 0) {
      setError("Enter an amount greater than 0 with up to 2 decimals.");
      return;
    }
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    addTransaction({ categoryId, amount: minor, type: "expense", date, note: note.trim() || undefined });
    success("Expense added.");
    setAmount("");
    setNote("");
  };

  if (expenseCategories.length === 0) {
    return (
      <p className="text-sm text-muted">
        Quick add needs an expense category — create one in Settings and
        it&apos;ll show up here.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            label="Date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <Input
            label="Note (optional)"
            type="text"
            maxLength={200}
            placeholder="What was this for?"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <div>
          <Button type="submit">Add expense</Button>
        </div>
        <p className="text-xs text-muted">
          Records dated in {formatMonthLabel(month)} count toward this
          month&apos;s budgets.
        </p>
      </form>
  );
}
