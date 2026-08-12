import React, { createContext, useContext } from 'react';
import { TextStyle, useColorScheme } from 'react-native';

/**
 * CGPE design system — the azure-teal console identity, ported from the MERN admin panel.
 *
 * Hue source of truth is the panel itself, not a guess:
 *   cgpe-front-main-RECOVERED/src/index.css  :root
 *     --primary   hsl(214 84% 56%)  = #3182ED
 *     --accent    hsl(172 76% 48%)  = #1DD7BF
 *     --gradient-hero  linear-gradient(135deg, primary, accent)
 *   cgpe-front-main-RECOVERED/tailwind.config.ts  (radii, shadows, motion curves)
 *
 * Two deliberate divergences from the panel, both justified:
 *
 * 1. DARK MODE IS NOT PORTED. The panel's `.dark` block is stock shadcn slate with
 *    `--primary` inverted to near-white (210 40% 98%) — the azure brand disappears
 *    entirely in dark mode. That is an oversight in the panel, not a design choice, so
 *    mobile defines a branded dark derived from the azure/teal hues instead.
 *
 * 2. RADII AND DENSITY STAY MOBILE. The panel uses an 8px radius and desktop table
 *    density. Copying that onto a phone is what makes apps read as ported websites.
 *    Brand identity here is carried by hue, gradient, and typeface — not by matching a
 *    desktop corner radius. Touch targets stay >= 44pt.
 *
 * GRADIENT DISCIPLINE: `gradientBrand` is the signature and is deliberately rationed.
 * It belongs on the clock-in state ring and the active tab indicator. Primary buttons
 * use solid `primary`. Gradient-on-everything is what made the previous theme read as
 * generic; spend the boldness in one place.
 */

export type Tile = { bg: string; fg: string };
export type Palette = {
  scheme: 'light' | 'dark';
  bg: string;
  bgElevated: string;
  card: string;
  cardAlt: string;
  border: string;
  hairline: string;
  text: string;
  muted: string;
  faint: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  primaryGlow: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  accentGlow: string;
  gold: string;
  goldSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  whatsapp: string;
  whatsappSoft: string;
  /** Rule colour for the date-spine used on home and list screens. */
  spine: string;
  /** Neutral track behind progress/meters. */
  track: string;
  gradientBrand: [string, string, ...string[]];
  gradientHero: [string, string, ...string[]];
  gradientAccent: [string, string, ...string[]];
  glass: string;
  glassBorder: string;
  tiles: Tile[];
  avatarPalette: string[];
  overlay: string;
};

const light: Palette = {
  scheme: 'light',
  // Cooler than the panel's #FCFCFC document white — this is an app surface, not paper.
  bg: '#f7f9fc',
  bgElevated: '#ffffff',
  card: '#ffffff',
  cardAlt: '#eef2f8',
  border: '#e5e8eb',        // panel --border hsl(214 13% 91%)
  hairline: '#eef1f5',
  text: '#171d26',          // panel --foreground hsl(216 24% 12%)
  muted: '#738296',         // panel --muted-foreground hsl(215 14% 52%)
  faint: '#9aa7b8',
  primary: '#3182ed',       // panel --primary
  primaryDark: '#1e6fd9',
  primarySoft: '#e7f0fe',
  primaryGlow: '#66a8ff',   // panel --primary-glow
  onPrimary: '#ffffff',
  accent: '#1dd7bf',        // panel --accent
  accentSoft: '#e3faf6',
  accentGlow: '#4ff0da',    // panel --accent-glow
  gold: '#f5a524',
  goldSoft: '#fdf0da',
  success: '#16a249',       // panel --success
  successSoft: '#e4f6ea',
  warning: '#f59f0a',       // panel --warning
  warningSoft: '#fdf2dc',
  danger: '#ef4343',        // panel --destructive
  dangerSoft: '#fdeaea',
  info: '#3182ed',
  infoSoft: '#e7f0fe',
  whatsapp: '#1fab54',
  whatsappSoft: '#e3f6ea',
  spine: '#dbe3ee',
  track: '#e8edf4',
  gradientBrand: ['#3182ed', '#2aa8d8', '#1dd7bf'],   // the 135deg hero gradient
  gradientHero: ['#0f2942', '#0a1b2e', '#060f1a'],    // deep azure, replaces violet-black
  gradientAccent: ['#1dd7bf', '#12b8a4'],
  glass: 'rgba(255,255,255,0.72)',
  glassBorder: 'rgba(255,255,255,0.6)',
  tiles: [
    { bg: '#e7f0fe', fg: '#2b6fd0' },  // azure
    { bg: '#e3faf6', fg: '#0f9e8c' },  // teal
    { bg: '#fdf2dc', fg: '#b97708' },  // amber
    { bg: '#e4f6ea', fg: '#16a249' },  // green
    { bg: '#fdeaea', fg: '#d13636' },  // red
    { bg: '#eceafe', fg: '#6355d8' },  // indigo (one violet retained for variety)
  ],
  avatarPalette: ['#3182ed', '#1dd7bf', '#0ea5e9', '#16a249', '#f59f0a', '#6355d8', '#ec4899', '#0f9e8c'],
  overlay: 'rgba(9,17,28,0.45)',
};

