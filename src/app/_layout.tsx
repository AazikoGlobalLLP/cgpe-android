import 'react-native-gesture-handler';
/**
 * LOAD-BEARING IMPORT (side effect + `startAmbientTracking`).
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
 * The named import still evaluates the module body (registering the task); it also brings in
 * `startAmbientTracking`, which the boot gate below calls to arm the 24/7 recorder for an
 * already-consented user (PHASE-41 §12.5).
 */
import { startAmbientTracking, syncConsentWithPermission } from '@/lib/tracker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme, deriveBrandPalette, applyDensity, PaletteProvider } from '@/theme/theme';
import { useAppFonts } from '@/theme/fonts';
import { AuthProvider, useAuth } from '@/store/auth';
import { I18nProvider, useT } from '@/i18n';
import { ConfirmProvider } from '@/ui/Confirm';
import { ToastProvider } from '@/ui/feedback';
import { Splash } from '@/ui/Splash';
import { AppLock } from '@/ui/AppLock';
import { LocationBlock } from '@/ui/LocationBlock';
import { JobsProvider } from '@/store/jobs';
import { AppUiProvider, useAppUi } from '@/store/appUi';
import { JobPill } from '@/ui/JobPill';
import { HealthBanner } from '@/ui/health-banner';
import { getLocationConsent, needsConsentGate } from '@/data/api';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * PHASE 41a-iii-b — the 24/7-location consent BOOT GATE (redirect + recorder-arm).
 *
 * A signed-in user who has not granted consent is bounced to the mandatory `/consent` notice
 * (PHASE-41 §1: "bata ke, puch ke" — informed, transparent, non-negotiable); an already-consented user
 * instead has the native 24/7 recorder armed here without a prompt (§12.5, part 2). Headless and mounted
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
 * `/consent` without a Home flash-then-bounce or a loop, that it survives Expo's restored-route cold
 * start, and that an already-consented user's 24/7 recorder actually arms on boot. The pure decision
 * `needsConsentGate` IS unit-tested (api-consent-read.test.ts).
 */
function ConsentGate() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const t = useT();
  const checked = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;          // native-only: no background recorder on web
    if (!user) { checked.current = false; return; }   // signed out — re-check the next person
    if (!ready || checked.current) return;
    checked.current = true;
    void (async () => {
      const r = await getLocationConsent();      // silent + fail-open by design (api.ts)
      if (needsConsentGate(r)) {
        // `/consent` postdates the last generated route type (as `/earnings` does in attendance.tsx),
        // so cast to Href until `expo start` regenerates .expo/types.
        router.replace('/consent' as Href);
        return;
      }
      // Already granted: arm the native 24/7 recorder WITHOUT prompting (PHASE-41 §12.5). prompt:false
      // starts the service only if background permission is already held and never opens a dialog on a
      // cold start; the resolved (translated) neutral notification is captured here while i18n exists.
      // FAIL-OPEN holds: an `error` read is not `granted`, so nothing is armed (§12.7.7).
      if (r.status === 'ok' && r.consent === 'granted') {
        void startAmbientTracking({
          prompt: false,
          notif: { title: t('consent.serviceTitle'), body: t('consent.serviceBody') },
        });
      }
    })();
  }, [user, ready, router, t]);

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
/**
 * PHASE 41d §5 — the permission monitor. On every app foreground it asks the tracker to reconcile the
 * OS location permission with the recorder: if a consented 24/7 user has revoked background location,
 * that is treated as a withdrawal (POST consent=false → every master notified, recorder stopped —
 * `syncConsentWithPermission`). Mounted once at the root beside `ConsentGate`; headless, native-only, no
 * setState. Gated on `user` so it runs only for a signed-in account and re-subscribes for the next one.
 *
 * The app-BLOCK half of §5 (a "turn location back on" gate) is deliberately NOT wired here yet: its
 * screen needs owner-supplied 5-language copy (machine translation is forbidden). The decision brain
 * `locationBlockReason` is built + tested (antiCircumvention.ts); wiring the screen behind this monitor
 * is a small follow-up once the copy lands.
 */
function PermissionMonitor() {
  const { user } = useAuth();
  useEffect(() => {
    if (Platform.OS === 'web' || !user) return; // native-only, signed-in only
    void syncConsentWithPermission(); // check immediately on mount / sign-in
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void syncConsentWithPermission();
    });
    return () => sub.remove();
  }, [user]);
  return null;
}

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
      {/* PHASE 41d §5: on foreground, treat a revoked OS location permission as a consent withdrawal
          (notify masters + stop recording). Native-only, headless — see PermissionMonitor above. */}
      <PermissionMonitor />
      {/* PHASE 41d §5: block a consented 24/7 user behind a "turn location back on" notice while
          location is off (owner-locked immediate trigger). Overlay, native-only — see LocationBlock.
          Below AppLock's zIndex so the biometric device lock always wins if both are up. */}
      <LocationBlock />
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
