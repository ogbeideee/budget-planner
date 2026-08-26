import { beforeEach, describe, expect, it } from "vitest";
import {
  DISPLAY_NAME_STORAGE_KEY,
  loadDisplayName,
  saveDisplayName,
} from "@/lib/displayName";

beforeEach(() => {
  window.localStorage.clear();
});

describe("display name preference", () => {
  it("returns null when nothing has been saved", () => {
    expect(loadDisplayName()).toBeNull();
  });

  it("returns the saved name", () => {
    saveDisplayName("Daniel");
    expect(loadDisplayName()).toBe("Daniel");
  });

  it("trims whitespace before saving", () => {
    saveDisplayName("  Daniel  ");
    expect(window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY)).toBe("Daniel");
    expect(loadDisplayName()).toBe("Daniel");
  });

  it("treats a whitespace-only value as no name", () => {
    saveDisplayName("   ");
    expect(loadDisplayName()).toBeNull();
  });
});