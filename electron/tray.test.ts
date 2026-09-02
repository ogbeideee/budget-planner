import { describe, expect, it, vi } from "vitest";
import * as tray from "./tray.cjs";

type MenuItem = {
  label?: string;
  type?: string;
  enabled?: boolean;
  click?: () => void;
};

interface TemplateOptions {
  appName: string;
  backgroundMode: boolean;
  canCheckAlerts: boolean;
  onQuickAdd?: () => void;
  onOpen?: () => void;
  onCheckAlerts?: () => void;
  onQuit?: () => void;
}

// The module is CommonJS with no types of its own; every handler is optional
// in practice (an item whose click is undefined simply does nothing), so the
// tests fill in the ones they are not asserting.
function buildTrayMenuTemplate(options: TemplateOptions): MenuItem[] {
  return tray.buildTrayMenuTemplate({
    onQuickAdd: () => {},
    onOpen: () => {},
    onCheckAlerts: () => {},
    onQuit: () => {},
    ...options,
  });
}

function labels(template: MenuItem[]): string[] {
  return template
    .filter((item) => item.type !== "separator")
    .map((item) => item.label ?? "");
}

function itemFor(template: MenuItem[], label: string): MenuItem {
  const found = template.find((item) => item.label === label);
  if (!found) throw new Error(`no menu item labelled "${label}"`);
  return found;
}

describe("buildTrayMenuTemplate", () => {
  it("offers add-expense, open and quit (req 6)", () => {
    const template = buildTrayMenuTemplate({
      appName: "Budget Planner",
      backgroundMode: false,
      canCheckAlerts: false,
    });

    expect(labels(template)).toEqual([
      "Add expense…",
      "Open Budget Planner",
      "Background mode: off (closing quits)",
      "Quit Budget Planner",
    ]);
  });

  it("routes each item to its handler", () => {
    const onQuickAdd = vi.fn();
    const onOpen = vi.fn();
    const onQuit = vi.fn();
    const template = buildTrayMenuTemplate({
      appName: "Budget Planner",
      backgroundMode: false,
      canCheckAlerts: false,
      onQuickAdd,
      onOpen,
      onQuit,
    });

    itemFor(template, "Add expense…").click?.();
    itemFor(template, "Open Budget Planner").click?.();
    itemFor(template, "Quit Budget Planner").click?.();

    expect(onQuickAdd).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onQuit).toHaveBeenCalledTimes(1);
  });

  it("shows the background-mode state as a disabled indicator (req 13)", () => {
    const off = buildTrayMenuTemplate({
      appName: "Budget Planner",
      backgroundMode: false,
      canCheckAlerts: false,
    });
    const on = buildTrayMenuTemplate({
      appName: "Budget Planner",
      backgroundMode: true,
      canCheckAlerts: false,
    });

    expect(itemFor(off, "Background mode: off (closing quits)").enabled).toBe(
      false,
    );
    expect(itemFor(on, "Background mode: on").enabled).toBe(false);
  });

  it("omits the alert check while no mail transport is registered", () => {
    // FR-24 landed the parser, vault and draft pipeline but NOT the IMAP
    // transport, so there is nothing for this item to call today. It must not
    // appear as a dead menu entry.
    const template = buildTrayMenuTemplate({
      appName: "Budget Planner",
      backgroundMode: true,
      canCheckAlerts: false,
    });

    expect(labels(template)).not.toContain("Check for new alerts now");
  });

  it("adds the alert check once a transport registers one (req 6, the seam)", () => {
    const onCheckAlerts = vi.fn();
    const template = buildTrayMenuTemplate({
      appName: "Budget Planner",
      backgroundMode: true,
      canCheckAlerts: true,
      onCheckAlerts,
    });

    expect(labels(template)).toContain("Check for new alerts now");
    itemFor(template, "Check for new alerts now").click?.();
    expect(onCheckAlerts).toHaveBeenCalledTimes(1);
  });

  it("falls back to the product name when none is supplied", () => {
    const template = buildTrayMenuTemplate({
      appName: "",
      backgroundMode: false,
      canCheckAlerts: false,
    });
    expect(labels(template)).toContain("Open Budget Planner");
  });
});
