import { describe, it, expect } from 'vitest';
import type { Palette } from '@/theme/theme';
import {
  dbToAmp01, personaBase, personaGlow, tierGlow, stateCopyKey, formatDuration,
} from '@/ui/voice/voiceVisual';
import { TIER_THEME } from '@/store/roles';

const c = { primary: '#P', accent: '#A', primaryGlow: '#PG', accentGlow: '#AG' } as unknown as Palette;

describe('dbToAmp01', () => {
  it('maps the dB range to 0..1 and clamps', () => {
    expect(dbToAmp01(-60)).toBe(0);
    expect(dbToAmp01(0)).toBe(1);
    expect(dbToAmp01(-30)).toBeCloseTo(0.5, 5);
    expect(dbToAmp01(-160)).toBe(0); // below the floor clamps to 0
    expect(dbToAmp01(20)).toBe(1);   // above 0 clamps to 1
  });
  it('a non-finite reading is silence', () => {
    expect(dbToAmp01(NaN)).toBe(0);
    expect(dbToAmp01(-Infinity)).toBe(0);
  });
  it('honours a custom floor', () => {
    expect(dbToAmp01(-25, -50)).toBe(0.5);
  });
});

describe('persona hues', () => {
  it('female = teal accent, male = azure primary', () => {
    expect(personaBase('female', c)).toBe('#A');
    expect(personaBase('male', c)).toBe('#P');
    expect(personaGlow('female', c)).toBe('#AG');
    expect(personaGlow('male', c)).toBe('#PG');
  });
});

describe('tierGlow', () => {
  it('returns the TIER_THEME accent pair per tier', () => {
    for (const tier of ['master', 'admin', 'team'] as const) {
      expect(tierGlow(tier)).toEqual({ accent: TIER_THEME[tier].accent, accent2: TIER_THEME[tier].accent2 });
    }
  });
});

describe('stateCopyKey', () => {
  it('maps each state to its hint key', () => {
    expect(stateCopyKey('idle')).toBe('voice.holdToSpeak');
    expect(stateCopyKey('listening')).toBe('voice.listening');
    expect(stateCopyKey('thinking')).toBe('voice.thinking');
    expect(stateCopyKey('speaking')).toBe('voice.speaking');
    expect(stateCopyKey('error')).toBe('voice.failed');
  });
});

describe('formatDuration', () => {
  it('formats mm:ss with a zero-padded second', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5000)).toBe('0:05');
    expect(formatDuration(65000)).toBe('1:05');
    expect(formatDuration(600000)).toBe('10:00');
    expect(formatDuration(-5)).toBe('0:00');
  });
});
