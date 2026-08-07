"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { IconPicker } from "@/components/ui/IconPicker";
import { useToast } from "@/hooks/useToast";
import { useAppStore } from "@/store/useAppStore";
import {
  formatMoney,
  isMinorUnitsValid,
  minorToInput,
  toMinorUnits,
} from "@/lib/money";
import { formatMonthLabel } from "@/lib/date";
import { DEFAULT_ICON } from "./iconLibrary";
import type { Currency, IncomePlan, Month } from "@/lib/types";

interface IncomeSourceModalProps {
  month: Month;
  plan: IncomePlan | null;
  onClose: () => void;
}

export function IncomeSourceModal({
  month,
  plan,
  onClose,
}: IncomeSourceModalProps) {
  const currency = useAppStore((s) => s.state.settings.currency);
  const setIncomePlan = useAppStore((s) => s.setIncomePlan);
  const { success, error } = useToast();

  const [name, setName] = useState(plan?.name ?? "");
  const [icon, setIcon] = useState(plan?.icon ?? DEFAULT_ICON);
  const [expected, setExpected] = useState(() =>
    plan ? minorToInput(plan.expectedAmount) : "",
  );
  const [received, setReceived] = useState(() =>
    plan ? minorToInput(plan.receivedAmount) : "",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEdit = plan !== null;

  const readAmount = (raw: string): number | null => {
    if (raw.trim() === "") return 0;
    const minor = toMinorUnits(raw);
    if (Number.isNaN(minor) || !isMinorUnitsValid(minor)) return null;
    return minor;
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage("Source name is required");
      error("Source name is required");
      return;
    }
    const expectedAmount = readAmount(expected);
    if (expectedAmount === null) {
      setErrorMessage("Expected amount must be a valid number");
      error("Expected amount must be a valid number");
      return;
    }
    const receivedAmount = readAmount(received);
    if (receivedAmount === null) {
      setErrorMessage("Received amount must be a valid number");
      error("Received amount must be a valid number");
      return;
    }
    if (!isEdit && expectedAmount === 0 && receivedAmount === 0) {
      setErrorMessage("Enter an expected or received amount");
      error("Enter an expected or received amount");
      return;
    }
    const saved = setIncomePlan(month, isEdit ? plan.id : null, {
      name: trimmed,
      icon: icon || DEFAULT_ICON,
      expectedAmount,
      receivedAmount,
    });
    if (!saved) {
      setErrorMessage("Could not save this source.");
      error("Could not save this source.");
      return;
    }
    success(isEdit ? "Income source updated." : "Income source added.");
    onClose();
  };

  const difference = (expectedAmount: number, receivedAmount: number) =>
    expectedAmount - receivedAmount;

  const draftExpected = readAmount(expected) ?? 0;
  const draftReceived = readAmount(received) ?? 0;

  return (
    <Modal
      open
      title={isEdit ? "Edit income source" : "Add income source"}
      onClose={onClose}
    >
      <div className="flex flex-col gap-5">
        <p className="-mt-1 text-sm text-muted">
          This source is planned for{" "}
          <span className="font-semibold text-ink">
            {formatMonthLabel(month)}
          </span>
          .
        </p>
        <div>
          <label
            htmlFor="income-source-name"
            className="mb-2.5 block text-sm font-semibold text-ink"
          >
            Name
          </label>
          <input
            id="income-source-name"
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="e.g., Salary"
            maxLength={40}
            className="h-11 w-full rounded-xl border border-border/80 bg-surface px-3.5 text-sm text-ink transition-colors placeholder:text-muted/50 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          {errorMessage && (
            <p className="mt-1.5 text-sm text-danger">{errorMessage}</p>
          )}
        </div>

        <IconPicker
          label="Icon"
          value={icon}
          onChange={setIcon}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AmountField
            label="Expected"
            value={expected}
            currency={currency}
            onChange={setExpected}
          />
          <AmountField
            label="Received"
            value={received}
            currency={currency}
            onChange={setReceived}
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-canvas/60 px-4 py-3">
          <span className="text-sm font-medium text-muted">
            Difference
          </span>
          <span className="text-sm font-semibold tabular-nums text-ink">
            {formatMoney(
              difference(draftExpected, draftReceived),
              currency,
            )}
          </span>
        </div>

        <div className="flex justify-end gap-3 border-t border-border/60 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isEdit ? "Save changes" : "Add source"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AmountField({
  label,
  value,
  currency,
  onChange,
}: {
  label: string;
  value: string;
  currency: Currency;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor={`income-source-${label.toLowerCase()}`}
        className="mb-2.5 block text-sm font-semibold text-ink"
      >
        {label}
      </label>
      <span className="relative flex items-center">
        <span className="pointer-events-none absolute left-3.5 text-sm font-medium text-muted/70">
          {currency === "USD" ? "$" : "₦"}
        </span>
        <input
          id={`income-source-${label.toLowerCase()}`}
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-xl border border-border/80 bg-surface pl-8 pr-3.5 text-sm text-ink tabular-nums transition-colors placeholder:text-muted/50 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </span>
    </div>
  );
}
