/**
 * The response parser is the app's shield against a malformed / empty n8n reply — a REAL failure mode
 * (the existing chat webhook returns an empty body today). It must never throw and must fail closed:
 * an unknown route never navigates, a confirm_write with nothing to show never opens a card.
 */
import { describe, it, expect } from 'vitest';
import { parseVoiceReply, type VoiceReply, type VoiceReplyError } from '@/voice/response';
import { VOICE } from '@/voice/constants';

function ok(r: ReturnType<typeof parseVoiceReply>): VoiceReply {
  if (!r.ok) throw new Error(`expected ok, got error ${r.code}`);
  return r;
}
function bad(r: ReturnType<typeof parseVoiceReply>): VoiceReplyError {
  if (r.ok) throw new Error('expected error, got ok');
  return r;
}

const base = { ok: true, transcript: 'aaj kitne kaam hai', reply_text: 'Aaj 4 kaam hai.', confidence: 0.9 };

describe('empty / non-object bodies → empty_body, never a throw', () => {
  for (const raw of [null, undefined, 42, 'a string', [], NaN]) {
    it(`${JSON.stringify(raw)} is empty_body`, () => {
      expect(bad(parseVoiceReply(raw)).code).toBe('empty_body');
    });
  }
});

describe('ok:false failure path (HTTP 200 with error) — A1.3', () => {
  it('maps a known error code and keeps the transcript + message', () => {
    const r = bad(parseVoiceReply({ ok: false, transcript: 'x', error: { code: 'stt_failed', message: 'no speech' } }));
    expect(r.code).toBe('stt_failed');
    expect(r.transcript).toBe('x');
    expect(r.message).toBe('no speech');
  });
  it('an unrecognised code becomes unknown', () => {
    expect(bad(parseVoiceReply({ ok: false, error: { code: 'weird' } })).code).toBe('unknown');
  });
  it('a missing error object becomes unknown', () => {
    expect(bad(parseVoiceReply({ ok: false, transcript: 't' })).code).toBe('unknown');
  });
});

describe('malformed success — object but missing required fields', () => {
  it('missing reply_text is malformed but keeps the transcript', () => {
    const r = bad(parseVoiceReply({ ok: true, transcript: 't' }));
    expect(r.code).toBe('malformed');
    expect(r.transcript).toBe('t');
  });
  it('a reply_text with no transcript is still SPEAKABLE (transcript defaults to empty), not malformed', () => {
    const r = ok(parseVoiceReply({ ok: true, reply_text: 'r' }));
    expect(r.replyText).toBe('r');
    expect(r.transcript).toBe('');
  });
  it('an empty reply_text with no transcript is malformed', () => {
    expect(bad(parseVoiceReply({ ok: true, reply_text: '   ' })).code).toBe('malformed');
  });
});

describe('minimal valid success', () => {
  it('parses transcript + reply_text; defaults action/audio to none', () => {
    const r = ok(parseVoiceReply(base));
    expect(r.transcript).toBe(base.transcript);
    expect(r.replyText).toBe(base.reply_text);
    expect(r.action.type).toBe('none');
    expect(r.audio.mode).toBe('none');
    expect(r.lowConfidence).toBe(false);
  });
  it('passes through request_id and lang_detected', () => {
    const r = ok(parseVoiceReply({ ...base, request_id: 'uuid-1', lang_detected: 'hi-IN' }));
    expect(r.requestId).toBe('uuid-1');
    expect(r.lang).toBe('hi-IN');
  });
});

describe('🔴 the live n8n brain shape (success + reply_text, no audio/confidence)', () => {
  it('success:true with a reply_text + allowed route navigates', () => {
    const r = ok(parseVoiceReply({ success: true, transcript: 'x', reply_text: 'Aaj 4 kaam hai.', action: { type: 'navigate', route: '/attendance' } }));
    expect(r.replyText).toBe('Aaj 4 kaam hai.');
    expect(r.action.type).toBe('navigate');
    expect(r.action.route).toBe('/attendance');
    expect(r.confidence).toBe(1); // no confidence field → confident
  });
  it('success:false WITH reply_text is a speakable SOFT failure — spoken, but never navigates', () => {
    const r = ok(parseVoiceReply({ success: false, transcript: 'x', reply_text: 'Aapko iski permission nahi hai.', action: { type: 'navigate', route: '/attendance' } }));
    expect(r.replyText).toBe('Aapko iski permission nahi hai.');
    expect(r.action.type).toBe('none');
  });
  it('success:false with NO reply_text is a hard failure', () => {
    expect(bad(parseVoiceReply({ success: false, transcript: 'x' })).code).toBeTruthy();
  });
});

