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
  /** Fires when the main-process sync fetched new candidate messages. The
   *  payload carries AlertEmail-shaped messages PLUS the mailbox metadata main
   *  wants confirmed via `desktop:email:confirm-processed` once the renderer
   *  has applied or queued them. Never includes a password or a raw HTML
   *  body — the sync layer converts bodies to the parser's plain-text layout. */
  onEmailAlerts(callback: (payload: EmailAlertsDelivered) => void): () => void;
  /** Fires after every canonical sync (manual / scheduled / tray) with a SAFE
   *  summary — counts, timestamps, identity — never message content. */
  onEmailSyncResult(callback: (result: EmailSyncResultSummary) => void): () => void;
}

/** Safe sync summary for the renderer: no message bodies, no secrets. */
export interface EmailSyncResultSummary {
  ok: boolean;
  trigger: "manual" | "scheduled" | "tray";
  started: boolean;
  at: string;
  /** Present on a not-started run: "busy" | "no-account" | "no-sync". */
  reason?: string;
  category?: string;
  message?: string;
  account?: { provider: "gmail" | "generic" | null; email: string | null } | null;
  mailbox?: string;
  sinceDays?: number;
  fetched?: number;
  /** How many arrived unseen this run (before mailbox-level dedupe). */
  newCount?: number;
  /** Shipment metadata: only when the run delivered messages. */
  shipped?: { uids: string[]; uidValidity: number | null };
}

/** Mailbox-level delivery from main → renderer (sync stage). */
export interface EmailAlertsDelivered {
  /** The converted, parser-ready messages (AlertEmail shape). */
  messages: Array<{
    id: string;
    from: string;
    subject: string;
    /** The parser-ready plain text (HTML already converted in main). */
    body: string;
    receivedAt?: string;
  }>;
  mailbox: string;
  uidValidity: number | null;
  sinceDays: number;
}

/** Sync status from main — mirror of electron/emailSync.cjs status(). */
export interface EmailSyncStatusReport {
  configured: boolean;
  account: { provider: "gmail" | "generic" | null; email: string | null } | null;
  inFlight: boolean;
  lastResult: EmailSyncResultSummary | null;
  backoff: { active: boolean; retryAt?: string };
  lastSyncAt: string | null;
}

/** Return shape of the renderer-invoked manual check IPC. */
export interface EmailSyncCheckResult {
  ok: boolean;
  started: boolean;
  reason?: string;
  category?: string;
  message?: string;
  fetched?: number;
}

/**
 * Result of an email connect/test operation. `message` is a redacted,
 * category-appropriate human message — never a server transcript, never a
 * password. `errors` maps field → message for an invalid configuration.
 */
export interface EmailOperationResult {
  ok: boolean;
  category?:
    | "auth"
    | "tls"
    | "timeout"
    | "network"
    | "unknown"
    | "invalid-config"
    | "empty-secret"
    | "credential";
  message?: string;
  errors?: Record<string, string>;
  state?: string;
}

/** The safe connection states main reports. */
export type EmailConnectionState =
  | "not-connected"
  | "connecting"
  | "connected"
  | "auth-failed"
  | "connection-failed"
  | "disconnected";

/** Status payload from main. Deliberately contains no secret-bearing field. */
export interface EmailConnectionStatusReport {
  state: EmailConnectionState;
  /** Identity of the last successfully connected account, if main knows it. */
  provider: "gmail" | "generic" | null;
  email: string | null;
  lastConnectedAt: string | null;
  lastError: { category: string; at: string } | null;
  /** The credential vault's own answer — whether a password is stored. */
  credential: { connected: boolean; savedAt: string | null };
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
  /**
   * Email connection + sync operations (FR-24). The password in a connect/test
   * payload crosses IPC once, into main, and can never be read back — there is
   * no such channel. Results and status carry safe identity data only. IMAP
   * networking happens entirely in main; `check` runs the SAME canonical sync
   * the scheduler and the tray call (`syncEmailAlerts`).
   */
  email: {
    connect(payload: {
      config: unknown;
      password: string;
    }): Promise<EmailOperationResult>;
    test(payload: { config: unknown; password?: string }): Promise<EmailOperationResult>;
    disconnect(): Promise<{ ok: boolean }>;
    status(): Promise<EmailConnectionStatusReport>;
    /** Reports the renderer's known account config + allowlist domains so main
     *  can run the scheduler and show the tray item (main is TOLD, never
     *  parses stored state). Passing `config: null` clears it. */
    setAccount(payload: {
      config: unknown;
      domains: string[];
    }): Promise<{ ok: boolean; configured: boolean; errors?: Record<string, string> }>;
    /** Manual sync — invokes the canonical operation directly (never through
     *  the timer). Messages arrive via `appEvents.onEmailAlerts`. */
    check(): Promise<EmailSyncCheckResult>;
    syncStatus(): Promise<EmailSyncStatusReport>;
    /** Mailbox-level dedupe confirmation: mark these message ids as delivered
     *  so the next poll does not re-download them. Transaction-level duplicate
     *  detection is untouched (stays in lib/emailPipeline.ts). */
    confirmProcessed(payload: { uids: string[] }): Promise<{ ok: boolean; added: number }>;
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
