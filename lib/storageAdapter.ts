// Single persistence seam for the whole app. In Electron it routes through the
// preload bridge into SQLite (main process); in a plain browser it falls back
// to localStorage — so every consumer (zustand persist, backups, disclosure
// state, icon lists, categorization) behaves identically in both environments.
import { getDesktopBridge } from "./desktop";

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

function browserBackend(): StorageBackend {
  return {
    getItem(key) {
      return window.localStorage.getItem(key);
    },
    setItem(key, value) {
      window.localStorage.setItem(key, value);
    },
    removeItem(key) {
      window.localStorage.removeItem(key);
    },
    keys() {
      const result: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key !== null) result.push(key);
      }
      return result;
    },
  };
}

let cached: StorageBackend | null = null;

// Test hook: clears the cached backend so a different bridge/browser
// environment can be exercised within one test run.
export function resetStorageBackendCache(): void {
  cached = null;
}

export function getStorageBackend(): StorageBackend {
  if (cached) return cached;
  const bridge = getDesktopBridge();
  if (bridge?.storage) {
    cached = {
      getItem: (key) => bridge.storage.getItem(key),
      setItem: (key, value) => {
        const ok = bridge.storage.setItem(key, value);
        if (!ok) {
          throw new Error("storage write failed (SQLite unavailable)");
        }
      },
      removeItem: (key) => {
        bridge.storage.removeItem(key);
      },
      keys: () => bridge.storage.keys(),
    };
  } else if (typeof window !== "undefined") {
    cached = browserBackend();
  } else {
    cached = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      keys: () => [],
    };
  }
  return cached;
}
