"use client";

// Email sync renderer store (FR-24, sync stage).
//
// Holds the pending review drafts (persisted through lib/emailDrafts — the
// single storage seam) plus the safe sync status main reports and the review
// modal's open flag. The ledger is NOT touched here: importing a draft goes
// through the ordinary `planImport` -> `addTransactions` actions.
import { create } from "zustand";
import type { EmailSyncStatusReport } from "@/lib/desktop";
import {
  loadEmailDrafts,
  saveEmailDrafts,
  type PendingEmailDraft,
} from "@/lib/emailDrafts";
import type { ImportRow } from "@/lib/statementPipeline";

interface EmailSyncState {
  /** Needs-review / uncertain drafts awaiting the user. Persisted. */
  drafts: PendingEmailDraft[];
  /** Safe status from main (last sync outcome, backoff, in-flight). */
  syncStatus: EmailSyncStatusReport | null;
  /** A manual/scheduled run is in flight (drives button spinners). */
  checkRunning: boolean;
  /** Whether the review modal is open. */
  reviewOpen: boolean;
  addDrafts(drafts: readonly PendingEmailDraft[]): void;
  updateRow(messageId: string, patch: Partial<ImportRow>): void;
  removeDraft(messageId: string): void;
  clearDrafts(): void;
  setSyncStatus(status: EmailSyncStatusReport | null): void;
  setCheckRunning(running: boolean): void;
  setReviewOpen(open: boolean): void;
}

function commit(drafts: PendingEmailDraft[]): PendingEmailDraft[] {
  saveEmailDrafts(drafts);
  return drafts;
}

export const useEmailSync = create<EmailSyncState>((set) => ({
  // Seeding from the synchronous storage seam at create() is safe here: the
  // persistence layer is sync in both browser and Electron (see AGENTS.md), so
  // hydrating inside create() matches what `useAppStore` does for AppState.
  drafts: loadEmailDrafts(),
  syncStatus: null,
  checkRunning: false,
  reviewOpen: false,

  addDrafts: (incoming) =>
    set((state) => {
      const seen = new Map(state.drafts.map((draft) => [draft.messageId, draft]));
      for (const draft of incoming) {
        if (!seen.has(draft.messageId)) seen.set(draft.messageId, draft);
      }
      const next = [...seen.values()].sort((a, b) =>
        a.createdAt < b.createdAt ? -1 : 1,
      );
      return { drafts: commit(next) };
    }),

  updateRow: (messageId, patch) =>
    set((state) => ({
      drafts: commit(
        state.drafts.map((draft) =>
          draft.messageId === messageId
            ? { ...draft, row: { ...draft.row, ...patch } }
            : draft,
        ),
      ),
    })),

  removeDraft: (messageId) =>
    set((state) => ({
      drafts: commit(state.drafts.filter((draft) => draft.messageId !== messageId)),
    })),

  clearDrafts: () => {
    saveEmailDrafts([]);
    set({ drafts: [] });
  },

  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setCheckRunning: (checkRunning) => set({ checkRunning }),
  setReviewOpen: (reviewOpen) => set({ reviewOpen }),
}));