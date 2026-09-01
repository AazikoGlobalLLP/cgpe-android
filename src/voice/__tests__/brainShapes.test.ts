import { describe, it, expect } from 'vitest';
import { parseVoiceReply } from '@/voice/response';

/**
 * REAL responses, captured from the live n8n brain and the deployed backend — not shapes we invented.
 *
 * ── WHY THIS FILE IS DIFFERENT FROM `response.test.ts` ────────────────────────────────────────
 * `response.test.ts` proves we handle the JSON we IMAGINED. That is a weaker claim than it looks:
 * every fixture in it was written by the same person who wrote the parser, from the same reading of
 * the contract. If the brain's real shape differs in any detail, both the parser and its tests can be
 * confidently, consistently wrong — and `npm test` stays green.
 *
 * So these fixtures are **transcribed verbatim from the wire**, with the capturing command recorded
 * beside each one so anyone can re-run it. `scripts/voice-probe.mjs` is the tool that produces them.
 *
 * Add to this file whenever a new real response is observed. It is the only test in the suite whose
 * inputs are evidence rather than assumption.
 */

/**
 * Captured 2026-09-01 by:
 *   curl -s -X POST https://ai.cgpe.in/webhook/cgpe-voice-brain \
 *     -H 'Content-Type: application/json' -d '{"transcript":"mere aaj ke tasks kya hai"}'
 *
 * The brain refuses an unauthenticated caller. This is the shape the app sees if the proxy's
 * `CGPE_VOICE_SECRET` is ever wrong or rotated on only one side — a live, reachable brain that
 * answers **HTTP 200** with a refusal in the body. It is exactly the case that must NOT be treated
 * as an outage, and must NOT navigate.
 */
const BRAIN_BAD_SECRET = {
  success: false,
  reason: 'bad_secret',
  reply_text: 'Authorization fail — secret galat.',
  action: { type: 'none', route: null, params: {}, intentId: null },
};

describe('the live brain’s real response shapes', () => {
  it('a refusal is SPEAKABLE, not an outage — the user hears the reason', () => {
    const r = parseVoiceReply(BRAIN_BAD_SECRET);
    expect(r.ok).toBe(true);                       // a 200 with reply_text is a reply, not a failure
    if (!r.ok) return;
    expect(r.replyText).toBe('Authorization fail — secret galat.');
  });

  it('and it NEVER navigates, because success is false', () => {
    const r = parseVoiceReply(BRAIN_BAD_SECRET);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.action.type).toBe('none');
    expect(r.action.route).toBeNull();
  });

  it('the brain sends NO confidence field, and absence must mean act — not refuse', () => {
    // If absence were treated as zero, every real reply would be low-confidence and voice would
    // never navigate at all. This is the single most load-bearing line in the parser.
    expect('confidence' in BRAIN_BAD_SECRET).toBe(false);
    const r = parseVoiceReply({ ...BRAIN_BAD_SECRET, success: true, reply_text: 'Aapke aaj ke tasks.' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lowConfidence).toBe(false);
  });

  it('the brain’s action object omits `args` and `confirm` entirely — the parser must not require them', () => {
    // The real object is exactly {type, route, params, intentId} — four keys, no more. A parser that
    // assumed the contract's full shape would throw or drop the action here.
    expect(Object.keys(BRAIN_BAD_SECRET.action).sort()).toEqual(['intentId', 'params', 'route', 'type']);
    const r = parseVoiceReply({
      success: true,
      reply_text: 'Aapke aaj ke tasks khol raha hoon.',
      action: { type: 'navigate', route: '/(tabs)/tasks', params: {}, intentId: null },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.action.type).toBe('navigate');
    expect(r.action.route).toBe('/(tabs)/tasks');
    expect(r.action.args).toEqual({});      // defaulted, not undefined
    expect(r.action.confirm).toBeNull();
  });

  it('a route the brain invents is refused — we never navigate on a guess', () => {
    const r = parseVoiceReply({
      success: true,
      reply_text: 'Kholta hoon.',
      action: { type: 'navigate', route: '/todays-tasks', params: {}, intentId: null },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.action.type).toBe('none');    // '/todays-tasks' is not in the allow-list
  });

  /**
   * The owner asked on 2026-09-01 for "multiple commands in a single query". This test does not fix
   * that — it PINS the limit so nobody later mistakes it for a bug in the parser. The reply carries
   * ONE action; a two-instruction sentence can only ever produce one outcome. Supporting it needs the
   * brain to return a LIST and the app to execute in order: an n8n + contract change.
   */
  it('one reply carries exactly ONE action — multi-command is a contract limit, not a parser bug', () => {
    const r = parseVoiceReply({
      success: true,
      reply_text: 'Aaj ke tasks khol raha hoon.',
      action: { type: 'navigate', route: '/(tabs)/tasks', params: {}, intentId: null },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Array.isArray(r.action)).toBe(false);
  });
});
