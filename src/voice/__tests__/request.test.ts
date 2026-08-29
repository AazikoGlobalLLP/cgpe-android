import { describe, it, expect } from 'vitest';
import type { Lang } from '@/i18n';
import { langForVoice, isRecordingTooShort, exceedsAudioCap } from '@/voice/request';
import { VOICE } from '@/voice/constants';

describe('langForVoice — both variants of a language share one STT code', () => {
  const cases: [Lang, string][] = [
    ['en', 'en-IN'],
    ['hi', 'hi-IN'],
    ['hi-en', 'hi-IN'],
    ['gu', 'gu-IN'],
    ['gu-en', 'gu-IN'],
  ];
  for (const [lang, code] of cases) {
    it(`${lang} → ${code}`, () => expect(langForVoice(lang)).toBe(code));
  }
});

describe('local audio gates — reject before any API call', () => {
  it('a clip shorter than MIN_RECORD_MS is too short', () => {
    expect(isRecordingTooShort(VOICE.MIN_RECORD_MS - 1)).toBe(true);
    expect(isRecordingTooShort(VOICE.MIN_RECORD_MS)).toBe(false);
    expect(isRecordingTooShort(5_000)).toBe(false);
  });
  it('a clip over MAX_AUDIO_BYTES exceeds the cap', () => {
    expect(exceedsAudioCap(VOICE.MAX_AUDIO_BYTES + 1)).toBe(true);
    expect(exceedsAudioCap(VOICE.MAX_AUDIO_BYTES)).toBe(false);
    expect(exceedsAudioCap(30_000)).toBe(false);
  });
});
