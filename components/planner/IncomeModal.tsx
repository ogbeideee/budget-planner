"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { IconPicker } from "@/components/ui/IconPicker";
import { IconValue } from "@/components/ui/IconValue";
import { Modal } from "@/components/ui/Modal";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/hooks/useToast";
import { formatMonthLabel } from "@/lib/date";
import { formatMoney, isMinorUnitsValid, minorToInput, toMinorUnits } from "@/lib/money";
import { incomeBreakdownForMonth } from "@/lib/selectors";
import type { Currency, ID, Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

const DEFAULT_ICON = "💰";

interface DraftRow {
  key: string;
  planId: ID | null;
  name: string;
  icon: string;
  expected: string;
  received: string;
  errors: { name?: string; expected?: string; received?: string };
}

function blankRow(key: string): DraftRow {
  return {
    key,
    planId: null,
    name: "",
    icon: DEFAULT_ICON,
    expected: "",
    received: "",
    errors: {},
  };
}

function parseAmount(raw: string, currency: Currency): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  const minor = toMinorUnits(trimmed, currency);
  if (!isMinorUnitsValid(minor)) return null;
  return minor;
}

export function IncomeModal({
  month,
  open,
  onClose,
}: {
  month: Month;
  open: boolean;
  onClose: () => void;
}) {
  const plans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);
  const setIncomePlan = useAppStore((s) => s.setIncomePlan);
  const { success } = useToast();

  const rows = useMemo(
    () => incomeBreakdownForMonth(plans, month),
    [plans, month],
  );

  const seeded = useMemo(
    () =>
      rows.map((row) => ({
        key: row.plan.id,
        planId: row.plan.id,
        name: row.plan.name,
        icon: row.plan.icon,
        expected: row.expected > 0 ? minorToInput(row.expected) : "",
        received: row.received > 0 ? minorToInput(row.received) : "",
        errors: {},
      })),
    [rows],
  );

  const [drafts, setDrafts] = useState<DraftRow[]>(seeded);
  const [nextKey, setNextKey] = useState(0);

  const fmt = (value: number) => formatMoney(value, currency);

  const updateDraft = (key: string, patch: Partial<DraftRow>) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.key === key ? { ...draft, ...patch } : draft,
      ),
    );
  };

  const handleAdd = () => {
    setDrafts((prev) => [...prev, blankRow(`new-${nextKey}`)]);
    setNextKey((value) => value + 1);
  };

  const handleRemove = (key: string) => {
    setDrafts((prev) => prev.filter((draft) => draft.key !== key));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextDrafts = drafts.map((draft) => {
      const errors: DraftRow["errors"] = {};
      if (draft.name.trim() === "") {
        errors.name = "Enter a source name.";
      }
      if (parseAmount(draft.expected, currency) === null) {
        errors.expected = "Enter a valid amount.";
      }
      if (parseAmount(draft.received, currency) === null) {
        errors.received = "Enter a valid amount.";
      }
      return { ...draft, errors };
    });
    setDrafts(nextDrafts);
    if (
      nextDrafts.some(
        (draft) =>
          draft.errors.name ||
          draft.errors.expected ||
          draft.errors.received,
      )
    ) {
      return;
    }
    let saved = false;
    for (const draft of nextDrafts) {
      const expected = parseAmount(draft.expected, currency) ?? 0;
      const received = parseAmount(draft.received, currency) ?? 0;
      if (draft.planId === null) {
        if (expected === 0 && received === 0) continue;
        setIncomePlan(month, null, {
          name: draft.name.trim(),
          icon: draft.icon,
          expectedAmount: expected,
          receivedAmount: received,
        });
        saved = true;
      } else {
        setIncomePlan(month, draft.planId, {
          name: draft.name.trim(),
          icon: draft.icon,
          expectedAmount: expected,
          receivedAmount: received,
        });
        saved = true;
      }
    }
    if (saved) {
      success("Income plan saved.");
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Expected income"
      size="lg"
      describedBy="income-modal-description"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="income-form">
            Save
          </Button>
        </>
      }
    >
      <form
        id="income-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-3"
      >
        <p
          id="income-modal-description"
          className="text-sm leading-relaxed text-muted"
        >
          Plan each income source for {formatMonthLabel(month)}. Expected and
          received amounts are saved per source.
        </p>
        {drafts.length === 0 && (
          <p className="rounded-xl border border-dashed border-border bg-canvas/40 px-4 py-8 text-center text-sm leading-relaxed text-muted">
            No income sources yet. Add one to start planning.
          </p>
        )}
        {drafts.map((draft) => (
          <IncomeSourceRow
            key={draft.key}
            draft={draft}
            currency={currency}
            fmt={fmt}
            onChange={updateDraft}
            onRemove={handleRemove}
          />
        ))}
        <Button type="button" variant="secondary" onClick={handleAdd}>
          <PlusIcon className="h-4 w-4" />
          Add income source
        </Button>
      </form>
    </Modal>
  );
}

