import { test, expect, type Page, type Request, type Route } from '@playwright/test';
import { signIn } from '../helpers/session';
import { e2eUser } from '../helpers/mock';

/**
 * Uses only existing controls and mocked transport. After signIn, every navigation is
 * inside the running app: goto/reload would destroy the job and invalidate these tests.
 */
const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'Content-Type,Authorization,Idempotency-Key',
  'x-e2e-mock': '1',
};
const response = (body: unknown) => ({ status: 200, contentType: 'application/json', headers, body: JSON.stringify(body) });
const audience = {
  success: true,
  data: { count: 2, matched: 2, sample: [
    { name: 'E2E Recipient One', phone: '9000000001', message: 'Synthetic greeting one.' },
    { name: 'E2E Recipient Two', phone: '9000000002', message: 'Synthetic greeting two.' },
  ] },
};
const jobPill = (page: Page, label = 'Birthdays campaign') =>
  page.getByText(new RegExp(`^${label} \\u00b7 \\d+/\\d+$`));

async function preflight(route: Route): Promise<boolean> {
  if (route.request().method() !== 'OPTIONS') return false;
  await route.fulfill({ status: 204, headers, body: '' });
  return true;
}

/** Existing Header button + tab testID; no router import or application test hook. */
async function openMore(page: Page): Promise<void> {
  for (let i = 0; i < 3 && !(await page.getByTestId('tab-more').isVisible()); i++) {
    await page.getByRole('button', { name: /^(Go back|Wapas jayein)$/, exact: true }).click();
  }
  await expect(page.getByTestId('tab-more')).toBeVisible();
  await page.getByTestId('tab-more').click();
  await expect(page).toHaveURL(/\/more$/);
}

async function openCampaigns(page: Page): Promise<void> {
  await openMore(page);
  await page.getByRole('button', { name: /Campaigns.*Bulk sends/ }).click();
  await expect(page).toHaveURL(/\/campaigns$/);
  // The exact accessible button name distinguishes Segmented from the birthday KPI.
  const preview = page.waitForResponse(res => {
    const url = new URL(res.url());
    return url.pathname.endsWith('/campaigns/audience') && url.searchParams.get('type') === 'birthday' && res.status() === 200;
  });
  await page.getByRole('button', { name: 'Birthdays', exact: true }).click();
  expect(await (await preview).finished()).toBeNull();
  await expect(page.getByRole('button', { name: 'Send to all 2', exact: true })).toBeEnabled();
}

async function startBirthday(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Send to all 2', exact: true }).click();
  await page.getByRole('dialog').getByText('Start sending', { exact: true }).click();
}

/** Reuse the real login form WITHOUT signIn()'s fresh page.goto/backend registration. */
async function signInSecondOwner(page: Page): Promise<void> {
  await expect(page.getByText('Welcome back', { exact: true })).toBeVisible();
  await page.getByPlaceholder(/you@cgpe/i).fill('e2e-second@cgpe.test');
  await page.getByPlaceholder(/CGPE password/i).fill('e2e-password-123');
  await page.getByText('Sign in', { exact: true }).first().click();
  await expect(page.getByTestId('tab-more')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Object.entries(localStorage).some(([key, value]) => {
    if (!key.includes('cgpe.user')) return false;
    try { return JSON.parse(value)?.id === 'e2e-user-2'; } catch { return false; }
  }))).toBe(true);
}

