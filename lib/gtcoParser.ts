// GTCO (Guaranty Trust Bank) statement parser.
//
// Converts GTCO statement cells (CSV/Excel/PDF rows → string[][]) into the
// normalized bank transaction model (lib/statementTypes.ts) using the GTCO
// column vocabulary: Trans. Date · Value Date · Reference · Debits ·
// Credits · Balance · Originating Branch · Remarks.
//
// GTCO is a COLUMN-HEADER-DRIVEN export, so this parser is a thin spec over
// the shared columnar engine (lib/statementColumnar.ts): columns are matched
// BY HEADER NAME (tolerant of variants like "Transaction Date" or
// "Narration"); positions are only a fallback for headerless files. The
// Remarks narration is the primary description and is preserved verbatim
// (capped) so the classification layer can inspect it later. A single
// malformed row never fails the whole import — bad rows are skipped and
// reported in `errors`. The only GTCO-specific logic is the Originating
// Branch column (`enrich`).

import {
  columnarHeaderScore,
  parseColumnarStatement,
  type ColumnarSpec,
} from "./statementColumnar";
import {
  type BankParseResult,
  type NormalizationContext,
  type StatementRowError,
} from "./statementTypes";
import { MAX_ORIGINAL_DESCRIPTION_LENGTH } from "./statementTypes";

/** Cap for the transient reference (review aid only, never persisted). */
export const MAX_GTCO_REFERENCE_LENGTH = 80;

/** Cap for the transient originating branch. */
export const MAX_GTCO_BRANCH_LENGTH = 60;

export interface GtcoRowError extends StatementRowError {
  reason:
    | "invalid date"
    | "unparseable amount"
    | "missing debit and credit"
    | "conflicting debit and credit"
    | "misaligned row"
    | "invalid amount";
}

/** GTCO parser output — conforms to the bank parser contract (Prompt 7A). */
export type GtcoParseResult = BankParseResult;

const GTCO_SPEC: ColumnarSpec = {
  id: "gtco",
  label: "GTCO",
  idPrefix: "gt-",
  roles: {
    date: { weight: 3, re: /^(trans date|transaction date|posting date|post date)$/ },
    valueDate: { weight: 2, re: /^(value date|val date|booking date)$/ },
    reference: {
      weight: 1,
      re: /^(reference|ref|ref no|ref number|transaction reference)$/,
    },
    debit: {
      weight: 2,
      re: /^(debit|debits|withdrawal|withdrawals|paid out|amount debited|dr)$/,
    },
    credit: {
      weight: 2,
      re: /^(credit|credits|deposit|deposits|paid in|amount credited|cr)$/,
    },
    balance: {
      weight: 2,
      re: /^(balance|bal|running balance|available balance|account balance)$/,
    },
    branch: {
      weight: 1,
      re: /^(originating branch|origin branch|source branch|branch|branch code)$/,
    },
    remarks: {
      weight: 1,
      re: /^(remarks|remark|narration|narrative|description|particulars|details|story|transaction details|transaction description)$/,
    },
  },
  minHeaderScore: 4,
  positional: {
    date: 0,
    valueDate: 1,
    reference: 2,
    debit: 3,
    credit: 4,
    balance: 5,
    branch: 6,
    remarks: 7,
  },
  dateRole: "date",
  descriptionRole: "remarks",
  debitRole: "debit",
  creditRole: "credit",
  balanceRole: "balance",
  referenceRole: "reference",
  valueDateRole: "valueDate",
  referenceMax: MAX_GTCO_REFERENCE_LENGTH,
  enrich: ({ cell, hasColumn }) => {
    const branchCell = cell("branch");
    const originatingBranch =
      branchCell === "" ? undefined : truncate(branchCell, MAX_GTCO_BRANCH_LENGTH);
    // PDF exports print LONG narrations inside the Originating Branch cell
    // (the Remarks cell only ever holds short ones) — when the Remarks cell
    // is empty, the branch cell IS the narration ("635 AKIN ADESOLA NIBSS
    // Instant Payment Outward"). Keep it verbatim so classification can see
    // it; the branch prefix stays truthful to what the statement prints.
    // Only when the statement actually HAS a Remarks column (the PDF quirk)
    // — a remarks-less export's branch cell is just the branch code.
    const remarksCell = cell("remarks");
    const composed =
      hasColumn("remarks") && remarksCell === "" && branchCell !== ""
        ? truncate(branchCell, MAX_ORIGINAL_DESCRIPTION_LENGTH)
        : undefined;
    return {
      ...(originatingBranch === undefined ? {} : { originatingBranch }),
      ...(composed === undefined
        ? {}
        : { description: composed, originalDescription: composed }),
    };
  },
};

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/** Header-vocabulary score for one row — format detection helper
 *  (lib/statementPipeline.ts). */
export function gtcoHeaderScore(row: readonly string[]): number {
  return columnarHeaderScore(GTCO_SPEC, row);
}

export function parseGtcoStatement(
  cells: string[][],
  context: NormalizationContext,
  rowYs?: readonly (number | undefined)[],
): GtcoParseResult {
  return parseColumnarStatement(GTCO_SPEC, cells, context, rowYs);
}
