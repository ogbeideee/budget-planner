import { validateAppState } from "./validate";
import { getStorageBackend } from "./storageAdapter";
import type { AppState } from "./types";

export const STORAGE_KEY = "budget-planner:state";
export const CATEGORIZATION_KEY = "budget-planner:categorization";
export const BACKUP_PREFIX = "budget-planner:backup:";

export const CURRENT_STORAGE_VERSION = 3;

export class CorruptedStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CorruptedStateError";
  }
}

let writesEnabled = true;

export function setWritesEnabled(enabled: boolean): void {
  writesEnabled = enabled;
}

export function isWritesEnabled(): boolean {
  return writesEnabled;
}

function parseStoredValue(parsed: unknown): AppState {
  const inner =
    typeof parsed === "object" &&
    parsed !== null &&
    "state" in parsed &&
    !Array.isArray(parsed)
      ? (parsed as { state: unknown }).state
      : parsed;
  try {
    return validateAppState(inner);
  } catch (error) {
    throw new CorruptedStateError(
      error instanceof Error ? error.message : "Saved data is corrupted",
    );
  }
}

function storedVersionOf(parsed: unknown): number | undefined {
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    typeof (parsed as { version?: unknown }).version === "number"
  ) {
    return (parsed as { version: number }).version;
  }
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    typeof (parsed as { state?: unknown }).state === "object" &&
    (parsed as { state: { version?: unknown } }).state !== null &&
    typeof (parsed as { state: { version?: unknown } }).state.version === "number"
  ) {
    return (parsed as { state: { version: number } }).state.version;
  }
  return undefined;
}

export function parseStoredState(raw: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    snapshotCorruptPayload(raw);
    throw new CorruptedStateError("Saved data is corrupted");
  }
  const version = storedVersionOf(parsed);
  if (version !== undefined && version < CURRENT_STORAGE_VERSION) {
    snapshotLegacyPayload(raw, version);
  }
  try {
    return parseStoredValue(parsed);
  } catch (error) {
    snapshotCorruptPayload(raw);
    throw new CorruptedStateError(
      error instanceof Error ? error.message : "Saved data is corrupted",
    );
  }
}

export function saveAppState(state: AppState): void {
  if (typeof window === "undefined") return;
  if (!writesEnabled) return;
  try {
    getStorageBackend().setItem(
      STORAGE_KEY,
      JSON.stringify({ state, version: CURRENT_STORAGE_VERSION }),
    );
  } catch {
    // storage unavailable (quota/security); ignore rather than crash the caller
  }
}

export interface BackupMetadata {
  key: string;
  kind: string;
  createdAt: string;
  sourceVersion: number | "unknown" | "corrupt" | "current";
  sizeBytes: number;
  counts: {
    transactions: number;
    budgets: number;
    categories: number;
    futureExpenses: number;
    recurrenceRules: number;
    incomePlans: number;
  };
  canRestore: boolean;
}

function timestampToken(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function backupPayload(
  kind: string,
  sourceVersion: number | "unknown" | "corrupt" | "current",
  raw: string,
): string {
  return JSON.stringify({
    app: "budget-planner",
    backup: true,
    kind,
    createdAt: new Date().toISOString(),
    sourceVersion,
    raw,
  });
}

export function uniqueBackupKey(kind: string): string {
  let key = `${BACKUP_PREFIX}${kind}:${timestampToken()}`;
  let suffix = 1;
  while (getStorageBackend().getItem(key) !== null) {
    key = `${BACKUP_PREFIX}${kind}:${timestampToken()}-${suffix}`;
    suffix += 1;
  }
  return key;
}

export function writeBackup(kind: string, raw: string): string | null {
  if (typeof window === "undefined") return null;
  const key = uniqueBackupKey(kind);
  try {
    getStorageBackend().setItem(
      key,
      backupPayload(kind, "unknown", raw),
    );
  } catch {
    return null;
  }
  return key;
}

function snapshotLegacyPayload(raw: string, version: number): void {
  if (typeof window === "undefined") return;
  const key = uniqueBackupKey(`auto-v${version}`);
  try {
    getStorageBackend().setItem(
      key,
      backupPayload(`auto-v${version}`, version, raw),
    );
  } catch {
    // best-effort snapshot; never block boot on a storage failure
  }
}

function snapshotCorruptPayload(raw: string): void {
  if (typeof window === "undefined") return;
  const key = uniqueBackupKey("auto-corrupt");
  try {
    getStorageBackend().setItem(
      key,
      backupPayload("auto-corrupt", "corrupt", raw),
    );
  } catch {
    // best-effort snapshot; never block boot on a storage failure
  }
}

export function snapshotCurrentState(): string | null {
  if (typeof window === "undefined") return null;
  const raw = getStorageBackend().getItem(STORAGE_KEY);
  if (raw === null) return null;
  const key = uniqueBackupKey("manual");
  try {
    getStorageBackend().setItem(key, backupPayload("manual", "current", raw));
  } catch {
    return null;
  }
  return key;
}

export interface BackupSnapshot extends BackupMetadata {
  raw: string;
}

export function loadBackupSnapshot(key: string): BackupSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = getStorageBackend().getItem(key);
  if (raw === null) return null;
  let innerRaw = raw;
  try {
    const payload = JSON.parse(raw) as { raw?: unknown };
    if (typeof payload.raw === "string") innerRaw = payload.raw;
  } catch {
    // not a structured backup; expose the raw payload as-is
  }
  return {
    ...inspectBackupPayload(key, raw),
    raw: innerRaw,
  };
}

