import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { atomicWriteText } from "./atomicWrite.cjs";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-atomic-test-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("atomicWriteText (Prompt 7B — temp file cleanup)", () => {
  it("writes the content atomically and leaves no temp file behind", () => {
    const target = path.join(dir, "out.json");
    const result = atomicWriteText(target, '{"state":1}');
    expect(result).toEqual({ ok: true });
    expect(fs.readFileSync(target, "utf8")).toBe('{"state":1}');
    expect(fs.existsSync(`${target}.tmp`)).toBe(false);
  });

  it("creates the parent directory when mkdir is requested", () => {
    const target = path.join(dir, "nested", "deep", "out.json");
    expect(atomicWriteText(target, "x", { mkdir: true })).toEqual({ ok: true });
    expect(fs.readFileSync(target, "utf8")).toBe("x");
    expect(fs.existsSync(`${target}.tmp`)).toBe(false);
  });

  it("removes the temp file when the write itself fails", () => {
    const blocker = path.join(dir, "blocker");
    fs.writeFileSync(blocker, "not a directory");
    const target = path.join(blocker, "out.json");
    const result = atomicWriteText(target, "secret", { mkdir: true });
    expect(result.ok).toBe(false);
    expect(fs.existsSync(`${target}.tmp`)).toBe(false);
    expect(fs.existsSync(target)).toBe(false);
  });

  it("removes the temp file when the rename fails and keeps the target intact", () => {
    const target = path.join(dir, "target-dir");
    fs.mkdirSync(target);
    const existing = path.join(target, "existing.txt");
    fs.writeFileSync(existing, "old content");
    const result = atomicWriteText(target, "secret");
    expect(result.ok).toBe(false);
    expect(fs.existsSync(`${target}.tmp`)).toBe(false);
    expect(fs.readFileSync(existing, "utf8")).toBe("old content");
  });

  it("rejects invalid inputs without touching the file system", () => {
    expect(atomicWriteText("", "x")).toEqual({ ok: false, error: "invalid target" });
    expect(atomicWriteText(path.join(dir, "x.json"), null)).toEqual({
      ok: false,
      error: "invalid content",
    });
    expect(fs.readdirSync(dir)).toEqual([]);
  });
});