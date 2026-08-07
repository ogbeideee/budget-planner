"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  PencilIcon,
  RepeatIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import { formatMonthLabel } from "@/lib/date";
import { categoryColor } from "@/lib/accents";
import type { RecurrenceRule } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/hooks/useToast";
import { RecurrenceForm } from "../txn/RecurrenceForm";
import { PageHeader } from "@/components/shell/PageHeader";
import { SettingsNav } from "./SettingsNav";
import { SETTINGS_SECTIONS } from "./SettingsNav";
import type { SettingsSection } from "./SettingsNav";
import { ProfilePanel } from "./ProfilePanel";
import { AppearancePanel } from "./AppearancePanel";
import { BudgetPreferencesPanel } from "./BudgetPreferencesPanel";
import { CategoryManager } from "./CategoryManager";
import { IncomeSourcesPanel } from "./IncomeSourcesPanel";
import { DataBackupsPanel } from "./DataBackupsPanel";
import { AboutPanel } from "./AboutPanel";

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

function RecurringPanel() {
  const categories = useAppStore((s) => s.state.categories);
  const recurrenceRules = useAppStore((s) => s.state.recurrenceRules);
  const currency = useAppStore((s) => s.state.settings.currency);
  const updateRecurrenceRule = useAppStore((s) => s.updateRecurrenceRule);
  const deleteRecurrenceRule = useAppStore((s) => s.deleteRecurrenceRule);
  const { success } = useToast();

  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurrenceRule | null>(null);
  const [ruleFormSession, setRuleFormSession] = useState(0);
  const [pendingRuleDelete, setPendingRuleDelete] =
    useState<RecurrenceRule | null>(null);

  const categoryOf = (id: string) =>
    categories.find((category) => category.id === id);

  const openForm = (rule: RecurrenceRule | null) => {
    setEditingRule(rule);
    setRuleFormSession((session) => session + 1);
    setRuleFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-card-title font-bold tracking-tight text-ink">
            Recurring transactions
          </h3>
          <p className="mt-1 text-sm text-muted">
            Rules generate repeating transactions each month.
          </p>
        </div>
        <Button
          icon={<RepeatIcon className="h-4 w-4" />}
          onClick={() => openForm(null)}
        >
          New recurring
        </Button>
      </div>

      <Card>
        {recurrenceRules.length === 0 ? (
          <EmptyState
            icon={<RepeatIcon className="h-5 w-5" />}
            iconClass="bg-brand-500/[0.08] text-brand-600 dark:text-brand-400"
            title="No recurring rules yet"
            description="Add a rule for anything that repeats — bills, subscriptions, salary."
            action={
              <Button
                icon={<RepeatIcon className="h-4 w-4" />}
                onClick={() => openForm(null)}
              >
                Create a rule
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {recurrenceRules.map((rule) => {
              const category = categoryOf(rule.categoryId);
              return (
                <li
                  key={rule.id}
                  className="group flex flex-wrap items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 ease-premium hover:bg-canvas/60"
                >
                  <input
                    type="checkbox"
                    aria-label={`Toggle rule for ${category?.name ?? "Unknown"}`}
                    checked={rule.enabled}
                    onChange={(event) =>
                      updateRecurrenceRule(rule.id, {
                        enabled: event.target.checked,
                      })
                    }
                    className="h-4 w-4 shrink-0 cursor-pointer rounded accent-brand-600"
                  />
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                    style={{
                      backgroundColor: `${categoryColor(category)}1f`,
                      color: categoryColor(category),
                    }}
                  >
                    {category?.icon ?? "•"}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-sm font-semibold tracking-tight text-ink">
                      {category?.name ?? "Unknown category"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {FREQUENCY_LABELS[rule.frequency]} · since{" "}
                      {formatMonthLabel(rule.anchorDate.slice(0, 7))}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-ink">
                    {formatMoney(rule.amount, currency)}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5 transition-opacity duration-150 ease-premium sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <Button
                      variant="ghost"
                      icon={<PencilIcon className="h-4 w-4" />}
                      aria-label={`Edit recurring rule for ${category?.name ?? "Unknown"}`}
                      onClick={() => openForm(rule)}
                    />
                    <Button
                      variant="ghost"
                      icon={<TrashIcon className="h-4 w-4" />}
                      aria-label={`Delete recurring rule for ${category?.name ?? "Unknown"}`}
                      onClick={() => setPendingRuleDelete(rule)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <RecurrenceForm
        key={ruleFormSession}
        open={ruleFormOpen}
        onClose={() => setRuleFormOpen(false)}
        rule={editingRule}
      />

      <ConfirmDialog
        open={pendingRuleDelete !== null}
        title="Delete recurring rule"
        message="Its future instances won't be generated. Existing transactions are kept."
        confirmLabel="Delete rule"
        danger
        onConfirm={() => {
          if (pendingRuleDelete) deleteRecurrenceRule(pendingRuleDelete.id);
          setPendingRuleDelete(null);
          success("Recurring rule deleted.");
        }}
        onClose={() => setPendingRuleDelete(null)}
      />
    </div>
  );
}

export function SettingsView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isImportAction = searchParams.get("action") === "import";

  const sectionParam = searchParams.get("section");
  const active: SettingsSection = isImportAction
    ? "data"
    : SETTINGS_SECTIONS.some((section) => section.id === sectionParam)
      ? (sectionParam as SettingsSection)
      : "profile";
  const autoImport = isImportAction;

  const select = (section: SettingsSection) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("action");
    if (section === "profile") {
      params.delete("section");
    } else {
      params.set("section", section);
    }
    router.replace(`/settings${params.size > 0 ? `?${params.toString()}` : ""}`, {
      scroll: false,
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Customize your budgeting experience."
      />

      <div className="grid items-start gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-8">
          <div className="hidden lg:block">
            <SettingsNav active={active} onSelect={select} />
          </div>
          <nav
            aria-label="Settings sections"
            className="-mx-6 flex items-center gap-1.5 overflow-x-auto border-b border-border/60 bg-canvas/95 px-6 py-3 backdrop-blur-md lg:hidden"
          >
            {SETTINGS_SECTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={active === id}
                onClick={() => select(id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none ${
                  active === id
                    ? "bg-brand-500/[0.08] text-brand-600 dark:text-brand-300"
                    : "text-muted hover:bg-surface hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          {active === "profile" && <ProfilePanel />}
          {active === "appearance" && <AppearancePanel />}
          {active === "budget" && <BudgetPreferencesPanel />}
          {active === "categories" && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-card-title font-bold tracking-tight text-ink">
                    Categories
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    Organize transactions, budgets, and upcoming expenses.
                  </p>
                </div>
              </div>
              <CategoryManager />
            </div>
          )}
          {active === "recurring" && <RecurringPanel />}
          {active === "income" && <IncomeSourcesPanel />}
          {active === "data" && <DataBackupsPanel autoImport={autoImport} />}
          {active === "about" && <AboutPanel />}
        </div>
      </div>
    </div>
  );
}
