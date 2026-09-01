import { describe, it, expect } from 'vitest';
import { formatBuild } from '@/lib/buildInfo';

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
