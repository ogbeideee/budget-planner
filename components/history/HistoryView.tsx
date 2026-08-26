"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { MonthPicker } from "@/components/ui/MonthPicker";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CalendarClockIcon,
  DownloadIcon,
  ForwardIcon,
} from "@/components/ui/icons";
import { useMonth } from "@/hooks/useMonth";
import { useToast } from "@/hooks/useToast";
import { formatMoney, MINOR_UNITS_PER_UNIT } from "@/lib/money";
import { transactionsForMonth } from "@/lib/selectors";
import { categoryLabelOr } from "@/lib/categoryDisplay";
import { useAppStore } from "@/store/useAppStore";
import { TransactionList } from "./TransactionList";

function exportCsv(rows: string[][], filename: string) {
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface ChipProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconClass: string;
}

function SummaryChip({ label, value, icon, iconClass }: ChipProps) {
  return (
    <div className="flex items-center gap-3 rounded-full border border-border/60 bg-surface py-2 pl-3 pr-5 shadow-card transition-all duration-150 ease-premium hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transform-none">
      <span
        aria-hidden="true"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconClass}`}
      >
        {icon}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-caption font-medium text-muted">{label}</span>
        <span className="text-sm font-bold tabular-nums text-ink">{value}</span>
      </span>
    </div>
  );
}

export function HistoryView() {
  const { month, setMonth } = useMonth();
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);
  const { success } = useToast();

  const monthTransactions = useMemo(
    () => transactionsForMonth(transactions, month),
    [transactions, month],
  );

  const income = monthTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenses = monthTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const transfers = monthTransactions
    .filter(
      (transaction) =>
        transaction.type === "expense" && transaction.deferred === true,
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const handleCsvExport = () => {
    const rows: string[][] = [
      ["Date", "Category", "Type", "Amount", "Currency", "Note"],
    ];
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    for (const transaction of monthTransactions) {
      const category = categoryById.get(transaction.categoryId);
      rows.push([
        transaction.date,
        categoryLabelOr(category?.name, "Uncategorized"),
        transaction.type,
        (transaction.amount / MINOR_UNITS_PER_UNIT).toFixed(2),
        currency,
        transaction.note ?? "",
      ]);
    }
    exportCsv(rows, `budget-timeline-${month}.csv`);
    success("CSV downloaded.");
  };

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -right-24 top-16 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(14,165,164,0.06),transparent_65%)]" />
        <div className="absolute -left-24 bottom-40 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.05),transparent_65%)]" />
        <svg
          className="absolute right-10 top-20 hidden select-none md:block"
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Timeline"
          description="Review every transaction and understand your financial journey."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            className="no-print"
            icon={<DownloadIcon className="h-4 w-4" />}
            onClick={handleCsvExport}
          >
            Export
          </Button>
          <MonthPicker value={month} onChange={setMonth} />
        </div>
      </div>

      <div
        aria-label="Month summary"
        className="flex flex-wrap items-center gap-3"
      >
        <SummaryChip
          label="Income"
          value={formatMoney(income, currency)}
          icon={<ArrowDownLeftIcon className="h-4 w-4" />}
          iconClass="bg-success-surface text-success-text"
        />
        <SummaryChip
          label="Expenses"
          value={formatMoney(expenses, currency)}
          icon={<ArrowUpRightIcon className="h-4 w-4" />}
          iconClass="bg-expense-surface text-danger-text"
        />
        <SummaryChip
          label="Transfers"
          value={formatMoney(transfers, currency)}
          icon={<ForwardIcon className="h-4 w-4" />}
          iconClass="bg-savings-surface text-savings-text"
        />
        <SummaryChip
          label="Transactions"
          value={String(monthTransactions.length)}
          icon={<CalendarClockIcon className="h-4 w-4" />}
          iconClass="bg-timeline-surface text-timeline-text"
        />
      </div>

      <TransactionList />
      </div>
    </div>
  );
}
