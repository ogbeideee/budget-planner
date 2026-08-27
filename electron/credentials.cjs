// OS-backed credential vault for the email-alert feature (FR-24).
//
// SECURITY MODEL — read before changing anything here:
//
//  1. Secrets are encrypted with Electron's `safeStorage`, which is backed by
//     the OS keychain (DPAPI on Windows, Keychain on macOS, libsecret/kwallet
//     on Linux). The ciphertext is written to <userData>, but the KEY never
//     leaves the OS store, so the file alone is useless on another machine or
//     to another user account.
//
//  2. If the OS cannot provide encryption, this module REFUSES to store the
//     secret. It never falls back to plaintext, base64, or a home-rolled
//     cipher — an unavailable keychain is reported to the user, not worked
//     around. A plaintext fallback would silently defeat the entire point.
//
//  3. The decrypted secret is NEVER returned over IPC. The renderer can store
//     it, ask whether one exists, and delete it — nothing else. Decryption
//     happens only inside the main process, at the moment a connection is
//     opened. A compromised renderer therefore cannot read the password.
//
//  4. `clear()` removes the file outright. There is no soft-delete and no
//     archived copy.
//
// Pure fs/path plus the injected safeStorage, so the logic is unit-testable
// without booting Electron.
"use strict";

const fs = require("fs");
const path = require("path");

/** One file per account slot. Only "email" exists today. */
const VAULT_FILE = "credentials.v1.json";

function vaultPath(userDataDir) {
  return path.join(userDataDir, VAULT_FILE);
}

function readVault(userDataDir) {
  try {
    const raw = fs.readFileSync(vaultPath(userDataDir), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    // Missing or unreadable is simply "no credential stored".
    return {};
  }
}

function writeVault(userDataDir, vault) {
  const file = vaultPath(userDataDir);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(vault), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, file);
  try {
    // Owner read/write only. A no-op on Windows, which relies on the ACLs of
    // the per-user userData directory instead.
    fs.chmodSync(file, 0o600);
  } catch {
    // Not fatal: the ciphertext is useless without the OS key regardless.
  }
}

/**
 * Builds a vault bound to a userData directory and a safeStorage
 * implementation. `safeStorage` is injected so tests can exercise the logic —
 * including the refusal path — without an Electron runtime.
 */
function createCredentialStore(userDataDir, safeStorage) {
  const available = () => {
    try {
      return safeStorage.isEncryptionAvailable() === true;
    } catch {
      return false;
    }
  };

  return {
    /** True when the OS can actually encrypt. The UI must check this BEFORE
     *  collecting a password, so the user is never asked for a secret this
     *  machine cannot protect. */
    isAvailable: available,

    /**
     * Encrypts and stores one secret. Returns a result object rather than
     * throwing, so the caller can show the real reason.
     */
    set(account, secret) {
      if (typeof account !== "string" || account.length === 0) {
        return { ok: false, reason: "invalid-account" };
      }
      if (typeof secret !== "string" || secret.length === 0) {
        return { ok: false, reason: "empty-secret" };
      }
      if (!available()) {
        // Deliberate hard stop — see note 2 at the top of this file.
        return { ok: false, reason: "encryption-unavailable" };
      }
      let ciphertext;
      try {
        ciphertext = safeStorage.encryptString(secret).toString("base64");
      } catch {
        return { ok: false, reason: "encrypt-failed" };
      }
      const vault = readVault(userDataDir);
      vault[account] = { ciphertext, savedAt: new Date().toISOString() };
      try {
        writeVault(userDataDir, vault);
      } catch {
        return { ok: false, reason: "write-failed" };
      }
      return { ok: true };
    },

    /** Whether a secret exists, and when it was stored. NEVER the secret. */
    status(account) {
      const entry = readVault(userDataDir)[account];
      return entry && typeof entry.ciphertext === "string"
        ? { connected: true, savedAt: entry.savedAt ?? null }
        : { connected: false, savedAt: null };
    },

    /**
     * Decrypts a stored secret. MAIN-PROCESS ONLY — the value returned here
     * must never be sent over IPC, logged, or written to disk. It exists so
     * the IMAP client can authenticate, and for nothing else.
     */
    reveal(account) {
      const entry = readVault(userDataDir)[account];
      if (!entry || typeof entry.ciphertext !== "string") return null;
      if (!available()) return null;
      try {
        return safeStorage.decryptString(Buffer.from(entry.ciphertext, "base64"));
      } catch {
        return null;
      }
    },

    /** Removes the secret entirely. Idempotent. */
    clear(account) {
      const vault = readVault(userDataDir);
      if (!(account in vault)) return { ok: true, removed: false };
      delete vault[account];
      try {
        if (Object.keys(vault).length === 0) {
          // No entries left: remove the file rather than leaving an empty one.
          fs.rmSync(vaultPath(userDataDir), { force: true });
        } else {
          writeVault(userDataDir, vault);
        }
      } catch {
        return { ok: false, removed: false };
      }
      return { ok: true, removed: true };
    },
  };
}

module.exports = { createCredentialStore, VAULT_FILE, vaultPath };
