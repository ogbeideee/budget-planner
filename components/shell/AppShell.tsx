"use client";

import { Suspense, useEffect } from "react";
import type { ReactNode } from "react";
import { loadDisplayName } from "@/lib/displayName";
import { loadOnboardingStep } from "@/lib/onboarding";
import { CorruptedStateError } from "@/lib/storage";
import { useAppStore, useAppStoreErrors } from "@/store/useAppStore";
import { useDisplayName } from "@/store/useDisplayName";
import { useOnboarding } from "@/store/useOnboarding";
import { ToastHost } from "@/components/ui/ToastHost";
import { useRecurring } from "@/hooks/useRecurring";
import { useBadges } from "@/hooks/useBadges";
import { useRollover } from "@/hooks/useRollover";
import { useTheme } from "@/hooks/useTheme";
import { initDesktopBootstrap } from "@/lib/desktopBootstrap";
import { initOverlayScrollbars } from "@/lib/overlayScrollbars";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { NameSetupModal } from "./NameSetupModal";
import { Sidebar } from "./Sidebar";
import { TitleBar } from "./TitleBar";

// Desktop-only integrations (auto-backups, native menu actions). No-op in a
// plain browser and on the server; idempotent across hot reloads.
initDesktopBootstrap();

export function AppShell({ children }: { children: ReactNode }) {
  const hydrateError = useAppStoreErrors((s) => s.hydrateError);
  const firstRunDone = useAppStore((s) => s.state.settings.firstRunDone);
  const onboardingReady = useOnboarding((s) => s.ready);
  useRecurring();
  useRollover();
  useBadges();
  useTheme();
  useEffect(() => initOverlayScrollbars(), []);
  useEffect(() => {
    useDisplayName.setState({ name: loadDisplayName(), ready: true });
    // Resume where they left off. Seeded at mount for the same reason the
    // display name is: keeps the first client render identical to the server
    // HTML so onboarding never flashes for a returning user.
    useOnboarding.setState({ step: loadOnboardingStep(), ready: true });
  }, []);
  if (hydrateError) {
    throw new CorruptedStateError("Saved data is corrupted");
  }

  // First run takes over the whole window: no sidebar, no nav, no name modal.
  // The title bar stays so the window stays draggable and closable.
  if (onboardingReady && !firstRunDone) {
    return (
      <div className="min-h-screen">
        <TitleBar />
        <OnboardingFlow />
        <ToastHost />
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-14 focus:z-50 focus:rounded-md focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <TitleBar />
      <Sidebar />
      <div className="pt-11 lg:pl-60">
        <Suspense fallback={null}>
          <Header />
        </Suspense>
        <main
          id="main"
          className="mx-auto w-full max-w-[1600px] px-8 pb-24 pt-6 lg:pb-12"
        >
          {children}
        </main>
      </div>
      <BottomNav />
      <NameSetupModal />
      <ToastHost />
    </div>
  );
}
