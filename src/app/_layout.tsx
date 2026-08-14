import 'react-native-gesture-handler';
/**
 * SIDE-EFFECT IMPORT, AND IT IS LOAD-BEARING.
 *
 * tracker.ts registers its background location task with `TaskManager.defineTask` at module
 * scope. That only helps if the module is actually EVALUATED. expo-router loads route modules
 * lazily, so when the OS wakes the app headlessly to deliver a batch of locations,
 * `(tabs)/home.tsx` is never evaluated and the task has no registered handler: the OS finds
 * nothing to call and drops the batch silently.
 *
 * The failure mode is nasty because it looks fine in testing. While the user is on Home the
 * task IS registered, so a short foreground test records perfectly. It only breaks after the
 * process is killed, which is the NORMAL case across an all-day shift, and the symptom is a
 * route with a start, an end, and hours missing in between.
 *
 * The import is cheap: the module body only defines the task and reads a flag.
 */
import '@/lib/tracker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme, deriveBrandPalette, applyDensity, PaletteProvider } from '@/theme/theme';
import { useAppFonts } from '@/theme/fonts';
import { AuthProvider, useAuth } from '@/store/auth';
import { I18nProvider } from '@/i18n';
import { ConfirmProvider } from '@/ui/Confirm';
import { ToastProvider } from '@/ui/feedback';
import { Splash } from '@/ui/Splash';
import { AppLock } from '@/ui/AppLock';
import { JobsProvider } from '@/store/jobs';
import { AppUiProvider, useAppUi } from '@/store/appUi';
import { JobPill } from '@/ui/JobPill';
import { HealthBanner } from '@/ui/health-banner';
import { getLocationConsent, needsConsentGate } from '@/data/api';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * PHASE 41a-iii-b — the 24/7-location consent BOOT GATE (redirect half).
 *
 * A signed-in user who has not granted consent is bounced to the mandatory `/consent` notice
 * (PHASE-41 §1: "bata ke, puch ke" — informed, transparent, non-negotiable). Headless and mounted
 * once at the root beside `AppLock`/`JobPill`, so it lives for the process lifetime and reads the
 * live navigation context (JobPill navigates from exactly here). It must run at THIS layout level,
 * not `index.tsx`, which only mounts at `/`.
 *
 * THREE INVARIANTS, all leaning safe:
 *  1. FAIL OPEN. `needsConsentGate` redirects ONLY on a confirmed `ok` + non-granted read; an outage,
 *     a pre-Phase-43 backend, or a dead network all read `error` → no redirect. A failed read can
 *     never trap staff behind the wall.
 *  2. FIRE ONCE per signed-in session. The `checked` ref gates the read to a single fetch per cold
 *     start (reset only on sign-OUT so the next person is re-checked), so it cannot loop — and the
 *     consent screen's own success path `replace`s to Home, which never re-triggers this.
 *  3. NATIVE ONLY. The gate exists to enable the native background recorder; web has none (and the
 *     e2e web harness must keep reaching every screen), so web is skipped outright.
 *
 * There is deliberately no `let alive` cancel guard: this component never unmounts (root-level, like
 * AppLock) and the effect performs NO setState — only a one-shot `router.replace`, which is safe to
 * fire whenever the read resolves. A per-effect `alive` flag would in fact swallow the redirect under
 * React StrictMode's dev double-mount.
 *
 * DEVICE-ONLY to verify (no test stub reaches boot navigation): that a non-granted user lands on
 * `/consent` without a Home flash-then-bounce or a loop, and that it survives Expo's restored-route
 * cold start. The pure decision `needsConsentGate` IS unit-tested (api-consent-read.test.ts).
 */
function ConsentGate() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const checked = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;          // native-only: no background recorder on web
    if (!user) { checked.current = false; return; }   // signed out — re-check the next person
    if (!ready || checked.current) return;
    checked.current = true;
    void (async () => {
      const r = await getLocationConsent();      // silent + fail-open by design (api.ts)
      // `/consent` postdates the last generated route type (as `/earnings` does in attendance.tsx),
      // so cast to Href until `expo start` regenerates .expo/types.
      if (needsConsentGate(r)) router.replace('/consent' as Href);
    })();
  }, [user, ready, router]);

  return null;
}

