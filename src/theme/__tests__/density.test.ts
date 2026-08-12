/**
 * Phase 29 — `applyDensity`, the pure per-department layout-density overlay.
 *
 * `theme.tsx` cannot be imported here (it pulls `react-native`), so — like `brand.test.ts` — this
 * exercises the maths through `@/theme/density`, whose only `theme` dependency is erased types.
 * The base scale below is a copy of the COMFORTABLE scale in `theme.tsx`; keep the two in step
 * (the app itself never copies these numbers — `applyDensity` reads them off the live palette).
 */
import { describe, it, expect } from 'vitest';
import { applyDensity, compactSpacing, compactRadius } from '@/theme/density';
import type { Palette, Spacing, Radius } from '@/theme/theme';

// Must match `theme.tsx`'s `spacing` / `radius` / `font`.
const spacing: Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
const radius: Radius = { sm: 10, md: 14, lg: 18, xl: 24, xxl: 30, pill: 999 };
const font = { display: 32, metric: 26, h1: 28, h2: 22, h3: 17, body: 15, sub: 13.5, cap: 12, tiny: 10.5 };

const base = {
  scheme: 'light',
  bg: '#f7f9fc',
  primary: '#3182ed',
  spacing,
  radius,
  font,
} as unknown as Palette;

describe('compactSpacing — comfortable × 0.85, rounded', () => {
  it('pins the exact compact spacing', () => {
    // 4→3.4, 8→6.8, 12→10.2, 16→13.6, 20→17, 24→20.4, 32→27.2 (Math.round)
    expect(compactSpacing(spacing)).toEqual({ xs: 3, sm: 7, md: 10, lg: 14, xl: 17, xxl: 20, xxxl: 27 });
  });
  it('never mutates its input', () => {
    compactSpacing(spacing);
    expect(spacing).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 });
  });
});

describe('compactRadius — comfortable × 0.90, rounded, pill preserved', () => {
  it('pins the exact compact radius', () => {
    // 10→9, 14→12.6, 18→16.2, 24→21.6, 30→27; pill 999 unchanged
    expect(compactRadius(radius)).toEqual({ sm: 9, md: 13, lg: 16, xl: 22, xxl: 27, pill: 999 });
  });
  it('leaves the pill radius a full pill', () => {
    expect(compactRadius(radius).pill).toBe(999);
  });
});

describe('applyDensity — fail-open (comfortable / undefined)', () => {
  it('returns the SAME palette reference for undefined', () => {
    expect(applyDensity(base, undefined)).toBe(base);
  });
  it('returns the SAME palette reference for "comfortable"', () => {
    expect(applyDensity(base, 'comfortable')).toBe(base);
  });
});

describe('applyDensity — compact applied', () => {
  it('returns a new palette with tightened spacing and radius', () => {
    const r = applyDensity(base, 'compact');
    expect(r).not.toBe(base);
    expect(r.spacing).toEqual({ xs: 3, sm: 7, md: 10, lg: 14, xl: 17, xxl: 20, xxxl: 27 });
    expect(r.radius).toEqual({ sm: 9, md: 13, lg: 16, xl: 22, xxl: 27, pill: 999 });
  });

  it('leaves font sizes UNCHANGED (legibility beats density) and never mutates the base', () => {
    const r = applyDensity(base, 'compact');
    expect(r.font).toBe(base.font);            // same reference — font is not scaled
    expect(base.spacing).toBe(spacing);        // base untouched
    expect(base.spacing.md).toBe(12);
  });

  it('passes colours and every non-scale token through verbatim', () => {
    const r = applyDensity(base, 'compact');
    expect(r.scheme).toBe(base.scheme);
    expect(r.bg).toBe(base.bg);
    expect(r.primary).toBe(base.primary);
  });

  it('is deterministic', () => {
    expect(applyDensity(base, 'compact')).toEqual(applyDensity(base, 'compact'));
  });
});
