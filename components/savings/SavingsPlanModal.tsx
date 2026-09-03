"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { isIsoDate } from "@/lib/date";
import { isMinorUnitsValid, minorToInput, toMinorUnits } from "@/lib/money";
import type { Currency, SavingsPlan, SavingsPlanInput } from "@/lib/types";

export interface SavingsPlanModalProps {
  open: boolean;
  onClose: () => void;
  currency: Currency;
  /** Present means editing that plan; absent means creating a new one. */
  plan?: SavingsPlan;
  onSubmit: (input: SavingsPlanInput) => void;
}

/** Create/edit form for a savings plan (FR-28). A draft seeded from a prop is
 *  the documented lazy-initializer case: the modal is remounted with a key
 *  when the target plan changes, never synced. */
export function SavingsPlanModal({
  open,
  onClose,
  currency,
  plan,
  onSubmit,
}: SavingsPlanModalProps) {
  const symbol = currency === "NGN" ? "₦" : "$";
  const [name, setName] = useState(plan?.name ?? "");
  const [targetInput, setTargetInput] = useState(
    plan ? minorToInput(plan.targetAmount) : "",
  );
  const [startingInput, setStartingInput] = useState(
    plan ? minorToInput(plan.startingBalance) : "",
  );
  const [targetDate, setTargetDate] = useState(plan?.targetDate ?? "");

  const target = toMinorUnits(targetInput);
  const starting = toMinorUnits(startingInput);
  const nameError = name.trim() === "" ? "Give the plan a name" : undefined;
  const targetError =
    targetInput.trim() === "" || !isMinorUnitsValid(target)
      ? "Enter the amount you want to reach"
      : undefined;
  const startingError =
    startingInput.trim() !== "" && !isMinorUnitsValid(starting)
      ? "Enter a valid amount"
      : undefined;
  const valid = !nameError && !targetError && !startingError;

  const submit = () => {
    if (!valid) return;
    onSubmit({
      name: name.trim(),
      targetAmount: target,
      targetDate: targetDate && isIsoDate(targetDate) ? targetDate : undefined,
      startingBalance: starting > 0 ? starting : undefined,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={plan ? "Edit savings plan" : "New savings plan"}
      closeButton
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid}>
            {plan ? "Save changes" : "Create plan"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Plan name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. New laptop, Emergency fund"
          error={nameError}
        />
        <Input
          label="Target amount"
          prefix={symbol}
          value={targetInput}
          onChange={(event) => setTargetInput(event.target.value)}
          placeholder="0.00"
          inputMode="decimal"
          error={targetError}
        />
        <Input
          label="Starting balance (optional)"
          prefix={symbol}
          value={startingInput}
          onChange={(event) => setStartingInput(event.target.value)}
          placeholder="0.00"
          inputMode="decimal"
          error={startingError}
        />
        <Input
          label="Target date (optional)"
          type="date"
          value={targetDate}
          onChange={(event) => setTargetDate(event.target.value)}
        />
        <p className="text-xs text-muted">
          Contributions you log from the Savings screen are tracked against
          this plan. A target date adds an on-track / behind-schedule check;
          leaving it off keeps the goal open-ended.
        </p>
      </div>
    </Modal>
  );
}
