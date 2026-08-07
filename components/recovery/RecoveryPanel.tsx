"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  AlertTriangleIcon,
  DownloadIcon,
  FileTextIcon,
} from "@/components/ui/icons";
import { useToast } from "@/hooks/useToast";
import { scanRecoverablePayloads } from "@/lib/storage";
import type { RecoverablePayload } from "@/lib/storage";
import { useAppStore } from "@/store/useAppStore";

function kindLabel(kind: RecoverablePayload["kind"]): string {
  switch (kind) {
    case "main-state":
      return "Main saved data";
    case "backup":
      return "Snapshot";
    case "categorization":
      return "Learned categories";
    case "ui":
      return "Interface state";
    default:
      return "Unknown data";
  }
}

function versionLabel(payload: RecoverablePayload): string {
  if (payload.kind === "backup" && payload.version === undefined) {
    return "";
  }
  return payload.version === undefined ? "" : `v${payload.version} `;
}

function countSummary(payload: RecoverablePayload): string {
  const counts = payload.counts;
  const parts: string[] = [];
  if (counts.transactions > 0) parts.push(`${counts.transactions} transactions`);
  if (counts.budgets > 0) parts.push(`${counts.budgets} budgets`);
  if (counts.categories > 0) parts.push(`${counts.categories} categories`);
  if (counts.incomePlans > 0) parts.push(`${counts.incomePlans} income plans`);
  if (counts.futureExpenses > 0) parts.push(`${counts.futureExpenses} upcoming`);
  if (counts.recurrenceRules > 0) parts.push(`${counts.recurrenceRules} rules`);
  return parts.join(" · ");
}

export function RecoveryPanel() {
  const importState = useAppStore((s) => s.importState);
  const recoverFromBackup = useAppStore((s) => s.recoverFromBackup);
  const resetAll = useAppStore((s) => s.resetAll);
  const { success } = useToast();
  const [attempted, setAttempted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fatal, setFatal] = useState(false);

  const payloads = useMemo(() => {
    if (!attempted) return [];
    return scanRecoverablePayloads().filter((payload) =>
      ["main-state", "backup", "categorization", "unknown"].includes(
        payload.kind,
      ),
    );
  }, [attempted]);

  const handleScan = () => {
    setAttempted(true);
    setMessage(null);
  };

  const handleRestoreMain = (payload: RecoverablePayload) => {
    try {
      const result = importState(JSON.parse(payload.raw));
      if (result.ok) {
        setMessage("Main data restored. This page will reload.");
        window.location.reload();
      } else {
        setFatal(true);
        setMessage(result.error ?? "That payload could not be read.");
      }
    } catch {
      setFatal(true);
      setMessage("That payload could not be read.");
    }
  };

  const handleRestoreBackup = (key: string) => {
    const result = recoverFromBackup(key);
    if (result.ok) {
      setMessage("Backup restored. This page will reload.");
      window.location.reload();
    } else {
      setFatal(true);
      setMessage(result.error ?? "That backup could not be read.");
    }
  };

  const handleDownload = (payload: RecoverablePayload) => {
    const blob = new Blob([payload.raw], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `recovered-${payload.kind}-${payload.key.split(":").pop()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    success("Payload downloaded.");
  };

  return (
    <Card className="w-full max-w-xl">
      <div className="flex items-start gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warn/[0.12] text-warn">
          <AlertTriangleIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 leading-relaxed">
          <p className="text-base font-bold tracking-tight text-ink">
            Your saved data could not be read
          </p>
          <p className="mt-1 text-sm text-muted">
            Nothing has been deleted. Your stored data is preserved exactly as
            it was found. You can scan this browser for recoverable data,
            import an export file, or start fresh.
          </p>
        </div>
      </div>

      {!attempted && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={handleScan}>Scan browser for data</Button>
          <Button
            variant="secondary"
            onClick={() => {
              window.location.href = "/settings?action=import";
            }}
          >
            Import an export file
          </Button>
        </div>
      )}

      {attempted && (
        <div className="mt-5">
          {payloads.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-canvas/60 px-4 py-3 text-sm text-muted">
              No recoverable data was found in this browser.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {payloads.map((payload) => {
                const restoreable =
                  (payload.kind === "main-state" || payload.kind === "backup") &&
                  (payload.canRestore ||
                    (payload.kind === "main-state" &&
                      payload.counts.categories > 0));
                return (
                  <li
                    key={payload.key}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-surface px-3 py-2.5"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/[0.08] text-brand-600 dark:text-brand-400">
                      <FileTextIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="truncate text-sm font-semibold text-ink">
                        {kindLabel(payload.kind)}{" "}
                        <span className="font-medium text-muted">
                          {versionLabel(payload)}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {countSummary(payload) || "Empty dataset"} ·{" "}
                        {(payload.sizeBytes / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {restoreable && (
                        <Button
                          size="sm"
                          onClick={() =>
                            payload.kind === "backup"
                              ? handleRestoreBackup(payload.key)
                              : handleRestoreMain(payload)
                          }
                        >
                          Restore
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<DownloadIcon className="h-4 w-4" />}
                        aria-label="Download this payload"
                        onClick={() => handleDownload(payload)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAttempted(false)}
            >
              Scan again
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                window.location.href = "/settings?action=import";
              }}
            >
              Import an export file
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (
                  window.confirm(
                    "Start fresh? This erases the stored payload from this browser.",
                  )
                ) {
                  resetAll();
                  window.location.reload();
                }
              }}
            >
              Start fresh
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p
          role="alert"
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            fatal
              ? "bg-danger/10 text-expense"
              : "bg-brand-500/[0.08] text-brand-700 dark:text-brand-300"
          }`}
        >
          {message}
        </p>
      )}
    </Card>
  );
}

