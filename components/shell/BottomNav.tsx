"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav";

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Bottom navigation"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-surface/95 backdrop-blur-md lg:hidden"
    >
      <ul className="grid grid-cols-6">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <li key={item.href} className="relative">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset ${
                  active ? "text-brand-600" : "text-muted hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
              <span
                aria-hidden="true"
                className={`absolute left-1/2 top-0 h-0.5 w-6 -translate-x-1/2 rounded-full bg-brand-500 transition-opacity duration-150 ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
