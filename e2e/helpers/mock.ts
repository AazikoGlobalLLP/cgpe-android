import type { Page, Route } from '@playwright/test';

/**
 * PHASE 18 — the deterministic backend for the harness. Every app request goes to
 * `${API_BASE_URL}${path}` (api.ts req()), which on the localhost web build is
 * `http://localhost:3001/api/...`. NONE of it is allowed to reach a real server: this module
 * intercepts `**​/api/**` and answers synthetically, so the whole suite is offline, repeatable,
 * and touches ZERO production data (spec §3).
 *
 * Two backends are modelled:
 *   • installHealthyBackend  — 2xx with each endpoint's real envelope SHAPE but empty contents,
 *     so screens render their healthy "nothing yet" state with no outage banner. Shapes are
 *     taken from src/data/api.ts's validators, not guessed:
 *        - most reads validate an array          → { success, data: [] }
 *        - the isObj reads (grep `, isObj)`)      → { success, data: {} }
 *        - /team/task-overview needs data.members → { data: { members: [] } }
 *        - /leads reads data.leads                → { data: { leads: [] } }
 *        - /lic-plans reads data.plans            → { data: { plans: [] } }
 *        - /rbac/app-ui needs data.dashboard      → a valid, everything-visible config
 *     No business VALUES are invented — only empty containers — so nothing here can be mistaken
 *     for real customer data.
 *   • fault injectors (installFault) — 500 / 503+Retry-After / empty / malformed / timeout /
 *     oversized, per endpoint, for the worst-case pass.
 *
 * Auth: the login endpoints are always mocked so a sign-in never needs a server. The returned
 * TOKEN decides the session mode (api.ts setAuthToken): a `demo-` token makes `sessionReal`
 * false so every data call short-circuits to the honest-empty/degraded path with no network
 * (the pure-UI degraded walk); any other token makes calls real, so mocks/faults take effect.
 */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'Content-Type,Authorization',
  'x-e2e-mock': '1',
};

const json = (obj: unknown) => ({
  status: 200,
  contentType: 'application/json',
  headers: CORS,
  body: JSON.stringify(obj),
});

/** App path with the `.../api` prefix stripped: `/api/leads?x` and `/internal/api/leads` → `/leads`. */
function apiPath(url: string): string {
  const u = new URL(url);
  return u.pathname.replace(/^.*?\/api/, '') || '/';
}

/**
 * A single-record read `/resource/<id>` — where `<id>` actually LOOKS like an id. This must
 * NOT swallow named sub-resources on the same collections (`/team/task-overview`,
 * `/clients/segments`, `/families/stats`), which are real endpoints, not records — 404-ing
 * those breaks the screens that depend on them and raises spurious banners.
 */
function isDetailById(path: string): boolean {
  const m = path.split('?')[0].match(/^\/(leads|clients|profiles|families|insurance-kb|tickets|claims|team|reminders|notifications)\/([^/]+)$/);
  if (!m) return false;
  const id = m[2];
  return /^e2e-/.test(id)               // the harness's own synthetic ids
    || /^[0-9a-f]{24}$/i.test(id)       // mongo ObjectId
    || /^\d+$/.test(id)                 // numeric id
    || /^[0-9a-f-]{20,}$/i.test(id);    // uuid-ish
}

/** A valid, everything-visible server-driven UI doc. normalizeUiConfig (appUi.tsx) fills the
 *  widget/tab lists from DEFAULT_UI when they are empty, so this stays short but unlocks the
 *  full menu and every capability — the widest surface to walk. */
function appUiDoc() {
  return {
    success: true,
    data: {
      role_key: 'e2e_full',
      label: 'E2E full access',
      dashboard: { hero: 'clock_and_tasks', widgets: [] },
      nav: { tabs: [], more_sections: [], hidden: [] },
      features: {
        can_clock_in: true, can_create_task: true, can_assign_task_to_others: true,
        can_create_claim: true, can_advance_claim_status: true, can_claim_ticket: true,
        can_send_campaign: true, can_dispatch_notification: true, can_view_team_roster: true,
        can_view_agent_map: true, can_view_movement_paths: true, can_view_org_analytics: true,
        can_export_data: true, can_edit_client: true,
      },
    },
  };
}

