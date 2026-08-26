import { describe, expect, it } from "vitest";

import { parseOpayStatement } from "../opayParser";
import type { NormalizationContext } from "../statementTypes";

const HEADER = [
  "Trans. Time",
  "Value Date",
  "Description",
  "Debit(₦)",
  "Credit(₦)",
  "Balance After(₦)",
  "Channel",
  "Transaction Reference",
];

const CONTEXT: NormalizationContext = { currency: "NGN" };

function parse(...rows: (string | undefined)[][]) {
  return parseOpayStatement(
    rows.map((row) => row.map((cell) => cell ?? "")),
    CONTEXT,
  );
}

describe("parseOpayStatement", () => {
  it("parses a normal transfer and lifts merchant and provider", () => {
    const result = parse(
      HEADER,
      ["2026-08-12 14:32:05", "2026-08-12", "Transfer to DAVID OSAHON OGBEIDE | PalmPay", "₦500,000.00", "", "₦1,200,000.00", "OPay App", "OP-REF-0001"],
    );
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    const tx = result.transactions[0];
    expect(tx.transactionDate).toBe("2026-08-12");
    expect(tx.transactionTime).toBe("14:32:05");
    expect(tx.valueDate).toBe("2026-08-12");
    expect(tx.description).toBe("Transfer to DAVID OSAHON OGBEIDE | PalmPay");
    expect(tx.originalDescription).toBe("Transfer to DAVID OSAHON OGBEIDE | PalmPay");
    expect(tx.merchant).toBe("DAVID OSAHON OGBEIDE");
    expect(tx.provider).toBe("PalmPay");
    expect(tx.debitAmount).toBe(50_000_000);
    expect(tx.creditAmount).toBeUndefined();
    expect(tx.balanceAfter).toBe(120_000_000);
    expect(tx.channel).toBe("OPay App");
    expect(tx.reference).toBe("OP-REF-0001");
    expect(tx.direction).toBe("out");
    expect(tx.currency).toBe("NGN");
    expect(tx.sourceBank).toBe("opay");
    expect(tx.type).toBe("unknown");
    expect(tx.confidence).toBe("none");
    expect(tx.status).toBe("draft");
    expect(tx.categoryId).toBeNull();
    expect(tx.row).toBe(2);
  });

  it("handles truncated recipient names", () => {
    const result = parse(
      HEADER,
      ["12/08/2026 09:41:23", "12/08/2026", "Transfer to CHINEDU EZ... | OPay", "₦2,500.00", "", "₦97,500.00", "OPay App", "OP-REF-0002"],
    );
    const tx = result.transactions[0];
    expect(tx.merchant).toBe("CHINEDU EZ...");
    expect(tx.provider).toBe("OPay");
  });

  it("parses mobile data narrations, keeping the full description", () => {
    const result = parse(
      HEADER,
      ["12/08/2026 10:15:00", "12/08/2026", "Mobile Data | MTN | 3.2GB 2 Days Plan", "₦1,500.00", "", "₦96,000.00", "OPay App", "OP-REF-0003"],
    );
    const tx = result.transactions[0];
    expect(tx.description).toBe("Mobile Data | MTN | 3.2GB 2 Days Plan");
    expect(tx.provider).toBe("MTN");
    expect(tx.merchant).toBeUndefined();
  });

  it("parses an OWealth withdrawal", () => {
    const result = parse(
      HEADER,
      ["12/08/2026 08:00:00", "12/08/2026", "OWealth Withdrawal (Transaction Payment)", "₦10,000.00", "", "₦86,000.00", "OPay App", "OP-REF-0004"],
    );
    const tx = result.transactions[0];
    expect(tx.description).toBe("OWealth Withdrawal (Transaction Payment)");
    expect(tx.debitAmount).toBe(1_000_000);
    expect(tx.direction).toBe("out");
    expect(tx.merchant).toBeUndefined();
    expect(tx.provider).toBeUndefined();
  });

  it("parses OWealth interest as a credit", () => {
    const result = parse(
      HEADER,
      ["13/08/2026 00:00:01", "13/08/2026", "OWealth Interest Earned", "", "₦12,345.67", "₦98,345.67", "OPay App", "OP-REF-0005"],
    );
    const tx = result.transactions[0];
    expect(tx.creditAmount).toBe(1_234_567);
    expect(tx.direction).toBe("in");
    expect(tx.debitAmount).toBeUndefined();
  });

  it("parses auto-save to OWealth balance", () => {
    const result = parse(
      HEADER,
      ["14/08/2026 07:30:00", "14/08/2026", "Auto-save to OWealth Balance", "₦5,000.00", "", "₦93,345.67", "OPay App", "OP-REF-0006"],
    );
    expect(result.transactions[0].description).toBe("Auto-save to OWealth Balance");
    expect(result.transactions[0].debitAmount).toBe(500_000);
  });

  it("parses an OWealth deposit refund as a credit", () => {
    const result = parse(
      HEADER,
      ["14/08/2026 07:30:05", "14/08/2026", "OWealth Deposit (Transaction Refund)", "", "₦5,000.00", "₦98,345.67", "OPay App", "OP-REF-0007"],
    );
    const tx = result.transactions[0];
    expect(tx.creditAmount).toBe(500_000);
    expect(tx.direction).toBe("in");
  });

  it("parses stamp duty", () => {
    const result = parse(
      HEADER,
      ["15/08/2026 12:00:00", "15/08/2026", "Stamp Duty", "₦50.00", "", "₦98,295.67", "USSD", "OP-REF-0008"],
    );
    const tx = result.transactions[0];
    expect(tx.description).toBe("Stamp Duty");
    expect(tx.debitAmount).toBe(5_000);
    expect(tx.channel).toBe("USSD");
  });

  it("parses VAT on transfer fee", () => {
    const result = parse(
      HEADER,
      ["15/08/2026 12:00:02", "15/08/2026", "VAT on Transfer Fee", "₦2.00", "", "₦98,293.67", "USSD", "OP-REF-0009"],
    );
    expect(result.transactions[0].debitAmount).toBe(200);
  });

  it("parses a USSD charge", () => {
    const result = parse(
      HEADER,
      ["15/08/2026 12:00:03", "15/08/2026", "USSD Charge", "₦10.00", "", "₦98,283.67", "USSD", "OP-REF-0010"],
    );
    expect(result.transactions[0].debitAmount).toBe(1_000);
  });

  it("parses an EaseMoni loan repayment", () => {
    const result = parse(
      HEADER,
      ["16/08/2026 09:00:00", "16/08/2026", "EaseMoni loan repayment", "₦25,000.00", "", "₦73,283.67", "OPay App", "OP-REF-0011"],
    );
    const tx = result.transactions[0];
    expect(tx.description).toBe("EaseMoni loan repayment");
    expect(tx.debitAmount).toBe(2_500_000);
  });

  it("parses a third-party merchant payment, lifting the provider", () => {
    const result = parse(
      HEADER,
      ["16/08/2026 11:11:11", "16/08/2026", "Third-Party Merchant Order | Kora Payments Network Limited", "₦3,000.00", "", "₦70,283.67", "OPay App", "OP-REF-0012"],
    );
    const tx = result.transactions[0];
    expect(tx.provider).toBe("Kora Payments Network Limited");
    expect(tx.merchant).toBeUndefined();
    expect(tx.description).toBe("Third-Party Merchant Order | Kora Payments Network Limited");
  });

  it("handles naira small decimal amounts exactly", () => {
    const result = parse(
      HEADER,
      ["17/08/2026 08:08:08", "17/08/2026", "VAT on Transfer Fee", "₦0.70", "", "₦70,282.97", "OPay App", "OP-REF-0013"],
      ["17/08/2026 08:08:09", "17/08/2026", "VAT on Transfer Fee", "₦0.75", "", "₦70,282.22", "OPay App", "OP-REF-0014"],
      ["17/08/2026 08:08:10", "17/08/2026", "Stamp Duty", "₦1.88", "", "₦70,280.34", "OPay App", "OP-REF-0015"],
    );
    expect(result.transactions[0].debitAmount).toBe(70);
    expect(result.transactions[1].debitAmount).toBe(75);
    expect(result.transactions[2].debitAmount).toBe(188);
  });

  it("handles large comma-separated amounts", () => {
    const result = parse(
      HEADER,
      ["18/08/2026 15:00:00", "18/08/2026", "Transfer to BILLY COMMODITIES LIMITED | OPay", "₦10,000,000.00", "", "₦80,280,340.00", "OPay App", "OP-REF-0016"],
    );
    const tx = result.transactions[0];
    expect(tx.debitAmount).toBe(1_000_000_000);
    expect(tx.balanceAfter).toBe(8_028_034_000);
  });

  it("keeps empty debit/credit cells as undefined", () => {
    const result = parse(
      HEADER,
      ["19/08/2026 10:00:00", "19/08/2026", "Deposit", "", "₦500.00", "₦80,280,840.00", "OPay App", "OP-REF-0017"],
    );
    const tx = result.transactions[0];
    expect(tx.debitAmount).toBeUndefined();
    expect(tx.creditAmount).toBe(50_000);
    expect(tx.direction).toBe("in");
  });

  it("skips a row with an invalid date and records the error", () => {
    const result = parse(
      HEADER,
      ["31/13/2026 14:32:05", "31/13/2026", "Transfer to NOBODY | OPay", "₦100.00", "", "₦1,000.00", "OPay App", "OP-REF-0018"],
      ["20/08/2026 09:00:00", "20/08/2026", "Transfer to SOMEBODY | OPay", "₦200.00", "", "₦800.00", "OPay App", "OP-REF-0019"],
    );
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].row).toBe(3);
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual([{ row: 2, reason: "invalid date" }]);
  });

  it("skips a row whose amount cell is unexpected text", () => {
    const result = parse(
      HEADER,
      ["20/08/2026 09:00:01", "20/08/2026", "Transfer to SOMEBODY | OPay", "not-a-number", "", "₦800.00", "OPay App", "OP-REF-0020"],
    );
    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toEqual([{ row: 2, reason: "unparseable amount" }]);
  });

  it("skips a dated row with no debit or credit", () => {
    const result = parse(
      HEADER,
      ["20/08/2026 09:00:02", "20/08/2026", "Transfer to SOMEBODY | OPay", "", "", "₦800.00", "OPay App", "OP-REF-0021"],
    );
    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toEqual([{ row: 2, reason: "missing debit and credit" }]);
  });

  it("keeps a row with a missing description under a fallback label", () => {
    const result = parse(
      HEADER,
      ["20/08/2026 09:00:03", "20/08/2026", "", "₦50.00", "", "₦750.00", "OPay App", "OP-REF-0022"],
    );
    const tx = result.transactions[0];
    expect(tx.description).toBe("(no description)");
    expect(tx.originalDescription).toBeUndefined();
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("silently ignores footer rows without a date or amount", () => {
    const result = parse(
      HEADER,
      ["20/08/2026 09:00:04", "20/08/2026", "Transfer to SOMEBODY | OPay", "₦50.00", "", "₦750.00", "OPay App", "OP-REF-0023"],
      ["", "", "", "", "", "₦750.00", "", ""],
    );
    expect(result.transactions).toHaveLength(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("parses without channel or reference columns", () => {
    const result = parse(
      ["Trans. Time", "Value Date", "Description", "Debit(₦)", "Credit(₦)", "Balance After(₦)"],
      ["21/08/2026 09:00:00", "21/08/2026", "Stamp Duty", "₦50.00", "", "₦700.00"],
    );
    const tx = result.transactions[0];
    expect(tx.channel).toBeUndefined();
    expect(tx.reference).toBeUndefined();
    expect(tx.debitAmount).toBe(5_000);
  });

  it("parses headerless files using canonical OPay column positions", () => {
    const result = parse(
      ["21/08/2026 09:00:01", "21/08/2026", "Transfer to DAVID OSAHON OGBEIDE | PalmPay", "₦500.00", "", "₦1,200.00", "OPay App", "OP-REF-0030"],
    );
    const tx = result.transactions[0];
    expect(tx.row).toBe(1);
    expect(tx.transactionDate).toBe("2026-08-21");
    expect(tx.transactionTime).toBe("09:00:01");
    expect(tx.merchant).toBe("DAVID OSAHON OGBEIDE");
    expect(tx.provider).toBe("PalmPay");
    expect(tx.channel).toBe("OPay App");
  });

  it("handles missing debit and credit columns gracefully", () => {
    const result = parse(
      ["Trans. Time", "Value Date", "Description"],
      ["21/08/2026 09:00:02", "21/08/2026", "Stamp Duty"],
    );
    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual([{ row: 2, reason: "missing debit and credit" }]);
  });

  it("tolerates title rows and extra columns when locating the header", () => {
    const result = parse(
      ["OPay Account Statement", "", "", "", "", "", "", ""],
      ["S/N", "Trans. Time", "Value Date", "Description", "Debit(₦)", "Credit(₦)", "Balance After(₦)", "Channel", "Transaction Reference"],
      ["1", "21/08/2026 09:00:03", "21/08/2026", "Stamp Duty", "₦50.00", "", "₦650.00", "OPay App", "OP-REF-0031"],
    );
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].row).toBe(3);
    expect(result.transactions[0].id).toBe("op-r3");
    expect(result.transactions[0].debitAmount).toBe(5_000);
  });

  it("parses multiple rows independently", () => {
    const result = parse(
      HEADER,
      ["22/08/2026 09:00:00", "22/08/2026", "Transfer to A | OPay", "₦100.00", "", "₦550.00", "OPay App", "OP-REF-0040"],
      ["22/08/2026 09:00:01", "22/08/2026", "Transfer to B | PalmPay", "₦200.00", "", "₦350.00", "OPay App", "OP-REF-0041"],
      ["22/08/2026 09:00:02", "22/08/2026", "Deposit", "", "₦100.00", "₦450.00", "Web", "OP-REF-0042"],
    );
    expect(result.transactions.map((tx) => tx.description)).toEqual([
      "Transfer to A | OPay",
      "Transfer to B | PalmPay",
      "Deposit",
    ]);
    expect(result.transactions.map((tx) => tx.direction)).toEqual(["out", "out", "in"]);
    expect(result.transactions.map((tx) => tx.id)).toEqual(["op-r2", "op-r3", "op-r4"]);
  });

  it("falls back to the value date when there is no Trans. Time column", () => {
    const result = parse(
      ["Value Date", "Description", "Debit(₦)", "Credit(₦)", "Balance After(₦)"],
      ["21/08/2026", "SMS Alert Charge", "₦4.00", "", "₦96.00"],
    );
    expect(result.transactions).toHaveLength(1);
    const tx = result.transactions[0];
    expect(tx.transactionDate).toBe("2026-08-21");
    expect(tx.transactionTime).toBeUndefined();
    expect(tx.valueDate).toBe("2026-08-21");
  });

  it("returns no transactions for an empty statement (8A)", () => {
    const result = parse();
    expect(result.transactions).toEqual([]);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);

    const blank = parse(["", "", "", "", "", "", "", ""], ["", "", "", "", "", "", "", ""]);
    expect(blank.transactions).toEqual([]);
    expect(blank.skipped).toBe(0);
    expect(blank.errors).toEqual([]);
  });

  it("never turns a long numeric reference into a credit (misaligned grid)", () => {
    const result = parse(
      HEADER,
      ["12/08/2026 14:32:05", "12/08/2026", "Transfer to DAVID OGBEIDE", "₦500,000.00", "2607010201000"],
    );
    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toEqual([{ row: 2, reason: "unparseable amount" }]);
  });

  it("rejects a row carrying both a debit and a credit (left-shifted columns)", () => {
    const result = parse(
      HEADER,
      ["12/08/2026 14:32:05", "12/08/2026", "Transfer to DAVID OGBEIDE", "₦500,000.00", "₦1,200,000.00", "OPay App", "2607010201000"],
    );
    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toEqual([{ row: 2, reason: "conflicting debit and credit" }]);
  });

  it("rejects a row whose reference cell parses as an amount (misaligned row)", () => {
    const result = parse(
      HEADER,
      ["12/08/2026 14:32:05", "12/08/2026", "Transfer to DAVID OGBEIDE", "₦500,000.00", "", "₦1,200,000.00", "OPay App", "1,000.00"],
    );
    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toEqual([{ row: 2, reason: "misaligned row" }]);
  });

  it("parses an aligned row whose reference is a long numeric string", () => {
    const result = parse(
      HEADER,
      ["12/08/2026 14:32:05", "12/08/2026", "Transfer to DAVID OGBEIDE", "₦500,000.00", "", "₦1,200,000.00", "OPay App", "2607010201000"],
    );
    expect(result.transactions).toHaveLength(1);
    const tx = result.transactions[0];
    expect(tx.debitAmount).toBe(50_000_000);
    expect(tx.reference).toBe("2607010201000");
    expect(tx.creditAmount).toBeUndefined();
  });
});