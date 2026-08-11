import { expect, type Page } from '@playwright/test';
import { installBackend, type SessionMode } from './mock';

/**
 * Sign in by driving the REAL login form against the mocked `/auth/login` — so the app writes
 * its own session to storage (localStorage on web) exactly as it would in production. That
 * matters because the walkthrough deep-links to each route with `page.goto('/tasks')` etc.;
 * every such navigation re-boots the app, and auth.tsx's restore path reads that stored token
 * back to land already-signed-in. Seeding storage by hand would mean guessing AsyncStorage's
 * web key format — driving the form is both faithful and self-checking.
 *
 * `mode` picks the backend: 'healthy' (real token, empty-but-valid data, no banner) or 'demo'
 * (demo- token → offline degraded/empty rendering).
 */
export async function signIn(page: Page, mode: SessionMode = 'healthy'): Promise<void> {
  await installBackend(page, mode);
  await page.goto('/');
  // `/` redirects to /(auth)/login when signed out.
  await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 30_000 });

  await page.getByPlaceholder(/you@cgpe/i).fill('e2e@cgpe.test');
  await page.getByPlaceholder(/CGPE password/i).fill('e2e-password-123');
  await page.getByText('Sign in', { exact: true }).first().click();

  // A successful sign-in navigates away from login; the hero copy detaches.
  await expect(page.getByText('Welcome back')).toBeHidden({ timeout: 30_000 });
}
