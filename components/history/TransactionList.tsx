"use client";

import { Fragment, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClockIcon } from "@/components/ui/icons";
import { formatMonthLabel, monthKeyFromIso, monthOffset } from "@/lib/date";
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

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteTransaction(pendingDelete.id);
    success("Transaction deleted.");
    setPendingDelete(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      <Card title={`Timeline · ${formatMonthLabel(month)}`}>
        {pageRows.length === 0 ? (
          <EmptyState
            icon={<ClockIcon className="h-5 w-5" />}
            iconClass="bg-brand-500/10 text-brand-600 dark:text-brand-400"
            title={
              filtered.length === 0
                ? "No matching records"
                : "No records for this month"
            }
            description={
              filtered.length === 0
                ? "Adjust the filters or clear the search to see more records."
                : "Add your first income or expense — your timeline grows from here."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted">
                  <th
                    scope="col"
                    className="sticky top-16 z-10 border-b border-border bg-surface px-3 py-2 font-semibold lg:top-0"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="sticky top-16 z-10 border-b border-border bg-surface px-3 py-2 font-semibold lg:top-0"
                  >
                    Category
                  </th>
                  <th
                    scope="col"
                    className="sticky top-16 z-10 border-b border-border bg-surface px-3 py-2 font-semibold lg:top-0"
                  >
                    Note
                  </th>
                  <th
                    scope="col"
                    className="sticky top-16 z-10 border-b border-border bg-surface px-3 py-2 text-right font-semibold lg:top-0"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="sticky top-16 z-10 border-b border-border bg-surface px-3 py-2 text-right font-semibold lg:top-0"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const groupTotal = group.items.reduce(
                    (sum, transaction) => sum + transaction.amount,
                    0,
                  );
                  return (
                    <Fragment key={group.key}>
                      <tr>
                        <th
                          colSpan={5}
                          scope="colgroup"
                          className="bg-canvas/60 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted"
                        >
                          {group.label}
                          <span className="ml-2 font-medium normal-case tracking-normal">
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
      </Card>

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
