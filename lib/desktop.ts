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
  menu: {
    on(callback: (action: DesktopMenuAction) => void): () => void;
  };
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
