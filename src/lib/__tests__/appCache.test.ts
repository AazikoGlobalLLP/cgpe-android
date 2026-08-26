/**
 * PHASE 77 — the "Clear cached downloads" outcome logic.
 *
 * Two things are pinned here. First, a partial clear is never reported as a full one: the whole
 * value of the control is that its answer can be trusted. Second, this module returns i18n KEYS
 * and never a sentence — the owner supplied all five languages for `storage.*` on 2026-08-26, and
 * a literal creeping back in here would ship untranslated English to 21 field phones.
 *
 * There is deliberately no megabyte figure anywhere, in any language. The owner asked why the app
 * grows from 63 MB to 125 MB, and the temptation is to answer with a number the app cannot
 * measure — none of the three underlying calls reports bytes (`Image.clearDiskCache()` resolves a
 * boolean, the WebView's `clearCache(true)` returns nothing, `Directory.delete()` returns
 * nothing). Keys instead of sentences makes that fabrication impossible by construction.
 */
import { describe, expect, it } from 'vitest';
import { describeCacheClear } from '@/lib/appCache';
import type { CacheClearResult } from '@/lib/appCache';

const R = (over: Partial<CacheClearResult> = {}): CacheClearResult => ({
  tiles: false, images: false, temp: false, ...over,
});

/** Every combination of the three legs, so no branch is reasoned about in the abstract. */
const ALL: CacheClearResult[] = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({
  tiles: !!(n & 1), images: !!(n & 2), temp: !!(n & 4),
}));

describe('describeCacheClear', () => {
  it('reports a full clear as a success', () => {
    const r = describeCacheClear(R({ tiles: true, images: true, temp: true }));
    expect(r.tone).toBe('success');
    expect(r.messageKey).toBe('storage.doneBody');
  });

  it('says plainly when nothing was cleared, and offers the one thing that helps', () => {
    const r = describeCacheClear(R());
    expect(r.tone).toBe('warning');
    expect(r.messageKey).toBe('storage.failBody');
  });

  it('NEVER calls a partial clear a success — all six mixed outcomes stay a warning', () => {
    const partial = ALL.filter((r) => {
      const done = [r.tiles, r.images, r.temp].filter(Boolean).length;
      return done > 0 && done < 3;
    });
    expect(partial).toHaveLength(6);
    for (const r of partial) {
      const said = describeCacheClear(r);
      expect(said.tone, JSON.stringify(r)).toBe('warning');
      expect(said.messageKey, JSON.stringify(r)).toBe('storage.partialBody');
    }
  });

  it('treats the every-user leg (temp) as no more and no less than the others', () => {
    // `temp` — the picked-file copies — is the only leg an ordinary advisor ever fills, but a
    // clear that lands ONLY it is still partial and must not read as done.
    expect(describeCacheClear(R({ temp: true })).tone).toBe('warning');
  });

  it('returns only keys the dictionaries actually define, never a raw sentence', () => {
    // The guard against this module drifting back to English. `storage.*` copy was supplied by the
    // owner in all five languages; a literal here would ship untranslated to 21 field phones.
    const KNOWN = ['storage.doneBody', 'storage.partialBody', 'storage.failBody'];
    for (const r of ALL) {
      const said = describeCacheClear(r);
      expect(KNOWN, JSON.stringify(r)).toContain(said.messageKey);
      expect(said.messageKey, JSON.stringify(r)).not.toMatch(/\s/);
      expect(['success', 'warning']).toContain(said.tone);
    }
  });
});
