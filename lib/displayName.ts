// First-run display name: a tiny local preference stored through the single
// persistence seam (SQLite on desktop, localStorage in the browser). No schema
// involvement — it is app-level preference data, not part of AppState.
import { getStorageBackend } from "./storageAdapter";

export const DISPLAY_NAME_STORAGE_KEY = "settings:display-name";

export function loadDisplayName(): string | null {
  try {
    const raw = getStorageBackend().getItem(DISPLAY_NAME_STORAGE_KEY);
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export function saveDisplayName(name: string): void {
  getStorageBackend().setItem(DISPLAY_NAME_STORAGE_KEY, name.trim());
}