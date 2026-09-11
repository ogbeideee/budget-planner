// HTML-to-plain-text conversion for HTML-only alert emails (FR-24).
//
// GTBank and Wema send HTML TABLE alerts. Converted to text they arrive as
// "| Label | : | Value |" rows — the exact layout that
// lib/emailAlerts.ts `normalizeAlertBody()` flattens — and the per-institution
// templates are anchored on that shape. Prose layouts (Kuda, Quick
// Microfinance when it ever sends HTML) must pass through in reading order.
//
// This runs in the ELECTRON MAIN PROCESS, immediately after the fetch, so a
// raw HTML body never crosses IPC: the renderer only sees the converted plain
// text (and the parser only ever sees plain text).
"use strict";

function decodeEntities(text) {
  return String(text ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      try {
        return String.fromCodePoint(Number.parseInt(code, 16));
      } catch {
        return "";
      }
    })
    .replace(/&#(\d+);/g, (_, code) => {
      try {
        return String.fromCodePoint(Number(code));
      } catch {
        return "";
      }
    });
}

/**
 * Converts an HTML email body to the plain-text shape the parser expects.
 *
 * The pipe-cell layout for table mail is preserved (`| Label | : | Value |`),
 * block boundaries become line breaks, and everything else is stripped so the
 * output is compact text. Never throws — an empty or unparseable input yields
 * an empty string rather than crashing a sync.
 */
function htmlToText(html) {
  let text = String(html ?? "");
  if (text.trim().length === 0) return "";

  // The <head> block is never alert payload (style/script/meta live there).
  text = text.replace(/<head[\s\S]*?<\/head>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");

  // Tabs around cells are pre-encoded; decode before layout work so `&nbsp;`
  // cannot survive into the extracted fields.
  text = decodeEntities(text);

  // Cell boundaries become the pipe separators the parser's table layout uses.
  text = text.replace(/<\/t[dh]>/gi, " | ");
  // Row boundaries start a pipe row: "<tr ...>" -> newline + "| ".
  text = text.replace(/<tr[^>]*>/gi, "\n| ");
  // Opening cell tags are content-free.
  text = text.replace(/<t[dh][^>]*>/gi, "");

  // Block-level boundaries become newlines.
  text = text.replace(/<\/(?:p|div|table|h[1-6]|li|blockquote|section|article)>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Every remaining tag is noise.
  text = text.replace(/<[^>]+>/g, "");

  // Collapse runs of horizontal whitespace to a single space per line, then
  // drop lines that carried nothing (including every blank table row, which
  // the parser itself would discard anyway).
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim());
  return lines.filter((line) => line.length > 0).join("\n");
}

module.exports = { htmlToText };