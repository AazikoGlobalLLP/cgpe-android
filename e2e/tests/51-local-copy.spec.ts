import { test, expect } from '@playwright/test';
import { signIn } from '../helpers/session';
import { assertRenders } from '../helpers/render';
import { en, gu, hi, hiEn, guEn } from '../../src/i18n/generated/phase118';

const languages = [
  { code: 'en', label: 'English', table: en },
  { code: 'gu', label: 'Gujarati', table: gu },
  { code: 'hi', label: 'Hindi', table: hi },
  { code: 'hi-en', label: 'Hinglish', table: hiEn },
  { code: 'gu-en', label: 'Roman Gujarati', table: guEn },
];
const clientId = '0123456789abcdef01234567';
const rawClientId = '1123456789abcdef01234567';
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

for (const { code, label, table } of languages) {
  test(`local record copy and authored names in ${code}`, async ({ page }) => {
    test.setTimeout(150_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await signIn(page, 'healthy'); // Installs the catch-all API mock before navigation.
    await page.route(/\/api\/(clients|claims)\/[0-9a-f]{24}(\?.*)?$/, async route => {
      if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
      const url = new URL(route.request().url());
      const claim = url.pathname.includes('/claims/');
      const data = claim
        ? { id: clientId, claim_number: 'E2E-COPY-1', documents_received: true, created_at: '2026-09-01T08:00:00Z', status: 'submitted' }
        : { _id: url.pathname.endsWith(rawClientId) ? rawClientId : clientId, ...(url.pathname.endsWith(rawClientId) ? { name: 'Customer' } : {}), policyNo: 'E2E-POLICY', mode: 'Yearly' };
      await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
    });
    await page.goto('/settings');
    await assertRenders(page, `local-copy/${code}/settings`, { settleSplash: true });
    await page.getByText(label, { exact: true }).first().click();
    if (code !== 'en') {
      await expect.poll(() => page.evaluate((expected) => Object.entries(localStorage)
        .some(([key, value]) => key.includes('lang') && value === expected), code)).toBe(true);
    }

    await page.goto(`/client/${clientId}`);
    await expect(page.getByText(table['record.customer'], { exact: true }).first()).toBeVisible();
    await assertRenders(page, `local-copy/${code}/client-fallback`, { settleSplash: true });

    await page.goto(`/client/${rawClientId}`);
    await expect(page.getByText('Customer', { exact: true }).first()).toBeVisible();
    await assertRenders(page, `local-copy/${code}/client-authored`, { settleSplash: true });

    await page.goto(`/claim/${clientId}`);
    await expect(page.getByText(table['record.claimant'], { exact: true }).first()).toBeVisible();
    await expect(page.getByText(table['record.allDocuments'], { exact: true })).toBeVisible();
    await expect(page.getByText(table['record.claimRegistered'], { exact: true })).toBeVisible();
    await assertRenders(page, `local-copy/${code}/claim-fallback`, { settleSplash: true });
    expect(errors).toEqual([]);
  });
}
