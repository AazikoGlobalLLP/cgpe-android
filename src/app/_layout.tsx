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
import React, { useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme, deriveBrandPalette, PaletteProvider } from '@/theme/theme';
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

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Overlays the signed-in role's server-driven accent (`config.theme.accent`) onto the OS
 * light/dark palette. It sits INSIDE `AppUiProvider` (so it can read the resolved config) and
 * inside the base `ThemeProvider` (so it derives from the scheme-correct palette), then
 * re-provides the branded palette to everything below via `PaletteProvider`. Doing it here rather
 * than reordering the top-level tree keeps the base `ThemeProvider` above `Confirm`/`Toast` so
 * their overlays stay themed. No accent → `deriveBrandPalette` returns the base palette unchanged,
 * so the azure/teal identity is the fail-open default and a config outage never restyles the app.
 */
function BrandTheme({ children }: { children: React.ReactNode }) {
  const base = useTheme();
  const { config } = useAppUi();
  const accent = config.theme?.accent;
  const palette = useMemo(() => deriveBrandPalette(base, accent), [base, accent]);
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
