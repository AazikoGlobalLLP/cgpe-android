/**
 * dispatch.ts is the write security core, so the tests pin the exact guarantees: an unknown id is
 * refused, a forbidden write never reaches the confirm card, the confirm tap is required, and — the
 * load-bearing one — the gate is re-checked a SECOND time at the execution instant, so a state change
 * between render and tap cannot slip a write past. And that v1 keeps writes dark.
 */
import { describe, it, expect, vi } from 'vitest';
import { runWriteIntent, VOICE_WRITES_ENABLED, type WriteDispatchDeps } from '@/voice/dispatch';
import type { GateContext } from '@/voice/gate';
import type { User, Role } from '@/data/types';
import type { VoiceRunOutcome } from '@/voice/types';

function mkUser(role: Role): User {
  return { id: 'u1', name: 'T', email: 't@x.io', phone: '9', role, designation: '', branch: '', agentCode: '', tier: 'Star' };
}
/** A gate context; `self` passes for any signed-in user. */
function ctx(user: User | null): GateContext {
  return { user, ready: true, flagValue: () => undefined };
}

const advisor = mkUser('advisor');

function deps(over: Partial<WriteDispatchDeps> = {}): WriteDispatchDeps {
  return {
    gateContext: () => ctx(advisor),
    confirm: async () => true,
    execute: async () => 'saved',
    enabled: true,
    ...over,
  };
}

describe('lookup — unknown or non-write ids are refused', () => {
  it('refuses an id the registry does not know', async () => {
    expect(await runWriteIntent('made.up', {}, deps())).toEqual({ kind: 'refused', reason: 'unknown' });
  });
  it('refuses a READ intent routed here', async () => {
    expect(await runWriteIntent('tasks.today.count', {}, deps())).toEqual({ kind: 'refused', reason: 'unknown' });
  });
});

describe('🔴 re-gate #1 — a forbidden write never shows a card', () => {
  it('refuses before calling confirm when the gate fails at render', async () => {
    const confirm = vi.fn(async () => true);
    // task.add is gated self+flag; use a null user so the self gate fails.
    const r = await runWriteIntent('task.add', { title: 'x' }, deps({ gateContext: () => ctx(null), confirm }));
    expect(r).toEqual({ kind: 'refused', reason: 'forbidden' });
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe('the confirm tap is required', () => {
  it('a declined card cancels and never executes', async () => {
    const execute = vi.fn(async () => 'saved' as VoiceRunOutcome);
    const r = await runWriteIntent('note.add', { text: 'x' }, deps({ confirm: async () => false, execute }));
    expect(r).toEqual({ kind: 'cancelled' });
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('🔴 re-gate #2 — the gate is re-checked at the execution instant', () => {
  it('a state change between render and tap blocks the write (fresh context each call)', async () => {
    // Pass at render (#1), then a null user by the time of execution (#2).
    const contexts = [ctx(advisor), ctx(null)];
    const gateContext = vi.fn(() => contexts.shift() ?? ctx(null));
    const execute = vi.fn(async () => 'saved' as VoiceRunOutcome);
    const r = await runWriteIntent('note.add', { text: 'x' }, deps({ gateContext, execute }));
    expect(r).toEqual({ kind: 'refused', reason: 'forbidden' });
    expect(gateContext).toHaveBeenCalledTimes(2); // both re-gates fired
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('v1 keeps writes dark', () => {
  it('the module flag is off', () => {
    expect(VOICE_WRITES_ENABLED).toBe(false);
  });
  it('with enabled=false everything passes but the write does not run', async () => {
    const execute = vi.fn(async () => 'saved' as VoiceRunOutcome);
    const r = await runWriteIntent('note.add', { text: 'x' }, deps({ enabled: false, execute }));
    expect(r).toEqual({ kind: 'disabled' });
    expect(execute).not.toHaveBeenCalled();
  });
  it('with no executor wired it is also disabled', async () => {
    const r = await runWriteIntent('note.add', { text: 'x' }, deps({ execute: undefined }));
    expect(r).toEqual({ kind: 'disabled' });
  });
});

describe('the happy path (v1.1)', () => {
  it('gates pass + tapped + enabled + executor → done with the outcome', async () => {
    const r = await runWriteIntent('note.add', { text: 'x' }, deps({ execute: async () => 'queued' }));
    expect(r).toEqual({ kind: 'done', outcome: 'queued' });
  });
});
