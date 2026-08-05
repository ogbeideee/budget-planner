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
  routing, and asserts the bridge + SQLite roundtrip (also works on the
  packaged exe).
- Installer is an assisted NSIS setup (install-dir choice, shortcuts,
  uninstall support). Packaging requires the native toolchain (Python +
  MSVC build tools) for better-sqlite3.

## Quality gates

`npx tsc --noEmit` · `npm run lint` · `npm run test` (Vitest) · `npm run build`

## Docs

`docs/PROJECT_SPEC.md` (requirements & data model), `docs/ARCHITECTURE.md`,
`docs/UI_UX_SPEC.md`, `docs/ROADMAP.md` (change log). `CHANGELOG.md` lists
per-release notes.
