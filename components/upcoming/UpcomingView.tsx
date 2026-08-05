"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { PriorityBadge } from "@/components/planner/PriorityBadge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Disclosure } from "@/components/ui/Disclosure";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import {
  CalendarClockIcon,
  CheckIcon,
  ForwardIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RepeatIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { useToast } from "@/hooks/useToast";
import { categoryAccent } from "@/lib/accents";
import { formatDateShort, formatMonthLabel, monthKeyFromIso, nextMonthDate } from "@/lib/date";
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
  menuOpen: boolean;
  onToggleMenu: () => void;
  onMenuRef: (element: HTMLDivElement | null) => void;
  onMarkPaid: () => void;
  onReschedule: () => void;
  onSkip: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const FutureExpenseRow = memo(function FutureExpenseRow({
  expense,
  categoryName,
  categoryIcon,
  currency,
  menuOpen,
  onToggleMenu,
  onMenuRef,
  onMarkPaid,
  onReschedule,
  onSkip,
  onEdit,
  onDelete,
}: FutureExpenseRowProps) {
  const skipLabel = expense.recurring ? "Skip month" : "Postpone";
  return (
    <li className="group flex items-center gap-3 px-5 py-3.5">
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${categoryAccent(categoryName).chip}`}
      >
        {categoryIcon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight text-ink">
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
      <div className="relative">
        <button
          type="button"
          aria-label={`Actions for ${expense.title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-premium hover:bg-canvas hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        >
          <MoreHorizontalIcon className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            aria-label={`Actions for ${expense.title}`}
            ref={onMenuRef}
            className="absolute right-0 top-full z-20 mt-1.5 w-44 animate-[menu-in_150ms_var(--ease-premium)] overflow-hidden rounded-lg border border-border/70 bg-surface p-1 shadow-pop"
          >
            <MenuItem
              icon={<CheckIcon className="h-3.5 w-3.5 text-income" />}
              onClick={onMarkPaid}
            >
              Mark as paid
            </MenuItem>
            <MenuItem
              icon={<CalendarClockIcon className="h-3.5 w-3.5 text-muted" />}
              onClick={onReschedule}
            >
              Reschedule
            </MenuItem>
            <MenuItem
              icon={<ForwardIcon className="h-3.5 w-3.5 text-muted" />}
              onClick={onSkip}
            >
              {skipLabel}
            </MenuItem>
            <MenuItem
              icon={<PencilIcon className="h-3.5 w-3.5 text-muted" />}
              onClick={onEdit}
            >
              Edit
            </MenuItem>
            <MenuItem
              danger
              icon={<TrashIcon className="h-3.5 w-3.5" />}
              onClick={onDelete}
            >
              Delete
            </MenuItem>
          </div>
        )}
      </div>
    </li>
  );
});

