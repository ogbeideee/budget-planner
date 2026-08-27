import { describe, expect, it } from "vitest";
import {
  ALERT_SENDERS,
  ALERT_TEMPLATES,
  cleanNarration,
  normalizeAlertBody,
  parseAlert,
  parseAlertAmount,
  parseMoneyToken,
  senderFor,
  type AlertEmail,
} from "../emailAlerts";

/**
 * REAL (redacted) alert bodies, verbatim.
 *
 * These are the actual emails these three institutions send, not
 * reconstructions. The bodies below are pasted unchanged — including the
 * pipe-delimited table rows GTBank and Wema produce once their HTML is
 * converted to text, and the label-on-its-own-line block layout Quick
 * Microfinance uses.
 *
 * Do not "tidy" them. Their awkwardness is the point: every quirk here broke
 * a template that looked reasonable against invented samples.
 */

const GTBANK_CREDIT: AlertEmail = {
  id: "gt-credit",
  from: "GeNS@gtbank.com",
  subject: "Transaction Notification",
  body: `| | |
| | 7:33:11 PM |
| Dear OGBEIDE DAVID OSAHON |
| |
| #### Guaranty Trust Bank electronic Notification Service (GeNS) |
| |
| We wish to inform you that a CREDIT transaction occurred on your account with us. |
| |
| The details of this transaction are shown below: |
| |
| #### Transaction Notification |

| |
| Account Number | : | ******8272 |
| Transaction Location | : | 205 |
| Description | : | 100004260730180812166829083192-TRANSFER FROM DAVID OSAHON OGBEIDE-OPAY-DAVID OSA |
| Amount | : | NGN 26388 |
| Value Date | : | 2026-07-30 |
| Remarks | : | HON OGBEID E |
| Time of Transaction | : | 7:33:11 PM |
| Document Number | : | 10000426073018081216 |
| |
| The balances on this account as at 7:33:11 PM are as follows; |
| |
| Current Balance | : | NGN 26409.77 |
| Available Balance | : | NGN 3.77 |
| |

| The privacy and security of your Bank Account details is important to us. If you would prefer that we do not display your account balance in every transaction alert sent to you via email please dial *737*51*1#. |
| |
| Thank you for choosing Guaranty Trust Bank Limited |`,
};

const GTBANK_DEBIT: AlertEmail = {
  id: "gt-debit",
  from: "GeNS@gtbank.com",
  subject: "Transaction Notification",
  body: `| | |
| | 9:25:17 PM |
| Dear OGBEIDE DAVID OSAHON |
| |
| #### Guaranty Trust Bank electronic Notification Service (GeNS) |
| |
| We wish to inform you that a DEBIT transaction occurred on your account with us. |
| |
| The details of this transaction are shown below: |
| |
| #### Transaction Notification |

| |
| Account Number | : | ******8272 |
| Transaction Location | : | 201 |
| Description | : | SMS ALERT CHARGE FOR 27-JUN-26 TO 28-JUL-26 |
| Amount | : | NGN 3.51 |
| Value Date | : | 2026-07-30 |
| Remarks | : | SMS ALERT CHARGE FOR 27-JUN-26 TO 28-JUL-26 |
| Time of Transaction | : | 9:25:17 PM |
| Document Number | : | |
| |
| The balances on this account as at 9:25:17 PM are as follows; |
| |
| Current Balance | : | NGN 26406.26 |
| Available Balance | : | NGN -28.48 |
| |

| Thank you for choosing Guaranty Trust Bank Limited |`,
};

const WEMA_DEBIT: AlertEmail = {
  id: "wema-debit",
  from: "alerts@wemabank.com",
  subject: "Transaction Notification",
  body: ` Document

| |

| 25-08-2026 11:46:57 Dear DAVID OSAHON OGBEIDE We wish to inform you that a Debit transaction recently occurred on your bank account. Please find below details of the transaction: |
| Transaction Details - Debit |
| Account Number | : | 0242****34 |
| Account Name | : | DAVID OSAHON OGBEIDE |
| Description | : | ALAT NIP TRANSFER TO DAVID OSAHON OGBEIDE FROM DA |
| Reference Number | : | S37429037 |
| Transaction Amount | : | 800.00 NGN |
| Transaction Date & Time: | : | 25-08-2026 11:46:57 |
| Value Date: | : | 25-08-2026 |

Current Balance as at 25-08-2026 11:46:57 : * 111.81 NGN*

Thank you for banking with us.
*For more information please contact Purple Connect on:*
+234-803-900-3700 (calls Only)
+234-01-277-7700-9

*SMS*
+234-705-111-2111 (SMS Only)
*Email:* purpleconnect@wemabank.com`,
};

