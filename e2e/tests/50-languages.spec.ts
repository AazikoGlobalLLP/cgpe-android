import { test, expect, type Page } from '@playwright/test';
import { signIn } from '../helpers/session';
import { assertRenders, bannerVisible, ROUTES } from '../helpers/render';

/**
 * PHASE 19 — the VISUAL half. The dictionary-parity Vitest
 * (`src/i18n/__tests__/dictionaries.test.ts`) is the durable core and proves every key is
 * translated in all five languages with no blanks; it cannot prove the strings actually reach the
 * screen, that the toggle works, or that the longer scripts still fit. This walk does, on the web
 * slice: for EACH of the five languages it drives the REAL settings toggle, confirms the switch
 * takes effect live and survives a reload, then deep-links every web-reachable screen and
 * screenshots it into `screens/languages/<code>/` for a human to review (PHASE-19 DONE-4 naturalness
 * of Hinglish/Gujlish, DONE-5 layout at 402 px). It also asserts DONE-2: no raw i18n key leaks
 * through anywhere.
 *
 * WHY DRIVE THE TOGGLE INSTEAD OF SEEDING STORAGE. The i18n provider persists the choice to
 * `cgpe.lang.<user>` itself and re-reads it on every cold boot (`src/i18n/index.tsx`). Clicking the
 * real row exercises exactly that write + the `refreshI18nUser` live-update bus + the reboot-read,
 * which IS DONE-3 — hand-seeding a key would test none of it and would have to guess the key format.
 * Mirrors how `helpers/session.ts` signs in by driving the form rather than injecting a token.
 *
 * WHAT THIS CANNOT DO (still a handset item, see WEB-LIMITS.md): the AsyncStorage-survives-a-real-
 * process-death check. A web `page.reload()` is a fresh app boot from the same localStorage, which
 * is the honest web equivalent of a cold start, but it is not the OS killing and relaunching the
 * process. DONE-3's cold-start clause is carried, like the other storage-key checks.
 */

/**
 * The five shipped languages. `label` is the English name the settings row shows (rows are always
 * labelled in English on purpose — `settings.tsx` LangRow renders `l.label`), so it is a stable
 * click target regardless of the current UI language. `heading` is that language's own translation
 * of the `settings.language` key ("App language"), copied VERBATIM from `src/i18n/index.tsx` — it is
 * the one on-screen string distinct in all five languages, so it is the live-update + persistence
 * probe. Never machine-translate these; they are the source of truth mirrored by hand.
 */
const LANGS = [
  { code: 'en', label: 'English', heading: 'App language' },
  { code: 'gu', label: 'Gujarati', heading: 'એપ ભાષા' },
  { code: 'hi', label: 'Hindi', heading: 'ऐप भाषा' },
  { code: 'hi-en', label: 'Hinglish', heading: 'App ki bhasha' },
  { code: 'gu-en', label: 'Roman Gujarati', heading: 'App ni bhasha' },
] as const;

/**
 * A leaked i18n key renders as its literal dotted string ("home.commission" instead of a
 * translation). The parity test guarantees no dictionary VALUE equals its key, so the only runtime
 * source left is a screen calling `t()` with a key absent from every dictionary — which shows the
 * key itself. This matches `namespace.lowercaseword` with NO space after the dot, exactly the shape
 * of a real key and not of prose (which has spaces / capitals), so false positives are near-zero.
 * Namespaces are the real ones in the dictionary (`src/i18n/index.tsx`).
 */
const KEY_LEAK = /\b(tab|tasks|home|greet|act|common|premium|report|signout|settings)\.[a-z][a-z]+/g;

/** Switch the app into `label`, prove it took effect live, then prove it survives a reload. */
async function setLanguage(page: Page, label: string, heading: string): Promise<void> {
  await page.goto('/settings', { waitUntil: 'load' });
  await assertRenders(page, `languages/_toggle/before-${label}`, { settleSplash: true });

  // The row label is exact English text; `.first()` guards against the confirmation toast (which
  // contains the label as a substring, not as its own exact text node) racing into the match.
  await page.getByText(label, { exact: true }).first().click();

  // DONE-3, live: the `settings.language` heading now reads THIS language, with no reload.
  await expect(page.getByText(heading, { exact: true }).first()).toBeVisible({ timeout: 20_000 });

  // Let the provider's fire-and-forget `storage.set` flush before we reboot. Best-effort: scan for
  // the persisted code under any lang-ish key so we don't hard-code AsyncStorage's web key scheme.
  await page
    .waitForFunction((code) => {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.toLowerCase().includes('lang') && localStorage.getItem(k) === code) return true;
      }
      return false;
    }, LANGS.find((l) => l.label === label)!.code, { timeout: 5_000 })
    .catch(() => {});

  // DONE-3, persistence (web cold-start equivalent): reboot from storage, still this language.
  await page.reload({ waitUntil: 'load' });
  await assertRenders(page, `languages/_toggle/after-reload-${label}`, { settleSplash: true });
  await expect(page.getByText(heading, { exact: true }).first())
    .toBeVisible({ timeout: 20_000 });
}

type Row = { id: string; url: string; ok: boolean; banner: boolean; leaks: string[]; error?: string };

for (const lang of LANGS) {
  test(`walk every screen in ${lang.label} (${lang.code})`, async ({ page }) => {
    test.setTimeout(360_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await signIn(page, 'healthy');
    await setLanguage(page, lang.label, lang.heading);

    const rows: Row[] = [];
    for (const r of ROUTES) {
      await test.step(`${lang.code}/${r.id} (${r.url})`, async () => {
        try {
          await page.goto(r.url, { waitUntil: 'load' });
          const body = await assertRenders(page, `languages/${lang.code}/${r.id}`, { settleSplash: true });
          const leaks = [...new Set(body.match(KEY_LEAK) ?? [])];
          rows.push({ id: r.id, url: r.url, ok: true, banner: await bannerVisible(page), leaks });
        } catch (e) {
          rows.push({ id: r.id, url: r.url, ok: false, banner: await bannerVisible(page), leaks: [], error: (e as Error).message.split('\n')[0] });
        }
      });
    }

    const line = (r: Row) =>
      `${r.ok ? 'PASS' : 'FAIL'}  ${r.banner ? 'banner ' : '       '} ${r.leaks.length ? 'KEYLEAK ' : '        '} ${r.id.padEnd(16)} ${r.url}` +
      `${r.leaks.length ? '  leaks=' + r.leaks.join(',') : ''}${r.error ? '  <- ' + r.error : ''}`;
    console.log(`\n===== LANGUAGE WALK: ${lang.label} (${lang.code}) =====\n` + rows.map(line).join('\n') +
      `\n\n${rows.filter((r) => r.ok).length}/${rows.length} rendered; ` +
      `${rows.filter((r) => r.banner).length} showed the outage banner; ` +
      `${rows.filter((r) => r.leaks.length).length} leaked a raw key.\n`);

    const failed = rows.filter((r) => !r.ok);
    expect(failed, `screens that failed to render in ${lang.label}:\n${failed.map(line).join('\n')}`).toEqual([]);

    const leaked = rows.filter((r) => r.leaks.length);
    expect(leaked, `screens leaking a raw i18n key in ${lang.label} (DONE-2):\n${leaked.map(line).join('\n')}`).toEqual([]);

    expect(pageErrors, `uncaught page errors during the ${lang.label} walk:\n${pageErrors.join('\n')}`).toEqual([]);
  });
}
