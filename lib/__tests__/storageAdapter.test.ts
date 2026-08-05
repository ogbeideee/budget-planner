import { beforeEach, describe, expect, it } from "vitest";
import {
  getDesktopBridge,
  isDesktop,
} from "@/lib/desktop";
import {
  getStorageBackend,
  resetStorageBackendCache,
} from "@/lib/storageAdapter";

function installBridge(
  overrides: Partial<{
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => boolean;
    removeItem: (key: string) => boolean;
    keys: () => string[];
  }>,
) {
  window.budgetPlannerDesktop = {
    platform: "win32",
    getAppInfo: async () => ({
      name: "Budget Planner",
      version: "0.1.0",
      platform: "win32",
      isPackaged: true,
      versions: {
        electron: "43.3.0",
        chrome: "142",
        node: "24",
      },
    }),
    storage: {
      getItem: (key) => overrides.getItem?.(key) ?? null,
      setItem: (key, value) => overrides.setItem?.(key, value) ?? true,
      removeItem: (key) => overrides.removeItem?.(key) ?? true,
      keys: () => overrides.keys?.() ?? [],
    },
    dialog: {
      open: async () => ({ canceled: true }),
      save: async () => ({ canceled: true }),
    },
    fs: {
      writeText: async () => ({ ok: true }),
      readText: async () => ({ ok: false, error: "n/a" }),
    },
    shell: {
      openPath: async () => ({ ok: true }),
      showItemInFolder: async () => ({ ok: true }),
    },
    notify: async () => ({ ok: true }),
    paths: async () => ({
      userData: "C:\\data",
      backupsDir: "C:\\data\\backups",
      dbFile: "C:\\data\\budget-planner.sqlite3",
    }),
    backups: {
      create: () => null,
      list: async () => [],
      read: async () => ({ ok: false, error: "n/a" }),
      delete: async () => ({ ok: true }),
      restoreLatest: async () => ({ status: "canceled" }),
    },
    menu: {
      on: () => () => {},
    },
  };
}

beforeEach(() => {
  delete window.budgetPlannerDesktop;
  window.localStorage.clear();
  resetStorageBackendCache();
});

describe("getDesktopBridge / isDesktop", () => {
  it("returns null without the bridge", () => {
    expect(getDesktopBridge()).toBeNull();
    expect(isDesktop()).toBe(false);
  });

  it("returns the bridge when present", () => {
    installBridge({});
    expect(isDesktop()).toBe(true);
    expect(getDesktopBridge()?.platform).toBe("win32");
  });
});

describe("getStorageBackend (browser fallback)", () => {
  it("reads, writes, removes and lists through localStorage", () => {
    const backend = getStorageBackend();
    backend.setItem("a", "1");
    backend.setItem("b", "2");
    expect(backend.getItem("a")).toBe("1");
    expect(backend.keys().sort()).toEqual(["a", "b"]);
    backend.removeItem("a");
    expect(backend.getItem("a")).toBeNull();
  });

  it("routes to the bridge when it is present", () => {
    const calls: string[] = [];
    installBridge({
      getItem: () => {
        calls.push("get");
        return "from-sqlite";
      },
      setItem: () => {
        calls.push("set");
        return true;
      },
      removeItem: () => {
        calls.push("remove");
        return true;
      },
      keys: () => {
        calls.push("keys");
        return ["budget-planner:state"];
      },
    });
    const backend = getStorageBackend();
    expect(backend.getItem("k")).toBe("from-sqlite");
    backend.setItem("k", "v");
    backend.removeItem("k");
    expect(backend.keys()).toEqual(["budget-planner:state"]);
    expect(calls).toEqual(["get", "set", "remove", "keys"]);
  });

  it("throws when the bridge reports a failed write (mimics quota errors)", () => {
    installBridge({ setItem: () => false });
    expect(() => getStorageBackend().setItem("k", "v")).toThrow();
  });

  it("caches the backend across calls", () => {
    const first = getStorageBackend();
    const second = getStorageBackend();
    expect(first).toBe(second);
  });
});
