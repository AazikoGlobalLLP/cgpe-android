/**
 * UpdateBanner — "an update is ready, restart when you like."
 *
 * ── WHAT IT IS FOR ────────────────────────────────────────────────────────────────────────────
 * `expo-updates` is configured `checkAutomatically: ON_LOAD`, so a downloaded update applies at the
 * next cold start on its own. That alone is already the whole feature — but these handsets are not
 * restarted for days, and "the fix is on your phone, you just have not launched it since" is not
 * good enough when the fix is why we published. This banner is the difference between an update
 * arriving tomorrow and arriving in the next ten seconds, and it costs the user one tap.
 *
 * ── WHY IT ASKS INSTEAD OF ACTING ─────────────────────────────────────────────────────────────
 * See `lib/otaPolicy.ts`. A reload wipes the navigation stack and any in-progress form, so doing it
 * unasked would lose the user's work to fix a bug they had not noticed.
 *
 * ── WHY IT NEVER STACKS WITH THE HEALTH BANNER ────────────────────────────────────────────────
 * Both float in the same slot, and the outage is the more urgent of the two. `shouldOfferRestart`
 * suppresses this one while `data/health` is degraded; the update stays pending and the banner
 * comes back when the outage clears. Two overlapping absolute-positioned banners would be a layout
 * bug that only ever appears on a bad network — i.e. exactly where nobody is testing.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, shadow, spacing, useTheme } from '@/theme/theme';
import { Txt } from './base';
import { haptics } from '@/lib/haptics';
import { useT } from '@/i18n';
import { useDataHealth } from './health-banner';
import { applyUpdate, checkAndFetchUpdate, otaEnabled } from '@/lib/ota';
import { shouldCheckOnForeground, shouldOfferRestart } from '@/lib/otaPolicy';

export function UpdateBanner() {
  const c = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const [pending, setPending] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  /* Refs, not state: these are read inside an AppState subscription that is registered once, and a
     stale closure over `lastChecked` would re-check on every single foreground. `checking` makes a
     slow check idempotent — foregrounding twice while the first request is still in flight must not
     start a second one. */
  const lastChecked = useRef<number | null>(null);
  const checking = useRef(false);

  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      lastChecked.current = Date.now();
      /* Never throws — see the fail-quiet note in `lib/ota.ts`. An unreachable update server is a
         non-event: we keep running the JS we already have. */
      if (await checkAndFetchUpdate()) setPending(true);
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    if (!otaEnabled()) return;

    /* One check at mount. `ON_LOAD` has already started its own check natively by this point; this
       is what notices the RESULT, since the app cannot subscribe to the native check from here. */
    void check();

    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      if (!shouldCheckOnForeground(lastChecked.current, Date.now())) return;
      void check();
    });
    return () => sub.remove();
  }, [check]);

  if (!shouldOfferRestart({ enabled: otaEnabled(), pending, dismissed, outage: health.degraded })) {
    return null;
  }

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={t('update.ready')}
      style={{
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom: insets.bottom + 150,
        backgroundColor: c.infoSoft,
        borderColor: c.primary,
        borderWidth: 1,
        borderRadius: radius.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        ...shadow(c, 2),
      }}
    >
      <Ionicons name="arrow-down-circle-outline" size={19} color={c.primary} />
      <Txt weight="700" size={13} style={{ flex: 1 }}>{t('update.ready')}</Txt>
      <Pressable
        onPress={() => {
          haptics.tap();
          /* Explicitly caught. An error boundary covers render and commit only — never an event
             handler and never a promise rejection (`CLAUDE.md` → "What a React error boundary does
             NOT catch"), so an unhandled rejection here would be a fatal in a release build. */
          applyUpdate().catch(() => {});
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('update.restart')}
        style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, paddingHorizontal: 4, paddingVertical: 2 }]}
      >
        <Txt weight="700" size={13} color={c.primary}>{t('update.restart')}</Txt>
      </Pressable>
      <Pressable
        onPress={() => { haptics.tap(); setDismissed(true); }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('common.dismiss')}
        style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 2 }]}
      >
        <Ionicons name="close" size={17} color={c.muted} />
      </Pressable>
    </View>
  );
}

export default UpdateBanner;
