import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const {
  extractBodies,
  decodeTransfer,
  decodeQuotedPrintable,
  decodeCharset,
} = require_("./mimeBodies.cjs");

describe("decodeQuotedPrintable", () => {
  it("decodes =XX escapes and soft line breaks", () => {
    expect(
      decodeQuotedPrintable(Buffer.from("Acct bal=20NGN 100=\r\nOK")).toString(),
    ).toBe("Acct bal NGN 100OK");
  });

  it("passes plain text through untouched", () => {
    expect(
      decodeQuotedPrintable(Buffer.from("hello world")).toString(),
    ).toBe("hello world");
  });
});

describe("decodeTransfer", () => {
  it("decodes base64", () => {
    expect(
      decodeTransfer(Buffer.from("SGVsbG8="), "base64").toString(),
    ).toBe("Hello");
  });

  it("leaves 7bit/8bit/undefined alone", () => {
    expect(decodeTransfer(Buffer.from("plain"), "7bit").toString()).toBe("plain");
    expect(decodeTransfer(Buffer.from("plain"), undefined).toString()).toBe("plain");
  });
});

describe("decodeCharset", () => {
  it("decodes a non-UTF-8 charset", () => {
    // "é" in latin-1 is byte 0xE9
    expect(decodeCharset(Buffer.from([0xe9]), "iso-8859-1")).toBe("é");
  });

  it("falls back to UTF-8 for unknown charsets", () => {
    expect(decodeCharset(Buffer.from("ok"), "x-not-a-charset")).toBe("ok");
  });
});

describe("extractBodies", () => {
  it("splits a multipart/alternative into text and html", async () => {
    const raw = Buffer.from(
      "From: a@b.c\r\nContent-Type: multipart/alternative; boundary=XX\r\n\r\n" +
        "--XX\r\nContent-Type: text/plain; charset=utf-8\r\n" +
        "Content-Transfer-Encoding: quoted-printable\r\n\r\nAcct bal=20NGN 100\r\n" +
        "--XX\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<b>Acct bal</b>\r\n" +
        "--XX--\r\n",
    );
    const bodies = await extractBodies(raw);
    expect(bodies.text).toBe("Acct bal NGN 100");
    expect(bodies.html).toBe("<b>Acct bal</b>");
  });

  it("handles a single-part plain message", async () => {
    const raw = Buffer.from(
      "From: a@b.c\r\nContent-Type: text/plain\r\n\r\njust text\r\n",
    );
    const bodies = await extractBodies(raw);
    expect(bodies.text).toContain("just text");
    expect(bodies.html).toBe("");
  });

  it("handles base64 HTML parts (how real HTML mail arrives)", async () => {
    const html = "<html><body>Debit NGN 5,000</body></html>";
    const b64 = Buffer.from(html).toString("base64");
    const raw = Buffer.from(
      `From: a@b.c\r\nContent-Type: multipart/alternative; boundary=XX\r\n\r\n` +
        `--XX\r\nContent-Type: text/plain\r\n\r\ntext version\r\n` +
        `--XX\r\nContent-Type: text/html; charset=utf-8\r\n` +
        `Content-Transfer-Encoding: base64\r\n\r\n${b64}\r\n--XX--\r\n`,
    );
    const bodies = await extractBodies(raw);
    expect(bodies.text).toBe("text version");
    expect(bodies.html).toBe(html);
  });

  it("resolves empty for an empty payload", async () => {
    expect(await extractBodies(Buffer.alloc(0))).toEqual({ text: "", html: "" });
  });

  it("keeps the FIRST text/plain when several exist", async () => {
    const raw = Buffer.from(
      "From: a@b.c\r\nContent-Type: multipart/mixed; boundary=XX\r\n\r\n" +
        "--XX\r\nContent-Type: text/plain\r\n\r\nfirst\r\n" +
        "--XX\r\nContent-Type: text/plain\r\n\r\nsecond\r\n--XX--\r\n",
    );
    const bodies = await extractBodies(raw);
    expect(bodies.text).toBe("first");
  });
});
