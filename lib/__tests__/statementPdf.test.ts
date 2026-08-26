import { describe, expect, it } from "vitest";

import {
  isPdfPasswordError,
  passwordStatusOf,
  PdfPasswordError,
} from "@/lib/statementPdf";

describe("PdfPasswordError", () => {
  it("carries the status and a human message", () => {
    const error = new PdfPasswordError("needs-password");
    expect(error.name).toBe("PdfPasswordError");
    expect(error.status).toBe("needs-password");
    expect(error.message).toContain("password");

    expect(new PdfPasswordError("incorrect-password").status).toBe(
      "incorrect-password",
    );
    expect(new PdfPasswordError("unsupported-encryption").message).toContain(
      "unsupported",
    );
  });

  it("is recognized by isPdfPasswordError", () => {
    expect(isPdfPasswordError(new PdfPasswordError("needs-password"))).toBe(true);
    expect(isPdfPasswordError(new Error("other"))).toBe(false);
    expect(isPdfPasswordError({ name: "PdfPasswordError" })).toBe(true);
    expect(isPdfPasswordError(null)).toBe(false);
  });
});

describe("passwordStatusOf", () => {
  function pdfjsPasswordError(code: number): Error & { name: string; code: number } {
    const error = new Error("password") as Error & { name: string; code: number };
    error.name = "PasswordException";
    error.code = code;
    return error;
  }

  it("maps pdfjs PasswordException codes 1 and 2", () => {
    expect(passwordStatusOf(pdfjsPasswordError(1))).toBe("needs-password");
    expect(passwordStatusOf(pdfjsPasswordError(2))).toBe("incorrect-password");
  });

  it("treats unknown PasswordException codes as unsupported encryption", () => {
    expect(passwordStatusOf(pdfjsPasswordError(99))).toBe("unsupported-encryption");
  });

  it("returns null for anything else", () => {
    expect(passwordStatusOf(new Error("boom"))).toBeNull();
    expect(passwordStatusOf("nope")).toBeNull();
    expect(passwordStatusOf(null)).toBeNull();
    expect(passwordStatusOf(undefined)).toBeNull();
  });
});