function IncomeSourceRow({
  draft,
  currency,
  fmt,
  onChange,
  onRemove,
}: {
  draft: DraftRow;
  currency: Currency;
  fmt: (value: number) => string;
  onChange: (key: string, patch: Partial<DraftRow>) => void;
  onRemove: (key: string) => void;
}) {
  const expected = parseAmount(draft.expected, currency) ?? 0;
  const received = parseAmount(draft.received, currency) ?? 0;
  const difference = expected - received;
  const isEmpty =
    draft.expected.trim() === "" && draft.received.trim() === "";

  let status: ReactNode;
  if (isEmpty || (expected === 0 && received === 0)) {
    status = <span className="text-muted">Not set yet</span>;
  } else if (expected === 0) {
    status = <span className="text-muted">{fmt(received)} received</span>;
  } else if (difference > 0) {
    status = (
      <span className="text-ink">
        Expected {fmt(expected)} · {fmt(received)} received ·{" "}
        <span className="text-muted">{fmt(difference)} to collect</span>
      </span>
    );
  } else if (difference === 0) {
    status = <span className="text-income">Collected in full</span>;
  } else {
    status = (
      <span className="text-warn">Exceeded by {fmt(-difference)}</span>
    );
  }

  return (
    <fieldset className="rounded-xl border border-border/60 bg-canvas/40 p-3.5">
      <legend className="sr-only">{draft.name || "Income source"}</legend>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-base"
        >
          <IconValue value={draft.icon} className="h-5 w-5 text-lg" />
        </span>
        <label className="min-w-0 flex-1 text-sm text-muted">
          Income name
          <input
            type="text"
            value={draft.name}
            onChange={(event) =>
              onChange(draft.key, { name: event.target.value })
            }
            placeholder="e.g. Salary, Rent, Side gig…"
            aria-invalid={draft.errors.name ? true : undefined}
            className={`mt-1.5 h-10 w-full rounded-md border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-muted/50 focus:outline-none focus:ring-2 ${
              draft.errors.name
                ? "border-expense/60 focus:border-expense/60 focus:ring-expense/20"
                : "border-border focus:border-brand-500/60 focus:ring-brand-500/20"
            }`}
          />
          {draft.errors.name && (
            <p role="alert" className="mt-1.5 text-xs text-expense">
              {draft.errors.name}
            </p>
          )}
        </label>
        <div className="w-36 shrink-0">
          <IconPicker
            label=""
            value={draft.icon}
            onChange={(icon) =>
              onChange(draft.key, { icon: icon || DEFAULT_ICON })
            }
          />
        </div>
        <button
          type="button"
          onClick={() => onRemove(draft.key)}
          aria-label={`Remove ${draft.name || "this income source"}`}
          className="mt-2 rounded-md p-2 text-muted transition-colors duration-150 ease-premium hover:bg-expense/10 hover:text-expense focus-visible:ring-2 focus-visible:ring-expense/50 focus:outline-none"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AmountField
          label="Expected"
          name="expected"
          draft={draft}
          currency={currency}
          onChange={onChange}
        />
        <AmountField
          label="Received"
          name="received"
          draft={draft}
          currency={currency}
          onChange={onChange}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-surface/70 px-3 py-2">
        <span className="text-xs font-medium text-muted">Difference</span>
        <span className="text-right text-xs font-semibold tabular-nums">
          {status}
        </span>
      </div>
    </fieldset>
  );
}

function AmountField({
  label,
  name,
  draft,
  currency,
  onChange,
}: {
  label: string;
  name: "expected" | "received";
  draft: DraftRow;
  currency: Currency;
  onChange: (key: string, patch: Partial<DraftRow>) => void;
}) {
  const error = draft.errors[name];
  return (
    <label className="text-sm text-muted">
      {label}
      <span className="relative mt-1.5 flex items-center">
        <span className="pointer-events-none absolute left-3 text-sm font-medium text-muted/70">
          {currency === "USD" ? "$" : "₦"}
        </span>
        <input
          type="text"
          inputMode="decimal"
          aria-label={`${label} amount for ${draft.name || "this source"}`}
          placeholder="0.00"
          value={draft[name]}
          onChange={(event) =>
            onChange(draft.key, { [name]: event.target.value })
          }
          aria-invalid={error ? true : undefined}
          className={`h-10 w-full rounded-md border bg-surface pl-7 pr-3 text-sm text-ink tabular-nums transition-colors placeholder:text-muted/50 focus:outline-none focus:ring-2 ${
            error
              ? "border-expense/60 focus:border-expense/60 focus:ring-expense/20"
              : "border-border focus:border-brand-500/60 focus:ring-brand-500/20"
          }`}
        />
      </span>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-expense">
          {error}
        </p>
      )}
    </label>
  );
}
