import type { Theme } from "./types";

const DARK_QUERY = "(prefers-color-scheme: dark)";

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
      var bridge = window.budgetPlannerDesktop;
      var raw = bridge && bridge.storage ? bridge.storage.getItem(key) : null;
      if (!raw) raw = window.localStorage.getItem(key);
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
