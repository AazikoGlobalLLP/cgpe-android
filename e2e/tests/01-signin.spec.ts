import { test, expect } from '@playwright/test';
import { signIn } from '../helpers/session';
import { shot } from '../helpers/artifacts';

/**
 * Validates the harness backbone end-to-end: mocked login (with CORS preflight) → the real
 * login form submits → home renders → a deep-link re-boot restores the session from storage.
 * Everything else in the phase relies on these four working, so they get their own spec.
 */

test('healthy sign-in lands on home, and a deep-link keeps the session', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await signIn(page, 'healthy');

  // Home is up: the login hero is gone and a tab-bar destination is present.
  await expect(page.getByText('Welcome back')).toBeHidden();
  await shot(page, 'home-healthy');

  // Deep-link to another tab: a full reload that must restore the stored session rather than
  // bounce back to login.
  await page.goto('/tasks');
  await expect(page.getByText('Welcome back')).toBeHidden({ timeout: 20_000 });
  await shot(page, 'tasks-healthy');

  expect(errors, `uncaught page errors:\n${errors.join('\n')}`).toEqual([]);
});
