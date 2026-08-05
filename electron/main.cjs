"use strict";

const { app, BrowserWindow, dialog, protocol, net } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const APP_SCHEME = "app";
const APP_HOST = "bundle";
const OUT_DIR = path.join(__dirname, "..", "out");

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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  if (!isSmokeMode()) {
    win.once("ready-to-show", () => win.show());
  }
  win.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`);
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
      win.webContents.once("did-fail-load", (_e, code, desc) =>
        reject(new Error(`load failed (${code}) ${desc}`)),
      );
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
    if (rendererErrors.length > 0) {
      throw new Error(`renderer errors: ${rendererErrors.join(" | ")}`);
    }
    clearTimeout(timeout);
    console.log(
      `SMOKE_OK title="${state.title}" url=${state.url} bodyChars=${state.bodyText}`,
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

  if (!fs.existsSync(path.join(OUT_DIR, "index.html"))) {
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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
