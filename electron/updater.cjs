"use strict";

// Auto-update scaffold (Phase 4). Design:
// - No provider is hard-wired. A generic feed is configured through the
//   AUTO_UPDATE_URL environment variable or a plain-text file
//   <userData>/update-feed.txt (env wins). Without a feed the module is a
//   no-op, so this never fires in development or in builds without a feed.
// - Only runs in the packaged app; in dev the scaffold reports that.
// - Updates: check on startup (background) + on demand from Help > Check for
//   updates…. Downloads are automatic; the app installs on quit.
// - All user feedback goes through system notifications; errors are logged.
const { app, Notification } = require("electron");
const fs = require("fs");
const path = require("path");

const FEED_ENV = "AUTO_UPDATE_URL";
const FEED_FILE = "update-feed.txt";

function notify(title, body) {
  if (!Notification.isSupported()) return;
  new Notification({ title, body }).show();
}

function feedUrl() {
  if (process.env[FEED_ENV]) return process.env[FEED_ENV];
  try {
    const file = path.join(app.getPath("userData"), FEED_FILE);
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf8").trim();
      if (content) return content;
    }
  } catch (error) {
    console.error(`[updater] could not read update feed file: ${error.message}`);
  }
  return null;
}

let autoUpdater = null;
function loadAutoUpdater() {
  if (!autoUpdater) {
    autoUpdater = require("electron-updater").autoUpdater;
  }
  return autoUpdater;
}

function isEnabled() {
  return app.isPackaged && Boolean(feedUrl());
}

function wireEvents() {
  const updater = loadAutoUpdater();
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.setFeedURL({ provider: "generic", url: feedUrl() });
  updater.on("update-available", (info) => {
    const version = info && info.version ? `v${info.version}` : "a new version";
    notify(`Update available (${version})`, "It will download in the background and install when you quit.");
  });
  updater.on("update-not-available", () => {
    notify("No updates", "Budget Planner is up to date.");
  });
  updater.on("update-downloaded", (info) => {
    const version = info && info.version ? `v${info.version}` : "the new version";
    notify(`Update ready (${version})`, "Restart Budget Planner to install it.");
  });
  updater.on("error", (error) => {
    console.error(`[updater] ${error && error.message ? error.message : error}`);
    notify("Update check failed", "The app could not reach the update feed.");
  });
}

function initAutoUpdates() {
  if (!app.isPackaged) return { supported: false, reason: "dev-build" };
  const url = feedUrl();
  if (!url) return { supported: false, reason: "no-feed" };
  wireEvents();
  loadAutoUpdater()
    .checkForUpdates()
    .catch((error) => {
      console.error(`[updater] background check failed: ${error && error.message ? error.message : error}`);
    });
  return { supported: true, feed: url };
}

function checkForUpdatesNow() {
  if (!app.isPackaged) {
    notify("Updates", "Automatic updates are only checked in the packaged app.");
    return;
  }
  if (!feedUrl()) {
    notify("Updates", "No update feed is configured. Set the AUTO_UPDATE_URL environment variable or add a file named update-feed.txt in the data folder.");
    return;
  }
  wireEvents();
  loadAutoUpdater()
    .checkForUpdates()
    .catch((error) => {
      console.error(`[updater] manual check failed: ${error && error.message ? error.message : error}`);
    });
}

function feedDescription() {
  const url = feedUrl();
  return url ? `configured (${url})` : "not configured";
}

module.exports = { checkForUpdatesNow, feedDescription, initAutoUpdates };
