/**
 * Which build is this, really?
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────────────────────────
 * `CLAUDE.md` says "ASK WHICH BUILD IS INSTALLED BEFORE BELIEVING A BUG REPORT" and points at
 * `Settings › Apps › CGPE Connect → 1.10.0 (N)`. On 2026-09-01 the owner sent that exact screen
 * from a Redmi handset and **MIUI does not print the build number at all** — it shows only
 * "Version: 1.10.0". Every `preview` build carries the same marketing version, so the instruction
 * we had written down was impossible to follow on the owner's own phone.
 *
 * That cost two debugging rounds. A crash was reported against a build we could not identify, on a
 * fix whose whole question was "is the fix even installed?", and the app's own Settings screen
 * showed `APP.version` — a HARD-CODED string, identical in every build ever made, so it could not
 * distinguish them either.
 *
 * So the app now prints the real native build number, which `eas.json`'s `autoIncrement` makes
 * unique per build (1 → 2 → 3 → 4 → 5 …). One look at Settings and a bug report becomes falsifiable.
 *
 * ── WHY THE `require` IS LAZY ─────────────────────────────────────────────────────────────────
 * `expo-application` is a NATIVE module: its JS calls `requireNativeModule` at module scope. A
 * top-level `import` of such a module from anything a route can reach is the documented
 * module-scope-throw trap (see `CLAUDE.md` → "Native modules: TWO different traps"), and it also
 * breaks the Vitest graph with `__DEV__ is not defined`. Keeping it behind a lazy `require` inside
 * a try/catch means this module's own top level stays native-free.
 *
 * ⚠️ A lazy `require` resolves through Node, so neither a `vitest.config.mts` alias nor `vi.mock`
 * can intercept it (Phase 86). That is why the DECISION is split out as the pure `formatBuild`
 * below — that is the part worth testing, and it is tested. `buildLabel()` is a thin, fail-open
 * wrapper: if the native module is missing for any reason, the user still sees the version.
 */
import { APP } from '@/constants/config';

/**
 * Render the version line. `build` is the native build number (Android versionCode) or null when
 * it cannot be read — in which case we show the bare version rather than an alarming "unknown",
 * because a missing build number is a diagnostic gap, not a fault the user should worry about.
 *
 * A build number of `'0'` is meaningless (no build is versionCode 0) and is treated as absent, as
 * is any blank or whitespace-only value.
 */
export function formatBuild(version: string, build: string | null | undefined): string {
  const b = (build ?? '').trim();
  if (!b || b === '0') return version;
  return `${version} (${b})`;
}

/** The native build number, or null when `expo-application` is unavailable. Never throws. */
export function nativeBuild(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose (see file header)
    const A = require('expo-application') as { nativeBuildVersion?: string | null };
    const v = A?.nativeBuildVersion;
    return typeof v === 'string' && v.trim() ? v : null;
  } catch {
    return null;
  }
}

/** What the Settings screen shows, e.g. `1.10.0 (5)`. Falls back to `1.10.0` if the build is unreadable. */
export function buildLabel(): string {
  return formatBuild(APP.version, nativeBuild());
}
