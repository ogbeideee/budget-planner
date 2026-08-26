"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { IconPicker } from "@/components/ui/IconPicker";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import { CATEGORY_COLORS } from "@/components/settings/categoryColors";
import { categoryLabel } from "@/lib/categoryDisplay";
import { currentMonthKey } from "@/lib/date";
import {
  formatMoney,
  isMinorUnitsValid,
  minorToInput,
  toMinorUnits,
} from "@/lib/money";
import { clearOnboardingStep, SUGGESTED_BUDGETS } from "@/lib/onboarding";
import { useAppStore } from "@/store/useAppStore";
import { SetupFrame } from "./SetupFrame";

interface Draft {
  key: string;
  name: string;
  icon: string;
  /** Minor units. Editable inline; zero means "not counted yet". */
  limit: number;
}

const MIN_BUDGETS = 2;

/**
 * Step 2 of guided setup: at least two budgets with a limit above zero.
 *
 * Nothing is written until "Finish setup", and then only through the app's own
 * `addCategory` / `addBudget` actions — the same ones the Settings category
 * form and the Planner's "New budget" form call. There is no onboarding-only
 * write path.
 */
export function SetupBudgetsStep({ onBack }: { onBack: () => void }) {
  const month = currentMonthKey();
  const categories = useAppStore((s) => s.state.categories);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);
  const addCategory = useAppStore((s) => s.addCategory);
  const addBudget = useAppStore((s) => s.addBudget);
  const setSettings = useAppStore((s) => s.setSettings);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customIcon, setCustomIcon] = useState("📦");
  const [customLimit, setCustomLimit] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

  const income = useMemo(
    () =>
      incomePlans
        .filter((plan) => plan.month === month)
        .reduce((sum, plan) => sum + plan.expectedAmount, 0),
    [incomePlans, month],
  );

  const allocated = drafts.reduce((sum, draft) => sum + draft.limit, 0);
  const funded = drafts.filter((draft) => draft.limit > 0).length;
  const canFinish = funded >= MIN_BUDGETS;

  const taken = new Set(drafts.map((d) => d.name.toLowerCase()));

  const addDraft = (name: string, icon: string, limit = 0) => {
    if (taken.has(name.toLowerCase())) return;
    setDrafts((current) => [
      ...current,
      { key: `${name}-${current.length}`, name, icon, limit },
    ]);
  };

  const setLimit = (key: string, raw: string) => {
    const minor = toMinorUnits(raw);
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === key
          ? { ...draft, limit: isMinorUnitsValid(minor) ? minor : 0 }
          : draft,
      ),
    );
  };

  const addCustom = () => {
    const trimmed = customName.trim();
    if (trimmed.length === 0) {
      setCustomError("Give the category a name.");
      return;
    }
    if (taken.has(trimmed.toLowerCase())) {
      setCustomError("You have already added that one.");
      return;
    }
    const minor = toMinorUnits(customLimit);
    addDraft(trimmed, customIcon, isMinorUnitsValid(minor) ? minor : 0);
    setCustomName("");
    setCustomLimit("");
    setCustomIcon("📦");
    setCustomError(null);
    setCustomOpen(false);
  };

  const finish = () => {
    if (!canFinish) {
      setAttempted(true);
      return;
    }
    for (const draft of drafts) {
      if (draft.limit <= 0) continue;
      // A brand-new install already seeds some categories; reuse a matching one
      // rather than creating a duplicate name.
      let category = categories.find(
        (entry) =>
          entry.kind === "expense" &&
          entry.name.toLowerCase() === draft.name.toLowerCase(),
      );
      if (!category) {
        const created = addCategory({
          name: draft.name,
          icon: draft.icon,
          color: CATEGORY_COLORS[drafts.indexOf(draft) % CATEGORY_COLORS.length].value,
          kind: "expense",
        });
        if (!created) continue;
        category = useAppStore
          .getState()
          .state.categories.find(
            (entry) =>
              entry.kind === "expense" &&
              entry.name.toLowerCase() === draft.name.toLowerCase(),
          );
      }
      if (!category) continue;
      addBudget({
        categoryId: category.id,
        month,
        limit: draft.limit,
        priority: "medium",
      });
    }
    setSettings({ firstRunDone: true });
    clearOnboardingStep();
  };

  return (
    <SetupFrame
      stepIndex={1}
      title="Give a few categories a limit"
      description="Pick the ones you actually spend on. Two is enough to start — you can add the rest whenever."
      footer={
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
            <Button
              onClick={finish}
              aria-disabled={!canFinish}
              className={canFinish ? "" : "opacity-50"}
            >
              Finish setup
            </Button>
          </div>
          {attempted && !canFinish && (
            <p role="alert" className="text-caption font-semibold text-danger">
              Add at least {MIN_BUDGETS} categories with a limit above zero.
            </p>
          )}
        </div>
      }
    >
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_BUDGETS.filter(
          (s) => !taken.has(s.name.toLowerCase()),
        ).map((suggestion) => (
          <button
            key={suggestion.name}
            type="button"
            onClick={() => addDraft(suggestion.name, suggestion.icon)}
            className="flex items-center gap-1.5 rounded-full border border-border/70 bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors duration-150 ease-premium hover:border-brand-500/50 hover:bg-brand-500/[0.06] focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none"
          >
            <span aria-hidden="true">{suggestion.icon}</span>
            {suggestion.name}
            <PlusIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
          </button>
        ))}
      </div>

      {drafts.length > 0 && (
        <ul className="flex flex-col gap-2">
          {drafts.map((draft) => (
            <li
              key={draft.key}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface px-4 py-3"
            >
              <span aria-hidden="true" className="text-base">
                {draft.icon}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                {categoryLabel(draft.name)}
              </span>
              <input
                type="text"
                inputMode="decimal"
                aria-label={`Monthly limit for ${categoryLabel(draft.name)}`}
                placeholder="0.00"
                defaultValue={draft.limit > 0 ? minorToInput(draft.limit) : ""}
                onChange={(event) => setLimit(draft.key, event.target.value)}
                className="h-9 w-32 shrink-0 rounded-md border border-border bg-surface px-2 text-right text-sm font-medium tabular-nums text-ink transition-[border-color,box-shadow] duration-150 ease-premium placeholder:text-muted focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/15 focus:outline-none"
              />
              <button
                type="button"
                aria-label={`Remove ${categoryLabel(draft.name)}`}
                onClick={() =>
                  setDrafts((current) =>
                    current.filter((entry) => entry.key !== draft.key),
                  )
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-premium hover:bg-expense/10 hover:text-expense focus-visible:ring-2 focus-visible:ring-expense/50 focus:outline-none"
              >
                <TrashIcon className="h-4 w-4 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {customOpen ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:w-32">
              {/* Categories stay emoji-only: their icon prints as raw text in
                  chart axes and <option>s. */}
              <IconPicker
                label="Icon"
                value={customIcon}
                onChange={setCustomIcon}
                vectors={false}
              />
            </div>
            <div className="min-w-0 flex-1">
              <Input
                label="Category"
                placeholder="Childcare"
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
              />
            </div>
            <div className="sm:w-36">
              <Input
                label="Monthly limit"
                inputMode="decimal"
                placeholder="0.00"
                value={customLimit}
                onChange={(event) => setCustomLimit(event.target.value)}
              />
            </div>
          </div>
          {customError && (
            <p role="alert" className="text-caption font-semibold text-danger">
              {customError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={addCustom}>
              Add category
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCustomOpen(false);
                setCustomError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          icon={<PlusIcon className="h-4 w-4" />}
          onClick={() => setCustomOpen(true)}
          className="self-start"
        >
          Add a different category
        </Button>
      )}

      {/* Context only — allocating more than the income is allowed here. */}
      <p className="text-caption font-medium tabular-nums text-muted">
        {formatMoney(allocated, currency)} of {formatMoney(income, currency)}{" "}
        allocated
      </p>
    </SetupFrame>
  );
}