const WEMA_CREDIT: AlertEmail = {
  id: "wema-credit",
  from: "alerts@wemabank.com",
  subject: "Transaction Notification",
  body: ` Document

| |

| 24-08-2026 17:04:07 Dear DAVID OSAHON OGBEIDE We wish to inform you that a Credit transaction recently occurred on your bank account. Please find below details of the transaction: |
| Transaction Details - Credit |
| Account Number | : | 0242****34 |
| Account Name | : | DAVID OSAHON OGBEIDE |
| Description | : | NIP:UFY X UNIVERSAL SERVICES LIMITED- Prime |
| Reference Number | : | S36256938 |
| Transaction Amount | : | 3,000.00 NGN |
| Transaction Date & Time: | : | 24-08-2026 17:04:07 |
| Value Date: | : | 24-08-2026 |

Current Balance as at 24-08-2026 17:04:07 : * 3,211.81 NGN*

Thank you for banking with us.
*For more information please contact Purple Connect on:*
+234-803-900-3700 (calls Only)
+234-01-277-7700-9

*SMS*
+234-705-111-2111 (SMS Only)
*Email:* purpleconnect@wemabank.com`,
};

const QUICK_DEBIT: AlertEmail = {
  id: "quick-debit",
  // The brand is "Quick Microfinance Bank"; the domain is quickmart.com.
  from: "no-reply@quickmart.com",
  subject: "Money Debited",
  body: `Money Debited

Dear DAVID OGBEIDE,

Greetings from Quick Microfinance Bank.
₦53.75 has been debited from your account (A/c: ******0277) on
30/07/2026 04:52 PM.
Please find the transaction details below:

Details / Information

Transaction Type
Debit

Amount
₦53.75

Bank Reference Number
C2607300300

Instrument Number
090850260730165227000000142260

Transaction Reference
QMFB00000568603

Narration
FT_Out Fee:DAVID OSAHON OGBEIDE_8082389369_OPAY NIGERIA_Amount Transfer

Transaction Date & Time
30/07/2026 04:52 PM

Current Available Balance
₦250,765.10

Quick Microfinance Bank | Services
Office Address: 151 Ahmadu Bello Way, Victoria Island 106104, Lagos, Nigeria.
Copyright 2026 © Bestaf Payment Solutions Ltd. All Rights Reserved`,
};

const QUICK_CREDIT: AlertEmail = {
  id: "quick-credit",
  from: "no-reply@quickmart.com",
  subject: "Money Received",
  body: `Money Received

Dear DAVID OGBEIDE,

Greetings from Quick Microfinance Bank.
₦250,000.23 has been credited to your account (A/c: ******0277) on
30/07/2026 04:48 PM.
Please find the transaction details below:

Details / Information

Transaction Type
Credit

Amount
₦250,000.23

Bank Reference Number
2607300287

Instrument Number
120020001912674658260730

Transaction Reference
QMFB00000568572

Narration
July 2026 Bestaf Tech Staff Salary

Transaction Date & Time
30/07/2026 04:48 PM

Current Available Balance
₦250,818.85

Quick Microfinance Bank | Services
Office Address: 151 Ahmadu Bello Way, Victoria Island 106104, Lagos, Nigeria.
Copyright 2026 © Bestaf Payment Solutions Ltd. All Rights Reserved`,
};

export const REAL_SAMPLES = [
  GTBANK_CREDIT, GTBANK_DEBIT, WEMA_DEBIT, WEMA_CREDIT, QUICK_DEBIT, QUICK_CREDIT,
];

