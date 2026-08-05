"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconPicker } from "@/components/ui/IconPicker";
import {
  PencilIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { useToast } from "@/hooks/useToast";
import { useAppStore } from "@/store/useAppStore";
import { MAX_CATEGORY_NAME } from "@/lib/validate";
import { DEFAULT_ICON } from "./iconLibrary";
import { CategoryEditModal } from "./CategoryEditModal";
import type { Category } from "@/lib/types";

export const CATEGORY_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Lime", value: "#84cc16" },
  { name: "Amber", value: "#fbbf24" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Gray", value: "#6b7280" },
] as const;

export function CategoryManager() {
  const categories = useAppStore((s) => s.state.categories);
  const addCategory = useAppStore((s) => s.addCategory);
  const deleteCategory = useAppStore((s) => s.deleteCategory);
  const { success, error } = useToast();

  const [editing, setEditing] = useState<Category | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const expenseCats = useMemo(
    () => categories.filter((c) => c.kind === "expense"),
    [categories],
  );

  const incomeCats = useMemo(
    () => categories.filter((c) => c.kind === "income"),
    [categories],
  );

  const [expenseSearch, setExpenseSearch] = useState("");
  const [incomeSearch, setIncomeSearch] = useState("");

  const filteredExpenseCats = useMemo(() => {
    if (!expenseSearch) return expenseCats;
    const search = expenseSearch.toLowerCase();
    return expenseCats.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.icon.toLowerCase().includes(search),
    );
  }, [expenseCats, expenseSearch]);

  const filteredIncomeCats = useMemo(() => {
    if (!incomeSearch) return incomeCats;
    const search = incomeSearch.toLowerCase();
    return incomeCats.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.icon.toLowerCase().includes(search),
    );
  }, [incomeCats, incomeSearch]);

  const [newExpenseName, setNewExpenseName] = useState("");
  const [newExpenseIcon, setNewExpenseIcon] = useState(DEFAULT_ICON);
  const [newExpenseColor, setNewExpenseColor] = useState("#ef4444");

  const [newIncomeName, setNewIncomeName] = useState("");
  const [newIncomeIcon, setNewIncomeIcon] = useState(DEFAULT_ICON);
  const [newIncomeColor, setNewIncomeColor] = useState("#0ea5e9");

  const resetForm = () => {
    setNewExpenseName("");
    setNewExpenseIcon(DEFAULT_ICON);
    setNewExpenseColor("#ef4444");
  };

  const resetIncomeForm = () => {
    setNewIncomeName("");
    setNewIncomeIcon(DEFAULT_ICON);
    setNewIncomeColor("#0ea5e9");
  };

  const handleAddExpense = () => {
    const name = newExpenseName.trim();
    if (!name) {
      error("Expense category name is required");
      return;
    }
    if (!newExpenseIcon.trim()) {
      error("Expense category icon is required");
      return;
    }
    if (
      categories.some(
        (category) => category.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      error(`A category named "${name}" already exists`);
      return;
    }
    const added = addCategory({
      name,
      icon: newExpenseIcon,
      color: newExpenseColor,
      kind: "expense",
    });
    if (!added) {
      error("Could not add this category.");
      return;
    }
    resetForm();
    success("Expense category added.");
  };

  const handleAddIncome = () => {
    const name = newIncomeName.trim();
    if (!name) {
      error("Income category name is required");
      return;
    }
    if (!newIncomeIcon.trim()) {
      error("Income category icon is required");
      return;
    }
    if (
      categories.some(
        (category) => category.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      error(`A category named "${name}" already exists`);
      return;
    }
    const added = addCategory({
      name,
      icon: newIncomeIcon,
      color: newIncomeColor,
      kind: "income",
    });
    if (!added) {
      error("Could not add this category.");
      return;
    }
    resetIncomeForm();
    success("Income category added.");
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    const result = deleteCategory(pendingDelete.id);
    if (result.reason === "in-use-transactions") {
      error("Cannot delete — this category is used by transactions");
      setPendingDelete(null);
      return;
    }
    if (result.reason === "in-use-budgets") {
      error("Cannot delete — this category is used by active budgets");
      setPendingDelete(null);
      return;
    }
    if (result.reason === "in-use-future-expenses") {
      error("Cannot delete — this category is used by upcoming expenses");
      setPendingDelete(null);
      return;
    }
    if (result.reason === "in-use-rules") {
      error("Cannot delete — this category is used by recurring rules");
      setPendingDelete(null);
      return;
    }
    success("Category deleted.");
    setPendingDelete(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <Card title="Expense categories" className="scroll-mt-36 lg:scroll-mt-24">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <input
              type="text"
              placeholder="Filter categories..."
              value={expenseSearch}
              onChange={(e) => setExpenseSearch(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <ul className="flex flex-col gap-2">
            {filteredExpenseCats.map((category) => (
              <li
                key={category.id}
                className="group flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface px-3 py-2.5 transition-colors hover:bg-canvas/60"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base font-semibold"
                    style={{ backgroundColor: `${category.color}1f`, color: category.color }}
                  >
                    {category.icon}
                  </span>
                  <span className="min-w-0 text-sm font-medium text-ink truncate">
                    {category.name}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button
                    type="button"
                    aria-label={`Edit ${category.name}`}
                    onClick={() => setEditing(category)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${category.name}`}
                    onClick={() => setPendingDelete(category)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger/10 hover:text-danger focus-visible:ring-2 focus-visible:ring-danger"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border/60 pt-4">
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-ink mb-1.5">Name</label>
              <input
                type="text"
                value={newExpenseName}
                onChange={(e) => setNewExpenseName(e.target.value)}
                placeholder="e.g., Groceries"
                maxLength={MAX_CATEGORY_NAME}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <IconPicker
                label="Icon"
                value={newExpenseIcon}
                onChange={setNewExpenseIcon}
                className="w-full sm:w-40"
                vectors={false}
              />
            <div className="w-28">
              <Select
                label="Color"
                value={newExpenseColor}
                options={CATEGORY_COLORS.map((color) => ({ value: color.value, label: color.name }))}
                onChange={(e) => setNewExpenseColor(e.target.value)}
              />
            </div>
            <Button onClick={handleAddExpense} size="sm">
              Add
            </Button>
          </div>

          {filteredExpenseCats.length === 0 && (
            <div className="mt-4 text-sm text-muted">
              No expense categories match your filter.
            </div>
          )}
        </Card>

        <Card title="Income categories" className="scroll-mt-36 lg:scroll-mt-24">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <input
              type="text"
              placeholder="Filter categories..."
              value={incomeSearch}
              onChange={(e) => setIncomeSearch(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <ul className="flex flex-col gap-2">
            {filteredIncomeCats.map((category) => (
              <li
                key={category.id}
                className="group flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface px-3 py-2.5 transition-colors hover:bg-canvas/60"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base font-semibold"
                    style={{ backgroundColor: `${category.color}1f`, color: category.color }}
                  >
                    {category.icon}
                  </span>
                  <span className="min-w-0 text-sm font-medium text-ink truncate">
                    {category.name}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button
                    type="button"
                    aria-label={`Edit ${category.name}`}
                    onClick={() => setEditing(category)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${category.name}`}
                    onClick={() => setPendingDelete(category)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger/10 hover:text-danger focus-visible:ring-2 focus-visible:ring-danger"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border/60 pt-4">
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-ink mb-1.5">Name</label>
              <input
                type="text"
                value={newIncomeName}
                onChange={(e) => setNewIncomeName(e.target.value)}
                placeholder="e.g., Salary"
                maxLength={MAX_CATEGORY_NAME}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <IconPicker
                label="Icon"
                value={newIncomeIcon}
                onChange={setNewIncomeIcon}
                className="w-full sm:w-40"
                vectors={false}
              />
            <div className="w-28">
              <Select
                label="Color"
                value={newIncomeColor}
                options={CATEGORY_COLORS.map((color) => ({ value: color.value, label: color.name }))}
                onChange={(e) => setNewIncomeColor(e.target.value)}
              />
            </div>
            <Button onClick={handleAddIncome} size="sm">
              Add
            </Button>
          </div>

          {filteredIncomeCats.length === 0 && (
            <div className="mt-4 text-sm text-muted">
              No income categories match your filter.
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete category"
        message={
          pendingDelete
            ? `Deleting "${pendingDelete.name}" will affect all budgets, transactions, upcoming expenses, recurring rules, and income plans that use it. Are you sure?`
            : ""
        }
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onClose={() => setPendingDelete(null)}
      />

      {editing && (
        <CategoryEditModal
          category={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
