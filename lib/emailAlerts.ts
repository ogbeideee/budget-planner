/**
 * Bank alert email parsing (FR-24) — allowlist + per-institution templates.
 *
 * Pure and deterministic: no I/O, no network, no AI. Email bodies are parsed
 * entirely here, in-process; nothing is ever sent anywhere.
 *
 * SECURITY POSTURE (see docs/15_EMAIL_PARSING.md):
 *  - `ALERT_SENDERS` is an ALLOWLIST. Mail from any other sender is not
 *    parsed, not stored, and not even retained past the sender check. The
 *    fetch layer is expected to narrow on the server side too, so non-matching
 *    mail is never downloaded in the first place.
 *  - Nothing here can send, move money, or mutate the ledger. The output is a
 *    draft that a human confirms.
 */

/** Institutions with a template. Adding one means adding a data entry. */
export type Institution =
  | "gtbank"
  | "wema"
  | "quickmfb"
  | "zenith"
  | "access"
  | "uba"
  | "kuda"
  | "moniepoint"
  | "palmpay"
  | "opay";

export interface AlertSender {
  institution: Institution;
  /** Human label, shown in the review UI and the settings panel. */
  label: string;
  /**
   * Exact sending domains. A message qualifies only when its From address
   * ends in "@domain" or ".domain" — never a substring match, which
   * "gtbank.com.evil.example" would otherwise pass.
   */
  domains: readonly string[];
}

/**
 * THE ALLOWLIST. Only mail whose From address matches an entry here is ever
 * examined. Everything else is ignored without being read.
 *
 * Domains are the institutions' public alert senders. They are deliberately
 * narrow: a wrong entry here is a privacy failure, not a missing feature.
 */
export const ALERT_SENDERS: readonly AlertSender[] = [
  { institution: "gtbank", label: "GTBank", domains: ["gtbank.com", "gtb.com"] },
  { institution: "wema", label: "Wema Bank", domains: ["wemabank.com"] },
  // NOTE THE DOMAIN. Quick Microfinance Bank sends from quickmart.com, which
  // matches nothing in its brand name. Verified sending domains are the only
  // thing this list may ever contain — brand names are not addresses, and a
  // brand-name fallback would be an allowlist bypass waiting to happen.
  { institution: "quickmfb", label: "Quick Microfinance Bank", domains: ["quickmart.com"] },
  { institution: "zenith", label: "Zenith Bank", domains: ["zenithbank.com"] },
  { institution: "access", label: "Access Bank", domains: ["accessbankplc.com"] },
  { institution: "uba", label: "UBA", domains: ["ubagroup.com"] },
  { institution: "kuda", label: "Kuda", domains: ["kuda.com", "kudabank.com"] },
  { institution: "moniepoint", label: "Moniepoint", domains: ["moniepoint.com"] },
  { institution: "palmpay", label: "PalmPay", domains: ["palmpay.com", "palmpay.africa"] },
  { institution: "opay", label: "OPay", domains: ["opayweb.com", "opay-inc.com"] },
];

/** Normalized From address → the allowlisted sender, or null. */
export function senderFor(fromAddress: string): AlertSender | null {
  const address = String(fromAddress ?? "").trim().toLowerCase();
  // Accept "Name <a@b.com>" as well as a bare address.
  const bracket = /<([^>]+)>/.exec(address);
  const bare = (bracket ? bracket[1] : address).trim();
  const at = bare.lastIndexOf("@");
  if (at === -1) return null;
  const host = bare.slice(at + 1);
  if (host.length === 0) return null;

  for (const sender of ALERT_SENDERS) {
    for (const domain of sender.domains) {
      // Exact host, or a subdomain of it. Never a substring.
      if (host === domain || host.endsWith(`.${domain}`)) return sender;
    }
  }
  return null;
}

/* ------------------------------------------------------------------------ */
/* Templates                                                                  */
/* ------------------------------------------------------------------------ */

