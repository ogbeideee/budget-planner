"use client";

import { Suspense } from "react";
import type { ReactNode } from "react";
import { CorruptedStateError } from "@/lib/storage";
import { useAppStoreErrors } from "@/store/useAppStore";
import { ToastHost } from "@/components/ui/ToastHost";
import { useRecurring } from "@/hooks/useRecurring";
import { useTheme } from "@/hooks/useTheme";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const hydrateError = useAppStoreErrors((s) => s.hydrateError);
  useRecurring();
  useTheme();
  if (hydrateError) {
    throw new CorruptedStateError("Saved data is corrupted");
  }
  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="lg:pl-56">
        <Suspense fallback={null}>
          <Header />
        </Suspense>
        <main
          id="main"
          className="mx-auto w-full max-w-[1152px] px-6 pb-28 pt-6 lg:pb-12"
        >
          {children}
        </main>
      </div>
      <BottomNav />
      <ToastHost />
    </div>
  );
}
