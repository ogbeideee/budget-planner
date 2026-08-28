// Guard: a real statement fixture must be READ by a test.
//
// The OPay fixture sat in this directory wired into nothing. Its manifest
// entry did not even typecheck, so the repo's own `id` union was missing it —
// and OPay changed its export format with no test to notice. Sitting in the
// repo is not coverage.
//
// This scans test sources the way categoryRegistry.test.tsx scans components:
// every fixture id must appear inside one of the manifest's loaders in some
// test file, and must declare when it was last checked against the real file.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { STATEMENT_FIXTURES } from "./manifest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SEARCH_DIRS = ["tests", "lib/__tests__"];
const SELF = "fixtureCoverage.test.ts";

function testSources(): { file: string; text: string }[] {
  const found: { file: string; text: string }[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.test\.tsx?$/.test(entry) || entry === SELF) continue;
      found.push({ file: full, text: readFileSync(full, "utf8") });
    }
  };
  for (const dir of SEARCH_DIRS) walk(path.join(repoRoot, dir));
  return found;
}

/** The manifest's loaders — the only ways a test can read a real fixture. */
const LOADERS = [
  "fixtureCells",
  "fixtureAlignedCells",
  "fixtureRowYs",
  "fixtureAlignedRowYs",
  "loadFixtureSnapshot",
  "loadFixtureOcrText",
  "fixturePdfPath",
];

const SOURCES = testSources();

function readersOf(id: string): string[] {
  const patterns = LOADERS.map((fn) => `${fn}("${id}")`);
  return SOURCES.filter((source) => patterns.some((p) => source.text.includes(p))).map(
    (source) => path.relative(repoRoot, source.file),
  );
}

describe("every real statement fixture is read by a test", () => {
  it.each(STATEMENT_FIXTURES.map((f) => [f.id, f.label] as const))(
    "%s (%s) is loaded somewhere",
    (id) => {
      expect(readersOf(id), `fixture "${id}" is in the repo but no test reads it`)
        .not.toHaveLength(0);
    },
  );

  it("declares an ISO lastVerified date for every fixture", () => {
    for (const fixture of STATEMENT_FIXTURES) {
      expect(fixture.lastVerified, fixture.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("explains what a non end-to-end coverage level leaves untested", () => {
    for (const fixture of STATEMENT_FIXTURES) {
      if (fixture.coverage === "end-to-end") continue;
      expect(fixture.coverageNote.length, fixture.id).toBeGreaterThan(40);
    }
  });

  it("never records coverage 'none' for a fixture a test actually reads", () => {
    // Keeps the field honest in both directions.
    for (const fixture of STATEMENT_FIXTURES) {
      if (readersOf(fixture.id).length === 0) continue;
      expect(fixture.coverage, fixture.id).not.toBe("none");
    }
  });
});
