// Transfer relationships and duplicate detection (Prompt 3E).
//
// Runs on CLASSIFIED normalized transactions (3D output) and answers three
// questions without ever deleting, merging or rewriting anything:
//   1. Which rows are probably the SAME transaction repeated (duplicates)?
//   2. Which rows are probably LINKED (a transfer funded by an OWealth
//      withdrawal, savings moved in and out)?
//   3. Which rows are MONEY MOVEMENT (savings / internal-transfer) rather
//      than spending?
//
// Rules (deterministic — same input, same report):
// - Duplicates need MULTIPLE signals. Same amount alone NEVER means
//   duplicate: the same amount legitimately recurs (rent, airtime, repeated
//   transfers). Signals: reference, date, time, amount, direction,
//   description.
// - A repeated row with a DISTINCT timestamp is a legitimate same-day
//   repeated payment, not a duplicate.
// - Links pair a movement row (savings/internal-transfer) with a transfer
//   (funding-pair) or another movement row (savings-movement) that share
//   amount + direction; same date raises confidence to high. A different
//   amount is NO link (partial withdrawals are not confidently paired).
// - Everything stays available for review: the report only references ids.
// - Assumes one source statement (one import session), per the scope.

import type {
  BankTransactionKind,
  NormalizedBankTransaction,
} from "./statementTypes";

export const RELATIONSHIP_SIGNALS = {
  SAME_REFERENCE: "same-reference",
  SAME_DATE: "same-date",
  SAME_TIME: "same-time",
  SAME_AMOUNT: "same-amount",
  SAME_DIRECTION: "same-direction",
  SAME_DESCRIPTION: "same-description",
  SAME_PROVIDER: "same-provider",
} as const;

export type RelationshipSignal = (typeof RELATIONSHIP_SIGNALS)[keyof typeof RELATIONSHIP_SIGNALS];

export interface DuplicateGroup {
  /** Transaction ids, in statement row order. */
  ids: string[];
  confidence: "high" | "medium";
  /** The signals that made the group look duplicate. */
  signals: RelationshipSignal[];
}

export type TransactionLinkKind = "funding-pair" | "savings-movement";

export interface TransactionLink {
  /** Id of the earlier row in the statement. */
  fromId: string;
  toId: string;
  kind: TransactionLinkKind;
  confidence: "high" | "medium";
  signals: RelationshipSignal[];
}

export interface RelationshipReport {
  duplicates: DuplicateGroup[];
  links: TransactionLink[];
  /** Ids of rows classified as money movement (savings / internal-transfer)
   *  — never treated as spending. */
  movementIds: string[];
}

const MOVEMENT_KINDS: ReadonlySet<BankTransactionKind> = new Set([
  "savings",
  "internal-transfer",
]);

/** True when the row moves money between the user's own buckets (savings,
 *  wallet/internal transfers) instead of paying someone or earning. */
export function isMoneyMovement(tx: NormalizedBankTransaction): boolean {
  return MOVEMENT_KINDS.has(tx.type);
}

/** The transaction's effective amount (minor units), or undefined when the
 *  statement gave no amount for its direction. */
function effectiveAmount(tx: NormalizedBankTransaction): number | undefined {
  if (tx.direction === "out") return tx.debitAmount;
  if (tx.direction === "in") return tx.creditAmount;
  return undefined;
}

function normalizedReference(tx: NormalizedBankTransaction): string | undefined {
  const reference = tx.reference?.trim();
  if (!reference) return undefined;
  return reference.toUpperCase().replace(/\s+/g, " ");
}

