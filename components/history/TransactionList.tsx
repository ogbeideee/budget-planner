"use client";

import { Fragment, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Disclosure } from "@/components/ui/Disclosure";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateShort, formatMonthLabel, monthKeyFromIso, monthOffset } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { sortTransactions, transactionsForMonth } from "@/lib/selectors";
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
import { TransactionRow } from "../txn/TransactionRow";

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
  const { month, setMonth } = useMonth();

  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
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

  const renderPreview = () => {
    if (pageRows.length === 0) return undefined;
    return (
      <ul className="flex flex-col divide-y divide-border/60">
        {filtered.slice(0, 5).map((transaction) => {
          const category = categories.find(
            (category) => category.id === transaction.categoryId,
          );
          return (
            <li key={transaction.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {transaction.note ?? category?.name ?? "Transaction"}
                </p>
                <p className="text-xs text-muted">
                  {formatDateShort(transaction.date)}
                </p>
              </div>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  transaction.type === "income" ? "text-income" : "text-expense"
                }`}
              >
                {transaction.type === "income" ? "+" : "−"}
                {formatMoney(transaction.amount, currency)}
              </span>
            </li>
          );
        })}
      </ul>
    );
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteTransaction(pendingDelete.id);
    success("Transaction deleted.");
    setPendingDelete(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-16 z-30 -mx-6 flex flex-wrap items-end justify-between gap-3 border-b border-border/60 bg-canvas/95 px-6 py-3 backdrop-blur-md lg:top-0">
        <TransactionFilters
          month={month}
          onMonthChange={setMonth}
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

      <Disclosure
        id={`timeline:${month}`}
        title={`Timeline · ${formatMonthLabel(month)}`}
        preview={() => renderPreview()}
      >
        {pageRows.length === 0 ? (
          <EmptyState
            illustration="list"
            illustrationClass={
              filtered.length === 0
                ? "bg-canvas text-muted"
                : "bg-brand-500/10 text-brand-600 dark:text-brand-400"
            }
            title={
              filtered.length === 0
                ? "Nothing matches these filters"
                : "Nothing recorded yet"
            }
            description={
              filtered.length === 0
                ? "Loosen the filters or clear the search."
                : "Add your first income or expense — your timeline grows from here."
            }
            action={
              filtered.length === 0 ? (
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
                  New record
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto lg:overflow-visible">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-2.5 lg:top-[4.75rem]"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-2.5 lg:top-[4.75rem]"
                  >
                    Category
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-2.5 lg:top-[4.75rem]"
                  >
                    Note
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-2.5 text-right lg:top-[4.75rem]"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-2.5 text-right lg:top-[4.75rem]"
                  >
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group, index) => {
                  const groupTotal = group.items.reduce(
                    (sum, transaction) => sum + transaction.amount,
                    0,
                  );
                  const isToday = group.key === "Today";
                  return (
                    <Fragment key={group.key}>
                      {index > 0 && <tr aria-hidden="true" className="h-2" />}
                      <tr>
                        <th
                          colSpan={5}
                          scope="colgroup"
                          className={`border-b px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                            isToday
                              ? "border-brand-500/20 bg-brand-500/10 text-brand-600 dark:text-brand-300"
                              : "border-border/60 bg-canvas/60 text-muted"
                          }`}
                        >
                          {isToday && (
                            <span
                              aria-hidden="true"
                              className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-brand-500"
                            />
                          )}
                          {group.label}
                          <span
                            className={`ml-2 text-sm font-bold normal-case tracking-normal tabular-nums ${
                              isToday
                                ? "text-brand-600 dark:text-brand-300"
                                : "text-ink"
                            }`}
                          >
                            {formatMoney(groupTotal, currency)}
                          </span>
                        </th>
                      </tr>
                      {group.items.map((transaction) => (
                        <TransactionRow
                          key={transaction.id}
                          transaction={transaction}
                          category={categories.find(
                            (category) => category.id === transaction.categoryId,
                          )}
                          currency={currency}
                          onEdit={() => {
                            setEditing(transaction);
                            setFormSession((session) => session + 1);
                            setFormOpen(true);
                          }}
                          onDelete={() => setPendingDelete(transaction)}
                          onMoveNextMonth={() => handleMove(transaction)}
                        />
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
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
      </Disclosure>

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
