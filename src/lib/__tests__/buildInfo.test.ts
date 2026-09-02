import { describe, it, expect } from 'vitest';
import { formatBuild, formatVersionLine, shortUpdateId } from '@/lib/buildInfo';

/**
 * The pure half of `buildInfo`. The native read cannot be tested (a lazy `require` resolves through
 * Node, not Vite — Phase 86), so the DECISION is what lives here and what is pinned.
 */
describe('formatBuild', () => {
  it('appends the build number when there is one', () => {
    expect(formatBuild('1.10.0', '5')).toBe('1.10.0 (5)');
  });

  it('falls back to the bare version when the build cannot be read', () => {
    expect(formatBuild('1.10.0', null)).toBe('1.10.0');
    expect(formatBuild('1.10.0', undefined)).toBe('1.10.0');
  });

  it('treats blank and whitespace-only as absent', () => {
    expect(formatBuild('1.10.0', '')).toBe('1.10.0');
    expect(formatBuild('1.10.0', '   ')).toBe('1.10.0');
  });

  it('treats 0 as absent — no build is versionCode 0', () => {
    expect(formatBuild('1.10.0', '0')).toBe('1.10.0');
  });

  it('trims a padded value rather than printing the padding', () => {
    expect(formatBuild('1.10.0', ' 12 ')).toBe('1.10.0 (12)');
  });

  it('distinguishes two builds that share a marketing version — the whole point', () => {
    expect(formatBuild('1.10.0', '3')).not.toBe(formatBuild('1.10.0', '5'));
  });
});

/**
 * PHASE 98 — over-the-air updates re-open the hole that `formatBuild` was written to close. Once
 * build 6 can be running any of its updates, `1.10.0 (6)` no longer identifies the JS on the phone.
 */
describe('formatVersionLine', () => {
  it('is unchanged from today while running the JS bundled in the APK', () => {
    expect(formatVersionLine('1.10.0', '6', null)).toBe('1.10.0 (6)');
  });

  it('names the update once one has been applied', () => {
    expect(formatVersionLine('1.10.0', '6', '3f9c1a2b-0000-4000-8000-000000000000'))
      .toBe('1.10.0 (6) · u3f9c1a');
  });

  it('distinguishes two updates running on the SAME build — the whole point', () => {
    const a = formatVersionLine('1.10.0', '6', 'aaaaaaaa-0000-4000-8000-000000000000');
    const b = formatVersionLine('1.10.0', '6', 'bbbbbbbb-0000-4000-8000-000000000000');
    expect(a).not.toBe(b);
  });

  it('still degrades to the bare version when neither can be read', () => {
    expect(formatVersionLine('1.10.0', null, null)).toBe('1.10.0');
  });
});

describe('shortUpdateId', () => {
  it('takes six hex characters, ignoring the dashes', () => {
    expect(shortUpdateId('3f9c1a2b-0000-4000-8000-000000000000')).toBe('3f9c1a');
  });

  it('lowercases, so the same id never prints two ways', () => {
    expect(shortUpdateId('3F9C1A2B-0000-4000-8000-000000000000')).toBe('3f9c1a');
  });

  it('is null for an absent or blank id — an embedded launch has none', () => {
    expect(shortUpdateId(null)).toBeNull();
    expect(shortUpdateId(undefined)).toBeNull();
    expect(shortUpdateId('')).toBeNull();
    expect(shortUpdateId('   ')).toBeNull();
    expect(shortUpdateId('----')).toBeNull();
  });

  it('does not pad an id shorter than six characters', () => {
    expect(shortUpdateId('abc')).toBe('abc');
  });
});
