import { test, expect } from '@playwright/test';
import { shot } from '../helpers/artifacts';

/**
 * PHASE 18 · STEP 1 — the real risk named in the spec §2: does the Expo WEB build boot and
 * render `/(auth)/login` without a redbox? Everything else in the phase depends on this
 * answer, so it is the first spec and it is deliberately small.
 *
 * "Renders" is asserted three ways, matching DONE-WHEN 2:
 *   1. not a blank/white screen  -> a known anchor from login.tsx ("Welcome back") is visible.
 *   2. not a red error boundary  -> no uncaught page error, no Metro/RN error-overlay text.
 *   3. not a bare i18n key       -> no raw dictionary key (word.word, no spaces) leaked to screen.
 */

/** Collect uncaught runtime errors for the whole test; asserted at the end. */
function trackPageErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('web build boots and /(auth)/login renders without a redbox', async ({ page }) => {
  const errors = trackPageErrors(page);

  // `/` is a 14-line gate that <Redirect>s to /(auth)/login when signed out. Landing on it
  // exercises the redirect, the provider tree, fonts, and the fail-open RBAC config path.
  await page.goto('/');

  // 1. Not blank: the login hero's own copy is on screen.
  await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 30_000 });
  // The primary action and the Password/OTP segmented control both render. (RN-Web's
  // Segmented paints its label in more than one node, so `.first()` avoids strict-mode
  // ambiguity — presence, not uniqueness, is what proves the control rendered.)
  await expect(page.getByText('Sign in', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Password', { exact: true }).first()).toBeVisible();

  // 2. Not an error boundary: none of the RN/Metro redbox strings are present.
  const body = (await page.locator('body').innerText()).toLowerCase();
  for (const redbox of [
    'unexpected text node',
    'render error',
    'element type is invalid',
    'objects are not valid as a react child',
    'a component suspended',
    'call stack',
  ]) {
    expect(body, `redbox text "${redbox}" must not appear`).not.toContain(redbox);
  }

  // 3. Not a bare i18n key: login uses literal English copy, so any `foo.bar`-shaped token
  //    with no whitespace would be an un-translated key leaking through. (Emails/URLs have
  //    an @ or / and are excluded; this only flags dotted identifiers.)
  const rawKey = (await page.locator('body').innerText()).match(/\b[a-z]+\.[a-z_]{3,}\b/);
  expect(rawKey, `looks like an un-rendered i18n key: ${rawKey?.[0]}`).toBeNull();

  // Capture the first watched frame explicitly, so the artifact folder has a login still
  // even for a run that never fails.
  await shot(page, 'auth-login');

  // 4. No uncaught errors during boot.
  expect(errors, `uncaught page errors:\n${errors.join('\n')}`).toEqual([]);
});
