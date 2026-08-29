/**
 * The registry is the curated voice allow-list — its correctness is a security property, so the tests
 * pin the invariants that keep it safe: the id/key consistency, that clock.* is navigate-not-write
 * (never bypassing the compliance sheets), that only the three additive creates are writes, that every
 * NOT_VOICE_EXPOSED id is absent, and that every navigate route is a real allow-listed route.
 */
import { describe, it, expect } from 'vitest';
import { VOICE_INTENTS, NOT_VOICE_EXPOSED, getVoiceIntent, isKnownIntent } from '@/voice/registry';
import { isAllowedVoiceRoute } from '@/voice/routes';

describe('lookup', () => {
  it('resolves a known id and rejects an unknown one', () => {
    expect(getVoiceIntent('tasks.today.count')?.id).toBe('tasks.today.count');
    expect(getVoiceIntent('made.up')).toBeUndefined();
    expect(getVoiceIntent(null)).toBeUndefined();
    expect(isKnownIntent('clock.in')).toBe(true);
    expect(isKnownIntent('clockIn')).toBe(false);
    expect(isKnownIntent(undefined)).toBe(false);
  });
});

describe('structural invariants', () => {
  it("every intent's id matches its key", () => {
    for (const [key, intent] of Object.entries(VOICE_INTENTS)) {
      expect(intent.id).toBe(key);
    }
  });
  it('every intent has a valid kind and an array of requiredArgs', () => {
    for (const intent of Object.values(VOICE_INTENTS)) {
      expect(['read', 'write', 'navigate']).toContain(intent.kind);
      expect(Array.isArray(intent.requiredArgs)).toBe(true);
    }
  });
});

describe('🔴 clock.in / clock.out are NAVIGATE, never write', () => {
  for (const id of ['clock.in', 'clock.out']) {
    it(`${id} is a navigate intent that opens the home clock control`, () => {
      const intent = VOICE_INTENTS[id];
      expect(intent.kind).toBe('navigate');
      expect(intent.kind).not.toBe('write');
      expect(intent.write).toBeUndefined();
      expect(intent.route).toBe('/(tabs)/home');
    });
  }
});

describe('writes — only the three additive creates, each tagged', () => {
  it('exactly note.add / task.add / lead.add are writes, each with a write fn tag', () => {
    const writes = Object.values(VOICE_INTENTS).filter((i) => i.kind === 'write');
    expect(writes.map((i) => i.id).sort()).toEqual(['lead.add', 'note.add', 'task.add']);
    for (const w of writes) {
      expect(w.write).toBeTruthy();
      expect(['addNote', 'addTask', 'addLead']).toContain(w.write);
    }
  });
  it('no read/navigate intent carries a write fn tag', () => {
    for (const i of Object.values(VOICE_INTENTS)) {
      if (i.kind !== 'write') expect(i.write).toBeUndefined();
    }
  });
  it('task.add is gated by can_create_task (a flag that can only narrow)', () => {
    const g = VOICE_INTENTS['task.add'].gate;
    expect(g).toEqual({ kind: 'self', flag: 'can_create_task' });
  });
});

describe('client PII intents use the client-book gate', () => {
  it('client.detail is gated on the own client book', () => {
    expect(VOICE_INTENTS['client.detail'].gate).toEqual({ kind: 'clientBook', scope: 'own' });
    expect(VOICE_INTENTS['client.detail'].needsEntity).toBe(true);
  });
});

describe('🔴 forbidden ids are absent by construction', () => {
  for (const id of NOT_VOICE_EXPOSED) {
    it(`${id} is not a registry key`, () => {
      expect(Object.prototype.hasOwnProperty.call(VOICE_INTENTS, id)).toBe(false);
    });
  }
});

describe('every navigate intent points at a real allow-listed route', () => {
  it('navigate routes are in the routes allow-list', () => {
    for (const i of Object.values(VOICE_INTENTS)) {
      if (i.kind === 'navigate') {
        expect(i.route).toBeTruthy();
        expect(isAllowedVoiceRoute(i.route)).toBe(true);
      }
    }
  });
});
