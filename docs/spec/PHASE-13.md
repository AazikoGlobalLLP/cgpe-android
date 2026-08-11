# PHASE 13 — Vendor Leaflet

Session `cgpe-mobile`. Written 2026-08-11, before a line changed, from a full read of
`src/ui/LeafletMap.tsx` (the only Leaflet consumer — imported by `src/app/agent-map.tsx` and
`src/app/agent-track.tsx`, nowhere else) and `node_modules/leaflet@1.9.4/dist/`.

---

## The one-sentence goal

The map's Leaflet library stops being fetched from a CDN at runtime and is bundled into the app,
so the map renders with the network blocked — the supply-chain and offline risk of pulling an
unpinned `unpkg.com/leaflet@1.9.4` script into a WebView, in a field-sales app whose users are on
mobile data by definition, is gone.

## DONE WHEN (from `docs/PHASES.md`'s Phase 13 section)

> The map renders with the network blocked after first load.

**The reading of "renders", locked in D-1 below**, is: Leaflet itself initialises and draws its own
content — the frame, gestures, pins, the route polyline, popups and controls — with zero network.
It is **not** "the background tile imagery appears offline": that imagery is the entire world's map
tiles and cannot be bundled into an APK. See D-1.

---

## 1. What is actually true today — verified, with citations

`LeafletMap.tsx` builds the whole map as one HTML string (`buildHtml`) and hands it to a WebView as
`source={{ html }}` (`:884` pre-fix — an inline document with **no base URL**). That HTML pulls
Leaflet over the network twice:

- `:695` (pre-fix) — `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>`
- `:700` (pre-fix) — `<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onerror="…{type:'error',message:'leaflet'}…">`

**Consequence today:** with the network blocked, the `<script src>` never loads → its `onerror`
posts `{type:'error', message:'leaflet'}` → `onFail()` → the whole component renders the "The map
could not open" `EmptyState`. Nothing draws — not the frame, not the pins, not the route. The map
is dead offline, every time, not just on first ever use.

**The tiles are a separate dependency and were already treated as separately-failable.** Tiles come
from `basemaps.cartocdn.com` (`:394-395`), and the page already reports per-tile load/error back to
RN (`tileReport`, `:469-475`), which raises a distinct, honest banner over a working map:

> "Map tiles could not load — The pins and the route are real. Only the background imagery needs a
> connection." (`:939-943`)

So the code's own architecture already separates "the library failed" (fatal, blank map) from "the
imagery failed" (a banner over a live map). This phase moves the first case from "always fatal
offline" to "never fatal", and leaves the second exactly as it was.

**Leaflet 1.9.4's CSS is self-contained for this app.** `leaflet.css` references
`images/{marker-icon,layers}.png` via `url()`, but those rules only fetch when a default
`L.Icon.Default` marker or a layers control exists. This map uses `L.divIcon` for **every** marker
(`addPin`, `addCluster`, `drawArrows`) and mounts no layers control, so those rules match no element
and request nothing. Verified. Inlining the CSS is therefore fully offline-safe with no image assets.

## 2. Locked decisions

**D-1. "Renders with the network blocked" means the library, not the tiles.** Vendoring the Leaflet
*library* (JS + CSS) is possible and is this phase. Vendoring the *tile imagery* is not: CartoDB /
OSM tiles are the whole world at every zoom, gigabytes, fetched on demand for wherever the user pans
— an APK cannot carry them. The done-when is satisfied by Leaflet running offline (frame, gestures,
pins, route, popups) with the tile layer degrading to the existing "tiles could not load" banner
over a live, interactive, tile-less map. This is the only physically possible reading, and it
matches the phase's title ("Vendor Leaflet") and the Phase 10 handoff's own analysis, which warned
against misreading it as "fully offline satellite/street tiles".

**D-2. The library is inlined as a bundled string, not shipped as an asset file.** The WebView
renders `source={{ html }}` with no base URL, so a `<script src="file://…">` or a relative
`assets/` path cannot resolve on either platform, and enabling `file://` cross-origin access in a
WebView is exactly the kind of blanket permission this phase exists to avoid. The one path that
works identically on iOS and Android, needs no `expo-asset`/`expo-file-system`, and stays
synchronous (no new loading state) is: bundle Leaflet's source as a string module and inline it into
the page as `<style>…</style>` / `<script>…</script>`, next to the app's own already-inlined `relay`
and `script`. This deviates from the phase's predicted `assets/` file — a deliberate, recorded
deviation, the same class as prior phases' compiler-forced file-list changes.

