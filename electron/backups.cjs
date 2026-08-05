// File-based backup store for the desktop app. Pure fs/path — no Electron
// APIs — so it is unit-testable and the main process only wires it to IPC.
// Backups live in <userData>/backups as budget-planner-backup-<ISO>.json
// files containing the exact stored-state payload ({ state, version }).
"use strict";

const fs = require("fs");
const path = require("path");

const BACKUP_PREFIX = "budget-planner-backup-";
const MAX_FILES = 30;
const MAX_TEXT_BYTES = 16 * 1024 * 1024; // 16 MB read/write cap

function backupsDir(userDataDir) {
  return path.join(userDataDir, "backups");
}

function timestampToken() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function isSafeName(name) {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.startsWith(BACKUP_PREFIX) &&
    name.endsWith(".json") &&
    /^[\w.-]+$/.test(name)
  );
}

function resolveWithin(dir, name) {
  if (!isSafeName(name)) return null;
  const filePath = path.resolve(dir, name);
  const resolvedDir = path.resolve(dir);
  if (filePath !== resolvedDir && !filePath.startsWith(resolvedDir + path.sep)) {
    return null;
  }
  return filePath;
}

// Pure selection logic (unit-tested): newest-first, capped at maxFiles.
function selectRetained(entries, maxFiles) {
  return entries.slice(0, maxFiles);
}

function readBackupFile(filePath) {
  const stats = fs.statSync(filePath);
  if (!stats.isFile() || stats.size > MAX_TEXT_BYTES) return null;
  return fs.readFileSync(filePath, "utf8");
}

// Metadata in the same shape the renderer's backup list expects.
function inspectBackupFile(dir, name) {
  const filePath = resolveWithin(dir, name);
  if (!filePath || !fs.existsSync(filePath)) return null;
  const stats = fs.statSync(filePath);
  const match = name.match(/^budget-planner-backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.json$/);
  const createdAt = match
    ? match[1].replace(
        /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
        "$1T$2:$3:$4.$5Z",
      )
    : stats.mtime.toISOString();
  return {
    name,
    path: filePath,
    createdAt,
    sizeBytes: stats.size,
  };
}

function listBackups(dir) {
  let names = [];
  try {
    names = fs.readdirSync(dir).filter(isSafeName);
  } catch {
    return []; // missing/inaccessible folder = no backups
  }
  const entries = names
    .map((name) => inspectBackupFile(dir, name))
    .filter((entry) => entry !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return entries;
}

function pruneBackups(dir) {
  const retained = selectRetained(listBackups(dir), MAX_FILES);
  const retainedNames = new Set(retained.map((entry) => entry.name));
  for (const name of listBackups(dir)) {
    if (!retainedNames.has(name.name)) {
      try {
        fs.unlinkSync(name.path);
      } catch {
        // best-effort pruning
      }
    }
  }
  return retained.length;
}

// Writes a backup atomically (temp file + rename). Skips the write when the
// newest existing backup already holds the identical payload (dedupe) so
// automatic backups stay cheap and silent. Returns null when nothing changed.
function writeBackup(dir, content) {
  if (typeof content !== "string" || content.length === 0) return null;
  if (Buffer.byteLength(content, "utf8") > MAX_TEXT_BYTES) return null;
  fs.mkdirSync(dir, { recursive: true });
  const latest = listBackups(dir)[0];
  if (latest) {
    const existing = readBackupFile(latest.path);
    if (existing === content) return null;
  }
  const name = `${BACKUP_PREFIX}${timestampToken()}.json`;
  const filePath = path.join(dir, name);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, content, "utf8");
  fs.renameSync(tmpPath, filePath);
  pruneBackups(dir);
  return inspectBackupFile(dir, name);
}

function readBackup(dir, name) {
  const filePath = resolveWithin(dir, name);
  if (!filePath || !fs.existsSync(filePath)) return null;
  return readBackupFile(filePath);
}

function deleteBackup(dir, name) {
  const filePath = resolveWithin(dir, name);
  if (!filePath || !fs.existsSync(filePath)) return false;
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  BACKUP_PREFIX,
  MAX_FILES,
  backupsDir,
  deleteBackup,
  inspectBackupFile,
  listBackups,
  readBackup,
  resolveWithin,
  selectRetained,
  timestampToken,
  writeBackup,
};
