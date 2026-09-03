"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatMoney } from "@/lib/money";
import type { Currency, SavingsPlan, SavingsPlanStatus } from "@/lib/types";

export interface SavingsCompletionPromptProps {
  open: boolean;
  plan: SavingsPlan | null;
  currency: Currency;
  /** The user's choice of what the reached plan becomes. */
  onResolve: (status: SavingsPlanStatus) => void;
  /** Dismiss without deciding — the plan stays active and the prompt is
   *  offered again next time the Savings screen mounts. */
  onDecideLater: () => void;
}

/** Asked (never assumed) when a plan reaches its target while still active:
 *  archive it, keep contributing past the target as an open-ended goal, or
 *  switch it to ongoing maintenance. Nothing changes until the user picks. */
export function SavingsCompletionPrompt({
  open,
  plan,
  currency,
  onResolve,
  onDecideLater,
}: SavingsCompletionPromptProps) {
  if (!plan) return null;
  return (
    <Modal
      open={open}
      onClose={onDecideLater}
      title={`“${plan.name}” reached its target`}
      size="sm"
      footer={
        <Button variant="ghost" onClick={onDecideLater}>
          Decide later
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-secondary">
          You have saved {formatMoney(plan.targetAmount, currency)}. What would
          you like to do with this plan?
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => onResolve("completed")}>
            Mark complete
            <span className="block text-xs font-normal opacity-80">
              Done — keep it on the list as finished
            </span>
          </Button>
          <Button variant="secondary" onClick={() => onResolve("active")}>
            Keep contributing (open-ended)
            <span className="block text-xs font-normal text-muted">
              Stay open — you can keep saving past the target
            </span>
          </Button>
          <Button variant="secondary" onClick={() => onResolve("ongoing")}>
            Switch to ongoing maintenance
            <span className="block text-xs font-normal text-muted">
              Keep it topped up rather than finished
            </span>
          </Button>
          <Button variant="danger" onClick={() => onResolve("archived")}>
            Archive plan
            <span className="block text-xs font-normal opacity-80">
              Hide it — you can find it again under Show archived
            </span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
