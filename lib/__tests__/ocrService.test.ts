// Local-only OCR configuration (Prompt 8K).
//
// Bank statements are sensitive and the import must stay offline. The
// Tesseract engine is fully vendored, but the shipped `tesseract.min.js` /
// `worker.min.js` bundles carry `https://cdn.jsdelivr.net/...` DEFAULTS for
// workerPath/corePath/langPath — they are only ever local because the app
// overrides every path to `/vendor/tesseract/` and disables gzip. These tests
// lock that contract so an accidental CDN path (or a dropped override) fails
// the suite instead of silently starting to reach the network.

import { describe, expect, it } from "vitest";
import {
  TESSERACT_ASSET_DIR,
  TESSERACT_LANG,
  TESSERACT_OEM,
  TESSERACT_WORKER_OPTIONS,
} from "@/lib/ocrService";

describe("ocrService — bundled, local-only OCR (8K)", () => {
  it("points every engine path at the app-served asset dir", () => {
    for (const key of ["workerPath", "corePath", "langPath"] as const) {
      const value = TESSERACT_WORKER_OPTIONS[key];
      expect(typeof value).toBe("string");
      const path = String(value);
      // langPath IS the asset dir; workerPath/corePath live under it.
      const ok =
        path === TESSERACT_ASSET_DIR ||
        path.startsWith(`${TESSERACT_ASSET_DIR}/`);
      expect(ok).toBe(true);
    }
  });

  it("never references a network origin in the engine config", () => {
    const serialized = JSON.stringify(TESSERACT_WORKER_OPTIONS);
    expect(serialized).not.toMatch(/https?:\/\//);
    expect(serialized).not.toMatch(/cdn\.|jsdelivr|unpkg|github\.io/);
  });

  it("disables gzip so the worker loads the plain vendored traineddata", () => {
    expect(TESSERACT_WORKER_OPTIONS.gzip).toBe(false);
    // Blob workers can't resolve the app-served worker path (their base URL
    // is a blob: URL, so importScripts("/vendor/...") is invalid) — the plain
    // worker URL resolves against the page origin (app://bundle in the EXE).
    expect(TESSERACT_WORKER_OPTIONS.workerBlobURL).toBe(false);
  });

  it("runs English recognition from the local asset dir", () => {
    expect(TESSERACT_LANG).toBe("eng");
    expect(TESSERACT_OEM).toBe(1);
    expect(TESSERACT_ASSET_DIR).toBe("/vendor/tesseract");
  });
});