export function deleteBackupSnapshot(key: string): void {
  if (typeof window === "undefined") return;
  getStorageBackend().removeItem(key);
}

function inspectBackupPayload(key: string, raw: string): BackupMetadata {
  const base: BackupMetadata = {
    key,
    kind: "backup",
    createdAt: "",
    sourceVersion: "unknown",
    sizeBytes: raw.length,
    counts: {
      transactions: 0,
      budgets: 0,
      categories: 0,
      futureExpenses: 0,
      recurrenceRules: 0,
      incomePlans: 0,
    },
    canRestore: false,
  };
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return base;
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    (payload as { backup?: unknown }).backup !== true
  ) {
    return base;
  }
  const record = payload as {
    kind?: unknown;
    createdAt?: unknown;
    sourceVersion?: unknown;
    raw?: unknown;
  };
  base.kind =
    typeof record.kind === "string" ? record.kind : "backup";
  base.createdAt =
    typeof record.createdAt === "string" ? record.createdAt : "";
  const sourceVersion = record.sourceVersion;
  base.sourceVersion =
    typeof sourceVersion === "number"
      ? sourceVersion
      : sourceVersion === "current" ||
          sourceVersion === "corrupt" ||
          sourceVersion === "unknown"
        ? sourceVersion
        : "unknown";
  if (typeof record.raw === "string") {
    try {
      const parsedRaw: unknown = JSON.parse(record.raw);
      const inner =
        typeof parsedRaw === "object" &&
        parsedRaw !== null &&
        "state" in parsedRaw &&
        !Array.isArray(parsedRaw)
          ? (parsedRaw as { state: unknown }).state
          : parsedRaw;
      if (
        typeof inner === "object" &&
        inner !== null &&
        !Array.isArray(inner)
      ) {
        const state = inner as Record<string, unknown>;
        base.counts = {
          transactions: Array.isArray(state.transactions)
            ? state.transactions.length
            : 0,
          budgets: Array.isArray(state.budgets) ? state.budgets.length : 0,
          categories: Array.isArray(state.categories)
            ? state.categories.length
            : 0,
          futureExpenses: Array.isArray(state.futureExpenses)
            ? state.futureExpenses.length
            : 0,
          recurrenceRules: Array.isArray(state.recurrenceRules)
            ? state.recurrenceRules.length
            : 0,
          incomePlans: Array.isArray(state.incomePlans)
            ? state.incomePlans.length
            : 0,
        };
        base.canRestore = true;
      }
    } catch {
      base.canRestore = false;
    }
  }
  return base;
}

