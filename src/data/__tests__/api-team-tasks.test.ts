/**
 * PHASE 53b — `adaptTeamTask` due-date + completion mapping, pinned at the wire.
 *
 * THE BUG THIS FILE GUARDS AGAINST (owner #1, 2026-08-18). An undated `team_tasks` row used to get
 * `dueDate = raw.updated_at` (the server's touch-time). Every status change bumps `updated_at`, so a
 * complete→reopen re-bucketed the task into today/overdue and the "today" count animated wrong.
 * The fix: an undated task keeps `dueDate === ''` (Invalid-Date-safe → sorts 'upcoming', renders '-'),
 * and `completedAt`/`createdAt` read BOTH snake and camel casings (team_tasks serialises camelCase).
 *
 * FETCH IS STUBBED, not mocked-through: `api.ts` is the only file that calls `fetch`, so a stub at
 * that boundary exercises the real `req`/`tryReal` paths. `api.ts` holds mutable module state with no
 * reset export, so every test re-imports it (CLAUDE.md).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dueBucket, type Task } from '@/data/tasks';

type Api = typeof import('@/data/api');
let api: Api;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** A `/team/task-overview` member carrying raw team_tasks rows (camelCase, as the handler serialises). */
const overview = (tasks: Record<string, unknown>[]) => ({
  success: true,
  data: { members: [{ name: 'Asha', user_id: 'u-asha', role: 'advisor', tasks }] },
});

function serve(tasks: Record<string, unknown>[]) {
  fetchSpy.mockImplementation(async (url: string) => {
    if (url.includes('/team/task-overview')) return reply(200, overview(tasks));
    return reply(404, { success: false });
  });
}

beforeEach(async () => {
  vi.resetModules();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  api.setAuthToken('test-token');   // a token starting `demo-` would NOT make the session real
});

const byId = (list: Task[], id: string) => list.find((t) => t.id === id)!;

describe('adaptTeamTask — due date never follows the server touch-time', () => {
  it('maps dated / undated / done rows exactly', async () => {
    serve([
      { _id: 'dated', title: 'Call', status: 'open', priority: 'P1', type: 'call',
        dueAt: '2026-08-20T09:00:00.000Z', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-10T00:00:00.000Z' },
      { _id: 'undated', title: 'File', status: 'open', priority: 'P2', type: 'task',
        createdAt: '2026-08-05T00:00:00.000Z', updatedAt: '2026-08-15T00:00:00.000Z' },
      { _id: 'donedated', title: 'Renew', status: 'completed', priority: 'P3', type: 'renewal',
        dueAt: '2026-08-12T00:00:00.000Z', createdAt: '2026-08-02T00:00:00.000Z', updatedAt: '2026-08-18T06:00:00.000Z' },
      { _id: 'doneundated', title: 'Note', status: 'done', priority: 'P2', type: 'task',
        createdAt: '2026-08-03T00:00:00.000Z', updatedAt: '2026-08-18T07:00:00.000Z' },
    ]);
    const list = await api.getTasks();

    const dated = byId(list, 'dated');
    expect(dated.dueDate).toBe('2026-08-20T09:00:00.000Z');
    expect(dated.status).toBe('todo');
    expect(dated.completedAt).toBeUndefined();
    expect(dated.createdAt).toBe('2026-08-01T00:00:00.000Z'); // camelCase createdAt read

    const undated = byId(list, 'undated');
    expect(undated.dueDate).toBe('');                         // THE fix
    expect(undated.dueDate).not.toBe('2026-08-15T00:00:00.000Z'); // NOT the updated_at it used to steal
    expect(undated.status).toBe('todo');
    expect(undated.completedAt).toBeUndefined();

    const doneDated = byId(list, 'donedated');
    expect(doneDated.status).toBe('done');                    // 'completed' ∈ DONE_WORDS
    expect(doneDated.dueDate).toBe('2026-08-12T00:00:00.000Z');
    expect(doneDated.completedAt).toBe('2026-08-18T06:00:00.000Z'); // updatedAt (camel) as completion proxy

    // An undated DONE task still gets a completion timestamp (so "today" can credit it) and dueDate ''.
    const doneUndated = byId(list, 'doneundated');
    expect(doneUndated.dueDate).toBe('');
    expect(doneUndated.status).toBe('done');
    expect(doneUndated.completedAt).toBe('2026-08-18T07:00:00.000Z');
  });
});

/*
 * PHASE 53a consumption — a CLAIMED TICKET now surfaces as a task. cgpe-api Backend Phase 68 mirrors
 * a claimed/assigned ticket into `team_tasks` (source:'ticket'), and the follow-up set its dueAt to
 * the ticket's own createdAt (its claim date) so the mobile list buckets it Today/Overdue rather than
 * Upcoming (owner request, verified in routes/tickets.js syncTicketTaskMirror). Mobile needs no code
 * change to consume it — this pins that end-to-end: the mirror row maps to a DATED task in the right
 * bucket, so a ticket claimed today lands on the default 'today' Tasks view.
 */
describe('adaptTeamTask — a claimed-ticket mirror (source:ticket, dueAt=claim date) is a DATED task', () => {
  const NOW = new Date(2026, 7, 18, 12, 0, 0);              // local noon, 18 Aug 2026
  const at = (offsetDays: number) => new Date(2026, 7, 18 + offsetDays, 9, 0, 0).toISOString();

  it('buckets a ticket claimed today as Today and an older one as Overdue (never Upcoming)', async () => {
    serve([
      { _id: 'tkA', taskId: 'ticket:tkA', type: 'task', title: 'Handle request', status: 'open',
        priority: 'P2', source: 'ticket', assigneeName: 'Asha', dueAt: at(0), createdAt: at(0), updatedAt: at(0) },
      { _id: 'tkB', taskId: 'ticket:tkB', type: 'task', title: 'Old request', status: 'open',
        priority: 'P3', source: 'ticket', assigneeName: 'Asha', dueAt: at(-8), createdAt: at(-8), updatedAt: at(-8) },
    ]);
    const list = await api.getTasks();

    const a = byId(list, 'tkA');
    expect(a.dueDate).toBe(at(0));            // a REAL ticket date — not '' (would hide it under Upcoming)
    expect(dueBucket(a, NOW)).toBe('today');  // so a freshly-claimed ticket shows on the default Today view

    const b = byId(list, 'tkB');
    expect(b.dueDate).toBe(at(-8));
    expect(dueBucket(b, NOW)).toBe('overdue');// an older claimed ticket reads as needing attention
  });
});