describe('confidence — clamped, defaulted, and flagged', () => {
  it('🔴 an ABSENT/non-numeric confidence defaults to CONFIDENT (the brain sends none)', () => {
    // The n8n brain returns no confidence — absence must mean "act normally", NOT "refuse to navigate".
    expect(ok(parseVoiceReply({ ...base, confidence: undefined })).confidence).toBe(1);
    expect(ok(parseVoiceReply({ ...base, confidence: 'high' })).confidence).toBe(1);
    expect(ok(parseVoiceReply({ ...base, confidence: 'high' })).lowConfidence).toBe(false);
  });
  it('an EXPLICIT low confidence still gates', () => {
    expect(ok(parseVoiceReply({ ...base, confidence: 0.2 })).lowConfidence).toBe(true);
  });
  it('clamps out-of-range values', () => {
    expect(ok(parseVoiceReply({ ...base, confidence: 5 })).confidence).toBe(1);
    expect(ok(parseVoiceReply({ ...base, confidence: -1 })).confidence).toBe(0);
  });
  it('the CONFIDENCE_MIN boundary is not low', () => {
    expect(ok(parseVoiceReply({ ...base, confidence: VOICE.CONFIDENCE_MIN })).lowConfidence).toBe(false);
    expect(ok(parseVoiceReply({ ...base, confidence: VOICE.CONFIDENCE_MIN - 0.01 })).lowConfidence).toBe(true);
  });
});

describe('action: navigate — never on a guess', () => {
  it('keeps a navigate to an allowed route, with params', () => {
    const r = ok(parseVoiceReply({ ...base, action: { type: 'navigate', route: '/client/[id]', params: { id: 'c1' }, intentId: 'client.detail' } }));
    expect(r.action.type).toBe('navigate');
    expect(r.action.route).toBe('/client/[id]');
    expect(r.action.params).toEqual({ id: 'c1' });
    expect(r.action.intentId).toBe('client.detail');
  });
  it('downgrades a navigate to an UNKNOWN route to none, preserving intentId/args', () => {
    const r = ok(parseVoiceReply({ ...base, action: { type: 'navigate', route: '/made-up', intentId: 'x', args: { a: 1 } } }));
    expect(r.action.type).toBe('none');
    expect(r.action.route).toBeNull();
    expect(r.action.intentId).toBe('x');
    expect(r.action.args).toEqual({ a: 1 });
  });
  it('downgrades a navigate with no route to none', () => {
    expect(ok(parseVoiceReply({ ...base, action: { type: 'navigate' } })).action.type).toBe('none');
  });
});

describe('action: confirm_write — nothing to show downgrades to none', () => {
  it('keeps a well-formed confirm block', () => {
    const r = ok(parseVoiceReply({
      ...base,
      action: {
        type: 'confirm_write', intentId: 'task.create',
        confirm: { title: 'Naya task?', rows: [{ label: 'Kaam', value: 'Call Ramesh' }], confirmText: 'Haan' },
      },
    }));
    expect(r.action.type).toBe('confirm_write');
    expect(r.action.confirm?.rows).toEqual([{ label: 'Kaam', value: 'Call Ramesh' }]);
  });
  it('downgrades a confirm_write with no legible rows', () => {
    const r = ok(parseVoiceReply({ ...base, action: { type: 'confirm_write', confirm: { title: 't', rows: [], confirmText: 'ok' } } }));
    expect(r.action.type).toBe('none');
  });
  it('downgrades a confirm_write missing its confirm block', () => {
    expect(ok(parseVoiceReply({ ...base, action: { type: 'confirm_write' } })).action.type).toBe('none');
  });
});

describe('audio', () => {
  it('accepts a url', () => {
    const r = ok(parseVoiceReply({ ...base, audio: { mode: 'url', url: 'https://x/y.mp3', mime: 'audio/mpeg' } }));
    expect(r.audio).toEqual({ mode: 'url', url: 'https://x/y.mp3', mime: 'audio/mpeg' });
  });
  it('a url mode with no url falls back to silent', () => {
    expect(ok(parseVoiceReply({ ...base, audio: { mode: 'url' } })).audio.mode).toBe('none');
  });
  it('accepts a base64 payload', () => {
    const r = ok(parseVoiceReply({ ...base, audio: { mode: 'base64', url: 'AAAA', mime: 'audio/mpeg' } }));
    expect(r.audio.mode).toBe('base64');
    expect(r.audio.url).toBe('AAAA');
  });
  it('absent audio is silent', () => {
    expect(ok(parseVoiceReply(base)).audio.mode).toBe('none');
  });
});