const dark: Palette = {
  scheme: 'dark',
  // Branded dark: every neutral carries an azure undertone rather than neutral slate.
  bg: '#070c14',
  bgElevated: '#0d1420',
  card: '#0f1724',
  cardAlt: '#16202f',
  border: '#1e2a3c',
  hairline: '#151f2d',
  text: '#e9eff7',
  muted: '#8fa0b6',
  faint: '#5c6d84',
  // Azure lifted for contrast on a dark ground (AA against #0f1724).
  primary: '#5ba3f5',
  primaryDark: '#3182ed',
  primarySoft: '#12253d',
  primaryGlow: '#8cc2ff',
  onPrimary: '#04121f',
  accent: '#2ee6ce',
  accentSoft: '#0b2b28',
  accentGlow: '#6ff5e4',
  gold: '#f9b83e',
  goldSoft: '#2a2011',
  success: '#3ecf72',
  successSoft: '#0d2618',
  warning: '#f6ad3c',
  warningSoft: '#2a2011',
  danger: '#f87171',
  dangerSoft: '#2c1516',
  info: '#5ba3f5',
  infoSoft: '#12253d',
  whatsapp: '#3ddc84',
  whatsappSoft: '#0f2a1c',
  spine: '#1e2a3c',
  track: '#182334',
  gradientBrand: ['#3182ed', '#26b6d6', '#2ee6ce'],
  gradientHero: ['#12314f', '#0b1c30', '#060d17'],
  gradientAccent: ['#2ee6ce', '#12b8a4'],
  glass: 'rgba(18,28,44,0.62)',
  glassBorder: 'rgba(90,120,160,0.26)',
  tiles: [
    { bg: '#12253d', fg: '#5ba3f5' },
    { bg: '#0b2b28', fg: '#2ee6ce' },
    { bg: '#2a2011', fg: '#f6ad3c' },
    { bg: '#0d2618', fg: '#3ecf72' },
    { bg: '#2c1516', fg: '#f87171' },
    { bg: '#1d1a3a', fg: '#8b83ff' },
  ],
  avatarPalette: ['#5ba3f5', '#2ee6ce', '#38bdf8', '#3ecf72', '#f9b83e', '#8b83ff', '#f472b6', '#12b8a4'],
  overlay: 'rgba(0,0,0,0.62)',
};

/* ------------------------------------------------------------------ *
 * Typography
 *
 * Geist is the panel's typeface (self-hosted variable woff2 there; bundled here as
 * static TTF cuts via @expo-google-fonts/geist).
 *
 * IMPORTANT — React Native on Android does NOT synthesise weights. Setting
 * `fontFamily: 'Geist_400Regular'` together with `fontWeight: '700'` renders REGULAR,
 * not bold. Every weight must name its own family. Use `type(weight)` rather than a
 * bare `fontWeight`, and keep `fontWeight` alongside it so that a font-load failure
 * degrades to the system face at roughly the right weight instead of flattening.
 * ------------------------------------------------------------------ */

