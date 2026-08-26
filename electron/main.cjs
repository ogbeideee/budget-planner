"use strict";

const {
  app,
  BrowserWindow,
  dialog,
  Notification,
  protocol,
  net,
  ipcMain,
  Menu,
  nativeTheme,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const pkg = require("../package.json");
const { openDatabase } = require("./db.cjs");
const backupStore = require("./backups.cjs");
const { atomicWriteText } = require("./atomicWrite.cjs");
const { createSplashScreen } = require("./splash.cjs");
const { initAutoUpdates } = require("./updater.cjs");
const { MENU_ACTIONS, buildApplicationMenu } = require("./menu.cjs");

const APP_SCHEME = "app";
const APP_HOST = "bundle";
const OUT_DIR = path.join(__dirname, "..", "out");
const DEV_URL = process.env.ELECTRON_DEV_URL || "http://localhost:3000";
const MAX_TEXT_BYTES = 16 * 1024 * 1024; // 16 MB cap for fs reads/writes

// Custom title bar (titleBarStyle: "hidden" + titleBarOverlay). The overlay
// keeps native Windows min/max/close controls with OS hover states; the
// renderer paints the bar itself. Colors mirror the --color-surface /
// --color-ink design tokens (light + dark). The window canvas mirrors the
// --color-canvas token so the frame never paints an off-theme color.
const TITLE_BAR_HEIGHT = 44;
const TITLE_BAR_LIGHT = { color: "#ffffff", symbolColor: "#0f172a" };
const TITLE_BAR_DARK = { color: "#1e293b", symbolColor: "#f8fafc" };
const CANVAS_LIGHT = "#f7f8fc";
const CANVAS_DARK = "#0f172a";

let db = null;
let mainWindow = null;
let splashWindow = null;

function showSplash() {
  if (isSmokeMode()) return; // keep the smoke run deterministic (no windows)
  splashWindow = createSplashScreen({
    appName: pkg.productName || pkg.name,
    version: pkg.version,
  });
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

function dismissSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy();
  }
  splashWindow = null;
}

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
    const result =
      typeof kv === "object" && kv !== null && !Array.isArray(kv)
        ? db.migrateBrowserData(kv)
        : { migrated: false, backupKey: null, error: "invalid payload" };
    if (result.error) {
      // Migration failed. The transaction rolled back, the browser data was
      // never touched, and the marker is absent, so nothing was lost and the
      // migration retries on the next launch. Tell the user instead of
      // failing silently (skip the blocking dialog in smoke mode).
      console.error(`[desktop] browser-data migration failed: ${result.error}`);
      if (!isSmokeMode()) {
        dialog.showErrorBox(
          "Budget Planner",
          "Your browser data could not be migrated to the desktop database.\n\n" +
            "Nothing was lost: the migration is atomic, your original browser " +
            "data is still intact, and the app will retry automatically on the " +
            "next launch.",
        );
      }
    }
    event.returnValue = result;
  });
}

// ---- Phase 3: native desktop features (all through IPC) ----

function dataPaths() {
  const userData = app.getPath("userData");
  return {
    userData,
    backupsDir: backupStore.backupsDir(userData),
    dbFile: path.join(userData, "budget-planner.sqlite3"),
  };
}

function windowFor(event) {
  return BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
}

// Resolve the persisted appearance ("light" | "dark" | "system") to a concrete
// "light" | "dark". Best effort: a missing or unreadable state falls back to
// light. Used for the first-paint window canvas and the title-bar overlay.
function resolvedAppearance() {
  try {
    const raw = db.get("budget-planner:state");
    const theme =
      typeof raw === "string" ? JSON.parse(raw)?.state?.settings?.theme : null;
    if (theme === "dark") return "dark";
    if (theme === "light") return "light";
    if (theme === "system") {
      return nativeTheme.shouldUseDarkColors ? "dark" : "light";
    }
  } catch {
    // unreadable state — fall through to light
  }
  return "light";
}

function titleBarOverlayColors() {
  return resolvedAppearance() === "dark" ? TITLE_BAR_DARK : TITLE_BAR_LIGHT;
}