function parsed(email: AlertEmail) {
  const result = parseAlert(email);
  if (result.status !== "parsed") {
    throw new Error(`${email.id}: expected parsed, got ${result.status}`);
  }
  return result;
}

/* ------------------------------------------------------------------------ */

describe("pipe-table flattening", () => {
  it("turns a 'Label | : | Value' row into 'Label: Value'", () => {
    expect(normalizeAlertBody("| Amount | : | NGN 26388 |")).toBe("Amount: NGN 26388");
  });

  it("keeps a multi-word value intact", () => {
    expect(normalizeAlertBody("| Description | : | ALAT NIP TRANSFER TO DAVID |")).toBe(
      "Description: ALAT NIP TRANSFER TO DAVID",
    );
  });

  it("leaves prose lines completely alone", () => {
    const prose = "₦53.75 has been debited from your account (A/c: ******0277) on";
    expect(normalizeAlertBody(prose)).toBe(prose);
  });

  it("handles a row with no value", () => {
    expect(normalizeAlertBody("| Document Number | : | |")).toBe("Document Number:");
  });
});

describe("the shared money parser against REAL strings", () => {
  it("handles every confirmed shape", () => {
    expect(parseMoneyToken("NGN 26388")).toEqual({ minor: 2638800, negative: false });
    expect(parseMoneyToken("NGN 3.51")).toEqual({ minor: 351, negative: false });
    expect(parseMoneyToken("800.00 NGN")).toEqual({ minor: 80000, negative: false });
    expect(parseMoneyToken("3,000.00 NGN")).toEqual({ minor: 300000, negative: false });
    expect(parseMoneyToken("₦53.75")).toEqual({ minor: 5375, negative: false });
    expect(parseMoneyToken("₦250,000.23")).toEqual({ minor: 25000023, negative: false });
  });

  it("reports GTBank's real negative balance as negative, not as a value", () => {
    expect(parseMoneyToken("NGN -28.48")).toEqual({ minor: 2848, negative: true });
    expect(parseAlertAmount("NGN -28.48")).toBeNull();
  });

  it("absorbs a plausible fourth institution", () => {
    expect(parseMoneyToken("99.99 USD")).toEqual({ minor: 9999, negative: false });
    expect(parseMoneyToken("£12,000")).toEqual({ minor: 1200000, negative: false });
    expect(parseMoneyToken("1,234.50")).toEqual({ minor: 123450, negative: false });
  });
});

describe("GTBank — real mail", () => {
  it("is recognised as an alert at all", () => {
    // The pre-correction template matched none of its markers and discarded
    // every GTBank message as "not-a-transaction-alert".
    expect(parseAlert(GTBANK_DEBIT).status).toBe("parsed");
    expect(parseAlert(GTBANK_CREDIT).status).toBe("parsed");
  });

  it("parses the debit, including the decimal amount", () => {
    expect(parsed(GTBANK_DEBIT)).toMatchObject({
      institution: "gtbank",
      amount: 351,
      direction: "out",
      description: "SMS ALERT CHARGE FOR 27-JUN-26 TO 28-JUL-26",
      date: "2026-07-30",
    });
  });

  it("parses the credit, including the decimal-LESS amount from the same sender", () => {
    expect(parsed(GTBANK_CREDIT)).toMatchObject({
      institution: "gtbank",
      amount: 2638800,
      direction: "in",
      date: "2026-07-30",
    });
  });

  it("takes direction from the body — both subjects are identical", () => {
    expect(GTBANK_DEBIT.subject).toBe(GTBANK_CREDIT.subject);
    expect(GTBANK_DEBIT.subject).toBe("Transaction Notification");
    expect(parsed(GTBANK_DEBIT).direction).toBe("out");
    expect(parsed(GTBANK_CREDIT).direction).toBe("in");
  });

  it("never reads the NEGATIVE available balance as the amount", () => {
    // "Available Balance | : | NGN -28.48" sits two rows below the amount.
    const result = parsed(GTBANK_DEBIT);
    expect(result.amount).toBe(351);
    expect(result.amount).toBeGreaterThan(0);
  });

  it("never reads a POSITIVE balance as the amount either", () => {
    const result = parsed(GTBANK_CREDIT);
    expect(result.amount).toBe(2638800);
    expect(result.amount).not.toBe(2640977); // Current Balance
    expect(result.amount).not.toBe(377); // Available Balance
  });

  it("strips the 30-digit reference from the credit narration", () => {
    // Left in, every transaction would have a unique categorization key and
    // no learned rule could ever match twice.
    const result = parsed(GTBANK_CREDIT);
    expect(result.description).not.toMatch(/^\d/);
    expect(result.description).toBe(
      "TRANSFER FROM DAVID OSAHON OGBEIDE-OPAY-DAVID OSA",
    );
  });

  it("accepts the bank's own mid-word truncation as valid-but-imperfect", () => {
    // "...-DAVID OSA" is cut off by GTBank itself.
    const result = parsed(GTBANK_CREDIT);
    expect(result.description.endsWith("DAVID OSA")).toBe(true);
    expect(result.description.length).toBeGreaterThan(0);
  });

  it("leaves a clean description with internal hyphens untouched", () => {
    // "27-JUN-26" must not be mistaken for composite structure.
    expect(parsed(GTBANK_DEBIT).description).toBe(
      "SMS ALERT CHARGE FOR 27-JUN-26 TO 28-JUL-26",
    );
  });
});

