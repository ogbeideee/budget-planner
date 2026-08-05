import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as backups from "./backups.cjs";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-backups-test-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("selectRetained", () => {
  it("keeps newest-first entries capped at maxFiles", () => {
    const entries = [1, 2, 3, 4, 5].map((n) => ({ n }));
    expect(backups.selectRetained(entries, 3)).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    expect(backups.selectRetained(entries, 10)).toHaveLength(5);
  });
});

describe("resolveWithin", () => {
  it("accepts backup filenames only", () => {
    expect(backups.resolveWithin(dir, "budget-planner-backup-2026-08-05T12-00-00-000Z.json")).toMatch(/\.json$/);
  });

  it("rejects path traversal and foreign names", () => {
    expect(backups.resolveWithin(dir, "../evil.json")).toBeNull();
    expect(backups.resolveWithin(dir, "..\\evil.json")).toBeNull();
    expect(backups.resolveWithin(dir, "C:\\Windows\\win.ini")).toBeNull();
    expect(backups.resolveWithin(dir, "evil.json")).toBeNull();
    expect(backups.resolveWithin(dir, "budget-planner-backup-x.txt")).toBeNull();
    expect(backups.resolveWithin(dir, "")).toBeNull();
  });
});

describe("writeBackup / listBackups / readBackup / deleteBackup", () => {
  it("roundtrips a backup file with parsed createdAt", () => {
    const entry = backups.writeBackup(dir, '{"state":1}');
    expect(entry).not.toBeNull();
    expect(entry!.name).toMatch(/^budget-planner-backup-.+\.json$/);
    expect(new Date(entry!.createdAt).getTime()).not.toBeNaN();
    expect(backups.listBackups(dir)).toHaveLength(1);
    expect(backups.readBackup(dir, entry!.name)).toBe('{"state":1}');
    expect(backups.deleteBackup(dir, entry!.name)).toBe(true);
    expect(backups.listBackups(dir)).toHaveLength(0);
  });

  it("dedupes identical consecutive content", () => {
    const first = backups.writeBackup(dir, "same");
    const second = backups.writeBackup(dir, "same");
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(backups.listBackups(dir)).toHaveLength(1);
  });

  it("prunes to the newest MAX_FILES backups", () => {
    for (let i = 0; i < backups.MAX_FILES + 3; i += 1) {
      backups.writeBackup(dir, JSON.stringify({ i }));
    }
    const listed = backups.listBackups(dir);
    expect(listed).toHaveLength(backups.MAX_FILES);
    expect(listed[0].name).toBe(listed.map((b) => b.name).sort().at(-1));
  });

  it("rejects empty content and unknown names", () => {
    expect(backups.writeBackup(dir, "")).toBeNull();
    expect(backups.readBackup(dir, "nope.json")).toBeNull();
    expect(backups.deleteBackup(dir, "nope.json")).toBe(false);
    expect(backups.listBackups(dir)).toHaveLength(0);
  });
});
