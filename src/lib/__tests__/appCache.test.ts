/**
 * PHASE 77 — the "Clear cached downloads" wording.
 *
 * The point of these is not the English; it is that a partial clear is never reported as a full
 * one, and that no branch ever produces a size. The owner asked why the app grows from 63 MB to
 * 125 MB, and the temptation with a question like that is to answer it with a number the app
 * cannot measure — none of the three underlying calls reports bytes (`Image.clearDiskCache()`
 * resolves a boolean, the WebView's `clearCache(true)` returns nothing, `Directory.delete()`
 * returns nothing). The last test here is the guard against a figure creeping back in.
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
    expect(r.message).toContain('Cached downloads cleared');
  });

  it('says plainly when nothing was cleared, and offers the one thing that helps', () => {
    const r = describeCacheClear(R());
    expect(r.tone).toBe('warning');
    expect(r.message).toContain('Nothing could be cleared');
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
      expect(said.message, JSON.stringify(r)).toContain('not all of them');
    }
  });

  it('treats the every-user leg (temp) as no more and no less than the others', () => {
    // `temp` — the picked-file copies — is the only leg an ordinary advisor ever fills, but a
    // clear that lands ONLY it is still partial and must not read as done.
    expect(describeCacheClear(R({ temp: true })).tone).toBe('warning');
  });

  it('never claims an amount of space — no branch may contain a digit (convention 4)', () => {
    for (const r of ALL) {
      const m = describeCacheClear(r).message;
      expect(m, JSON.stringify(r)).not.toMatch(/\d+\s*(MB|KB|GB|bytes)/i);
      expect(m, JSON.stringify(r)).not.toMatch(/\d/);
    }
  });

  it('always returns a non-empty message and a valid tone', () => {
    for (const r of ALL) {
      const said = describeCacheClear(r);
      expect(said.message.length).toBeGreaterThan(0);
      expect(['success', 'warning']).toContain(said.tone);
    }
  });
});