function normalizedDescription(tx: NormalizedBankTransaction): string | undefined {
  const description = String(tx.description ?? "").trim();
  if (description === "") return undefined;
  return description.toLowerCase().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Duplicates
// ---------------------------------------------------------------------------

function addSignal(signals: RelationshipSignal[], signal: RelationshipSignal): void {
  if (!signals.includes(signal)) signals.push(signal);
}

function mergeGroupSignals(a: DuplicateGroup, b: DuplicateGroup): void {
  for (const signal of b.signals) addSignal(a.signals, signal);
  if (b.confidence === "high") a.confidence = "high";
}

/** Union-find over duplicate groups; pair ids arrive in statement order. */
class DuplicateGroups {
  private readonly groups: DuplicateGroup[] = [];

  addPair(
    aId: string,
    bId: string,
    signals: RelationshipSignal[],
    confidence: "high" | "medium",
  ): void {
    const iA = this.groups.findIndex((group) => group.ids.includes(aId));
    const iB = this.groups.findIndex((group) => group.ids.includes(bId));

    if (iA === -1 && iB === -1) {
      this.groups.push({ ids: [aId, bId], confidence, signals });
      return;
    }
    if (iA === -1) {
      this.groups[iB].ids.push(aId);
      mergeGroupSignals(this.groups[iB], { ids: [], confidence, signals });
      return;
    }
    if (iB === -1) {
      this.groups[iA].ids.push(bId);
      mergeGroupSignals(this.groups[iA], { ids: [], confidence, signals });
      return;
    }
    if (iA !== iB) {
      const [target, source] = iA < iB ? [iA, iB] : [iB, iA];
      this.groups[target].ids.push(...this.groups[source].ids);
      mergeGroupSignals(this.groups[target], this.groups[source]);
      this.groups.splice(source, 1);
    }
  }

  result(rowIndex: Map<string, number>): DuplicateGroup[] {
    return this.groups
      .map((group) => ({
        ids: [...group.ids].sort(
          (a, b) => (rowIndex.get(a) ?? 0) - (rowIndex.get(b) ?? 0),
        ),
        confidence: group.confidence,
        signals: group.signals,
      }))
      .sort(
        (a, b) =>
          (rowIndex.get(a.ids[0]) ?? 0) - (rowIndex.get(b.ids[0]) ?? 0),
      );
  }
}

/** Common duplicate signals for two rows that already match amount +
 *  direction + (date when provided). */
function duplicateSignals(
  a: NormalizedBankTransaction,
  b: NormalizedBankTransaction,
  base: RelationshipSignal[],
): RelationshipSignal[] {
  const signals = [...base];
  if (a.transactionDate === b.transactionDate && a.transactionDate !== null) {
    addSignal(signals, RELATIONSHIP_SIGNALS.SAME_DATE);
  }
  if (a.transactionTime === b.transactionTime && a.transactionTime !== undefined) {
    addSignal(signals, RELATIONSHIP_SIGNALS.SAME_TIME);
  }
  const descriptionA = normalizedDescription(a);
  const descriptionB = normalizedDescription(b);
  if (
    descriptionA !== undefined &&
    descriptionA === descriptionB
  ) {
    addSignal(signals, RELATIONSHIP_SIGNALS.SAME_DESCRIPTION);
  }
  return signals;
}

function detectDuplicates(
  rows: NormalizedBankTransaction[],
  rowIndex: Map<string, number>,
): DuplicateGroup[] {
  const groups = new DuplicateGroups();

  // Pass 1 — authoritative references: same normalized reference + same
  // amount + same direction. Reference equality alone never suffices either.
  const byReference = new Map<string, NormalizedBankTransaction[]>();
  for (const tx of rows) {
    const reference = normalizedReference(tx);
    if (reference === undefined) continue;
    const key = `${reference}::${tx.direction}::${effectiveAmount(tx) ?? "?"}`;
    const bucket = byReference.get(key);
    if (bucket) bucket.push(tx);
    else byReference.set(key, [tx]);
  }
  for (const bucket of byReference.values()) {
    if (bucket.length < 2) continue;
    const signals: RelationshipSignal[] = [
      RELATIONSHIP_SIGNALS.SAME_REFERENCE,
      RELATIONSHIP_SIGNALS.SAME_AMOUNT,
      RELATIONSHIP_SIGNALS.SAME_DIRECTION,
    ];
    for (let i = 1; i < bucket.length; i += 1) {
      groups.addPair(bucket[0].id, bucket[i].id, signals, "high");
    }
  }

  // Pass 2 — identical rows without references: same normalized description +
  // same amount + same direction + same date, and times that don't disprove
  // the match. A distinct timestamp means a legitimate repeated payment.
  const byDescription = new Map<string, NormalizedBankTransaction[]>();
  for (const tx of rows) {
    const description = normalizedDescription(tx);
    if (description === undefined) continue;
    const bucket = byDescription.get(description);
    if (bucket) bucket.push(tx);
    else byDescription.set(description, [tx]);
  }
  for (const bucket of byDescription.values()) {
    if (bucket.length < 2) continue;
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const a = bucket[i];
        const b = bucket[j];
        const amountA = effectiveAmount(a);
        const amountB = effectiveAmount(b);
        if (a.direction !== b.direction || amountA === undefined || amountA !== amountB) {
          continue;
        }
        if (a.transactionDate === null || a.transactionDate !== b.transactionDate) {
          continue;
        }
        const referenceA = normalizedReference(a);
        const referenceB = normalizedReference(b);
        if (referenceA !== undefined && referenceB !== undefined && referenceA !== referenceB) {
          // Different references — the bank issued two transactions.
          continue;
        }
        if (
          a.transactionTime !== undefined &&
          b.transactionTime !== undefined &&
          a.transactionTime !== b.transactionTime
        ) {
          // Distinct timestamps — a same-day repeated payment, not a duplicate.
          continue;
        }
        const confidence: "high" | "medium" =
          a.transactionTime !== undefined && a.transactionTime === b.transactionTime
            ? "high"
            : "medium";
        const signals = duplicateSignals(a, b, [
          RELATIONSHIP_SIGNALS.SAME_AMOUNT,
          RELATIONSHIP_SIGNALS.SAME_DIRECTION,
        ]);
        groups.addPair(a.id, b.id, signals, confidence);
      }
    }
  }

  return groups.result(rowIndex);
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