function MenuItem({
  icon,
  onClick,
  danger = false,
  children,
}: {
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus:outline-none ${
        danger
          ? "text-danger hover:bg-danger/10 focus-visible:ring-danger/60"
          : "text-ink hover:bg-canvas focus-visible:ring-brand-500"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

export function UpcomingView() {
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const updateFutureExpense = useAppStore((s) => s.updateFutureExpense);
  const deleteFutureExpense = useAppStore((s) => s.deleteFutureExpense);
  const { success } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FutureExpense | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FutureExpense | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<FutureExpense | null>(null);
  const menuElRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuElRef.current && !menuElRef.current.contains(event.target as Node)) {
        setMenuFor(null);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuFor(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

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
    setMenuFor(null);
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (expense: FutureExpense) => {
    setMenuFor(null);
    setEditing(expense);
    setFormOpen(true);
  };

  const markPaid = (expense: FutureExpense) => {
    setMenuFor(null);
    addTransaction({
      categoryId: expense.categoryId,
      amount: expense.amount,
      type: "expense",
      date: expense.dueDate,
      note: expense.notes ?? expense.title,
    });
    updateFutureExpense(expense.id, { status: "paid" });
    success("Paid — added to your timeline and budget.");
  };

  const skip = (expense: FutureExpense) => {
    setMenuFor(null);
    const next = nextMonthDate(expense.dueDate);
    updateFutureExpense(expense.id, { dueDate: next });
    success(`Moved to ${formatMonthLabel(monthKeyFromIso(next))}.`);
  };

  const confirmDelete = () => {
    if (pendingDelete === null) return;
    deleteFutureExpense(pendingDelete.id);
    success("Upcoming expense deleted.");
    setPendingDelete(null);
  };

  const renderGroup = (
    label: string,
    items: FutureExpense[],
    quiet = false,
  ) => {
    const total = items.reduce((sum, expense) => sum + expense.amount, 0);
    return (
      <div key={label} className="flex flex-col">
        <div
          className={`flex items-baseline justify-between gap-3 border-b border-border/70 py-2.5 ${
            quiet ? "px-3" : "bg-canvas/50 px-5"
          }`}
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            {label}
          </h2>
          <span className="text-xs font-semibold tabular-nums text-ink">
            {formatMoney(total, currency)}
          </span>
        </div>
        <ul className="flex flex-col divide-y divide-border/50">
          {items.map((expense) => {
            const category = categoryById.get(expense.categoryId);
            return (
              <FutureExpenseRow
                key={expense.id}
                expense={expense}
                categoryName={category?.name ?? "Uncategorized"}
                categoryIcon={category?.icon ?? "•"}
                currency={currency}
                menuOpen={menuFor === expense.id}
                onToggleMenu={() =>
                  setMenuFor((current) =>
                    current === expense.id ? null : expense.id,
                  )
                }
                onMenuRef={(element) => {
                  menuElRef.current = element;
                }}
                onMarkPaid={() => markPaid(expense)}
                onReschedule={() => {
                  setMenuFor(null);
                  setRescheduling(expense);
                }}
                onSkip={() => skip(expense)}
                onEdit={() => openEdit(expense)}
                onDelete={() => {
                  setMenuFor(null);
                  setPendingDelete(expense);
                }}
              />
            );
          })}
        </ul>
      </div>
    );
  };

  const isEmpty = groups.length === 0 && paid.length === 0;

  const previewRows = useMemo(() => {
    const rows: FutureExpense[] = [];
    for (const group of groups) {
      for (const expense of group.items) {
        rows.push(expense);
        if (rows.length === 3) return rows;
      }
    }
    return rows;
  }, [groups]);

  const renderPreview = () => {
    if (previewRows.length === 0) return undefined;
    return (
      <ul className="flex flex-col divide-y divide-border/60 rounded-xl bg-surface shadow-card">
        {previewRows.map((expense) => (
          <li key={expense.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {expense.title}
              </p>
              <p className="text-xs text-muted">
                {formatDateShort(expense.dueDate)}
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums">
              {formatMoney(expense.amount, currency)}
            </span>
          </li>
        ))}
      </ul>
    );
  };

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
        <div className="rounded-xl bg-surface p-5 shadow-card">
          <EmptyState
            illustration="calendar"
            illustrationClass="bg-brand-500/10 text-brand-600 dark:text-brand-400"
            title="No upcoming expenses yet"
            description="Plan the bills and subscriptions ahead — then nothing sneaks up on your budget."
            action={
              <Button icon={<PlusIcon className="h-4 w-4" />} onClick={openAdd}>
                Plan an expense
              </Button>
            }
            tip="Mark an expense as paid from its menu — it lands in your timeline automatically."
          />
        </div>
      ) : (
        <Disclosure
          id="upcoming:list"
          title="Upcoming"
          preview={() => renderPreview()}
          variant="section"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col divide-y divide-border/70 overflow-hidden rounded-2xl bg-surface shadow-card">
              {groups.map((group) => renderGroup(group.label, group.items))}
            </div>

            {paid.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-canvas/40 p-2">
                {renderGroup("Paid", paid, true)}
              </div>
            )}
          </div>
        </Disclosure>
      )}

      <FutureExpenseForm
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
      />

      <Modal
        open={rescheduling !== null}
        onClose={() => setRescheduling(null)}
        title="Reschedule"
      >
        <RescheduleForm
          expense={rescheduling}
          onDone={() => setRescheduling(null)}
        />
      </Modal>

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

function RescheduleForm({
  expense,
  onDone,
}: {
  expense: FutureExpense | null;
  onDone: () => void;
}) {
  const currency = useAppStore((s) => s.state.settings.currency);
  const updateFutureExpense = useAppStore((s) => s.updateFutureExpense);
  const { success } = useToast();
  const [date, setDate] = useState(expense?.dueDate ?? "");

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!expense || !date) return;
        updateFutureExpense(expense.id, { dueDate: date });
        success("Due date updated.");
        onDone();
      }}
    >
      <p className="text-sm text-muted">
        {expense ? (
          <>
            Move <span className="font-semibold text-ink">{expense.title}</span>{" "}
            ({formatMoney(expense.amount, currency)}) to a new date.
          </>
        ) : null}
      </p>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        New due date
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-ink transition-colors focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </label>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!date || date === expense?.dueDate}>
          Save
        </Button>
      </div>
    </form>
  );
}
