/**
 * Phase 28 — `deriveBrandPalette`, the pure per-department accent overlay.
 *
 * `theme.tsx` cannot be imported here (it pulls `react-native`), so this exercises the colour
 * maths in isolation through `@/theme/brand`, whose only `theme` dependency is the erased
 * `Palette` type. Base palettes below are minimal fakes: `deriveBrandPalette` reads `scheme` and
 * `card`, spreads the rest through, so a handful of fields is enough to assert both the overrides
 * and the pass-through.
 */
import { describe, it, expect } from 'vitest';
import { deriveBrandPalette } from '@/theme/brand';
import type { Palette } from '@/theme/theme';

const lightBase = {
  scheme: 'light',
  bg: '#f7f9fc',
  card: '#ffffff',
  text: '#171d26',
  primary: '#3182ed',
  primaryDark: '#1e6fd9',
  primaryGlow: '#66a8ff',
  primarySoft: '#e7f0fe',
  onPrimary: '#ffffff',
  accent: '#1dd7bf',
  success: '#16a249',
  danger: '#ef4343',
  gradientBrand: ['#3182ed', '#2aa8d8', '#1dd7bf'],
  gradientHero: ['#0f2942', '#0a1b2e', '#060f1a'],
} as unknown as Palette;

const darkBase = { ...lightBase, scheme: 'dark', card: '#0f1724' } as unknown as Palette;

const HEX6 = /^#[0-9a-f]{6}$/;

describe('deriveBrandPalette — fail-open (no accent applied)', () => {
  it('returns the SAME palette reference when accent is undefined', () => {
    expect(deriveBrandPalette(lightBase, undefined)).toBe(lightBase);
  });

  it('returns the base unchanged for malformed accents', () => {
    for (const bad of ['', 'blue', '#123', '#12345', '#1234567', '#12g456', '3182ed']) {
      expect(deriveBrandPalette(lightBase, bad)).toBe(lightBase);
    }
  });
});

describe('deriveBrandPalette — accent applied', () => {
  it('sets primary to the (lower-cased) accent and never mutates the base', () => {
    const r = deriveBrandPalette(lightBase, '#3182ED');
    expect(r).not.toBe(lightBase);
    expect(r.primary).toBe('#3182ed');           // canonical lower-case hex
    expect(lightBase.primary).toBe('#3182ed');    // input object untouched
  });

  it('derives valid, distinct dark/glow/soft shades from the accent', () => {
    const r = deriveBrandPalette(lightBase, '#7c3aed');
    for (const v of [r.primary, r.primaryDark, r.primaryGlow, r.primarySoft]) {
      expect(v).toMatch(HEX6);
    }
    expect(r.primaryDark).not.toBe(r.primary);
    expect(r.primaryGlow).not.toBe(r.primary);
  });

  it('builds the signature gradient as a same-hue dark→accent→glow ramp', () => {
    const r = deriveBrandPalette(lightBase, '#7c3aed');
    expect(r.gradientBrand).toEqual([r.primaryDark, r.primary, r.primaryGlow]);
    expect(r.gradientBrand[1]).toBe('#7c3aed');
  });

  it('picks white text on a dark accent and near-black on a light one', () => {
    expect(deriveBrandPalette(lightBase, '#3182ed').onPrimary).toBe('#ffffff'); // mid blue
    expect(deriveBrandPalette(lightBase, '#f5a524').onPrimary).toBe('#04121f'); // bright amber
    expect(deriveBrandPalette(lightBase, '#ffffff').onPrimary).toBe('#04121f'); // pure white
    expect(deriveBrandPalette(lightBase, '#000000').onPrimary).toBe('#ffffff'); // pure black
  });

  it('tints the soft surface from the scheme, so light and dark differ', () => {
    const rl = deriveBrandPalette(lightBase, '#3182ed');
    const rd = deriveBrandPalette(darkBase, '#3182ed');
    expect(rl.primarySoft).not.toBe(rd.primarySoft);
  });

  it('leaves neutrals, semantic colours and non-brand gradients untouched', () => {
    const r = deriveBrandPalette(lightBase, '#7c3aed');
    expect(r.bg).toBe(lightBase.bg);
    expect(r.text).toBe(lightBase.text);
    expect(r.accent).toBe(lightBase.accent);       // the teal accent is a separate token
    expect(r.success).toBe(lightBase.success);
    expect(r.danger).toBe(lightBase.danger);
    expect(r.gradientHero).toBe(lightBase.gradientHero);
  });

  it('is deterministic', () => {
    expect(deriveBrandPalette(lightBase, '#abcdef')).toEqual(deriveBrandPalette(lightBase, '#abcdef'));
  });
});
