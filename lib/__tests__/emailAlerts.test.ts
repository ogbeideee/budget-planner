import { describe, expect, it } from "vitest";
import {
  ALERT_SENDERS,
  ALERT_TEMPLATES,
  SNIPPET_MAX_CHARS,
  parseAlert,
  parseAlertAmount,
  parseAlertDate,
  parseAlerts,
  senderFor,
  type AlertEmail,
} from "../emailAlerts";

function email(patch: Partial<AlertEmail> & Pick<AlertEmail, "from" | "body">): AlertEmail {
  return { id: "m1", subject: "Transaction Alert", ...patch };
}

describe("the sender allowlist", () => {
  it("accepts an allowlisted domain, plain or with a display name", () => {
    expect(senderFor("GeNS@gtbank.com")?.institution).toBe("gtbank");
    expect(senderFor("GTBank Alerts <alerts@GTBank.com>")?.institution).toBe("gtbank");
  });

  it("accepts a subdomain of an allowlisted domain", () => {
    expect(senderFor("noreply@mail.kuda.com")?.institution).toBe("kuda");
  });

  it("REJECTS a lookalike domain that merely contains an allowlisted one", () => {
    // The attack this guards: substring matching would pass all of these.
    expect(senderFor("alerts@gtbank.com.evil.example")).toBeNull();
    expect(senderFor("alerts@notgtbank.com")).toBeNull();
    expect(senderFor("alerts@kuda.com.attacker.net")).toBeNull();
  });

  it("rejects anything not on the list at all", () => {
    expect(senderFor("newsletter@random.example")).toBeNull();
    expect(senderFor("")).toBeNull();
    expect(senderFor("not-an-address")).toBeNull();
  });

  it("has a template for every allowlisted institution", () => {
    for (const sender of ALERT_SENDERS) {
      expect(
        ALERT_TEMPLATES.some((t) => t.institution === sender.institution),
        `${sender.label} has no template`,
      ).toBe(true);
    }
  });
});

describe("mail from a non-allowlisted sender", () => {
  it("is ignored without being parsed", () => {
    const result = parseAlert(
      email({
        from: "promo@shopping.example",
        body: "We wish to inform you that a DEBIT transaction occurred on your account with us. | Amount | : | NGN5,000.00 | Description | : | SHOPRITE",
      }),
    );
    // Even though the body looks exactly like an alert.
    expect(result).toEqual({ status: "ignored", reason: "sender-not-allowlisted" });
  });
});

describe("GTBank alerts", () => {
  // CONFIRMED format (see emailAlertsReal.test.ts for the full fixtures).
  // The previous fixture here used a guessed "Txn:/Amt:/Desc:" layout that
  // GTBank does not send; it was removed rather than kept alongside, so no
  // test can pass against a format that does not exist.
  const BODY = [
    "Dear Customer,",
    "This is to inform you that We wish to inform you that a DEBIT transaction occurred on your account with us.",
    "| Amount | : | NGN 5,000.00",
    "| Description | : | POS/SHOPRITE LEKKI/LAGOS",
    "Available Balance : NGN 45,000.00",
    "| Value Date | : | 2026-08-12",
  ].join("\n");

  it("parses amount, direction, description and date", () => {
    const result = parseAlert(email({ from: "GeNS@gtbank.com", body: BODY }));
    expect(result).toMatchObject({
      status: "parsed",
      institution: "gtbank",
      amount: 500000,
      direction: "out",
      description: "POS/SHOPRITE LEKKI/LAGOS",
      date: "2026-08-12",
      dateFromHeader: false,
    });
  });

  it("reads a credit as money in", () => {
    const credited = BODY.replace("a DEBIT transaction", "a CREDIT transaction").replace(
      "| Description | : | POS/SHOPRITE LEKKI/LAGOS",
      "| Description | : | SALARY AUGUST",
    );
    const result = parseAlert(email({ from: "GeNS@gtbank.com", body: credited }));
    expect(result).toMatchObject({ direction: "in", description: "SALARY AUGUST" });
  });
});