export type Weight = '400' | '500' | '600' | '700' | '800' | '900';

export const FAMILY: Record<Weight, string> = {
  '400': 'Geist_400Regular',
  '500': 'Geist_500Medium',
  '600': 'Geist_600SemiBold',
  '700': 'Geist_700Bold',
  '800': 'Geist_800ExtraBold',
  '900': 'Geist_900Black',
};

/** Text style for a weight (+ optional size). Always prefer this over `fontWeight`. */
export const type = (weight: Weight = '400', size?: number): TextStyle => ({
  fontFamily: FAMILY[weight],
  fontWeight: weight,
  ...(size == null ? null : { fontSize: size }),
});

/** Tabular figures — the mobile equivalent of the panel's `.tnum`. Money, counts, dates. */
export const tnum: TextStyle = { fontVariant: ['tabular-nums'] };

/** Uppercase eyebrow/label treatment: small, tracked out, semibold. */
export const eyebrow: TextStyle = { ...type('600', 11), letterSpacing: 0.8, textTransform: 'uppercase' };

/** Big numbers read tighter — Geist's personality shows in negative tracking at scale. */
export const displayTracking = -0.8;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const radius = { sm: 10, md: 14, lg: 18, xl: 24, xxl: 30, pill: 999 };
export const font = {
  display: 32,
  metric: 26,
  h1: 28,
  h2: 22,
  h3: 17,
  body: 15,
  sub: 13.5,
  cap: 12,
  tiny: 10.5,
};

/**
 * Motion curves lifted verbatim from the panel's tailwind config so mobile and web
 * share a feel. Exported as raw beziers (not Reanimated `Easing`) to keep this module
 * dependency-free — 81 files import it.
 */
export const motion = {
  /** panel `section-in` — the standard screen/section entrance. */
  enter: { duration: 320, bezier: [0.22, 0.61, 0.36, 1] as const },
  /** panel `--transition-smooth` */
  smooth: { duration: 300, bezier: [0.4, 0, 0.2, 1] as const },
  /** panel `--transition-spring` — pressables, sheets. */
  spring: { duration: 400, bezier: [0.175, 0.885, 0.32, 1.275] as const },
  /** Stagger step for orchestrated list entrances. */
  stagger: 40,
};

const ThemeContext = createContext<Palette>(light);

/**
 * `scheme` forces a palette for a subtree instead of following the OS. Only the dev
 * kitchen-sink uses it, to render the catalogue in both schemes on one screen; app code
 * should always omit it so the OS setting wins.
 */
export function ThemeProvider({ children, scheme: forced }: {
  children: React.ReactNode;
  scheme?: 'light' | 'dark';
}) {
  const sys = useColorScheme();
  const scheme = forced ?? sys;
  const value = scheme === 'dark' ? dark : light;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Palette {
  return useContext(ThemeContext);
}

/** Per-department accent overlay. Re-exported so app code has one theme entry point. */
export { deriveBrandPalette } from './brand';

/**
 * Re-provide an already-computed palette to a subtree.
 *
 * The app-layer brand bridge (`app/_layout.tsx`) uses this to overlay the server-driven
 * department accent on top of the OS light/dark palette WITHOUT reordering the provider tree:
 * the base `ThemeProvider` stays at the top so the Confirm/Toast overlays are still themed, and a
 * `PaletteProvider` sitting inside `AppUiProvider` swaps in the accented palette for every
 * `useTheme()` consumer below it. Kept here because `ThemeContext` is private to this module.
 */
export function PaletteProvider({ value, children }: {
  value: Palette;
  children: React.ReactNode;
}) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Azure-tinted depth. Neutral-grey shadows read cheap against a branded surface. */
export const shadow = (c: Palette, level = 1) => ({
  shadowColor: c.scheme === 'dark' ? '#000' : '#0b3b6f',
  shadowOpacity: c.scheme === 'dark' ? 0.5 : level >= 2 ? 0.14 : 0.08,
  shadowRadius: level >= 2 ? 24 : 14,
  shadowOffset: { width: 0, height: level >= 2 ? 12 : 6 },
  elevation: level >= 2 ? 8 : 3,
});