**D-3. Leaflet is added as a `devDependency`, and the bundled module is generated from it.**
`leaflet@1.9.4` is pinned in `package.json` purely as the provenance + regeneration source;
`scripts/vendor-leaflet.mjs` reads `node_modules/leaflet/dist/{leaflet.js,leaflet.css}` and writes
`src/ui/vendor/leaflet-1.9.4.ts` (two `JSON.stringify`-escaped string constants + the version). The
generated file is what ships and is committed; the devDependency is not bundled into the app (Metro
only bundles what `src/` imports, which is the generated module, not `leaflet`). The generator hard-
fails if the installed version is not 1.9.4, so a silent bump cannot masquerade as the reviewed copy.

**D-4. This eliminates the SRI concern rather than adding SRI.** The Phase 10 handoff flagged "no
SRI" on the `unpkg` script. Subresource-Integrity protects a *remote* fetch; once the source is
vendored and inlined there is no remote fetch to protect, which is strictly stronger than an
integrity hash on a live CDN request. No `integrity=` attribute is added because there is nothing
left to add it to.

**D-5. Tiles stay on `basemaps.cartocdn.com`, unchanged.** Per D-1 they cannot be bundled. The
existing tile-health banner is the honest offline behaviour and is untouched. Not vendoring tiles is
a deliberate scope boundary, pinned by a test (§4) so a later edit doesn't read "vendor Leaflet" as
"vendor the map" and delete the tile source alongside the CDN library reference.

**D-6. The fatal `EmptyState` copy is corrected.** It read "The map library and its tiles come over
the network. Check the connection and try again." — now false for the library. With the library
inlined, the `failed` phase is only reachable via a WebView render-process failure
(`onRenderProcessGone` / `onContentProcessDidTerminate` / a pre-`ready` script error), not a fetch.
The copy now says the map view could not start on this device and notes that the map itself no
longer needs a connection, only the imagery does.

## 3. Files

| File | Change |
|---|---|
| `package.json` / `package-lock.json` | add `leaflet@1.9.4` as a devDependency (provenance + regeneration source for D-3) |
| `scripts/vendor-leaflet.mjs` **(new)** | generator: reads the installed leaflet dist, writes the bundled string module; hard-fails off 1.9.4 |
| `src/ui/vendor/leaflet-1.9.4.ts` **(new, generated)** | `LEAFLET_JS` / `LEAFLET_CSS` / `LEAFLET_VERSION` — Leaflet 1.9.4 verbatim as escaped string constants |
| `src/ui/LeafletMap.tsx` | inline the vendored CSS/JS in `buildHtml` instead of the two `unpkg` tags; update the header docstring and the fatal `EmptyState` copy (D-6) |
| `src/ui/__tests__/leaflet-vendor.test.ts` **(new)** | 5 pins: the vendored payload is the real 1.9.4 library and CDN-free; `LeafletMap.tsx` no longer references `unpkg.com`, imports/inlines the vendored module, and still sources tiles from the CDN (D-5) |
| `eslint.config.js` | ignore `src/ui/vendor/*` — generated third-party source, so it can't perturb the 46-error lint baseline |

## 4. Acceptance criteria

1. `npx tsc --noEmit` exits 0 — **met.**
2. `npm test` green — **met: 271 tests / 10 files** (266 baseline + 5 new pins in
   `leaflet-vendor.test.ts`; no existing test touched Leaflet, so none flipped).
3. `npm run lint` stays at the 46-error baseline — **met: `✖ 61 problems (46 errors, 15 warnings)`**,
   byte-identical.
4. `LeafletMap.tsx` contains no `unpkg.com` reference and imports `./vendor/leaflet-1.9.4` — pinned
   by test and verified by grep.
5. The generated page inlines Leaflet's JS and CSS; `</script>` inside the source is escaped so it
   cannot terminate its own tag (leaflet 1.9.4 contains none — verified — but a future bump is
   guarded).
6. **Needs a handset/emulator (device-only, outstanding):** open `agent-map` or `agent-track` once,
   put the device in airplane mode, reopen the screen — Leaflet initialises and draws the frame,
   pins and route with no network, and the "Map tiles could not load" banner appears over that live
   map instead of the fatal "The map could not open" state. This is logically certain from D-1/D-2
   (an inline document with no external requests needs no network for the library) but the empirical
   check — like Phases 1/4/5/7's — requires a device this session cannot drive.

## 5. Deliberately out of scope

- **Offline / cached tile imagery.** Not bundleable (D-1). A future phase could cache tiles seen
  during an online session, or proxy a small bounded region, but that is a separate, larger piece of
  work and is not what "vendor Leaflet" asks for. Library-vendoring is a prerequisite for it anyway.
- **The `leaflet-src.js` (unminified) build, source maps, or a bundler-imported `leaflet` package.**
  A field app ships the minified dist; the generated string module is the shippable artefact.
- **`leaflet.markercluster` / any second CDN payload.** The map already hand-rolls clustering
  precisely so there is no second thing to fetch or fail (`:47-50`); nothing to vendor there.
- **Rewriting the map to a native map SDK** (`react-native-maps` etc.). A far larger change; the
  WebView+Leaflet approach is retained, only its library delivery changed.
