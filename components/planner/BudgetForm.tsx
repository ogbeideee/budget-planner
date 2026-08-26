"use client";

import { useId, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { formatMoney, isMinorUnitsValid, minorToInput, toMinorUnits } from "@/lib/money";
import type { Budget, Month, Priority } from "@/lib/types";
import { categoryDisplay } from "@/lib/categoryRegistry";
import { useAppStore } from "@/store/useAppStore";

export interface BudgetFormProps {
  open: boolean;
  onClose: () => void;
  month: Month;
  budget?: Budget | null;
  presetCategoryId?: string;
  presetLimit?: number;
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function BudgetForm({
  open,
  onClose,
  month,
  budget,
  presetCategoryId,
  presetLimit,
}: BudgetFormProps) {
  const categories = useAppStore((s) => s.state.categories);
  const budgets = useAppStore((s) => s.state.budgets);
  const addBudget = useAppStore((s) => s.addBudget);
  const updateBudget = useAppStore((s) => s.updateBudget);
  const setCategoryRollover = useAppStore((s) => s.setCategoryRollover);
  const currency = useAppStore((s) => s.state.settings.currency);

  const [categoryId, setCategoryId] = useState(
    budget?.categoryId ?? presetCategoryId ?? "",
  );
  const [limitInput, setLimitInput] = useState(
    budget
      ? minorToInput(budget.limit)
      : presetLimit !== undefined
        ? minorToInput(presetLimit)
        : "",
  );
  const [priority, setPriority] = useState<Priority>(budget?.priority ?? "medium");
  // Rollover is a property of the CATEGORY, not of this month's budget, so
  // the preference survives into months whose budget does not exist yet.
  // Seeded from the selected category and off whenever none is chosen.
  const [rollover, setRollover] = useState(
    () =>
      categories.find((c) => c.id === (budget?.categoryId ?? presetCategoryId))
        ?.rollover === true,
  );
  const [error, setError] = useState<string | null>(null);

  const formId = useId();
  const formMonth = budget?.month ?? month;

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === "expense"),
    [categories],
  );
  const available = useMemo(
    () =>
      expenseCategories.filter(
        (category) =>
          !budgets.some(
            (b) =>
              b.categoryId === category.id &&
              b.month === formMonth &&
              b.id !== budget?.id,
          ),
      ),
    [expenseCategories, budgets, formMonth, budget],
  );

  const preview = isMinorUnitsValid(toMinorUnits(limitInput))
    ? formatMoney(toMinorUnits(limitInput), currency)
    : null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    const amount = toMinorUnits(limitInput);
    if (!isMinorUnitsValid(amount)) {
      setError("Enter a valid amount with up to 2 decimals.");
      return;
    }
    if (budget) {
      updateBudget(budget.id, { categoryId, limit: amount, priority });
      setCategoryRollover(categoryId, rollover);
      onClose();
      return;
    }
    const ok = addBudget({ categoryId, month: formMonth, limit: amount, priority });
    if (!ok) {
      setError("A budget already exists for this category and month.");
      return;
    }
    setCategoryRollover(categoryId, rollover);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={budget ? "Edit budget" : "New budget"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId}>
            {budget ? "Save changes" : "Add budget"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label="Category"
          options={available.map((category) => ({
            value: category.id,
            label: `${categoryDisplay(category).icon} ${categoryDisplay(category).name}`,
          }))}
          value={categoryId}
          onChange={(event) => {
            const next = event.target.value;
            setCategoryId(next);
            setRollover(
              categories.find((c) => c.id === next)?.rollover === true,
            );
            if (error?.startsWith("Choose")) setError(null);
          }}
          error={error?.startsWith("Choose") ? error : undefined}
        />
        <Input
          label="Month"
          type="month"
          value={formMonth}
          readOnly
          className="[&>input]:bg-canvas"
        />
        <div className="flex flex-col gap-1.5">
          <Input
            label="Limit"
            inputMode="decimal"
            placeholder="0.00"
            value={limitInput}
            onChange={(event) => {
              const next = event.target.value;
              setLimitInput(next);
              if (
                error &&
                !error.startsWith("Choose") &&
                isMinorUnitsValid(toMinorUnits(next))
              ) {
                setError(null);
              }
            }}
            error={
              error && !error.startsWith("Choose") ? error : undefined
            }
          />
          {preview && <p className="text-xs text-muted">Preview: {preview}</p>}
        </div>
        <Select
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={priority}
          onChange={(event) => setPriority(event.target.value as Priority)}
        />
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-canvas px-3 py-2.5">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">
              Roll over unused funds
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Anything left at month end is added to next month&rsquo;s limit,
              up to one extra month&rsquo;s worth. Going over rolls nothing
              forward &mdash; next month still starts at its full limit.
            </span>
          </span>
          <Switch
            checked={rollover}
            onChange={setRollover}
            label="Roll over unused funds"
          />
        </div>
      </form>
    </Modal>
  );
}
