/**
 * Per-department layout density — the pure half of Phase 29 (mirrors `brand.ts`).
 *
 * The server-driven UI config may carry `theme.density` (`'comfortable' | 'compact'`, already
 * validated by `normalizeTheme` in `store/appUi.tsx`). When `'compact'`, the whole app's layout
 * scale tightens: spacing shrinks, corner radii shrink slightly, and — deliberately — TYPE SIZES
 * DO NOT CHANGE, so legibility and >= 44pt touch targets are preserved. `'comfortable'` (or an
 * absent `theme`) renders the built-in scale unchanged.
 *
 * The multipliers below are an owner-locked design decision (2026-08-12), NOT a contract value —
 * the contract/schema define `density` only as an enum; the numeric meaning of "compact" is written
 * down nowhere upstream. See `docs/spec/PHASE-29.md`.
 *
 * WHY A SEPARATE, DEPENDENCY-FREE MODULE: like `brand.ts`, this imports only the erased `Palette`
 * TYPE (never `theme.tsx`, which pulls `react-native`), so `applyDensity` unit-tests directly under
 * Node/Vitest with no native stub. It reads the comfortable scale OFF the given palette and
 * transforms it, so the comfortable numbers live in exactly one place (`theme.tsx`) — never copied.
 */
import type { Palette, Spacing, Radius } from './theme';

/**
 * Owner-locked 2026-08-12 (gentle, spacing-led): compact tightens whitespace and corners but keeps
 * type sizes. `font` is intentionally left at ×1.0 (legibility beats density; touch targets stay).
 */
const COMPACT_SPACING_K = 0.85;
const COMPACT_RADIUS_K = 0.9;

const shrink = (n: number, k: number) => Math.round(n * k);

/** Compact spacing = comfortable × 0.85, rounded to the pixel. */
export function compactSpacing(base: Spacing): Spacing {
  return {
    xs: shrink(base.xs, COMPACT_SPACING_K),
    sm: shrink(base.sm, COMPACT_SPACING_K),
    md: shrink(base.md, COMPACT_SPACING_K),
    lg: shrink(base.lg, COMPACT_SPACING_K),
    xl: shrink(base.xl, COMPACT_SPACING_K),
    xxl: shrink(base.xxl, COMPACT_SPACING_K),
    xxxl: shrink(base.xxxl, COMPACT_SPACING_K),
  };
}

/** Compact radius = comfortable × 0.90, rounded; `pill` stays a pill (never shrinks). */
export function compactRadius(base: Radius): Radius {
  return {
    sm: shrink(base.sm, COMPACT_RADIUS_K),
    md: shrink(base.md, COMPACT_RADIUS_K),
    lg: shrink(base.lg, COMPACT_RADIUS_K),
    xl: shrink(base.xl, COMPACT_RADIUS_K),
    xxl: shrink(base.xxl, COMPACT_RADIUS_K),
    pill: base.pill,
  };
}

/**
 * Overlay department density onto a base palette.
 *
 * Returns the SAME object reference for `'comfortable'`/`undefined` (fail-open, exactly like
 * `deriveBrandPalette`), so a memo upstream does not churn and a density-less role renders the
 * built-in scale with zero change. `'compact'` returns a new palette with tightened
 * `spacing`/`radius`; every other token — colours, gradients, and `font` — passes through verbatim.
 */
export function applyDensity(base: Palette, density?: 'comfortable' | 'compact'): Palette {
  if (density !== 'compact') return base;
  return { ...base, spacing: compactSpacing(base.spacing), radius: compactRadius(base.radius) };
}