function linkSignals(
  a: NormalizedBankTransaction,
  b: NormalizedBankTransaction,
): RelationshipSignal[] {
  const signals: RelationshipSignal[] = [
    RELATIONSHIP_SIGNALS.SAME_AMOUNT,
    RELATIONSHIP_SIGNALS.SAME_DIRECTION,
  ];
  if (a.transactionDate !== null && a.transactionDate === b.transactionDate) {
    addSignal(signals, RELATIONSHIP_SIGNALS.SAME_DATE);
  }
  if (
    a.provider !== undefined &&
    b.provider !== undefined &&
    a.provider === b.provider
  ) {
    addSignal(signals, RELATIONSHIP_SIGNALS.SAME_PROVIDER);
  }
  return signals;
}

function detectLinks(rows: NormalizedBankTransaction[]): TransactionLink[] {
  const links: TransactionLink[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      const movementA = isMoneyMovement(a);
      const movementB = isMoneyMovement(b);
      if (movementA === movementB) continue;
      const transfer = movementA ? b : a;
      if (transfer.type !== "transfer") continue;
      const amountA = effectiveAmount(a);
      const amountB = effectiveAmount(b);
      if (
        a.direction === "unknown" ||
        a.direction !== b.direction ||
        amountA === undefined ||
        amountA !== amountB
      ) {
        continue;
      }
      const sameDate = a.transactionDate !== null && a.transactionDate === b.transactionDate;
      const confidence: "high" | "medium" = sameDate ? "high" : "medium";
      links.push({
        fromId: a.id,
        toId: b.id,
        kind: "funding-pair",
        confidence,
        signals: linkSignals(a, b),
      });
    }
  }
  return links;
}

/** Links two movement rows that moved the same amount on the same course
 *  (e.g. auto-save in, then a withdrawal out of savings). */
function detectSavingsMovements(rows: NormalizedBankTransaction[]): TransactionLink[] {
  const links: TransactionLink[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      if (!isMoneyMovement(a) || !isMoneyMovement(b)) continue;
      const amountA = effectiveAmount(a);
      const amountB = effectiveAmount(b);
      if (
        a.direction === "unknown" ||
        a.direction !== b.direction ||
        amountA === undefined ||
        amountA !== amountB
      ) {
        continue;
      }
      const sameDate = a.transactionDate !== null && a.transactionDate === b.transactionDate;
      const confidence: "high" | "medium" = sameDate ? "high" : "medium";
      links.push({
        fromId: a.id,
        toId: b.id,
        kind: "savings-movement",
        confidence,
        signals: linkSignals(a, b),
      });
    }
  }
  return links;
}

/**
 * Builds the relationship report for one import session's normalized
 * transactions. Pure — never mutates its input, never deletes or merges.
 */
export function detectRelationships(
  transactions: readonly NormalizedBankTransaction[],
): RelationshipReport {
  const rows = [...transactions];
  const rowIndex = new Map(rows.map((tx, index) => [tx.id, index]));

  return {
    duplicates: detectDuplicates(rows, rowIndex),
    links: [...detectLinks(rows), ...detectSavingsMovements(rows)],
    movementIds: rows.filter(isMoneyMovement).map((tx) => tx.id),
  };
}