/**
 * One institution's extraction rules. DATA, not code: a shared evaluator
 * (`parseAlert`) interprets every template, so supporting a new bank is a new
 * entry in `ALERT_TEMPLATES` — no new parsing logic, no new branch.
 *
 * Each field lists patterns tried IN ORDER; the first one that matches with a
 * usable capture group wins. That lets a template tolerate several layouts
 * from the same sender without a bespoke function.
 */
export interface AlertTemplate {
  institution: Institution;
  /** Optional gate: when present, at least one must match the subject or body,
   *  otherwise the message is treated as not-a-transaction-alert. */
  alertMarkers?: readonly RegExp[];
  /** Capture group 1 = the amount, with or without separators. */
  amount: readonly RegExp[];
  /** Any match means money OUT. Checked before `credit`. */
  debit: readonly RegExp[];
  /** Any match means money IN. */
  credit: readonly RegExp[];
  /** Capture group 1 = merchant/narration. */
  description: readonly RegExp[];
  /** Capture group 1 = a date string handed to `parseAlertDate`. */
  date: readonly RegExp[];
}

/* ------------------------------------------------------------------------ */
/* Money: ONE parser for every confirmed shape                                */
/* ------------------------------------------------------------------------ */

/** Currency symbols seen in this market, plus the majors for resilience. */
const CURRENCY_SYMBOL = String.raw`[₦$£€]`;
/**
 * ISO-4217-shaped code, e.g. NGN, USD.
 *
 * The boundary is asserted only on the OUTER side, because real alerts glue
 * the code to the digits with no space ("NGN7,450.00") as well as separating
 * them ("NGN 3.51"). A `\b` on the inner side fails the glued form, since
 * "N" and "7" are both word characters.
 */
const CURRENCY_CODE_PREFIX = String.raw`\b[A-Z]{3}`;
const CURRENCY_CODE_SUFFIX = String.raw`[A-Z]{3}\b`;

/**
 * A money token in ANY of the shapes real alerts use. Deliberately one
 * expression rather than three, so a fourth institution landing in a similar
 * shape parses without new code:
 *
 *   "NGN 3.51"       code prefix, decimals        (GTBank)
 *   "NGN 26388"      code prefix, NO decimals     (GTBank, same institution)
 *   "3,000.00 NGN"   code SUFFIX, comma groups    (WEMA)
 *   "₦250,000.23"    symbol prefix, comma groups  (Quick Microfinance)
 *   "-28.48"         signed (balances only — never a transaction amount)
 *
 * The currency marker is optional on both sides, so a labelled bare number
 * still parses; templates anchor on the field label for safety.
 */
export const MONEY = String.raw`((?:${CURRENCY_SYMBOL}|${CURRENCY_CODE_PREFIX})?\s*-?\s*\d[\d,]*(?:\.\d{1,2})?\s*(?:${CURRENCY_SYMBOL}|${CURRENCY_CODE_SUFFIX})?)`;

/**
 * Label→value separator, covering every real layout:
 *   "Amount: NGN 26388"        inline colon        (after table flattening)
 *   "Amount:: 800.00 NGN"      doubled colon       (WEMA cell ends in ':')
 *   "Amount\n₦53.75"           value on NEXT line  (Quick Microfinance)
 * At most ONE newline is crossed, so a pattern can never reach past a blank
 * line into an unrelated field.
 */
const LV = String.raw`[ \t]*:*[ \t]*\r?\n?[ \t]*`;

export interface MoneyToken {
  /** Absolute value in minor units. */
  minor: number;
  /** True when the token carried a minus sign. Balances can be negative; a
   *  transaction amount never is. */
  negative: boolean;
}

/**
 * THE shared money parser. Normalizes every confirmed shape — and a plausible
 * fourth — into minor units, keeping the sign as separate information rather
 * than folding it into the value.
 *
 * Returns null rather than guessing on anything it cannot read exactly.
 */
