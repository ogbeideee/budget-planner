"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconValue } from "@/components/ui/IconValue";
import {
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { useToast } from "@/hooks/useToast";
import { useAppStore } from "@/store/useAppStore";
import { CategoryModal } from "./CategoryModal";
import type { Category, CategoryKind } from "@/lib/types";

function CategoryList({
  title,
  kind,
  categories,
  transactions,
  onCreate,
  onEdit,
  onDelete,
}: {
  title: string;
  kind: CategoryKind;
  categories: Category[];
  transactions: { categoryId: string }[];
  onCreate: (kind: CategoryKind) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return categories;
    const query = search.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.icon.toLowerCase().includes(query),
    );
  }, [categories, search]);

  const countFor = (id: string) =>
    transactions.filter((t) => t.categoryId === id).length;

  return (
    <Card title={title}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          placeholder="Filter categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full min-w-0 flex-1 rounded-xl border border-border/80 bg-surface px-3.5 text-sm text-ink transition-colors placeholder:text-muted/50 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        <Button
          size="sm"
          icon={<PlusIcon className="h-4 w-4" />}
          onClick={() => onCreate(kind)}
        >
          New
        </Button>
      </div>

      <ul className="flex flex-col gap-1">
        {filtered.map((category) => {
          const count = countFor(category.id);
          return (
            <li
              key={category.id}
              className="group flex items-center justify-between gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-canvas/60"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{
                    backgroundColor: `${category.color}1f`,
                    color: category.color,
                  }}
                >
                  <IconValue value={category.icon} className="h-5 w-5 text-lg" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {category.name}
                  </p>
                  <p className="text-xs text-muted">
                    {count === 0
                      ? "No transactions yet"
                      : `${count} ${count === 1 ? "transaction" : "transactions"}`}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <button
                  type="button"
                  aria-label={`Edit ${category.name}`}
                  onClick={() => onEdit(category)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${category.name}`}
                  onClick={() => onDelete(category)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger focus-visible:ring-2 focus-visible:ring-danger"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted">
          {search
            ? "No categories match your filter."
            : `No ${kind} categories yet. Create one to start budgeting.`}
        </div>
      )}
    </Card>
  );
}

export function CategoryManager() {
  const categories = useAppStore((s) => s.state.categories);
  const transactions = useAppStore((s) => s.state.transactions);
  const deleteCategory = useAppStore((s) => s.deleteCategory);
  const { success, error } = useToast();

  const [creating, setCreating] = useState<CategoryKind | null>(null);
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

  const requestDelete = (category: Category) => {
    setEditing(null);
    setCreating(null);
    setPendingDelete(category);
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    const result = deleteCategory(pendingDelete.id);
    const reasons: Array<[string, string]> = [
      ["in-use-transactions", "used by transactions"],
      ["in-use-budgets", "used by active budgets"],
      ["in-use-future-expenses", "used by upcoming expenses"],
      ["in-use-rules", "used by recurring rules"],
    ];
    const blocked = reasons.find(([reason]) => result.reason === reason);
    if (blocked) {
      error(`Cannot delete — this category is ${blocked[1]}`);
      setPendingDelete(null);
      return;
    }
    success("Category deleted.");
    setPendingDelete(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <CategoryList
          title="Expense categories"
          kind="expense"
          categories={expenseCats}
          transactions={transactions}
          onCreate={setCreating}
          onEdit={setEditing}
          onDelete={setPendingDelete}
        />
        <CategoryList
          title="Income categories"
          kind="income"
          categories={incomeCats}
          transactions={transactions}
          onCreate={setCreating}
          onEdit={setEditing}
          onDelete={setPendingDelete}
        />
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

      {creating !== null && (
        <CategoryModal onClose={() => setCreating(null)} />
      )}
      {editing && (
        <CategoryModal
          category={editing}
          onClose={() => setEditing(null)}
          onRequestDelete={requestDelete}
        />
      )}
    </div>
  );
}
