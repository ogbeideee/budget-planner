import { describe, expect, it } from "vitest";

import {
  extractMerchantFromNarration,
  KNOWN_MERCHANTS,
  knownMerchantFor,
  knownMerchantIn,
  merchantKeyMatches,
  normalizeMerchantKey,
  transferRecipient,
} from "../merchant";

describe("normalizeMerchantKey", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeMerchantKey("FRIDAY  PATIENCE NISMA")).toBe("friday patience nisma");
  });

  it("strips punctuation and symbols, keeping letters and digits", () => {
    expect(normalizeMerchantKey("MTN 3.2GB, 2 Days Plan!")).toBe("mtn 3 2gb 2 days plan");
    expect(normalizeMerchantKey("Domino's Pizza.")).toBe("domino s pizza");
  });

  it("handles empty/undefined-like input", () => {
    expect(normalizeMerchantKey("")).toBe("");
    expect(normalizeMerchantKey("   ")).toBe("");
  });
});

describe("merchantKeyMatches", () => {
  it("matches only whole words, never substrings", () => {
    expect(merchantKeyMatches("mtn", "mtn data 3 2gb")).toBe(true);
    expect(merchantKeyMatches("mtn", "mtnhq office")).toBe(false);
    expect(merchantKeyMatches("shoprite", "shopping at shoprite lagos")).toBe(true);
  });
});

describe("knownMerchantFor", () => {
  it("resolves providers to their canonical name", () => {
    expect(knownMerchantFor("MTN")).toBe("MTN");
    expect(knownMerchantFor("Airtel")).toBe("Airtel");
    expect(knownMerchantFor("9mobile")).toBe("9mobile");
    expect(knownMerchantFor("Netflix")).toBe("Netflix");
  });

  it("resolves abbreviations and alternate spellings", () => {
    expect(knownMerchantFor("Etisalat")).toBe("9mobile");
    expect(knownMerchantFor("Globacom")).toBe("Glo");
    expect(knownMerchantFor("D.S.T.V")).toBe("DSTV");
  });

  it("returns undefined for banks, wallets and non-merchants", () => {
    expect(knownMerchantFor("PalmPay")).toBeUndefined();
    expect(knownMerchantFor("Wema Bank")).toBeUndefined();
    expect(knownMerchantFor("Sterling")).toBeUndefined();
    expect(knownMerchantFor(undefined)).toBeUndefined();
  });
});

describe("knownMerchantIn", () => {
  it("finds a known merchant inside a narration", () => {
    expect(knownMerchantIn("MTN 3.2GB 2 Days Plan")).toBe("MTN");
    expect(knownMerchantIn("SHOPRITE PURCHASE")).toBe("Shoprite");
    expect(knownMerchantIn("Payment to DSTV Nigeria")).toBe("DSTV");
  });

  it("does not match substrings of other words", () => {
    expect(knownMerchantIn("MTNHQ OFFICE RENT")).toBeUndefined();
  });
});

describe("transferRecipient", () => {
  it("extracts the recipient up to the first separator", () => {
    expect(transferRecipient("Transfer to FRIDAY PATIENCE NISMA | Sterling Bank | 0059375307")).toBe(
      "FRIDAY PATIENCE NISMA",
    );
    expect(transferRecipient("Transfer to JOHN DOE")).toBe("JOHN DOE");
  });

  it("handles 'from' and case variations", () => {
    expect(transferRecipient("transfer from OLAYINKA ADE")).toBe("OLAYINKA ADE");
  });

  it("returns undefined when there is no transfer recipient", () => {
    expect(transferRecipient("CASH DEPOSIT")).toBeUndefined();
    expect(transferRecipient("")).toBeUndefined();
  });
});

describe("extractMerchantFromNarration", () => {
  it("prefers a known merchant over a transfer recipient", () => {
    const result = extractMerchantFromNarration("Mobile Data | MTN | 3.2GB 2 Days Plan");
    expect(result).toEqual({ merchant: "MTN", confidence: "high" });
  });

  it("uses the provider when given", () => {
    expect(extractMerchantFromNarration("Data Bundle Purchase", "MTN")).toEqual({
      merchant: "MTN",
      confidence: "high",
    });
  });

  it("falls back to the transfer recipient at medium confidence", () => {
    expect(extractMerchantFromNarration("Transfer to FRIDAY PATIENCE NISMA | Sterling Bank | 0059375307")).toEqual({
      merchant: "FRIDAY PATIENCE NISMA",
      confidence: "medium",
    });
    expect(extractMerchantFromNarration("NIP Transfer to PALMPAY")).toEqual({
      merchant: "PALMPAY",
      confidence: "medium",
    });
  });

  it("returns undefined for non-merchant narrations", () => {
    expect(extractMerchantFromNarration("CASH DEPOSIT")).toBeUndefined();
    expect(extractMerchantFromNarration("")).toBeUndefined();
  });

  it("never modifies the original description", () => {
    const description = "Transfer to FRIDAY PATIENCE NISMA | Sterling Bank | 0059375307";
    extractMerchantFromNarration(description);
    expect(description).toBe("Transfer to FRIDAY PATIENCE NISMA | Sterling Bank | 0059375307");
  });
});

describe("KNOWN_MERCHANTS", () => {
  it("canonical names are unique (used as matcher keys)", () => {
    const canonicals = KNOWN_MERCHANTS.map((merchant) => merchant.canonical);
    expect(new Set(canonicals).size).toBe(canonicals.length);
  });

  it("covers the common Nigerian providers, delivery apps and chains", () => {
    const names = KNOWN_MERCHANTS.map((merchant) => merchant.canonical);
    for (const expected of [
      "MTN",
      "Airtel",
      "9mobile",
      "Glo",
      "DSTV",
      "GoTV",
      "Netflix",
      "Spotify",
      "Uber",
      "Bolt",
      "Shoprite",
      "SPAR",
      "Chowdeck",
      "KFC",
      "Pizza Hut",
      "Total",
      "Oando",
      "MedPlus",
      "Jumia",
      "Konga",
    ]) {
      expect(names).toContain(expected);
    }
  });
});
