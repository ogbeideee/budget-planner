"use client";

// Email sync orchestration (FR-24, sync stage) — the LIVE application caller
// of the existing parser + pipeline.
//
// Flow (each step reuses an existing engine; nothing is reimplemented):
//   main sync delivers AlertEmail[]          (desktop:email:alerts event)
//     → parseAlerts()                        (lib/emailAlerts.ts)
//     → buildEmailDrafts()                   (lib/emailPipeline.ts — shared
//                                             categorization + duplicate scoring)
//     → processDeliveredEmails() split       (lib/emailSyncClient.ts)
//     → auto (fully parsed + confident)      → planImport → addTransactions
//     → review (gap / uncertain / duplicate) → persisted draft queue → UI
//     → confirmEmailProcessed()              (mailbox-level dedupe, in main)
//
// Mounted ONCE, in the main window shell (never in the quick-add renderer,
// which shares the same SQLite and must not run write-at-mount work).
import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useEmailSync } from "@/store/useEmailSync";
import { useToastStore } from "@/store/useToastStore";
import { loadEmailAccountConfig } from "@/lib/emailAccount";
import type { EmailAlertsDelivered, EmailSyncResultSummary } from "@/lib/desktop";
import {
  confirmEmailProcessed,
  onEmailAlertsDelivered,
  onEmailSyncResult,
  readEmailSyncStatus,
  reportEmailAccountToMain,
} from "@/lib/emailSyncBridge";
import {
  existingFromLedger,
  planEmailAutoImport,
  processDeliveredEmails,
} from "@/lib/emailSyncClient";
import { toPendingDraft } from "@/lib/emailSyncDraft";

/** Converts a pipeline draft into the persisted review shape. */
export function EmailSyncBridge(): null {
  useEffect(() => {
    // 1. Tell main the persistable account config + allowlist domains so the
    //    scheduler runs and the tray "Check for new alerts now" item appears
    //    (main is TOLD, never parses stored AppState). Config may be absent —
    //    report that too, so a previously-configured account clears cleanly.
    const config = loadEmailAccountConfig();
    void reportEmailAccountToMain(config);

    // 2. Current sync status (last outcome, backoff, in-flight).
    void readEmailSyncStatus().then((status) => {
      useEmailSync.getState().setSyncStatus(status);
    });

    // 3. Safe summaries after every canonical run.
    const offResult = onEmailSyncResult((result: EmailSyncResultSummary) => {
      const store = useEmailSync.getState();
      store.setCheckRunning(false);
      // Merge with the previous report (status() may not have refetched yet).
      store.setSyncStatus({
        configured: true,
        account: result.account ?? null,
        inFlight: false,
        lastResult: result,
        backoff: { active: false },
        lastSyncAt: result.ok ? (result.at ?? null) : null,
      });
      reportSyncSummary(result);
    });

    // 4. Delivered message batches → parse → draft → auto-import / review.
    const offAlerts = onEmailAlertsDelivered((payload: EmailAlertsDelivered) => {
      void onAlertsDelivered(payload);
    });

    return () => {
      offResult();
      offAlerts();
    };
  }, []);

  return null;
}
/** Handles one delivered batch. Never throws into the event listener. */
async function onAlertsDelivered(payload: EmailAlertsDelivered): Promise<void> {
  try {
    const { messages: emails } = payload;
    const app = useAppStore.getState();
    const store = useEmailSync.getState();

    // Renderer-side second line: message ids already queued this session must
    // not be re-offered even if a confirm raced the next poll.
    const seen = new Set(store.drafts.map((draft) => draft.messageId));

    const result = processDeliveredEmails({
      emails,
      categories: app.state.categories,
      learnedRules: app.state.learnedRules,
      existing: existingFromLedger(app.state.transactions),
      seenMessageIds: seen,
    });

    // AUTO: the same planner the statement import confirms with. planImport
    // re-runs the ledger-identity check, so a row already in the ledger is
    // skipped here too — never double-booked.
    let autoImported = 0;
    if (result.auto.length > 0) {
      const plan = planEmailAutoImport(result.auto, app.state.transactions);
      if (plan.inputs.length > 0) {
        app.addTransactions(plan.inputs);
        const imported = new Set(plan.importedIds);
        const usedRuleIds = [
          ...new Set(
            result.auto
              .filter(
                (draft) =>
                  imported.has(draft.row.id) && draft.suggestion?.confident,
              )
              .map((draft) => draft.suggestion!.categoryId),
          ),
        ];
        if (usedRuleIds.length > 0) app.markLearnedRulesUsed(usedRuleIds);
        autoImported = plan.importedIds.length;
      }
    }

    // REVIEW: persist for the review UI. Nothing is ever written without the
    // user approving it (the review-first rule holds in every trigger path).
    let queued = 0;
    if (result.review.length > 0) {
      store.addDrafts(result.review.map(toPendingDraft));
      queued = result.review.length;
    }

    // Mailbox-level dedupe: confirm AFTER applying/queuing, so the next poll
    // does not re-download these exact messages.
    await confirmEmailProcessed(result.messageIds);

    useEmailSync.getState().setSyncStatus({
      ...(useEmailSync.getState().syncStatus ?? {
        configured: true,
        account: null,
        inFlight: false,
        lastResult: null,
        backoff: { active: false },
        lastSyncAt: null,
      }),
      lastResult: {
        ok: true,
        trigger: "manual",
        started: true,
        at: new Date().toISOString(),
        fetched: emails.length,
        newCount: result.auto.length + result.review.length,
        account: null,
      },
    });

    if (autoImported > 0 || queued > 0) {
      const parts = [
        autoImported > 0 ? `${autoImported} imported` : "",
        queued > 0 ? `${queued} need review` : "",
      ].filter(Boolean);
      useToastStore
        .getState()
        .push(`Email alerts: ${parts.join(", ")}.`, "success");
    }
  } catch {
    // A delivery handling failure must never crash the app; the next scheduled
    // sync simply re-delivers anything not yet confirmed.
  }
}

/**
 * Whether a canonical run's summary deserves a toast. A scheduled
 * tick that found nothing must stay silent — a repeated "No new bank alerts."
 * toast is exactly the notification spam the OS notification path exists to
 * avoid. Failures surface on EVERY trigger (a sync failure must never
 * vanish); so does the busy refusal, which only happens after an explicit
 * user action anyway.
 */
export function shouldToastSyncSummary(result: EmailSyncResultSummary): boolean {
  if (!result.ok) return true;
  return result.trigger !== "scheduled";
}

/** Toast for a canonical run's safe summary (failures + no-new-alert cases). */
function reportSyncSummary(result: EmailSyncResultSummary): void {
  if (!shouldToastSyncSummary(result)) return;
  const push = useToastStore.getState().push;
  if (!result.ok) {
    if (result.started === false && result.reason === "busy") {
      push("An email check is already running.", "info");
      return;
    }
    push(result.message ?? "The email check could not be completed.", "error");
    return;
  }
  if (result.fetched === 0 || result.newCount === 0) {
    push("No new bank alerts.", "info");
  }
  // Positive counts are toasted by the delivery handler itself; the summary
  // path only covers the no-new-alert and failure cases.
}