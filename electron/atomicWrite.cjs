// Atomic text write shared by the main process (exports, backups) and the
// backup store. Pure fs/path — no Electron APIs — so it is unit-testable.
//
// Privacy contract (Prompt 7B): the temporary file (`<target>.tmp`) is
// removed even when the write or the rename FAILS, so a crash mid-write
// never leaves a partial copy of sensitive content behind, and the target
// itself is never half-written (the rename is atomic).
"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Writes `content` to `target` atomically (temp file + rename).
 * Options: `{ mkdir: true }` creates the target's parent directory first.
 * On failure the temp file is best-effort removed and the target is left
 * untouched. Returns `{ ok: true }` or `{ ok: false, error }`.
 */
function atomicWriteText(target, content, opts) {
  if (typeof target !== "string" || target.length === 0) {
    return { ok: false, error: "invalid target" };
  }
  if (typeof content !== "string") {
    return { ok: false, error: "invalid content" };
  }
  const tmpPath = `${target}.tmp`;
  try {
    if (opts && opts.mkdir === true) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
    }
    fs.writeFileSync(tmpPath, content, "utf8");
    fs.renameSync(tmpPath, target);
    return { ok: true };
  } catch (error) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // the temp file never existed or could not be removed — either way
      // the target was not touched by this write
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

module.exports = { atomicWriteText };