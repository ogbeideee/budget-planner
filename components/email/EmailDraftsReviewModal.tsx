"use client";

// Email alert review UI (FR-24, sync stage).
//
// Shows the drafts that could NOT be auto-imported: a parse gap (missing
// fields), an uncertain/absent category suggestion, or an unanswered
// duplicate. The user can edit the draft fields, then import through the SAME
// `planImport` / `addTransactions` flow the statement importer uses — no
// parallel transaction-editing system.
//
// Nothing here ever writes to a mailbox: the IMAP session is opened read-only
// in main, and this component's actions only touch the local ledger (through
// the ordinary store actions).
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { AlertTriangleIcon, CheckIcon, XIcon } from "@/components/ui/icons";
import { isIsoDate } from "@/lib/date";
import { categoryDisplay } from "@/lib/categoryRegistry";
import { useEmailSync } from "@/store/useEmailSync";
import { useAppStore } from "@/store/useAppStore";
import { useToastStore } from "@/store/useToastStore";
import { planEmailDraftImport } from "@/lib/emailSyncClient";
import {
  currencySymbol,
  formatMoney,
  minorToInput,
  toMinorUnits,
} from "@/lib/money";
import type { PendingEmailDraft } from "@/lib/emailDrafts";
import type { BankTransactionKind } from "@/lib/statementTypes";
import type { ImportRow } from "@/lib/statementPipeline";

const MISSING_LABELS: Record<string, string> = {
  amount: "amount not readable",
  direction: "debit/credit not readable",
  description: "description not readable",
  date: "date not readable",
};

const MISSING_FIELD_ORDER = ["amount", "direction", "description", "date"];

/** Why this draft was routed to review — the reason line shown to the user. */
function reviewReasons(draft: PendingEmailDraft): string[] {
  const reasons: string[] = [];
  if (draft.needsReview) {
    const spelled = MISSING_FIELD_ORDER.filter((field) =>
      draft.needsReview!.missing.includes(field as never),
    ).map((field) => MISSING_LABELS[field] ?? field);
    reasons.push(`Incomplete parse (${spelled.join(", ")})`);
  }
  if (draft.row.categoryId === null) reasons.push("no category suggestion");
  else if (draft.suggestion && !draft.suggestion.confident) {
    reasons.push("category suggestion needs confirming");
  }
  if (draft.row.duplicateResolution === "unresolved") {
    reasons.push(
      `possible duplicate of an existing entry${
        draft.duplicates[0]?.note ? ` — “${draft.duplicates[0].note}”` : ""
      }`,
    );
  }
  return reasons;
}

