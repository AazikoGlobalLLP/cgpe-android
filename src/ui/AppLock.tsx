import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, AppState, AppStateStatus, BackHandler, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/store/auth';
import { useTheme, radius, shadow, type } from '@/theme/theme';
import { Grad } from '@/ui/base';

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

  const shouldLock = !!user && biometricAvailable && biometricEnabled;

  const attempt = async () => {
    setTrying(true);
    const ok = await authenticateBiometric();
    setTrying(false);
    if (ok) setLocked(false);
  };

  // Lock on cold start when a saved session was restored.
  useEffect(() => {
    if (ready && !armed.current) {
      armed.current = true;
      if (restoredSession && shouldLock) { setLocked(true); attempt(); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Lock again when returning to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const back = appState.current.match(/inactive|background/) && next === 'active';
      appState.current = next;
      if (back && shouldLock) { setLocked(true); attempt(); }
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
          <Ionicons name="lock-closed" size={44} color="#fff" />
        </Grad>
      </View>
      <Text style={{ color: '#fff', ...type('800', 22), marginTop: 24 }}>App locked</Text>
      <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
        Unlock CGPE Connect with your fingerprint, Face ID, or device passcode.
      </Text>
      <Pressable onPress={attempt} disabled={trying} style={{ marginTop: 28, borderRadius: radius.md, overflow: 'hidden', width: '100%', maxWidth: 320 }}>
        <Grad colors={c.gradientBrand} style={{ height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Ionicons name="finger-print" size={22} color="#fff" />
          <Text style={{ color: '#fff', ...type('800', 16) }}>{trying ? 'Verifying…' : 'Unlock'}</Text>
        </Grad>
      </Pressable>
    </View>
  );
}
