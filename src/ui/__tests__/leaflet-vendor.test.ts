import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LEAFLET_CSS, LEAFLET_JS, LEAFLET_VERSION } from '@/ui/vendor/leaflet-1.9.4';

/**
 * PHASE 13 — vendor Leaflet.
 *
 * LeafletMap.tsx used to pull leaflet.js + leaflet.css from unpkg at runtime, so the map died
 * with the network blocked and trusted an unpinned CDN script. The library is now bundled and
 * inlined. These are the only automated pins the change admits: buildHtml itself can't be
 * exercised without a react-native-webview stub (the module imports WebView), so the two things
 * that actually matter — "the real library is vendored" and "no CDN library reference remains in
 * the component" — are asserted directly against the vendored strings and the source file.
 *
 * The tile IMAGERY is deliberately NOT vendored (the world's tiles can't be bundled); the last
 * case pins that so a future edit doesn't read "vendor Leaflet" as "vendor the map" and rip out
 * the tile source that is supposed to stay a network dependency.
 */

const leafletMapSrc = readFileSync(
  fileURLToPath(new URL('../LeafletMap.tsx', import.meta.url)),
  'utf8',
);

describe('vendored Leaflet payload', () => {
  it('is the pinned, real 1.9.4 library, not a stub', () => {
    expect(LEAFLET_VERSION).toBe('1.9.4');
    // The @preserve banner is part of the verbatim dist source — a truncated or hand-written
    // placeholder would not carry it.
    expect(LEAFLET_JS).toContain('Leaflet 1.9.4');
    expect(LEAFLET_JS.length).toBeGreaterThan(100_000);
    expect(LEAFLET_CSS).toContain('.leaflet-container');
    expect(LEAFLET_CSS.length).toBeGreaterThan(10_000);
  });

  it('carries no CDN reference of its own', () => {
    expect(LEAFLET_JS).not.toContain('unpkg');
    expect(LEAFLET_CSS).not.toContain('unpkg');
  });
});

describe('LeafletMap inlines the vendored library', () => {
  it('no longer references the unpkg CDN', () => {
    // The whole point of the phase: the library must not be fetched at runtime.
    expect(leafletMapSrc).not.toContain('unpkg.com');
  });

  it('imports and inlines the vendored JS and CSS', () => {
    expect(leafletMapSrc).toContain("from './vendor/leaflet-1.9.4'");
    expect(leafletMapSrc).toContain('LEAFLET_JS');
    expect(leafletMapSrc).toContain('LEAFLET_CSS');
  });

  it('still sources tile imagery from the CDN — tiles are not vendored, on purpose', () => {
    // "Vendor Leaflet" is the library only. Tiles stay a network dependency (with a graceful
    // offline banner); this guards against a later edit deleting that alongside the CDN library.
    expect(leafletMapSrc).toContain('basemaps.cartocdn.com');
  });
});
