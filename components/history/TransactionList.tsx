"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMonthLabel, monthKeyFromIso, monthOffset } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { sortTransactions, spent, transactionsForMonth } from "@/lib/selectors";
import { groupTransactionsByTime } from "@/lib/timeline";
import type { Transaction } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useMonth } from "@/hooks/useMonth";
import { useToast } from "@/hooks/useToast";
import {
  DEFAULT_SORT,
  parseSort,
  serializeSort,
  sortIsDefault,
  TransactionFilters,
} from "../txn/TransactionFilters";
import type { TransactionFiltersState } from "../txn/TransactionFilters";
import { TransactionForm } from "../txn/TransactionForm";
import { TransactionCard } from "./TransactionCard";

const PAGE_SIZE = 25;

function setParam(
  params: URLSearchParams,
  key: string,
  value: string | null,
) {
  if (value === null || value === "") params.delete(key);
  else params.set(key, value);
}

export function TransactionList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { month } = useMonth();

  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const budgets = useAppStore((s) => s.state.budgets);
  const currency = useAppStore((s) => s.state.settings.currency);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);
  const moveTransactionToNextMonth = useAppStore(
    (s) => s.moveTransactionToNextMonth,
  );
  const { success } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formSession, setFormSession] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  const rawType = searchParams.get("type");
  const type = rawType === "income" || rawType === "expense" ? rawType : "all";
  const categoryId = searchParams.get("category") ?? "all";
  const q = searchParams.get("q") ?? "";
  const sort = parseSort(searchParams.get("sort"));
  const rawPage = Number(searchParams.get("page"));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const updateFilters = (patch: Partial<TransactionFiltersState>) => {
    const params = new URLSearchParams(searchParams.toString());
    const next = { type, categoryId, q, sort, ...patch };
    setParam(params, "type", next.type === "all" ? null : next.type);
    setParam(params, "category", next.categoryId === "all" ? null : next.categoryId);
    setParam(params, "q", next.q);
    setParam(params, "sort", sortIsDefault(next.sort) ? null : serializeSort(next.sort));
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () =>
    updateFilters({ type: "all", categoryId: "all", q: "", sort: DEFAULT_SORT });

  const filtered = useMemo(() => {
    const byMonth = transactionsForMonth(transactions, month);
    const byType =
      type === "all" ? byMonth : byMonth.filter((t) => t.type === type);
    const byCategory =
      categoryId === "all"
        ? byType
        : byType.filter((t) => t.categoryId === categoryId);
    const query = q.trim().toLowerCase();
    const byQuery =
      query === ""
        ? byCategory
        : byCategory.filter((t) => (t.note ?? "").toLowerCase().includes(query));
    return sortTransactions(byQuery, sort);
  }, [transactions, month, type, categoryId, q, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const monthHasTransactions =
    transactionsForMonth(transactions, month).length > 0;
  const pageRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const groups = useMemo(
    () => groupTransactionsByTime(pageRows),
    [pageRows],
  );

  const goToPage = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 1) params.delete("page");
    else params.set("page", String(next));
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleMove = (transaction: Transaction) => {
    const destination = monthOffset(monthKeyFromIso(transaction.date), 1);
    moveTransactionToNextMonth(transaction.id);
    success(`Moved to ${formatMonthLabel(destination)}`);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteTransaction(pendingDelete.id);
    success("Transaction deleted.");
    setPendingDelete(null);
  };

  const budgetFor = (transaction: Transaction) => {
    const monthKey = monthKeyFromIso(transaction.date);
    const budget = budgets.find(
      (entry) =>
        entry.month === monthKey && entry.categoryId === transaction.categoryId,
    );
    if (!budget || budget.limit <= 0) return null;
    return {
      limit: budget.limit,
      spent: spent(transactions, transaction.categoryId, monthKey),
    };
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TransactionFilters
          filters={{ type, categoryId, q, sort }}
          onChange={(filters) => updateFilters(filters)}
          onClear={clearFilters}
        />
        <Button
          onClick={() => {
            setEditing(null);
            setFormSession((session) => session + 1);
            setFormOpen(true);
          }}
        >
          New record
        </Button>
      </div>

      {pageRows.length === 0 ? (
        <EmptyState
          illustration="list"
          illustrationClass={
            monthHasTransactions
              ? "bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
              : "bg-canvas text-muted"
          }
          title={
            monthHasTransactions
              ? "Nothing matches these filters"
              : "No transactions yet"
          }
          description={
            monthHasTransactions
              ? "Loosen the filters or clear the search."
              : "Add your first income or expense — your timeline grows from here."
          }
          action={
            monthHasTransactions ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormSession((session) => session + 1);
                  setFormOpen(true);
                }}
              >
                Add your first transaction
              </Button>
            )
          }
        />
      ) : (
        <div role="list" aria-label="Transaction activity" className="flex flex-col gap-8">
          {groups.map((group) => {
            const isToday = group.key === "Today";
            const spentThisGroup = group.items
              .filter((transaction) => transaction.type === "expense")
              .reduce((sum, transaction) => sum + transaction.amount, 0);
            return (
              <section key={group.key} aria-label={group.label} className="flex flex-col gap-3">
                <h2
                  className={`sticky top-16 z-10 -mx-2 rounded-lg bg-canvas px-2 py-2 lg:top-0 ${
                    isToday ? "text-brand-600" : "text-ink"
                  }`}
                >
                  <span className="flex items-baseline gap-3">
                    {isToday && (
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 self-center rounded-full bg-brand-500"
                      />
                    )}
                    <span className="text-timeline-date font-bold">
                      {group.label}
                    </span>
                    <span className="text-caption font-medium tabular-nums text-muted">
                      {group.items.length}{" "}
                      {group.items.length === 1
                        ? "transaction"
                        : "transactions"}
                    </span>
                    <span
                      className={`ml-auto font-bold tabular-nums ${
                        isToday ? "text-brand-600" : "text-ink"
                      }`}
                    >
                      {formatMoney(spentThisGroup, currency)} spent
                    </span>
                  </span>
                </h2>
                <div className="flex flex-col gap-3">
                  {group.items.map((transaction) => (
                    <TransactionCard
                      key={transaction.id}
                      transaction={transaction}
                      category={categories.find(
                        (category) => category.id === transaction.categoryId,
                      )}
                      currency={currency}
                      budget={budgetFor(transaction)}
                      onEdit={() => {
                        setEditing(transaction);
                        setFormSession((session) => session + 1);
                        setFormOpen(true);
                      }}
                      onDelete={() => setPendingDelete(transaction)}
                      onMoveNextMonth={() => handleMove(transaction)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-4">
          <Button
            variant="secondary"
            disabled={currentPage === 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            Prev
          </Button>
          <p className="text-sm tabular-nums text-muted">
            Page {currentPage} of {totalPages}
          </p>
          <Button
            variant="secondary"
            disabled={currentPage === totalPages}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <TransactionForm
        key={formSession}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        transaction={editing}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete transaction"
        message={
          pendingDelete
            ? pendingDelete.recurringRuleId
              ? "This deletes this month's copy only. The recurring rule stays."
              : "Delete this transaction? This cannot be undone."
            : ""
        }
        confirmLabel="Delete transaction"
        danger
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
