// Typed access to the Electron preload bridge (window.budgetPlannerDesktop).
// Absent in a plain browser — the app must keep working there via localStorage.
export interface DesktopStorageBridge {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  removeItem(key: string): boolean;
  keys(prefix?: string): string[];
}

export interface DesktopRuntimeVersions {
  electron: string;
  chrome: string;
  node: string;
}

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  isPackaged: boolean;
  versions: DesktopRuntimeVersions;
}

export interface DesktopPaths {
  userData: string;
  backupsDir: string;
  dbFile: string;
}

export interface DesktopBackupFile {
  name: string;
  path: string;
  createdAt: string;
  sizeBytes: number;
}

export type DesktopMenuAction =
  | "import"
  | "export"
  | "backup-now"
  | "restore-latest";

export interface DesktopDialogOptions {
  title?: string;
  defaultPath?: string;
  defaultName?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: string[];
}

export interface DesktopWindowBridge {
  setTitleBarOverlay(payload: {
    color: string;
    symbolColor: string;
  }): void;
  /** Restore + focus the main window, optionally on a specific in-app route. */
  show(deepLink?: string): Promise<{ ok: boolean }>;
}

/** Result of reporting or reading the background-mode setting (FR-26).
 *  `trayAvailable` is false when the tray could not be registered — the app
 *  then keeps quitting on close no matter what the setting says, and the UI
 *  must say so rather than claiming a background mode that will not happen. */
export interface BackgroundModeStatus {
  enabled: boolean;
  trayAvailable: boolean;
}

export interface DesktopBackgroundModeBridge {
  set(enabled: boolean): Promise<BackgroundModeStatus>;
  get(): Promise<BackgroundModeStatus>;
}

export interface DesktopQuickAddBridge {
  open(): Promise<{ ok: boolean }>;
  close(): Promise<{ ok: boolean }>;
  /** Announce that a quick-add save persisted, so other windows rehydrate.
   *  Deliberately carries no payload: the transaction already went through the
   *  ordinary store action and storage seam. */
  saved(): Promise<{ ok: boolean }>;
}

export interface DesktopAppEventsBridge {
  /** Fires when another window wrote state; the handler should rehydrate. */
  onStateChanged(callback: () => void): () => void;
  /** Fires when the main process asks the app to route somewhere (tray Open
   *  with a deep link, or a notification click). */
  onNavigate(callback: (route: string) => void): () => void;
}

export interface DesktopBridge {
  platform: string;
  getAppInfo(): Promise<AppInfo>;
  storage: DesktopStorageBridge;
  dialog: {
    open(options?: DesktopDialogOptions): Promise<{ canceled: true } | { canceled: false; filePath: string }>;
    save(options?: DesktopDialogOptions): Promise<{ canceled: true } | { canceled: false; filePath: string }>;
  };
  fs: {
    writeText(payload: {
      target: string;
      content: string;
    }): Promise<{ ok: boolean; error?: string }>;
    readText(payload: { target: string }): Promise<
      { ok: boolean; error?: string } & Partial<{ content: string }>
    >;
  };
  shell: {
    openPath(target: string): Promise<{ ok: boolean; error?: string }>;
    showItemInFolder(target: string): Promise<{ ok: boolean; error?: string }>;
  };
  notify(payload: {
    title: string;
    body?: string;
    silent?: boolean;
    /** In-app route to open when the notification is clicked (FR-26 req 11). */
    deepLink?: string;
  }): Promise<{ ok: boolean; error?: string }>;
  paths(): Promise<DesktopPaths>;
  backups: {
    create(content: string): DesktopBackupFile | null | { error: string };
    list(): Promise<DesktopBackupFile[]>;
    read(payload: { name: string }): Promise<{ ok: boolean; error?: string; content?: string }>;
    delete(payload: { name: string }): Promise<{ ok: boolean }>;
    restoreLatest(): Promise<
      | { status: "canceled" }
      | { status: "ok"; content: string }
      | { status: "error"; error: string }
    >;
  };
  /**
   * OS-backed credential vault (FR-24). Note what is ABSENT: there is no way
   * to read a stored secret back. Decryption happens only in the main
   * process, at connection time, so renderer code cannot obtain the password.
   */
  credentials: {
    /** False when the OS keychain is unavailable — the UI must not collect a
     *  password in that case, because it could not be stored safely. */
    isAvailable(): Promise<boolean>;
    set(
      account: string,
      secret: string,
    ): Promise<
      | { ok: true }
      | {
          ok: false;
          reason:
            | "invalid-account"
            | "empty-secret"
            | "encryption-unavailable"
            | "encrypt-failed"
            | "write-failed";
        }
    >;
    status(account: string): Promise<{ connected: boolean; savedAt: string | null }>;
    clear(account: string): Promise<{ ok: boolean; removed: boolean }>;
  };
  menu: {
    on(callback: (action: DesktopMenuAction) => void): () => void;
  };
  window: DesktopWindowBridge;
  backgroundMode: DesktopBackgroundModeBridge;
  quickAdd: DesktopQuickAddBridge;
  appEvents: DesktopAppEventsBridge;
}

declare global {
  interface Window {
    budgetPlannerDesktop?: DesktopBridge;
  }
}

export function getDesktopBridge(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = window.budgetPlannerDesktop;
  return bridge && typeof bridge === "object" ? bridge : null;
}

export function isDesktop(): boolean {
  return getDesktopBridge() !== null;
}
