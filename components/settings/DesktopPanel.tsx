"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { isDesktop } from "@/lib/desktop";
import { readBackgroundMode } from "@/lib/desktopFeatures";
import { useToast } from "@/hooks/useToast";
import { useAppStore } from "@/store/useAppStore";

/**
 * Desktop behaviour settings (FR-26).
 *
 * Only rendered on the desktop build — a browser tab has no tray and no
 * process to keep alive, so the toggle would be meaningless there.
 *
 * The wording is deliberately about what the app does TODAY: it keeps running
 * so the tray stays available. Email alerts are not mentioned, because the
 * IMAP transport that would check them has not landed yet (FR-24 remaining
 * work). Promising background email checking in a label while nothing checks
 * mail would be a lie the UI tells on every visit — the copy gets revisited
 * when the transport ships. See docs/15_EMAIL_PARSING.md.
 */
export function DesktopPanel() {
  const backgroundMode = useAppStore((s) => s.state.settings.backgroundMode);
  const setSettings = useAppStore((s) => s.setSettings);
  const { success } = useToast();

  // Whether the OS actually gave us a tray icon. The setting can be on while
  // this is false (headless Linux session, locked-down shell), and in that
  // case closing the window still quits — the panel has to say so rather than
  // let the user find out by losing the app.
  const [trayAvailable, setTrayAvailable] = useState(true);

  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;
    void readBackgroundMode().then((status) => {
      if (!cancelled) setTrayAvailable(status.trayAvailable);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isDesktop()) return null;

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Closing the window"
        subtitle="Choose whether closing the window quits the app or leaves it in the system tray."
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-ink">
              Keep running in the background
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {backgroundMode
                ? "Closing the window hides it to the system tray and the app keeps running. Use the tray icon to add an expense or reopen the window, and Quit to exit."
                : "Closing the window quits the app, the way it always has. Turn this on to keep the tray icon available after you close the window."}
            </p>
          </div>
          <Switch
            checked={backgroundMode}
            label="Keep running in the background after closing the window"
            onChange={(checked) => {
              setSettings({ backgroundMode: checked });
              success(
                checked
                  ? "Closing the window will now minimize to the tray."
                  : "Closing the window will now quit the app.",
              );
            }}
          />
        </div>

        {backgroundMode && !trayAvailable && (
          <p className="mt-4 rounded-lg bg-expense-surface px-3 py-2.5 text-sm leading-relaxed text-danger-text">
            This system didn&apos;t provide a tray icon, so closing the window
            will still quit the app. Nothing is lost — the setting takes effect
            if a tray becomes available.
          </p>
        )}

        <p className="mt-4 text-sm leading-relaxed text-muted">
          The app never starts itself. This only changes what the close button
          does while you are already running it.
        </p>
      </Card>
    </div>
  );
}
