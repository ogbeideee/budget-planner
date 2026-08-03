"use client";

import { memo, useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { PriorityBadge } from "@/components/planner/PriorityBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  CalendarIcon,
  CheckIcon,
  PencilIcon,
  PlusIcon,
  RepeatIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { useToast } from "@/hooks/useToast";
import { categoryAccent } from "@/lib/accents";
import { formatDateShort } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import type { Currency, FutureExpense } from "@/lib/types";
import { groupFutureExpenses, sortedPaidExpenses } from "@/lib/upcoming";
import { useAppStore } from "@/store/useAppStore";
import { FutureExpenseForm } from "./FutureExpenseForm";

interface FutureExpenseRowProps {
  expense: FutureExpense;
  categoryName: string;
  categoryIcon: string;
  currency: Currency;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePaid: () => void;
}

const FutureExpenseRow = memo(function FutureExpenseRow({
  expense,
  categoryName,
  categoryIcon,
  currency,
  onEdit,
  onDelete,
  onTogglePaid,
}: FutureExpenseRowProps) {
  const paid = expense.status === "paid";
  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${categoryAccent(categoryName).chip}`}
      >
        {categoryIcon}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-semibold tracking-tight ${
            paid ? "text-muted line-through" : ""
          }`}
        >
          {expense.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <span>{categoryName}</span>
          {expense.recurring && (
            <span className="inline-flex items-center gap-1">
              <RepeatIcon className="h-3 w-3" />
              Recurring
            </span>
          )}
        </p>
      </div>
      <div className="hidden sm:block">
        <PriorityBadge priority={expense.priority} />
      </div>
      <p className="hidden text-xs text-muted md:block">
        {formatDateShort(expense.dueDate)}
      </p>
      <p className="text-sm font-semibold tabular-nums">
        {formatMoney(expense.amount, currency)}
      </p>
      <button
        type="button"
        onClick={onTogglePaid}
        aria-label={
          paid ? `Mark ${expense.title} as not paid` : `Mark ${expense.title} as paid`
        }
        aria-pressed={paid}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
          paid
            ? "border-brand-600 bg-brand-600 text-white"
            : "border-border text-transparent hover:border-brand-500"
        }`}
      >
        <CheckIcon className="h-3.5 w-3.5" />
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${expense.title}`}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${expense.title}`}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-canvas hover:text-danger focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
});

export function UpcomingView() {
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);
  const updateFutureExpense = useAppStore((s) => s.updateFutureExpense);
  const deleteFutureExpense = useAppStore((s) => s.deleteFutureExpense);
  const { success } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FutureExpense | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FutureExpense | null>(null);

  const groups = useMemo(
    () => groupFutureExpenses(futureExpenses),
    [futureExpenses],
  );
  const paid = useMemo(
    () => sortedPaidExpenses(futureExpenses),
    [futureExpenses],
  );

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (expense: FutureExpense) => {
    setEditing(expense);
    setFormOpen(true);
  };

  const togglePaid = (expense: FutureExpense) => {
    const wasPaid = expense.status === "paid";
    updateFutureExpense(expense.id, {
      status: wasPaid ? "upcoming" : "paid",
    });
    success(wasPaid ? "Marked as upcoming." : "Marked as paid.");
  };

  const confirmDelete = () => {
    if (pendingDelete === null) return;
    deleteFutureExpense(pendingDelete.id);
    success("Upcoming expense deleted.");
    setPendingDelete(null);
  };

  const renderGroup = (label: string, items: FutureExpense[]) => {
    const total = items.reduce((sum, expense) => sum + expense.amount, 0);
    return (
      <section key={label} className="flex flex-col gap-2">
        <h2 className="flex items-baseline gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
          {label}
          <span className="font-medium normal-case tracking-normal">
            {formatMoney(total, currency)}
          </span>
        </h2>
        <ul className="overflow-hidden rounded-xl border border-border/60 bg-surface shadow-card divide-y divide-border/70">
          {items.map((expense) => (
            <FutureExpenseRow
              key={expense.id}
              expense={expense}
              categoryName={categoryById.get(expense.categoryId)?.name ?? "Uncategorized"}
              categoryIcon={categoryById.get(expense.categoryId)?.icon ?? "•"}
              currency={currency}
              onEdit={() => openEdit(expense)}
              onDelete={() => setPendingDelete(expense)}
              onTogglePaid={() => togglePaid(expense)}
            />
          ))}
        </ul>
      </section>
    );
  };

  const isEmpty = groups.length === 0 && paid.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Upcoming expenses"
        description="Know what's ahead, so nothing sneaks up on your budget."
        action={
          <Button icon={<PlusIcon className="h-4 w-4" />} onClick={openAdd}>
            Add expense
          </Button>
        }
      />

      {isEmpty ? (
        <Card>
          <EmptyState
            icon={<CalendarIcon className="h-6 w-6" />}
            title="Nothing planned yet"
            description="Create your first upcoming expense to get ahead of your month — no surprises, just a plan."
            action={
              <Button icon={<PlusIcon className="h-4 w-4" />} onClick={openAdd}>
                Plan an expense
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {groups.map((group) => renderGroup(group.label, group.items))}

          {paid.length > 0 && (
            <>
              <div className="pt-2">
                {renderGroup("Paid", paid)}
              </div>
            </>
          )}
        </>
      )}

      <FutureExpenseForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete upcoming expense"
        message={
          pendingDelete
            ? `"${pendingDelete.title}" will be removed from your plans.`
            : ""
        }
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
