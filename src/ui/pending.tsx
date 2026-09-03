/**
 * The visible half of the offline write queue (Phase 57b).
 *
 * `usePendingWrites(kind)` subscribes a screen to the pending-writes bus so a draft created offline
 * appears immediately and clears the moment it flushes. `PendingBadge` is the "Pending sync" chip a
 * screen puts on such a row. The hook lives here (UI), the bus stays pure in `data/pendingWrites.ts`
 * — the same split as `useDataHealth`/`health.ts` and `useDataFreshness`/`freshness.ts`.
 *
 * ⚠️ i18n (spec `docs/spec/PHASE-57.md` row 6): "Pending sync" is hardcoded ENGLISH on purpose — it
 * owes 5-language HUMAN copy before it becomes an i18n key. Machine translation is forbidden.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, useTheme } from '@/theme/theme';
import { getPendingByKind, getDropCount, subscribePending } from '@/data/pendingWrites';
import type { QueuedWrite, QueueKind } from '@/lib/writeQueue';
import { Txt } from './base';
import { useT } from '@/i18n';

export function usePendingWrites(kind: QueueKind): QueuedWrite[] {
  const [list, setList] = useState<QueuedWrite[]>(() => getPendingByKind(kind));
  useEffect(() => {
    const update = () => setList(getPendingByKind(kind));
    update();   // catch a change between the initial render and this subscription
    return subscribePending(update);
  }, [kind]);
  return list;
}

/** How many drafts a flush refused-and-removed (0 = nothing to show). The screen renders the
 *  translated sync.dropped{One,Many} message from this count. */
export function useDropCount(): number {
  const [n, setN] = useState<number>(() => getDropCount());
  useEffect(() => {
    const update = () => setN(getDropCount());
    update();
    return subscribePending(update);
  }, []);
  return n;
}

export function PendingBadge() {
  const c = useTheme();
  const t = useT();
  return (
    <View
      accessibilityRole="text"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 5,
        backgroundColor: c.card,
        borderColor: c.warning,
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
      }}
    >
      <Ionicons name="time-outline" size={12} color={c.warning} />
      <Txt size={11} weight="600" color={c.warning}>{t('sync.pending')}</Txt>
    </View>
  );
}
