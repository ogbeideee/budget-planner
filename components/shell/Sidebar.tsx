"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NAV_ITEMS } from "./nav";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <span className="text-lg" aria-hidden="true">
          💰
        </span>
        <span className="text-base font-bold">Budget Planner</span>
      </div>
      <nav aria-label="Main navigation" className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-md px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                    active
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                      : "text-muted hover:bg-canvas hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-border px-4 py-3">
        <ThemeToggle />
        <p className="mt-2 px-1 text-xs text-muted">v0.1.0</p>
      </div>
    </aside>
  );
}
