import { describe, expect, it } from "vitest";
import { fixtureAlignedCells, fixtureAlignedRowYs, findFixture } from "./manifest";
import { detectStatementFormat, processStatement } from "../../../lib/statementPipeline";
import { parseOpayStatement } from "../../../lib/opayParser";
import type { NormalizationContext } from "../../../lib/statementTypes";

/**
 * OPay — the real, current statement export.
 *
 * Verified against `Opay/DAVID OSAHON OGBEIDE_8082389369_20260827085939.pdf`
 * on 2026-08-27. The assertions below are not invented: every expected figure
 * comes from the statement's OWN summary blocks, which the PDF prints for
 * each of its two accounts. If OPay changes the export again, these numbers
 * stop reconciling and this test fails immediately — which is the whole point.
 *
 * The document carries TWO complete statements:
 *
 *   Wallet Account   pages 1-7   77 debits / ₦782,090.50 · 73 credits / ₦782,090.50
 *   Savings Account  pages 7-11  60 debits / ₦388,370.50 · 40 credits / ₦388,348.12
 *
 * and — the thing that broke it — the second table's money columns sit ~38pt
 * further left than the first's.
 */

const CONTEXT: NormalizationContext = { currency: "NGN" };

/** Straight from the two summary blocks printed in the PDF. */
const WALLET = { debits: 77, debitMinor: 78_209_050, credits: 73, creditMinor: 78_209_050 };
const SAVINGS = { debits: 60, debitMinor: 38_837_050, credits: 40, creditMinor: 38_834_812 };
const TOTAL = {
  transactions: WALLET.debits + WALLET.credits + SAVINGS.debits + SAVINGS.credits,
  debits: WALLET.debits + SAVINGS.debits,
  debitMinor: WALLET.debitMinor + SAVINGS.debitMinor,
  credits: WALLET.credits + SAVINGS.credits,
  creditMinor: WALLET.creditMinor + SAVINGS.creditMinor,
};

function parsed() {
  return processStatement({
    cells: fixtureAlignedCells("opay"),
    context: CONTEXT,
    categories: [],
    rowYs: fixtureAlignedRowYs("opay"),
  });
}

describe("OPay real statement — the fixture is wired in", () => {
  it("is a registered fixture pointing at a real text-layer PDF", () => {
    const fixture = findFixture("opay");
    expect(fixture.textLayer).toBe("present");
    expect(fixture.pages).toBe(11);
  });

  it("is detected as OPay with high confidence", () => {
    const detection = detectStatementFormat(fixtureAlignedCells("opay"));
    expect(detection.bank).toBe("opay");
    expect(detection.confidence).toBe("high");
  });

  it("does NOT come back empty — the reported live failure", () => {
    // "No transactions could be detected in that file" is what a zero here
    // produces in the app.
    expect(parsed().transactions.length).toBeGreaterThan(0);
  });
});

describe("OPay real statement — reconciles against the PDF's own totals", () => {
  it("extracts every transaction from BOTH tables", () => {
    expect(parsed().transactions).toHaveLength(TOTAL.transactions);
  });

  it("matches the printed debit count and total to the penny", () => {
    const tx = parsed().transactions;
    const debits = tx.filter((t) => t.debitAmount);
    const sum = debits.reduce((n, t) => n + (t.debitAmount ?? 0), 0);
    expect(debits).toHaveLength(TOTAL.debits);
    expect(sum).toBe(TOTAL.debitMinor);
  });

  it("matches the printed credit count and total to the penny", () => {
    const tx = parsed().transactions;
    const credits = tx.filter((t) => t.creditAmount);
    const sum = credits.reduce((n, t) => n + (t.creditAmount ?? 0), 0);
    expect(credits).toHaveLength(TOTAL.credits);
    expect(sum).toBe(TOTAL.creditMinor);
  });

  it("never sets both a debit and a credit on one row", () => {
    for (const t of parsed().transactions) {
      expect(Boolean(t.debitAmount) && Boolean(t.creditAmount)).toBe(false);
    }
  });

  it("gives every row a date inside the statement period", () => {
    for (const t of parsed().transactions) {
      expect(t.transactionDate, t.description).toMatch(/^2026-0[78]-\d{2}$/);
    }
  });
});

