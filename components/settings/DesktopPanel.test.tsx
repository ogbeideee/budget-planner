import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { isNavigableRoute } from "@/hooks/useDesktopNavigation";
import { DesktopPanel } from "./DesktopPanel";

// FR-26 requirements 7, 9 and 13, on the renderer side. The close-behaviour
// decision itself is asserted in electron/backgroundMode.test.ts; what matters
// here is that the toggle writes the setting and that main is told about it.

const reportBackgroundMode = vi.fn((enabled: boolean) =>
  Promise.resolve({ enabled, trayAvailable: true }),
);
let trayAvailable = true;

vi.mock("@/lib/desktop", () => ({
  isDesktop: () => true,
}));

vi.mock("@/lib/desktopFeatures", () => ({
  reportBackgroundMode: (enabled: boolean) => reportBackgroundMode(enabled),
  readBackgroundMode: () =>
    Promise.resolve({ enabled: false, trayAvailable }),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  trayAvailable = true;
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

const TOGGLE = "Keep running in the background after closing the window";

describe("DesktopPanel background mode (FR-26)", () => {
  it("defaults to off, so closing keeps quitting (req 7, req 9)", () => {
    render(<DesktopPanel />);
    expect(useAppStore.getState().state.settings.backgroundMode).toBe(false);
    expect(screen.getByLabelText(TOGGLE)).not.toBeChecked();
    expect(screen.getByText(/Closing the window quits the app/)).toBeTruthy();
  });

  it("turning it on writes the setting", async () => {
    const user = userEvent.setup();
    render(<DesktopPanel />);
    await user.click(screen.getByLabelText(TOGGLE));

    expect(useAppStore.getState().state.settings.backgroundMode).toBe(true);
    expect(
      screen.getByText(/hides it to the system tray and the app keeps running/),
    ).toBeTruthy();
  });

  it("turning it back off restores the original behaviour", async () => {
    const user = userEvent.setup();
    render(<DesktopPanel />);
    await user.click(screen.getByLabelText(TOGGLE));
    await user.click(screen.getByLabelText(TOGGLE));

    expect(useAppStore.getState().state.settings.backgroundMode).toBe(false);
    expect(screen.getByText(/Closing the window quits the app/)).toBeTruthy();
  });

  it("warns when the setting is on but no tray registered (req 13)", async () => {
    // Without a tray there is nothing to minimise into, so close-to-quit stays
    // in force whatever the setting says — the panel has to admit that rather
    // than let the user discover it by losing the app.
    trayAvailable = false;
    useAppStore.setState({
      state: {
        ...useAppStore.getState().state,
        settings: {
          ...useAppStore.getState().state.settings,
          backgroundMode: true,
        },
      },
    });
    render(<DesktopPanel />);
    await waitFor(() =>
      expect(
        screen.getByText(/didn't provide a tray icon/i),
      ).toBeTruthy(),
    );
  });

  it("stays quiet about the tray when one is available", async () => {
    useAppStore.setState({
      state: {
        ...useAppStore.getState().state,
        settings: {
          ...useAppStore.getState().state.settings,
          backgroundMode: true,
        },
      },
    });
    render(<DesktopPanel />);
    await waitFor(() =>
      expect(screen.queryByText(/didn't provide a tray icon/i)).toBeNull(),
    );
  });

  it("says nothing about email alerts, which cannot be checked yet", () => {
    // FR-24's IMAP transport has not landed, so background email checking does
    // not happen. The copy must not promise it. Delete this assertion when the
    // transport ships and the wording is revisited — docs/15_EMAIL_PARSING.md.
    const { container } = render(<DesktopPanel />);
    expect(container.textContent).not.toMatch(/email|alert|inbox|mail/i);
  });
});

describe("isNavigableRoute (FR-26 req 11)", () => {
  it("accepts in-app paths", () => {
    expect(isNavigableRoute("/")).toBe(true);
    expect(isNavigableRoute("/settings?action=import")).toBe(true);
  });

  it("rejects anything that could leave the app", () => {
    for (const route of [
      "//evil.example",
      "https://evil.example",
      "app://bundle/index.html",
      "\\\\server\\share",
      "settings",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(isNavigableRoute(route)).toBe(false);
    }
  });
});
