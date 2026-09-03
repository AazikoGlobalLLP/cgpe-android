import { describe, expect, it } from 'vitest';
import { parseVoiceStatus, voiceAbortMs } from '@/voice/status';
import { VOICE } from '@/voice/constants';

describe('parseVoiceStatus', () => {
  it('reads a ready, one-engine server under the `data` envelope', () => {
    const s = parseVoiceStatus({
      success: true,
      data: {
        ready: true,
        missing: [],
        timeouts: { stt_ms: 30000, brain_ms: 20000, tts_ms: 30000, tts_engines: 1, budget_ms: 80000 },
      },
    });
    expect(s).toEqual({ ready: true, missing: [], hasTts: true, budgetMs: 80000 });
  });

  it('accepts the same shape at the top level (no `data` wrapper)', () => {
    const s = parseVoiceStatus({ ready: true, missing: [], timeouts: { tts_engines: 2, budget_ms: 110000 } });
    expect(s.ready).toBe(true);
    expect(s.budgetMs).toBe(110000);
    expect(s.hasTts).toBe(true);
  });

  it('surfaces a not-ready server and its missing legs', () => {
    const s = parseVoiceStatus({ data: { ready: false, missing: ['brain', 'CGPE_VOICE_SECRET'] } });
    expect(s.ready).toBe(false);
    expect(s.missing).toEqual(['brain', 'CGPE_VOICE_SECRET']);
  });

  it('reports hasTts=false when zero engines are configured (ready but no voice back)', () => {
    const s = parseVoiceStatus({ data: { ready: true, missing: [], timeouts: { tts_engines: 0, budget_ms: 50000 } } });
    expect(s.ready).toBe(true);
    expect(s.hasTts).toBe(false);
  });

  it('falls back to the missing[] list for hasTts when tts_engines is absent', () => {
    expect(parseVoiceStatus({ data: { ready: true, missing: ['tts'] } }).hasTts).toBe(false);
    expect(parseVoiceStatus({ data: { ready: true, missing: ['brain'] } }).hasTts).toBe(true);
  });

  it('treats a non-positive or non-finite budget as unknown (null), not zero', () => {
    expect(parseVoiceStatus({ data: { ready: true, timeouts: { budget_ms: 0 } } }).budgetMs).toBeNull();
    expect(parseVoiceStatus({ data: { ready: true, timeouts: { budget_ms: 'x' } } }).budgetMs).toBeNull();
    expect(parseVoiceStatus({ data: { ready: true, timeouts: {} } }).budgetMs).toBeNull();
  });

  it('degrades a garbage body to a safe not-ready result rather than throwing', () => {
    for (const junk of [null, undefined, 42, 'nope', [], {}]) {
      expect(parseVoiceStatus(junk as unknown)).toEqual({ ready: false, missing: [], hasTts: false, budgetMs: null });
    }
  });
});

describe('voiceAbortMs', () => {
  it('uses the server budget when known', () => {
    expect(voiceAbortMs({ ready: true, missing: [], hasTts: true, budgetMs: 80000 })).toBe(80000);
  });
  it('falls back to the generous CEILING_MS when the budget is unknown or the probe failed', () => {
    expect(voiceAbortMs({ ready: true, missing: [], hasTts: true, budgetMs: null })).toBe(VOICE.CEILING_MS);
    expect(voiceAbortMs(null)).toBe(VOICE.CEILING_MS);
  });
});