function draftAmountMinor(row: ImportRow): number | undefined {
  if (row.type === "income") return row.creditAmount;
  if (row.type === "expense") return row.debitAmount;
  return row.debitAmount ?? row.creditAmount ?? undefined;
}
export function EmailDraftsReviewModal() {
  const open = useEmailSync((s) => s.reviewOpen);
  const setReviewOpen = useEmailSync((s) => s.setReviewOpen);
  const drafts = useEmailSync((s) => s.drafts);
  const removeDraft = useEmailSync((s) => s.removeDraft);

  const categories = useAppStore((s) => s.state.categories);
  const currency = useAppStore((s) => s.state.settings.currency);
  const transactions = useAppStore((s) => s.state.transactions);
  const addTransactions = useAppStore((s) => s.addTransactions);
  const markLearnedRulesUsed = useAppStore((s) => s.markLearnedRulesUsed);
  const learnFromCorrections = useAppStore((s) => s.learnFromCorrections);

  const push = useToastStore((s) => s.push);

  if (!open) return null;

  const importable = drafts.filter(
    (draft) => draft.row.duplicateResolution !== "unresolved",
  );

  /** Imports one draft after the user's edits (or "import anyway"). Writes
   *  through the ordinary confirm path; learns/corrects like the statement
   *  importer does. Returns true when a row actually entered the ledger. */
  const importDraft = (draft: PendingEmailDraft, row: ImportRow): boolean => {
    const plan = planEmailDraftImport(row, transactions);
    if (plan.inputs.length === 0) {
      push(
        plan.missingCategory > 0
          ? "Pick a category for this alert before importing."
          : "Nothing to import — this alert is already in your ledger.",
        plan.missingCategory > 0 ? "error" : "info",
      );
      return false;
    }
    addTransactions(plan.inputs);
    // Usage vs learning, exactly like statement import: keeping the suggested
    // category counts as using the learned rule; changing it is a correction.
    if (draft.suggestion) {
      if (row.categoryId === draft.suggestion.categoryId) {
        markLearnedRulesUsed([draft.suggestion.categoryId]);
      } else if (row.categoryId !== null) {
        learnFromCorrections([
          {
            description: row.description,
            merchant: row.description,
            categoryId: row.categoryId,
          },
        ]);
      }
    }
    removeDraft(draft.messageId);
    push("The alert was imported.", "success");
    return true;
  };

  const importAll = () => {
    let imported = 0;
    for (const draft of importable) {
      if (importDraft(draft, draft.row)) imported += 1;
    }
    if (imported > 0) {
      push(`Imported ${imported} alert${imported === 1 ? "" : "s"}.`, "success");
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => setReviewOpen(false)}
      title="Email alert drafts"
      describedBy="email-drafts-desc"
      size="lg"
      closeButton
      footer={
        <>
          <Button variant="ghost" onClick={() => setReviewOpen(false)}>
            Close
          </Button>
          <Button variant="secondary" onClick={() => void importAll()}>
            Import all ({importable.length})
          </Button>
        </>
      }
    >
      <p id="email-drafts-desc" className="mb-4 text-sm leading-relaxed text-muted">
        These alerts could not be imported automatically. Review each one —
        fix anything missing, then import it. Nothing is saved until you
        confirm, and nothing is ever written back to your mailbox.
      </p>

      {drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm text-muted">
            Nothing waiting for review. New alerts appear here when they need you.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {drafts.map((draft) => (
            <EmailDraftRow
              key={draft.messageId}
              draft={draft}
              categories={categories}
              currency={currency}
              onImport={(row) => importDraft(draft, row)}
              onReject={() => {
                removeDraft(draft.messageId);
                push("Alert ignored.", "info");
              }}
            />
          ))}
        </ul>
      )}
    </Modal>
  );
}
function EmailDraftRow({
  draft,
  categories,
  currency,
  onImport,
  onReject,
}: {
  draft: PendingEmailDraft;
  categories: ReturnType<typeof useAppStore.getState>["state"]["categories"];
  currency: "USD" | "NGN";
  onImport: (row: ImportRow) => void;
  onReject: () => void;
}) {
  // Local draft of the editable fields, seeded once per remount (the store row
  // is the source of truth for every other read). Each import writes the whole
  // edited row through the review path.
  const [draftField, setDraftField] = useState<{
    type: BankTransactionKind;
    categoryId: string;
    amount: string;
    date: string;
    description: string;
  }>(() => ({
    type: draft.row.type ?? "unknown",
    categoryId: draft.row.categoryId ?? "",
    amount: minorToInput(draftAmountMinor(draft.row) ?? 0),
    date: draft.row.transactionDate ?? "",
    description: draft.row.description,
  }));

  const [duplicateChoice, setDuplicateChoice] = useState<"import" | "skip" | null>(
    null,
  );

  const reasons = reviewReasons(draft);
  const amountMinor = draftAmountMinor(draft.row);
  const kind: "income" | "expense" =
    draftField.type === "income" ? "income" : "expense";
  const categoryOptions = categories
    .filter((category) => category.kind === kind)
    .map((category) => ({
      value: category.id,
      label: categoryDisplay(category).name,
    }));

  const buildRow = (): ImportRow => {
    const amount = toMinorUnits(draftField.amount);
    const resolved =
      Number.isFinite(amount) && amount > 0
        ? draftField.type === "income"
          ? { creditAmount: amount }
          : { debitAmount: amount }
        : {};
    const duplicate =
      draft.row.duplicateResolution === "unresolved" && duplicateChoice
        ? {
            duplicateResolution:
              duplicateChoice === "import"
                ? ("import" as const)
                : ("skip" as const),
            duplicateOfId: draft.row.duplicateOfId,
          }
        : {};
    return {
      ...draft.row,
      type: draftField.type,
      categoryId: draftField.categoryId || null,
      transactionDate: isIsoDate(draftField.date) ? draftField.date : null,
      description: draftField.description,
      ...resolved,
      ...duplicate,
    };
  };

  const amountVisible = formatMoney(
    draftField.type === "income"
      ? (draft.row.creditAmount ?? amountMinor ?? 0)
      : (draft.row.debitAmount ?? amountMinor ?? 0),
    currency,
  );

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border/60 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold tracking-tight text-ink">
              {draft.label}
            </p>
            <span className="rounded-full bg-sidebar-hover px-2 py-0.5 text-xs font-medium text-muted">
              {draftField.type === "income" ? "Income" : "Expense"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{amountVisible}</p>
        </div>
        {reasons.length > 0 && (
          <span className="flex max-w-[16rem] flex-wrap justify-end gap-1">
            {reasons.map((reason) => (
              <span
                key={reason}
                className="inline-flex items-center gap-1 rounded-full bg-upcoming-surface px-2 py-0.5 text-xs font-medium text-warn-text"
              >
                <AlertTriangleIcon className="h-3 w-3" />
                {reason}
              </span>
            ))}
          </span>
        )}
      </div>

      {draft.needsReview?.snippet && (
        <p className="max-h-16 overflow-hidden text-xs leading-relaxed text-muted">
          “{draft.needsReview.snippet}”
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Category"
          options={categoryOptions}
          value={draftField.categoryId}
          onChange={(event) =>
            setDraftField((f) => ({ ...f, categoryId: event.target.value }))
          }
        />
        <Select
          label="Type"
          options={[
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
          ]}
          value={draftField.type}
          onChange={(event) =>
            setDraftField((f) => ({
              ...f,
              type: event.target.value as BankTransactionKind,
            }))
          }
        />
        <Input
          label="Amount"
          type="text"
          inputMode="decimal"
          prefix={currencySymbol(currency)}
          value={draftField.amount}
          onChange={(event) =>
            setDraftField((f) => ({ ...f, amount: event.target.value }))
          }
        />
        <Input
          label="Date"
          type="date"
          value={draftField.date}
          onChange={(event) =>
            setDraftField((f) => ({ ...f, date: event.target.value }))
          }
        />
      </div>
      <Input
        label="Description"
        value={draftField.description}
        onChange={(event) =>
          setDraftField((f) => ({ ...f, description: event.target.value }))
        }
      />

      {draft.row.duplicateResolution === "unresolved" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn bg-upcoming-surface px-3 py-2.5">
          <p className="text-xs leading-relaxed text-muted">
            This looks like an existing entry. Choose whether to import it
            anyway or keep the existing one.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={duplicateChoice === "import" ? "primary" : "secondary"}
              onClick={() => setDuplicateChoice("import")}
            >
              Import anyway
            </Button>
            <Button
              size="sm"
              variant={duplicateChoice === "skip" ? "primary" : "secondary"}
              onClick={() => setDuplicateChoice("skip")}
            >
              Keep existing
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-3">
        <Button variant="ghost" size="sm" onClick={onReject}>
          <XIcon className="h-4 w-4" />
          Ignore
        </Button>
        <Button
          size="sm"
          onClick={() => onImport(buildRow())}
          disabled={
            draft.row.duplicateResolution === "unresolved" &&
            duplicateChoice === null
          }
        >
          <CheckIcon className="h-4 w-4" />
          Import
        </Button>
      </div>
    </li>
  );
}