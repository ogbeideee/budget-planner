import type { Theme } from "./types";
import { STORAGE_KEY } from "./storage";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function extractThemeFromPayload(raw: string): Theme | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    const settings = (parsed as { state?: { settings?: { theme?: unknown } } })
      ?.state?.settings;
    const theme = settings?.theme;
    return theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : undefined;
  } catch {
    return undefined;
  }
}

export function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const theme = extractThemeFromPayload(raw);
      if (theme !== undefined) return theme;
    }
  } catch {
    // fall through to default
  }
  return "system";
}

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", resolveTheme(theme));
}

export const THEME_BOOTSTRAP_SCRIPT = `(function () {
  var key = "budget-planner:state";
  var defaultTheme = "light";
  function readTheme() {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return defaultTheme;
      var data = JSON.parse(raw);
      var theme = data && data.state && data.state.settings && data.state.settings.theme;
      return theme === "light" || theme === "dark" || theme === "system" ? theme : defaultTheme;
    } catch (e) {
      return defaultTheme;
    }
  }
  function apply(theme) {
    var dark = theme === "dark" || (theme === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }
  apply(readTheme());
  if (window.matchMedia && window.matchMedia.addEventListener) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      apply(readTheme());
    });
  }
})();`;
