import { test, expect } from '@playwright/test';
import { signIn } from '../helpers/session';
import { assertRenders, healthBanner } from '../helpers/render';

test('malformed family counts render an unconfirmed state instead of crashing', async ({ page }) => {
  await signIn(page, 'healthy');
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'Content-Type,Authorization',
    'x-e2e-mock': '1',
  };
  await page.route('**/api/families/stats', async route => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers, body: '' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json',
      headers,
      body: JSON.stringify({ success: true, data: {} }) });
  });
  const delivered = page.waitForResponse(response => response.url().endsWith('/api/families/stats')
    && response.request().method() === 'GET' && response.status() === 200);
  await page.goto('/families', { waitUntil: 'load' });
  const response = await delivered;
  expect(await response.finished()).toBeNull();
  expect(await response.json()).toEqual({ success: true, data: {} });
  await assertRenders(page, 'families/malformed-counts', { settleSplash: true });
  await expect(healthBanner(page)).toBeVisible();
});
