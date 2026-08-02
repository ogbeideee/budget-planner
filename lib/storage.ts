import { validateAppState } from "./validate";
import type { AppState } from "./types";

export const STORAGE_KEY = "budget-planner:state";

export class CorruptedStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CorruptedStateError";
  }
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

export function parseStoredState(raw: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CorruptedStateError("Saved data is corrupted");
  }
  return parseStoredValue(parsed);
}

export function loadAppState(): AppState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  return parseStoredState(raw);
}

export function saveAppState(state: AppState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version: 1 }));
}

export function removeAppState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
