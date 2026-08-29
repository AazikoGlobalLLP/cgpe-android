/**
 * Pure visual helpers for the voice mode — the native-free seam every voice-UI component shares.
 * Kept free of React, Reanimated, Skia, and blur so it is unit-tested directly with no stub, and so
 * the colour/amplitude/copy decisions live in ONE tested place rather than scattered across the shell,
 * the orb, and the waveform.
 */
import type { Palette } from '@/theme/theme';
import { TIER_THEME, type Tier } from '@/store/roles';

/** The five voice states, the single source of truth (the character + shell + hook all import this). */
export type VoiceCharacterState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export type Persona = 'male' | 'female';

/**
 * Map a mic metering value (dBFS: 0 = max, -60ish = silence floor, -160 = true silence on Android) to
 * a 0..1 amplitude. Android emits `20·log10(maxAmplitude/32767)`; speech sits roughly -30…-10 dB. The
 * -60 floor is a starting point to tune on a device.
 */
export function dbToAmp01(db: number, floorDb = -60): number {
  if (!Number.isFinite(db)) return 0;
  const v = (db - floorDb) / -floorDb; // floorDb..0  ->  0..1
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** The character's core hue: female = teal accent, male = azure primary (mirrors the old VoiceAvatar). */
export function personaBase(persona: Persona, c: Palette): string {
  return persona === 'female' ? c.accent : c.primary;
}

/** The glow hue for a persona (the brighter halo colour). */
export function personaGlow(persona: Persona, c: Palette): string {
  return persona === 'female' ? c.accentGlow : c.primaryGlow;
}

/** The department glow/rim pair (master gold / admin azure / team teal) — the tier signal on the aura. */
export function tierGlow(tier: Tier): { accent: string; accent2: string } {
  const th = TIER_THEME[tier];
  return { accent: th.accent, accent2: th.accent2 };
}

/** The i18n key for the state hint shown under the character. */
export function stateCopyKey(state: VoiceCharacterState): string {
  switch (state) {
    case 'listening': return 'voice.listening';
    case 'thinking': return 'voice.thinking';
    case 'speaking': return 'voice.speaking';
    case 'error': return 'voice.failed';
    default: return 'voice.holdToSpeak';
  }
}

/** `mm:ss` for the live recording duration. Clamps negatives to 0:00. */
export function formatDuration(ms: number): string {
  const total = ms > 0 ? Math.floor(ms / 1000) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
