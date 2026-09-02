import { describe, expect, it } from "vitest";
import * as backgroundMode from "./backgroundMode.cjs";

const {
  resolveCloseBehavior,
  shouldKeepRunning,
  normalizeSetting,
  trayTooltip,
} = backgroundMode;

// These are the FR-26 close-behaviour rules. They live in a pure module
// precisely so they can be asserted without an Electron main process — see the
// note in backgroundMode.cjs and the manual-verification list in
// docs/ARCHITECTURE.md §3.7.

describe("resolveCloseBehavior", () => {
  it("quits on close when background mode is off (the default, req 9)", () => {
    expect(
      resolveCloseBehavior({
        backgroundMode: false,
        quitting: false,
        trayAvailable: true,
      }),
    ).toBe("quit");
  });

  it("hides to the tray when background mode is on (req 8)", () => {
    expect(
      resolveCloseBehavior({
        backgroundMode: true,
        quitting: false,
        trayAvailable: true,
      }),
    ).toBe("hide");
  });

  it("quits when an explicit quit is in progress, even in background mode", () => {
    // Without this the tray would be a trap: Quit would re-hide the window and
    // the app could never actually exit.
    expect(
      resolveCloseBehavior({
        backgroundMode: true,
        quitting: true,
        trayAvailable: true,
      }),
    ).toBe("quit");
  });

  it("quits when there is no tray, whatever the setting says", () => {
    // Hiding into a tray that failed to register would strand the user with a
    // running process and no way back to it.
    expect(
      resolveCloseBehavior({
        backgroundMode: true,
        quitting: false,
        trayAvailable: false,
      }),
    ).toBe("quit");
  });

  it("treats a missing or non-boolean setting as off", () => {
    for (const value of [undefined, null, 0, "", "true", 1, {}]) {
      expect(
        resolveCloseBehavior({
          backgroundMode: value,
          quitting: false,
          trayAvailable: true,
        }),
      ).toBe("quit");
    }
  });
});

describe("shouldKeepRunning", () => {
  it("does not outlive its windows by default (req 9, backward compatible)", () => {
    expect(
      shouldKeepRunning({
        backgroundMode: false,
        quitting: false,
        trayAvailable: true,
        platform: "win32",
      }),
    ).toBe(false);
  });

  it("keeps the process alive in background mode with a tray (req 8)", () => {
    expect(
      shouldKeepRunning({
        backgroundMode: true,
        quitting: false,
        trayAvailable: true,
        platform: "win32",
      }),
    ).toBe(true);
  });

  it("never keeps running once a quit has been requested", () => {
    expect(
      shouldKeepRunning({
        backgroundMode: true,
        quitting: true,
        trayAvailable: true,
        platform: "win32",
      }),
    ).toBe(false);
    // Including on macOS, where the app would otherwise outlive its windows.
    expect(
      shouldKeepRunning({
        backgroundMode: false,
        quitting: true,
        trayAvailable: true,
        platform: "darwin",
      }),
    ).toBe(false);
  });

  it("keeps macOS behaviour unchanged when background mode is off", () => {
    // macOS apps already survive their last window; that predates this feature
    // and must not regress.
    expect(
      shouldKeepRunning({
        backgroundMode: false,
        quitting: false,
        trayAvailable: false,
        platform: "darwin",
      }),
    ).toBe(true);
  });

  it("quits without a tray on Windows and Linux", () => {
    for (const platform of ["win32", "linux"]) {
      expect(
        shouldKeepRunning({
          backgroundMode: true,
          quitting: false,
          trayAvailable: false,
          platform,
        }),
      ).toBe(false);
    }
  });
});

describe("normalizeSetting", () => {
  it("accepts only a literal true", () => {
    expect(normalizeSetting(true)).toBe(true);
    for (const value of [false, undefined, null, 1, "true", {}, []]) {
      expect(normalizeSetting(value)).toBe(false);
    }
  });
});

describe("trayTooltip", () => {
  it("distinguishes background mode from a plain running window (req 13)", () => {
    expect(trayTooltip({ appName: "Budget Planner", backgroundMode: true })).toBe(
      "Budget Planner — running in the background",
    );
    expect(
      trayTooltip({ appName: "Budget Planner", backgroundMode: false }),
    ).toBe("Budget Planner — window open");
  });

  it("falls back to the product name when none is given", () => {
    expect(trayTooltip({ appName: "", backgroundMode: false })).toContain(
      "Budget Planner",
    );
  });
});
