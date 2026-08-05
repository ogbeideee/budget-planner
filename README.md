# Budget Planner

Offline personal budget planner (Planner, To-Do, Upcoming, Timeline, Reports,
Settings). Next.js 16 (static export) + React 19 + Zustand. Also ships as a
Windows desktop app (Electron + SQLite).

## Browser mode

```bash
npm install
npm run dev          # Next.js dev server → http://localhost:3000
npm run build        # static export to out/
```

Data persists in `localStorage`. See `docs/` for the full specifications.

## Desktop mode (Electron)

`npm run dev` also launches the Electron window against the dev server
(parts: `dev:web`, `dev:electron`; `ELECTRON_DEV_URL` overridable).

```bash
npm run electron     # launch Electron against the built export (run `npm run build` first)
npm run dev          # Next dev server + Electron together
npm run build        # static export to out/
npm run dist         # Windows installer + portable → dist/ (electron-builder)
npm run icon         # regenerate build/icon.ico + build/icon.png
npm run db:check     # verify the better-sqlite3 native module (optional: <path-to-db>)
npm run electron:rebuild  # rebuild native deps for Electron (auto-run on npm install)
```

- Renderer never touches SQLite: persistence flows through the preload bridge
  (`window.budgetPlannerDesktop.storage`) into `electron/db.cjs`
  (`<userData>/budget-planner.sqlite3`). Browser-era data auto-migrates on
  first launch with a pre-migration backup.
- `npm run desktop:smoke` / `npx electron . --smoke` boots the app, exercises
  routing, and asserts the bridge + SQLite roundtrip + native menu + backup
  file roundtrip (also works on the packaged exe).
- Installer is an assisted NSIS setup (install-dir choice, shortcuts,
  uninstall support). Packaging requires the native toolchain (Python +
  MSVC build tools) for better-sqlite3.

### Desktop features

- **Native menu + shortcuts:** File — Import `Ctrl+O`, Export `Ctrl+S`, Back up
  now `Ctrl+B`, Restore latest backup `Ctrl+Shift+B`, Open backup folder
  `Ctrl+Shift+O`, Reveal data folder `Ctrl+Shift+D`, Quit `Ctrl+Q`. Edit
  (clipboard), View (reload/devtools/zoom/full screen), Window, Help (About).
- **Native file dialogs:** Settings → Data → Export/Import JSON use save/open
  dialogs with a destructive-action confirmation on import.
- **Desktop notifications:** backup failures and restore results (Windows
  toasts).
- **Automatic backups:** full state written to `<userData>/backups/` at
  startup, every 30 minutes, and on exit — deduplicated, newest 30 kept.
  Restore from the Settings list, or `Ctrl+Shift+B` for the latest.
- **Folders:** "Open backup folder" / "Reveal data folder" in Settings and the
  File menu; the About card shows the real paths.
- **Splash & loading:** a branded splash window covers startup, replaced by the
  app on first paint; the page shows a skeleton while the bundle hydrates.
- **Version info:** Settings → About shows `v0.1.0` and the Electron/Chromium
  versions; Help → About Budget Planner shows the full native dialog.
- **Auto-update scaffold:** optional. Set the `AUTO_UPDATE_URL` environment
  variable (or add a plain-text `update-feed.txt` in the data folder, env
  wins) to point at a directory of update artifacts. Checks at startup and via
  Help → Check for updates…; downloads automatically and installs on quit.
  Without a feed the scaffold is inert.

All desktop features cross IPC into the main process (`electron/main.cjs`,
`electron/preload.cjs`); the renderer never touches the file system directly.

## Quality gates

`npx tsc --noEmit` · `npm run lint` · `npm run test` (Vitest) · `npm run build`

## Docs

`docs/PROJECT_SPEC.md` (requirements & data model), `docs/ARCHITECTURE.md`,
`docs/UI_UX_SPEC.md`, `docs/ROADMAP.md` (change log). `CHANGELOG.md` lists
per-release notes.