describe("OPay real statement — the format facts that broke it", () => {
  it("reads '--' as an empty money column, not an unparseable amount", () => {
    // Every OPay row prints "--" in whichever side does not apply. Treating
    // that as a broken amount rejected the entire statement.
    const result = parseOpayStatement(fixtureAlignedCells("opay"), CONTEXT);
    expect(result.errors.filter((e) => e.reason === "unparseable amount")).toHaveLength(0);
  });

  it("keeps the second table's rows despite its shifted money columns", () => {
    // The Savings table starts part-way down page 7 with its own header and
    // columns ~38pt to the left. Its smallest rows are the interest credits.
    const tx = parsed().transactions;
    const interest = tx.filter((t) => /OWealth Interest Earned/i.test(t.description ?? ""));
    expect(interest.length).toBeGreaterThan(0);
    // Those are sub-naira credits — proof the shifted columns parse.
    expect(interest.some((t) => (t.creditAmount ?? 0) > 0 && (t.creditAmount ?? 0) < 100)).toBe(true);
  });

  it("parses a wrapped row whose reference is a short numeric run", () => {
    // "…| OPay | 8082389369" wraps, leaving reference fragment "2198771",
    // which the left-shift guard used to mistake for an amount.
    const tx = parsed().transactions;
    const row = tx.find((t) => t.transactionTime === "06:27:15");
    expect(row).toBeDefined();
    expect(row?.debitAmount).toBe(60_000);
  });

  it("reads amounts with thousands separators and two decimals", () => {
    const tx = parsed().transactions;
    expect(tx.some((t) => t.debitAmount === 1_500_000)).toBe(true); // 15,000.00
    expect(tx.some((t) => t.creditAmount === 24_960_000)).toBe(true); // 249,600.00
  });

  it("maps the Balance After and Channel columns despite split header cells", () => {
    // The PDF prints "Balance After" one baseline above "(₦)", so the aligned
    // header reads "Balance After ₦)" and "( Channel". Before the orphaned
    // bracket was stripped neither column matched its role, and every row
    // came back with no balance and no channel.
    const tx = parsed().transactions;
    expect(tx.filter((t) => t.balanceAfter !== undefined).length).toBeGreaterThan(150);
    expect(tx.every((t) => t.channel === "Mobile")).toBe(true);
  });
});

describe("OPay real statement — one transaction spans a BLOCK of lines", () => {
  // The date/amount line sits in the MIDDLE of its block: the narration and
  // the reference wrap onto the lines above AND below it, one line-height
  // apart, with a wider gap between blocks. Reading a block's lines as the
  // previous block's continuation is what mixed two narrations together.
  const first = () => parsed().transactions[0];

  it("joins a narration that wraps upward and downward onto one row", () => {
    expect(first().description).toBe(
      "Transfer from UGBO JOHN NWAYOR | First Bank Of Nigeria | 300****374 | " +
        "DAVID OSAHON OGBEIDE /NONE",
    );
  });

  it("rejoins a reference split across the block's lines", () => {
    // Printed as "0000162607301607420024" + "49444346" on two lines.
    expect(first().reference).toBe("000016260730160742002449444346");
    expect(parsed().transactions.every((t) => t.reference !== undefined)).toBe(true);
  });

  it("never repeats a narration on a row whose own description cell is empty", () => {
    for (const t of parsed().transactions) {
      const half = t.description.slice(0, Math.floor(t.description.length / 2)).trim();
      if (half.length < 12) continue;
      expect(t.description.startsWith(`${half} ${half}`), t.description).toBe(false);
    }
  });

  it("keeps a following block's narration off the preceding transaction", () => {
    const tx = parsed().transactions;
    const autoSave = tx.find((t) => t.transactionTime === "16:09:10");
    expect(autoSave?.description).toBe("Auto-save to OWealth Balance");
    expect(autoSave?.reference).toBe("260730140300187486659959");
  });
});
