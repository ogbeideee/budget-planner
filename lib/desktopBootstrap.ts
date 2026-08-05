// Bootstraps desktop-only integrations that need app state: automatic file
// backups and the native menu's renderer-facing actions (import/export/backup/
// restore). Imported once from the client shell; everything no-ops in a plain
// browser or during SSR/tests.
import { isDesktop } from "./desktop";
import {
  desktopCreateBackup,
  desktopExportToFile,
  desktopImportFromFile,
  sendDesktopNotification,
  startAutoBackups,
} from "./desktopFeatures";
import { CURRENT_STORAGE_VERSION, isWritesEnabled, serializeExport } from "./storage";
import { useAppStore, useAppStoreErrors } from "@/store/useAppStore";
import { useToastStore } from "@/store/useToastStore";

function currentStateJson(): string | null {
  if (useAppStoreErrors.getState().hydrateError !== null) return null;
  if (!isWritesEnabled()) return null;
  const { state } = useAppStore.getState();
  return JSON.stringify({ state, version: CURRENT_STORAGE_VERSION });
}

let initialized = false;

export function initDesktopBootstrap(): void {
  if (initialized) return;
  initialized = true;
  if (!isDesktop()) return;

  startAutoBackups({
    getStateJson: currentStateJson,
    onResult: (result) => {
      if ("error" in result) {
        console.error(`[desktop] automatic backup failed: ${result.error}`);
        useToastStore.getState().push("Automatic backup failed.", "error");
        sendDesktopNotification(
          "Budget Planner",
          "The automatic backup could not be written. Your data is safe in the app.",
        );
      }
    },
  });

  const menuBridge = window.budgetPlannerDesktop?.menu;
  if (!menuBridge) return;
  menuBridge.on((action) => {
    switch (action) {
      case "export": {
        const json = serializeExport(useAppStore.getState().state);
        const name = `budget-planner-export-${new Date().toISOString().slice(0, 10)}.json`;
        void desktopExportToFile(json, name).then((result) => {
          if (result.canceled) return;
          if (result.ok) {
            useToastStore.getState().push("Export saved to file.");
          } else {
            useToastStore.getState().push(
              result.error ?? "Export failed.",
              "error",
            );
          }
        });
        break;
      }
      case "import": {
        void desktopImportFromFile().then((result) => {
          if (result.status === "canceled") return;
          if (result.status !== "ok") {
            useToastStore.getState().push(
              result.error ?? "Import failed.",
              "error",
            );
            return;
          }
          const outcome = useAppStore.getState().importState(result.content);
          if (outcome.ok) {
            useToastStore.getState().push("Data imported.");
          } else {
            useToastStore.getState().push(
              outcome.error ?? "That file isn't a valid budget-planner export.",
              "error",
            );
          }
        });
        break;
      }
      case "backup-now": {
        const content = currentStateJson();
        if (content === null) {
          useToastStore.getState().push("Nothing to back up yet.", "error");
          return;
        }
        const result = desktopCreateBackup(content);
        if (result.ok) {
          useToastStore.getState().push("Backup saved to file.");
        } else {
          useToastStore.getState().push(
            result.error === "unchanged"
              ? "Backup already up to date."
              : `Backup failed: ${result.error}`,
            "error",
          );
        }
        break;
      }
      case "restore-latest": {
        void window.budgetPlannerDesktop?.backups
          .restoreLatest()
          .then((result) => {
            if (result.status === "canceled") return;
            if (result.status !== "ok") {
              useToastStore.getState().push(result.error, "error");
              return;
            }
            const outcome = useAppStore.getState().importState(result.content);
            if (outcome.ok) {
              useToastStore.getState().push("Backup restored.");
              sendDesktopNotification("Budget Planner", "Backup restored.");
            } else {
              useToastStore.getState().push(
                outcome.error ?? "That backup could not be read.",
                "error",
              );
            }
          });
        break;
      }
    }
  });
}
