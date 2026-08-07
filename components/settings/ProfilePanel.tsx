"use client";

import { useEffect, useMemo, useState } from "react";
import { WalletIcon } from "@/components/ui/icons";
import { useAppStore } from "@/store/useAppStore";
import { isDesktop, getDesktopBridge } from "@/lib/desktop";
import type { AppInfo, DesktopPaths } from "@/lib/desktop";
import { getDesktopPaths } from "@/lib/desktopFeatures";
import { APP_NAME, APP_VERSION } from "@/lib/version";
import { currentMonthKey } from "@/lib/date";
import { formatMonthLabel } from "@/lib/date";
import { getStorageBackend } from "@/lib/storageAdapter";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function ProfileStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-canvas/50 px-4 py-3.5">
      <p className="text-micro font-bold uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <p className="mt-1.5 truncate text-sm font-semibold text-ink" title={value}>
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 truncate text-xs text-muted" title={sub}>
          {sub}
        </p>
      )}
    </div>
  );
}

export function ProfilePanel() {
  const state = useAppStore((s) => s.state);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [paths, setPaths] = useState<DesktopPaths | null>(null);

  useEffect(() => {
    void getDesktopPaths().then((next) => {
      if (next) setPaths(next);
    });
    if (!isDesktop()) return;
    void getDesktopBridge()
      ?.getAppInfo()
      .then((info) => setAppInfo(info));
  }, []);

  const storedBytes = useMemo(() => {
    try {
      const raw = getStorageBackend().getItem("budget-planner:state");
      return raw ? new TextEncoder().encode(raw).length : 0;
    } catch {
      return 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.version]);

  const stats = {
    categories: state.categories.length,
    transactions: state.transactions.length,
    budgets: state.budgets.length,
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-surface shadow-card">
      <div className="flex flex-wrap items-center gap-5 px-6 pb-5 pt-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
          <WalletIcon className="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-ink">
              {APP_NAME}
            </h2>
            <span className="rounded-full bg-brand-500/[0.08] px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
              v{APP_VERSION}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Your private, offline budgeting workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="relative flex h-2.5 w-2.5"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-semibold text-ink">
            {isDesktop() ? "Desktop app" : "This browser"}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-4">
        <ProfileStat
          label="Storage"
          value={isDesktop() ? "On this device" : "Local browser"}
          sub={
            paths?.dbFile ?? `${formatBytes(storedBytes)} in use · private`
          }
        />
        <ProfileStat
          label="Current month"
          value={formatMonthLabel(currentMonthKey())}
          sub="Planner and reports follow this"
        />
        <ProfileStat
          label="Transactions"
          value={String(stats.transactions)}
          sub={`${stats.categories} categories · ${stats.budgets} budgets`}
        />
        <ProfileStat
          label="Runtime"
          value={
            appInfo
              ? `Electron ${appInfo.versions.electron}`
              : "Web browser"
          }
          sub={appInfo ? `Chromium ${appInfo.versions.chrome}` : "No desktop shell"}
        />
      </div>
    </div>
  );
}
