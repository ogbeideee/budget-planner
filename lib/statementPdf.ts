// PDF document classification (Kuda OCR part 1).
//
// One seam that tells the import flow what kind of PDF it is BEFORE
// extraction decides how to read it:
//
//   "text"                 → usable text layer (existing parsers)
//   "scanned"              → no usable text layer (OCR fallback)
//   "encrypted"            → password-protected (password entry, then retry)
//   "unsupported"          → cannot be read here (corrupt, weird encryption)
//
// The classifier itself lives in lib/statementOcr.ts (`classifyPdfDocument`):
// it opens the document with pdfjs and reads the text layer — never
// rendering pages. This module only carries the SHARED vocabulary (kind +
// password status types, the typed password error, and the raw-pdfjs
// PasswordException mapping) so both the OCR seam and the extraction seam
// (lib/statementImport.ts) agree on what "password-protected" means.

export type PdfDocumentKind = "text" | "scanned" | "encrypted" | "unsupported";

/** What a password-protected PDF told us when we probed it. */
export type PdfPasswordStatus =
  /** The document needs a password we did not supply. */
  | "needs-password"
  /** We supplied a password and the document rejected it. */
  | "incorrect-password"
  /** pdfjs reported a PasswordException it could not classify (e.g. an
   *  encryption scheme it does not support). */
  | "unsupported-encryption";

/**
 * Typed error the extraction seam throws for password-protected PDFs so the
 * import UI can show its own password screen instead of the generic
 * "couldn't read that file" message.
 */
export class PdfPasswordError extends Error {
  override name = "PdfPasswordError";
  status: PdfPasswordStatus;
  constructor(status: PdfPasswordStatus, message?: string) {
    super(
      message ??
        (status === "needs-password"
          ? "This PDF is password-protected"
          : status === "incorrect-password"
            ? "Incorrect PDF password"
            : "This PDF uses an unsupported encryption scheme"),
    );
    this.status = status;
  }
}

export function isPdfPasswordError(error: unknown): error is PdfPasswordError {
  return (
    error instanceof PdfPasswordError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { name?: unknown }).name === "PdfPasswordError")
  );
}

/** Maps a raw pdfjs error to our password status, or null when it is not a
 *  password problem. pdfjs reports password failures as
 *  `PasswordException` with `code` 1 (NEED_PASSWORD) / 2 (INCORRECT_PASSWORD);
 *  any other PasswordException code is treated as unsupported encryption. */
export function passwordStatusOf(error: unknown): PdfPasswordStatus | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as { name?: unknown; code?: unknown };
  if (candidate.name !== "PasswordException") return null;
  if (candidate.code === 1) return "needs-password";
  if (candidate.code === 2) return "incorrect-password";
  return "unsupported-encryption";
}