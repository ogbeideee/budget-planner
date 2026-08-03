"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { WalletIcon } from "@/components/ui/icons";
import { NAV_ITEMS } from "./nav";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
          <WalletIcon className="h-5 w-5" />
        </span>
        <span className="truncate text-sm font-bold tracking-tight">
          Budget Planner
        </span>
      </div>
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                    active
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                      : "text-muted hover:bg-canvas hover:text-ink"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-border px-4 py-3">
        <ThemeToggle />
        <p className="mt-2.5 px-1 text-xs text-muted">v0.1.0</p>
      </div>
    </aside>
  );
}
