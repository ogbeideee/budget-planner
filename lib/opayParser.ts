// OPay / OWealth statement parser.
//
// Converts OPay statement cells (CSV/Excel/PDF rows → string[][]) into the
// normalized bank transaction model (lib/statementTypes.ts) using the OPay
// column vocabulary: Trans. Time · Value Date · Description · Debit(₦) ·
// Credit(₦) · Balance After(₦) · Channel · Transaction Reference.
//
// OPay is a COLUMN-HEADER-DRIVEN export, so this parser is a thin spec over
// the shared columnar engine (lib/statementColumnar.ts): columns are matched
// BY HEADER NAME (tolerant of variants like "Transaction Date" or
// "Narration", and of currency markers such as "Debit(₦)"); positions are
// only a fallback for headerless files. The complete original description is
// preserved verbatim (capped) for the classification layer; only obvious
// structured facts are lifted out — merchant/recipient and provider from
// "Transfer to X | Y"-style or "Mobile Data | MTN | plan"-style narrations
// (`enrich`, bank-specific). No category classification happens here. A
// single malformed row never fails the whole import — bad rows are skipped
// and reported in `errors`.

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

/** Cap for the transient transaction reference (review aid only). */
export const MAX_OPAY_REFERENCE_LENGTH = 80;

/** Cap for the transient channel (review aid only). */
export const MAX_OPAY_CHANNEL_LENGTH = 40;

/** Cap for extracted merchant/recipient and provider (review aid only). */
export const MAX_OPAY_ENTITY_LENGTH = 80;

export interface OpayRowError extends StatementRowError {
  reason:
    | "invalid date"
    | "unparseable amount"
    | "missing debit and credit"
    | "conflicting debit and credit"
    | "misaligned row"
    | "invalid amount";
}

/** OPay parser output — conforms to the bank parser contract (Prompt 7A). */
export type OpayParseResult = BankParseResult;

/** Splits a "|"-separated OPay narration into its parts ("Transfer to
 *  DAVID OSAHON OGBEIDE | PalmPay" → ["Transfer to DAVID OSAHON OGBEIDE",
 *  "PalmPay"]). */
function narrationParts(description: string): string[] {
  return description
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

const TRANSFER_RECIPIENT_RE = /^(Transfer to|Transfer from)\s+(.+)$/i;

/** Lifts obvious structured facts from the narration. Classification (what a
 *  row MEANS) stays a later phase — only who/through-what is extracted. */
function extractEntities(
  description: string,
): { merchant?: string; provider?: string } {
  const parts = narrationParts(description);
  const head = parts[0] ?? description;
  const merchantMatch = TRANSFER_RECIPIENT_RE.exec(head);
  const merchant = merchantMatch
    ? truncate(merchantMatch[2].trim(), MAX_OPAY_ENTITY_LENGTH)
    : undefined;
  const provider = parts[1]
    ? truncate(parts[1], MAX_OPAY_ENTITY_LENGTH)
    : undefined;
  return { merchant, provider };
}

const OPAY_SPEC: ColumnarSpec = {
  id: "opay",
  label: "OPay",
  idPrefix: "op-",
  roles: {
    time: {
      weight: 3,
      re: /^(trans time|transaction time|datetime|date time|trans date|transaction date)$/,
    },
    valueDate: { weight: 2, re: /^(value date|val date|booking date)$/ },
    description: {
      weight: 1,
      re: /^(description|narration|narrative|remarks|remark|particulars|details|story|transaction details)$/,
    },
    debit: {
      weight: 2,
      re: /^(debit|debits|withdrawal|withdrawals|amount debited|dr)$/,
    },
    credit: {
      weight: 2,
      re: /^(credit|credits|deposit|deposits|amount credited|cr)$/,
    },
    balance: {
      weight: 2,
      re: /^(balance after|balance|running balance|available balance|closing balance)$/,
    },
    channel: { weight: 1, re: /^(channel|payment channel|channel name)$/ },
    reference: {
      weight: 1,
      re: /^(transaction reference|reference|ref|ref no|ref number)$/,
    },
  },
  minHeaderScore: 4,
  positional: {
    time: 0,
    valueDate: 1,
    description: 2,
    debit: 3,
    credit: 4,
    balance: 5,
    channel: 6,
    reference: 7,
  },
  dateRole: "time",
  descriptionRole: "description",
  debitRole: "debit",
  creditRole: "credit",
  balanceRole: "balance",
  referenceRole: "reference",
  valueDateRole: "valueDate",
  referenceMax: MAX_OPAY_REFERENCE_LENGTH,
  enrich: ({ description, cell }) => {
    const { merchant, provider } = extractEntities(description);
    const channelCell = cell("channel");
    const channel =
      channelCell === "" ? undefined : truncate(channelCell, MAX_OPAY_CHANNEL_LENGTH);
    return {
      ...(merchant === undefined ? {} : { merchant }),
      ...(provider === undefined ? {} : { provider }),
      ...(channel === undefined ? {} : { channel }),
    };
  },
};

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/** Header-vocabulary score for one row — format detection helper
 *  (lib/statementPipeline.ts). */
export function opayHeaderScore(row: readonly string[]): number {
  return columnarHeaderScore(OPAY_SPEC, row);
}

export function parseOpayStatement(
  cells: string[][],
  context: NormalizationContext,
  _rowYs?: readonly (number | undefined)[],
): OpayParseResult {
  return parseColumnarStatement(OPAY_SPEC, cells, context);
}
