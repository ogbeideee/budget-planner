"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SparklesIcon, TrashIcon } from "@/components/ui/icons";
import { RULE_MIN_STRENGTH } from "@/lib/learnedRules";
import type { LearnedRule } from "@/lib/types";
import { categoryLabelOr } from "@/lib/categoryDisplay";
import { categoryDisplay } from "@/lib/categoryRegistry";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/hooks/useToast";

const SIGNAL_LABELS: Record<LearnedRule["kind"], string> = {
  provider: "Provider",
  merchant: "Merchant",
  description: "Description",
};

/** Compact management panel for learned classification rules (Prompt 6A):
 *  see, enable/disable, edit the target category, or delete. Rules are
 *  learned automatically from repeated statement-import corrections. */
export function LearnedRulesPanel() {
  const rules = useAppStore((s) => s.state.learnedRules);
  const categories = useAppStore((s) => s.state.categories);
  const updateLearnedRule = useAppStore((s) => s.updateLearnedRule);
  const deleteLearnedRule = useAppStore((s) => s.deleteLearnedRule);
  const clearLearnedRules = useAppStore((s) => s.clearLearnedRules);
  const { success } = useToast();

  const [pendingDelete, setPendingDelete] = useState<LearnedRule | null>(null);
  const [pendingClear, setPendingClear] = useState(false);

  const categoryOf = (id: string) =>
    categories.find((category) => category.id === id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-card-title font-bold tracking-tight text-ink">
            Learned rules
          </h3>
          <p className="mt-1 text-sm text-muted">
            When you correct a transaction type while importing a bank
            statement twice, the app learns it — and suggests your choice
            next time. Nothing is learned from a single correction.
          </p>
        </div>
        {rules.length > 0 && (
          <Button
            variant="secondary"
            onClick={() => setPendingClear(true)}
            icon={<TrashIcon className="h-4 w-4" />}
          >
            Clear all
          </Button>
        )}
      </div>

      <Card>
        {rules.length === 0 ? (
          <EmptyState
            icon={<SparklesIcon className="h-5 w-5" />}
            iconClass="bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
            title="No learned rules yet"
            description="Import a bank statement and correct a transaction's category twice — the app will learn the pattern automatically."
          />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {rules.map((rule) => {
              const category = categoryOf(rule.categoryId);
              const waiting = !rule.enabled;
              return (
                <li
                  key={rule.id}
                  className="group flex flex-wrap items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 ease-premium hover:bg-canvas/60"
                >
                  <input
                    type="checkbox"
                    aria-label={`Toggle rule "${rule.key}"`}
                    checked={rule.enabled}
                    onChange={(event) =>
                      updateLearnedRule(rule.id, {
                        enabled: event.target.checked,
                      })
                    }
                    className="h-4 w-4 shrink-0 cursor-pointer rounded accent-brand-600"
                  />
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                    style={{
                      backgroundColor: `${categoryDisplay(category).color}1f`,
                      color: categoryDisplay(category).color,
                    }}
                  >
                    {categoryDisplay(category).icon}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-sm font-semibold tracking-tight text-ink">
                      {SIGNAL_LABELS[rule.kind]} · {rule.key}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {categoryLabelOr(category?.name, "Unknown category")} ·{" "}
                      {rule.strength} correction
                      {rule.strength === 1 ? "" : "s"}
                      {waiting && (
                        <>
                          {" · "}
                          <span className="text-warn">
                            waiting — needs{" "}
                            {RULE_MIN_STRENGTH - rule.strength} more to
                            activate
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  {rule.enabled ? (
                    <span className="rounded-full bg-success-surface px-2.5 py-0.5 text-xs font-semibold text-income">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-warn/10 px-2.5 py-0.5 text-xs font-semibold text-warn">
                      Candidate
                    </span>
                  )}
                  <select
                    aria-label={`Category for rule "${rule.key}"`}
                    value={rule.categoryId}
                    onChange={(event) =>
                      updateLearnedRule(rule.id, {
                        categoryId: event.target.value,
                      })
                    }
                    className="h-8 w-40 shrink-0 cursor-pointer rounded-md border border-border bg-surface px-2 text-sm text-ink transition-colors duration-150 ease-premium hover:border-input-hover focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/15 focus:outline-none"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {categoryDisplay(category).icon} {categoryDisplay(category).name}
                      </option>
                    ))}
                  </select>
                  <div className="flex shrink-0 items-center gap-0.5 transition-opacity duration-150 ease-premium sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <Button
                      variant="ghost"
                      icon={<TrashIcon className="h-4 w-4" />}
                      aria-label={`Delete rule "${rule.key}"`}
                      onClick={() => setPendingDelete(rule)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete learned rule"
        message={`The "${pendingDelete?.key}" rule won't suggest a category anymore. You can always relearn it by correcting again.`}
        confirmLabel="Delete rule"
        danger
        onConfirm={() => {
          if (pendingDelete) deleteLearnedRule(pendingDelete.id);
          setPendingDelete(null);
          success("Learned rule deleted.");
        }}
        onClose={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={pendingClear}
        title="Clear all learned rules"
        message={`All ${rules.length} learned ${rules.length === 1 ? "rule" : "rules"} will be removed and the app will stop suggesting categories from your past corrections. Your transactions and categories are not affected, and the app will start learning again from your next import.`}
        confirmLabel="Clear all"
        danger
        onConfirm={() => {
          clearLearnedRules();
          setPendingClear(false);
          success("Learned rules cleared.");
        }}
        onClose={() => setPendingClear(false)}
      />
    </div>
  );
}