"use client";

import {
  CheckIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "@/components/ui/icons";
import { useTheme } from "@/hooks/useTheme";
import type { Theme } from "@/lib/types";

const OPTIONS: ReadonlyArray<{
  value: Theme;
  label: string;
  icon: typeof SunIcon;
}> = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

export function ThemeToggle({
  variant = "compact",
}: {
  variant?: "compact" | "cards";
}) {
  const { theme, setTheme } = useTheme();

  if (variant === "cards") {
    return (
      <div
        role="radiogroup"
        aria-label="Theme"
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {OPTIONS.map((option) => {
          const active = theme === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${option.label} theme`}
              onClick={() => setTheme(option.value)}
              className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus:outline-none sm:flex-col sm:items-start sm:gap-2.5 ${
                active
                  ? "border-brand-500/50 bg-brand-500/[0.06]"
                  : "border-border/70 bg-surface hover:border-border hover:bg-canvas"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ease-premium ${
                  active
                    ? "bg-brand-500 text-white"
                    : "bg-canvas text-muted group-hover:text-ink"
                }`}
              >
                <Icon />
              </span>
              <span
                className={`flex-1 text-sm font-semibold tracking-tight ${
                  active ? "text-brand-600" : "text-ink"
                }`}
              >
                {option.label}
              </span>
              <span
                aria-hidden="true"
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ease-premium ${
                  active
                    ? "border-brand-500 bg-brand-500"
                    : "border-border bg-surface"
                }`}
              >
                {active && <CheckIcon className="h-2.5 w-2.5 text-white" />}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex w-fit items-center gap-1 rounded-lg border border-border/70 bg-surface p-1"
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={active}
            aria-label={`${option.label} theme`}
            className={`group relative flex h-11 w-11 items-center justify-center rounded-md transition-all duration-200 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus:outline-none ${
              active
                ? "bg-brand-500 text-white"
                : "text-muted hover:bg-canvas hover:text-ink active:scale-90"
            }`}
          >
            <Icon />
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-tooltip px-3.5 py-2 text-caption font-medium text-tooltip-text opacity-0 shadow-card transition-all duration-150 ease-premium group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
