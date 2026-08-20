/**
 * Pure decision seam for push notifications (Phase 72, Tier B — team-targeted push).
 *
 * WHY A SEPARATE PURE FILE. The native orchestration lives in `lib/push.ts`, which imports
 * `expo-notifications` and therefore cannot be unit-tested (there is no expo-notifications stub
 * in the Vitest env, exactly as with `lib/tracker.ts`). The two honest decisions push makes —
 * "where should a tap go?" and "should we re-tell the server our token?" — are lifted here so
 * they ARE tested, and `push.ts` stays a thin wire between the OS and these functions.
 */

/**
 * The set of destinations a notification tap is allowed to open. Deliberately tiny: tasks and
 * leads are TABS (there is no per-item detail route), so the honest landing for a task push is
 * the Tasks tab where the new row appears, and for a lead the Leads tab. Anything we cannot map
 * confidently falls back to the notification feed — the one screen that is always correct.
 *
 * Mirrors the posture of `notifications.tsx`: "a row that goes somewhere plausible but wrong is
 * worse than one that stays put." We never navigate on a guess.
 */
export type PushRoute = '/notifications' | '/tasks' | '/leads';

const SAFE_ROUTES: readonly PushRoute[] = ['/notifications', '/tasks', '/leads'];

/**
 * Maps the backend's push `data.type` to a screen. The keys cover every event Phase 72 fires
 * (new department task, task reassign/transfer, a due/overdue reminder, and a new lead), plus a
 * few reasonable synonyms so a small backend wording change doesn't silently drop a tap onto the
 * fallback. Unknown types intentionally miss and route to the feed.
 */
const TYPE_ROUTE: Record<string, PushRoute> = {
  task: '/tasks',
  task_assigned: '/tasks',
  task_reassigned: '/tasks',
  task_transfer: '/tasks',
  task_reminder: '/tasks',
  reminder: '/tasks',
  lead: '/leads',
  lead_assigned: '/leads',
  new_lead: '/leads',
};

/**
 * The route a tap on a push/notification should open, derived from its data payload. Total and
 * safe: any shape in, a known route out.
 *
 * Resolution order:
 *  1. An explicit `data.url` — but ONLY if it is one of our known-safe routes. A url the app
 *     cannot honour (a web link, a not-yet-built detail path) is ignored rather than obeyed, so
 *     the backend can start sending deep-link urls before the app grows the matching screens.
 *  2. `data.type` mapped through the table above.
 *  3. The notification feed, which is always a correct place to land.
 */
export function routeForPush(data?: Record<string, unknown> | null): PushRoute {
  const d = data ?? {};

  const url = typeof d.url === 'string' ? d.url.trim() : '';
  if ((SAFE_ROUTES as readonly string[]).includes(url)) return url as PushRoute;

  const type = typeof d.type === 'string' ? d.type.trim().toLowerCase() : '';
  return TYPE_ROUTE[type] ?? '/notifications';
}

/**
 * Whether we should (re-)tell the server about a push token.
 *
 * A push token is stable across most app opens, so blindly POSTing it on every sign-in would
 * hammer `/push/register` for no reason. We register only when we actually hold a token AND it
 * differs from the one we last sent (persisted per install). A blank/absent token is never
 * registered — there is nothing to send, and clearing the server-side row is `unregister`'s job,
 * not a side effect of an empty read.
 */
export function shouldReRegister(
  prevToken: string | null | undefined,
  nextToken: string | null | undefined,
): boolean {
  const next = (nextToken ?? '').trim();
  if (!next) return false;
  return next !== (prevToken ?? '').trim();
}