/** A synthetic signed-in user. Clearly labelled E2E so it can never read as a real staff member.
 *  role super_admin → Master tier (store/roles.ts tierOf), the widest set of screens. */
export function e2eUser() {
  return {
    user_id: 'e2e-user-1', full_name: 'E2E Tester', email: 'e2e@cgpe.test',
    phone: '9000000000', role: 'super_admin', designation: 'QA', branch: 'E2E',
    agent_code: 'E2E01', tier: 'Elite',
  };
}

/** Healthy body for a given app path. Empty containers only — shapes match api.ts validators. */
function healthyBody(path: string): unknown {
  const p = path.split('?')[0];

  if (p === '/rbac/app-ui') return appUiDoc();
  if (p === '/auth/me') return { success: true, data: { user: e2eUser() } };
  // One synthetic member (not empty): an empty roster makes getTeam fall back to /profiles and
  // report, raising a spurious banner on every screen whose dashboard underlay renders the team
  // widget. One clearly-labelled E2E member keeps getTeam/getTasks/getAgentLocations on the
  // clean task-overview path.
  if (p === '/team/task-overview') {
    return { success: true, data: { members: [{ user_id: 'e2e-user-1', name: 'E2E Tester', role: 'advisor', phone: '', tasks: [] }] } };
  }
  if (p === '/leads') return { success: true, data: { leads: [] } };
  if (p === '/lic-plans') return { success: true, data: { plans: [] } };
  if (p === '/time-tracker/current') return { success: true, data: { active: false } };
  if (p === '/prospects/segments') return { success: true, data: [] };

  // Stat/summary object reads (isObj). Returning a bare `{}` is UNREALISTIC and dangerous: a
  // real backend always returns these fields, and several screens dereference them unguarded
  // (e.g. analytics does `campaignSummary.total_clients.toLocaleString()`), so `{}` crashes a
  // screen that `null` would have degraded safely. Zero-FILLED shapes (fields taken verbatim
  // from the api.ts return types — no invented names) render clean "nothing yet" screens.
  const STAT_OBJECTS: Record<string, unknown> = {
    '/clients/stats/overview': { total_clients: 0, total_premium: 0, total_sum_assured: 0, birthdays_this_month: 0 },
    '/campaigns/summary': { total_clients: 0, opted_in: 0, birthday_today: 0, birthday_month: 0, anniversary_month: 0, renewal_due: 0, maturity_soon: 0 },
    '/dashboard/overview': { clients: { total: 0 }, claims: { total: 0, under_process: 0, passed: 0, paid_amount: 0 }, tickets: { total: 0 } },
  };
  if (STAT_OBJECTS[p]) return { success: true, data: STAT_OBJECTS[p] };

  // Other isObj reads with no field-level dereference risk: an empty object passes isObj.
  const OBJECT_EXACT = new Set([
    '/claims/stats/summary', '/commissions', '/campaigns/audience', '/families/stats',
    '/clients/generate-report',
  ]);
  if (OBJECT_EXACT.has(p)) return { success: true, data: {} };

  // Everything else is a list read validating an array.
  return { success: true, data: [] };
}

/** Answer login/OTP so a sign-in never needs a server. `token` sets the session mode. */
async function fulfillAuth(route: Route, path: string, token: string): Promise<boolean> {
  const p = path.split('?')[0];
  if (p === '/auth/login' || p === '/auth/verify-otp') {
    await route.fulfill(json({ success: true, data: { token, user: e2eUser() } }));
    return true;
  }
  if (p === '/auth/request-otp') {
    await route.fulfill(json({ success: true, message: 'Code sent to your WhatsApp number.' }));
    return true;
  }
  return false;
}

/** Preflight for the cross-origin POSTs the login form makes. */
async function maybePreflight(route: Route): Promise<boolean> {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS, body: '' });
    return true;
  }
  return false;
}

