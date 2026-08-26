/**
 * SyncChip — the visible "stale" state of the offline read cache (Phase 57a).
 *
 * The HealthBanner already says "we could not load this." When a re-fetch fails but a cached copy
 * exists, the screen shows the cached rows instead of an empty state — and THIS chip is the
 * honesty that keeps that from looking like live data: "Synced <time> · may be out of date."
 * It renders ONLY while the endpoint's rows are stale; a live read clears it.
 *
 * The hook `useDataFreshness` lives here, not in `data/freshness.ts`, for the same reason
 * `useDataHealth` lives in `ui/health-banner.tsx` and not in `data/health.ts`: the bus stays pure
 * (no React), the hook is UI.
 *
 * ⚠️ i18n (spec `docs/spec/PHASE-57.md` row 6): the copy is hardcoded ENGLISH on purpose. It owes
 * 5-language HUMAN copy before it becomes an i18n key `common.lastSynced` — machine translation is
 * forbidden, and a fake-translated key would pass the parity test dishonestly. Ships English (like
 * the ~40 still-English screens) until the owner supplies copy.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, useTheme } from '@/theme/theme';
import { timeAgo } from '@/lib/format';
import { FreshnessEntry, getFreshness, subscribeFreshness } from '@/data/freshness';
import { Txt } from './base';
import { useT } from '@/i18n';

export function useDataFreshness(key: string): FreshnessEntry | null {
  const [entry, setEntry] = useState<FreshnessEntry | null>(() => getFreshness(key));
  useEffect(() => {
    const update = () => setEntry(getFreshness(key));
    update();   // catch a change between the initial render and this subscription
    return subscribeFreshness(update);
  }, [key]);
  return entry;
}

export function SyncChip({ endpointKey }: { endpointKey: string }) {
  const c = useTheme();
  const t = useT();
  const fresh = useDataFreshness(endpointKey);
  if (!fresh?.stale) return null;
  return (
    <View
      accessibilityRole="text"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        backgroundColor: c.card,
        borderColor: c.warning,
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        marginBottom: spacing.sm,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={13} color={c.warning} />
      <Txt size={12} weight="500" color={c.muted}>
        {t('sync.syncedAt', { time: timeAgo(new Date(fresh.syncedAt)) })}
      </Txt>
    </View>
  );
}
