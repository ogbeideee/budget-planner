"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ClockIcon,
  FileTextIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { useToast } from "@/hooks/useToast";
import {
  formatDateLong,
  formatDateTime,
  formatTime,
  monthKeyFromIso,
} from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { effectiveLimit, spent } from "@/lib/selectors";
import { categoryLabelOr } from "@/lib/categoryDisplay";
import { categoryDisplay } from "@/lib/categoryRegistry";
import { useAppStore } from "@/store/useAppStore";
import { TransactionForm } from "../txn/TransactionForm";

interface DetailRowProps {
  label: string;
  children: React.ReactNode;
  muted?: boolean;
}

function DetailRow({ label, children, muted }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <dt className="shrink-0 text-caption font-semibold text-muted">
        {label}
      </dt>
      <dd
        className={`text-right text-sm font-semibold tabular-nums ${
          muted ? "text-muted" : "text-ink"
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

export function ExpenseDetailsView({ expenseId }: { expenseId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = expenseId ?? searchParams.get("id") ?? "";
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const budgets = useAppStore((s) => s.state.budgets);
  const rollovers = useAppStore((s) => s.state.rollovers);
  const currency = useAppStore((s) => s.state.settings.currency);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);
  const { success } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const transaction = useMemo(
    () =>
      transactions.find((t) => t.id === id && t.type === "expense"),
    [transactions, id],
  );
  const category = useMemo(
    () =>
      transaction
        ? categories.find((c) => c.id === transaction.categoryId)
        : undefined,
    [categories, transaction],
  );
  const budgetContext = useMemo(() => {
    if (!transaction) return null;
    const month = monthKeyFromIso(transaction.date);
    const budget = budgets.find(
      (entry) =>
        entry.month === month && entry.categoryId === transaction.categoryId,
    );
    if (!budget || budget.limit <= 0) return null;
    return {
      // The spendable limit for that month, carryover included, so a past
      // month reads as it did at the time.
      limit: effectiveLimit(budget, rollovers),
      spent: spent(transactions, transaction.categoryId, month),
    };
  }, [budgets, transactions, transaction, rollovers]);

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.replace(
        transaction
          ? `/history?month=${monthKeyFromIso(transaction.date)}`
          : "/history",
      );
    }
  };

  if (!transaction) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex items-center gap-3">
          <Button
            variant="ghost"
            icon={<ChevronLeftIcon className="h-4 w-4" />}
            onClick={goBack}
            aria-label="Back to Timeline"
          >
            Back
          </Button>
          <h1 className="text-lg font-bold tracking-tight text-ink">
            Expense Details
          </h1>
        </header>
        <EmptyState
          illustration="wallet"
          illustrationClass="bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
          title="Expense not found"
          description="This expense may have been deleted, or the link is incomplete. Head back to the timeline to keep exploring."
          action={
            <Button
              variant="secondary"
              onClick={() => router.replace("/history")}
            >
              Back to Timeline
            </Button>
          }
        />
      </div>
    );
  }

  const title = transaction.note ?? categoryLabelOr(category?.name, "Expense");
  const accent = category ? categoryDisplay(category) : null;
  const month = monthKeyFromIso(transaction.date);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <Button
          variant="ghost"
          icon={<ChevronLeftIcon className="h-4 w-4" />}
          onClick={goBack}
          aria-label="Back to Timeline"
        >
          Back
        </Button>
        <h1 className="flex-1 text-lg font-bold tracking-tight text-ink">
          Expense Details
        </h1>
        <Button
          variant="ghost"
          icon={<PencilIcon className="h-4 w-4" />}
          onClick={() => setFormOpen(true)}
          aria-label="Edit expense"
        >
          Edit
        </Button>
      </header>

      <section
        aria-label="Expense summary"
        className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-surface via-surface to-canvas px-6 py-10 shadow-card"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_88%_-12%,rgba(14,165,164,0.1),transparent_62%),radial-gradient(60%_110%_at_6%_112%,rgba(59,130,246,0.08),transparent_62%)]"
        />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-6 -right-6 select-none"
          width="260"
          height="180"
          viewBox="0 0 260 180"
          fill="none"
        >
          <circle cx="216" cy="34" r="46" fill="rgba(14,165,164,0.07)" />
          <circle cx="216" cy="34" r="28" fill="rgba(14,165,164,0.08)" />
          <circle cx="216" cy="34" r="13" fill="rgba(14,165,164,0.1)" />
          <path
            d="M18 122 C 74 118, 96 84, 150 82 C 204 80, 218 46, 246 42"
            stroke="rgba(14,165,164,0.35)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M18 140 C 88 136, 116 108, 180 106"
            stroke="rgba(37,99,235,0.18)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>

        <div className="relative z-10 flex flex-col items-center gap-4 text-center">
          <span
            aria-hidden="true"
            className={`flex h-24 w-24 items-center justify-center rounded-3xl text-4xl ${
              accent ? accent.chip : "bg-sidebar-hover text-muted"
            }`}
          >
            {categoryDisplay(category).icon}
          </span>
          <div className="flex flex-col items-center gap-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-ink">
              {title}
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-micro font-bold ${
                accent ? accent.chip : "bg-sidebar-hover text-muted"
              }`}
            >
              {categoryLabelOr(category?.name, "Uncategorized")}
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-bold text-muted" aria-hidden="true">
              -
            </span>
            <span className="text-4xl font-bold tabular-nums tracking-tight text-ink">
              {formatMoney(transaction.amount, currency)}
            </span>
          </div>
          {(transaction.deferred || transaction.recurringRuleId) && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {transaction.deferred && <Badge variant="warning">Deferred</Badge>}
              {transaction.recurringRuleId && (
                <Badge variant="info">Recurring</Badge>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
              <CalendarIcon className="h-4 w-4" />
              {formatDateLong(transaction.date)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
              <ClockIcon className="h-4 w-4" />
              {formatTime(transaction.createdAt) || "—"}
            </span>
          </div>
        </div>
      </section>

      {transaction.note && (
        <section className="rounded-2xl border border-border/60 bg-surface p-5 shadow-card">
          <p className="flex items-center gap-1.5 text-caption font-bold uppercase tracking-[0.08em] text-muted">
            <FileTextIcon className="h-3.5 w-3.5" />
            Note
          </p>
          <p className="mt-2 break-words text-txn-note font-medium leading-6 text-ink">
            {transaction.note}
          </p>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-card">
        <p className="px-5 pt-4 text-caption font-bold uppercase tracking-[0.08em] text-muted">
          Details
        </p>
        <dl className="mt-1 divide-y divide-border/60">
          <DetailRow label="Category">
            <span className="inline-flex items-center gap-1.5">
              {categoryDisplay(category).icon} {categoryDisplay(category).name}
            </span>
          </DetailRow>
          <DetailRow label="Budget">
            {budgetContext
              ? `${formatMoney(budgetContext.limit, currency)} limit · ${formatMoney(budgetContext.spent, currency)} spent`
              : "No budget set"}
          </DetailRow>
          <DetailRow label="Payment method" muted>
            Not recorded
          </DetailRow>
          <DetailRow label="Receipt" muted>
            Not attached
          </DetailRow>
          <DetailRow label="Created">
            {formatDateTime(transaction.createdAt) || "—"}
          </DetailRow>
          <DetailRow label="Updated" muted={!transaction.edited}>
            {transaction.edited ? "Edited" : "—"}
          </DetailRow>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <Button
          icon={<PencilIcon className="h-4 w-4" />}
          className="w-full justify-center"
          onClick={() => setFormOpen(true)}
        >
          Edit Expense
        </Button>
        <Button
          variant="danger"
          icon={<TrashIcon className="h-4 w-4" />}
          className="w-full justify-center"
          onClick={() => setConfirmOpen(true)}
        >
          Delete Expense
        </Button>
      </section>

      <TransactionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        transaction={transaction}
        defaultMonth={month}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Delete expense"
        message={
          transaction.recurringRuleId
            ? "This deletes this month's copy only. The recurring rule stays."
            : "Delete this expense? This cannot be undone."
        }
        confirmLabel="Delete expense"
        danger
        onConfirm={() => {
          deleteTransaction(transaction.id);
          success("Expense deleted.");
          setConfirmOpen(false);
          goBack();
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}