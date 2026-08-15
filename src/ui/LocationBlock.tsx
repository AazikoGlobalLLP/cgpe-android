import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, AppState, AppStateStatus, BackHandler, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/store/auth';
import { useT } from '@/i18n';
import { useTheme, radius, shadow, type } from '@/theme/theme';
import { Grad } from '@/ui/base';
import { evaluateLocationBlock, openLocationSettings } from '@/lib/tracker';
import type { BlockReason } from '@/lib/antiCircumvention';

/**
 * PHASE 41d §5 — the anti-circumvention app-block gate.
 *
 * A consented 24/7 user who turns location OFF is blocked behind a full-screen "turn it back on"
 * notice until they restore it — the transparent, no-loophole enforcement the owner locked
 * (AskUserQuestion 2026-08-15: block IMMEDIATELY when any of services / foreground / background is
 * off). The decision is the pure, tested `locationBlockReason`; the native reads live in
 * `tracker.evaluateLocationBlock()` (device-only, like the rest of that module). All copy is the
 * owner's human 5-language `consent.blocked*` set — never machine-translated.
 *
 * FAIL-OPEN: `evaluateLocationBlock` resolves `null` on any uncertain read, so a transient failure
 * never traps staff. GATED ON `user`: the overlay never covers the login / consent screens (an
 * un-consented user is `armed:false` → `null` anyway; a signed-out user is skipped outright).
 *
 * COMPOSITION (spec-literal): a revoked background PERMISSION is handled by the withdrawal signal
 * (`PermissionMonitor` → master alert + disarm), which clears `armed`, so this settles on
 * device-Location-OFF (services); permission revocation routes through withdrawal + the /consent
 * wall on next open. See `evaluateLocationBlock`.
 *
 * DEVICE-ONLY to verify (no RN render/permission stub in the suite): turning off device Location
 * raises the overlay; "Open settings" reaches the right page; returning with location back on clears
 * it; the Android back button cannot escape it.
 */
export function LocationBlock() {
  const c = useTheme();
  const t = useT();
  const { user } = useAuth();
  const [reason, setReason] = useState<BlockReason>(null);
  const appState = useRef<AppStateStatus>('active');

  const check = useCallback(() => {
    if (Platform.OS === 'web' || !user) { setReason(null); return; } // native-only, signed-in only
    void evaluateLocationBlock().then(setReason);
  }, [user]);

  // Evaluate on mount / sign-in and on every return to the foreground, so coming back from Settings
  // with location restored clears the block (and re-raises it if they left it off).
  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (next) => {
      const back = appState.current.match(/inactive|background/) && next === 'active';
      appState.current = next;
      if (back) check();
    });
    return () => sub.remove();
  }, [check]);

  // Swallow the Android hardware back while blocked — exactly like AppLock. This overlay is an
  // absolutely-positioned sibling of the Stack, not a Modal, so without this the app would navigate
  // underneath the notice and be live the moment it clears.
  useEffect(() => {
    if (!reason || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [reason]);

  if (!reason) return null;

  return (
    <View
      accessibilityViewIsModal
      accessibilityLabel={t('consent.blockedTitle')}
      // zIndex 55: below AppLock's 60, so the biometric device lock always wins if both are up.
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 55, backgroundColor: c.gradientHero[c.scheme === 'dark' ? 2 : 1], alignItems: 'center', justifyContent: 'center', padding: 32 }}
    >
      <View style={{ width: 96, height: 96, borderRadius: 30, overflow: 'hidden', ...shadow(c, 2) }}>
        <Grad colors={c.gradientBrand} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="location-outline" size={44} color="#fff" />
        </Grad>
      </View>
      <Text style={{ color: '#fff', ...type('800', 22), marginTop: 24, textAlign: 'center' }}>
        {t('consent.blockedTitle')}
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, marginTop: 12, textAlign: 'center', lineHeight: 20, maxWidth: 340 }}>
        {t('consent.blockedBody')}
      </Text>
      <Pressable onPress={() => openLocationSettings(reason)} style={{ marginTop: 28, borderRadius: radius.md, overflow: 'hidden', width: '100%', maxWidth: 320 }}>
        <Grad colors={c.gradientBrand} style={{ height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Ionicons name="settings-outline" size={22} color="#fff" />
          <Text style={{ color: '#fff', ...type('800', 16) }}>{t('consent.blockedAction')}</Text>
        </Grad>
      </Pressable>
    </View>
  );
}
