/**
 * Regenerates src/ui/vendor/leaflet-1.9.4.ts from the installed `leaflet` devDependency.
 *
 * WHY THIS EXISTS (Phase 13). LeafletMap.tsx used to pull leaflet.js + leaflet.css from
 * unpkg at runtime, inside a WebView, with no SRI and no offline fallback — in a field-sales
 * app whose users are on mobile data by definition. This script vendors that exact library
 * (pinned via package.json's devDependency) into a bundled string module the map inlines
 * directly into its generated HTML, so Leaflet now loads with the network blocked.
 *
 * WHY A GENERATED STRING MODULE, not an asset file. The WebView renders `source={{ html }}`
 * — an inline document with no base URL — so a `<script src="file://…">` or a relative asset
 * path cannot resolve on either platform. A bundled string that the page inlines as
 * `<script>…</script>` is the one path that works the same on iOS and Android and needs no
 * expo-asset / file:// permissions. JSON.stringify handles every escape (quotes, backslashes,
 * newlines) correctly; U+2028/U+2029 are escaped explicitly because they are legal in JSON but
 * were illegal in a pre-ES2019 JS string literal (LeafletMap.tsx carries the same note).
 *
 * TILES ARE NOT VENDORED, on purpose. This bundles the ~145 KB library only. The map's tile
 * imagery (basemaps.cartocdn.com) is the entire world's tiles and cannot be bundled wholesale;
 * LeafletMap.tsx already degrades honestly when it is unreachable (the "Map tiles could not
 * load" banner). See docs/spec/PHASE-13.md.
 *
 * TO UPDATE LEAFLET: bump `leaflet` in package.json, `npm install`, then
 *   node scripts/vendor-leaflet.mjs
 * and rename the output file + its import in LeafletMap.tsx to the new version.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const version = JSON.parse(
  readFileSync(resolve(root, 'node_modules/leaflet/package.json'), 'utf8'),
).version;

if (version !== '1.9.4') {
  // The output filename and LeafletMap's import both hard-code the version, on purpose:
  // a silent leaflet bump must not masquerade as the reviewed-and-vendored 1.9.4.
  throw new Error(
    `Installed leaflet is ${version}, but this generator writes leaflet-1.9.4.ts. ` +
      `Update the filename + LeafletMap import to match, then re-run.`,
  );
}

const js = readFileSync(resolve(root, 'node_modules/leaflet/dist/leaflet.js'), 'utf8');
const css = readFileSync(resolve(root, 'node_modules/leaflet/dist/leaflet.css'), 'utf8');

/** JSON.stringify + escape the two separators that are valid JSON but invalid JS-literal chars. */
const lit = (s) =>
  JSON.stringify(s).split('\u2028').join('\\u2028').split('\u2029').join('\\u2029');

const out = `/* eslint-disable */
/**
 * GENERATED — DO NOT EDIT. Run \`node scripts/vendor-leaflet.mjs\` to regenerate.
 *
 * Leaflet ${version} — https://leafletjs.com/ (BSD-2-Clause), vendored verbatim from the
 * \`leaflet\` devDependency so LeafletMap can inline it into its WebView HTML and load with the
 * network blocked. See scripts/vendor-leaflet.mjs and docs/spec/PHASE-13.md for the why.
 *
 * The CSS references images/{marker-icon,layers}.png via url(), but LeafletMap uses L.divIcon
 * exclusively and mounts no layers control, so those rules match no element and fetch nothing.
 */

export const LEAFLET_VERSION = '${version}';
export const LEAFLET_JS = ${lit(js)};
export const LEAFLET_CSS = ${lit(css)};
`;

const dir = resolve(root, 'src/ui/vendor');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'leaflet-1.9.4.ts'), out);

console.log(
  `Wrote src/ui/vendor/leaflet-1.9.4.ts — leaflet ${version} ` +
    `(js ${js.length} chars, css ${css.length} chars).`,
);
