"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { isIsoDate, todayIso } from "@/lib/date";
import { formatMoney, isMinorUnitsValid, minorToInput, toMinorUnits } from "@/lib/money";
import type { CategoryKind, Transaction, TransactionInput } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
}

export function TransactionForm({
  open,
  onClose,
  transaction,
}: TransactionFormProps) {
  const categories = useAppStore((s) => s.state.categories);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const updateTransaction = useAppStore((s) => s.updateTransaction);
  const currency = useAppStore((s) => s.state.settings.currency);

  const [type, setType] = useState<CategoryKind>(transaction?.type ?? "expense");
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
  const [amountInput, setAmountInput] = useState(
    transaction ? minorToInput(transaction.amount) : "",
  );
  const [date, setDate] = useState(transaction?.date ?? todayIso());
  const [note, setNote] = useState(transaction?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const typeCategories = useMemo(
    () => categories.filter((category) => category.kind === type),
    [categories, type],
  );
  const preview = isMinorUnitsValid(toMinorUnits(amountInput, currency))
    ? formatMoney(toMinorUnits(amountInput, currency), currency)
    : null;

  const handleTypeChange = (next: CategoryKind) => {
    setType(next);
    setCategoryId("");
    setError(null);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const amount = toMinorUnits(amountInput, currency);
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
      type,
      date,
      note: trimmedNote === "" ? undefined : trimmedNote,
    };
    if (transaction) updateTransaction(transaction.id, input);
    else addTransaction(input);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={transaction ? "Edit transaction" : "New transaction"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="txn-form">
            {transaction ? "Save changes" : "Add transaction"}
          </Button>
        </>
      }
    >
      <form id="txn-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={type === "expense" ? "primary" : "secondary"}
            aria-pressed={type === "expense"}
            onClick={() => handleTypeChange("expense")}
          >
            Expense
          </Button>
          <Button
            type="button"
            variant={type === "income" ? "primary" : "secondary"}
            aria-pressed={type === "income"}
            onClick={() => handleTypeChange("income")}
          >
            Income
          </Button>
        </div>
        <Input
          label="Amount"
          inputMode="decimal"
          placeholder="0.00"
          value={amountInput}
          onChange={(event) => setAmountInput(event.target.value)}
          error={error && error.startsWith("Enter") ? error : undefined}
        />
        {preview && <p className="text-xs text-muted">Preview: {preview}</p>}
        <Select
          label="Category"
          options={typeCategories.map((category) => ({
            value: category.id,
            label: `${category.icon} ${category.name}`,
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
        <Input
          label="Note (optional)"
          maxLength={200}
          placeholder="What was this for?"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </form>
    </Modal>
  );
}
