"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { PriorityBadge } from "@/components/planner/PriorityBadge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { MetricIcon } from "@/components/ui/MetricIcon";
import { Modal } from "@/components/ui/Modal";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CalendarClockIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  ForwardIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RepeatIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { useToast } from "@/hooks/useToast";
import { useMarkExpensePaid } from "@/hooks/useMarkExpensePaid";
import { formatDateShort, formatMonthLabel, monthKeyFromIso, nextMonthDate } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import type { Currency, FutureExpense } from "@/lib/types";
import {
  daysUntilLabel,
  filterUpcoming,
  groupFutureExpenses,
  sortedPaidExpenses,
  upcomingSummary,
} from "@/lib/upcoming";
import type { UpcomingFilter } from "@/lib/upcoming";
import { categoryDisplay } from "@/lib/categoryRegistry";
import type { CategoryDisplay } from "@/lib/categoryRegistry";
import { useAppStore } from "@/store/useAppStore";
import { FutureExpenseForm } from "./FutureExpenseForm";

interface FutureExpenseRowProps {
  expense: FutureExpense;
  display: CategoryDisplay;
  currency: Currency;
  /** Subtle teal tint for the soonest upcoming expense. */
  accent?: boolean;
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
  display,
  currency,
  accent = false,
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
  const daysChip =
    expense.status === "paid" ? null : daysUntilLabel(expense.dueDate);
  const chipClass =
    expense.status === "paid"
      ? ""
      : daysChip?.includes("overdue")
        ? "bg-warn/[0.1] text-warn"
        : daysChip === "due today"
          ? "bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
          : "bg-sidebar-hover text-muted";
  return (
    <li
      className={`group flex items-center gap-3 rounded-xl border px-4 py-3 shadow-card transition-[border-color,background-color,box-shadow] duration-150 ease-premium hover:border-border hover:bg-sidebar-hover ${
        accent
          ? "border-brand-500/15 bg-brand-500/[0.05]"
          : "border-border/60 bg-surface"
      }`}
    >
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none"
      >
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base ${display.chip}`}
        >
          {display.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-ink">
            {expense.title}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
            <span className="font-medium sm:hidden">
              {formatDateShort(expense.dueDate)}
            </span>
            <span>{display.name}</span>
            {expense.recurring && (
              <span className="inline-flex items-center gap-1">
                <RepeatIcon className="h-3 w-3" />
                Recurring
              </span>
            )}
            {daysChip && (
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${chipClass}`}
              >
                {daysChip}
              </span>
            )}
          </p>
        </div>
        <div className="hidden sm:block">
          <PriorityBadge priority={expense.priority} />
        </div>
        <p className="hidden text-sm font-medium tabular-nums text-muted sm:block">
          {formatDateShort(expense.dueDate)}
        </p>
        <p className="text-sm font-semibold tabular-nums">
          {formatMoney(expense.amount, currency)}
        </p>
      </button>
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
            {expense.status !== "paid" && (
              <MenuItem
                icon={<CheckIcon className="h-3.5 w-3.5 text-income" />}
                onClick={onMarkPaid}
              >
                Mark as paid
              </MenuItem>
            )}
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

const UPCOMING_FILTERS: { value: UpcomingFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "month", label: "This month" },
  { value: "later", label: "Later" },
];

function SummaryTile({
  icon,
  iconClass = "bg-sidebar-hover text-muted",
  label,
  value,
  support,
}: {
  icon: ReactNode;
  iconClass?: string;
  label: string;
  value: string;
  support: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/70 bg-surface p-3.5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-muted">
          {label}
        </span>
        <MetricIcon className={iconClass}>{icon}</MetricIcon>
      </div>
      <span className="whitespace-nowrap text-xl font-bold leading-none tracking-[-0.02em] tabular-nums text-ink">
        {value}
      </span>
      <span className="truncate text-xs font-medium text-muted">{support}</span>
    </div>
  );
}

