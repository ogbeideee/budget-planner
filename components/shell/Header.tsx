"use client";

import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border bg-surface px-4 lg:hidden">
      <span className="text-lg" aria-hidden="true">
        💰
      </span>
      <span className="min-w-0 flex-1 truncate text-base font-bold">
        Budget Planner
      </span>
      <ThemeToggle />
    </header>
  );
}
