"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  DatabaseIcon,
  DownloadIcon,
  FolderIcon,
  RefreshIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/ui/icons";
import { useToast } from "@/hooks/useToast";
import { useAppStore } from "@/store/useAppStore";
import { isDesktop } from "@/lib/desktop";
import type { DesktopBackupFile, DesktopPaths } from "@/lib/desktop";
import {
  desktopExportToFile,
  desktopImportFromFile,
  desktopListBackups,
  desktopOpenBackupFolder,
  getDesktopPaths,
} from "@/lib/desktopFeatures";
import { getDesktopBridge } from "@/lib/desktop";
import { listBackupSnapshots, serializeExport, snapshotCurrentState } from "@/lib/storage";
import type { BackupMetadata } from "@/lib/storage";
import { BackupsManager } from "./BackupsManager";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatBackupTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function DataBackupsPanel({ autoImport = false }: { autoImport?: boolean }) {
  const importState = useAppStore((s) => s.importState);
  const resetAll = useAppStore((s) => s.resetAll);
  const { success, error: toastError } = useToast();

  const [paths, setPaths] = useState<DesktopPaths | null>(null);
  const [snapshots, setSnapshots] = useState<BackupMetadata[]>(() =>
    listBackupSnapshots(),
  );
  const [fileBackups, setFileBackups] = useState<DesktopBackupFile[]>([]);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetText, setResetText] = useState("");
  const [restoringLatest, setRestoringLatest] = useState(false);

  useEffect(() => {
    void getDesktopPaths().then((next) => {
      if (next) setPaths(next);
    });
    void desktopListBackups().then(setFileBackups);
  }, []);

  const latest = useMemo(() => {
    const newestSnapshot = snapshots[0] ?? null;
    const newestFile = fileBackups[0] ?? null;
    if (!newestSnapshot && !newestFile) return null;
    if (!newestSnapshot) return newestFile;
    if (!newestFile) return newestSnapshot;
    return newestSnapshot.createdAt >= newestFile.createdAt
      ? newestSnapshot
      : newestFile;
  }, [snapshots, fileBackups]);

  const handleCreateBackup = () => {
    if (isDesktop()) {
      void desktopCreateBackup();
      return;
    }
    const key = snapshotCurrentState();
    if (key === null) {
      toastError("Nothing to back up yet.");
      return;
    }
    setSnapshots(listBackupSnapshots());
    success("Backup created.");
  };

  const desktopCreateBackup = async () => {
    const content = serializeExport(useAppStore.getState().state);
    const bridge = getDesktopBridge();
    if (!bridge) return;
    const result = bridge.backups.create(content);
    if (result === null) {
      toastError("Nothing to back up yet.");
      return;
    }
    if ("error" in result) {
      toastError(result.error);
      return;
    }
    await desktopListBackups().then(setFileBackups);
    success("Backup created.");
  };

  const handleRestoreLatest = () => {
    setRestoringLatest(true);
    void getDesktopBridge()
      ?.backups.restoreLatest()
      .then((result) => {
        if (result.status === "canceled") return;
        if (result.status === "ok") {
          const applied = importState(result.content);
          if (applied.ok) {
            success("Latest backup restored.");
          } else {
            toastError(applied.error ?? "That backup couldn't be read.");
          }
        } else {
          toastError(result.error ?? "That backup couldn't be read.");
        }
      })
      .finally(() => setRestoringLatest(false));
  };

  const handleExport = () => {
    const json = serializeExport(useAppStore.getState().state);
    const name = `budget-planner-export-${new Date().toISOString().slice(0, 10)}.json`;
    if (isDesktop()) {
      void desktopExportToFile(json, name).then((result) => {
        if (result.canceled) return;
        if (result.ok) {
          success("Export saved to file.");
        } else {
          toastError(result.error ?? "Export failed.");
        }
      });
      return;
    }
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    success("Export downloaded.");
  };

  const openImportPicker = () => {
    if (isDesktop()) {
      return desktopImportFromFile().then((result) => {
        if (result.status === "canceled") return;
        if (result.status !== "ok") {
          setImportError(result.error ?? "That file couldn't be read.");
          return;
        }
        setPendingImport(result.content);
        setImportError(null);
      });
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setPendingImport(String(reader.result ?? ""));
        setImportError(null);
      };
      reader.readAsText(file);
    };
    input.click();
    return undefined;
  };

  const handleImport = () => {
    void openImportPicker();
  };

  useEffect(() => {
    if (!autoImport) return;
    void openImportPicker();
  }, [autoImport]);

  const confirmImport = () => {
    if (pendingImport === null) return;
    const result = importState(pendingImport);
    if (result.ok) {
      success("Data imported.");
      setImportError(null);
    } else {
      setImportError(
        result.error ?? "That file isn't a valid budget-planner export.",
      );
    }
    setPendingImport(null);
  };

  const handleReset = () => {
    resetAll();
    setConfirmReset(false);
    setResetText("");
    success("All data cleared.");
  };

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Storage"
        subtitle="Everything is stored locally on your device."
        className="overflow-hidden"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-canvas/50 px-4 py-3.5">
            <p className="text-micro font-bold uppercase tracking-[0.08em] text-muted">
              Storage location
            </p>
            <p className="mt-1.5 truncate text-sm font-semibold text-ink" title={paths?.userData}>
              {paths ? "App data folder" : "This browser"}
            </p>
            {paths && (
              <p className="mt-0.5 truncate text-xs font-mono text-muted" title={paths.dbFile}>
                {paths.dbFile}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border/60 bg-canvas/50 px-4 py-3.5">
            <p className="text-micro font-bold uppercase tracking-[0.08em] text-muted">
              Last backup
            </p>
            <p className="mt-1.5 truncate text-sm font-semibold text-ink">
              {latest ? formatBackupTime(latest.createdAt) : "No backups yet"}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {latest ? "Newest snapshot or file" : "Create one below"}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-canvas/50 px-4 py-3.5">
            <p className="text-micro font-bold uppercase tracking-[0.08em] text-muted">
              Backup size
            </p>
            <p className="mt-1.5 truncate text-sm font-semibold text-ink">
              {latest ? formatBytes(latest.sizeBytes) : "—"}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {snapshots.length + fileBackups.length} snapshots kept
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            icon={<DatabaseIcon className="h-4 w-4" />}
            onClick={handleCreateBackup}
          >
            Create backup
          </Button>
          {isDesktop() && (
            <Button
              variant="secondary"
              icon={<RefreshIcon className="h-4 w-4" />}
              disabled={restoringLatest}
              onClick={handleRestoreLatest}
            >
              Restore latest
            </Button>
          )}
          <Button
            variant="secondary"
            icon={<DownloadIcon className="h-4 w-4" />}
            onClick={handleExport}
          >
            Export
          </Button>
          <Button
            variant="secondary"
            icon={<UploadIcon className="h-4 w-4" />}
            onClick={handleImport}
          >
            Import
          </Button>
          {isDesktop() && (
            <Button
              variant="secondary"
              icon={<FolderIcon className="h-4 w-4" />}
              onClick={() => {
                void desktopOpenBackupFolder().then((ok) => {
                  if (!ok) toastError("Could not open the backup folder.");
                });
              }}
            >
              Open backup folder
            </Button>
          )}
        </div>
        {importError && (
          <p role="alert" className="mt-3 text-sm text-expense">
            {importError}
          </p>
        )}
      </Card>

      <Card
        title="Backups"
        subtitle="Automatic snapshots before every upgrade, plus files saved by the desktop app."
      >
        <BackupsManager />
      </Card>

      <Card
        title="Danger zone"
        variant="quiet"
        subtitle="Actions here cannot be undone."
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-ink">
              Reset all data
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Deletes every category, budget, transaction, and recurring
              rule from this device.
            </p>
          </div>
          <Button
            variant="danger"
            icon={<TrashIcon className="h-4 w-4" />}
            onClick={() => {
              setConfirmReset(true);
              setResetText("");
            }}
          >
            Reset all data
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={pendingImport !== null}
        title="Import data"
        message="Importing replaces all of your current data. This cannot be undone."
        confirmLabel="Import and replace"
        danger
        onConfirm={confirmImport}
        onClose={() => setPendingImport(null)}
      />

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all data"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={resetText !== "RESET"}
              onClick={handleReset}
            >
              Reset everything
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          This deletes every category, budget, transaction, and recurring
          rule. This cannot be undone. Type{" "}
          <strong className="font-semibold text-ink">RESET</strong> to
          confirm.
        </p>
        <input
          type="text"
          aria-label="Type RESET to confirm"
          value={resetText}
          placeholder="RESET"
          className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink transition-colors placeholder:text-muted/60 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          onChange={(event) => setResetText(event.target.value)}
        />
      </Modal>
    </div>
  );
}
