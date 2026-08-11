# HANDOFF — CGPE Connect (Android) — Phase 13 — 2026-08-11

One commit on `Shivam`: `c9e4c37` (code + generated vendor module + spec + docs).
**The branch is NOT pushed — `git push origin Shivam` still 403s**, re-tested this session:
`Permission to Dev-Shivam-05/CGPE-ANDROID-APPLICATION.git denied to reactjsaaziko`. Unchanged for
several sessions; needs a human to grant write access or swap the credential in Windows Credential
Manager. The remote was NOT changed and history was NOT rewritten.
Thirteen phases now sit locally (12 done + Phase 1 code-complete-but-device-unverified).
Gates: `npx tsc --noEmit` exit 0 · `npm test` **271 passed / 10 files** · `npm run lint` 46 errors
(byte-identical to baseline).

## Done

- **The staff map screens (`agent-map`, `agent-track`) now load the map library with no network.**
  Before this, `LeafletMap.tsx` fetched `leaflet.js` + `leaflet.css` from `unpkg.com` at runtime
  inside the WebView (no SRI), so a blocked connection failed the `<script src>`, fired the map's
  `onerror`, and rendered the fatal "The map could not open" state — nothing drew. Leaflet 1.9.4 is
  now vendored and inlined into the page, so the map frame, gestures, pins, route polyline, popups
  and controls all draw offline. The map no longer trusts an unpinned CDN script.
- **Tile imagery is still a network dependency, on purpose, and degrades honestly.** The world's
  map tiles can't be bundled into an APK; when they can't load, the existing "Map tiles could not
  load — the pins and the route are real, only the background imagery needs a connection" banner
  shows over a live, interactive, tile-less map (instead of the old fatal blank).

## Files changed

- `src/ui/LeafletMap.tsx` — `buildHtml` inlines the vendored CSS/JS instead of the two `unpkg`
  tags; header docstring rewritten (the "fetched from a CDN, APK does not grow" claim was now
  false); fatal `EmptyState` copy corrected (it blamed the network for a library that is now bundled).
- `src/ui/vendor/leaflet-1.9.4.ts` **(new, generated)** — Leaflet 1.9.4 dist JS+CSS as escaped
  string constants (`LEAFLET_JS`/`LEAFLET_CSS`/`LEAFLET_VERSION`). ~145 KB; eslint-ignored.
- `scripts/vendor-leaflet.mjs` **(new)** — regenerates the above from the `leaflet` devDependency;
  hard-fails if the installed version isn't 1.9.4 so a silent bump can't masquerade as the vendored copy.
- `package.json` / `package-lock.json` — `leaflet@1.9.4` added as a **devDependency** (provenance +
  regeneration source only; the app bundles the generated module, not the package).
- `src/ui/__tests__/leaflet-vendor.test.ts` **(new)** — 5 pins: vendored payload is the real,
  CDN-free 1.9.4 library; `LeafletMap.tsx` no longer references `unpkg.com`, imports/inlines the
  vendored module, and still sources tiles from the CDN (tiles are deliberately not vendored).
- `eslint.config.js` — ignore `src/ui/vendor/*` (generated third-party source), keeping lint at 46.
- `docs/spec/PHASE-13.md` **(new)**, `docs/DECISIONS.md`, `docs/PHASES.md` — spec, decision, board.

## Decisions made

- **"Renders with the network blocked" means the library, not the tiles.** Vendoring the tile
  imagery is physically impossible (the whole world's tiles); the phase's title is "Vendor Leaflet"
  and the Phase 10 handoff explicitly warned against the tile-misreading. So the done-when is met by
  Leaflet running offline while tiles degrade to their existing banner. `docs/spec/PHASE-13.md` D-1.
- **The library is inlined as a bundled string, not shipped as an `assets/` file** (the file the
  phase text predicted). The WebView renders `source={{ html }}` with no base URL, so a
  `file://`/relative asset can't resolve on either platform, and enabling file-origin access is
  exactly the permission this phase avoids. Inlining also removes the "no SRI" risk entirely — no
  remote fetch left to protect. D-2/D-4.
- **Leaflet is a devDependency + a generator, not a hand-pasted blob.** Provenance is pinned and the
  vendored file is reproducible via `node scripts/vendor-leaflet.mjs`. D-3.

## Known broken / deliberately skipped

- **The branch is not pushed — 403, re-confirmed this session.** Needs a human (write access or a
  credential swap). Do NOT change the remote URL, rewrite history, or re-clone to work around it.
- **The offline-render acceptance check is device-only and outstanding.** Opening a map screen once,
  going airplane-mode, and reopening it to watch Leaflet draw with only the tiles-banner over it is
  logically certain from the inlining but needs a handset/emulator this session can't drive. Same
  class as Phases 1/4/5/7's carried device checks. `docs/spec/PHASE-13.md` §4.6.
- **Offline/cached tile imagery was not built** — deliberate, not bundleable. A future phase could
  cache tiles seen while online; library-vendoring is a prerequisite for it. Spec §5.
- **Everything carried from Phases 1, 4, 5, 7, 10's handset-only criteria remains unverified** — no
  device work happened this session (haptics, AsyncStorage clock key, background GPS, a shift's route
  under the master replay, airplane-mode behaviour, and now the offline map render).
- **`src/screens/dashboards.tsx:292-297` still shows all-zero Master KPI tiles on a partial outage**
  — still in no phase's file list. Carried since Phase 3.
- **`addTask`, `reassignTask`, `toggleReminder`, `toggleTaskStep`, `toggleClaimDoc` still fabricate
  success** — Phase 9, blocked on `cgpe-api`.

## Next session starts here

- **Phase 14 is next per `docs/PHASES.md`'s "Next 3"** — dead-code sweep. Remove `ui/kit.tsx`,
  `ui/characters.tsx`, `hooks/use-theme.ts`, `hooks/use-color-scheme*.ts`, `constants/theme.ts`,
  `src/global.css`, and the orphaned helpers in `data/tasks.ts` / `data/team.ts`.
  **Done when:** `npx tsc --noEmit` is still clean and nothing imports the removed modules.
- First command: `npm test`.
- Watch out for: **grep every file's importers before deleting it, and watch for load-bearing
  side-effect imports.** `_layout.tsx:18`'s bare `import '@/lib/tracker'` registers background GPS at
  module scope and is load-bearing despite looking unused (CLAUDE.md danger zone) — the "dead" list
  can contain the same shape. Also: the **first `npm test` run after a cold start spuriously failed
  all 9 files** this session with `Cannot read properties of undefined (reading 'config')`, then
  passed byte-for-byte on an immediate re-run — treat a whole-suite import failure as a flake and
  re-run once before diagnosing. And **do NOT flag `src/ui/vendor/leaflet-1.9.4.ts` as dead** — it is
  imported by `LeafletMap.tsx`; it only looks orphaned because eslint ignores it. As always: re-read
  `../contracts/INBOX.md` fresh at boot; nothing is currently open against this session.
