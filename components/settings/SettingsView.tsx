"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { formatMoney } from "@/lib/money";
import { formatMonthLabel } from "@/lib/date";
import type { CategoryKind, RecurrenceRule } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/hooks/useToast";
import { RecurrenceForm } from "../txn/RecurrenceForm";
import { ThemeToggle } from "../theme/ThemeToggle";

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export function SettingsView() {
  const categories = useAppStore((s) => s.state.categories);
  const recurrenceRules = useAppStore((s) => s.state.recurrenceRules);
  const currency = useAppStore((s) => s.state.settings.currency);
  const recurringEnabled = useAppStore((s) => s.state.settings.recurringEnabled);
  const updateCategory = useAppStore((s) => s.updateCategory);
  const deleteCategory = useAppStore((s) => s.deleteCategory);
  const addCategory = useAppStore((s) => s.addCategory);
  const setSettings = useAppStore((s) => s.setSettings);
  const updateRecurrenceRule = useAppStore((s) => s.updateRecurrenceRule);
  const deleteRecurrenceRule = useAppStore((s) => s.deleteRecurrenceRule);
  const importState = useAppStore((s) => s.importState);
  const resetAll = useAppStore((s) => s.resetAll);
  const { success, error: toastError } = useToast();

  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurrenceRule | null>(null);
  const [ruleFormSession, setRuleFormSession] = useState(0);
  const [pendingRuleDelete, setPendingRuleDelete] = useState<RecurrenceRule | null>(null);
  const [pendingCategoryDelete, setPendingCategoryDelete] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState<{
    name: string;
    icon: string;
    color: string;
    kind: CategoryKind;
  }>({ name: "", icon: "", color: "#3b82f6", kind: "expense" });
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetText, setResetText] = useState("");

  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? "Unknown";

  const handleExport = () => {
    const blob = new Blob(
      [JSON.stringify(useAppStore.getState().state, null, 2)],
      { type: "application/json" },
    );
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
    try {
      importState(JSON.parse(pendingImport));
      success("Data imported.");
    } catch {
      setImportError("That file isn't a valid budget-planner export.");
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
    <div className="flex flex-col gap-6">
      <Card title="Categories">
        <p className="mb-4 text-sm text-muted">
          Add income and expense categories. Editing a name, icon, or color
          updates it everywhere.
        </p>
        <ul className="flex flex-col gap-2">
          {categories.map((category) => (
            <li key={category.id} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                aria-label={`${category.name} icon`}
                className="w-12 rounded-md border border-border bg-surface px-2 py-1.5 text-center text-sm"
                value={category.icon}
                maxLength={4}
                onChange={(event) =>
                  updateCategory(category.id, { icon: event.target.value })
                }
              />
              <input
                type="color"
                aria-label={`${category.name} color`}
                className="h-9 w-10 cursor-pointer rounded-md border border-border"
                value={category.color}
                onChange={(event) =>
                  updateCategory(category.id, { color: event.target.value })
                }
              />
              <input
                type="text"
                aria-label={`${category.name} name`}
                className="min-w-40 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
                value={category.name}
                maxLength={50}
                onChange={(event) =>
                  updateCategory(category.id, { name: event.target.value })
                }
              />
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  category.kind === "income"
                    ? "bg-income/10 text-income"
                    : "bg-expense/10 text-expense"
                }`}
              >
                {category.kind}
              </span>
              <Button
                variant="ghost"
                aria-label={`Delete ${category.name}`}
                onClick={() => setPendingCategoryDelete(category.id)}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <input
            type="text"
            aria-label="New category name"
            placeholder="Category name"
            maxLength={50}
            className="min-w-40 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
            value={newCategory.name}
            onChange={(event) =>
              setNewCategory({ ...newCategory, name: event.target.value })
            }
          />
          <input
            type="text"
            aria-label="New category icon"
            placeholder="Icon"
            maxLength={4}
            className="w-16 rounded-md border border-border bg-surface px-3 py-1.5 text-center text-sm"
            value={newCategory.icon}
            onChange={(event) =>
              setNewCategory({ ...newCategory, icon: event.target.value })
            }
          />
          <input
            type="color"
            aria-label="New category color"
            className="h-9 w-10 cursor-pointer rounded-md border border-border"
            value={newCategory.color}
            onChange={(event) =>
              setNewCategory({ ...newCategory, color: event.target.value })
            }
          />
          <Select
            label="Kind"
            value={newCategory.kind}
            options={[
              { value: "expense", label: "Expense" },
              { value: "income", label: "Income" },
            ]}
            onChange={(event) =>
              setNewCategory({
                ...newCategory,
                kind: event.target.value as CategoryKind,
              })
            }
          />
          <Button
            disabled={newCategory.name.trim() === ""}
            onClick={() => {
              addCategory({
                name: newCategory.name.trim(),
                icon: newCategory.icon || "•",
                color: newCategory.color,
                kind: newCategory.kind,
              });
              setNewCategory({ name: "", icon: "", color: "#3b82f6", kind: "expense" });
              success("Category added.");
            }}
          >
            Add category
          </Button>
        </div>
      </Card>

      <Card title="Recurring transactions">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Recurring rules generate transactions for each month.
          </p>
          <Button
            onClick={() => {
              setEditingRule(null);
              setRuleFormSession((session) => session + 1);
              setRuleFormOpen(true);
            }}
          >
            New recurring
          </Button>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-border bg-canvas px-3 py-2">
          <span className="text-sm font-medium text-ink">
            Generate recurring transactions automatically
          </span>
          <input
            type="checkbox"
            aria-label="Generate recurring transactions automatically"
            checked={recurringEnabled}
            onChange={(event) => {
              setSettings({ recurringEnabled: event.target.checked });
              success(
                event.target.checked
                  ? "Recurring generation enabled."
                  : "Recurring generation disabled.",
              );
            }}
            className="h-5 w-5 accent-brand-600"
          />
        </div>
        {recurrenceRules.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            No recurring rules yet.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {recurrenceRules.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2"
              >
                <input
                  type="checkbox"
                  aria-label="Toggle rule"
                  checked={rule.enabled}
                  onChange={(event) =>
                    updateRecurrenceRule(rule.id, { enabled: event.target.checked })
                  }
                  className="h-5 w-5 accent-brand-600"
                />
                <span className="min-w-36 flex-1 text-sm font-medium text-ink">
                  {categoryName(rule.categoryId)}
                </span>
                <span className="text-sm tabular-nums text-ink">
                  {formatMoney(rule.amount, currency)}
                </span>
                <span className="text-xs uppercase tracking-wide text-muted">
                  {FREQUENCY_LABELS[rule.frequency]} ·{" "}
                  {formatMonthLabel(rule.anchorDate.slice(0, 7))}
                </span>
                <Button
                  variant="ghost"
                  aria-label={`Edit recurring rule for ${categoryName(rule.categoryId)}`}
                  onClick={() => {
                    setEditingRule(rule);
                    setRuleFormSession((session) => session + 1);
                    setRuleFormOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Delete recurring rule for ${categoryName(rule.categoryId)}`}
                  onClick={() => setPendingRuleDelete(rule)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="General">
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
        <p className="mt-2 text-sm text-muted">
          Display only. Existing values are re-labelled; nothing is converted.
        </p>
        <div className="mt-5">
          <span className="text-sm font-medium text-ink">Theme</span>
          <div className="mt-1.5">
            <ThemeToggle />
          </div>
          <p className="mt-2 text-sm text-muted">
            Choose how the app looks. System follows your device setting.
          </p>
        </div>
      </Card>

      <Card title="Data">
        <p className="text-sm text-muted">
          Export your data as a JSON file, or restore a previous export.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={handleExport}>Export JSON</Button>
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-canvas">
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
        <div className="mt-6 border-t border-border pt-4">
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
        open={pendingCategoryDelete !== null}
        title="Delete category"
        message="This only works when the category is unused by transactions, budgets, recurring rules, and upcoming expenses."
        confirmLabel="Delete category"
        danger
        onConfirm={() => {
          if (pendingCategoryDelete === null) return;
          const result = deleteCategory(pendingCategoryDelete);
          if (!result.ok) {
            const reasons: Record<string, string> = {
              "in-use-transactions": "it has transactions",
              "in-use-budgets": "it has budgets",
              "in-use-rules": "it has recurring rules",
              "in-use-future-expenses": "it has upcoming expenses",
            };
            toastError(
              `Category is in use — ${reasons[result.reason ?? ""] ?? result.reason}.`,
            );
          }
          setPendingCategoryDelete(null);
        }}
        onClose={() => setPendingCategoryDelete(null)}
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
        <p className="text-sm text-muted">
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
          className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          onChange={(event) => setResetText(event.target.value)}
        />
      </Modal>
    </div>
  );
}