/**
 * Overlays the signed-in role's server-driven accent (`config.theme.accent`) onto the OS
 * light/dark palette. It sits INSIDE `AppUiProvider` (so it can read the resolved config) and
 * inside the base `ThemeProvider` (so it derives from the scheme-correct palette), then
 * re-provides the branded palette to everything below via `PaletteProvider`. Doing it here rather
 * than reordering the top-level tree keeps the base `ThemeProvider` above `Confirm`/`Toast` so
 * their overlays stay themed. No accent → `deriveBrandPalette` returns the base palette unchanged,
 * so the azure/teal identity is the fail-open default and a config outage never restyles the app.
 *
 * Phase 29: the same bridge also applies `config.theme.density`. `applyDensity` runs AFTER the
 * accent (density scales spacing/radius, independent of colour) and, like `deriveBrandPalette`,
 * returns the input palette by reference when density is comfortable/absent — so a role with
 * neither accent nor a compact density gets the exact base palette and this memo never churns.
 */
function BrandTheme({ children }: { children: React.ReactNode }) {
  const base = useTheme();
  const { config } = useAppUi();
  const accent = config.theme?.accent;
  const density = config.theme?.density;
  const palette = useMemo(
    () => applyDensity(deriveBrandPalette(base, accent), density),
    [base, accent, density],
  );
  return <PaletteProvider value={palette}>{children}</PaletteProvider>;
}

function RootNav() {
  const c = useTheme();
  const { ready } = useAuth();
  const fontsReady = useAppFonts();
  const [splashDone, setSplashDone] = useState(false);

  // Hand off from the native splash to our animated one immediately.
  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);

  return (
    <>
      <StatusBar style={c.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
          animation: 'slide_from_right',
          /* CROSS-PLATFORM NAVIGATION PARITY.
             `gestureEnabled` keeps the iOS swipe-back alive on every pushed screen, and
             `fullScreenGestureEnabled` widens its hit area from the 20pt left edge to the
             whole screen. On a large handset the edge-only default is effectively unusable
             one-handed, which is why iOS users report "back doesn't work" on RN apps.
             Android ignores both and uses its own hardware/gesture back, which the Stack
             already handles, so this is additive rather than a platform fork. */
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
      <JobPill />
      {/* Mounted once here so every route inherits outage reporting. Sample data is gone,
          so this is the only thing distinguishing "nothing to show" from "could not load". */}
      <HealthBanner />
      {/* Redirects a signed-in, not-yet-consented user to the mandatory /consent notice.
          Fail-open, fires once per session, native-only — see ConsentGate above. */}
      <ConsentGate />
      <AppLock />
      {/* Hold the animated splash until the auth session AND the Geist faces are ready,
          so the first painted frame is never in the fallback system face. */}
      {(!ready || !fontsReady || !splashDone) && <Splash onDone={() => setSplashDone(true)} />}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              {/* AppUiProvider calls useAuth(), so it MUST sit inside AuthProvider. It
                  fetches the signed-in user's server-driven dashboard/nav layout and
                  re-fetches whenever the user id changes, which is what makes a shared
                  handset show the incoming user's layout rather than the outgoing one's. */}
              <AppUiProvider>
              {/* Inside AppUiProvider so it can read config.theme.accent; re-provides the
                  accented palette to everything below without moving the base ThemeProvider. */}
              <BrandTheme>
              <JobsProvider>
                <ConfirmProvider>
                  {/* Inside ConfirmProvider so a toast renders above its modal scrim.
                      Without this mounted, useToast() silently resolves to the no-op
                      default and every toast in the app does nothing, with no warning. */}
                  <ToastProvider>
                    <RootNav />
                  </ToastProvider>
                </ConfirmProvider>
              </JobsProvider>
              </BrandTheme>
              </AppUiProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
