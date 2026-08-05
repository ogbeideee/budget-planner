import { beforeEach, describe, expect, it } from "vitest";
import {
  BACKUP_PREFIX,
  loadBackupSnapshot,
  parseStoredState,
  saveAppState,
  scanRecoverablePayloads,
  setWritesEnabled,
  snapshotCurrentState,
  STORAGE_KEY,
} from "../storage";
import { createInitialState } from "../seed";
import type { AppState } from "../types";

function v1State(): AppState {
  const state = createInitialState();
  return {
    ...state,
    version: 1,
    transactions: [
      {
        id: "legacy-tx",
        categoryId: state.categories.find((c) => c.kind === "expense")!.id,
        amount: 40000,
        type: "expense",
        date: "2026-08-02",
        createdAt: "2026-08-02T00:00:00.000Z",
      },
    ],
  } as unknown as AppState;
}

function v1Payload(): string {
  return JSON.stringify({ state: v1State(), version: 1 });
}

function backupKeys(): string[] {
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key !== null && key.startsWith(BACKUP_PREFIX)) keys.push(key);
  }
  return keys;
}

beforeEach(() => {
  window.localStorage.clear();
  setWritesEnabled(true);
});

describe("backup snapshots", () => {
  it("snapshots a legacy payload before migrating it", () => {
    const raw = v1Payload();
    window.localStorage.setItem(STORAGE_KEY, raw);
    const result = parseStoredState(raw);
    expect(result.version).toBe(3);
    const keys = backupKeys();
    expect(keys).toHaveLength(1);
    const snapshot = loadBackupSnapshot(keys[0]);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.raw).toBe(raw);
    expect(snapshot!.sourceVersion).toBe(1);
    expect(snapshot!.kind).toContain("auto-v1");
    expect(snapshot!.counts.transactions).toBe(1);
  });

  it("snapshots a corrupt payload so it can be inspected later", () => {
    const corrupt = '{"state":{"version":2,"transactions":"broken"}}';
    window.localStorage.setItem(STORAGE_KEY, corrupt);
    expect(() => parseStoredState(corrupt)).toThrow();
    const keys = backupKeys();
    expect(keys).toHaveLength(1);
    expect(loadBackupSnapshot(keys[0])!.kind).toContain("auto-corrupt");
    expect(loadBackupSnapshot(keys[0])!.sourceVersion).toBe("corrupt");
  });

  it("snapshots unparseable JSON too", () => {
    const garbage = "not-json{{{";
    window.localStorage.setItem(STORAGE_KEY, garbage);
    expect(() => parseStoredState(garbage)).toThrow();
    const keys = backupKeys();
    expect(keys).toHaveLength(1);
    expect(loadBackupSnapshot(keys[0])!.canRestore).toBe(false);
  });

  it("never overwrites an existing backup key", () => {
    window.localStorage.setItem(STORAGE_KEY, v1Payload());
    parseStoredState(v1Payload());
    const first = backupKeys();
    expect(first).toHaveLength(1);
    parseStoredState(v1Payload());
    expect(backupKeys()).toHaveLength(2);
    expect(backupKeys()[0]).not.toBe(backupKeys()[1]);
  });

  it("creates a manual snapshot of the current state", () => {
    const state = createInitialState();
    state.transactions = [
      {
        id: "t1",
        categoryId: state.categories[0].id,
        amount: 100,
        type: "expense",
        date: "2026-08-01",
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ];
    saveAppState(state);
    const key = snapshotCurrentState();
    expect(key).not.toBeNull();
    const snapshot = loadBackupSnapshot(key!);
    expect(snapshot!.kind).toBe("manual");
    expect(snapshot!.canRestore).toBe(true);
    expect(snapshot!.counts.transactions).toBe(1);
  });
});

describe("write guard", () => {
  it("blocks saveAppState when writes are disabled", () => {
    setWritesEnabled(false);
    saveAppState(createInitialState());
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("allows saveAppState when writes are enabled", () => {
    setWritesEnabled(true);
    saveAppState(createInitialState());
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("re-enabling writes lets the store persist again", () => {
    setWritesEnabled(false);
    saveAppState(createInitialState());
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    setWritesEnabled(true);
    const state = createInitialState();
    state.transactions = [];
    saveAppState(state);
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});

describe("recovery scan", () => {
  it("classifies the main state, categorization, backups and UI keys", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: v1State(), version: 1 }));
    window.localStorage.setItem("budget-planner:categorization", '{"netflix":"cat-1"}');
    window.localStorage.setItem("disclosure:planner-budgets", "1");
    window.localStorage.setItem("settings:cats:open", "0");
    const found = scanRecoverablePayloads();
    const byKey = new Map(found.map((p) => [p.key, p]));
    expect(byKey.get(STORAGE_KEY)!.kind).toBe("main-state");
    expect(byKey.get(STORAGE_KEY)!.counts.transactions).toBe(1);
    expect(byKey.get(STORAGE_KEY)!.canRestore).toBe(true);
    expect(byKey.get("budget-planner:categorization")!.kind).toBe("categorization");
    expect(byKey.get("disclosure:planner-budgets")!.kind).toBe("ui");
    expect(byKey.get("settings:cats:open")!.kind).toBe("ui");
  });

  it("reports a v2 payload with the main-state kind", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: createInitialState(), version: 2 }),
    );
    const [main] = scanRecoverablePayloads().filter(
      (p) => p.kind === "main-state",
    );
    expect(main.version).toBe(2);
  });

  it("lists backups with newest first", () => {
    window.localStorage.setItem(STORAGE_KEY, v1Payload());
    parseStoredState(v1Payload());
    parseStoredState(v1Payload());
    const keys = backupKeys();
    expect(keys).toHaveLength(2);
    const listed = scanRecoverablePayloads().filter((p) => p.kind === "backup");
    expect(listed).toHaveLength(2);
    expect(listed[0].key).not.toBe(listed[1].key);
  });
});
