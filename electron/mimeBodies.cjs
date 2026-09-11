// Local MIME body extraction for the IMAP transport (FR-24).
//
// WHY THIS EXISTS: the transport used to ask the server for
// `BODY.PEEK[HTML]` — not a valid IMAP section specifier — and Gmail
// answered the whole FETCH `BAD — Could not parse command` (found live,
// 2026-09-11). IMAP has no "give me the HTML part" selector that works
// without knowing the part number, so instead we fetch the RAW message
// source (capped) and split text/plain + text/html locally. mailsplit and
// the transfer-decodings here are exactly what imapflow itself uses.
//
// Pure buffer-in / strings-out; imports only the MIME library. No
// Electron, no network — unit-testable without a main process.
"use strict";

const { Splitter } = require("@zone-eu/mailsplit");

/** Decodes quoted-printable into a Buffer of raw bytes. */
function decodeQuotedPrintable(buffer) {
  const text = buffer.toString("binary").replace(/=\r?\n/g, "");
  const bytes = [];
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (
      char === "=" &&
      i + 2 < text.length &&
      /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 1, i + 3))
    ) {
      bytes.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(text.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

/** Applies the part's Content-Transfer-Encoding, returning raw bytes. */
function decodeTransfer(buffer, encoding) {
  switch (String(encoding ?? "").toLowerCase().trim()) {
    case "base64":
      return Buffer.from(
        buffer.toString("ascii").replace(/[^A-Za-z0-9+/=]/g, ""),
        "base64",
      );
    case "quoted-printable":
      return decodeQuotedPrintable(buffer);
    default:
      return buffer;
  }
}

/** Decodes bytes into a string using the part's charset (UTF-8 fallback). */
function decodeCharset(buffer, charset) {
  const normalized = String(charset ?? "").toLowerCase().trim();
  if (normalized && normalized !== "utf-8" && normalized !== "utf8") {
    try {
      return new TextDecoder(normalized).decode(buffer);
    } catch {
      // unknown charset label — fall through to UTF-8
    }
  }
  return buffer.toString("utf8");
}

/**
 * Splits a raw RFC-822 message into its first text/plain and text/html
 * bodies, transfer- and charset-decoded. Nested multiparts are walked by
 * mailsplit itself; embedded message/rfc822 leaves are treated like any
 * other leaf. Either side may be empty — the caller decides which to use.
 */
function extractBodies(raw) {
  return new Promise((resolve) => {
    const result = { text: "", html: "" };
    if (!raw || raw.length === 0) {
      resolve(result);
      return;
    }
    const splitter = new Splitter();
    let currentHeaders = null;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    splitter.on("readable", () => {
      let node;
      while ((node = splitter.read()) !== null) {
        if (node.type === "node") {
          currentHeaders = node;
        } else if (node.type === "body" && currentHeaders) {
          const contentType = String(currentHeaders.contentType ?? "").toLowerCase();
          if (!contentType.startsWith("text/")) continue;
          const decoded = decodeCharset(
            decodeTransfer(node.value, currentHeaders.encoding),
            currentHeaders.charset,
          );
          if (contentType.startsWith("text/plain")) {
            if (!result.text) result.text = decoded;
          } else if (contentType.startsWith("text/html")) {
            if (!result.html) result.html = decoded;
          }
        }
      }
    });
    splitter.on("end", settle);
    splitter.on("error", settle);
    splitter.end(raw);
  });
}

module.exports = { extractBodies, decodeTransfer, decodeQuotedPrintable, decodeCharset };