function windowCanvasColor() {
  return resolvedAppearance() === "dark" ? CANVAS_DARK : CANVAS_LIGHT;
}

function isAbsolutePath(target) {
  return typeof target === "string" && path.isAbsolute(target);
}

function safeFilters(filters) {
  return Array.isArray(filters)
    ? filters.filter(
        (filter) =>
          typeof filter === "object" &&
          filter !== null &&
          typeof filter.name === "string" &&
          Array.isArray(filter.extensions) &&
          filter.extensions.every(
            (extension) =>
              typeof extension === "string" && /^[a-z0-9]+$/i.test(extension),
          ),
      )
    : undefined;
}

function registerDesktopHandlers() {
  // Custom title bar: the renderer repaints the overlay colors whenever the
  // resolved theme changes (colors come from the design tokens, hex only).
  ipcMain.on("desktop:window:setTitleBarOverlay", (event, payload) => {
    if (typeof payload !== "object" || payload === null) return;
    const color = typeof payload.color === "string" ? payload.color : null;
    const symbolColor =
      typeof payload.symbolColor === "string" ? payload.symbolColor : null;
    if (
      color === null ||
      symbolColor === null ||
      !/^#[0-9a-fA-F]{6}$/.test(color) ||
      !/^#[0-9a-fA-F]{6}$/.test(symbolColor)
    ) {
      return;
    }
    const win = windowFor(event);
    if (!win) return;
    try {
      win.setTitleBarOverlay({ color, symbolColor, height: TITLE_BAR_HEIGHT });
    } catch {
      // platform without overlay support — colors stay as created
    }
  });

  // Native file dialogs (generic).
  ipcMain.handle("desktop:dialog:open", async (event, options) => {
    const opts = typeof options === "object" && options !== null ? options : {};
    const filters = safeFilters(opts.filters);
    const result = await dialog.showOpenDialog(windowFor(event), {
      title: typeof opts.title === "string" ? opts.title : undefined,
      defaultPath: isAbsolutePath(opts.defaultPath) ? opts.defaultPath : undefined,
      filters,
      properties: Array.isArray(opts.properties)
        ? opts.properties.filter((p) => typeof p === "string")
        : ["openFile"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePaths[0] };
  });

  ipcMain.handle("desktop:dialog:save", async (event, options) => {
    const opts = typeof options === "object" && options !== null ? options : {};
    let defaultPath;
    if (typeof opts.defaultName === "string" && opts.defaultName.length > 0) {
      // Only the basename travels across IPC; the dialog is bound to a folder.
      defaultPath = path.join(
        app.getPath("documents"),
        path.basename(opts.defaultName),
      );
    }
    const result = await dialog.showSaveDialog(windowFor(event), {
      title: typeof opts.title === "string" ? opts.title : undefined,
      defaultPath,
      filters: safeFilters(opts.filters) ?? [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePath };
  });

  // File reads/writes. Restricted: absolute paths only, .json-only writes,
  // 16 MB size cap. Never expose a generic fs module to the renderer.
  // Writes are atomic (temp file + rename); the temp file is removed even
  // when the write fails (Prompt 7B — no partial sensitive content).
  ipcMain.handle("desktop:fs:writeText", (event, payload) => {
    const { target, content } =
      typeof payload === "object" && payload !== null ? payload : {};
    if (
      !isAbsolutePath(target) ||
      !target.toLowerCase().endsWith(".json") ||
      typeof content !== "string" ||
      Buffer.byteLength(content, "utf8") > MAX_TEXT_BYTES
    ) {
      return { ok: false, error: "invalid target or content" };
    }
    return atomicWriteText(target, content, { mkdir: true });
  });

  ipcMain.handle("desktop:fs:readText", (event, payload) => {
    const { target } = typeof payload === "object" && payload !== null ? payload : {};
    if (!isAbsolutePath(target)) {
      return { ok: false, error: "invalid target" };
    }
    try {
      const stats = fs.statSync(target);
      if (!stats.isFile() || stats.size > MAX_TEXT_BYTES) {
        return { ok: false, error: "file too large or not a file" };
      }
      return { ok: true, content: fs.readFileSync(target, "utf8") };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Folder actions.
  ipcMain.handle("desktop:shell:openPath", async (event, target) => {
    if (!isAbsolutePath(target)) return { ok: false, error: "invalid path" };
    const result = await shell.openPath(target);
    return result === "" ? { ok: true } : { ok: false, error: result };
  });

  ipcMain.handle("desktop:shell:showItemInFolder", (event, target) => {
    if (!isAbsolutePath(target)) return { ok: false, error: "invalid path" };
    shell.showItemInFolder(target);
    return { ok: true };
  });

  // Desktop notifications (Windows toast). AUMID is set at startup, so
  // packaged toasts have an identity; isSupported() guards the rest.
  ipcMain.handle("desktop:notify", (event, payload) => {
    const { title, body, silent } =
      typeof payload === "object" && payload !== null ? payload : {};
    if (!Notification.isSupported()) {
      return { ok: false, error: "notifications not supported" };
    }
    if (typeof title !== "string" || title.length === 0) {
      return { ok: false, error: "invalid notification" };
    }
    new Notification({
      title,
      body: typeof body === "string" && body.length > 0 ? body : undefined,
      silent: silent === true,
    }).show();
    return { ok: true };
  });

  // Read-only paths for the About/Data UI.
  ipcMain.handle("desktop:paths", () => dataPaths());

  // File-based backups. create is synchronous so the renderer can flush the
  // final backup during beforeunload (small state payloads, mirrors the
  // storage channels); the rest are async.
  ipcMain.on("desktop:backup:create", (event, content) => {
    if (
      typeof content !== "string" ||
      content.length === 0 ||
      Buffer.byteLength(content, "utf8") > MAX_TEXT_BYTES
    ) {
      event.returnValue = { error: "invalid payload" };
      return;
    }
    try {
      const entry = backupStore.writeBackup(dataPaths().backupsDir, content);
      event.returnValue = entry;
    } catch (error) {
      event.returnValue = {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("desktop:backup:list", () =>
    backupStore.listBackups(dataPaths().backupsDir),
  );

  ipcMain.handle("desktop:backup:read", (event, payload) => {
    const { name } = typeof payload === "object" && payload !== null ? payload : {};
    const content = backupStore.readBackup(dataPaths().backupsDir, name);
    if (content === null) return { ok: false, error: "backup not found" };
    return { ok: true, content };
  });

  ipcMain.handle("desktop:backup:delete", (event, payload) => {
    const { name } = typeof payload === "object" && payload !== null ? payload : {};
    return { ok: backupStore.deleteBackup(dataPaths().backupsDir, name) };
  });

  // Composite import: native open dialog -> destructive-confirmation dialog
  // -> read. The renderer only receives the content (or a cancellation).
  ipcMain.handle("desktop:import", async (event) => {
    const win = windowFor(event);
    const opened = await dialog.showOpenDialog(win, {
      title: "Import data",
      filters: [{ name: "Budget Planner data", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (opened.canceled || opened.filePaths.length === 0) {
      return { canceled: true };
    }
    const target = opened.filePaths[0];
    const confirmed = await dialog.showMessageBox(win, {
      type: "warning",
      title: "Import data",
      message: "Importing replaces all of your current data.",
      detail: "This cannot be undone. Continue?",
      buttons: ["Cancel", "Import"],
      defaultId: 1,
      cancelId: 0,
    });
    if (confirmed.response !== 1) return { canceled: true };
    try {
      const stats = fs.statSync(target);
      if (!stats.isFile() || stats.size > MAX_TEXT_BYTES) {
        return { ok: false, error: "file too large or not a file" };
      }
      return {
        ok: true,
        content: fs.readFileSync(target, "utf8"),
        fileName: path.basename(target),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Composite export: renderer supplies the JSON, main shows the native save
  // dialog and writes it atomically.
  ipcMain.handle("desktop:export", async (event, payload) => {
    const { content, defaultName } =
      typeof payload === "object" && payload !== null ? payload : {};
    if (
      typeof content !== "string" ||
      content.length === 0 ||
      Buffer.byteLength(content, "utf8") > MAX_TEXT_BYTES
    ) {
      return { ok: false, error: "invalid export payload" };
    }
    const win = windowFor(event);
    const saved = await dialog.showSaveDialog(win, {
      title: "Export data",
      defaultPath:
        typeof defaultName === "string" && defaultName.length > 0
          ? path.join(app.getPath("documents"), path.basename(defaultName))
          : undefined,
      filters: [{ name: "Budget Planner data", extensions: ["json"] }],
    });
    if (saved.canceled || !saved.filePath) return { canceled: true };
    const written = atomicWriteText(saved.filePath, content);
    return written.ok
      ? { ok: true, filePath: saved.filePath }
      : { ok: false, error: written.error };
  });

  // Composite restore: main picks the newest file backup, confirms, reads it.
  ipcMain.handle("desktop:backup:restoreLatest", async (event) => {
    const dir = dataPaths().backupsDir;
    const latest = backupStore.listBackups(dir)[0];
    if (!latest) return { ok: false, error: "no backups yet" };
    const win = windowFor(event);
    const confirmed = await dialog.showMessageBox(win, {
      type: "warning",
      title: "Restore latest backup",
      message: `Restore the backup from ${latest.createdAt}?`,
      detail: "Restoring replaces everything currently in the app. The backup file is kept.",
      buttons: ["Cancel", "Restore"],
      defaultId: 1,
      cancelId: 0,
    });
    if (confirmed.response !== 1) return { canceled: true };
    const content = backupStore.readBackup(dir, latest.name);
    if (content === null) return { ok: false, error: "backup could not be read" };
    return { ok: true, content };
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
  // static export emits them as nested directories: "__next.<route>/__PAGE__.txt".
  // The root payload is literally "__next.__PAGE__.txt" and must stay untouched.
  pathname = pathname.replace(/\/(__next\.[^/]+)\.__PAGE__\.txt$/g, "/$1/__PAGE__.txt");

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
  const windowIcon = path.join(__dirname, "..", "build", "icon.png");
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 375,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: { ...titleBarOverlayColors(), height: TITLE_BAR_HEIGHT },
    backgroundColor: windowCanvasColor(),
    icon: fs.existsSync(windowIcon) ? windowIcon : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  if (!isSmokeMode()) {
    win.once("ready-to-show", () => {
      dismissSplash();
      win.show();
    });
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

    // The custom title bar must be painted by the renderer at the top of the
    // window, exactly TITLE_BAR_HEIGHT tall, with the app branding.
    const titlebar = await win.webContents.executeJavaScript(`
      (() => {
        const el = document.querySelector('[data-titlebar]');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          text: (el.textContent || '').trim(),
          top: Math.round(rect.top),
          height: Math.round(rect.height),
        };
      })()
    `);
    if (
      !titlebar ||
      !titlebar.text.includes("Budget Planner") ||
      titlebar.top !== 0 ||
      titlebar.height !== TITLE_BAR_HEIGHT
    ) {
      throw new Error(`custom title bar missing: ${JSON.stringify(titlebar)}`);
    }

    // App-painted overlay scrollbars: a 6 px rounded thumb that is transparent
    // at rest and visible while scrolling (html[data-scrolling] is toggled by
    // lib/overlayScrollbars.ts on scroll events; the CSS paints the thumb).
    const scrollbarStyle = await win.webContents.executeJavaScript(`
      (() => {
        const root = document.documentElement;
        const width = getComputedStyle(root, '::-webkit-scrollbar').width;
        const rest = getComputedStyle(root, '::-webkit-scrollbar-thumb').backgroundColor;
        root.dataset.scrolling = 'on';
        const active = getComputedStyle(root, '::-webkit-scrollbar-thumb').backgroundColor;
        delete root.dataset.scrolling;
        return { width, rest, active };
      })()
    `);
    const isTransparent = (color) =>
      color === "transparent" || color === "rgba(0, 0, 0, 0)";
    if (
      scrollbarStyle.width !== "6px" ||
      !isTransparent(scrollbarStyle.rest) ||
      isTransparent(scrollbarStyle.active)
    ) {
      throw new Error(
        `overlay scrollbars not applied: ${JSON.stringify(scrollbarStyle)}`,
      );
    }

    // Theme switching must be instantaneous and simultaneous across every
    // container. The page canvas is body's background (html carries none), so
    // a background-color transition on body would make the canvas lag a beat
    // behind the instantly-switching surfaces and paint a visible strip of the
    // old theme at their boundaries. Assert there is no theme crossfade.
    const bodyTransition = await win.webContents.executeJavaScript(`
      (() => {
        const s = getComputedStyle(document.body);
        return {
          duration: s.transitionDuration,
          property: s.transitionProperty,
        };
      })()
    `);
    if (
      bodyTransition.duration !== "0s" ||
      bodyTransition.property === "background-color"
    ) {
      throw new Error(
        `body theme transition must be removed: ${JSON.stringify(bodyTransition)}`,
      );
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

    // Phase 3: the native menu must be installed with the expected top-level
    // groups and accelerators.
    const menu = Menu.getApplicationMenu();
    const menuLabels = menu ? menu.items.map((item) => item.label) : [];
    for (const label of ["File", "Edit", "View", "Window", "Help"]) {
      if (!menuLabels.includes(label)) {
        throw new Error(`native menu missing "${label}" group`);
      }
    }
    const fileSubmenu = menu.items.find((item) => item.label === "File").submenu;
    const accelerators = fileSubmenu.items
      .map((item) => `${item.label ?? ""}:${item.accelerator ?? ""}`)
      .join("|");
    for (const needle of ["Import data…:CmdOrCtrl+O", "Export data…:CmdOrCtrl+S"]) {
      if (!accelerators.includes(needle)) {
        throw new Error(`native menu missing accelerator for ${needle}`);
      }
    }
    if (win.isMenuBarVisible()) {
      throw new Error("menu bar must be hidden on launch (autoHideMenuBar)");
    }

    // Phase 3: the renderer bridge must expose the desktop feature surface.
    const surface = await win.webContents.executeJavaScript(`
      (() => ({
        dialog: typeof window.budgetPlannerDesktop?.dialog?.open === 'function'
          && typeof window.budgetPlannerDesktop?.dialog?.save === 'function',
        fs: typeof window.budgetPlannerDesktop?.fs?.writeText === 'function'
          && typeof window.budgetPlannerDesktop?.fs?.readText === 'function',
        shell: typeof window.budgetPlannerDesktop?.shell?.openPath === 'function'
          && typeof window.budgetPlannerDesktop?.shell?.showItemInFolder === 'function',
        notify: typeof window.budgetPlannerDesktop?.notify === 'function',
        paths: typeof window.budgetPlannerDesktop?.paths === 'function',
        backups: typeof window.budgetPlannerDesktop?.backups?.list === 'function'
          && typeof window.budgetPlannerDesktop?.backups?.create === 'function'
          && typeof window.budgetPlannerDesktop?.backups?.read === 'function'
          && typeof window.budgetPlannerDesktop?.backups?.delete === 'function',
        menu: typeof window.budgetPlannerDesktop?.menu?.on === 'function',
        window: typeof window.budgetPlannerDesktop?.window?.setTitleBarOverlay === 'function',
      }))()
    `);
    for (const key of ["dialog", "fs", "shell", "notify", "paths", "backups", "menu", "window"]) {
      if (surface[key] !== true) {
        throw new Error(`bridge surface missing: ${key}`);
      }
    }

    // The title-bar overlay IPC must accept the app's own design-token colors
    // (tokens may be compressed shorthand like "#fff"; normalize to 6-digit).
    const overlay = await win.webContents.executeJavaScript(`
      (() => {
        const styles = getComputedStyle(document.documentElement);
        const expand = (v) => {
          let hex = (v || '').trim();
          if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
            hex = '#' + hex.slice(1).split('').map((c) => c + c).join('');
          }
          return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null;
        };
        const color = expand(styles.getPropertyValue('--color-surface')) || '#ffffff';
        const symbolColor = expand(styles.getPropertyValue('--color-ink')) || '#0f172a';
        window.budgetPlannerDesktop.window.setTitleBarOverlay({ color, symbolColor });
        return { color, symbolColor };
      })()
    `);
    if (
      !overlay ||
      !/^#[0-9a-fA-F]{6}$/.test(overlay.color) ||
      !/^#[0-9a-fA-F]{6}$/.test(overlay.symbolColor)
    ) {
      throw new Error(`title-bar overlay IPC rejected tokens: ${JSON.stringify(overlay)}`);
    }

    // Phase 3: file-based backup roundtrip through the bridge (create -> list
    // -> read -> delete) against the real backups folder, cleaned up after.
    const backupContent = JSON.stringify({
      smoke: true,
      at: new Date().toISOString(),
    });
    const created = await win.webContents.executeJavaScript(`
      window.budgetPlannerDesktop.backups.create(${JSON.stringify(backupContent)})
    `);
    if (!created || typeof created.name !== "string") {
      throw new Error(`backup create failed: ${JSON.stringify(created)}`);
    }
    const listed = await win.webContents.executeJavaScript(`
      window.budgetPlannerDesktop.backups.list()
    `);
    if (!Array.isArray(listed) || !listed.some((b) => b.name === created.name)) {
      throw new Error("backup list did not include the created file");
    }
    const backupRead = await win.webContents.executeJavaScript(`
      window.budgetPlannerDesktop.backups.read(${JSON.stringify({ name: created.name })})
    `);
    if (!backupRead.ok || backupRead.content !== backupContent) {
      throw new Error(`backup read mismatch: ${JSON.stringify(backupRead)}`);
    }
    const deleted = await win.webContents.executeJavaScript(`
      window.budgetPlannerDesktop.backups.delete(${JSON.stringify({ name: created.name })})
    `);
    if (!deleted.ok) {
      throw new Error("backup delete failed");
    }

    clearTimeout(timeout);
    console.log(
      `SMOKE_OK title="${state.title}" url=${state.url} bodyChars=${state.bodyText} bridge=${info.name}@${info.version} sqlite=${dbInfo.file} rows=${dbInfo.count} migrated=${dbInfo.migrated} menu=${menuLabels.join("/")}`,
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

  // SQLite is embedded (better-sqlite3, unpacked by electron-builder), so a
  // fresh Windows install needs no separate database. Opening it can still
  // fail (locked file, disk error, unwritable userData) — fail loudly with a
  // dialog instead of running a broken app whose storage IPC handlers crash.
  try {
    db = openDatabase(app.getPath("userData"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (isSmokeMode()) {
      console.error(`SMOKE_FAIL: sqlite open failed: ${detail}`);
      app.exit(1);
      return;
    }
    dialog.showErrorBox(
      "Budget Planner",
      "The app database could not be opened. Your data is safe — it lives " +
        "in this database and will be available again once the problem is " +
        "fixed.\n\n" +
        detail,
    );
    app.exit(1);
    return;
  }
  console.log(`[desktop] sqlite: ${db.info().file}`);

  ipcMain.handle("desktop:app-info", () => ({
    name: pkg.productName || pkg.name,
    version: pkg.version,
    platform: process.platform,
    isPackaged: app.isPackaged,
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    },
  }));
  registerStorageHandlers();
  registerDesktopHandlers();

  buildApplicationMenu({
    getFocusedWindow: () => BrowserWindow.getFocusedWindow() ?? mainWindow,
    getBackupsDir: () => dataPaths().backupsDir,
    getDataDir: () => dataPaths().userData,
  });

  const updateStatus = initAutoUpdates();
  console.log(
    `[updater] ${updateStatus.supported ? `watching feed ${updateStatus.feed}` : `scaffold inactive (${updateStatus.reason})`}`,
  );

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

  showSplash();
  const win = createWindow();
  if (isSmokeMode()) {
    runSmokeTest(win);
  }
});

app.on("before-quit", () => {
  dismissSplash();
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
