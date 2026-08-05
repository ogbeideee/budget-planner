"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import {
  PencilIcon,
  RepeatIcon,
  TrashIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import { formatMonthLabel } from "@/lib/date";
import type { RecurrenceRule } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/hooks/useToast";
import { RecurrenceForm } from "../txn/RecurrenceForm";
import { ThemeToggle } from "../theme/ThemeToggle";
import { CategoryManager } from "./CategoryManager";
import { PageHeader } from "@/components/shell/PageHeader";
import { BackupsManager } from "./BackupsManager";
import { serializeExport } from "@/lib/storage";

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const SECTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "settings-general", label: "General" },
  { id: "settings-appearance", label: "Appearance" },
  { id: "settings-budget", label: "Budget" },
  { id: "settings-categories", label: "Categories" },
  { id: "settings-recurring", label: "Recurring" },
  { id: "settings-data", label: "Data" },
  { id: "settings-about", label: "About" },
];

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus:outline-none ${
        checked ? "bg-brand-600" : "bg-border"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-premium ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

export function SettingsView() {
  const categories = useAppStore((s) => s.state.categories);
  const recurrenceRules = useAppStore((s) => s.state.recurrenceRules);
  const currency = useAppStore((s) => s.state.settings.currency);
  const recurringEnabled = useAppStore((s) => s.state.settings.recurringEnabled);
  const setSettings = useAppStore((s) => s.setSettings);
  const updateRecurrenceRule = useAppStore((s) => s.updateRecurrenceRule);
  const deleteRecurrenceRule = useAppStore((s) => s.deleteRecurrenceRule);
  const importState = useAppStore((s) => s.importState);
  const resetAll = useAppStore((s) => s.resetAll);
  const { success } = useToast();

  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurrenceRule | null>(null);
  const [ruleFormSession, setRuleFormSession] = useState(0);
  const [pendingRuleDelete, setPendingRuleDelete] = useState<RecurrenceRule | null>(null);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetText, setResetText] = useState("");

  const categoryOf = (id: string) =>
    categories.find((category) => category.id === id);

  const handleExport = () => {
    const blob = new Blob([serializeExport(useAppStore.getState().state)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `budget-planner-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    success("Export downloaded.");
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImport(String(reader.result ?? ""));
      setImportError(null);
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (pendingImport === null) return;
    const result = importState(JSON.parse(pendingImport));
    if (result.ok) {
      success("Data imported.");
      setImportError(null);
    } else {
      setImportError(result.error ?? "That file isn't a valid budget-planner export.");
    }
    setPendingImport(null);
  };

  const handleReset = () => {
    resetAll();
    setConfirmReset(false);
    setResetText("");
    success("All data cleared.");
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Preferences, categories, and your data — everything stays in this browser."
      />

      <nav
        aria-label="Settings sections"
        className="sticky top-16 z-30 -mx-6 flex items-center gap-1.5 overflow-x-auto border-b border-border/60 bg-canvas/95 px-6 py-3 backdrop-blur-md lg:top-0"
      >
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium text-muted transition-colors duration-150 ease-premium hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card id="settings-general" title="General" className="scroll-mt-36 lg:scroll-mt-24">
          <Select
            label="Currency"
            value={currency}
            options={[
              { value: "USD", label: "US Dollar ($)" },
              { value: "NGN", label: "Nigerian Naira (₦)" },
            ]}
            onChange={(event) => {
              setSettings({
                currency: event.target.value as "USD" | "NGN",
              });
              success("Currency updated.");
            }}
          />
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Display only. Existing values are re-labelled; nothing is
            converted.
          </p>
        </Card>

        <Card id="settings-appearance" title="Appearance" className="scroll-mt-36 lg:scroll-mt-24">
          <ThemeToggle variant="cards" />
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Choose how the app looks. System follows your device setting.
          </p>
        </Card>
      </div>

      <Card
        id="settings-budget"
        variant="quiet"
        className="scroll-mt-36 lg:scroll-mt-24"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-ink">
              Auto-generate recurring transactions
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Recurring rules create their transactions automatically each
              month, so your budgets stay accurate.
            </p>
          </div>
          <Switch
            checked={recurringEnabled}
            label="Generate recurring transactions automatically"
            onChange={(checked) => {
              setSettings({ recurringEnabled: checked });
              success(
                checked
                  ? "Recurring generation enabled."
                  : "Recurring generation disabled.",
              );
            }}
          />
        </div>
      </Card>

      <div id="settings-categories" className="scroll-mt-36 lg:scroll-mt-24">
        <CategoryManager />
      </div>

      <Card
        id="settings-recurring"
        title="Recurring transactions"
        className="scroll-mt-36 lg:scroll-mt-24"
        action={
          <Button
            icon={<RepeatIcon className="h-4 w-4" />}
            onClick={() => {
              setEditingRule(null);
              setRuleFormSession((session) => session + 1);
              setRuleFormOpen(true);
            }}
          >
            New recurring
          </Button>
        }
      >
        {recurrenceRules.length === 0 ? (
          <EmptyState
            icon={<RepeatIcon className="h-5 w-5" />}
            iconClass="bg-brand-500/10 text-brand-600 dark:text-brand-400"
            title="No recurring rules yet"
            description="Add a rule for anything that repeats — bills, subscriptions, salary."
            action={
              <Button
                icon={<RepeatIcon className="h-4 w-4" />}
                onClick={() => {
                  setEditingRule(null);
                  setRuleFormSession((session) => session + 1);
                  setRuleFormOpen(true);
                }}
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
                      backgroundColor: `${category?.color ?? "#6b7280"}1f`,
                      color: category?.color ?? "#6b7280",
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
                      onClick={() => {
                        setEditingRule(rule);
                        setRuleFormSession((session) => session + 1);
                        setRuleFormOpen(true);
                      }}
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

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card
          id="settings-data"
          title="Data"
          variant="quiet"
          className="scroll-mt-36 lg:scroll-mt-24"
        >
          <p className="text-sm leading-relaxed text-muted">
            Export your data as a JSON file, restore a previous export, or
            manage automatic snapshots taken before every upgrade.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleExport}>
              Export JSON
            </Button>
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors duration-200 ease-premium hover:bg-canvas hover:border-border/80 focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2">
              Import JSON
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleImportFile(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          {importError && (
            <p role="alert" className="mt-3 text-sm text-expense">
              {importError}
            </p>
          )}
          <div className="mt-6 border-t border-border/60 pt-4">
            <BackupsManager />
          </div>
          <div className="mt-4 border-t border-border/60 pt-4">
            <Button
              variant="danger"
              onClick={() => {
                setConfirmReset(true);
                setResetText("");
              }}
            >
              Reset all data
            </Button>
          </div>
        </Card>

        <Card
          id="settings-about"
          variant="quiet"
          className="scroll-mt-36 lg:scroll-mt-24"
        >
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-card">
              <WalletIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 leading-relaxed">
              <p className="text-sm font-bold tracking-tight text-ink">
                Budget Planner <span className="font-semibold text-muted">1.0</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                Every byte stays in this browser — your data never leaves the
                device.
              </p>
            </div>
          </div>
        </Card>
      </div>

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

      <ConfirmDialog
        open={pendingImport !== null}
        title="Import data"
        message="Importing replaces all of your current data. This cannot be undone."
        confirmLabel="Import and replace"
        danger
        onConfirm={confirmImport}
        onClose={() => setPendingImport(null)}
      />

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all data"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={resetText !== "RESET"}
              onClick={handleReset}
            >
              Reset everything
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          This deletes every category, budget, transaction, and recurring
          rule. This cannot be undone. Type{" "}
          <strong className="font-semibold text-ink">RESET</strong> to
          confirm.
        </p>
        <input
          type="text"
          aria-label="Type RESET to confirm"
          value={resetText}
          placeholder="RESET"
          className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink transition-colors placeholder:text-muted/60 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          onChange={(event) => setResetText(event.target.value)}
        />
      </Modal>
    </div>
  );
}
