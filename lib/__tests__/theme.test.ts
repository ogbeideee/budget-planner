import { beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { THEME_BOOTSTRAP_SCRIPT } from "../theme";

const STORAGE_KEY = "budget-planner:state";

function seedStoredTheme(theme: "light" | "dark" | "system") {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ state: { settings: { theme } }, version: 1 }),
  );
}

function runBootstrap() {
  (window as unknown as { eval(script: string): unknown }).eval(
    THEME_BOOTSTRAP_SCRIPT,
  );
}

function installServerMarkup() {
  document.documentElement.setAttribute("data-theme", "light");
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.textContent = THEME_BOOTSTRAP_SCRIPT;
  document.head.appendChild(script);
}

function hydrateLayout({
  suppressHydrationWarning,
}: {
  suppressHydrationWarning: boolean;
}): string[] {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  };
  let root: ReturnType<typeof hydrateRoot>;
  act(() => {
    root = hydrateRoot(
      document.documentElement,
      createElement(
        "html",
        { lang: "en", "data-theme": "light", suppressHydrationWarning },
        createElement(
          "head",
          null,
          createElement("script", {
            type: "text/plain",
            suppressHydrationWarning: true,
            dangerouslySetInnerHTML: { __html: THEME_BOOTSTRAP_SCRIPT },
          }),
        ),
        createElement("body", null),
      ),
    );
  });
  act(() => {
    root.unmount();
  });
  console.error = original;
  return errors;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.head.innerHTML = "";
  installServerMarkup();
});

describe("theme bootstrap script", () => {
  it("applies a stored dark preference before hydration", () => {
    seedStoredTheme("dark");
    runBootstrap();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("applies a stored light preference before hydration", () => {
    seedStoredTheme("light");
    runBootstrap();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("resolves the system preference before hydration", () => {
    seedStoredTheme("system");
    runBootstrap();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("keeps the server default when nothing is stored", () => {
    runBootstrap();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("keeps the server default when stored data is corrupted", () => {
    window.localStorage.setItem(STORAGE_KEY, "not json");
    runBootstrap();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});

describe("theme hydration", () => {
  it("hydrates without warnings when the script pre-sets a different theme (suppressHydrationWarning)", () => {
    seedStoredTheme("dark");
    runBootstrap();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    const errors = hydrateLayout({ suppressHydrationWarning: true });
    expect(errors).toEqual([]);
  });

  it("reports the attribute mismatch without suppressHydrationWarning", () => {
    seedStoredTheme("dark");
    runBootstrap();
    const errors = hydrateLayout({ suppressHydrationWarning: false });
    expect(errors.some((error) => /hydrat/i.test(error))).toBe(true);
  });
});
