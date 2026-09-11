import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { EMAIL_ALERTS_ROUTE, emailAlertNotification, planEmailDelivery } =
  require_("./emailDelivery.cjs");

describe("planEmailDelivery", () => {
  it("delivers to a visible window without notifying", () => {
    expect(planEmailDelivery({ windowVisible: true, ok: true, messageCount: 3 })).toEqual({
      deliver: true,
      cache: false,
      notify: null,
    });
  });

  it("caches and notifies when the window is hidden to the tray", () => {
    expect(planEmailDelivery({ windowVisible: false, ok: true, messageCount: 2 })).toEqual({
      deliver: false,
      cache: true,
      notify: { count: 2, deepLink: EMAIL_ALERTS_ROUTE },
    });
  });

  it("caches and notifies when there is no window at all", () => {
    const plan = planEmailDelivery({ windowVisible: false, ok: true, messageCount: 1 });
    expect(plan.cache).toBe(true);
    expect(plan.notify).not.toBeNull();
  });

  it("does nothing for an empty result", () => {
    expect(planEmailDelivery({ windowVisible: true, ok: true, messageCount: 0 })).toEqual({
      deliver: false,
      cache: false,
      notify: null,
    });
  });

  it("does nothing for a failed sync — the summary already reports it", () => {
    expect(planEmailDelivery({ windowVisible: false, ok: false, messageCount: 5 })).toEqual({
      deliver: false,
      cache: false,
      notify: null,
    });
  });

  it("treats a negative count as no messages", () => {
    expect(planEmailDelivery({ windowVisible: false, ok: true, messageCount: -1 })).toEqual({
      deliver: false,
      cache: false,
      notify: null,
    });
  });
});

describe("emailAlertNotification", () => {
  it("carries a count and no message content", () => {
    const notification = emailAlertNotification({ count: 4 });
    expect(notification.title).toBe("New bank alerts");
    expect(notification.body).toContain("4");
    expect(notification.body).not.toMatch(/NGN|₦|\d{4,}/);
    expect(notification.deepLink).toBe(EMAIL_ALERTS_ROUTE);
  });

  it("singularizes one alert", () => {
    expect(emailAlertNotification({ count: 1 }).body).toContain("1 new bank alert —");
  });

  it("deep links to the settings email section", () => {
    expect(EMAIL_ALERTS_ROUTE).toBe("/settings?section=email");
  });
});