describe("Wema — real mail", () => {
  it("is recognised as an alert at all", () => {
    // The first guess keyed on "transaction alert"/"has been debited"/\bwema\b
    // — none of which appear. Real mail says "a Debit transaction recently
    // occurred", and the only "wema" is inside "wemabank.com".
    expect(parseAlert(WEMA_DEBIT).status).toBe("parsed");
    expect(parseAlert(WEMA_CREDIT).status).toBe("parsed");
  });

  it("parses the debit with a currency-code SUFFIX amount", () => {
    expect(parsed(WEMA_DEBIT)).toMatchObject({
      institution: "wema",
      amount: 80000,
      direction: "out",
      description: "ALAT NIP TRANSFER TO DAVID OSAHON OGBEIDE FROM DA",
      date: "2026-08-25",
    });
  });

  it("parses the credit, with comma grouping", () => {
    expect(parsed(WEMA_CREDIT)).toMatchObject({
      institution: "wema",
      amount: 300000,
      direction: "in",
      description: "NIP:UFY X UNIVERSAL SERVICES LIMITED- Prime",
      date: "2026-08-24",
    });
  });

  it("reads DD-MM-YYYY day-first, not month-first", () => {
    // 25-08-2026 is 25 August, not 8 something.
    expect(parsed(WEMA_DEBIT).date).toBe("2026-08-25");
  });

  it("does not take the suffixed balance line as the amount", () => {
    expect(parsed(WEMA_DEBIT).amount).not.toBe(11181);
    expect(parsed(WEMA_CREDIT).amount).not.toBe(321181);
  });
});

