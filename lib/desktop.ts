// Typed access to the Electron preload bridge (window.budgetPlannerDesktop).
// Absent in a plain browser — the app must keep working there via localStorage.
export interface DesktopStorageBridge {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  removeItem(key: string): boolean;
  keys(prefix?: string): string[];
}

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  isPackaged: boolean;
}

export interface DesktopBridge {
  platform: string;
  getAppInfo(): Promise<AppInfo>;
  storage: DesktopStorageBridge;
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
