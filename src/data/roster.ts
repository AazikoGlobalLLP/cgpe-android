/**
 * PHASE 65 — the master's roster universe.
 *
 * The monitor roster and the agent map used to draw their *universe of people* from
 * `/team/task-overview`, whose `members[]` are grouped by `team_tasks` assignee. A staff member
 * with zero assigned team-tasks therefore never entered the list — the owner's "only appears after
 * they open the app" bug (the true condition was "has ≥1 team_task"). The super_admin-gated
 * `GET /time-tracker/live-locations` instead iterates EVERY profile, so it is the correct universe.
 *
 * This module is the PURE join between the two sources, kept in its own tested file because the
 * network layer (`api.ts`) has no test-friendly seam. `mergeRoster` left-joins the full live-location
 * universe with the task-overview stats; `liveOnDutyPins` turns the clocked-in members into map pins.
 *
 * ⚠️ JOIN KEY IS THE NORMALIZED NAME, NOT AN ID. `/live-locations` keys each person by
 * `profile._id` (a 24-hex ObjectId) while `/team/task-overview` keys by the `user_id` FIELD (a
 * `user_...` string) — the two id spaces never match, so an id-join would enrich nobody. Name is the
 * only shared key, which is exactly why `getTeam`'s existing on-duty cross-reference already falls
 * back to matching names. A missed enrichment leaves a member present-but-zeroed — honest, and never
 * vanished. Duty (`clockedIn`) comes straight from each live row, so it needs no join at all.
 */
import type { AgentPin } from './api';
import type { TeamActivity, TeamMember } from './team';

/** One row of `GET /time-tracker/live-locations` after `api.ts` maps it (see `mapLiveLocation`). */
export type LiveLocation = {
  userId: string;        // profile._id (24-hex). Resolves via `/profiles/:id` findById on tap.
  name: string;
  email?: string;
  role: string;
  isClockedIn: boolean;
  isOnBreak: boolean;
  lat?: number;          // from currentLocation.lat — present only while clocked in
  lng?: number;
  lastActivity?: string;
};

/** The subset of a `/team/task-overview` member that carries the stats we graft on. Structural. */
export type OverviewMember = {
  name: string;
  user_id?: string;
  role?: string;
  department?: string;
  phone?: string;
  is_active?: boolean;
  counts?: { total?: number; open?: number; done?: number; overdue?: number };
  completion_pct?: number;
  tasks?: any[];
};

const norm = (s: any): string => String(s ?? '').trim().toLowerCase();

/** Same phone shaping `getTeam` applies to the task-overview roster, so both paths look identical. */
const phoneFmt = (p: any): string =>
  p ? (String(p).length === 10 ? '+91' + p : '+' + String(p).replace(/^\+/, '')) : '';

/**
 * Full-directory roster: the live-locations universe LEFT-JOINED with task-overview stats by name.
 * Every live person appears exactly once; those matched to an overview member gain task counts /
 * department / phone / activity, the rest appear off-duty-aware with zeroed stats (never dropped).
 */
export function mergeRoster(live: LiveLocation[], overview: OverviewMember[]): TeamMember[] {
  const byName = new Map<string, OverviewMember>();
  for (const m of overview) {
    const k = norm(m.name);
    if (k && !byName.has(k)) byName.set(k, m); // first wins — a duplicate name keeps the earlier row
  }

  return live.map((p) => {
    const m = byName.get(norm(p.name));
    const activity: TeamActivity[] = (m?.tasks || []).slice(0, 6).map((t: any, i: number) => ({
      id: String(t.id || i),
      icon: 'checkbox-outline',
      text: `${norm(t.status) === 'done' ? 'Completed' : 'Working on'}: ${t.title}`,
      at: t.updated_at || t.created_at || new Date().toISOString(),
    })) as TeamActivity[];

    return {
      id: String(p.userId),
      name: p.name || 'Member',
      role: m?.role || p.role || 'advisor',
      phone: phoneFmt(m?.phone),
      email: p.email || undefined,
      agentCode: '',
      tier: 'Growth',
      branch: m?.department || '',
      // A live-only row carries no is_active (the payload omits it); it is a real directory account,
      // so treat it as an active member rather than hiding it.
      online: m ? m.is_active !== false : true,
      clockedIn: !!p.isClockedIn, // authoritative — the live row's own daylog, no join needed
      lastActive: p.lastActivity || new Date().toISOString(),
      stats: {
        clients: 0,
        premiumMtd: 0,
        policiesMtd: m?.counts?.done ?? 0,
        renewalPct: m?.completion_pct ?? 0,
        openClaims: 0,
        leads: m?.counts?.open ?? 0,
      },
      activity,
    } as TeamMember;
  });
}

/**
 * Map pins for whoever is clocked in RIGHT NOW, straight from `/live-locations` (one call, no
 * per-member fan-out). A member with no finite clock-in coordinate is skipped — the map never
 * fabricates a pin — but still appears in the roster via `mergeRoster`.
 */
export function liveOnDutyPins(live: LiveLocation[]): AgentPin[] {
  const pins: AgentPin[] = [];
  for (const p of live) {
    if (!p.isClockedIn) continue;
    if (typeof p.lat !== 'number' || !isFinite(p.lat)) continue;
    if (typeof p.lng !== 'number' || !isFinite(p.lng)) continue;
    pins.push({
      id: String(p.userId),
      name: p.name || 'Agent',
      inLat: p.lat,
      inLng: p.lng,
      inTime: p.lastActivity || undefined,
      onDuty: true,
    });
  }
  return pins;
}
