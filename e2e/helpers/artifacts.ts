import path from 'node:path';
import type { Page } from '@playwright/test';

/**
 * Absolute artifact paths, anchored on this file's location rather than the process cwd — so a
 * `page.screenshot({ path })` lands in `e2e/artifacts/` whether the run was launched from the
 * repo root or from `e2e/`. Everything under here is git-ignored (see .gitignore).
 */
export const ARTIFACTS_DIR = path.resolve(__dirname, '..', 'artifacts');
export const SCREENS_DIR = path.join(ARTIFACTS_DIR, 'screens');

/** One named, full-page still into `e2e/artifacts/screens/<name>.png`. */
export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(SCREENS_DIR, `${name}.png`), fullPage: true });
}
