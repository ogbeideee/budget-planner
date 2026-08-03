"use client";

import { memo } from "react";
import { Button } from "@/components/ui/Button";
import { ArrowRightToLineIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
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
  return (
    <tr className="transition hover:brightness-95 dark:hover:brightness-125">
      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-muted">
        {formatDateShort(transaction.date)}
      </td>
      <td className="px-3 py-3">
        <span className="flex items-center gap-2 font-medium text-ink">
          <span aria-hidden="true">{category?.icon}</span>
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
      <td className="px-3 py-3 text-muted">{transaction.note ?? "—"}</td>
      <td
        className={`px-3 py-3 text-right font-semibold tabular-nums ${
          transaction.type === "income" ? "text-income" : "text-expense"
        }`}
      >
        {transaction.type === "income" ? "+" : "-"}
        {formatMoney(transaction.amount, currency)}
      </td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            icon={<PencilIcon className="h-4 w-4" />}
            aria-label="Edit transaction"
            onClick={onEdit}
          />
          {transaction.type === "expense" && (
            <Button
              variant="ghost"
              icon={<ArrowRightToLineIcon className="h-4 w-4" />}
              title="Move to next month"
              aria-label="Move to next month"
              onClick={onMoveNextMonth}
            />
          )}
          <Button
            variant="ghost"
            icon={<TrashIcon className="h-4 w-4" />}
            aria-label="Delete transaction"
            onClick={onDelete}
          />
        </div>
      </td>
    </tr>
  );
});
