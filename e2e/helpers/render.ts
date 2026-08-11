import { expect, type Page } from '@playwright/test';
import { shot } from './artifacts';

/**
 * Strings that only appear when React/RN/Metro has thrown into an error boundary or redbox.
 * None of these occur in the app's own healthy copy, so any of them on screen = a broken render.
 */
const REDBOX = [
  'element type is invalid',
  'objects are not valid as a react child',
  'a component suspended while responding',
  'unexpected text node',
  'render error',
  'call stack',
  'maximum update depth exceeded',
  'too many re-renders',
];

/** The HealthBanner's own heading (ui/health-banner.tsx:88). Its presence = degraded state. */
export const BANNER_TEXT = 'Some data could not load';

export async function bannerVisible(page: Page): Promise<boolean> {
  return page.getByText(BANNER_TEXT).isVisible().catch(() => false);
}

/**
 * Wait for a route to actually paint, then assert it rendered rather than white-screened or
 * dropped into an error boundary, and capture a still. Returns the visible text so a caller can
 * make route-specific checks. Never throws for a "slow" screen — only for a broken one.
 */
export async function assertRenders(page: Page, name: string): Promise<string> {
  // The animated Splash overlays until fonts + auth are ready; wait for real content underneath.
  await page
    .waitForFunction(() => document.body.innerText.replace(/\s+/g, ' ').trim().length > 30, null, { timeout: 25_000 })
    .catch(() => {});
  await page.waitForTimeout(500); // let list/skeleton transitions settle for a clean shot

  const body = (await page.locator('body').innerText()).toLowerCase();

  // 1. Not an error boundary / redbox.
  for (const r of REDBOX) {
    expect(body, `${name}: error-boundary text "${r}" is on screen`).not.toContain(r);
  }
  // 2. Not a blank white screen.
  expect(body.replace(/\s+/g, ' ').trim().length, `${name}: screen rendered blank`).toBeGreaterThan(0);

  await shot(page, name);
  return body;
}

/** The web-reachable route inventory (PROJECT_MAP §3 / spec §4). `id` names the screenshot. */
export type RouteSpec = { id: string; url: string; group: 'auth' | 'tab' | 'stack' | 'detail' };

export const ROUTES: RouteSpec[] = [
  // tabs
  { id: 'home', url: '/', group: 'tab' },
  { id: 'tasks', url: '/tasks', group: 'tab' },
  { id: 'clients', url: '/clients', group: 'tab' },
  { id: 'claims', url: '/claims', group: 'tab' },
  { id: 'leads', url: '/leads', group: 'tab' },
  { id: 'more', url: '/more', group: 'tab' },
  // flat stack
  { id: 'account', url: '/account', group: 'stack' },
  { id: 'agent-map', url: '/agent-map', group: 'stack' },
  { id: 'agent-track', url: '/agent-track', group: 'stack' },
  { id: 'analytics', url: '/analytics', group: 'stack' },
  { id: 'attendance', url: '/attendance', group: 'stack' },
  { id: 'calendar', url: '/calendar', group: 'stack' },
  { id: 'campaigns', url: '/campaigns', group: 'stack' },
  { id: 'claim-new', url: '/claim-new', group: 'stack' },
  { id: 'commissions', url: '/commissions', group: 'stack' },
  { id: 'contests', url: '/contests', group: 'stack' },
  { id: 'families', url: '/families', group: 'stack' },
  { id: 'kb', url: '/kb', group: 'stack' },
  { id: 'lic-plans', url: '/lic-plans', group: 'stack' },
  { id: 'notes', url: '/notes', group: 'stack' },
  { id: 'notice-board', url: '/notice-board', group: 'stack' },
  { id: 'notifications', url: '/notifications', group: 'stack' },
  { id: 'notify', url: '/notify', group: 'stack' },
  { id: 'premium', url: '/premium', group: 'stack' },
  { id: 'profile', url: '/profile', group: 'stack' },
  { id: 'prospects', url: '/prospects', group: 'stack' },
  { id: 'reminders', url: '/reminders', group: 'stack' },
  { id: 'search', url: '/search', group: 'stack' },
  { id: 'segments', url: '/segments', group: 'stack' },
  { id: 'settings', url: '/settings', group: 'stack' },
  { id: 'task-new', url: '/task-new', group: 'stack' },
  { id: 'team', url: '/team', group: 'stack' },
  { id: 'tickets', url: '/tickets', group: 'stack' },
  { id: 'whatsapp', url: '/whatsapp', group: 'stack' },
  // Detail screens — a synthetic id that is MONGO-OBJECTID-SHAPED (24 hex). It must match
  // api.ts's ID_SEGMENT regex so healthKey() collapses `/leads/<id>` → `/leads/:id`; with a
  // non-id-shaped slug the suppression key and the unavailable key disagree and a suppressed
  // 404 leaks a false outage banner.
  { id: 'lead-detail', url: '/lead/0123456789abcdef01234567', group: 'detail' },
  { id: 'client-detail', url: '/client/0123456789abcdef01234567', group: 'detail' },
  { id: 'claim-detail', url: '/claim/0123456789abcdef01234567', group: 'detail' },
  { id: 'task-detail', url: '/task/0123456789abcdef01234567', group: 'detail' },
  { id: 'team-detail', url: '/team/0123456789abcdef01234567', group: 'detail' },
  { id: 'ticket-detail', url: '/tickets/0123456789abcdef01234567', group: 'detail' },
  { id: 'whatsapp-detail', url: '/whatsapp/0123456789abcdef01234567', group: 'detail' },
  { id: 'job-detail', url: '/job/0123456789abcdef01234567', group: 'detail' },
];
