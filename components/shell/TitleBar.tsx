"use client";

import { useEffect } from "react";
import { WalletIcon } from "@/components/ui/icons";
import { isDesktop } from "@/lib/desktop";
import { APP_NAME } from "@/lib/version";

// Desktop custom title bar. The native frame is hidden (titleBarStyle:
// "hidden") and the native Windows min/max/close controls are overlaid on the
// top-right (titleBarOverlay) — this bar is pure renderer, painted with the
// design-system tokens. The whole strip is a drag region; it contains no
// interactive controls, so nothing needs no-drag. In a plain browser it
// renders as a regular app header.

// Computed token values can be compressed (e.g. "#fff"); the overlay API wants
// explicit 6-digit hex, so expand shorthand and reject anything else.
function normalizeHex(value: string): string | null {
  let hex = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    hex = `#${hex.slice(1).split("").map((c) => c + c).join("")}`;
  }
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null;
}

export function TitleBar() {
  useEffect(() => {
    if (!isDesktop()) return;
    // Keep the native overlay buttons in sync with the resolved theme: colors
    // come straight from the design tokens (--color-surface / --color-ink).
    const sync = () => {
      const bridge = window.budgetPlannerDesktop;
      if (!bridge?.window?.setTitleBarOverlay) return;
      const styles = getComputedStyle(document.documentElement);
      const color = normalizeHex(
        styles.getPropertyValue("--color-surface"),
      ) ?? "#ffffff";
      const symbolColor = normalizeHex(
        styles.getPropertyValue("--color-ink"),
      ) ?? "#0f172a";
      bridge.window.setTitleBarOverlay({ color, symbolColor });
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <header
      data-titlebar
      className="no-print fixed inset-x-0 top-0 z-40 flex h-11 select-none items-center gap-3 border-b border-border/70 bg-surface pl-4 pr-4 [-webkit-app-region:drag]"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-500 text-white shadow-card">
        <WalletIcon className="h-4 w-4" />
      </span>
      <span className="min-w-0 truncate text-sm font-bold tracking-tight text-ink">
        {APP_NAME}
      </span>
    </header>
  );
}
