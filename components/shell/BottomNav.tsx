"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav";

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset ${
                  active ? "text-brand-700 dark:text-brand-300" : "text-muted hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
