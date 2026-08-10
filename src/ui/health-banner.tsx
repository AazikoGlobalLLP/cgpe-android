/**
 * HealthBanner — the visible half of the no-mock-data contract.
 *
 * Removing sample data solved the dangerous problem (an agent reading invented figures to a
 * real customer) but created a lesser one: a screen that fails now shows an empty list, and
 * "empty" is ambiguous. It could mean "you have no leads" or "we could not load your leads."
 * Those demand opposite reactions from the user, so the app must never make them look alike.
 *
 * This banner is that distinction. It mounts ONCE in the root layout and watches
 * `data/health`, so every screen inherits the behaviour without a single line of per-screen
 * wiring. An empty list under this banner means "could not load"; an empty list without it
 * means genuinely nothing to show.
 *
 * WHY IT FLOATS AT THE BOTTOM rather than pushing content down from the top: every screen
 * owns its own `Header` with a safe-area inset already baked in. A top banner would either
 * cover that header or force all 33 screens to re-measure, and a layout shift arriving
 * asynchronously mid-scroll is worse than the outage it reports. Bottom-floating matches the
 * existing `JobPill` convention, so the app has one language for transient system state.
 *
 * It is NOT a toast. A toast disappears; the outage does not. The signal stays until
 * `reportSuccess` clears it, which happens automatically on the next request that lands.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HealthState, getHealth, subscribeHealth } from '@/data/health';
import { radius, shadow, spacing, type, useTheme } from '@/theme/theme';
import { Txt } from './base';
import { haptics } from '@/lib/haptics';

/** Subscribe a screen to outage state, for screens that want to tailor their empty copy. */
export function useDataHealth(): HealthState {
  const [s, setS] = useState<HealthState>(getHealth);
  useEffect(() => subscribeHealth(setS), []);
  return s;
}

export function HealthBanner() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const [dismissed, setDismissed] = useState(false);

  /**
   * A NEW outage after a dismissal must speak again — but a retry of one the user has
   * already dismissed must not.
   *
   * This used to key on `health.at`, which `reportFailure` re-stamps on EVERY failure
   * including a repeat of an endpoint already in the list. That was survivable while few
   * endpoints reported; since Phase 3 taught `tryReal` to report, a screen that retries a
   * dead endpoint on focus would re-open the banner every few seconds and the close button
   * would appear broken. Keying on the failure SET instead means the banner returns when
   * something new breaks and stays shut when the same thing breaks again.
   *
   * `at` deliberately keeps its every-failure semantics for `src/app/search.tsx:489`.
   */
  const failureKey = health.failures.join('|');
  useEffect(() => { if (health.degraded) setDismissed(false); }, [failureKey, health.degraded]);

  if (!health.degraded || dismissed) return null;

  const count = health.failures.length;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={`${count} request${count === 1 ? '' : 's'} could not be completed. Blank values are unconfirmed.`}
      style={{
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom: insets.bottom + 150,
        backgroundColor: c.warningSoft,
        borderColor: c.warning,
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
      <Ionicons name="cloud-offline-outline" size={19} color={c.warning} />
      <View style={{ flex: 1 }}>
        <Txt weight="700" size={13}>Some data could not load</Txt>
        {/* "could not be completed", not "did not reach the server": since Phase 3 this
            banner also covers a request the server DID answer, with a body the app cannot
            use. Telling someone to check their connection over a contract mismatch sends
            them chasing a network problem they do not have. */}
        <Txt size={11.5} color={c.muted} style={{ marginTop: 1 }} numberOfLines={2}>
          {count === 1
            ? 'One request could not be completed. Blank values here are unconfirmed.'
            : `${count} requests could not be completed. Blank values here are unconfirmed.`}
        </Txt>
      </View>
      <Pressable
        onPress={() => { haptics.tap(); setDismissed(true); }}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 2 }]}
      >
        <Ionicons name="close" size={17} color={c.muted} />
      </Pressable>
    </View>
  );
}

export default HealthBanner;
