/**
 * The routes voice is allowed to navigate to — a CURATED allow-list, spelled exactly as the app
 * spells them (expo-router paths). "The curated allow-list is a feature" (architecture §7): the n8n
 * reply names a route in `action.route`, and the app must REJECT an unknown route rather than guess —
 * the same posture as `pushRouting.ts` ("we never navigate on a guess"). A hallucinated or renamed
 * route therefore fails closed at the door instead of throwing inside the router.
 *
 * This is an OPT-IN list of navigable destinations. It deliberately excludes the auth/system routes a
 * spoken command should never reach — `/(auth)/login`, `/index`, `/consent`, and the layout files —
 * and the internal campaign monitor `/job/[id]`. The DESTINATION screen keeps its own permission gate
 * (e.g. `/clients` guards on `canViewClients`), so a route being navigable here does not authorise its
 * contents; it only asserts the route is real.
 *
 * Param routes are stored as their template (`/client/[id]`); the orchestrator supplies params to
 * `router.push({ pathname, params })`. Keep this in step with `src/app/**` — a route removed there
 * must be removed here, and `tsc` will NOT catch that (these are strings the router validates at run
 * time), so the parity is guarded by a test that reads the real route files.
 */

/** Static (no-param) destinations voice may open. */
export const VOICE_ROUTES_STATIC = [
  '/(tabs)/home',
  '/(tabs)/tasks',
  '/(tabs)/claims',
  '/(tabs)/search',
  '/(tabs)/more',
  '/(tabs)/leads',
  '/(tabs)/clients',
  '/attendance',
  '/calendar',
  '/reminders',
  '/notifications',
  '/notes',
  '/notice-board',
  '/commissions',
  '/earnings',
  '/contests',
  '/kb',
  '/lic-plans',
  '/campaigns',
  '/prospects',
  '/segments',
  '/families',
  '/analytics',
  '/agent-map',
  '/agent-track',
  '/monitor',
  '/performance',
  '/payroll',
  '/team',
  '/whatsapp',
  '/tickets',
  '/settings',
  '/profile',
  '/account',
  '/notify',
  '/task-new',
] as const;

/** Param destinations, as templates. The orchestrator fills `[id]` from `action.params`. */
export const VOICE_ROUTES_PARAM = [
  '/client/[id]',
  '/lead/[id]',
  '/claim/[id]',
  '/task/[id]',
  '/team/[id]',
  '/tickets/[id]',
  '/whatsapp/[id]',
] as const;

export type VoiceRoute = (typeof VOICE_ROUTES_STATIC)[number] | (typeof VOICE_ROUTES_PARAM)[number];

const ALLOWED: ReadonlySet<string> = new Set<string>([...VOICE_ROUTES_STATIC, ...VOICE_ROUTES_PARAM]);

/** Is `route` a real, voice-navigable destination? Membership only — fails closed on anything else. */
export function isAllowedVoiceRoute(route: string | null | undefined): route is VoiceRoute {
  return typeof route === 'string' && ALLOWED.has(route);
}

/** True when the route needs an `id` param (a `[id]` template) — the orchestrator must supply one. */
export function voiceRouteNeedsId(route: string): boolean {
  return (VOICE_ROUTES_PARAM as readonly string[]).includes(route);
}