export function UpcomingView() {
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);
  const updateFutureExpense = useAppStore((s) => s.updateFutureExpense);
  const deleteFutureExpense = useAppStore((s) => s.deleteFutureExpense);
  const markExpensePaid = useMarkExpensePaid();
  const { success } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FutureExpense | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FutureExpense | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<FutureExpense | null>(null);
  const [filter, setFilter] = useState<UpcomingFilter>("all");
  const [sort, setSort] = useState<"soonest" | "latest">("soonest");
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

  const summary = useMemo(
    () => upcomingSummary(futureExpenses),
    [futureExpenses],
  );
  const filtered = useMemo(
    () => filterUpcoming(futureExpenses, filter),
    [futureExpenses, filter],
  );
  const groups = useMemo(
    () => groupFutureExpenses(filtered),
    [filtered],
  );
  const latest = useMemo(
    () =>
      sort === "latest"
        ? [...filtered].sort((a, b) => b.dueDate.localeCompare(a.dueDate))
        : [],
    [filtered, sort],
  );
  const paid = useMemo(
    () => sortedPaidExpenses(futureExpenses),
    [futureExpenses],
  );
  const nearestId = summary.next?.id ?? null;

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
    markExpensePaid(expense);
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

  const renderGroupContent = (
    label: string,
    items: FutureExpense[],
    quiet = false,
  ) => {
    const total = items.reduce((sum, expense) => sum + expense.amount, 0);
    return (
      <div className="flex flex-col gap-2">
        <div
          className={`flex items-baseline justify-between gap-3 ${quiet ? "px-3" : "px-1"}`}
        >
          <h3 className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted/80">
            {label}
            <span className="text-caption font-medium normal-case tracking-normal tabular-nums text-muted">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          </h3>
          <span className="text-xs font-semibold tabular-nums text-ink">
            {formatMoney(total, currency)}
          </span>
        </div>
        <ul className={`flex flex-col ${quiet ? "gap-1" : "gap-1.5"}`}>
          {items.map((expense) => renderRow(expense))}
        </ul>
      </div>
    );
  };

  const renderRow = (expense: FutureExpense) => {
    const category = categoryById.get(expense.categoryId);
    return (
      <FutureExpenseRow
        key={expense.id}
        expense={expense}
        display={categoryDisplay(category)}
        currency={currency}
        accent={expense.id === nearestId}
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
  };

    const isEmpty = filtered.length === 0;

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -right-20 top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(14,165,164,0.08),transparent_65%)]" />
        <div className="absolute -left-24 bottom-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.07),transparent_65%)]" />
        <svg
          className="absolute right-10 top-16 hidden select-none md:block"
          width="300"
          height="170"
          viewBox="0 0 300 170"
          fill="none"
        >
          <circle cx="240" cy="36" r="52" stroke="rgba(14,165,164,0.12)" strokeWidth="2" />
          <circle cx="240" cy="36" r="30" stroke="rgba(14,165,164,0.14)" strokeWidth="2" />
          <path
            d="M36 146 C 96 140, 122 96, 176 92 C 220 88, 246 52, 288 44"
            stroke="rgba(14,165,164,0.2)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M36 162 C 110 156, 142 118, 204 114"
            stroke="rgba(37,99,235,0.13)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="relative z-10 flex flex-col gap-8">
        <PageHeader
          title="Upcoming expenses"
          description="Know what's ahead, so nothing sneaks up on your budget."
          action={
            <Button icon={<PlusIcon className="h-4 w-4" />} onClick={openAdd}>
              Add expense
            </Button>
          }
        />

        <section
          aria-label="Upcoming summary"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <SummaryTile
            icon={<CalendarClockIcon className="h-4 w-4" />}
            label="Upcoming expenses"
            value={formatMoney(summary.total, currency)}
            support={
              summary.count === 1
                ? "1 expense planned"
                : `${summary.count} expenses planned`
            }
          />
          <SummaryTile
            icon={<ClockIcon className="h-4 w-4" />}
            iconClass="bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
            label="Next due"
            value={
              summary.next ? formatMoney(summary.next.amount, currency) : "—"
            }
            support={
              summary.next
                ? `${daysUntilLabel(summary.next.dueDate)} · ${formatDateShort(summary.next.dueDate)}`
                : "Nothing scheduled"
            }
          />
          <SummaryTile
            icon={<CalendarIcon className="h-4 w-4" />}
            label="This month"
            value={formatMoney(summary.thisMonthTotal, currency)}
            support={
              summary.thisMonthCount === 1
                ? "1 expense this month"
                : `${summary.thisMonthCount} expenses this month`
            }
          />
          <SummaryTile
            icon={<RepeatIcon className="h-4 w-4" />}
            label="Recurring"
            value={String(summary.recurringCount)}
            support={
              summary.recurringCount === 1
                ? "recurring expense"
                : "recurring expenses"
            }
          />
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-section-title font-bold tracking-tight text-ink">
              Upcoming
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Filter upcoming expenses"
                className="flex items-center gap-1 rounded-lg border border-border/70 bg-surface p-1"
              >
                {UPCOMING_FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={filter === option.value}
                    onClick={() => setFilter(option.value)}
                    className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors duration-150 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none ${
                      filter === option.value
                        ? "bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-pressed={sort === "soonest"}
                onClick={() =>
                  setSort((current) =>
                    current === "soonest" ? "latest" : "soonest",
                  )
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/70 bg-surface px-3 text-sm font-medium text-muted transition-colors duration-150 ease-premium hover:border-border hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none"
              >
                {sort === "soonest" ? (
                  <ArrowUpRightIcon className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRightIcon className="h-3.5 w-3.5" />
                )}
                {sort === "soonest" ? "Soonest" : "Latest"}
              </button>
            </div>
          </div>

          {isEmpty ? (
            <div className="relative overflow-hidden rounded-xl border border-border/70 bg-surface p-8 shadow-card">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
              >
                <svg
                  className="absolute -bottom-3 right-6 hidden select-none sm:block"
                  width="240"
                  height="130"
                  viewBox="0 0 240 130"
                  fill="none"
                >
                  <circle
                    cx="200"
                    cy="36"
                    r="26"
                    stroke="rgba(14,165,164,0.14)"
                    strokeWidth="2"
                  />
                  <circle
                    cx="200"
                    cy="36"
                    r="14"
                    stroke="rgba(14,165,164,0.16)"
                    strokeWidth="2"
                  />
                  <path
                    d="M10 112 C 66 106, 100 72, 158 66"
                    stroke="rgba(37,99,235,0.16)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="relative z-10 flex flex-col items-center gap-1 text-center">
                <p className="text-empty-title font-bold tracking-tight text-ink">
                  You&apos;re clear for the rest of the month.
                </p>
                <p className="text-sm font-medium text-muted">
                  Nothing else is scheduled.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<PlusIcon className="h-3.5 w-3.5" />}
                  className="mt-3"
                  onClick={openAdd}
                >
                  Add upcoming expense
                </Button>
              </div>
            </div>
          ) : sort === "soonest" ? (
            <ol
              aria-label="Upcoming timeline"
              className="relative flex flex-col gap-3 border-l-2 border-border/60 pl-4"
            >
              {groups.map((group) => (
                <li key={group.key} className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-muted/70"
                  />
                  {renderGroupContent(group.label, group.items)}
                </li>
              ))}
            </ol>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3 px-1">
                <h3 className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted/80">
                  All upcoming
                  <span className="text-caption font-medium normal-case tracking-normal tabular-nums text-muted">
                    {latest.length} {latest.length === 1 ? "item" : "items"}
                  </span>
                </h3>
                <span className="text-xs font-semibold tabular-nums text-ink">
                  {formatMoney(
                    latest.reduce((sum, expense) => sum + expense.amount, 0),
                    currency,
                  )}
                </span>
              </div>
              <ul
                aria-label="Upcoming timeline"
                className="flex flex-col gap-1.5"
              >
                {latest.map((expense) => renderRow(expense))}
              </ul>
            </div>
          )}

          {paid.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-canvas/40 p-2">
              {renderGroupContent("Paid", paid, true)}
            </div>
          )}
        </section>

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
      <Input
        label="New due date"
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        className="[&>input]:bg-canvas"
      />
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
