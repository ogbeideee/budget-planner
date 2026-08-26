"use client";

import { formatDateShort } from "@/lib/date";
import { categoryLabelOr } from "@/lib/categoryDisplay";
import {
  describeDuplicateReasons,
  type DuplicateCandidate,
} from "@/lib/duplicateScore";
import { formatMoney } from "@/lib/money";
import type { Category, Currency } from "@/lib/types";
import type { DuplicateResolution } from "@/lib/statementPipeline";

export interface DuplicateResolutionPanelProps {
  /** The incoming row, already formatted by the caller. */
  incoming: {
    date: string | null;
    amountLabel: string;
    description: string;
    categoryId: string | null;
  };
  candidates: DuplicateCandidate[];
  categories: Category[];
  currency: Currency;
  resolution: DuplicateResolution | undefined;
  onResolve: (resolution: DuplicateResolution) => void;
}

const CHOICES: ReadonlyArray<{
  value: Exclude<DuplicateResolution, "unresolved">;
  label: string;
  hint: string;
}> = [
  {
    value: "skip",
    label: "Skip this one",
    hint: "Keep what is already in your budget and do not import this row.",
  },
  {
    value: "import",
    label: "Import anyway",
    hint: "These are genuinely different — add this as its own transaction.",
  },
  {
    value: "replace",
    label: "Replace existing",
    hint: "The imported row has better detail — delete the existing entry and use this.",
  },
];

/**
 * Side-by-side comparison for a row flagged as a likely duplicate, plus the
 * three explicit resolutions.
 *
 * Shows the ACTUAL existing transaction(s) it matched — date, amount,
 * category and description of both sides — rather than an unexplained
 * "possible duplicate" label. A user cannot judge a duplicate they cannot
 * see, and nothing here is auto-resolved: the import stays blocked until a
 * choice is made.
 */
export function DuplicateResolutionPanel({
  incoming,
  candidates,
  categories,
  currency,
  resolution,
  onResolve,
}: DuplicateResolutionPanelProps) {
  if (candidates.length === 0) return null;
  const nameOf = (id: string | null | undefined) =>
    categoryLabelOr(categories.find((c) => c.id === id)?.name, "Uncategorized");

  return (
    <div className="mt-2 rounded-lg border border-warn/40 bg-warn/[0.06] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-warn">
          Looks like {candidates.length === 1 ? "a transaction" : "transactions"} you
          already have
        </p>
        {resolution === undefined || resolution === "unresolved" ? (
          <span className="rounded-full bg-warn/15 px-2 py-0.5 text-caption font-semibold text-warn">
            Choose one to continue
          </span>
        ) : (
          <span className="rounded-full bg-success-surface px-2 py-0.5 text-caption font-semibold text-income">
            {CHOICES.find((c) => c.value === resolution)?.label}
          </span>
        )}
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-border/70 bg-surface p-2.5">
          <p className="text-caption font-semibold uppercase tracking-[0.06em] text-muted">
            From this statement
          </p>
          <dl className="mt-1.5 flex flex-col gap-0.5 text-xs">
            <Row label="Date" value={incoming.date ? formatDateShort(incoming.date) : "—"} />
            <Row label="Amount" value={incoming.amountLabel} />
            <Row label="Category" value={nameOf(incoming.categoryId)} />
            <Row label="Description" value={incoming.description} />
          </dl>
        </div>

        <div className="flex flex-col gap-2">
          {candidates.map((candidate) => (
            <div
              key={candidate.existing.id}
              className="rounded-md border border-border/70 bg-surface p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-caption font-semibold uppercase tracking-[0.06em] text-muted">
                  Already in your budget
                </p>
                <span
                  title={`Duplicate confidence ${Math.round(candidate.score * 100)}%`}
                  className="shrink-0 text-caption font-semibold tabular-nums text-warn"
                >
                  {Math.round(candidate.score * 100)}%
                </span>
              </div>
              <dl className="mt-1.5 flex flex-col gap-0.5 text-xs">
                <Row label="Date" value={formatDateShort(candidate.existing.date)} />
                <Row
                  label="Amount"
                  value={formatMoney(
                    candidate.existing.type === "income"
                      ? candidate.existing.amount
                      : -candidate.existing.amount,
                    currency,
                  )}
                />
                <Row label="Category" value={nameOf(candidate.existing.categoryId)} />
                <Row label="Description" value={candidate.existing.note ?? "—"} />
              </dl>
              <p className="mt-1.5 text-caption text-muted">
                {describeDuplicateReasons(candidate.reasons)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {CHOICES.map((choice) => {
          const active = resolution === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              title={choice.hint}
              aria-pressed={active}
              onClick={(event) => {
                event.stopPropagation();
                onResolve(choice.value);
              }}
              className={`h-8 rounded-md px-2.5 text-xs font-semibold transition-colors duration-150 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none ${
                active
                  ? "bg-brand-600 text-white"
                  : "border border-border bg-surface text-muted hover:border-brand-500/50 hover:text-ink"
              }`}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-ink">{value}</dd>
    </div>
  );
}