test('an active job relabels on language change and dispatches exactly once', async ({ page }) => {
  // signIn installs the catch-all **/api/** synthetic backend before its first goto.
  await signIn(page, 'healthy');
  const apiReplies: { url: string; mocked: string | undefined }[] = [];
  page.on('response', res => {
    if (new URL(res.url()).pathname.includes('/api/')) apiReplies.push({ url: res.url(), mocked: res.headers()['x-e2e-mock'] });
  });
  await page.route('**/api/campaigns/audience?*', async route => {
    if (await preflight(route)) return;
    await route.fulfill(response(audience));
  });
  const sends: Request[] = [];
  const heldSends: Route[] = [];
  await page.route('**/api/campaigns/send', async route => {
    if (await preflight(route)) return;
    sends.push(route.request());
    heldSends.push(route); // Keep the actual dispatch pending while the language changes.
  });

  try {
    // Warm the Settings route before starting the 30-second campaign transport deadline.
    await openMore(page);
    await page.getByRole('button', { name: /Settings.*Security, (language|bhasha)/ }).click();
    await expect(page.getByText('App language', { exact: true })).toBeVisible();
    await openCampaigns(page);
    await startBirthday(page);
    await expect.poll(() => sends.length).toBe(1);
    await page.getByRole('dialog').getByText('Monitor progress', { exact: true }).click();
    await expect(page).toHaveURL(/\/job\/job_\d+$/);
    const jobUrl = page.url();
    const documentStartedAt = await page.evaluate(() => performance.timeOrigin);
    await expect(page.getByText('Birthdays campaign', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Building audience…', { exact: true })).toBeVisible();

    await openMore(page);
    await page.getByRole('button', { name: /Settings.*Security, (language|bhasha)/ }).click();
    await page.getByText('Hinglish', { exact: true }).first().click();
    await expect(page.getByText('App ki bhasha', { exact: true })).toBeVisible();
    await expect(jobPill(page, 'Janmdin campaign')).toBeVisible();
    await expect(jobPill(page)).toHaveCount(0);
    await jobPill(page, 'Janmdin campaign').click();

    // Same job identity and same document: this is a rerender of the existing job.
    await expect(page).toHaveURL(jobUrl);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStartedAt);
    await expect(page.getByText('Janmdin campaign', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Recipients ki list ban rahi hai…', { exact: true })).toBeVisible();
    await expect(page.getByText('Audience taiyaar hai, 2 recipients ke liye personalised messages hain.', { exact: true })).toBeVisible();
    await expect(page.getByText('Chaaloo', { exact: true })).toBeVisible();
    expect(sends).toHaveLength(1);
    expect(sends[0].postDataJSON()).toEqual({ type: 'birthday' });

    const delivered = page.waitForResponse(res => res.request() === sends[0] && res.status() === 200);
    await heldSends.shift()!.fulfill(response({ success: true, data: { count: 2 } }));
    expect(await (await delivered).finished()).toBeNull();
    await expect(page.getByText('Samaapt', { exact: true })).toBeVisible();
    await expect(page.getByText('Bheja gaya', { exact: true }).first()).toBeVisible();
    expect(sends).toHaveLength(1);
    expect(apiReplies.length).toBeGreaterThan(0);
    expect(apiReplies.every(item => item.mocked === '1')).toBe(true);
  } finally {
    for (const route of heldSends) await route.abort('failed').catch(() => {});
  }
});

test('changing owner drops the old job and its late audience cannot send', async ({ page }) => {
  await signIn(page, 'healthy');
  let holdNextBirthdayAudience = false;
  let heldAudience: Route | undefined;
  await page.route('**/api/campaigns/audience?*', async route => {
    if (await preflight(route)) return;
    if (holdNextBirthdayAudience && new URL(route.request().url()).searchParams.get('type') === 'birthday') {
      holdNextBirthdayAudience = false;
      heldAudience = route;
      return;
    }
    await route.fulfill(response(audience));
  });
  const sends: Request[] = [];
  await page.route('**/api/campaigns/send', async route => {
    if (await preflight(route)) return;
    sends.push(route.request());
    await route.fulfill(response({ success: true, data: { count: 2 } }));
  });
  const secondUser = { ...e2eUser(), user_id: 'e2e-user-2', full_name: 'E2E Second Owner', email: 'e2e-second@cgpe.test' };
  let secondOwnerLoggedIn = false;
  await page.route('**/api/auth/login', async route => {
    if (await preflight(route)) return;
    secondOwnerLoggedIn = true;
    await route.fulfill(response({ success: true, data: { token: 'e2e-second-owner-token', user: secondUser } }));
  });
  await page.route('**/api/auth/me', async route => {
    if (await preflight(route)) return;
    if (!secondOwnerLoggedIn) { await route.fallback(); return; }
    await route.fulfill(response({ success: true, data: { user: secondUser } }));
  });

  try {
    await openCampaigns(page);
    // Preview has completed; the next birthday read is JobsProvider's startCampaign.
    holdNextBirthdayAudience = true;
    await startBirthday(page);
    await expect.poll(() => !!heldAudience).toBe(true);
    await expect(jobPill(page)).toBeVisible();
    const documentStartedAt = await page.evaluate(() => performance.timeOrigin);
    const oldAudienceRequest = heldAudience!.request();
    expect(sends).toHaveLength(0);

    await openMore(page);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByText('Sign out?', { exact: true })).toBeVisible();
    // Modal confirmation's Pressable contains this text; the normal Button stays beneath it.
    await page.getByRole('dialog').getByText('Sign out', { exact: true }).click();
    await signInSecondOwner(page);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStartedAt);
    await expect(jobPill(page)).toHaveCount(0);

    // Require a SUCCESSFUL old response, not an abort/timeout that would also avoid sending.
    expect(oldAudienceRequest.failure()).toBeNull();
    const delivered = page.waitForResponse(res => res.request() === oldAudienceRequest && res.status() === 200);
    const delayedRoute = heldAudience!;
    heldAudience = undefined;
    await delayedRoute.fulfill(response(audience));
    expect(await (await delivered).finished()).toBeNull();

    // A new owner's own job demonstrates that the runner is usable after cleanup. Any late
    // old-owner send becomes a second captured POST, even if it borrowed the new auth token.
    await openCampaigns(page);
    await expect(jobPill(page)).toHaveCount(0);
    expect(sends).toHaveLength(0);
    await startBirthday(page);
    await page.getByRole('dialog').getByText('Monitor progress', { exact: true }).click();
    await expect(page.getByText('Finished', { exact: true })).toBeVisible();
    expect(sends).toHaveLength(1);
    expect(sends[0].postDataJSON()).toEqual({ type: 'birthday' });
    expect(sends[0].headers().authorization).toBe('Bearer e2e-second-owner-token');
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStartedAt);
  } finally {
    if (heldAudience) await heldAudience.abort('failed').catch(() => {});
  }
});
