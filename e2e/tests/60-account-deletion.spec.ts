import { test, expect, type Page } from '@playwright/test';
import { signIn } from '../helpers/session';
import { assertRenders } from '../helpers/render';

const endpoint = '**/api/auth/me/deletion-request';
const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization',
};
const record = (status = 'pending', notes = '') => ({
  success: true, data: { request_id: 'request-e2e', status, review_notes: notes },
});

async function sessionSnapshot(page: Page) {
  return page.evaluate(() => Object.fromEntries(Object.entries(localStorage)
    .filter(([key]) => /cgpe\.(token|user)|biometric|queue\.v1\./i.test(key))));
}

test('request, refresh and reload keep the account signed in without deleting it', async ({ page }) => {
  await signIn(page);
  let submitted = false;
  let posts = 0;
  const methods: string[] = [];
  await page.route(endpoint, async route => {
    const method = route.request().method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
    methods.push(method);
    if (method === 'POST') {
      posts++;
      expect(route.request().postDataJSON()).toEqual({});
      submitted = true;
      return route.fulfill({ status: 202, headers, json: record() });
    }
    return route.fulfill({ status: submitted ? 200 : 404, headers,
      json: submitted ? record('under_review', 'We are reviewing your request.') : { success: false } });
  });
  await page.goto('/account');
  const before = await sessionSnapshot(page);
  expect(Object.keys(before).length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Request deletion', exact: true }).click();
  await expect(page.getByText('This submits a request for review. It does not delete your account or its data, and you will stay signed in.', { exact: true })).toBeVisible();
  await page.getByText('Submit request', { exact: true }).click();
  await expect(page.getByText('Pending review', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request deletion', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText('Under review', { exact: true })).toBeVisible();
  await expect(page.getByText('We are reviewing your request.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Under review', { exact: true })).toBeVisible();
  expect(await sessionSnapshot(page)).toEqual(before);
  expect(posts).toBe(1);
  expect(methods).not.toContain('DELETE');
  await assertRenders(page, 'account-deletion-under-review', { settleSplash: true });
});

test('a rejected replay displays reviewer notes and has no resubmit control', async ({ page }) => {
  await signIn(page);
  await page.route(endpoint, route => route.fulfill({ status: 200, headers,
    json: record('rejected', 'Please contact your administrator about this request.') }));
  await page.goto('/account');
  await expect(page.getByText('Request rejected', { exact: true })).toBeVisible();
  await expect(page.getByText('Please contact your administrator about this request.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request deletion', exact: true })).toHaveCount(0);
  await assertRenders(page, 'account-deletion-rejected', { settleSplash: true });
});

test('an unavailable submission stays signed in and must refresh before another attempt', async ({ page }) => {
  await signIn(page);
  let posts = 0;
  await page.route(endpoint, route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (route.request().method() === 'POST') posts++;
    return route.fulfill({ status: 404, headers, json: { success: false } });
  });
  await page.goto('/account');
  await page.getByRole('button', { name: 'Request deletion', exact: true }).click();
  await page.getByText('Submit request', { exact: true }).click();
  await expect(page.getByText('Account deletion requests are not available on this server yet.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request deletion', exact: true })).toHaveCount(0);
  await expect(page.getByText('Welcome back', { exact: true })).toHaveCount(0);
  expect(posts).toBe(1);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Request deletion', exact: true })).toBeVisible();
  await assertRenders(page, 'account-deletion-unavailable-refreshed', { settleSplash: true });
});

test('a malformed status is unconfirmed and cannot become an empty successful state', async ({ page }) => {
  await signIn(page);
  await page.route(endpoint, route => route.fulfill({ status: 200, headers,
    json: record('deleted') }));
  await page.goto('/account');
  await expect(page.getByText('Request status not confirmed', { exact: true })).toBeVisible();
  await expect(page.getByText('Could not refresh your request status. Please try again.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request deletion', exact: true })).toHaveCount(0);
  await assertRenders(page, 'account-deletion-unconfirmed', { settleSplash: true });
});
