/**
 * Per-department brand accent — the pure half of Phase 28.
 *
 * The server-driven UI config may carry `theme.accent` (a `#RRGGBB` string, already validated
 * and normalised by `normalizeTheme` in `store/appUi.tsx`). When present, it recolours the
 * app's BRAND primary for that role — buttons, links, primary pills, the clock-in ring and the
 * active-tab gradient — while leaving the OS light/dark neutrals and the SEMANTIC status colours
 * (success/warning/danger/info/whatsapp/gold) untouched. The documented intent is the panel's
 * own (`ADMIN_PANEL_SYNC.md` §3.6.9: "swap `M.primary` for the chosen accent").
 *
 * WHY A SEPARATE, DEPENDENCY-FREE MODULE: `theme.tsx` imports `react-native` (for
 * `useColorScheme`), which cannot load under the Node/Vitest test runner without the native
 * stub. Keeping the colour maths here — importing only the `Palette` TYPE, which esbuild erases
 * — lets `deriveBrandPalette` be unit-tested directly with no React and no native shim.
 *
 * Everything here is a deterministic transform of the given accent, not a chosen colour: no new
 * hex literal is invented. A missing/invalid accent returns the base palette UNCHANGED, so the
 * azure/teal system is the fail-open default.
 */
import type { Palette } from './theme';

/** The one accepted accent shape. Mirrors the schema in `ui_rbac_config.json` and `normalizeTheme`. */
const HEX6 = /^#[0-9a-fA-F]{6}$/;

type RGB = { r: number; g: number; b: number };

function toRgb(hex: string): RGB {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Linear blend: `amount` (0..1) of `b` mixed into `a`. */
function mix(a: RGB, b: RGB, amount: number): RGB {
  return {
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  };
}

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };
const lighten = (c: RGB, amt: number) => mix(c, WHITE, amt);
const darken = (c: RGB, amt: number) => mix(c, BLACK, amt);

/**
 * Perceptual luminance on the 0..255 scale (Rec. 709 coefficients). Used only to decide whether
 * text on top of the accent should be near-black or white, so an exact sRGB-gamma curve is not
 * needed — the ordering is what matters, and a bright accent (e.g. amber) must not get white text.
 */
const luminance = ({ r, g, b }: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Overlay a department accent onto a base palette.
 *
 * Returns the SAME object reference when there is no valid accent, so callers can rely on
 * referential equality to short-circuit (and so a memo upstream does not churn). Only the brand
 * tokens are replaced; every neutral, semantic colour, tile ink and the two non-brand gradients
 * (`gradientHero`, `gradientAccent`) are carried through verbatim from `base`.
 */
export function deriveBrandPalette(base: Palette, accent?: string): Palette {
  if (!accent || !HEX6.test(accent)) return base;

  const a = toRgb(accent);
  const primary = toHex(a);                       // the accent itself, canonicalised (lower-case hex)
  const primaryDark = toHex(darken(a, 0.14));     // pressed / border shade
  const primaryGlow = toHex(lighten(a, 0.24));    // highlight end of the gradient
  // Soft surface: tint the scheme's own card colour toward the accent, so light stays light and
  // dark stays dark — the same role the built-in `primarySoft` plays, derived from real palette
  // surfaces rather than a fixed literal.
  const surface = toRgb(base.card);
  const primarySoft = toHex(mix(surface, a, base.scheme === 'dark' ? 0.18 : 0.12));
  // Text drawn ON the accent (button labels, badge counts): dark on a light accent, white on a
  // dark one. 150/255 is the threshold that keeps mid-blue on white text and amber on dark text.
  const onPrimary = luminance(a) > 150 ? '#04121f' : '#ffffff';
  // The signature brand gradient (clock-in ring + active-tab pill) follows the accent as a
  // same-hue dark→base→glow ramp — the Phase-28 "primary + gradient" decision.
  const gradientBrand: [string, string, ...string[]] = [primaryDark, primary, primaryGlow];

  return { ...base, primary, primaryDark, primaryGlow, primarySoft, onPrimary, gradientBrand };
}
