import type { Theme } from "./types";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export type Accent = "emerald" | "blue" | "indigo" | "amber" | "slate";

export const ACCENTS: ReadonlyArray<{ value: Accent; label: string; swatch: string }> = [
  { value: "emerald", label: "Emerald", swatch: "#0ea5a4" },
  { value: "blue", label: "Blue", swatch: "#2563eb" },
  { value: "indigo", label: "Indigo", swatch: "#6366f1" },
  { value: "amber", label: "Amber", swatch: "#f59e0b" },
  { value: "slate", label: "Slate", swatch: "#64748b" },
];

export const ACCENT_STORAGE_KEY = "settings:accent";
export const ANIMATIONS_STORAGE_KEY = "settings:animations";

export type AnimationsPref = "on" | "off";

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", resolveTheme(theme));
}

export function isAccent(value: unknown): value is Accent {
  return (
    value === "emerald" ||
    value === "blue" ||
    value === "indigo" ||
    value === "amber" ||
    value === "slate"
  );
}

export function resolveAccent(value: unknown): Accent {
  return isAccent(value) ? value : "emerald";
}

function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const bridge = window.budgetPlannerDesktop;
    const raw =
      bridge && bridge.storage ? bridge.storage.getItem(key) : null;
    return raw === null ? window.localStorage.getItem(key) : raw;
  } catch {
    return null;
  }
}

export function readAccent(): Accent {
  const raw = readStored(ACCENT_STORAGE_KEY);
  return resolveAccent(raw ? JSON.parse(raw) : "emerald");
}

export function applyAccent(accent: Accent): void {
  document.documentElement.setAttribute("data-accent", accent);
}

export function resolveAnimations(value: unknown): AnimationsPref {
  return value === "off" ? "off" : "on";
}

export function readAnimations(): AnimationsPref {
  const raw = readStored(ANIMATIONS_STORAGE_KEY);
  return resolveAnimations(raw ? JSON.parse(raw) : "on");
}

export function applyAnimations(pref: AnimationsPref): void {
  document.documentElement.setAttribute("data-animations", pref);
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
  function readAppearance(storeKey, fallback) {
    try {
      var bridge = window.budgetPlannerDesktop;
      var raw = bridge && bridge.storage ? bridge.storage.getItem(storeKey) : null;
      if (raw === null) raw = window.localStorage.getItem(storeKey);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  var accent = readAppearance("settings:accent", "emerald");
  if (accent === "blue" || accent === "indigo" || accent === "amber" || accent === "slate" || accent === "emerald") {
    document.documentElement.setAttribute("data-accent", accent);
  }
  var animations = readAppearance("settings:animations", "on");
  document.documentElement.setAttribute("data-animations", animations === "off" ? "off" : "on");
})();`;