describe("Kuda alerts", () => {
  const BODY =
    "Hi Ada,\n\nYou sent ₦12,500.50 to SHOPRITE LEKKI on 12 Aug 2026 at 2:32 PM.\n" +
    "Your new balance is ₦45,000.00.\n\nKuda";

  it("parses the prose format", () => {
    const result = parseAlert(email({ from: "noreply@kuda.com", subject: "You sent money", body: BODY }));
    expect(result).toMatchObject({
      status: "parsed",
      institution: "kuda",
      amount: 1250050,
      direction: "out",
      description: "SHOPRITE LEKKI",
      date: "2026-08-12",
    });
  });

  it("reads 'you received' as money in", () => {
    const received =
      "You received ₦80,000.00 from ACME LTD on 01 Sep 2026 at 9:02 AM.";
    const result = parseAlert(
      email({ from: "noreply@kuda.com", subject: "You received money", body: received }),
    );
    expect(result).toMatchObject({
      direction: "in",
      amount: 8000000,
      description: "ACME LTD",
      date: "2026-09-01",
    });
  });
});

describe("OPay alerts", () => {
  const BODY = [
    "Debit Alert",
    "Amount: NGN 2,300.00",
    "To: MTN VTU RECHARGE",
    "Date: 2026-08-12 14:32:10",
    "Balance: NGN 12,000.00",
  ].join("\n");

  it("parses the labelled format", () => {
    const result = parseAlert(email({ from: "alert@opayweb.com", subject: "Debit Alert", body: BODY }));
    expect(result).toMatchObject({
      status: "parsed",
      institution: "opay",
      amount: 230000,
      direction: "out",
      description: "MTN VTU RECHARGE",
      date: "2026-08-12",
    });
  });
});

describe("Access Bank alerts", () => {
  it("parses the single-paragraph format", () => {
    const body =
      "Dear Customer, Acc: 12****34 has been debited with NGN7,450.00 on 03-Sep-2026. " +
      "Desc: POS PURCHASE SPAR IKEJA\nAvail Bal: NGN20,000.00";
    const result = parseAlert(email({ from: "alerts@accessbankplc.com", body }));
    expect(result).toMatchObject({
      status: "parsed",
      institution: "access",
      amount: 745000,
      direction: "out",
      description: "POS PURCHASE SPAR IKEJA",
      date: "2026-09-03",
    });
  });
});

describe("a malformed or partial alert", () => {
  it("lands in needs-review rather than being dropped", () => {
    // Right sender, recognisable as an alert, but the amount line is mangled.
    const body = [
      "We wish to inform you that a DEBIT transaction occurred on your account with us.",
      "| Amount | : | NGN ****",
      "| Description | : | POS/SHOPRITE LEKKI",
      "| Value Date | : | 2026-08-12",
    ].join("\n");
    const result = parseAlert(email({ from: "GeNS@gtbank.com", body }));

    expect(result.status).toBe("needs-review");
    if (result.status !== "needs-review") return;
    expect(result.missing).toEqual(["amount"]);
    // Everything that WAS understood is kept, so the user completes one field.
    expect(result.partial).toMatchObject({
      direction: "out",
      description: "POS/SHOPRITE LEKKI",
      date: "2026-08-12",
    });
    expect(result.snippet).toContain("SHOPRITE");
  });

  it("is never silently turned into a wrong transaction", () => {
    const body = "We wish to inform you that a DEBIT transaction occurred on your account with us.\n| Amount | : | NGN ****\n| Value Date | : | 2026-08-12";
    const result = parseAlert(email({ from: "GeNS@gtbank.com", body }));
    expect(result.status).not.toBe("parsed");
  });

  it("lists every missing field, not just the first", () => {
    const body = "Transaction Notification\n| Amount | : | NGN ****\nsomething unreadable";
    const result = parseAlert(email({ from: "GeNS@gtbank.com", body }));
    if (result.status !== "needs-review") throw new Error("expected needs-review");
    expect(result.missing).toEqual(
      expect.arrayContaining(["amount", "direction", "description"]),
    );
  });

  it("caps the retained snippet", () => {
    const body = `We wish to inform you that a DEBIT transaction occurred on your account with us.\n| Amount | : | NGN ****\n${"x".repeat(2000)}`;
    const result = parseAlert(email({ from: "GeNS@gtbank.com", body }));
    if (result.status !== "needs-review") throw new Error("expected needs-review");
    expect(result.snippet.length).toBeLessThanOrEqual(SNIPPET_MAX_CHARS);
  });
});

