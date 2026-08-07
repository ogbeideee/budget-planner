"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { WalletIcon } from "@/components/ui/icons";
import { APP_NAME, APP_VERSION } from "@/lib/version";
import { NAV_ITEMS } from "./nav";
import type { NavItem } from "./nav";

const SECTIONS: ReadonlyArray<{ label: string; hrefs: ReadonlySet<string> }> = [
  { label: "Planning", hrefs: new Set(["/", "/todo", "/upcoming"]) },
  { label: "Analytics", hrefs: new Set(["/history", "/reports"]) },
  { label: "Settings", hrefs: new Set(["/settings"]) },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li className="relative">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`group flex min-h-11 items-center gap-3 rounded-md px-3 text-base font-semibold transition-colors duration-150 ease-premium focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus:outline-none ${
          active
            ? "bg-sidebar-active text-brand-600"
            : "text-muted hover:bg-sidebar-hover hover:text-ink"
        }`}
      >
        <Icon
          className={`h-5 w-5 shrink-0 transition-colors duration-150 ${
            active ? "text-brand-500" : "text-muted group-hover:text-ink"
          }`}
        />
        <span className="truncate">{item.label}</span>
      </Link>
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand-500 transition-opacity duration-150 ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
    </li>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar-surface no-print fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border/70 lg:flex">
      <div className="flex h-16 items-center gap-3 px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-500 text-white shadow-card">
          <WalletIcon className="h-5 w-5" />
        </span>
        <span className="truncate text-base font-bold tracking-tight">
          {APP_NAME}
        </span>
      </div>
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-4">
          {SECTIONS.map((section) => (
            <li key={section.label} className="flex flex-col gap-1">
              <p className="px-3.5 pb-1 pt-4 text-micro font-bold uppercase tracking-[0.08em] text-muted first:pt-0">
                {section.label}
              </p>
              <ul className="flex flex-col gap-1">
                {NAV_ITEMS.filter((item) => section.hrefs.has(item.href)).map(
                  (item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      active={pathname === item.href}
                    />
                  ),
                )}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-border/60 px-4 py-4">
        <ThemeToggle />
        <p className="mt-3 px-1 text-xs text-muted">v{APP_VERSION}</p>
      </div>
    </aside>
  );
}
