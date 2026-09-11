import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const {
  createEmailScheduler,
  EMAIL_SYNC_INTERVAL_MS,
} = require_("./emailScheduler.cjs");

const HOUR = 60 * 60 * 1000;

describe("email scheduler", () => {
  it("exposes the one-hour interval as a named constant", () => {
    expect(EMAIL_SYNC_INTERVAL_MS).toBe(HOUR);
  });

  it("invokes the canonical check on each tick with the scheduled trigger", async () => {
    vi.useFakeTimers();
    const checkNow = vi.fn(async () => ({
      ok: true,
      trigger: "scheduled",
      started: true,
      at: "2026-09-03T00:00:00.000Z",
      fetched: 0,
      messages: [],
    }));
    const onResult = vi.fn();
    const scheduler = createEmailScheduler({
      checkNow,
      hasAccount: () => true,
      onResult,
      intervalMs: HOUR,
    });
    scheduler.start();
    // advanceTimersByTimeAsync lets the sync promise's microtasks settle, so
    // onResult has actually fired before the assertion.
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(checkNow).toHaveBeenCalledWith("scheduled");
    // The result is delivered through the callback the caller wired to the renderer.
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: "scheduled", ok: true }),
    );
    scheduler.stop();
    vi.useRealTimers();
  });

  it("does not fire the tick when no account is configured", () => {
    vi.useFakeTimers();
    const checkNow = vi.fn(async () => ({ ok: true, started: true }));
    const scheduler = createEmailScheduler({
      checkNow,
      hasAccount: () => false,
      intervalMs: HOUR,
    });
    scheduler.start();
    vi.advanceTimersByTime(HOUR * 3);
    expect(checkNow).not.toHaveBeenCalled();
    scheduler.stop();
    vi.useRealTimers();
  });

  it("never overlaps: a slow sync absorbs later ticks without queuing", async () => {
    vi.useFakeTimers();
    let resolveSync!: (value: unknown) => void;
    const checkNow = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSync = resolve;
        }),
    );
    const scheduler = createEmailScheduler({
      checkNow,
      hasAccount: () => true,
      intervalMs: HOUR,
    });
    scheduler.start();
    vi.advanceTimersByTime(HOUR);
    expect(checkNow).toHaveBeenCalledTimes(1);
    expect(scheduler.running).toBe(true);
    // One hour later the tick finds a sync still running — it drops it.
    vi.advanceTimersByTime(HOUR);
    expect(checkNow).toHaveBeenCalledTimes(1);
    // Manual while running is also refused (no stacking).
    const ack = scheduler.runNow();
    expect(ack).toMatchObject({ ok: true, started: false, reason: "busy" });
    resolveSync({ ok: true, started: true });
    await vi.runOnlyPendingTimersAsync();
    scheduler.stop();
    vi.useRealTimers();
  });

  it("runNow bypasses the timer — the manual path never waits for the next tick", () => {
    vi.useFakeTimers();
    const checkNow = vi.fn(async () => ({ ok: true, started: true }));
    const scheduler = createEmailScheduler({
      checkNow,
      hasAccount: () => true,
      intervalMs: 10 * HOUR,
    });
    scheduler.start();
    const ack = scheduler.runNow();
    expect(ack).toMatchObject({ ok: true, started: true });
    expect(checkNow).toHaveBeenCalledWith("manual");
    scheduler.stop();
    vi.useRealTimers();
  });

  it("the tray item invokes the SAME canonical check with the tray trigger", () => {
    vi.useFakeTimers();
    const checkNow = vi.fn(async () => ({ ok: true, started: true }));
    const scheduler = createEmailScheduler({
      checkNow,
      hasAccount: () => true,
      intervalMs: 10 * HOUR,
    });
    scheduler.start();
    scheduler.runNow("tray");
    expect(checkNow).toHaveBeenCalledWith("tray");
    scheduler.stop();
    vi.useRealTimers();
  });

  it("does not start a second timer when start() is called again", () => {
    vi.useFakeTimers();
    const checkNow = vi.fn(async () => ({ ok: true, started: true }));
    const scheduler = createEmailScheduler({
      checkNow,
      hasAccount: () => true,
      intervalMs: HOUR,
    });
    scheduler.start();
    scheduler.start();
    vi.advanceTimersByTime(HOUR);
    expect(checkNow).toHaveBeenCalledTimes(1);
    scheduler.stop();
    vi.useRealTimers();
  });

  it("stop() clears the timer", () => {
    vi.useFakeTimers();
    const checkNow = vi.fn(async () => ({ ok: true, started: true }));
    const scheduler = createEmailScheduler({
      checkNow,
      hasAccount: () => true,
      intervalMs: HOUR,
    });
    scheduler.start();
    scheduler.stop();
    vi.advanceTimersByTime(HOUR * 2);
    expect(checkNow).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("reports an unexpected sync throw through onResult instead of crashing", async () => {
    const checkNow = vi.fn(async () => {
      throw new Error("socket exploded");
    });
    const onResult = vi.fn();
    const scheduler = createEmailScheduler({
      checkNow,
      hasAccount: () => true,
      onResult,
      intervalMs: HOUR,
    });
    const ack = scheduler.runNow();
    expect(ack).toMatchObject({ ok: true, started: true });
    // Let the rejected promise settle.
    await vi.waitFor(() => {
      expect(onResult).toHaveBeenCalledWith(
        expect.objectContaining({ ok: false, category: "unknown" }),
      );
    }, { timeout: 2000 });
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
});