describe("Quick Microfinance — real mail", () => {
  it("is allowlisted by its VERIFIED domain, which its brand name lacks", () => {
    expect(senderFor("no-reply@quickmart.com")?.institution).toBe("quickmfb");
    expect(senderFor("no-reply@quickmart.com")?.label).toBe("Quick Microfinance Bank");
  });

  it("does NOT fall back to a brand-name match — that would be a bypass", () => {
    expect(senderFor("alerts@quickmicrofinance.example")).toBeNull();
    expect(senderFor("alerts@quick-mfb.example")).toBeNull();
    expect(senderFor("no-reply@quickmart.com.attacker.example")).toBeNull();
    expect(senderFor("no-reply@notquickmart.com")).toBeNull();
    expect(senderFor("no-reply@mail.quickmart.com")?.institution).toBe("quickmfb");
  });

  it("parses the block layout, where values sit on the NEXT line", () => {
    expect(parsed(QUICK_DEBIT)).toMatchObject({
      institution: "quickmfb",
      amount: 5375,
      direction: "out",
      date: "2026-07-30",
    });
  });

  it("parses the ₦ symbol-prefix amount with comma grouping", () => {
    expect(parsed(QUICK_CREDIT)).toMatchObject({
      amount: 25000023,
      direction: "in",
      date: "2026-07-30",
    });
  });

  it("extracts the MERCHANT from the underscore composite, not the account holder", () => {
    // "FT_Out Fee:DAVID OSAHON OGBEIDE_8082389369_OPAY NIGERIA_Amount Transfer"
    //           ^ account holder      ^ phone     ^ MERCHANT
    // A "longest alphabetic segment" heuristic picks the account holder here,
    // because their name is longer than the merchant's. The phone number is
    // the reliable anchor: the merchant follows it.
    const result = parsed(QUICK_DEBIT);
    expect(result.description).toBe("OPAY NIGERIA");
    expect(result.description).not.toContain("_");
    expect(result.description).not.toContain("8082389369");
    expect(result.description).not.toContain("DAVID");
  });

  it("leaves the clean credit narration from the SAME sender untouched", () => {
    expect(parsed(QUICK_CREDIT).description).toBe("July 2026 Bestaf Tech Staff Salary");
  });

  it("does not read the available balance as the amount", () => {
    // The balance LABEL is on its own line with the figure below it, so
    // dropping only the label would leave ₦250,765.10 as an orphan.
    expect(parsed(QUICK_DEBIT).amount).not.toBe(25076510);
    expect(parsed(QUICK_CREDIT).amount).not.toBe(25081885);
  });
});

describe("cleanNarration in isolation", () => {
  it("picks the segment after the phone number", () => {
    expect(
      cleanNarration("FT_Out Fee:DAVID OSAHON OGBEIDE_8082389369_OPAY NIGERIA_Amount Transfer"),
    ).toBe("OPAY NIGERIA");
  });

  it("returns human-readable prose unchanged", () => {
    expect(cleanNarration("July 2026 Bestaf Tech Staff Salary")).toBe(
      "July 2026 Bestaf Tech Staff Salary",
    );
    expect(cleanNarration("NIP:UFY X UNIVERSAL SERVICES LIMITED- Prime")).toBe(
      "NIP:UFY X UNIVERSAL SERVICES LIMITED- Prime",
    );
    expect(cleanNarration("SMS ALERT CHARGE FOR 27-JUN-26 TO 28-JUL-26")).toBe(
      "SMS ALERT CHARGE FOR 27-JUN-26 TO 28-JUL-26",
    );
  });

  it("strips a leading bank reference run", () => {
    expect(cleanNarration("100004260730180812166829083192-TRANSFER FROM X")).toBe(
      "TRANSFER FROM X",
    );
  });

  it("falls back to the longest segment when there is no phone anchor", () => {
    expect(cleanNarration("FT_ACME TRADING COMPANY_TRANSFER")).toBe("ACME TRADING COMPANY");
  });

  it("never returns empty when given content", () => {
    expect(cleanNarration("FT_Out_123").length).toBeGreaterThan(0);
    expect(cleanNarration("_")).toBe("_");
    expect(cleanNarration("")).toBe("");
  });
});

describe("registry integrity", () => {
  it("parses all six real samples", () => {
    for (const sample of REAL_SAMPLES) {
      expect(parseAlert(sample).status, `${sample.id} did not parse`).toBe("parsed");
    }
  });

  it("assigns every sample a positive amount and a known direction", () => {
    for (const sample of REAL_SAMPLES) {
      const result = parsed(sample);
      expect(result.amount, sample.id).toBeGreaterThan(0);
      expect(["in", "out"], sample.id).toContain(result.direction);
      expect(result.description.length, sample.id).toBeGreaterThan(0);
    }
  });

  it("covers all three verified institutions", () => {
    for (const institution of ["gtbank", "wema", "quickmfb"] as const) {
      expect(ALERT_SENDERS.some((s) => s.institution === institution)).toBe(true);
      expect(ALERT_TEMPLATES.some((t) => t.institution === institution)).toBe(true);
    }
  });

  it("still refuses lookalikes of the verified domains", () => {
    expect(senderFor("alerts@wemabank.com.evil.example")).toBeNull();
    expect(senderFor("GeNS@gtbank.com.evil.example")).toBeNull();
  });
});
