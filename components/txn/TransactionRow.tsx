"use client";

import { memo, useState } from "react";
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

export interface TransactionRowProps {
  transaction: Transaction;
  category?: Category;
  currency: Currency;
  onEdit: () => void;
  onDelete: () => void;
  onMoveNextMonth: () => void;
}

export const TransactionRow = memo(function TransactionRow({
  transaction,
  category,
  currency,
  onEdit,
  onDelete,
  onMoveNextMonth,
}: TransactionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const rowActions = (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        icon={<PencilIcon className="h-4 w-4" />}
        aria-label="Edit transaction"
        onClick={onEdit}
      />
      {transaction.type === "expense" ? (
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowRightToLineIcon className="h-4 w-4" />}
          title="Move to next month"
          aria-label="Move to next month"
          onClick={onMoveNextMonth}
        />
      ) : (
        <span
          aria-hidden="true"
          className="inline-block h-9 w-10"
        />
      )}
      <Button
        variant="ghost"
        size="sm"
        icon={<TrashIcon className="h-4 w-4" />}
        aria-label="Delete transaction"
        onClick={onDelete}
      />
    </div>
  );
  return (
    <>
      <tr className="transition-colors duration-150 ease-premium hover:bg-canvas">
        <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-muted">
          {formatDateShort(transaction.date)}
        </td>
        <td className="px-4 py-3.5">
          <span className="flex items-center gap-2 font-medium text-ink">
            <span
              aria-hidden="true"
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm ${
                category ? categoryAccent(category.name).chip : "bg-canvas text-muted"
              }`}
            >
              {category?.icon}
            </span>
            {category?.name ?? "Category"}
            {transaction.deferred && (
              <span
                title="Moved to this month via Move to next month"
                className="rounded-full bg-warn/10 px-2 py-0.5 text-xs font-semibold text-warn"
              >
                Deferred
              </span>
            )}
          </span>
        </td>
        <td className="break-words px-4 py-3.5 text-muted">{transaction.note ?? "—"}</td>
        <td
          className={`px-4 py-3.5 text-right font-semibold tabular-nums ${
            transaction.type === "income" ? "text-income" : "text-expense"
          }`}
        >
          {transaction.type === "income" ? "+" : "-"}
          {formatMoney(transaction.amount, currency)}
        </td>
        <td className="hidden px-4 py-3.5 sm:table-cell">{rowActions}</td>
        <td className="px-4 py-3.5 sm:hidden">
          <div className="flex justify-end">
            <button
              type="button"
              aria-label={expanded ? "Hide row actions" : "Show row actions"}
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
              className="rounded-md p-1.5 text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus:outline-none"
            >
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform duration-200 ease-premium ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="animate-[list-in_160ms_var(--ease-premium)] sm:hidden">
          <td colSpan={5} className="border-b border-border/60 bg-canvas/40 px-4 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              {transaction.deferred && (
                <span className="rounded-full bg-warn/10 px-2 py-0.5 text-xs font-semibold text-warn">
                  Deferred
                </span>
              )}
              {transaction.note && (
                <span className="text-xs text-muted">{transaction.note}</span>
              )}
              <div className="ml-auto flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<PencilIcon className="h-4 w-4" />}
                  onClick={onEdit}
                >
                  Edit
                </Button>
                {transaction.type === "expense" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<ArrowRightToLineIcon className="h-4 w-4" />}
                    onClick={onMoveNextMonth}
                  >
                    Move
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<TrashIcon className="h-4 w-4" />}
                  onClick={onDelete}
                >
                  Delete
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
});
