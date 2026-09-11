import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { htmlToText } = require_("./emailHtml.cjs");

describe("htmlToText", () => {
  it("turns an HTML table into the pipe layout the parser expects", () => {
    const html = `
      <html><head><style>.x{color:red}</style></head><body>
      <table>
        <tr><td colspan="3">We wish to inform you that a DEBIT transaction occurred.</td></tr>
        <tr><td>Amount</td><td>:</td><td>NGN 5,000.00</td></tr>
        <tr><td>Description</td><td>:</td><td>SHOPRITE LEKKI</td></tr>
      </table>
      </body></html>`;
    const text = htmlToText(html);
    expect(text).toContain("We wish to inform you that a DEBIT transaction occurred.");
    expect(text).toContain("| Amount | : | NGN 5,000.00 |");
    expect(text).toContain("| Description | : | SHOPRITE LEKKI |");
    // style content must not survive
    expect(text).not.toContain(".x");
    expect(text).not.toContain("<");
  });

  it("emits the Exact GTBank-style row shape after normalize-supplied trimming", () => {
    const html =
      "<table><tr><td>Value Date</td><td>:</td><td>2026-07-30</td></tr></table>";
    const text = htmlToText(html);
    expect(text).toBe("| Value Date | : | 2026-07-30 |");
  });

  it("decodes HTML entities before layout work", () => {
    const html =
      "<table><tr><td>Narration</td><td>:</td><td>A &#8211; B &amp; Co</td></tr></table>";
    expect(htmlToText(html)).toContain("A \u2013 B & Co");
  });

  it("keeps prose multiline bodies in reading order (non-table mail)", () => {
    const html =
      "<p>Dear customer,</p><p>A DEBIT transaction recently occurred on your account.</p><p>Amount: \u20a653.75</p>";
    const text = htmlToText(html);
    expect(text.split("\n")).toEqual([
      "Dear customer,",
      "A DEBIT transaction recently occurred on your account.",
      "Amount: \u20a653.75",
    ]);
  });

  it("converts <br> to a line break", () => {
    expect(htmlToText("Line one<br>Line two")).toBe("Line one\nLine two");
  });

  it("returns an empty string for empty or tag-only input", () => {
    expect(htmlToText("")).toBe("");
    expect(htmlToText("<html><body></body></html>")).toBe("");
  });

  it("collapses whitespace runs within a line", () => {
    expect(htmlToText("<p>a    b</p>")).toBe("a b");
  });
});