export function parseMoneyToken(raw: string): MoneyToken | null {
  let text = String(raw ?? "").trim();
  if (text.length === 0) return null;

  // Strip a currency marker from either end — prefix and suffix are both real.
  text = text
    .replace(new RegExp(String.raw`^(?:${CURRENCY_SYMBOL}|${CURRENCY_CODE_PREFIX})\s*`), "")
    .replace(new RegExp(String.raw`\s*(?:${CURRENCY_SYMBOL}|${CURRENCY_CODE_SUFFIX})$`), "")
    .trim();

  const negative = text.startsWith("-");
  if (negative) text = text.slice(1).trim();

  // Comma separators are grouping, never decimal, in every sample seen.
  const digits = text.replace(/,/g, "");
  // Decimals are OPTIONAL: GTBank sends both "3.51" and "26388".
  if (!/^\d+(\.\d{1,2})?$/.test(digits)) return null;

  const minor = Math.round(Number(digits) * 100);
  if (!Number.isFinite(minor)) return null;
  return { minor, negative };
}

export const ALERT_TEMPLATES: readonly AlertTemplate[] = [
  {
    // VERIFIED against real GTBank mail (2026-08-27).
    //
    // Structure: an HTML table flattened by `normalizeAlertBody` into
    // "Label: Value" lines. Labels are "Description", "Amount", "Value Date",
    // "Remarks" — NOT the "Desc:/Amt:" the first guess assumed.
    // Amounts are code-prefixed and inconsistently decimal within one sender:
    // "NGN 26388" and "NGN 3.51".
    institution: "gtbank",
    alertMarkers: [
      /transaction\s+notification/i,
      /\b(?:DEBIT|CREDIT)\s+transaction\s+occurred/i,
      /electronic\s+Notification\s+Service/i,
    ],
    amount: [new RegExp(String.raw`\bAmount${LV}${MONEY}`, "i")],
    // Requirement 4: the subject is "Transaction Notification" for BOTH
    // directions, so this reads the body and only the body.
    debit: [/\bDEBIT\s+transaction\s+occurred/i],
    credit: [/\bCREDIT\s+transaction\s+occurred/i],
    // GTBank truncates this mid-word ("...DAVID OSA") and prefixes a ~30-digit
    // reference; `cleanNarration` strips the reference and keeps the rest.
    description: [
      new RegExp(String.raw`\bDescription${LV}(.+)`, "i"),
      new RegExp(String.raw`\bRemarks${LV}(.+)`, "i"),
    ],
    // "Value Date: 2026-07-30". Loose between label and value because the
    // label varies ("Value Date", "Transaction Date & Time:").
    date: [
      /\bValue Date[^0-9]{0,12}([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
      /\bDate[^0-9]{0,24}([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
      /\bDate[^0-9]{0,24}([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i,
    ],
  },
  {
    // VERIFIED against real Wema mail (2026-08-27).
    //
    // Same flattened-table structure as GTBank, but the amount carries a
    // currency-code SUFFIX ("3,000.00 NGN") and the label is "Transaction
    // Amount". Dates are DD-MM-YYYY.
    institution: "wema",
    // The first guess used /transaction\s+alert/, /\bwema\b/ and
    // /has been (debited|credited)/ — NONE of which appear. Real mail says
    // "a Debit transaction recently occurred" and "Transaction Details -
    // Debit", and the only "wema" is inside "wemabank.com", where \b fails.
    alertMarkers: [
      /transaction\s+recently\s+occurred/i,
      /Transaction\s+Details\s*-\s*(?:Debit|Credit)/i,
      /wemabank/i,
    ],
    amount: [
      new RegExp(String.raw`Transaction Amount${LV}${MONEY}`, "i"),
      new RegExp(String.raw`\bAmount${LV}${MONEY}`, "i"),
    ],
    debit: [/\bDebit\s+transaction\s+recently\s+occurred/i, /Transaction\s+Details\s*-\s*Debit/i],
    credit: [/\bCredit\s+transaction\s+recently\s+occurred/i, /Transaction\s+Details\s*-\s*Credit/i],
    description: [new RegExp(String.raw`\bDescription${LV}(.+)`, "i")],
    date: [
      /\bValue Date[^0-9]{0,12}([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i,
      /\bDate[^0-9]{0,24}([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i,
      /\bDate[^0-9]{0,24}([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
    ],
  },
  {
    // VERIFIED against real Quick Microfinance mail (2026-08-27).
    //
    // NOT a table. Labels sit on their OWN line with the value on the next —
    // "Amount\n₦53.75", "Narration\nFT_Out Fee:..." — which `LV` handles by
    // allowing exactly one newline. Amounts are ₦-symbol prefixed.
    institution: "quickmfb",
    alertMarkers: [
      /\bquick\s*(?:microfinance|mfb)\b/i,
      /has\s+been\s+(?:debited|credited)/i,
      /Money\s+(?:Debited|Received)/i,
    ],
    amount: [new RegExp(String.raw`\bAmount${LV}${MONEY}`, "i")],
    debit: [/has\s+been\s+debited/i, /Money\s+Debited/i, /Transaction Type\s*\n?\s*Debit/i],
    credit: [/has\s+been\s+credited/i, /Money\s+Received/i, /Transaction Type\s*\n?\s*Credit/i],
    description: [new RegExp(String.raw`\bNarration${LV}(.+)`, "i")],
    date: [
      /Transaction Date[^0-9]{0,20}([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i,
      /\bon\s*\n?\s*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i,
    ],
  },

  // ---------------------------------------------------------------------
  // BELOW: still only tested against REPRESENTATIVE formats, not real mail.
  // Treat these as unverified until samples arrive; see 15_EMAIL_PARSING.md.
  // ---------------------------------------------------------------------
  {
    institution: "access",
    alertMarkers: [/has\s+been\s+(?:debited|credited)/i, /transaction\s+notification/i],
    amount: [
      new RegExp(String.raw`(?:debited|credited)\s+with\s+${MONEY}`, "i"),
      new RegExp(String.raw`Amount\s*:?\s*${MONEY}`, "i"),
    ],
    debit: [/has\s+been\s+debited/i, /\bdebit\b/i],
    credit: [/has\s+been\s+credited/i, /\bcredit\b/i],
    description: [/Desc(?:ription)?\s*:?\s*(.+)/i, /Narration\s*:?\s*(.+)/i],
    date: [/\bon\s+([0-9]{1,2}[-/][A-Za-z]{3,}[-/][0-9]{2,4})/i,
           /\bon\s+([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i],
  },
  {
    institution: "kuda",
    alertMarkers: [/you\s+(?:sent|received|spent)/i, /kuda/i],
    amount: [
      new RegExp(String.raw`You\s+(?:sent|received|spent)\s+${MONEY}`, "i"),
      new RegExp(String.raw`Amount\s*:?\s*${MONEY}`, "i"),
    ],
    debit: [/you\s+(?:sent|spent)/i, /\bdebit\b/i],
    credit: [/you\s+received/i, /\bcredit\b/i],
    description: [/(?:sent|spent)\s+[^\s]+\s+to\s+(.+?)\s+on\s/i,
                  /received\s+[^\s]+\s+from\s+(.+?)\s+on\s/i],
    date: [/\bon\s+([0-9]{1,2}\s+[A-Za-z]{3,}\s+[0-9]{4})/i,
           /\bon\s+([0-9]{4}-[0-9]{2}-[0-9]{2})/i],
  },
  {
    institution: "opay",
    alertMarkers: [/debit\s+alert/i, /credit\s+alert/i, /opay/i],
    amount: [new RegExp(String.raw`Amount\s*:?\s*${MONEY}`, "i")],
    debit: [/debit\s+alert/i],
    credit: [/credit\s+alert/i],
    description: [/\bTo\s*:\s*(.+)/i, /\bFrom\s*:\s*(.+)/i, /Remark\s*:?\s*(.+)/i],
    date: [/Date\s*:?\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
           /Date\s*:?\s*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i],
  },
  {
    institution: "palmpay",
    alertMarkers: [/palmpay/i, /transaction\s+(?:alert|notification)/i],
    amount: [new RegExp(String.raw`Amount\s*:?\s*${MONEY}`, "i")],
    debit: [/\bdebit\b/i, /\bsent\b/i, /\bpayment\s+to\b/i],
    credit: [/\bcredit\b/i, /\breceived\b/i],
    description: [/(?:Merchant|Beneficiary|Payee)\s*:?\s*(.+)/i, /\bTo\s*:\s*(.+)/i],
    date: [/(?:Date|Time)\s*:?\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
           /(?:Date|Time)\s*:?\s*([0-9]{1,2}[-/][A-Za-z]{3,}[-/][0-9]{2,4})/i],
  },
  {
    institution: "moniepoint",
    alertMarkers: [/moniepoint/i, /transaction\s+(?:alert|notification)/i],
    amount: [new RegExp(String.raw`Amount\s*:?\s*${MONEY}`, "i")],
    debit: [/\bdebit\b/i, /\bwithdrawal\b/i],
    credit: [/\bcredit\b/i, /\bdeposit\b/i],
    description: [/(?:Narration|Description|Details)\s*:?\s*(.+)/i],
    date: [/Date\s*:?\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
           /Date\s*:?\s*([0-9]{1,2}[-/][A-Za-z]{3,}[-/][0-9]{2,4})/i],
  },
  {
    institution: "zenith",
    alertMarkers: [/zenith/i, /has\s+been\s+(?:debited|credited)/i],
    amount: [
      new RegExp(String.raw`(?:debited|credited)\s+with\s+${MONEY}`, "i"),
      new RegExp(String.raw`Amount\s*:?\s*${MONEY}`, "i"),
    ],
    debit: [/has\s+been\s+debited/i, /\bdebit\b/i],
    credit: [/has\s+been\s+credited/i, /\bcredit\b/i],
    description: [/(?:Narration|Desc(?:ription)?|Remarks?)\s*:?\s*(.+)/i],
    date: [/\bon\s+([0-9]{1,2}[-/][A-Za-z]{3,}[-/][0-9]{2,4})/i,
           /Date\s*:?\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i],
  },
  {
    institution: "uba",
    alertMarkers: [/\bUBA\b/, /has\s+been\s+(?:debited|credited)/i],
    amount: [
      new RegExp(String.raw`(?:debited|credited)\s+with\s+${MONEY}`, "i"),
      new RegExp(String.raw`Amount\s*:?\s*${MONEY}`, "i"),
    ],
    debit: [/has\s+been\s+debited/i, /\bdebit\b/i],
    credit: [/has\s+been\s+credited/i, /\bcredit\b/i],
    description: [/(?:Narration|Desc(?:ription)?|Remarks?)\s*:?\s*(.+)/i],
    date: [/\bon\s+([0-9]{1,2}[-/][A-Za-z]{3,}[-/][0-9]{2,4})/i,
           /Date\s*:?\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i],
  },
];

export function templateFor(institution: Institution): AlertTemplate | null {
  return ALERT_TEMPLATES.find((t) => t.institution === institution) ?? null;
}

/* ------------------------------------------------------------------------ */
/* Shared evaluator                                                           */
/* ------------------------------------------------------------------------ */

/** One message as handed to the parser. Deliberately minimal — the parser
 *  never sees headers, attachments or anything beyond these fields. */
export interface AlertEmail {
  /** Message id from the mail server, used for dedupe across syncs. */
  id: string;
  from: string;
  subject: string;
  /** Plain-text body. HTML is converted upstream before it reaches here. */
  body: string;
  /** The server's own Date header, as an ISO string. Fallback for the
   *  transaction date when the body has none. */
  receivedAt?: string;
}

export type AlertField = "amount" | "direction" | "description" | "date";

export interface ParsedAlert {
  status: "parsed";
  messageId: string;
  institution: Institution;
  label: string;
  /** Minor units, > 0. */
  amount: number;
  direction: "in" | "out";
  description: string;
  /** ISO "YYYY-MM-DD". */
  date: string;
  /** True when the date came from the mail header rather than the body. */
  dateFromHeader: boolean;
}

export interface UnparsedAlert {
  status: "needs-review";
  messageId: string;
  institution: Institution;
  label: string;
  /** Which required fields could not be extracted. */
  missing: AlertField[];
  /** Whatever WAS extracted, so the user completes rather than retypes. */
  partial: {
    amount?: number;
    direction?: "in" | "out";
    description?: string;
    date?: string;
  };
  /** A short excerpt of the body so the user can see what arrived. Capped —
   *  the point is to identify the transaction, not to mirror the inbox. */
  snippet: string;
}

export interface IgnoredAlert {
  status: "ignored";
  reason: "sender-not-allowlisted" | "not-a-transaction-alert";
}

export type AlertResult = ParsedAlert | UnparsedAlert | IgnoredAlert;

/** How much of the body is retained for a needs-review row. */
export const SNIPPET_MAX_CHARS = 400;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** "12-Aug-2026", "12 August 2026", "2026-08-12", "12/08/2026" → ISO, or null.
 *  Day-first for the numeric form: these are Nigerian alerts, not US ones. */
export function parseAlertDate(raw: string): string | null {
  const text = String(raw ?? "").trim();
  if (text.length === 0) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const named = /^(\d{1,2})[-/\s]+([A-Za-z]{3,})[-/\s]+(\d{2,4})/.exec(text);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (month) {
      const year = named[3].length === 2 ? 2000 + Number(named[3]) : Number(named[3]);
      return `${year}-${String(month).padStart(2, "0")}-${named[1].padStart(2, "0")}`;
    }
    return null;
  }

  const numeric = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/.exec(text);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

/**
 * A TRANSACTION amount in minor units, in any confirmed currency shape.
 *
 * Delegates to the one shared `parseMoneyToken`, then applies the rule that
 * distinguishes an amount from a balance: **a transaction amount is never
 * negative**. GTBank really does send "Available Balance : NGN -28.48"; that
 * is context, not the amount, and must never become a −28.48 transaction.
 */
export function parseAlertAmount(raw: string): number | null {
  const token = parseMoneyToken(raw);
  if (!token) return null;
  if (token.negative) return null;
  return token.minor > 0 ? token.minor : null;
}

/**
 * Lines that state a BALANCE, never an amount. Removed from the haystack
 * before amount extraction so a generic money pattern cannot pick up
 * "Available Balance : NGN -28.48" (or a positive balance) as the
 * transaction. Applied for every template, present and future — this is a
 * property of bank alerts, not of one institution.
 */
const BALANCE_LINE = /balance|bal\s*[:.]|avail\s*bal/i;

function withoutBalanceLines(text: string): string {
  const lines = text.split(/\r?\n/);
  const keep: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!BALANCE_LINE.test(lines[i])) {
      keep.push(lines[i]);
      continue;
    }
    // A balance LABEL with no figure on it means the value sits on the next
    // line (Quick Microfinance: "Current Available Balance" / "₦250,765.10").
    // Dropping only the label would leave the figure behind as an orphan.
    if (!/\d/.test(lines[i])) i += 1;
  }
  return keep.join("\n");
}


/**
 * Flattens the pipe-delimited tables GTBank and Wema send once their HTML is
 * converted to text:
 *
 *   "| Description | : | ALAT NIP TRANSFER |"  →  "Description: ALAT NIP TRANSFER"
 *
 * Without this every label-anchored pattern fails, because the label and its
 * value are separated by " | : | " rather than ": ". Non-table lines pass
 * through untouched, so prose formats (Kuda, Quick Microfinance) are
 * unaffected.
 */
export function normalizeAlertBody(body: string): string {
  return String(body ?? "")
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|")) return line;
      const cells = trimmed
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);
      if (cells.length === 0) return "";
      // "Label | : | Value" — the middle cell is just the separator.
      if (cells.length >= 3 && cells[1] === ":") {
        return `${cells[0]}: ${cells.slice(2).join(" ")}`;
      }
      if (cells.length === 2 && cells[1] === ":") return `${cells[0]}:`;
      return cells.join(" ");
    })
    .join("\n");
}

/** Noise segments in an underscore composite narration. */
const NARRATION_NOISE = /^(?:ft|out|in|fee|nip|trf|transfer|tp|web|pos|ussd|mob|chg|vat|comm)$/i;

/**
 * Reduces a narration to the cleanest merchant-identifying text available.
 *
 * Real narration quality varies BY DIRECTION within a single sender: Quick
 * Microfinance credits read "July 2026 Bestaf Tech Staff Salary" (already
 * clean) while its debits read "FT_Out Fee:NAME_PHONE_MERCHANT_TYPE" — an
 * underscore composite. Passing the composite through verbatim would hand the
 * categorization engine a key that can never match anything, so the
 * merchant-ish segment is extracted instead.
 *
 * Deliberately conservative: a string with no underscores is returned as-is,
 * so clean prose (and GTBank's mid-word-truncated descriptions) are untouched.
 */
export function cleanNarration(raw: string): string {
  let text = String(raw ?? "").trim();
  if (text.length === 0) return "";

  // A long digit run at the front is a bank reference, never a merchant.
  // GTBank really sends
  //   "100004260730180812166829083192-TRANSFER FROM ...".
  // Left in place it makes every transaction's categorization key unique, so
  // a learned rule could never match twice.
  text = text.replace(/^\d{8,}[-_\s]+/, "").trim();
  if (text.length === 0) return String(raw ?? "").trim();

  // No composite structure — leave human-readable text exactly alone. This is
  // what keeps clean prose and bank-truncated descriptions untouched.
  if (!text.includes("_")) return text.slice(0, 200);

  const segments = text
    .split("_")
    // "FT_Out Fee:DAVID ..." — drop a leading label before a colon.
    .map((part) => part.replace(/^[^:]*:\s*/, "").trim())
    .filter((part) => part.length > 0);

  const isDigits = (part: string) => /^\+?\d[\d\s-]*$/.test(part);

  // PHONE-ANCHORED SELECTION. The confirmed shape is
  //   FT _ Out Fee:ACCOUNT HOLDER _ PHONE _ MERCHANT _ TYPE
  // so the segment immediately AFTER the phone number is the merchant.
  //
  // This replaced a "longest alphabetic segment" heuristic that looked
  // reasonable but picks the ACCOUNT HOLDER on real data — their name is
  // longer than the merchant's. The phone number is a reliable positional
  // anchor; guessing by length is not.
  const phoneAt = segments.findIndex(isDigits);
  if (phoneAt !== -1) {
    const merchant = segments.slice(phoneAt + 1).find(
      (part) => /[A-Za-z]/.test(part) && !NARRATION_NOISE.test(part),
    );
    if (merchant) return merchant.slice(0, 200);
  }

  // No phone anchor: fall back to the longest alphabetic segment that is not
  // obvious transfer noise.
  const usable = segments
    .filter((part) => !isDigits(part))
    .filter((part) => !NARRATION_NOISE.test(part))
    .filter((part) => /[A-Za-z]/.test(part));
  if (usable.length === 0) return text.slice(0, 200);
  return [...usable].sort((a, b) => b.length - a.length)[0].slice(0, 200);
}
function firstCapture(patterns: readonly RegExp[], text: string): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && match[1] !== undefined) {
      const value = match[1].trim();
      if (value.length > 0) return value;
    }
  }
  return null;
}

function anyMatch(patterns: readonly RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/** Trims a captured narration to one clean line. */
function tidyDescription(raw: string): string {
  return raw
    .split(/\r?\n/)[0]
    .replace(/\s{2,}/g, " ")
    .replace(/[.;,\s]+$/, "")
    .trim()
    .slice(0, 200);
}

/**
 * Parses one message against the allowlist and the template registry.
 *
 * Never throws and never returns a half-built transaction: a message whose
 * required fields cannot all be extracted comes back as `needs-review` with
 * whatever WAS found plus a body snippet, so it is visible to the user rather
 * than silently dropped (FR-24 requirement 9).
 */
export function parseAlert(email: AlertEmail): AlertResult {
  const sender = senderFor(email.from);
  if (!sender) return { status: "ignored", reason: "sender-not-allowlisted" };

  const template = templateFor(sender.institution);
  if (!template) return { status: "ignored", reason: "sender-not-allowlisted" };

  const subject = String(email.subject ?? "");
  // Pipe tables are flattened before anything is matched — see
  // `normalizeAlertBody`. Prose bodies pass through unchanged.
  const body = normalizeAlertBody(String(email.body ?? ""));
  const haystack = `${subject}\n${body}`;

  if (template.alertMarkers && !anyMatch(template.alertMarkers, haystack)) {
    // From the right sender, but a statement/marketing mail rather than an
    // alert. Not an error — just not ours.
    return { status: "ignored", reason: "not-a-transaction-alert" };
  }

  const amount = (() => {
    // Balance lines are stripped first — see `withoutBalanceLines`.
    const raw = firstCapture(template.amount, withoutBalanceLines(haystack));
    return raw === null ? null : parseAlertAmount(raw);
  })();

  const direction: "in" | "out" | null = anyMatch(template.debit, haystack)
    ? "out"
    : anyMatch(template.credit, haystack)
      ? "in"
      : null;

  const descriptionRaw = firstCapture(template.description, body);
  const description =
    descriptionRaw === null ? null : cleanNarration(tidyDescription(descriptionRaw));

  const bodyDate = (() => {
    const raw = firstCapture(template.date, haystack);
    return raw === null ? null : parseAlertDate(raw);
  })();
  // The Date header is a legitimate fallback: an alert arrives within seconds
  // of the transaction, so the received date is right far more often than not.
  const headerDate = email.receivedAt ? parseAlertDate(email.receivedAt.slice(0, 10)) : null;
  const date = bodyDate ?? headerDate;

  const missing: AlertField[] = [];
  if (amount === null) missing.push("amount");
  if (direction === null) missing.push("direction");
  if (description === null) missing.push("description");
  if (date === null) missing.push("date");

  if (missing.length > 0) {
    return {
      status: "needs-review",
      messageId: email.id,
      institution: sender.institution,
      label: sender.label,
      missing,
      partial: {
        ...(amount !== null ? { amount } : {}),
        ...(direction !== null ? { direction } : {}),
        ...(description !== null ? { description } : {}),
        ...(date !== null ? { date } : {}),
      },
      snippet: body.replace(/\s+/g, " ").trim().slice(0, SNIPPET_MAX_CHARS),
    };
  }

  return {
    status: "parsed",
    messageId: email.id,
    institution: sender.institution,
    label: sender.label,
    amount: amount as number,
    direction: direction as "in" | "out",
    description: description as string,
    date: date as string,
    dateFromHeader: bodyDate === null,
  };
}

/** Parses a batch, preserving order. Ignored messages are dropped. */
export function parseAlerts(
  emails: readonly AlertEmail[],
): Array<ParsedAlert | UnparsedAlert> {
  const out: Array<ParsedAlert | UnparsedAlert> = [];
  for (const email of emails) {
    const result = parseAlert(email);
    if (result.status !== "ignored") out.push(result);
  }
  return out;
}
