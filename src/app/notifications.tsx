import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Header, Row, Screen, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Button } from '@/ui/controls';
import { Banner, EmptyState, Skeleton } from '@/ui/feedback';
import { Pill } from '@/ui/data';
import { Spine, SpineRow } from '@/ui/spine';
import type { SpineTone } from '@/ui/spine';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';

import * as api from '@/data/api';
import type { AppNotification } from '@/data/types';
import { fmtDay } from '@/lib/format';

/* ------------------------------------------------------------------ *
 * Notifications — the feed, on the date spine.
 *
 * WHY THE SPINE AND NOT A STACK OF CARDS. Every item here is an event with a time, and the
 * only question the user is answering is "what happened, and in what order". The spine is
 * the structure that encodes exactly that: a time gutter, a node, and a rule that runs to
 * the next event. A card per notification says each one is a separate object of equal
 * weight, which is precisely the wrong reading of a feed.
 *
 * THE NODE CARRIES TWO FACTS AT ONCE. Its colour is the kind (claim, lead, renewal,
 * contest, system) and its filled-ness is whether you have read it: unread items take
 * their kind's colour, read items drop to the neutral spine grey. So a glance down the
 * rail shows both what is waiting and how much of it is new, before a single line is read.
 *
 * MARK-ALL IS VERIFIED, NOT ASSUMED. The list updates optimistically so the thumb gets an
 * instant answer, then the feed is refetched. `haptics.success` fires only when the server
 * comes back with everything actually read; if anything is still unread the screen reverts
 * to what the server holds and says so in a Banner. An empty refetch means the server was
 * unreachable, so nothing is claimed at all and the app-wide health banner carries it.
 *
 * THE ACTION SITS AT THE BOTTOM, in the thumb arc, and exists only while there is something
 * to clear. The unread count stays at the top where the eye lands first: status is read,
 * actions are reached for.
 *
 * ROWS DO NOT NAVIGATE. `AppNotification` carries no target id, so a tap could only guess at
 * a destination. A row that goes somewhere plausible but wrong is worse than one that stays
 * put.
 * ------------------------------------------------------------------ */

const KIND_ICON: Record<AppNotification['kind'], IconName> = {
  claim: 'shield-half-outline',
  lead: 'person-add-outline',
  renewal: 'refresh-circle-outline',
  contest: 'trophy-outline',
  system: 'notifications-outline',
};

const KIND_TONE: Record<AppNotification['kind'], SpineTone> = {
  claim: 'primary',
  lead: 'accent',
  renewal: 'warning',
  contest: 'success',
  system: 'neutral',
};

const DAY_MS = 86400000;

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** "Today" / "Yesterday" / "4 days ago" / "12 Jul". Relative only while it stays useful. */
function dayLabel(d: Date): string {
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / DAY_MS);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return fmtDay(d);
}

/**
 * Compact clock for the 48pt spine gutter. `fmtTime`'s "12:45 PM" ellipsizes there, and a
 * truncated timestamp is worse than a terse one.
 */
function shortTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h % 12 || 12}:${m}${h >= 12 ? 'p' : 'a'}`;
}

type DayGroup = {
  key: string;
  label: string;
  items: AppNotification[];
  /** Index of this group's first row in the flattened feed, so the stagger runs continuously. */
  offset: number;
};

export default function Notifications() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Set when the server still reports unread items after a mark-all. */
  const [refused, setRefused] = useState(false);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  /**
   * Every fetch on this screen goes through here. `current` lets a caller cancel its own
   * load (the focus effect flips a flag on blur) and `alive` covers unmount for all of them,
   * so there is no path that can setState on a screen that has gone away.
   */
  const load = useCallback(async (opts: { refresh?: boolean; current?: () => boolean } = {}) => {
    if (opts.refresh) setRefreshing(true);
    const fresh = await api.getNotifications();
    if (!alive.current || (opts.current && !opts.current())) return;
    setItems(fresh);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load({ current: () => active });
    return () => { active = false; };
  }, [load]));

  const unread = items.reduce((n, x) => n + (x.read ? 0 : 1), 0);

  const groups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();
    items.forEach((n) => {
      const d = new Date(n.at);
      const ok = !Number.isNaN(d.getTime());
      const key = ok ? String(startOfDay(d)) : 'undated';
      let g = map.get(key);
      if (!g) {
        g = { key, label: ok ? dayLabel(d) : 'No date recorded', items: [], offset: 0 };
        map.set(key, g);
      }
      g.items.push(n);
    });

    const stamp = (n: AppNotification) => {
      const t = new Date(n.at).getTime();
      return Number.isNaN(t) ? 0 : t;
    };

    const ordered = Array.from(map.values())
      .map((g) => ({ ...g, items: [...g.items].sort((a, b) => stamp(b) - stamp(a)) }))
      // Newest day first; anything the backend sent without a timestamp sinks to the end
      // rather than being silently dated today.
      .sort((a, b) => {
        if (a.key === 'undated') return 1;
        if (b.key === 'undated') return -1;
        return Number(b.key) - Number(a.key);
      });

    // Offsets computed from the sizes rather than by accumulating into a captured variable:
    // a closure that mutates across a map is exactly what the React compiler refuses to
    // memoise, and the group count here is small enough that the slice costs nothing.
    const sizes = ordered.map((g) => g.items.length);
    return ordered.map((g, i) => ({
      ...g,
      offset: sizes.slice(0, i).reduce((n, x) => n + x, 0),
    }));
  }, [items]);

  const markAll = useCallback(async () => {
    if (busy || unread === 0) return;
    haptics.tap();
    setBusy(true);
    setRefused(false);
    const before = items;
    // Optimistic: the thumb gets its answer on the same frame as the tap.
    setItems(items.map((n) => ({ ...n, read: true })));
    try {
      // `markAllNotificationsRead` now reports whether the SERVER accepted the write. It used
      // to return void while silently calling a 404 route (POST /read-all instead of
      // PUT /mark-all-read), so the optimistic list was the only thing that ever changed and
      // the next refetch pulled the unread rows straight back. That was the desync.
      const accepted = await api.markAllNotificationsRead();
      if (!alive.current) return;
      if (!accepted) {
        // Roll back rather than show a cleared feed the server never agreed to.
        setItems(before);
        setRefused(true);
        haptics.warn();
        return;
      }
      const fresh = await api.getNotifications();
      if (!alive.current) return;
      if (fresh.length > 0) {
        setItems(fresh);
        if (fresh.some((n) => !n.read)) {
          setRefused(true);
          haptics.warn();
        } else {
          haptics.success();
        }
      } else {
        // Accepted but the refetch came back empty (outage). The write DID land, so keep the
        // optimistic list; the app-wide health banner carries the connectivity story.
        haptics.success();
      }
    } catch {
      if (!alive.current) return;
      setItems(before);
      setRefused(true);
      haptics.error();
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [busy, unread, items]);

  const retry = useCallback(() => {
    haptics.tap();
    setLoading(true);
    void load();
  }, [load]);

  const showBar = !loading && unread > 0;

  const subtitle = loading
    ? 'Loading your feed'
    : items.length === 0
      ? 'Nothing waiting'
      : unread > 0
        ? `${unread} of ${items.length} still unread`
        : `${items.length} notification${items.length === 1 ? '' : 's'}, all read`;

  return (
    <Screen>
      <Header title="Notifications" subtitle={subtitle} back />

      {!loading && items.length > 0 ? (
        <Row style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          <Pill
            label={unread > 0 ? `${unread} unread` : 'All read'}
            tone={unread > 0 ? 'primary' : 'success'}
            dot
            numeric={unread > 0}
          />
        </Row>
      ) : null}

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + (showBar ? 112 : 48),
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load({ refresh: true })}
            tintColor={c.primary}
            colors={[c.primary]}
            progressBackgroundColor={c.card}
          />
        }
      >
        {refused ? (
          <Banner
            tone="warning"
            title="Not everything could be marked as read"
            message="The server still lists some of these as unread, so the feed below is what it actually holds."
            onDismiss={() => setRefused(false)}
          />
        ) : null}

        {loading ? (
          <FeedSkeleton />
        ) : items.length === 0 ? (
          health.degraded ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="The feed did not load"
              subtitle="Your notifications could not be fetched, so this is not a confirmed empty inbox. Try again once you are back on a signal."
              action={{ label: 'Try again', onPress: retry }}
            />
          ) : (
            <EmptyState
              icon="notifications-off-outline"
              title="You are all caught up"
              subtitle="Claim updates, renewal reminders, new leads and contest results land here as they happen."
            />
          )
        ) : (
          groups.map((g) => (
            <View key={g.key}>
              <Row style={{ gap: spacing.sm, marginBottom: spacing.md }}>
                <Txt size={font.sub} weight="800">{g.label}</Txt>
                <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.hairline }} />
                <Txt size={font.tiny} color={c.faint} numeric>{g.items.length}</Txt>
              </Row>

              <Spine>
                {g.items.map((n, i) => {
                  const d = new Date(n.at);
                  const ok = !Number.isNaN(d.getTime());
                  return (
                    <SpineRow
                      key={n.id}
                      // SpineRow runs its own staggered entrance from `index`, so these rows
                      // are deliberately NOT wrapped in Appear as well: two entrances on one
                      // row fight each other.
                      index={g.offset + i}
                      time={ok ? shortTime(d) : ''}
                      title={n.title || 'Notification'}
                      subtitle={n.body || undefined}
                      icon={KIND_ICON[n.kind] ?? 'notifications-outline'}
                      // Read items fall back to the neutral node, so the rail itself reports
                      // how much is still new.
                      tone={n.read ? 'neutral' : (KIND_TONE[n.kind] ?? 'primary')}
                      right={!n.read ? <Pill label="New" tone="primary" small /> : undefined}
                      last={i === g.items.length - 1}
                    />
                  );
                })}
              </Spine>
            </View>
          ))
        )}
      </ScrollView>

      {showBar ? (
        <View style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          backgroundColor: c.bgElevated,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
        }}>
          <Button
            label={`Mark ${unread} as read`}
            icon="checkmark-done-outline"
            full
            loading={busy}
            onPress={markAll}
          />
        </View>
      ) : null}
    </Screen>
  );
}

/* ================================================================== *
 * Loading — the spine's own geometry, so nothing shifts sideways when
 * the feed lands
 * ================================================================== */

function FeedSkeleton() {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.xl }}>
      {[0, 1].map((g) => (
        <View key={g} style={{ gap: spacing.md }}>
          <Row style={{ gap: spacing.sm }}>
            <Skeleton width={68} height={11} />
            <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.hairline }} />
          </Row>
          {[0, 1, 2].map((i) => (
            <Row key={i} style={{ alignItems: 'flex-start', gap: 0 }}>
              <View style={{ width: 48, alignItems: 'flex-end', paddingRight: 10 }}>
                <Skeleton width={32} height={10} />
              </View>
              <View style={{ width: 18, alignItems: 'center' }}>
                <Skeleton width={9} height={9} radius={radius.pill} style={{ marginTop: 3 }} />
              </View>
              <View style={{ flex: 1, paddingLeft: 12, gap: spacing.sm, paddingBottom: 18 }}>
                <Skeleton width="62%" height={12} />
                <Skeleton width="88%" height={10} />
              </View>
            </Row>
          ))}
        </View>
      ))}
    </View>
  );
}
