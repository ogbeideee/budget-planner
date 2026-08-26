"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { PlusIcon, UploadIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/shell/PageHeader";
import { TransactionForm } from "@/components/txn/TransactionForm";
import { useMonth } from "@/hooks/useMonth";
import type { CategoryKind } from "@/lib/types";
import { ImportStatementModal } from "./ImportStatementModal";
import { BudgetList } from "./BudgetList";
import { BudgetStatusBand } from "./BudgetStatusBand";
import { Hero } from "./Hero";
import { RecentActivity } from "./RecentActivity";
import { SummaryCards } from "./SummaryCards";

export function PlannerView() {
  const { month, setMonth } = useMonth();
  const searchParams = useSearchParams();
  const focusOver = searchParams.get("focus") === "over";
  const focusCreate = searchParams.get("focus") === "create";
  const [txnType, setTxnType] = useState<CategoryKind | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -right-24 top-56 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(14,165,164,0.06),transparent_65%)]" />
        <div className="absolute -left-24 top-[1100px] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.05),transparent_65%)]" />
        <svg
          className="absolute right-8 top-48 hidden select-none xl:block"
          width="340"
          height="200"
          viewBox="0 0 340 200"
          fill="none"
        >
          <circle cx="276" cy="44" r="62" stroke="rgba(14,165,164,0.1)" strokeWidth="2" />
          <circle cx="276" cy="44" r="36" stroke="rgba(14,165,164,0.12)" strokeWidth="2" />
          <path
            d="M44 168 C 116 160, 148 112, 208 108 C 258 104, 284 64, 326 54"
            stroke="rgba(14,165,164,0.18)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M44 186 C 128 178, 166 134, 236 130"
            stroke="rgba(37,99,235,0.12)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="relative z-10 flex flex-col gap-6">
        <PageHeader
          title="Planner"
          description="Everything you need to stay on top of your finances this month."
          action={
            <div className="flex flex-wrap items-center gap-3">
              <Button
                icon={<PlusIcon className="h-4 w-4" />}
                onClick={() => setTxnType("expense")}
              >
                Add Expense
              </Button>
              <Button
                variant="secondary"
                icon={<PlusIcon className="h-4 w-4" />}
                onClick={() => setTxnType("income")}
              >
                Add Income
              </Button>
              <Button
                variant="secondary"
                icon={<UploadIcon className="h-4 w-4" />}
                onClick={() => setImportOpen(true)}
              >
                Import Statement
              </Button>
              <MonthPicker value={month} onChange={setMonth} />
            </div>
          }
        />
        <Hero month={month} />
        <SummaryCards month={month} />
        <BudgetStatusBand month={month} />
        <BudgetList month={month} focusOver={focusOver} focusCreate={focusCreate} />
        <RecentActivity month={month} />
        <TransactionForm
          key={txnType ?? "closed"}
          open={txnType !== null}
          initialType={txnType ?? "expense"}
          defaultMonth={month}
          onClose={() => setTxnType(null)}
        />
        <ImportStatementModal
          key={importOpen ? "import-open" : "import-closed"}
          open={importOpen}
          onClose={() => setImportOpen(false)}
        />
        </div>
    </div>
  );
}
