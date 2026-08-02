"use client";

import { PageHeader } from "@/components/shell/PageHeader";
import { TransactionList } from "./TransactionList";

export function HistoryView() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="History"
        description="Chronological ledger of completed income and expense records."
      />
      <TransactionList />
    </div>
  );
}
