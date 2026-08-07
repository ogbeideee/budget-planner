"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconValue } from "@/components/ui/IconValue";
import { PencilIcon, PlusIcon, TrashIcon, WalletIcon } from "@/components/ui/icons";
import { useToast } from "@/hooks/useToast";
import { useAppStore } from "@/store/useAppStore";
import { incomePlansForMonth } from "@/lib/selectors";
import { currentMonthKey, formatMonthLabel } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { IncomeSourceModal } from "./IncomeSourceModal";
import type { IncomePlan } from "@/lib/types";

export function IncomeSourcesPanel() {
  const state = useAppStore((s) => s.state);
  const setIncomePlan = useAppStore((s) => s.setIncomePlan);
  const { success } = useToast();
  const month = currentMonthKey();

  const plans = useMemo(
    () => incomePlansForMonth(state.incomePlans, month),
    [state.incomePlans, month],
  );

  const [editing, setEditing] = useState<IncomePlan | null | "create">(null);
  const [pendingDelete, setPendingDelete] = useState<IncomePlan | null>(null);

  const difference = (plan: IncomePlan) =>
    plan.expectedAmount - plan.receivedAmount;

  const handleDelete = () => {
    if (!pendingDelete) return;
    setIncomePlan(month, pendingDelete.id, {
      expectedAmount: 0,
      receivedAmount: 0,
    });
    setPendingDelete(null);
    success("Income source removed.");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-card-title font-bold tracking-tight text-ink">
            Income sources
          </h3>
          <p className="mt-1 text-sm text-muted">
            Planned sources for{" "}
            <span className="font-semibold text-ink">
              {formatMonthLabel(month)}
            </span>
            . These power the Planner and Reports.
          </p>
        </div>
        <Button
          icon={<PlusIcon className="h-4 w-4" />}
          onClick={() => setEditing("create")}
        >
          Add source
        </Button>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon={<WalletIcon className="h-5 w-5" />}
          iconClass="bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
          title="No income sources yet"
          description="Add a source like salary or freelance to track expected and received amounts this month."
          action={
            <Button
              icon={<PlusIcon className="h-4 w-4" />}
              onClick={() => setEditing("create")}
            >
              Add income source
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const diff = difference(plan);
            const pending = diff > 0;
            return (
              <div
                key={plan.id}
                className="group flex flex-col gap-4 rounded-xl border border-border/70 bg-surface p-5 shadow-card transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:border-border"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/[0.08] text-brand-600 dark:text-brand-400">
                      <IconValue value={plan.icon} className="h-5 w-5 text-xl" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold tracking-tight text-ink">
                        {plan.name}
                      </p>
                      <p className="text-xs text-muted">This month</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <button
                      type="button"
                      aria-label={`Edit ${plan.name}`}
                      onClick={() => setEditing(plan)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${plan.name}`}
                      onClick={() => setPendingDelete(plan)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger focus-visible:ring-2 focus-visible:ring-danger"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-canvas/60 px-3 py-2">
                    <dt className="text-micro font-bold uppercase tracking-[0.08em] text-muted">
                      Expected
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
                      {formatMoney(plan.expectedAmount, state.settings.currency)}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-canvas/60 px-3 py-2">
                    <dt className="text-micro font-bold uppercase tracking-[0.08em] text-muted">
                      Received
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
                      {formatMoney(plan.receivedAmount, state.settings.currency)}
                    </dd>
                  </div>
                </dl>

                <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                  <span className="text-xs font-medium text-muted">
                    Difference
                  </span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      diff === 0
                        ? "text-ink"
                        : pending
                          ? "text-warn"
                          : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {formatMoney(diff, state.settings.currency)}
                    {pending ? " left" : diff === 0 ? " · on track" : " ahead"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <IncomeSourceModal
          month={month}
          plan={editing === "create" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove income source"
        message={
          pendingDelete
            ? `"${pendingDelete.name}" will be removed from ${formatMonthLabel(month)}. Existing transactions are not affected.`
            : ""
        }
        confirmLabel="Remove"
        danger
        onConfirm={handleDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
