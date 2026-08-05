// Single source of truth for the app name/version in the renderer. The
// package.json is bundled statically at build time — the same version the
// desktop shell reports through getAppInfo() (and the native About dialog).
import pkg from "@/package.json";

export const APP_NAME = pkg.productName ?? pkg.name;
export const APP_VERSION = pkg.version;
