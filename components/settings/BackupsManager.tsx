"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  DownloadIcon,
  FileTextIcon,
  FolderIcon,
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
import {
  desktopDeleteBackup,
  desktopExportToFile,
  desktopListBackups,
  desktopOpenBackupFolder,
  desktopReadBackup,
  desktopRevealDataFolder,
  getDesktopPaths,
} from "@/lib/desktopFeatures";
import type { DesktopBackupFile, DesktopPaths } from "@/lib/desktop";
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
      return "bg-brand-500/[0.08] text-brand-600 dark:text-brand-400";
    case "auto-corrupt":
      return "bg-warn/[0.08] text-warn";
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
  const importState = useAppStore((s) => s.importState);
  const { success, error: toastError } = useToast();
  const [backups, setBackups] = useState<BackupMetadata[]>(() =>
    listBackupSnapshots(),
  );
  const [fileBackups, setFileBackups] = useState<DesktopBackupFile[]>([]);
  const [paths, setPaths] = useState<DesktopPaths | null>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupMetadata | null>(null);
  const [pendingFileRestore, setPendingFileRestore] =
    useState<DesktopBackupFile | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BackupMetadata | null>(null);
  const [pendingFileDelete, setPendingFileDelete] =
    useState<DesktopBackupFile | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setBackups(listBackupSnapshots());
  }, []);

  const refreshFiles = useCallback(() => {
    void desktopListBackups().then(setFileBackups);
  }, []);

  useEffect(() => {
    void getDesktopPaths().then((next) => {
      if (next) setPaths(next);
    });
    void desktopListBackups().then(setFileBackups);
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

  const handleFileRestore = () => {
    if (pendingFileRestore === null) return;
    void desktopReadBackup(pendingFileRestore.name)
      .then((content) => {
        setPendingFileRestore(null);
        if (content === null) {
          setRestoreError("That backup file could not be read.");
          return;
        }
        const result = importState(content);
        setRestoreError(null);
        if (result.ok) {
          success("Backup restored.");
          onRecovered?.();
        } else {
          setRestoreError(result.error ?? "That backup could not be read.");
        }
      })
      .catch(() => {
        setPendingFileRestore(null);
        setRestoreError("That backup file could not be read.");
      });
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

  const handleFileDownload = (file: DesktopBackupFile) => {
    void desktopReadBackup(file.name).then((content) => {
      if (content === null) return;
      void desktopExportToFile(content, file.name).then((result) => {
        if (result.ok) success("Backup saved to file.");
      });
    });
  };

  const handleOpenFolder = () => {
    void desktopOpenBackupFolder().then((ok) => {
      if (!ok) toastError("Could not open the backup folder.");
    });
  };

  const handleRevealDataFolder = () => {
    void desktopRevealDataFolder().then((ok) => {
      if (!ok) toastError("Could not open the data folder.");
    });
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
              className="flex flex-wrap items-center gap-3 rounded-lg px-2.5 py-2"
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

      {fileBackups.length > 0 && (
        <div className="mt-1 border-t border-border/60 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-ink">
                Backup files
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Saved to the desktop app folder automatically.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon={<FolderIcon className="h-4 w-4" />}
              onClick={handleOpenFolder}
            >
              Open folder
            </Button>
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {fileBackups.map((file) => (
              <li
                key={file.name}
                className="flex flex-wrap items-center gap-3 rounded-lg px-2.5 py-2"
              >
                <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-muted border border-border/60">
                  File
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="text-sm font-medium text-ink">
                    {formatBackupTime(file.createdAt)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {file.name} · {(file.sizeBytes / 1024).toFixed(1)} KB
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRestoreError(null);
                      setPendingFileRestore(file);
                    }}
                  >
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<DownloadIcon className="h-4 w-4" />}
                    aria-label={`Download backup file from ${formatBackupTime(file.createdAt)}`}
                    onClick={() => handleFileDownload(file)}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<TrashIcon className="h-4 w-4" />}
                    aria-label={`Delete backup file from ${formatBackupTime(file.createdAt)}`}
                    onClick={() => setPendingFileDelete(file)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {paths && (
        <p className="mt-1 text-xs text-muted">
          Backup folder:{" "}
          <code className="rounded bg-surface px-1.5 py-0.5">{paths.backupsDir}</code>
        </p>
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
        open={pendingFileRestore !== null}
        title="Restore backup file"
        message="Restoring replaces everything currently in the app with the data inside this backup file. The file itself is kept."
        confirmLabel="Restore backup"
        danger
        onConfirm={handleFileRestore}
        onClose={() => setPendingFileRestore(null)}
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

      <ConfirmDialog
        open={pendingFileDelete !== null}
        title="Delete backup file"
        message="This backup file will be removed from your disk permanently. Your current data is not affected."
        confirmLabel="Delete file"
        danger
        onConfirm={() => {
          if (pendingFileDelete) {
            void desktopDeleteBackup(pendingFileDelete.name).then((ok) => {
              if (ok) {
                refreshFiles();
                success("Backup file deleted.");
              } else {
                toastError("Could not delete the backup file.");
              }
            });
          }
          setPendingFileDelete(null);
        }}
        onClose={() => setPendingFileDelete(null)}
      />

      {paths && (
        <div className="mt-1 flex flex-wrap gap-2 border-t border-border/60 pt-3">
          <Button
            size="sm"
            variant="secondary"
            icon={<FolderIcon className="h-4 w-4" />}
            onClick={handleOpenFolder}
          >
            Open backup folder
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<FolderIcon className="h-4 w-4" />}
            onClick={handleRevealDataFolder}
          >
            Reveal data folder
          </Button>
        </div>
      )}
    </div>
  );
}
