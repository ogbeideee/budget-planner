"use strict";

const {
  app,
  BrowserWindow,
  dialog,
  protocol,
  net,
  ipcMain,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const pkg = require("../package.json");
const { openDatabase } = require("./db.cjs");

const APP_SCHEME = "app";
const APP_HOST = "bundle";
const OUT_DIR = path.join(__dirname, "..", "out");
const DEV_URL = process.env.ELECTRON_DEV_URL || "http://localhost:3000";

let db = null;

function storageChannel(key) {
  return `desktop:storage:${key}`;
}

function registerStorageHandlers() {
  // Synchronous channels: the renderer's storage seam is localStorage-shaped.
  // All handlers are main-process-only SQLite access — the renderer never
  // touches the database. Inputs are validated before touching SQLite.
  ipcMain.on(storageChannel("get"), (event, key) => {
    event.returnValue =
      typeof key === "string" && key.length > 0 ? db.get(key) : null;
  });
  ipcMain.on(storageChannel("set"), (event, key, value) => {
    event.returnValue =
      typeof key === "string" &&
      key.length > 0 &&
      typeof value === "string"
        ? db.set(key, value)
        : false;
  });
  ipcMain.on(storageChannel("remove"), (event, key) => {
    event.returnValue =
      typeof key === "string" && key.length > 0 ? db.remove(key) : false;
  });
  ipcMain.on(storageChannel("keys"), (event, prefix) => {
    event.returnValue =
      typeof prefix === "string" ? db.keys(prefix) : db.keys();
  });
  ipcMain.on(storageChannel("needs-migration"), (event) => {
    event.returnValue = db.info().count === 0;
  });
  ipcMain.on(storageChannel("migrate"), (event, kv) => {
    event.returnValue =
      typeof kv === "object" && kv !== null && !Array.isArray(kv)
        ? db.migrateBrowserData(kv)
        : { migrated: false, backupKey: null };
  });
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

function isSmokeMode() {
  return process.argv.includes("--smoke");
}

function isDevMode() {
  return process.argv.includes("--dev");
}

function serveIndex(url) {
  return net.fetch(pathToFileURL(path.join(OUT_DIR, "index.html")).toString());
}

function handleProtocol(request) {
  const url = new URL(request.url);
  let pathname = decodeURIComponent(url.pathname);

  // Next.js 16 prefetches RSC payloads as "__next.<route>.__PAGE__.txt" but the
  // static export emits them as "__next.<route>.txt" — resolve the marker. The
  // root payload is literally "__next.__PAGE__.txt" and must stay untouched.
  pathname = pathname.replace(/\/(__next\.[^/]+)\.__PAGE__\.txt$/g, "/$1.txt");

  if (pathname === "/") pathname = "/index.html";

  // Client-side routes (/history, /reports, ...) carry no file extension;
  // serve the app shell and let the Next.js router render the route.
  const extension = path.extname(pathname);
  if (extension === "") {
    return serveIndex(url);
  }

  const filePath = path.resolve(OUT_DIR, `.${pathname}`);
  const resolvedOut = path.resolve(OUT_DIR);
  if (filePath !== resolvedOut && !filePath.startsWith(resolvedOut + path.sep)) {
    return new Response("Forbidden", { status: 403 });
  }
  return net
    .fetch(pathToFileURL(filePath).toString())
    .catch(() => {
      if (process.env.ELECTRON_LOG_404S) {
        console.log(`app:// 404: ${url.pathname}`);
      }
      return new Response("Not found", { status: 404 });
    });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 375,
    minHeight: 600,
    show: false,
    autoHideMenuBar: false,
    backgroundColor: "#0d0f14",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  if (!isSmokeMode()) {
    win.once("ready-to-show", () => win.show());
  }

  if (isDevMode()) {
    // Development: load the Next.js dev server. Retry until it answers
    // (first compile can take a few seconds); give up after ~60s.
    let attempts = 0;
    const load = () => win.loadURL(DEV_URL).catch(() => {});
    win.webContents.on("did-fail-load", (_event, code) => {
      if (code === -3) return; // ERR_ABORTED: superseded navigation
      attempts += 1;
      if (attempts > 75) {
        if (!isSmokeMode()) {
          dialog.showErrorBox(
            "Budget Planner",
            `Could not reach the dev server at ${DEV_URL}. Start it with \`npm run dev\`.`,
          );
        }
        app.exit(1);
        return;
      }
      setTimeout(load, 800);
    });
    load();
  } else {
    // Production: serve the static export over the app:// protocol.
    win.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`);
  }
  return win;
}

async function runSmokeTest(win) {
  const rendererErrors = [];
  win.webContents.on("console-message", (params) => {
    const level =
      typeof params.level === "string" ? params.level : String(params.level);
    if (level === "error" || level === "3") {
      rendererErrors.push(params.message);
    }
  });

  const timeout = setTimeout(() => {
    console.error("SMOKE_FAIL: timed out waiting for the app to load");
    app.exit(1);
  }, 30000);

  try {
    await new Promise((resolve, reject) => {
      win.webContents.once("did-finish-load", () => resolve());
      win.webContents.once("did-fail-load", (_e, code, desc) => {
        // In dev mode the main process retries failed loads itself (the dev
        // server may still be compiling); only fail fast in production.
        if (!isDevMode()) {
          reject(new Error(`load failed (${code}) ${desc}`));
        }
      });
    });

    // Give React a moment to hydrate, then exercise client-side routing by
    // clicking the "Timeline" nav link and asserting the router rendered it.
    // Clicks before hydration fall back to a full page load (the protocol
    // serves the app shell for extensionless routes), so keep retrying until
    // the title converges on the Timeline page.
    let title = "";
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      try {
        await win.webContents.executeJavaScript(`
          (() => {
            const link = Array.from(document.querySelectorAll('a'))
              .find((a) => a.getAttribute('href') === '/history');
            if (link) link.click();
            return true;
          })()
        `);
      } catch {
        // navigation in progress; keep polling
      }
      await new Promise((r) => setTimeout(r, 700));
      title = await win.webContents
        .executeJavaScript("document.title")
        .catch(() => "");
      if (title.includes("Timeline")) break;
    }
    if (!title.includes("Timeline")) {
      throw new Error(`router did not navigate: title is "${title}"`);
    }

    const state = await win.webContents.executeJavaScript(`
      (() => ({
        title: document.title,
        bodyText: (document.body.textContent || '').trim().length,
        url: window.location.href,
      }))()
    `);
    if (state.bodyText < 50) {
      throw new Error("app shell rendered no content");
    }

    // The secure preload bridge must be present and answer over IPC.
    const bridge = await win.webContents.executeJavaScript(`
      (() => ({
        exposed: typeof window.budgetPlannerDesktop === 'object',
        callable: typeof window.budgetPlannerDesktop?.getAppInfo === 'function',
      }))()
    `);
    if (!bridge.exposed || !bridge.callable) {
      throw new Error("preload bridge missing from the renderer");
    }
    const info = await win.webContents.executeJavaScript(
      "(async () => await window.budgetPlannerDesktop.getAppInfo())()",
    );
    if (
      !info ||
      typeof info.version !== "string" ||
      typeof info.platform !== "string"
    ) {
      throw new Error("app-info IPC roundtrip failed");
    }

    if (rendererErrors.length > 0) {
      throw new Error(`renderer errors: ${rendererErrors.join(" | ")}`);
    }

    // SQLite persistence: the kv store must answer a full roundtrip through
    // the bridge, and the database file must live in userData.
    const roundtripKey = `smoke:test:${Date.now()}`;
    const writeOk = await win.webContents.executeJavaScript(`
      window.budgetPlannerDesktop.storage.setItem(${JSON.stringify(roundtripKey)}, "smoke")
    `);
    const readBack = await win.webContents.executeJavaScript(`
      window.budgetPlannerDesktop.storage.getItem(${JSON.stringify(roundtripKey)})
    `);
    const removed = await win.webContents.executeJavaScript(`
      (() => {
        const k = ${JSON.stringify(roundtripKey)};
        window.budgetPlannerDesktop.storage.removeItem(k);
        return window.budgetPlannerDesktop.storage.getItem(k);
      })()
    `);
    if (writeOk !== true || readBack !== "smoke" || removed !== null) {
      throw new Error(
        `sqlite storage roundtrip failed (write=${writeOk} read=${JSON.stringify(readBack)} afterRemove=${JSON.stringify(removed)})`,
      );
    }
    const dbInfo = db.info();
    const userData = app.getPath("userData");
    const expectedFile = path.join(userData, "budget-planner.sqlite3");
    if (!fs.existsSync(expectedFile)) {
      throw new Error(`sqlite file missing at ${expectedFile}`);
    }

    clearTimeout(timeout);
    console.log(
      `SMOKE_OK title="${state.title}" url=${state.url} bodyChars=${state.bodyText} bridge=${info.name}@${info.version} sqlite=${dbInfo.file} rows=${dbInfo.count} migrated=${dbInfo.migrated}`,
    );
    app.exit(0);
  } catch (error) {
    clearTimeout(timeout);
    console.error(`SMOKE_FAIL: ${error.message}`);
    app.exit(1);
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.budgetplanner.desktop");

  db = openDatabase(app.getPath("userData"));
  console.log(`[desktop] sqlite: ${db.info().file}`);

  ipcMain.handle("desktop:app-info", () => ({
    name: pkg.productName || pkg.name,
    version: pkg.version,
    platform: process.platform,
    isPackaged: app.isPackaged,
  }));
  registerStorageHandlers();

  if (!isDevMode() && !fs.existsSync(path.join(OUT_DIR, "index.html"))) {
    const message =
      "The app bundle was not found. Run `npm run build` before launching the desktop app.";
    if (isSmokeMode()) {
      console.error(`SMOKE_FAIL: ${message}`);
      app.exit(1);
      return;
    }
    dialog.showErrorBox("Budget Planner", message);
    app.exit(1);
    return;
  }

  protocol.handle(APP_SCHEME, handleProtocol);

  const win = createWindow();
  if (isSmokeMode()) {
    runSmokeTest(win);
  }
});

app.on("will-quit", () => {
  if (db) {
    db.close();
    db = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
