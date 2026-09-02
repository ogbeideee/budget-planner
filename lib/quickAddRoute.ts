/**
 * The tray quick-add route (FR-26).
 *
 * Its own module because three unrelated places need to agree on the string —
 * the Electron main process (which loads the window at this path), `AppShell`
 * (which renders it chromeless instead of wrapping it in the app shell), and
 * `initDesktopBootstrap` (which skips its per-window background work). A typo
 * in any one of them would silently produce a quick-add window wearing the
 * full sidebar, so the value is defined once.
 */
export const QUICK_ADD_ROUTE = "/quick-add";
