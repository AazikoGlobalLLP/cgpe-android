import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, AppState, AppStateStatus, BackHandler, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/store/auth';
import { useTheme, radius, shadow, type } from '@/theme/theme';
import { Grad } from '@/ui/base';
import { storage } from '@/lib/storage';
import { parseLastActive, shouldRelock } from '@/lib/appLock';

// The wall-clock moment the app was last sent to the background, persisted so a COLD start can
// also honour the grace window (an OS kill during a brief trip must not demand a fingerprint).
// SecureStore on native via @/lib/storage. See lib/appLock.ts for the PHASE-70 rationale.
const LAST_ACTIVE_KEY = 'applock.lastActive';

/**
 * Biometric / device-passcode app lock. After the first login, whenever the app is
 * re-opened (cold start with a saved session, or brought back to the foreground) it
 * requires a fingerprint, Face ID, or the device passcode to continue — so the user
 * logs in once and unlocks with biometrics thereafter. No-op on web / no hardware.
 */
export function AppLock() {
  const c = useTheme();
  const { ready, user, restoredSession, biometricAvailable, biometricEnabled, authenticateBiometric } = useAuth();
  const [locked, setLocked] = useState(false);
  const [trying, setTrying] = useState(false);
  const appState = useRef<AppStateStatus>('active');
  const armed = useRef(false);
  const inFlight = useRef(false);
  // When the app was last genuinely backgrounded, for the foreground grace check (PHASE 70).
  const backgroundedAt = useRef<number | null>(null);

  const shouldLock = !!user && biometricAvailable && biometricEnabled;

  /**
   * Run the biometric prompt — but only ever ONE at a time.
   *
   * THE BUG THIS FIXES: "tapping Unlock often does nothing." `attempt()` auto-fires the
   * instant the lock appears (cold start below) and again on every foreground return, and the
   * Unlock button fires it too. Nothing stopped two of those from overlapping — and
   * `authenticateAsync` cannot be called twice at once: a second call while one is open rejects
   * native-side ("authentication is already in progress"), which `authenticateBiometric`
   * (fail-closed) catches and returns as a plain `false`. So the second attempt shows no
   * prompt, fails instantly, and never unlocks — exactly the dead-button symptom.
   *
   * They overlap for real, not in theory: we pass `disableDeviceFallback: false`
   * (store/auth.tsx), so picking the device PIN/passcode launches Android's SEPARATE
   * Confirm-Device-Credential activity, which sends the app `background → active`. The
   * foreground `AppState` listener below reads that return as "the user came back" and fires a
   * competing `attempt()` on top of the one still running (OEM skins — Samsung/One UI — also
   * bounce AppState for the plain fingerprint sheet). The `inFlight` guard here, plus the
   * matching `!inFlight.current` check on that listener, serialise the calls so exactly one
   * prompt is ever live. `finally` also guarantees `trying` clears — so the button can never
   * stick disabled — even if a future change ever lets the auth call throw.
   */
  const attempt = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setTrying(true);
    try {
      const ok = await authenticateBiometric();
      if (ok) setLocked(false);
    } finally {
      inFlight.current = false;
      setTrying(false);
    }
  };

  // Lock on cold start when a saved session was restored — but honour the grace window: if the
  // app was backgrounded only moments ago (an OS kill during a brief trip — common on the
  // battery-aggressive OEMs this app targets), a cold start should NOT demand a fingerprint. Lock
  // FIRST so app content never flashes, then read the persisted stamp and reveal if within grace.
  useEffect(() => {
    if (ready && !armed.current) {
      armed.current = true;
      if (restoredSession && shouldLock) {
        setLocked(true);
        (async () => {
          const raw = await storage.get(LAST_ACTIVE_KEY).catch(() => null);
          if (shouldRelock(parseLastActive(raw), Date.now())) attempt();
          else setLocked(false); // within grace → reveal the app, no prompt
        })();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Lock again when returning to the foreground — but only if the user was actually away longer
  // than the grace window (PHASE 70). A quick app-switch / call / glance at a map comes straight
  // back in; a real absence still re-locks.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appState.current;
      const leaving = /inactive|background/.test(next);
      const back = /inactive|background/.test(prev) && next === 'active';
      appState.current = next;
      // Stamp when the user GENUINELY leaves. `!inFlight.current` excludes the background bounce
      // the biometric / device-credential prompt causes itself (attempt() holds inFlight), so an
      // in-progress unlock never resets the "last away" clock.
      if (leaving && !inFlight.current) {
        const ts = Date.now();
        backgroundedAt.current = ts;
        void storage.set(LAST_ACTIVE_KEY, String(ts));
      }
      // `!inFlight.current`: the prompt drives the app background→active itself, so that return is
      // NOT the user coming back — re-locking on it would start a second prompt that fights the
      // first (see attempt()). A genuine return, with no prompt in flight, re-locks only when the
      // gap exceeds the grace window.
      if (back && shouldLock && !inFlight.current && shouldRelock(backgroundedAt.current, Date.now())) {
        setLocked(true);
        attempt();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldLock]);

  /**
   * Swallow the Android back press while locked.
   *
   * THE BUG THIS FIXES. This overlay is an absolutely-positioned sibling of the navigation
   * Stack, not a Modal, so it paints over the app but does not intercept input events that
   * the OS routes past it. Pressing the hardware or gesture back button while the lock was up
   * therefore navigated the Stack UNDERNEATH: the lock stayed on screen, but the app moved
   * between screens behind it, and whatever was there was live the moment the lock cleared.
   * On a borrowed or found handset that defeats the point of having a lock.
   *
   * Returning `true` marks the event handled so no other handler runs. Android only; iOS has
   * no hardware back, and its edge-swipe is a Stack gesture that this overlay already covers.
   */
  useEffect(() => {
    if (!locked || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [locked]);

  if (!locked) return null;

  return (
    <View
      accessibilityViewIsModal
      accessibilityLabel="App locked. Unlock to continue."
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, backgroundColor: c.gradientHero[c.scheme === 'dark' ? 2 : 1], alignItems: 'center', justifyContent: 'center', padding: 32 }}
    >
      <View style={{ width: 96, height: 96, borderRadius: 30, overflow: 'hidden', ...shadow(c, 2) }}>
        <Grad colors={c.gradientBrand} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {/* onPrimary, not white: gradientBrand is the accent, so a light department accent needs
              dark ink here to stay visible (round 4). The title/subtitle below sit on gradientHero
              (accent-immune), so they keep white. */}
          <Ionicons name="lock-closed" size={44} color={c.onPrimary} />
        </Grad>
      </View>
      <Text style={{ color: '#fff', ...type('800', 22), marginTop: 24 }}>App locked</Text>
      <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
        Unlock CGPE Connect with your fingerprint, Face ID, or device passcode.
      </Text>
      <Pressable onPress={attempt} disabled={trying} style={{ marginTop: 28, borderRadius: radius.md, overflow: 'hidden', width: '100%', maxWidth: 320 }}>
        <Grad colors={c.gradientBrand} style={{ height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {/* onPrimary on the accent gradient — the only visible affordance on the lock screen must
              not disappear under a light accent (round 4). */}
          <Ionicons name="finger-print" size={22} color={c.onPrimary} />
          <Text style={{ color: c.onPrimary, ...type('800', 16) }}>{trying ? 'Verifying…' : 'Unlock'}</Text>
        </Grad>
      </Pressable>
    </View>
  );
}