export function listBackupSnapshots(): BackupMetadata[] {
  if (typeof window === "undefined") return [];
  const results: BackupMetadata[] = [];
  for (const key of getStorageBackend().keys()) {
    if (!key.startsWith(BACKUP_PREFIX)) continue;
    const raw = getStorageBackend().getItem(key);
    if (raw === null) continue;
    results.push(inspectBackupPayload(key, raw));
  }
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type RecoverableKind =
  | "main-state"
  | "categorization"
  | "backup"
  | "ui"
  | "unknown";

export interface RecoverablePayload {
  key: string;
  kind: RecoverableKind;
  version?: number;
  sizeBytes: number;
  counts: {
    transactions: number;
    budgets: number;
    categories: number;
    futureExpenses: number;
    recurrenceRules: number;
    incomePlans: number;
  };
  canRestore: boolean;
  raw: string;
}

function classifyPayload(key: string, raw: string): RecoverablePayload {
  const emptyCounts = {
    transactions: 0,
    budgets: 0,
    categories: 0,
    futureExpenses: 0,
    recurrenceRules: 0,
    incomePlans: 0,
  };
  const base = {
    key,
    kind: "unknown" as RecoverableKind,
    sizeBytes: raw.length,
    counts: emptyCounts,
    canRestore: false,
    raw,
  };
  if (key.startsWith(BACKUP_PREFIX)) {
    const metadata = inspectBackupPayload(key, raw);
    return {
      ...base,
      kind: "backup",
      counts: metadata.counts,
      canRestore: metadata.canRestore,
      version:
        typeof metadata.sourceVersion === "number"
          ? metadata.sourceVersion
          : undefined,
    };
  }
  if (key === STORAGE_KEY) {
    return { ...base, kind: "main-state", ...parseStateCounts(raw) };
  }
  if (key === CATEGORIZATION_KEY) {
    return { ...base, kind: "categorization" };
  }
  if (key.startsWith("disclosure:") || key.startsWith("settings:cats:")) {
    return { ...base, kind: "ui" };
  }
  return { ...base, kind: "unknown", ...parseStateCounts(raw) };
}

function parseStateCounts(
  raw: string,
): Pick<RecoverablePayload, "version" | "counts" | "canRestore"> {
  const counts = {
    transactions: 0,
    budgets: 0,
    categories: 0,
    futureExpenses: 0,
    recurrenceRules: 0,
    incomePlans: 0,
  };
  try {
    const parsed: unknown = JSON.parse(raw);
    const version = storedVersionOf(parsed);
    const inner =
      typeof parsed === "object" &&
      parsed !== null &&
      "state" in parsed &&
      !Array.isArray(parsed)
        ? (parsed as { state: unknown }).state
        : parsed;
    if (
      typeof inner === "object" &&
      inner !== null &&
      !Array.isArray(inner)
    ) {
      const state = inner as Record<string, unknown>;
      counts.transactions = Array.isArray(state.transactions)
        ? state.transactions.length
        : 0;
      counts.budgets = Array.isArray(state.budgets) ? state.budgets.length : 0;
      counts.categories = Array.isArray(state.categories)
        ? state.categories.length
        : 0;
      counts.futureExpenses = Array.isArray(state.futureExpenses)
        ? state.futureExpenses.length
        : 0;
      counts.recurrenceRules = Array.isArray(state.recurrenceRules)
        ? state.recurrenceRules.length
        : 0;
      counts.incomePlans = Array.isArray(state.incomePlans)
        ? state.incomePlans.length
        : 0;
      return {
        version,
        counts,
        canRestore: counts.transactions > 0 || counts.budgets > 0,
      };
    }
    return { version, counts, canRestore: false };
  } catch {
    return { version: undefined, counts, canRestore: false };
  }
}

export function scanRecoverablePayloads(): RecoverablePayload[] {
  if (typeof window === "undefined") return [];
  const keys = new Set<string>();
  for (const key of getStorageBackend().keys()) {
    if (
      key.startsWith("budget-planner:") ||
      key.startsWith("disclosure:") ||
      key.startsWith("settings:cats:")
    ) {
      keys.add(key);
    }
  }
  const results: RecoverablePayload[] = [];
  for (const key of keys) {
    const raw = getStorageBackend().getItem(key);
    if (raw === null) continue;
    results.push(classifyPayload(key, raw));
  }
  return results.sort(
    (a, b) =>
      Number(b.kind === "main-state") - Number(a.kind === "main-state") ||
      b.sizeBytes - a.sizeBytes,
  );
}

export interface ExportPayload {
  app: string;
  exportedAt: string;
  version: number;
  state: AppState;
}

export function serializeExport(state: AppState): string {
  const payload: ExportPayload = {
    app: "budget-planner",
    exportedAt: new Date().toISOString(),
    version: CURRENT_STORAGE_VERSION,
    state,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseExportPayload(value: unknown): AppState {
  const inner =
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { state?: unknown }).state !== undefined
      ? (value as { state: unknown }).state
      : value;
  return validateAppState(inner);
}