export type SessionMode = 'healthy' | 'demo';

/**
 * Install the base backend. `healthy` → a real (non-demo) token + empty-but-valid responses,
 * so the app makes real (mocked) calls and screens render clean. `demo` → a `demo-` token, so
 * `sessionReal` is false and every data call short-circuits offline to the degraded/empty path.
 */
export async function installBackend(page: Page, mode: SessionMode): Promise<void> {
  const token = mode === 'demo' ? `demo-e2e-${Date.now()}` : `e2e-real-${Date.now()}`;
  await page.route('**/api/**', async (route) => {
    if (await maybePreflight(route)) return;
    const path = apiPath(route.request().url());
    if (await fulfillAuth(route, path, token)) return;
    // A write (POST/PUT/PATCH/DELETE) that is not auth: accept it so optimistic UI settles.
    const method = route.request().method();
    if (method !== 'GET') { await route.fulfill(json({ success: true, data: {} })); return; }
    // A detail read for a record that does not exist on a healthy backend → 404, which the
    // detail screens are built to show as "not found". This is MORE realistic than a partial
    // synthetic object (a healthy backend has no record `e2e-1`), and 404 is a suppressed
    // status so it raises no outage banner (api.ts reportIfOutage).
    if (isDetailById(path)) { await route.fulfill({ status: 404, contentType: 'application/json', headers: CORS, body: JSON.stringify({ success: false, error: 'Not found' }) }); return; }
    await route.fulfill(json(healthyBody(path)));
  });
}

export type FaultKind =
  | 'status500' | 'status503' | 'empty' | 'malformed' | 'timeout' | 'oversized' | 'status400' | 'status403';

/**
 * Overlay a fault on the endpoints whose app-path matches `match`. Installed AFTER a base
 * backend, so unmatched endpoints keep answering healthily and only the injected one breaks —
 * exactly the "partial outage" the health channel is built to distinguish (CLAUDE.md conv. 4).
 *
 * `oversized` needs a shape builder because "a huge list" differs per endpoint; the caller
 * passes one when it wants a specific screen flooded, else a generic large array is returned.
 */
export async function installFault(
  page: Page,
  match: (path: string) => boolean,
  kind: FaultKind,
  oversized?: () => unknown,
): Promise<void> {
  await page.route('**/api/**', async (route, _req) => {
    if (await maybePreflight(route)) return;
    const path = apiPath(route.request().url());
    if (!match(path) || route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    switch (kind) {
      case 'status500':
        await route.fulfill({ status: 500, contentType: 'application/json', headers: CORS, body: JSON.stringify({ success: false, error: 'Internal Server Error' }) });
        return;
      case 'status503':
        await route.fulfill({ status: 503, contentType: 'application/json', headers: { ...CORS, 'retry-after': '30' }, body: JSON.stringify({ success: false, error: 'Service Unavailable' }) });
        return;
      case 'status400':
        await route.fulfill({ status: 400, contentType: 'application/json', headers: CORS, body: JSON.stringify({ success: false, error: 'Bad Request' }) });
        return;
      case 'status403':
        await route.fulfill({ status: 403, contentType: 'application/json', headers: CORS, body: JSON.stringify({ success: false, error: 'Forbidden' }) });
        return;
      case 'empty':
        // A 200 with an unusable body: the health channel must treat this as a fault, not "empty".
        await route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ success: true }) });
        return;
      case 'malformed':
        await route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{ this is : not json,,,' });
        return;
      case 'oversized':
        await route.fulfill(json(oversized ? oversized() : { success: true, data: Array.from({ length: 5000 }, (_, i) => ({ _id: `x${i}`, id: `x${i}`, name: `Row ${i}` })) }));
        return;
      case 'timeout':
        // Longer than api.ts REQUEST_TIMEOUT (4.5 s) so the AbortController fires — the app's
        // real timeout path, exercised without actually hanging the whole suite.
        await new Promise((r) => setTimeout(r, 6000));
        await route.abort('timedout');
        return;
    }
  });
}
