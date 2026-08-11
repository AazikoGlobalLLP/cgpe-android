import { test, expect } from '@playwright/test';
import { signIn } from '../helpers/session';
import { assertRenders, bannerVisible, ROUTES } from '../helpers/render';

/**
 * DONE-WHEN 2 — the A-to-Z NORMAL-state walk. Signs in once against the healthy mock backend,
 * then deep-links to every web-reachable screen and asserts each renders (no white screen, no
 * error boundary) with a screenshot per screen. One continuous run so the user can WATCH it go
 * top to bottom; it does not stop at the first bad screen — every route is attempted and the
 * failures are listed at the end.
 *
 * "Normal" here = a healthy backend with no records yet, so screens show their clean empty
 * state. No business values are invented (the mock returns empty containers), so nothing on
 * screen can be mistaken for real customer data.
 */

type Row = { id: string; url: string; ok: boolean; banner: boolean; error?: string };

test('A-to-Z normal-state render walk (healthy backend)', async ({ page }) => {
  test.setTimeout(300_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await signIn(page, 'healthy');

  const rows: Row[] = [];
  for (const r of ROUTES) {
    await test.step(`${r.id} (${r.url})`, async () => {
      try {
        await page.goto(r.url, { waitUntil: 'load' });
        await assertRenders(page, `normal/${r.id}`);
        rows.push({ id: r.id, url: r.url, ok: true, banner: await bannerVisible(page) });
      } catch (e) {
        rows.push({ id: r.id, url: r.url, ok: false, banner: await bannerVisible(page), error: (e as Error).message.split('\n')[0] });
      }
    });
  }

  // Pass/fail table into the run log (also visible in the HTML report's stdout).
  const line = (r: Row) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.banner ? 'banner ' : '       '} ${r.id.padEnd(16)} ${r.url}${r.error ? '  <- ' + r.error : ''}`;
  console.log('\n===== NORMAL-STATE WALK =====\n' + rows.map(line).join('\n') +
    `\n\n${rows.filter((r) => r.ok).length}/${rows.length} rendered; ${rows.filter((r) => r.banner).length} showed the outage banner.\n`);

  const failed = rows.filter((r) => !r.ok);
  expect(failed, `screens that failed to render:\n${failed.map(line).join('\n')}`).toEqual([]);
  expect(pageErrors, `uncaught page errors during the walk:\n${pageErrors.join('\n')}`).toEqual([]);
});
