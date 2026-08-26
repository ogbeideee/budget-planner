// Bank parser registry (Prompts 7A + 8J).
//
// The single place the statement pipeline learns about supported banks. A
// parser is a self-contained unit (format detection rules + parse +
// capabilities), so adding a bank is:
//
//   1. a new parser file (e.g. lib/accessParser.ts) conforming to
//      `BankStatementParser` (lib/statementTypes.ts),
//   2. parser tests,
//   3. one entry in BANK_PARSERS below — the detection rule (headerScore +
//      distinctiveTokens + minHeaderScore) + capabilities.
//
// The classification / import engine (statementPipeline, statementClassify,
// statementIdentity, planImport) is never touched. Column-header-driven banks
// (GTCO, OPay, PalmPay's export) can be thin specs over the shared columnar
// engine (lib/statementColumnar.ts) — no new parse loop.

import { gtcoHeaderScore, parseGtcoStatement } from "./gtcoParser";
import { kudaHeaderScore, parseKudaStatement } from "./kudaParser";
import { opayHeaderScore, parseOpayStatement } from "./opayParser";
import { palmpayHeaderScore, parsePalmPayStatement } from "./palmpayParser";
import type { BankStatementParser } from "./statementTypes";

/** Column names that only one bank's exports use — resolves near-ties
 *  between the vocabularies. */
const GTCO_DISTINCTIVE_TOKENS = [
  "originating branch",
  "origin branch",
  "source branch",
  "branch",
  "branch code",
  "posting date",
  "post date",
  "remarks",
  "debits",
  "credits",
] as const;

const OPAY_DISTINCTIVE_TOKENS = [
  "trans time",
  "transaction time",
  "datetime",
  "date time",
  "channel",
  "payment channel",
  "channel name",
  "balance after",
  "description",
  "debit",
  "credit",
] as const;

/** Kuda anchors are PHRASES (its table header is "Date/Time Money In Money
 *  Out Category To/From Description Balance"); "money in"/"money out" alone
 *  are shared with PalmPay, so the phrase set carries the section labels. */
const KUDA_DISTINCTIVE_TOKENS = [
  "date/time",
  "to/from",
  "opening balance",
  "closing balance",
  "spend account",
  "spend + save",
] as const;

/** PalmPay's table header vocabulary — the 5-column signature. Its date/
 *  detail/id tokens overlap with generic exports, but "money in"/"money out"
 *  (as separate (NGN) columns, not Kuda's section labels) are distinctive. */
const PALMPAY_DISTINCTIVE_TOKENS = [
  "transaction detail",
  "money in",
  "money out",
  "transaction id",
] as const;

/** Below this score a header row is not evidence of the bank. */
const MIN_HEADER_SCORE = 5;

/** Kuda needs a HIGHER bar than the shared default: its two strongest
 *  phrases ("opening balance"/"closing balance") alone sum to 6, which a
 *  generic statement could carry without any Kuda anchor — only a statement
 *  with Kuda's section/table vocabulary (≥ 8: totals or table header rows,
 *  which always score 10–11) qualifies. */
const KUDA_MIN_HEADER_SCORE = 8;

/** PalmPay needs a bar above the shared 5 so a generic "Transaction Date +
 *  Transaction Detail + Amount" export (5) never qualifies — the real
 *  PalmPay table header always scores 11 (3+2+2+2+2). */
const PALMPAY_MIN_HEADER_SCORE = 6;

export const BANK_PARSERS: readonly BankStatementParser[] = [
  {
    id: "gtco",
    label: "GTCO",
    headerScore: gtcoHeaderScore,
    distinctiveTokens: GTCO_DISTINCTIVE_TOKENS,
    minHeaderScore: MIN_HEADER_SCORE,
    capabilities: { ocrAware: false, wrappedLines: false },
    parse: parseGtcoStatement,
  },
  {
    id: "opay",
    label: "OPay",
    headerScore: opayHeaderScore,
    distinctiveTokens: OPAY_DISTINCTIVE_TOKENS,
    minHeaderScore: MIN_HEADER_SCORE,
    capabilities: { ocrAware: false, wrappedLines: false },
    parse: parseOpayStatement,
  },
  {
    id: "kuda",
    label: "Kuda",
    headerScore: kudaHeaderScore,
    distinctiveTokens: KUDA_DISTINCTIVE_TOKENS,
    minHeaderScore: KUDA_MIN_HEADER_SCORE,
    capabilities: { ocrAware: true, wrappedLines: true },
    parse: parseKudaStatement,
  },
  {
    id: "palmpay",
    label: "PalmPay",
    headerScore: palmpayHeaderScore,
    distinctiveTokens: PALMPAY_DISTINCTIVE_TOKENS,
    minHeaderScore: PALMPAY_MIN_HEADER_SCORE,
    capabilities: { ocrAware: false, wrappedLines: true },
    parse: parsePalmPayStatement,
  },
];

/** Display labels of every supported bank ("GTCO, OPay, Kuda, PalmPay") —
 *  used in the unsupported-format explanation so it never hard-codes a
 *  bank. */
export function supportedBankList(parsers: readonly BankStatementParser[] = BANK_PARSERS): string {
  return parsers.map((parser) => parser.label).join(", ");
}
