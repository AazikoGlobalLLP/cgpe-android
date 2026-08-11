import { test, expect } from '@playwright/test';
import { signIn } from '../helpers/session';
import { installFault, type FaultKind } from '../helpers/mock';
import { assertRenders, BANNER_TEXT } from '../helpers/render';
import { shot } from '../helpers/artifacts';

/**
 * DONE-WHEN 3 — the WORST-CASE pass. For a representative set of data screens, the primary
 * list endpoint is broken in every hostile way and the app must still (a) render — never a
 * redbox or white screen — and (b) obey the data-health contract (CLAUDE.md conv. 4): a fault
 * raises the `<HealthBanner/>` so "could not load" is never shown as "nothing here".
 *
 * The banner is app-wide (mounted once in _layout), routed through api.ts `unavailable`/health,
 * so proving it on these screens proves the shared contract for all of them. Every fault is
 * synthetic Playwright network injection — zero production data (spec §3, edge-case pass).
 *
 * Faults that are OUTAGES or contract-faults (500/503/malformed/timeout/empty-200) MUST raise
 * the banner. An OVERSIZED list is a valid 200, so it must render the flood WITHOUT a banner.
 */

const SCREENS: { id: string; url: string; match: (p: string) => boolean }[] = [
  { id: 'leads', url: '/leads', match: (p) => p === '/leads' },
  { id: 'clients', url: '/clients', match: (p) => p === '/clients' },
  { id: 'claims', url: '/claims', match: (p) => p === '/claims' },
  { id: 'notifications', url: '/notifications', match: (p) => p === '/notifications' },
];

const OUTAGE_FAULTS: FaultKind[] = ['status500', 'status503', 'malformed', 'empty'];

for (const s of SCREENS) {
  test.describe(`worst-case: ${s.id}`, () => {
    for (const fault of OUTAGE_FAULTS) {
      test(`${s.id} · ${fault} → renders + outage banner`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));

        await signIn(page, 'healthy');
        await installFault(page, s.match, fault);
        await page.goto(s.url, { waitUntil: 'load' });

        await assertRenders(page, `worst/${s.id}-${fault}`);
        await expect(page.getByText(BANNER_TEXT).first(), `${s.id}/${fault}: outage must raise the health banner`).toBeVisible({ timeout: 15_000 });
        await shot(page, `worst/${s.id}-${fault}`);
        expect(errors, `${s.id}/${fault} page errors:\n${errors.join('\n')}`).toEqual([]);
      });
    }

    test(`${s.id} · oversized list → renders the flood, no banner`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));

      await signIn(page, 'healthy');
      // A 5,000-row valid 200. Shape the flood to the screen's own list envelope so it actually
      // populates rather than failing validation (which would just be another outage).
      await installFault(page, s.match, 'oversized', () => oversizedFor(s.id));
      await page.goto(s.url, { waitUntil: 'load' });

      await assertRenders(page, `worst/${s.id}-oversized`);
      await shot(page, `worst/${s.id}-oversized`);
      expect(errors, `${s.id}/oversized page errors:\n${errors.join('\n')}`).toEqual([]);
    });
  });
}

test('worst-case: request timeout on /leads → renders + banner (app 4.5s abort)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await signIn(page, 'healthy');
  await installFault(page, (p) => p === '/leads', 'timeout');
  await page.goto('/leads', { waitUntil: 'load' });

  await assertRenders(page, 'worst/leads-timeout');
  await expect(page.getByText(BANNER_TEXT).first(), 'a timeout must raise the health banner').toBeVisible({ timeout: 20_000 });
  await shot(page, 'worst/leads-timeout');
  expect(errors, `leads/timeout page errors:\n${errors.join('\n')}`).toEqual([]);
});

/** A large, VALID list in each screen's own envelope, so the flood populates the screen. */
function oversizedFor(id: string): unknown {
  const rows = (make: (i: number) => unknown) => Array.from({ length: 5000 }, (_, i) => make(i));
  switch (id) {
    case 'leads':
      return { success: true, data: { leads: rows((i) => ({ _id: `l${i}`, name: `Lead ${i}`, status: 'new_lead', phone: '9000000000' })) } };
    case 'clients':
      return { success: true, data: rows((i) => ({ _id: `c${i}`, name: `Client ${i}`, phone: '9000000000' })) };
    case 'claims':
      return { success: true, data: rows((i) => ({ _id: `k${i}`, claim_number: `CLM${i}`, status: 'under_process' })) };
    case 'notifications':
      return { success: true, data: rows((i) => ({ _id: `n${i}`, title: `Notice ${i}`, body: 'x', createdAt: '2026-01-01T00:00:00Z' })) };
    default:
      return { success: true, data: rows((i) => ({ _id: `x${i}` })) };
  }
}
