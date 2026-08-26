// VS Code-style overlay scrollbars: reveal the thumbs while the page is being
// scrolled and fade them out shortly after scrolling stops. This file only
// toggles `html[data-scrolling]` — all visuals live in globals.css (the thumb
// is painted by the app, so behaviour is identical on every machine and
// independent of the OS "Automatically hide scroll bars" setting).
const HIDE_AFTER_MS = 600;

export function initOverlayScrollbars(): () => void {
  if (typeof window === "undefined") return () => {};
  const root = document.documentElement;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const onScroll = () => {
    if (root.dataset.scrolling !== "on") root.dataset.scrolling = "on";
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      delete root.dataset.scrolling;
      idleTimer = null;
    }, HIDE_AFTER_MS);
  };

  document.addEventListener("scroll", onScroll, {
    capture: true,
    passive: true,
  });
  return () => {
    document.removeEventListener("scroll", onScroll, true);
    if (idleTimer !== null) clearTimeout(idleTimer);
    delete root.dataset.scrolling;
  };
}
