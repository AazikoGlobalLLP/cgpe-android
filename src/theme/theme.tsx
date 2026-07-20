import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

/**
 * CGPE design system — a premium, gradient-forward fintech identity.
 * Vivid indigo-violet brand, deep hero cards, vibrant pastel action tiles,
 * glass surfaces, soft depth. Full light + dark.
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
  onPrimary: string;
  accent: string;
  accentSoft: string;
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
  bg: '#f4f5fb',
  bgElevated: '#ffffff',
  card: '#ffffff',
  cardAlt: '#eff1fa',
  border: '#e6e9f4',
  hairline: '#eef1f8',
  text: '#12141d',
  muted: '#5c6680',
  faint: '#98a2b8',
  primary: '#5b52f0',
  primaryDark: '#4a41d8',
  primarySoft: '#ebeafe',
  onPrimary: '#ffffff',
  accent: '#10b981',
  accentSoft: '#e2f6ee',
  gold: '#f5a524',
  goldSoft: '#fdf0da',
  success: '#10b981',
  successSoft: '#e2f6ee',
  warning: '#e2860b',
  warningSoft: '#fbf0da',
  danger: '#f04438',
  dangerSoft: '#fdeae8',
  info: '#3b82f6',
  infoSoft: '#e7f0fe',
  whatsapp: '#1fab54',
  whatsappSoft: '#e3f6ea',
  gradientBrand: ['#6d5efc', '#5b52f0', '#8b5cf6'],
  gradientHero: ['#312a63', '#1e1a3e', '#12101f'],
  gradientAccent: ['#12b981', '#0ea371'],
  glass: 'rgba(255,255,255,0.72)',
  glassBorder: 'rgba(255,255,255,0.6)',
  tiles: [
    { bg: '#ebeafe', fg: '#5b52f0' },
    { bg: '#e2f6ee', fg: '#10b981' },
    { bg: '#fff1dc', fg: '#e2860b' },
    { bg: '#e7f0fe', fg: '#3b82f6' },
    { bg: '#fee7ee', fg: '#f43f5e' },
    { bg: '#e3f8f6', fg: '#06b6d4' },
  ],
  avatarPalette: ['#5b52f0', '#0ea5e9', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#06b6d4', '#f59e0b'],
  overlay: 'rgba(12,14,25,0.45)',
};

const dark: Palette = {
  scheme: 'dark',
  bg: '#090a12',
  bgElevated: '#11131f',
  card: '#161927',
  cardAlt: '#1f2336',
  border: '#282d42',
  hairline: '#1d2133',
  text: '#eef0f8',
  muted: '#98a2bd',
  faint: '#5e688552',
  primary: '#8b83ff',
  primaryDark: '#6d5efc',
  primarySoft: '#201d40',
  onPrimary: '#ffffff',
  accent: '#2ee6a6',
  accentSoft: '#0f2a20',
  gold: '#f9b83e',
  goldSoft: '#2a2011',
  success: '#2ee6a6',
  successSoft: '#0f2a20',
  warning: '#f6ad3c',
  warningSoft: '#2a2011',
  danger: '#f87168',
  dangerSoft: '#2c1614',
  info: '#5fa0f8',
  infoSoft: '#12213a',
  whatsapp: '#3ddc84',
  whatsappSoft: '#0f2a1c',
  gradientBrand: ['#7c6bff', '#6d5efc', '#9b6cff'],
  gradientHero: ['#332c66', '#1c1937', '#0d0c18'],
  gradientAccent: ['#2ee6a6', '#12b981'],
  glass: 'rgba(28,32,50,0.6)',
  glassBorder: 'rgba(90,100,140,0.28)',
  tiles: [
    { bg: '#211d43', fg: '#8b83ff' },
    { bg: '#10241d', fg: '#2ee6a6' },
    { bg: '#2a2012', fg: '#f6ad3c' },
    { bg: '#13233d', fg: '#5fa0f8' },
    { bg: '#2c1620', fg: '#fb7199' },
    { bg: '#0f2530', fg: '#3ecbe0' },
  ],
  avatarPalette: ['#8b83ff', '#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#2ee6a6', '#3ecbe0', '#f9b83e'],
  overlay: 'rgba(0,0,0,0.6)',
};

// faint had a stray value; normalise
dark.faint = '#5f6a86';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const radius = { sm: 10, md: 14, lg: 18, xl: 24, xxl: 30, pill: 999 };
export const font = { h1: 28, h2: 22, h3: 17, body: 15, sub: 13.5, cap: 12, tiny: 10.5 };

const ThemeContext = createContext<Palette>(light);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const value = scheme === 'dark' ? dark : light;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Palette {
  return useContext(ThemeContext);
}

export const shadow = (c: Palette, level = 1) => ({
  shadowColor: c.scheme === 'dark' ? '#000' : '#3a2f8f',
  shadowOpacity: c.scheme === 'dark' ? 0.5 : level >= 2 ? 0.16 : 0.09,
  shadowRadius: level >= 2 ? 24 : 14,
  shadowOffset: { width: 0, height: level >= 2 ? 12 : 6 },
  elevation: level >= 2 ? 8 : 3,
});
