# PHASE-51 — Map: satellite-view toggle + show/hide points + event colours

**Owner batch 2026-08-17** ([[owner-backlog-2026-08-17-map-and-app-presence]] #1 + #5). Pure-mobile,
no backend dependency. Sibling break work is **PHASE-52** (blocked on copy + two `[api]` asks).

Session: `cgpe-mobile`. Status: **SPEC LOCKED (owner `go`, 2026-08-18)** → building.

## Scope

Both in-app maps (`agent-map.tsx` "Agent locations" and `agent-track.tsx` "Movement paths") render
through the one shared `src/ui/LeafletMap.tsx`. All three features land in `LeafletMap.tsx`; only the
legend copy touches `agent-map.tsx`. `agent-track.tsx` inherits the controls for free (no change).

## Locked decisions

| # | Decision | Locked value |
|---|----------|--------------|
| 1 | Satellite tile source | **Esri World Imagery** — `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`. No API key. Leaflet substitutes `{x}/{y}/{z}` by name, so the `{z}/{y}/{x}` order is correct. |
| 2 | "Detailed / understand at a glance" | **Hybrid** = imagery **+** a transparent label overlay: `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}` in a dedicated pane (`cgpeLabels`, z-index 350 — above imagery, below the route pane 405). maxZoom 19. |
| 3 | Honest limit | Apple/Google satellite imagery is **not** available without their paid SDK/keys; Esri World Imagery is the best key-free high-res source. A small **"Imagery © Esri"** credit shows only while satellite is active. |
| 4 | Which maps | **Both** (owner-confirmed). |
| 5 | Satellite control | `IconBtn` in the top-right control stack, under the fit button. Icon `globe-outline` (offer satellite) ⇄ `map-outline` (offer street). **Default = street.** Not persisted across screen visits; survives a theme flip within one visit (state lives in the outer `LeafletMap`, above the theme-keyed `MapCanvas`). |
| 6 | Show/hide points control | `IconBtn` below satellite. Icon `eye-outline` (shown) ⇄ `eye-off-outline` (hidden). Hides the **marker layer** (clock-in/out pins, route waypoints, A/B endpoints, clusters). **Route line + direction arrows stay.** Default = shown. |
| 7 | Pin colours (event-typed) | Clock-in pin = **green** (`c.success`), clock-out pin = **red** (`c.danger`). Was `onDuty ? success : primary` / `faint`. Break = **orange** is PHASE-52 (needs the break-location read, B2). |
| 8 | Legend (`agent-map.tsx`) | Two entries: green "Clock-in", red "Clock-out". (On-duty is still legible: a green pin with no red pin = still on duty; the roster below also lists it.) |

## Mechanism (WebView bridge)

`buildHtml` builds three tile layers (`streetLayer` theme-dependent, `satLayer`, `labelLayer`) via a
`mkTiles` helper that wires per-tile health to both base layers. Two new bridge functions:

- `window.__cgpeTiles(sat)` — swaps base layer; resets tile-health counters; adds/removes the label overlay.
- `window.__cgpePoints(show)` — `map.addLayer/removeLayer(markerLayer)`. `rebuild()` keeps repainting into
  the group whether or not it is on the map, so hidden stays hidden across zoom/data changes.

`MapCanvas` renders the 3-button stack and injects `__cgpeTiles`/`__cgpePoints` on the ready handshake and
whenever the outer `satellite`/`pointsShown` state changes (latest-ref pattern, like the existing payload push).

## Acceptance (binary)

- [ ] Both maps show a 3-button top-right stack (fit, satellite, points).
- [ ] Satellite button swaps street ⇄ Esri hybrid (imagery + labels); "Imagery © Esri" shows only in satellite.
- [ ] Points button hides/shows the dots; the route line + arrows remain when hidden.
- [ ] Agent-map clock-in pins are green, clock-out pins are red; legend matches.
- [ ] Theme flip mid-visit keeps the chosen satellite/points state.
- [ ] `tsc` 0 · `npm test` green · no new lint errors.

## Out of scope

- Route on-duty/off-duty colouring (old Phase 42) + per-employee in/out toggle — need the off-duty ambient read.
- Break-orange pins — PHASE-52 / backend B2.
