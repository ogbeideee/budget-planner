// Merchant normalization (Prompt 8G) — a reusable, deterministic mechanism
// for extracting and normalizing the merchant/payee component of a bank
// statement narration, WITHOUT destroying the original description.
//
// "Transfer to FRIDAY PATIENCE NISMA | Sterling Bank | 0059375307"
//   → merchant "FRIDAY PATIENCE NISMA" (the recipient)
// "MTN 3.2GB 2 Days Plan" → merchant "MTN" (a known provider)
//
// Everything here is local, offline and deterministic — no external AI, no
// network. The original `description` is never modified; merchant extraction
// only ADDS a normalized side-channel used for category matching, review and
// (via lib/learnedRules.ts) future rule learning.

/** Punctuation-stripping, whitespace-collapsing lowercase match key.
 *  "FRIDAY  PATIENCE,NISMA" → "friday patience nisma". Used ONLY for
 *  matching — display/description text is never rewritten. */
export function normalizeMerchantKey(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Word-boundary substring match on a normalized key — "mtn" matches
 *  "mtn data" but never "mtnhq". */
export function merchantKeyMatches(key: string, text: string): boolean {
  if (key.length === 0) return false;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

/** Known merchants/providers (curated, offline): alias keys + canonical
 *  display name. These are the merchant names the category matcher and the
 *  merchant extractor recognise. Banks and wallets (Wema, Sterling, PalmPay,
 *  OPay, …) are deliberately NOT here — they are transfer counterparties,
 *  not merchants. */
export interface KnownMerchant {
  /** Alias keys (normalized) — abbreviations and common spellings. */
  keys: readonly string[];
  /** Canonical display name for the merchant. */
  canonical: string;
}

export const KNOWN_MERCHANTS: ReadonlyArray<KnownMerchant> = [
  { keys: ["mtn", "mtn nigeria"], canonical: "MTN" },
  { keys: ["airtel", "airtel nigeria"], canonical: "Airtel" },
  { keys: ["9mobile", "etisalat"], canonical: "9mobile" },
  { keys: ["glo", "globacom"], canonical: "Glo" },
  { keys: ["spectranet"], canonical: "Spectranet" },
  { keys: ["smile"], canonical: "Smile" },
  { keys: ["dstv", "dstv nigeria", "d s t v"], canonical: "DSTV" },
  { keys: ["gotv"], canonical: "GoTV" },
  { keys: ["startimes"], canonical: "StarTimes" },
  { keys: ["netflix"], canonical: "Netflix" },
  { keys: ["spotify"], canonical: "Spotify" },
  { keys: ["showmax"], canonical: "Showmax" },
  { keys: ["disney", "disney+", "disneyplus"], canonical: "Disney+" },
  { keys: ["apple tv", "appletv"], canonical: "Apple TV" },
  { keys: ["amazon prime", "prime video"], canonical: "Amazon Prime" },
  { keys: ["youtube premium"], canonical: "YouTube Premium" },
  { keys: ["uber", "uber trip"], canonical: "Uber" },
  { keys: ["bolt"], canonical: "Bolt" },
  { keys: ["indrive", "in drive"], canonical: "inDrive" },
  { keys: ["shoprite"], canonical: "Shoprite" },
  { keys: ["spar"], canonical: "SPAR" },
  { keys: ["checkers"], canonical: "Checkers" },
  { keys: ["justu"], canonical: "Justu" },
  { keys: ["jumia"], canonical: "Jumia" },
  { keys: ["konga"], canonical: "Konga" },
  { keys: ["game stores", "game store"], canonical: "Game" },
  { keys: ["park n shop"], canonical: "Park N Shop" },
  { keys: ["chowdeck"], canonical: "Chowdeck" },
  { keys: ["glovo"], canonical: "Glovo" },
  { keys: ["uber eats"], canonical: "Uber Eats" },
  { keys: ["pizza hut"], canonical: "Pizza Hut" },
  { keys: ["dominos", "domino s"], canonical: "Domino's" },
  { keys: ["kfc"], canonical: "KFC" },
  { keys: ["mcdonalds", "mcdonald s"], canonical: "McDonald's" },
  { keys: ["chicken republic"], canonical: "Chicken Republic" },
  { keys: ["kilimanjaro"], canonical: "Kilimanjaro" },
  { keys: ["tantalizers"], canonical: "Tantalizers" },
  { keys: ["mr bigg", "mr bigg s"], canonical: "Mr Bigg's" },
  { keys: ["total", "total energies"], canonical: "Total" },
  { keys: ["oando"], canonical: "Oando" },
  { keys: ["nnpc"], canonical: "NNPC" },
  { keys: ["conoil"], canonical: "Conoil" },
  { keys: ["11 plc", "eleven plc"], canonical: "11 PLC" },
  { keys: ["medplus"], canonical: "MedPlus" },
  { keys: ["healthplus"], canonical: "HealthPlus" },
];

/** The canonical merchant whose alias appears in `text`, or undefined. */
export function knownMerchantIn(text: string): string | undefined {
  const key = normalizeMerchantKey(text);
  for (const merchant of KNOWN_MERCHANTS) {
    if (merchant.keys.some((alias) => merchantKeyMatches(alias, key))) {
      return merchant.canonical;
    }
  }
  return undefined;
}

/** The canonical merchant that matches a standalone merchant/provider value
 *  (e.g. a parser-extracted `provider` like "MTN"), or undefined. */
export function knownMerchantFor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const key = normalizeMerchantKey(value);
  for (const merchant of KNOWN_MERCHANTS) {
    if (merchant.keys.some((alias) => alias === key || merchantKeyMatches(alias, key))) {
      return merchant.canonical;
    }
  }
  return undefined;
}

export interface MerchantExtraction {
  /** The useful merchant/person component of the narration. */
  merchant: string;
  /** HIGH = a known merchant/provider; MEDIUM = a structured transfer
   *  recipient. Weak/absent narrations return undefined. */
  confidence: "high" | "medium";
}

/** Extracts the useful merchant/payee from a narration WITHOUT touching the
 *  original description. Priority: known merchant in the text → transfer
 *  recipient ("Transfer to X | …" up to the first "|") → none. */
export function extractMerchantFromNarration(
  description: string,
  provider?: string,
): MerchantExtraction | undefined {
  const known = knownMerchantFor(provider) ?? knownMerchantIn(description);
  if (known) return { merchant: known, confidence: "high" };

  const recipient = transferRecipient(description);
  if (recipient) return { merchant: recipient, confidence: "medium" };

  return undefined;
}

/** The recipient after "transfer to/from", up to the first "|" or the end —
 *  a factual fragment of the narration ("Transfer to FRIDAY PATIENCE NISMA |
 *  Sterling Bank | 0059375307" → "FRIDAY PATIENCE NISMA"). */
export function transferRecipient(description: string): string | undefined {
  const match = /transfer\s+(?:to|from)\s+(.+?)(?:\s*\||$)/i.exec(
    String(description ?? "").trim(),
  );
  if (!match) return undefined;
  const recipient = match[1].trim();
  return recipient === "" ? undefined : recipient.slice(0, 80);
}
