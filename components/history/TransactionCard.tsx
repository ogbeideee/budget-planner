"use client";

import { memo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  ArrowRightToLineIcon,
  ChevronDownIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { categoryAccent } from "@/lib/accents";
import { formatDateShort } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import type { Category, Currency, Transaction } from "@/lib/types";

export interface TransactionCardProps {
  transaction: Transaction;
  category?: Category;
  currency: Currency;
  budget?: { limit: number; spent: number } | null;
  onEdit: () => void;
  onDelete: () => void;
  onMoveNextMonth: () => void;
}

const ICON_BUTTON = "h-10 w-10 px-0";

export const TransactionCard = memo(function TransactionCard({
  transaction,
  category,
  currency,
  budget,
  onEdit,
  onDelete,
  onMoveNextMonth,
}: TransactionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isIncome = transaction.type === "income";
  const accent = category ? categoryAccent(category.name) : null;
  const title = transaction.note ?? category?.name ?? "Transaction";
  const amount = `${isIncome ? "+" : "-"}${formatMoney(transaction.amount, currency)}`;

  return (
    <div
      role="listitem"
      className="group flex flex-col rounded-lg border border-border/70 bg-surface p-5 shadow-card transition-all duration-150 ease-premium hover:-translate-y-0.5 hover:bg-canvas/60 hover:shadow-card-hover motion-reduce:transform-none"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={
            expanded ? "Collapse transaction details" : "Expand transaction details"
          }
          onClick={() => setExpanded((open) => !open)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none sm:gap-4"
        >
          <span
            aria-hidden="true"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-base ${
              accent ? accent.chip : "bg-sidebar-hover text-muted"
            }`}
          >
            {category?.icon}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-semibold text-ink">
                {title}
              </span>
              {transaction.deferred && <Badge variant="warning">Deferred</Badge>}
              {transaction.recurringRuleId && (
                <Badge variant="info">Recurring</Badge>
              )}
            </span>
            <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {category && (
                <span
                  className={`rounded-full px-2 py-0.5 text-micro font-bold ${accent?.chip ?? "bg-sidebar-hover text-muted"}`}
                >
                  {category.name}
                </span>
              )}
              {transaction.note && (
                <span className="line-clamp-1 break-words text-txn-note font-medium text-muted">
                  {transaction.note}
                </span>
              )}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span
              className={`block text-amount font-bold tabular-nums ${
                isIncome ? "text-income" : "text-ink"
              }`}
            >
              {amount}
            </span>
            <span className="mt-0.5 block text-caption font-medium text-muted">
              {formatDateShort(transaction.date)}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity duration-150 ease-premium max-sm:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className={ICON_BUTTON}
            icon={<PencilIcon className="h-4 w-4" />}
            aria-label="Edit transaction"
            onClick={onEdit}
          />
          {isIncome ? (
            <span aria-hidden="true" className="inline-block h-10 w-10" />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className={ICON_BUTTON}
              icon={<ArrowRightToLineIcon className="h-4 w-4" />}
              title="Move to next month"
              aria-label="Move to next month"
              onClick={onMoveNextMonth}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            className={ICON_BUTTON}
            icon={<TrashIcon className="h-4 w-4" />}
            aria-label="Delete transaction"
            onClick={onDelete}
          />
        </div>

        <button
          type="button"
          aria-label={expanded ? "Hide transaction details" : "Show transaction details"}
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
          className="shrink-0 rounded-md p-1.5 text-muted transition-colors duration-150 ease-premium hover:bg-sidebar-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none"
        >
          <ChevronDownIcon
            className={`h-4 w-4 transition-transform duration-default ease-premium ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {expanded && (
        <div className="mt-4 animate-[list-in_220ms_var(--ease-premium)] flex flex-col gap-4 border-t border-border/60 pt-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-caption font-medium text-muted">Category</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 font-semibold text-ink">
                {category?.icon} {category?.name ?? "Uncategorized"}
              </dd>
            </div>
            <div>
              <dt className="text-caption font-medium text-muted">Date</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                {formatDateShort(transaction.date)}
              </dd>
            </div>
            <div>
              <dt className="text-caption font-medium text-muted">Status</dt>
              <dd className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {transaction.recurringRuleId ? (
                  <Badge variant="info">Recurring</Badge>
                ) : (
                  <Badge variant="neutral">Manual</Badge>
                )}
                {transaction.deferred && <Badge variant="warning">Deferred</Badge>}
              </dd>
            </div>
            <div>
              <dt className="text-caption font-medium text-muted">Budget</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                {budget
                  ? `${formatMoney(budget.limit, currency)} limit · ${formatMoney(budget.spent, currency)} spent`
                  : "No budget set"}
              </dd>
            </div>
          </dl>
          {transaction.note && (
            <p className="break-words text-txn-note font-medium leading-5 text-muted">
              {transaction.note}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<PencilIcon className="h-4 w-4" />}
              onClick={onEdit}
            >
              Edit
            </Button>
            {!isIncome && (
              <Button
                variant="secondary"
                size="sm"
                icon={<ArrowRightToLineIcon className="h-4 w-4" />}
                onClick={onMoveNextMonth}
              >
                Move to next month
              </Button>
            )}
            <Button
              variant="danger"
              size="sm"
              icon={<TrashIcon className="h-4 w-4" />}
              onClick={onDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
