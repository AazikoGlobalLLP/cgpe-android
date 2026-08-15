/**
 * The per-member completed-tasks report + monthly performance score, pinned.
 * `getTaskReport(month, {scope,userId})` → `GET /api/team/task-report?month=YYYY-MM…`
 * (`contracts/api.md` §`/api/team`, cgpe-api Backend Phase 53).
 *
 * WHAT THIS GUARDS. The SERVER owns the score (owner-locked: manager-assigned + actually
 * completed only; importance×timeliness; cancelled/reminders/self-created excluded; per
 * due-month). The app must **render, never recompute** (rule 2), so these tests assert the
 * mapper passes every count/score through verbatim and never fabricates. It is admin/master
 * monitoring data, so there are TWO outcomes told apart by `req()`:
 *   - a 200 `{ data:{ month, members[], totals } }` → `{ status:'ok', report }`;
 *   - a 5xx / network / shape-drift → `{ status:'error' }` + banner; a 401/403/404 answer must NOT banner.
 * `score` is a server integer 0–100 OR `null` ("no tasks") — `null` must stay distinct from `0`.
 *
 * FETCH IS STUBBED at the one boundary `api.ts` calls. `api.ts` holds mutable module state with
 * no reset export, so every test re-imports it (CLAUDE.md).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
type Health = typeof import('@/data/health');
let api: Api;
let health: Health;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** A `/task-report` `data` payload exactly as the backend serialises it. */
const rep = (over: Record<string, unknown> = {}) => ({
  month: '2026-08',
  members: [
    {
      name: 'Asha Patel', user_id: 'u1', role: 'advisor', department: 'SALES',
      counts: { assigned: 4, completed: 3, on_time: 2, late: 1, not_completed: 1 },
      score: 71,
      completed_tasks: [
        { id: 't1', title: 'Call renewal', priority: 'P1', due_at: '2026-08-05T00:00:00.000Z', completed_at: '2026-08-04T00:00:00.000Z', on_time: true },
        { id: 't2', title: 'File claim', priority: 'P3', due_at: '2026-08-10T00:00:00.000Z', completed_at: '2026-08-12T00:00:00.000Z', on_time: false },
      ],
    },
  ],
  totals: { members: 1, assigned: 4, completed: 3, on_time: 2, late: 1 },
  ...over,
});

const serve = (status: number, body: unknown) => fetchSpy.mockImplementation(async () => reply(status, body));
const urls = () => fetchSpy.mock.calls.map((c) => String(c[0]));

beforeEach(async () => {
  vi.resetModules();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  health = await import('@/data/health');
  api.setAuthToken('test-token');   // a token starting `demo-` would NOT make the session real
});

describe('getTaskReport — the request', () => {
  it('GETs /team/task-report with the month, and adds scope + user_id only when given', async () => {
    serve(200, { success: true, data: rep() });
    await api.getTaskReport('2026-08', { scope: 'all' });
    expect(urls()[0]).toContain('/team/task-report');
    expect(urls()[0]).toContain('month=2026-08');
    expect(urls()[0]).toContain('scope=all');
    expect(urls()[0]).not.toContain('user_id');
  });

  it('includes user_id when a member is targeted', async () => {
    serve(200, { success: true, data: rep() });
    await api.getTaskReport('2026-08', { scope: 'own', userId: 'u9' });
    expect(urls()[0]).toContain('user_id=u9');
    expect(urls()[0]).toContain('scope=own');
  });

  it('omits scope/user_id entirely when no options are passed', async () => {
    serve(200, { success: true, data: rep() });
    await api.getTaskReport('2026-08');
    expect(urls()[0]).toContain('month=2026-08');
    expect(urls()[0]).not.toContain('scope=');
    expect(urls()[0]).not.toContain('user_id');
  });
});