describe("non-alert mail from an allowlisted sender", () => {
  it("is ignored rather than forced into a transaction", () => {
    const result = parseAlert(
      email({
        from: "newsletter@gtbank.com",
        subject: "Our new savings product",
        body: "Dear customer, we are pleased to announce a new savings account.",
      }),
    );
    expect(result).toEqual({ status: "ignored", reason: "not-a-transaction-alert" });
  });
});

describe("the mail header date fallback", () => {
  it("is used only when the body has no date, and is flagged", () => {
    const body = "We wish to inform you that a DEBIT transaction occurred on your account with us.\n| Amount | : | NGN1,000.00\n| Description | : | TEST MERCHANT";
    const result = parseAlert(
      email({ from: "GeNS@gtbank.com", body, receivedAt: "2026-08-14T09:00:00.000Z" }),
    );
    expect(result).toMatchObject({
      status: "parsed",
      date: "2026-08-14",
      dateFromHeader: true,
    });
  });
});

describe("field helpers", () => {
  it("parses amounts into minor units", () => {
    expect(parseAlertAmount("5,000.00")).toBe(500000);
    expect(parseAlertAmount("12500.5")).toBe(1250050);
    expect(parseAlertAmount("900")).toBe(90000);
  });

  it("rejects unusable amounts rather than guessing", () => {
    expect(parseAlertAmount("****")).toBeNull();
    expect(parseAlertAmount("")).toBeNull();
    expect(parseAlertAmount("1.2.3")).toBeNull();
    expect(parseAlertAmount("0")).toBeNull();
  });

  it("parses the date formats these banks actually use", () => {
    expect(parseAlertDate("2026-08-12")).toBe("2026-08-12");
    expect(parseAlertDate("12-Aug-2026")).toBe("2026-08-12");
    expect(parseAlertDate("12 August 2026")).toBe("2026-08-12");
    expect(parseAlertDate("03/09/2026")).toBe("2026-09-03"); // day-first
    expect(parseAlertDate("12-Aug-26")).toBe("2026-08-12");
  });

  it("returns null rather than a wrong date", () => {
    expect(parseAlertDate("not a date")).toBeNull();
    expect(parseAlertDate("")).toBeNull();
    expect(parseAlertDate("45/45/2026")).toBeNull();
  });
});

describe("batch parsing", () => {
  it("keeps parsed and needs-review rows, drops ignored ones", () => {
    const results = parseAlerts([
      email({ id: "a", from: "GeNS@gtbank.com", body: "We wish to inform you that a DEBIT transaction occurred on your account with us.\n| Amount | : | NGN1,000.00\n| Description | : | A\n| Value Date | : | 2026-08-12" }),
      email({ id: "b", from: "GeNS@gtbank.com", body: "We wish to inform you that a DEBIT transaction occurred on your account with us.\n| Amount | : | NGN ****\n| Description | : | B\n| Value Date | : | 2026-08-12" }),
      email({ id: "c", from: "spam@elsewhere.example", body: "Amt: NGN1.00" }),
    ]);
    expect(results.map((r) => `${r.messageId}:${r.status}`)).toEqual([
      "a:parsed",
      "b:needs-review",
    ]);
  });
});
