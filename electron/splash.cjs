"use strict";

// Frameless splash window shown while the main window boots (dev-server
// compile or static-bundle load). It is a plain data: URL — no preload, no
// remote content — so it can never touch the app. Skipped entirely in smoke
// mode (see main.cjs) to keep the smoke run deterministic.
const { BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

function iconSvg() {
  // Vector replica of the app icon (scripts/make-icon.mjs art): indigo
  // gradient square, white coin, ascending bars. Keep in sync manually.
  return `
    <svg width="120" height="120" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#5e6ad2"/>
          <stop offset="0.55" stop-color="#4b53b8"/>
          <stop offset="1" stop-color="#333976"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="512" height="512" rx="96" fill="url(#bg)"/>
      <ellipse cx="256" cy="266" rx="152" ry="152" fill="#1c1f40" opacity="0.28"/>
      <circle cx="256" cy="252" r="150" fill="#ffffff"/>
      <circle cx="256" cy="252" r="148" fill="none" stroke="#3d4496" stroke-opacity="0.3" stroke-width="14"/>
      <rect x="170" y="264" width="44" height="66" rx="20" fill="#7c86da"/>
      <rect x="234" y="234" width="44" height="96" rx="20" fill="#5e6ad2"/>
      <rect x="298" y="208" width="44" height="122" rx="20" fill="#4b53b8"/>
    </svg>
  `.trim();
}

function createSplashScreen({ appName, version }) {
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; height: 100%; background: #0d0f14; overflow: hidden; }
  body { user-select: none; -webkit-app-region: drag; font-family: "Segoe UI", system-ui, sans-serif; }
  .wrap { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; }
  .app { color: #e8eaf6; font-size: 20px; font-weight: 600; letter-spacing: 0.2px; }
  .ver { color: #8b93c9; font-size: 12px; }
  .bar { width: 140px; height: 3px; border-radius: 2px; background: #262a4a; overflow: hidden; margin-top: 4px; }
  .fill { height: 100%; width: 40%; border-radius: 2px; background: #5e6ad2; animation: slide 1.2s ease-in-out infinite; }
  @keyframes slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(360%); } }
</style>
</head>
<body>
  <div class="wrap">
    ${iconSvg()}
    <div class="app">${appName}</div>
    <div class="ver">v${version}</div>
    <div class="bar"><div class="fill"></div></div>
  </div>
</body>
</html>`;

  const icon = path.join(__dirname, "..", "build", "icon.png");
  const win = new BrowserWindow({
    width: 380,
    height: 430,
    frame: false,
    resizable: false,
    movable: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#0d0f14",
    icon: fs.existsSync(icon) ? icon : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    { baseURLForDataURL: "app://splash/" },
  );
  win.webContents.on("did-fail-load", (_event, code, description) => {
    console.error(`[splash] load failed (${code}) ${description}`);
  });
  win.once("ready-to-show", () => win.show());
  return win;
}

module.exports = { createSplashScreen };
