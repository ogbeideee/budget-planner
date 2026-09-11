import { describe, expect, it } from "vitest";
import { shouldToastSyncSummary } from "./useEmailSync";
import type { EmailSyncResultSummary } from "@/lib/desktop";

function summary(overrides: Partial<EmailSyncResultSummary>): EmailSyncResultSummary {
  return {
    ok: true,
    trigger: "manual",
    started: true,
    at: "2026-09-11T00:00:00.000Z",
    fetched: 0,
    ...overrides,
  };
}

describe("shouldToastSyncSummary", () => {
  it("stays silent when the scheduled tick found nothing", () => {
    expect(shouldToastSyncSummary(summary({ trigger: "scheduled" }))).toBe(false);
  });

  it("stays silent even when a scheduled tick fetched messages (the delivery handler toasts instead)", () => {
    expect(
      shouldToastSyncSummary(summary({ trigger: "scheduled", fetched: 2 })),
    ).toBe(false);
  });

  it("reports a manual check that found nothing", () => {
    expect(shouldToastSyncSummary(summary({ trigger: "manual" }))).toBe(true);
  });

  it("reports the tray check that found nothing", () => {
    expect(shouldToastSyncSummary(summary({ trigger: "tray" }))).toBe(true);
  });

  it("a failure surfaces on every trigger — scheduled included", () => {
    expect(
      shouldToastSyncSummary(
        summary({ trigger: "scheduled", ok: false, category: "auth", message: "auth failed" }),
      ),
    ).toBe(true);
    expect(shouldToastSyncSummary(summary({ trigger: "manual", ok: false }))).toBe(true);
  });

  it("the busy refusal surfaces (it follows an explicit user action)", () => {
    expect(
      shouldToastSyncSummary(summary({ trigger: "manual", started: false })),
    ).toBe(true);
  });
});
