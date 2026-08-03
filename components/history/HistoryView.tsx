"use client";

import { PageHeader } from "@/components/shell/PageHeader";
import { TransactionList } from "./TransactionList";

export function HistoryView() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="History"
        description="Every income and expense, in one place."
      />
      <TransactionList />
    </div>
  );
}
