import { describe, it, expect } from 'vitest';
import { clockKeyFor } from '@/lib/clockKey';

/**
 * The clock marker key is written by Home and read by attendance.tsx + agent-map.tsx. Round-3 loophole
 * audit (2026-08-25): the readers had drifted to the OLD device-scoped `clock.<date>` that nothing
 * writes any more, so a clocked-in day rendered "Not clocked in". This pins the ONE builder they now
 * share so writer and readers can't diverge again — and that it is per-USER (shared-handset safety).
 */
describe('clockKeyFor', () => {
  const day = new Date('2026-08-25T09:00:00Z');

  it('is per-user AND per-day', () => {
    expect(clockKeyFor('user_a', day)).toBe(`clock.user_a.${day.toDateString()}`);
    expect(clockKeyFor('user_b', day)).toBe(`clock.user_b.${day.toDateString()}`);
  });

  it('two different users NEVER share a key on the same day (no shared-handset bleed)', () => {
    expect(clockKeyFor('user_a', day)).not.toBe(clockKeyFor('user_b', day));
  });

  it('falls back to "anon" for a missing user id, still namespaced (not the bare device key)', () => {
    expect(clockKeyFor(null, day)).toBe(`clock.anon.${day.toDateString()}`);
    expect(clockKeyFor(undefined, day)).toBe(`clock.anon.${day.toDateString()}`);
    // The regression this guards: it must NOT collapse to the old device-scoped `clock.<date>`.
    expect(clockKeyFor(null, day)).not.toBe('clock.' + day.toDateString());
  });
});
