"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AnimatedMoney } from "@/components/ui/AnimatedNumber";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/ui/MetricCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PencilIcon, TargetIcon, TrashIcon } from "@/components/ui/icons";
import { formatDateShort, todayIso } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { planProgress, savingsPace } from "@/lib/savings";
import type {
  Currency,
  SavingsPlan,
  SavingsPlanInput,
  SavingsPlanStatus,
  Transaction,
} from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { useToastStore } from "@/store/useToastStore";
import { SavingsCompletionPrompt } from "./SavingsCompletionPrompt";
import { SavingsContributionModal } from "./SavingsContributionModal";
import { SavingsPlanModal } from "./SavingsPlanModal";

interface PlanWithProgress {
  plan: SavingsPlan;
  progress: ReturnType<typeof planProgress>;
}

const STATUS_ORDER: Record<SavingsPlanStatus, number> = {
  active: 0,
  ongoing: 1,
  completed: 2,
  archived: 3,
};

export function SavingsView() {
  const plans = useAppStore((s) => s.state.savingsPlans);
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const budgets = useAppStore((s) => s.state.budgets);
  const rollovers = useAppStore((s) => s.state.rollovers);
  const currency = useAppStore((s) => s.state.settings.currency);
  const addSavingsPlan = useAppStore((s) => s.addSavingsPlan);
  const updateSavingsPlan = useAppStore((s) => s.updateSavingsPlan);
  const setSavingsPlanStatus = useAppStore((s) => s.setSavingsPlanStatus);
  const deleteSavingsPlan = useAppStore((s) => s.deleteSavingsPlan);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const toast = useToastStore((s) => s.push);

  const today = todayIso();
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SavingsPlan | null>(null);
  const [contributingPlan, setContributingPlan] = useState<SavingsPlan | null>(
    null,
  );
  const [deletingPlan, setDeletingPlan] = useState<SavingsPlan | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  // Completion prompts closed without deciding this session. They return on
  // the next visit — the question is never answered silently for the user.
  const [dismissedPrompts, setDismissedPrompts] = useState<string[]>([]);

  const tracked = useMemo<PlanWithProgress[]>(
    () =>
      plans
        .map((plan) => ({ plan, progress: planProgress(plan, transactions) }))
        .sort(
          (a, b) =>
            STATUS_ORDER[a.plan.status] - STATUS_ORDER[b.plan.status] ||
            a.plan.createdAt.localeCompare(b.plan.createdAt),
        ),
    [plans, transactions],
  );

  const visible = tracked.filter(
    (entry) => showArchived || entry.plan.status !== "archived",
  );

  // The completion prompt is DERIVED state: any plan still `active` whose
  // target is reached and whose completion was never acknowledged. Resolving
  // it changes the plan's status; nothing is picked for the user.
  const promptPlan =
    tracked.find(
      ({ plan, progress }) =>
        plan.status === "active" &&
        progress.complete &&
        !plan.completedAt &&
        !dismissedPrompts.includes(plan.id),
    )?.plan ?? null;

  const live = tracked.filter((entry) => entry.plan.status !== "archived");
  const totalSaved = live.reduce((sum, entry) => sum + entry.progress.saved, 0);
  const totalTarget = live.reduce(
    (sum, entry) => sum + entry.progress.target,
    0,
  );

  const submitPlan = (input: SavingsPlanInput) => {
    if (editingPlan) {
      updateSavingsPlan(editingPlan.id, input);
      toast("Savings plan updated");
    } else {
      addSavingsPlan(input);
      toast("Savings plan created");
    }
  };

  const logContribution = (
    plan: SavingsPlan,
    input: { categoryId: string; amount: number; date: string; note?: string },
  ) => {
    // The ordinary transaction-creation path, tagged — the same seam
    // quick-add uses. There is no separate savings write path.
    addTransaction({
      categoryId: input.categoryId,
      amount: input.amount,
      type: "expense",
      date: input.date,
      note: input.note,
      savingsPlanId: plan.id,
    });
    toast(`Contributed ${formatMoney(input.amount, currency)} to ${plan.name}`);
  };

  const resolveCompletion = (plan: SavingsPlan, status: SavingsPlanStatus) => {
    // "Keep contributing" keeps the plan active but stamps that its target
    // was reached, so the prompt does not ask again.
    setSavingsPlanStatus(plan.id, status, {
      stampCompletedAt: status === "active",
    });
  };

  if (plans.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <EmptyState
          icon={<TargetIcon className="h-6 w-6" />}
          title="No savings plans yet"
          description="Create a plan for anything you are setting money aside for — a laptop, an emergency fund, a trip. Log contributions against it and see your pace toward the target."
          action={
            <Button onClick={() => setPlanModalOpen(true)}>New plan</Button>
          }
        />
        {planModalOpen && (
          <SavingsPlanModal
            open={planModalOpen}
            onClose={() => setPlanModalOpen(false)}
            currency={currency}
            onSubmit={submitPlan}
          />
        )}
        <SavingsCompletionPrompt
          open={promptPlan !== null}
          plan={promptPlan}
          currency={currency}
          onResolve={(status) =>
            promptPlan && resolveCompletion(promptPlan, status)
          }
          onDecideLater={() =>
            promptPlan &&
            setDismissedPrompts((current) => [...current, promptPlan.id])
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Header
        action={
          <div className="flex items-center gap-2">
            {plans.some((plan) => plan.status === "archived") && (
              <Button
                variant="ghost"
                onClick={() => setShowArchived((current) => !current)}
              >
                {showArchived ? "Hide archived" : "Show archived"}
              </Button>
            )}
            <Button
              onClick={() => {
                setEditingPlan(null);
                setPlanModalOpen(true);
              }}
            >
              New plan
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricCard
          label="Total saved"
          value={<AnimatedMoney value={totalSaved} currency={currency} />}
          support={
            totalTarget > 0 ? (
              <>
                of{" "}
                <AnimatedMoney value={totalTarget} currency={currency} />{" "}
                targeted
              </>
            ) : (
              "across your plans"
            )
          }
        />
        <MetricCard
          label="Plans"
          value={live.length}
          support={`${live.filter((entry) => entry.progress.complete).length} at target`}
        />
      </div>

      <div className="flex flex-col gap-4">
        {visible.map(({ plan, progress }) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            progress={progress}
            transactions={transactions}
            currency={currency}
            today={today}
            onContribute={() => setContributingPlan(plan)}
            onEdit={() => {
              setEditingPlan(plan);
              setPlanModalOpen(true);
            }}
            onArchive={() => setSavingsPlanStatus(plan.id, "archived")}
            onUnarchive={() => setSavingsPlanStatus(plan.id, "active")}
            onComplete={() => setSavingsPlanStatus(plan.id, "completed")}
            onReopen={() => setSavingsPlanStatus(plan.id, "active")}
            onDelete={() => setDeletingPlan(plan)}
          />
        ))}
      </div>

      {planModalOpen && (
        <SavingsPlanModal
          key={editingPlan?.id ?? "new"}
          open={planModalOpen}
          onClose={() => {
            setPlanModalOpen(false);
            setEditingPlan(null);
          }}
          currency={currency}
          plan={editingPlan ?? undefined}
          onSubmit={submitPlan}
        />
      )}
      {contributingPlan && (
        <SavingsContributionModal
          key={contributingPlan.id}
          open
          onClose={() => setContributingPlan(null)}
          plan={contributingPlan}
          currency={currency}
          categories={categories}
          transactions={transactions}
          budgets={budgets}
          rollovers={rollovers}
          onSubmit={(input) => logContribution(contributingPlan, input)}
        />
      )}
      <SavingsCompletionPrompt
        open={promptPlan !== null}
        plan={promptPlan}
        currency={currency}
        onResolve={(status) =>
          promptPlan && resolveCompletion(promptPlan, status)
        }
        onDecideLater={() =>
          promptPlan &&
          setDismissedPrompts((current) => [...current, promptPlan.id])
        }
      />
      <ConfirmDialog
        open={deletingPlan !== null}
        title="Delete savings plan"
        message={`Delete “${deletingPlan?.name ?? ""}”? Only plans with no contributions can be deleted — a plan with ledger history should be archived instead.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (deletingPlan) {
            const result = deleteSavingsPlan(deletingPlan.id);
            if (!result.ok) {
              toast(
                "This plan has contributions — archive it instead",
                "error",
              );
            }
          }
          setDeletingPlan(null);
        }}
        onClose={() => setDeletingPlan(null)}
      />
    </div>
  );
}

function Header({ action }: { action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">Savings</h1>
        <p className="text-sm text-muted">
          Goals you are setting money aside for, tracked independently of your
          monthly budgets.
        </p>
      </div>
      {action}
    </header>
  );
}

function PlanCard({
  plan,
  progress,
  transactions,
  currency,
  today,
  onContribute,
  onEdit,
  onArchive,
  onUnarchive,
  onComplete,
  onReopen,
  onDelete,
}: {
  plan: SavingsPlan;
  progress: ReturnType<typeof planProgress>;
  transactions: Transaction[];
  currency: Currency;
  today: string;
  onContribute: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onComplete: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const pace = savingsPace(plan, transactions, today);
  const complete = progress.complete;
  const openEnded = plan.status === "active" && plan.completedAt !== undefined;
  const hasContributions = progress.contributed > 0;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              complete ? "bg-success-surface text-success" : "bg-savings-surface text-savings-text"
            }`}
          >
            <TargetIcon className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-ink">{plan.name}</h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {plan.status === "archived" ? (
                <Badge variant="neutral">Archived</Badge>
              ) : plan.status === "completed" ? (
                <Badge variant="completed">Complete</Badge>
              ) : plan.status === "ongoing" ? (
                <Badge variant="info">Ongoing</Badge>
              ) : complete ? (
                <Badge variant="success">
                  {openEnded ? "Target reached — open-ended" : "Target reached"}
                </Badge>
              ) : (
                <Badge variant="info">Active</Badge>
              )}
              {plan.targetDate && (
                <Badge variant="neutral">
                  By {formatDateShort(plan.targetDate)}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {plan.status !== "archived" && (
            <Button size="sm" onClick={onContribute}>
              Add contribution
            </Button>
          )}
          {/* Icon-only row buttons are plain <button>s with an explicit
              square: Button's size presets hard-code horizontal padding. */}
          <button
            type="button"
            aria-label={`Edit ${plan.name}`}
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-sidebar-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none"
          >
            <PencilIcon className="h-4 w-4 shrink-0" />
          </button>
          {!hasContributions && (
            <button
              type="button"
              aria-label={`Delete ${plan.name}`}
              onClick={onDelete}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-expense-surface hover:text-danger focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none"
            >
              <TrashIcon className="h-4 w-4 shrink-0" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <CircularProgress
          value={Math.min(1, progress.saved / (progress.target || 1))}
          tone={complete ? "success" : "brand"}
          size={56}
          strokeWidth={6}
        >
          <span className="text-xs font-bold tabular-nums text-ink">
            {progress.pct}%
          </span>
        </CircularProgress>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-sm text-secondary">
              <AnimatedMoney
                value={progress.saved}
                currency={currency}
                className="font-semibold text-ink"
              />{" "}
              of{" "}
              <AnimatedMoney value={progress.target} currency={currency} />
            </span>
            {!complete && progress.remaining > 0 && (
              <span className="text-xs text-muted">
                <AnimatedMoney
                  value={progress.remaining}
                  currency={currency}
                />{" "}
                to go
              </span>
            )}
            {complete && (
              <span className="text-xs font-semibold text-success">
                Target reached
              </span>
            )}
          </div>
          <ProgressBar
            value={Math.min(1, progress.saved / (progress.target || 1))}
            tone={complete ? "success" : "brand"}
          />
          <PaceLine plan={plan} pace={pace} currency={currency} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {plan.status === "active" && !complete && (
          <Button size="sm" variant="ghost" onClick={onComplete}>
            Mark complete
          </Button>
        )}
        {plan.status === "ongoing" && (
          <Button size="sm" variant="ghost" onClick={onComplete}>
            Mark complete
          </Button>
        )}
        {(plan.status === "completed" || plan.status === "ongoing") && (
          <Button size="sm" variant="ghost" onClick={onReopen}>
            Reopen
          </Button>
        )}
        {plan.status !== "archived" ? (
          <Button size="sm" variant="ghost" onClick={onArchive}>
            Archive
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onUnarchive}>
            Restore
          </Button>
        )}
      </div>
    </Card>
  );
}

/** The on-track / behind-schedule verdict. Plans without a target date have
 *  no deadline to judge — they render a plain open-ended line instead. */
function PaceLine({
  plan,
  pace,
  currency,
}: {
  plan: SavingsPlan;
  pace: ReturnType<typeof savingsPace>;
  currency: Currency;
}) {
  if (!pace) {
    return (
      <p className="text-xs text-muted">
        Open-ended — no target date, so progress is tracked without a
        schedule.
      </p>
    );
  }
  if (pace.status === "complete") {
    return (
      <p className="text-xs text-success">
        On track — target reached
        {plan.targetDate
          ? ` with ${formatDateShort(plan.targetDate)} still ahead`
          : ""}
        .
      </p>
    );
  }
  const required = formatMoney(pace.requiredPerMonth ?? 0, currency);
  const current = formatMoney(pace.currentPerMonth, currency);
  if (pace.status === "on-track") {
    return (
      <p className="text-xs text-success">
        On track — averaging {current}/mo; {required}/mo reaches the target
        by {formatDateShort(plan.targetDate!)}.
      </p>
    );
  }
  return (
    <p className="text-xs text-warn-text">
      Behind schedule — need {required}/mo to hit the target by{" "}
      {formatDateShort(plan.targetDate!)}
      {pace.monthsRemaining <= 0
        ? " (the target date has passed)"
        : ` (currently averaging ${current}/mo)`}
      .
    </p>
  );
}
