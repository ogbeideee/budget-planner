import { describe, expect, it } from "vitest";
import {
  clearEmailDrafts,
  loadEmailDrafts,
  normalizePendingDraft,
  saveEmailDrafts,
  EMAIL_DRAFTS_STORAGE_KEY,
} from "../emailDrafts";
import { getStorageBackend } from "../storageAdapter";

function draftRow() {
  return {
    id: "row-1",
    type: "expense" as const,
    direction: "out" as const,
    categoryId: "c-groceries",
    transactionDate: "2026-08-12",
    description: "SHOPRITE LEKKI",
    excluded: false,
    sourceBank: "other" as const,
  };
}

function validDraft() {
  return {
    messageId: "imap-42",
    institution: "gtbank" as const,
    label: "GTBank",
    row: draftRow(),
    needsReview: { missing: ["amount" as const], snippet: "Amount | : | NGN ****" },
    suggestion: {
      categoryId: "c-groceries",
      match: "exact" as const,
      confident: false,
    },
    duplicates: [{ existingId: "t1", score: 0.9 }],
    dateFromHeader: false,
    createdAt: "2026-09-03T10:00:00.000Z",
  };
}

describe("emailDrafts — persisted review queue", () => {
  it("round-trips a draft through the storage seam", () => {
    saveEmailDrafts([validDraft()]);
    expect(loadEmailDrafts()).toEqual([validDraft()]);
    clearEmailDrafts();
    expect(loadEmailDrafts()).toEqual([]);
  });

  it("drops malformed entries instead of crashing the app", () => {
    const corrupt = [
      validDraft(),
      { messageId: "" }, // no id
      { messageId: "x", institution: "not-a-bank" }, // bad institution
      { messageId: "y", institution: "gtbank" }, // no row
      "a string",
      null,
    ];
    getStorageBackend().setItem(EMAIL_DRAFTS_STORAGE_KEY, JSON.stringify(corrupt));
    const loaded = loadEmailDrafts();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].messageId).toBe("imap-42");
  });

  it("survives a corrupt persisted blob", () => {
    getStorageBackend().setItem(EMAIL_DRAFTS_STORAGE_KEY, "{not json");
    expect(loadEmailDrafts()).toEqual([]);
  });

  it("normalization restores the planImport-critical defaults", () => {
    const normalized = normalizePendingDraft({
      messageId: "z",
      institution: "wema",
      label: "Wema Bank",
      row: { id: "row-2", description: "NIP TRANSFER" }, // type/direction/etc missing
      dateFromHeader: true,
    });
    expect(normalized).not.toBeNull();
    expect(normalized!.row.type).toBe("unknown");
    expect(normalized!.row.categoryId).toBeNull();
    expect(normalized!.row.excluded).toBe(false);
    expect(normalized!.dateFromHeader).toBe(true);
  });

  it("rejects a draft whose row has no id or description", () => {
    expect(
      normalizePendingDraft({
        messageId: "z", institution: "gtbank", label: "GTBank",
        row: { description: "no id" },
      }),
    ).toBeNull();
    expect(
      normalizePendingDraft({
        messageId: "z", institution: "gtbank", label: "GTBank",
        row: { id: "row-3" },
      }),
    ).toBeNull();
  });
});