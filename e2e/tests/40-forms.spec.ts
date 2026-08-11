import { test, expect, type Page } from '@playwright/test';
import { installBackend, installLoginOutcome } from '../helpers/mock';
import { signIn } from '../helpers/session';
import { assertRenders } from '../helpers/render';
import { shot } from '../helpers/artifacts';

/**
 * DONE-WHEN 4 — bad-input / boundary testing. The login form is the security boundary and gets
 * the full matrix (empty, whitespace-only, hostile text, refused, network, double-submit). The
 * authenticated forms/inputs (search, task-new, claim-new) get a hostile-input pass: injection /
 * emoji / RTL / over-length must never crash a screen or leak a redbox.
 */

/** injection-y + emoji + RTL + very long, all at once. */
const HOSTILE = `<script>alert(1)</script> 🔥🙏 مرحبا שלום "; DROP TABLE users;-- ${'A'.repeat(600)}`;

async function openLogin(page: Page): Promise<void> {
  await installBackend(page, 'healthy');
  await page.goto('/');
  await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 30_000 });
}
const submit = (page: Page) => page.getByText('Sign in', { exact: true }).first().click();
const stillOnLogin = (page: Page) => expect(page.getByText('Welcome back')).toBeVisible();

test.describe('login — bad input', () => {
  test('empty submit → per-field errors, no navigation', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openLogin(page);
    await submit(page);
    await expect(page.getByText('Enter your email or mobile number.')).toBeVisible();
    await expect(page.getByText('Enter your password.')).toBeVisible();
    await stillOnLogin(page);
    await shot(page, 'forms/login-empty');
    expect(errors).toEqual([]);
  });

  test('whitespace-only id → field error (trim), no navigation', async ({ page }) => {
    await openLogin(page);
    await page.getByPlaceholder(/you@cgpe/i).fill('     ');
    await page.getByPlaceholder(/CGPE password/i).fill('something');
    await submit(page);
    await expect(page.getByText('Enter your email or mobile number.')).toBeVisible();
    await stillOnLogin(page);
  });

  test('refused credentials → danger banner, stays on login', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openLogin(page);
    await installLoginOutcome(page, 'refused');
    await page.getByPlaceholder(/you@cgpe/i).fill('nobody@cgpe.test');
    await page.getByPlaceholder(/CGPE password/i).fill('wrong-password');
    await submit(page);
    await expect(page.getByText('Sign in refused')).toBeVisible({ timeout: 15_000 });
    await stillOnLogin(page);
    await shot(page, 'forms/login-refused');
    expect(errors).toEqual([]);
  });

  test('network failure → offline banner, stays on login', async ({ page }) => {
    await openLogin(page);
    await installLoginOutcome(page, 'network');
    await page.getByPlaceholder(/you@cgpe/i).fill('someone@cgpe.test');
    await page.getByPlaceholder(/CGPE password/i).fill('a-password');
    await submit(page);
    await expect(page.getByText('Your details were not sent')).toBeVisible({ timeout: 15_000 });
    await stillOnLogin(page);
    await shot(page, 'forms/login-network');
  });

  test('hostile text in fields does not crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openLogin(page);
    await installLoginOutcome(page, 'refused');
    await page.getByPlaceholder(/you@cgpe/i).fill(HOSTILE);
    await page.getByPlaceholder(/CGPE password/i).fill(HOSTILE);
    await submit(page);
    await assertRenders(page, 'forms/login-hostile');
    await stillOnLogin(page);
    expect(errors, `hostile input crashed login:\n${errors.join('\n')}`).toEqual([]);
  });

  test('double rapid submit → single outcome, no crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openLogin(page);
    await installLoginOutcome(page, 'refused');
    await page.getByPlaceholder(/you@cgpe/i).fill('nobody@cgpe.test');
    await page.getByPlaceholder(/CGPE password/i).fill('wrong');
    const btn = page.getByText('Sign in', { exact: true }).first();
    await Promise.all([btn.click(), btn.click().catch(() => {})]);
    await expect(page.getByText('Sign in refused')).toBeVisible({ timeout: 15_000 });
    await stillOnLogin(page);
    expect(errors).toEqual([]);
  });
});

test.describe('authenticated forms — hostile input', () => {
  for (const { id, url } of [
    { id: 'search', url: '/search' },
    { id: 'task-new', url: '/task-new' },
    { id: 'claim-new', url: '/claim-new' },
  ]) {
    test(`${id}: injection/emoji/RTL/over-length does not crash`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await signIn(page, 'healthy');
      await page.goto(url, { waitUntil: 'load' });
      await assertRenders(page, `forms/${id}-before`);

      const field = page.locator('input, textarea').first();
      if (await field.count()) {
        await field.fill(HOSTILE).catch(() => {});
        await page.waitForTimeout(600);
      }
      await assertRenders(page, `forms/${id}-hostile`);
      expect(errors, `${id} crashed on hostile input:\n${errors.join('\n')}`).toEqual([]);
    });
  }
});
