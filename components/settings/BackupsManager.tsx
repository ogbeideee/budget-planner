"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  DownloadIcon,
  FileTextIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { useToast } from "@/hooks/useToast";
import {
  deleteBackupSnapshot,
  listBackupSnapshots,
  loadBackupSnapshot,
  snapshotCurrentState,
} from "@/lib/storage";
import type { BackupMetadata } from "@/lib/storage";
import { useAppStore } from "@/store/useAppStore";

function formatBackupTime(iso: string): string {
  if (!iso) return "Unknown time";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "manual":
      return "Manual snapshot";
    case "auto-v1":
      return "Auto — pre-upgrade data";
    case "auto-corrupt":
      return "Auto — unreadable data";
    default:
      return "Backup";
  }
}

function kindTone(kind: string): string {
  switch (kind) {
    case "manual":
      return "bg-brand-500/10 text-brand-600 dark:text-brand-400";
    case "auto-corrupt":
      return "bg-warn/10 text-warn";
    default:
      return "bg-surface text-muted border border-border/60";
  }
}

function countSummary(counts: BackupMetadata["counts"]): string {
  const parts: string[] = [];
  if (counts.transactions > 0) parts.push(`${counts.transactions} transactions`);
  if (counts.budgets > 0) parts.push(`${counts.budgets} budgets`);
  if (counts.categories > 0) parts.push(`${counts.categories} categories`);
  if (counts.incomePlans > 0) parts.push(`${counts.incomePlans} income plans`);
  if (counts.futureExpenses > 0) parts.push(`${counts.futureExpenses} upcoming`);
  if (counts.recurrenceRules > 0) parts.push(`${counts.recurrenceRules} rules`);
  if (parts.length === 0) return "No dataset inside";
  return parts.join(" · ");
}

export function BackupsManager({ onRecovered }: { onRecovered?: () => void }) {
  const recoverFromBackup = useAppStore((s) => s.recoverFromBackup);
  const { success, error: toastError } = useToast();
  const [backups, setBackups] = useState<BackupMetadata[]>(() =>
    listBackupSnapshots(),
  );
  const [pendingRestore, setPendingRestore] = useState<BackupMetadata | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BackupMetadata | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setBackups(listBackupSnapshots());
  }, []);

  const handleBackupNow = () => {
    const key = snapshotCurrentState();
    if (key === null) {
      toastError("Nothing to back up yet.");
      return;
    }
    refresh();
    success("Snapshot saved.");
  };

  const handleRestore = () => {
    if (pendingRestore === null) return;
    const result = recoverFromBackup(pendingRestore.key);
    setPendingRestore(null);
    if (!result.ok) {
      setRestoreError(result.error ?? "Could not restore this backup.");
      return;
    }
    setRestoreError(null);
    success("Backup restored.");
    onRecovered?.();
  };

  const handleDownload = (key: string) => {
    const snapshot = loadBackupSnapshot(key);
    if (snapshot === null) return;
    const isValidJson = (() => {
      try {
        JSON.parse(snapshot.raw);
        return true;
      } catch {
        return false;
      }
    })();
    const blob = new Blob([snapshot.raw], {
      type: isValidJson ? "application/json" : "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `budget-planner-backup-${key.split(":").pop()}.${isValidJson ? "json" : "txt"}`;
    link.click();
    URL.revokeObjectURL(url);
    success("Backup downloaded.");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-ink">
            Snapshots
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Every upgrade is backed up automatically before anything changes.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={handleBackupNow}>
          Back up now
        </Button>
      </div>

      {restoreError && (
        <p role="alert" className="text-sm text-expense">
          {restoreError}
        </p>
      )}

      {backups.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon className="h-5 w-5" />}
          iconClass="bg-surface text-muted border border-border/60"
          title="No snapshots yet"
          description="Create a snapshot before major changes, or leave it to the automatic upgrades."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {backups.map((backup) => (
            <li
              key={backup.key}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-surface px-3 py-2.5"
            >
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${kindTone(backup.kind)}`}
              >
                {kindLabel(backup.kind)}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-sm font-medium text-ink">
                  {formatBackupTime(backup.createdAt)}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {countSummary(backup.counts)} ·{" "}
                  {backup.sourceVersion === "corrupt"
                    ? "unreadable payload"
                    : `v${String(backup.sourceVersion)}`} ·{" "}
                  {(backup.sizeBytes / 1024).toFixed(1)} KB
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {backup.canRestore && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRestoreError(null);
                      setPendingRestore(backup);
                    }}
                  >
                    Restore
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<DownloadIcon className="h-4 w-4" />}
                  aria-label={`Download backup from ${formatBackupTime(backup.createdAt)}`}
                  onClick={() => handleDownload(backup.key)}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<TrashIcon className="h-4 w-4" />}
                  aria-label={`Delete backup from ${formatBackupTime(backup.createdAt)}`}
                  onClick={() => setPendingDelete(backup)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingRestore !== null}
        title="Restore snapshot"
        message="Restoring replaces everything currently in the app with the data inside this snapshot. The snapshot itself is kept."
        confirmLabel="Restore snapshot"
        danger
        onConfirm={handleRestore}
        onClose={() => setPendingRestore(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete snapshot"
        message="This snapshot will be removed from this browser permanently. Your current data is not affected."
        confirmLabel="Delete snapshot"
        danger
        onConfirm={() => {
          if (pendingDelete) deleteBackupSnapshot(pendingDelete.key);
          setPendingDelete(null);
          refresh();
          success("Snapshot deleted.");
        }}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
