"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onDesktopNavigate } from "@/lib/desktopFeatures";

/**
 * Routes the app when the main process asks it to (FR-26 req 11) — a tray
 * "Open" carrying a destination, or a click on a background notification.
 *
 * Only same-app paths are honoured. The route string arrives over IPC, and
 * while today it is only ever produced by this app's own main process, a
 * navigation primitive that accepts arbitrary strings is the kind of thing
 * that later becomes an open-redirect. A leading "/" with no "//" keeps it a
 * relative in-app route: no protocol, no host, nowhere off the bundle.
 */
export function isNavigableRoute(route: unknown): route is string {
  return (
    typeof route === "string" &&
    route.startsWith("/") &&
    !route.startsWith("//") &&
    !route.includes("\\")
  );
}

export function useDesktopNavigation(): void {
  const router = useRouter();
  useEffect(
    () =>
      onDesktopNavigate((route) => {
        if (!isNavigableRoute(route)) return;
        router.push(route);
      }),
    [router],
  );
}
