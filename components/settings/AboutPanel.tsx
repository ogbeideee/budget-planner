"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { WalletIcon } from "@/components/ui/icons";
import { getDesktopBridge, isDesktop } from "@/lib/desktop";
import type { AppInfo, DesktopPaths } from "@/lib/desktop";
import { getDesktopPaths } from "@/lib/desktopFeatures";
import { APP_NAME, APP_VERSION } from "@/lib/version";

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 py-3 last:border-b-0">
      <span className="text-sm font-medium text-muted">{label}</span>
      <span
        className={`max-w-[60%] truncate text-sm font-semibold text-ink ${
          mono ? "font-mono text-xs" : ""
        }`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

export function AboutPanel() {
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

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
          <WalletIcon className="h-10 w-10" />
        </span>
        <div>
          <h3 className="text-xl font-bold tracking-tight text-ink">
            {APP_NAME}
          </h3>
          <p className="mt-1 text-sm text-muted">
            Version {APP_VERSION}
            {appInfo ? ` · ${appInfo.platform}` : ""}
            {appInfo?.isPackaged ? "" : " · development build"}
          </p>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-muted">
          Your data stays on your device. Nothing is uploaded, synced, or
          shared — budgets, transactions, and backups live only where you
          put them.
        </p>
      </Card>

      <Card title="Details">
        <InfoRow label="Version" value={`${APP_VERSION}${appInfo ? ` (${appInfo.platform})` : ""}`} />
        {appInfo ? (
          <>
            <InfoRow label="Electron" value={appInfo.versions.electron} />
            <InfoRow label="Chromium" value={appInfo.versions.chrome} />
            <InfoRow label="Node.js" value={appInfo.versions.node} />
          </>
        ) : (
          <InfoRow label="Runtime" value="Web browser" />
        )}
        <InfoRow label="Developer" value="Budget Planner" />
        <InfoRow label="License" value="Proprietary" />
        <InfoRow label="Updates" value="Delivered through the app menu" />
      </Card>

      <Card title="Storage">
        {paths ? (
          <>
            <InfoRow
              label="Data folder"
              value={paths.userData}
              mono
            />
            <InfoRow
              label="Database"
              value={paths.dbFile}
              mono
            />
            <InfoRow
              label="Backups folder"
              value={paths.backupsDir}
              mono
            />
          </>
        ) : (
          <InfoRow label="Storage" value="This browser (localStorage)" />
        )}
      </Card>
    </div>
  );
}
