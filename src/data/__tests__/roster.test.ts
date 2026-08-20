/**
 * PHASE 65 — the pure roster join. `mergeRoster` is the whole point of the phase: the master's roster
 * universe becomes the full staff directory (from `/live-locations`) rather than only members who have
 * an assigned team-task (from `/team/task-overview`). These tests pin the two properties that make it
 * a fix rather than a regression:
 *   - a member present in live but ABSENT from the overview still appears (present-but-zeroed), and
 *   - the join is by NAME, not id (the two endpoints key on different id spaces), so enrichment still
 *     lands even though live's `userId` (`_id`) never equals overview's `user_id`.
 * `liveOnDutyPins` is pinned to never fabricate a pin (off-duty / no coordinate → skipped).
 */
import { describe, expect, it } from 'vitest';

import { mergeRoster, liveOnDutyPins, type LiveLocation, type OverviewMember } from '@/data/roster';

const liveRow = (over: Partial<LiveLocation> = {}): LiveLocation => ({
  userId: '507f1f77bcf86cd799439011',
  name: 'Asha Patel',
  role: 'advisor',
  isClockedIn: false,
  isOnBreak: false,
  ...over,
});

describe('mergeRoster', () => {
  it('keeps EVERY live person as the universe — a member with no overview match still appears', () => {
    const live = [liveRow({ userId: 'id-a', name: 'Asha' }), liveRow({ userId: 'id-b', name: 'Never Assigned' })];
    const overview: OverviewMember[] = [{ name: 'Asha', user_id: 'user_asha', counts: { done: 3, open: 2 } }];

    const roster = mergeRoster(live, overview);

    expect(roster).toHaveLength(2);
    const never = roster.find((m) => m.name === 'Never Assigned')!;
    expect(never).toBeDefined();                       // the whole bug: this member used to vanish
    expect(never.stats.policiesMtd).toBe(0);           // no task stats, but present and honest
    expect(never.stats.leads).toBe(0);
    expect(never.branch).toBe('');
  });

  it('left-joins overview stats by NORMALIZED NAME (ids never match across the two endpoints)', () => {
    const live = [liveRow({ userId: '507f-objectid', name: '  Asha Patel  ' })];
    const overview: OverviewMember[] = [{
      name: 'asha patel', user_id: 'user_999', department: 'Sales', phone: '9876543210',
      counts: { done: 5, open: 4 }, completion_pct: 82,
      tasks: [{ id: 't1', title: 'Call client', status: 'done' }, { id: 't2', title: 'Follow up', status: 'open' }],
    }];

    const [m] = mergeRoster(live, overview);

    // id stays the LIVE _id (resolves via /profiles/:id findById), NOT the overview user_id.
    expect(m.id).toBe('507f-objectid');
    expect(m.branch).toBe('Sales');
    expect(m.phone).toBe('+919876543210');             // 10 digits → +91 prefix, like getTeam
    expect(m.stats.policiesMtd).toBe(5);
    expect(m.stats.leads).toBe(4);
    expect(m.stats.renewalPct).toBe(82);
    expect(m.activity).toHaveLength(2);
    expect(m.activity[0]).toMatchObject({ text: 'Completed: Call client' });
    expect(m.activity[1]).toMatchObject({ text: 'Working on: Follow up' });
  });

  it('takes clockedIn from the LIVE row, not the overview (duty needs no join)', () => {
    const live = [liveRow({ name: 'Asha', isClockedIn: true })];
    const overview: OverviewMember[] = [{ name: 'Asha', is_active: false }];
    const [m] = mergeRoster(live, overview);
    expect(m.clockedIn).toBe(true);
    expect(m.online).toBe(false);                      // is_active:false carries through to online
  });

  it('defaults a live-only member (no overview) to online:true — a real directory account', () => {
    const [m] = mergeRoster([liveRow({ name: 'Solo' })], []);
    expect(m.online).toBe(true);
  });

  it('prefers the overview role, falling back to the live role', () => {
    const withOv = mergeRoster([liveRow({ name: 'A', role: 'advisor' })], [{ name: 'A', role: 'leader' }]);
    expect(withOv[0].role).toBe('leader');
    const liveOnly = mergeRoster([liveRow({ name: 'B', role: 'admin' })], []);
    expect(liveOnly[0].role).toBe('admin');
  });

  it('an empty overview leaves the whole live universe present and zeroed', () => {
    const roster = mergeRoster([liveRow({ name: 'X' }), liveRow({ name: 'Y' })], []);
    expect(roster.map((m) => m.name).sort()).toEqual(['X', 'Y']);
    expect(roster.every((m) => m.stats.policiesMtd === 0)).toBe(true);
  });
});

describe('liveOnDutyPins', () => {
  it('turns a clocked-in member with finite coords into an on-duty pin', () => {
    const pins = liveOnDutyPins([liveRow({ userId: 'id-1', name: 'Asha', isClockedIn: true, lat: 21.2, lng: 72.8, lastActivity: '2026-08-20T09:00:00Z' })]);
    expect(pins).toEqual([{ id: 'id-1', name: 'Asha', inLat: 21.2, inLng: 72.8, inTime: '2026-08-20T09:00:00Z', onDuty: true }]);
  });

  it('skips an off-duty member even if they somehow carry coords', () => {
    expect(liveOnDutyPins([liveRow({ isClockedIn: false, lat: 21.2, lng: 72.8 })])).toEqual([]);
  });

  it('skips a clocked-in member with no / non-finite coordinate — never fabricates a pin', () => {
    const rows = [
      liveRow({ name: 'no-coord', isClockedIn: true }),                       // lat/lng undefined
      liveRow({ name: 'nan', isClockedIn: true, lat: NaN, lng: 72.8 }),
      liveRow({ name: 'inf', isClockedIn: true, lat: Infinity, lng: 72.8 }),
    ];
    expect(liveOnDutyPins(rows)).toEqual([]);
  });
});
