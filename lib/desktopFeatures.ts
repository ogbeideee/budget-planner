// Renderer-side wrappers around the desktop bridge (Phase 3). Everything
// crosses IPC into the main process; these helpers keep call sites uniform and
// degrade to no-ops/false in a plain browser or during SSR/tests.
import {
  getDesktopBridge,
  isDesktop,
} from "./desktop";
import type { DesktopBackupFile, DesktopPaths } from "./desktop";

export type CreateBackupResult =
  | { ok: true; file: DesktopBackupFile }
  | { ok: false; error: string };

export interface ExportResult {
  ok: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

export type ImportResult =
  | { status: "canceled" }
  | { status: "ok"; content: string; fileName?: string }
  | { status: "error"; error: string };

export function desktopExportToFile(
  content: string,
  defaultName: string,
): Promise<ExportResult> {
  const bridge = getDesktopBridge();
  if (!bridge) return Promise.resolve({ ok: false, error: "desktop-only" });
  return bridge.dialog
    .save({ title: "Export data", defaultName })
    .then(async (saved) => {
      if (saved.canceled) return { ok: false, canceled: true };
      const written = await bridge.fs.writeText({
        target: saved.filePath,
        content,
      });
      return written.ok
        ? { ok: true, filePath: saved.filePath }
        : { ok: false, error: written.error ?? "could not write the file" };
    });
}

export function desktopImportFromFile(): Promise<ImportResult> {
  const bridge = getDesktopBridge();
  if (!bridge) return Promise.resolve({ status: "error", error: "desktop-only" });
  return bridge.dialog
    .open({ title: "Import data", properties: ["openFile"] })
    .then(async (opened) => {
      if (opened.canceled) return { status: "canceled" } as const;
      const read = await bridge.fs.readText({ target: opened.filePath });
      if (!read.ok)
        return { status: "error", error: read.error ?? "could not read the file" };
      return { status: "ok", content: read.content ?? "" };
    });
}

export function desktopCreateBackup(content: string): CreateBackupResult {
  const bridge = getDesktopBridge();
  if (!bridge) return { ok: false, error: "desktop-only" };
  const result = bridge.backups.create(content);
  if (result === null) return { ok: false, error: "unchanged" };
  if ("error" in result) return { ok: false, error: result.error };
  return { ok: true, file: result };
}

export async function desktopListBackups(): Promise<DesktopBackupFile[]> {
  const bridge = getDesktopBridge();
  if (!bridge) return [];
  try {
    return await bridge.backups.list();
  } catch {
    return [];
  }
}

export async function desktopReadBackup(name: string): Promise<string | null> {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  const result = await bridge.backups.read({ name });
  return result.ok && typeof result.content === "string" ? result.content : null;
}

export async function desktopDeleteBackup(name: string): Promise<boolean> {
  const bridge = getDesktopBridge();
  if (!bridge) return false;
  const result = await bridge.backups.delete({ name });
  return result.ok;
}

export async function desktopOpenBackupFolder(): Promise<boolean> {
  const bridge = getDesktopBridge();
  if (!bridge) return false;
  const paths = await getDesktopPaths();
  if (!paths) return false;
  const result = await bridge.shell.openPath(paths.backupsDir);
  return result.ok;
}

export async function desktopRevealDataFolder(): Promise<boolean> {
  const bridge = getDesktopBridge();
  if (!bridge) return false;
  const paths = await getDesktopPaths();
  if (!paths) return false;
  const result = await bridge.shell.showItemInFolder(paths.dbFile);
  return result.ok;
}

export async function getDesktopPaths(): Promise<DesktopPaths | null> {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  try {
    return await bridge.paths();
  } catch {
    return null;
  }
}

export function sendDesktopNotification(
  title: string,
  body?: string,
  silent?: boolean,
): void {
  const bridge = getDesktopBridge();
  if (!bridge) return;
  void bridge.notify({ title, body, silent }).catch(() => {});
}

// ---- Automatic file backups ----
//
// Policy: one backup at boot (after hydration), one every 30 minutes while
// running, and a final flush on beforeunload. The main process dedupes
// identical payloads, so unchanged sessions are silent; it also prunes to the
// newest 30 files. The interval is a floor, not a guarantee — a session that
// ends early still gets boot + unload backups.

const BACKUP_INTERVAL_MS = 30 * 60 * 1000;
const BOOT_DELAY_MS = 4000;

export interface AutoBackupHooks {
  getStateJson(): string | null;
  onResult(result: { written: true; name: string } | { error: string }): void;
}

export function startAutoBackups(hooks: AutoBackupHooks): () => void {
  if (!isDesktop()) return () => {};
  let lastWriteAt = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const attempt = (force: boolean) => {
    if (!force && Date.now() - lastWriteAt < BACKUP_INTERVAL_MS) return;
    const content = hooks.getStateJson();
    if (content === null) return;
    const bridge = getDesktopBridge();
    if (!bridge) return;
    const result = bridge.backups.create(content);
    if (result === null) return; // deduped: identical to newest backup
    if ("error" in result) {
      hooks.onResult({ error: result.error });
      return;
    }
    lastWriteAt = Date.now();
    hooks.onResult({ written: true, name: result.name });
  };

  const onUnload = () => attempt(true);

  const bootTimer = setTimeout(() => attempt(false), BOOT_DELAY_MS);
  timer = setInterval(() => attempt(false), BACKUP_INTERVAL_MS);
  window.addEventListener("beforeunload", onUnload);

  return () => {
    clearTimeout(bootTimer);
    if (timer !== null) clearInterval(timer);
    window.removeEventListener("beforeunload", onUnload);
  };
}