describe('getTaskReport — the mapping (server owns every number)', () => {
  it('unwraps { data } to { status:"ok", report } with counts mapped snake→camel', async () => {
    serve(200, { success: true, data: rep() });
    const r = await api.getTaskReport('2026-08', { scope: 'all' });
    expect(r.status).toBe('ok');
    expect(r.status === 'ok' && r.report.month).toBe('2026-08');
    expect(r.status === 'ok' && r.report.members[0].counts).toEqual({
      assigned: 4, completed: 3, onTime: 2, late: 1, notCompleted: 1,
    });
    expect(r.status === 'ok' && r.report.totals).toEqual({
      members: 1, assigned: 4, completed: 3, onTime: 2, late: 1,
    });
  });

  it('passes the score through verbatim — no on-device recomputation', async () => {
    serve(200, { success: true, data: rep({ members: [{ ...rep().members[0], score: 88 }] }) });
    const r = await api.getTaskReport('2026-08');
    expect(r.status === 'ok' && r.report.members[0].score).toBe(88);
  });

  it('keeps score:null ("no tasks") distinct from score:0 (earned nothing)', async () => {
    serve(200, { success: true, data: rep({ members: [
      { name: 'No Work', user_id: 'u2', role: 'advisor', department: 'OPS', counts: { assigned: 0, completed: 0, on_time: 0, late: 0, not_completed: 0 }, score: null, completed_tasks: [] },
      { name: 'All Late', user_id: 'u3', role: 'advisor', department: 'OPS', counts: { assigned: 2, completed: 0, on_time: 0, late: 0, not_completed: 2 }, score: 0, completed_tasks: [] },
    ] }) });
    const r = await api.getTaskReport('2026-08', { scope: 'all' });
    expect(r.status === 'ok' && r.report.members[0].score).toBeNull();
    expect(r.status === 'ok' && r.report.members[1].score).toBe(0);
  });

  it('maps completed_tasks rows (snake→camel) and carries on_time as a boolean', async () => {
    serve(200, { success: true, data: rep() });
    const r = await api.getTaskReport('2026-08');
    expect(r.status === 'ok' && r.report.members[0].completedTasks).toEqual([
      { id: 't1', title: 'Call renewal', priority: 'P1', dueAt: '2026-08-05T00:00:00.000Z', completedAt: '2026-08-04T00:00:00.000Z', onTime: true },
      { id: 't2', title: 'File claim', priority: 'P3', dueAt: '2026-08-10T00:00:00.000Z', completedAt: '2026-08-12T00:00:00.000Z', onTime: false },
    ]);
  });

  it('coerces a missing dueAt/completedAt/priority to null and a non-boolean on_time to false', async () => {
    serve(200, { success: true, data: rep({ members: [{
      name: 'Odd', user_id: 'u4', role: null, department: null,
      counts: { assigned: 1, completed: 1, on_time: 1, late: 0, not_completed: 0 }, score: 100,
      completed_tasks: [{ id: 't9', title: 'No dates', on_time: 'yes' }],
    }] }) });
    const r = await api.getTaskReport('2026-08');
    expect(r.status === 'ok' && r.report.members[0].completedTasks[0]).toEqual({
      id: 't9', title: 'No dates', priority: null, dueAt: null, completedAt: null, onTime: false,
    });
    expect(r.status === 'ok' && r.report.members[0].role).toBeNull();
  });

  it('drops junk member rows and coerces non-numeric counts to 0 rather than rendering junk', async () => {
    serve(200, { success: true, data: rep({ members: [
      null,
      { name: 'Bad', user_id: 'u5', counts: { assigned: 'x', completed: -3, on_time: 1.9, late: null, not_completed: 2 }, score: 'NaN', completed_tasks: 'nope' },
    ] }) });
    const r = await api.getTaskReport('2026-08', { scope: 'all' });
    expect(r.status === 'ok' && r.report.members.length).toBe(1);
    expect(r.status === 'ok' && r.report.members[0].counts).toEqual({
      assigned: 0, completed: 0, onTime: 1, late: 0, notCompleted: 2,   // 'x'→0, -3→0, 1.9→1, null→0
    });
    expect(r.status === 'ok' && r.report.members[0].score).toBeNull();  // 'NaN' string → null
    expect(r.status === 'ok' && r.report.members[0].completedTasks).toEqual([]);
  });

  it('raises no outage banner on a healthy read', async () => {
    serve(200, { success: true, data: rep() });
    await api.getTaskReport('2026-08');
    expect(health.getHealth().degraded).toBe(false);
  });
});

describe('getTaskReport — an empty month is a valid ok, not an error', () => {
  it('returns { status:"ok" } with members:[] on a healthy 200 and raises NO banner', async () => {
    serve(200, { success: true, data: { month: '2026-08', members: [], totals: { members: 0, assigned: 0, completed: 0, on_time: 0, late: 0 } } });
    const r = await api.getTaskReport('2026-08', { scope: 'all' });
    expect(r.status).toBe('ok');
    expect(r.status === 'ok' && r.report.members).toEqual([]);
    expect(health.getHealth().degraded).toBe(false);
    expect(health.getHealth().failures).not.toContain('/team/task-report');
  });
});

describe('getTaskReport — outages and answers are told apart', () => {
  it('returns { status:"error" } on 503 and DOES raise the banner under /team/task-report', async () => {
    serve(503, { success: false, error: 'Database not connected' });
    const r = await api.getTaskReport('2026-08', { scope: 'all' });
    expect(r.status).toBe('error');
    expect(health.getHealth().degraded).toBe(true);
    expect(health.getHealth().failures).toContain('/team/task-report');
  });

  it('returns { status:"error" } on 403 (wrong role) but raises NO banner (an answer, not an outage)', async () => {
    serve(403, { success: false, message: 'Forbidden' });
    const r = await api.getTaskReport('2026-08', { scope: 'all' });
    expect(r.status).toBe('error');
    expect(health.getHealth().degraded).toBe(false);
    expect(health.getHealth().failures).not.toContain('/team/task-report');
  });

  it('returns { status:"error" } and reports a fault when the 200 body has no members array', async () => {
    serve(200, { success: true, data: { month: '2026-08', totals: {} } });   // shape drift, not an empty month
    const r = await api.getTaskReport('2026-08');
    expect(r.status).toBe('error');
    expect(health.getHealth().failures).toContain('/team/task-report');
  });

  it('returns { status:"error" } and raises the banner when the network throws', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const r = await api.getTaskReport('2026-08', { scope: 'all' });
    expect(r.status).toBe('error');
    expect(health.getHealth().degraded).toBe(true);
  });

  it('makes no request at all on a demo session', async () => {
    api.setAuthToken('demo-token');
    const r = await api.getTaskReport('2026-08', { scope: 'all' });
    expect(r.status).toBe('error');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
