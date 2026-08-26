import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Eyebrow, Header, Metric, Screen, Txt } from '@/ui/base';
import { SearchBar, Segmented } from '@/ui/controls';
import { EmptyState, Skeleton } from '@/ui/feedback';
import { Pill } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { SwipeRow } from '@/ui/swipe';
import type { SwipeAction } from '@/ui/swipe';
import { Appear, useCountUp } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import * as api from '@/data/api';
import type { WaThread } from '@/data/types';
import { timeAgo } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * The WhatsApp inbox.
 *
 * An inbox answers one question before any other: who is waiting on me? So unread is the
 * organising signal on this screen, not a decoration. It appears three times, each time
 * doing a different job — the header figure counts the backlog, the avatar badge makes a
 * waiting thread findable at arm's length, and the row Pill says how many messages are
 * sitting in that one conversation.
 *
 * WHY THE ROWS SIT ON ONE SHEET rather than in a stack of cards. A card per chat turns an
 * inbox into a pile of floating objects and the eye has to re-acquire the left edge on
 * every row. These rows share one `c.card` surface separated by hairlines, inset past the
 * avatar — ListSection's shape, rebuilt on a FlatList because an inbox has to stay
 * virtualised.
 *
 * WHY PersonRow AND NOT DataRow. A conversation is a person, not a label/value pair. The
 * avatar colour is derived from the name, so the same client is the same colour here, on
 * their claim, and in the chat header, and the row is recognised before it is read.
 *
 * WHY SWIPE CARRIES call AND WhatsApp. Reading a thread and reaching the person are two
 * different intents. Tapping opens the conversation; the two actions a field agent
 * actually repeats are one thumb-drag away instead of three taps deep.
 *
 * WHY THIS SCREEN OWNS ITS OWN LOADER INSTEAD OF `hooks/useData`. That hook calls
 * `setData` straight after its await with no cancellation guard and no request ordering,
 * so a refocus landing after a pull-to-refresh can overwrite the newer inbox with the
 * older one, and the write happens whether or not the screen is still mounted. The loader
 * below is the documented alive/cancelled pattern plus a monotonic request id. `useData`
 * is shared by other screens, so it is worked around here rather than edited.
 * ------------------------------------------------------------------ */

type Filter = 'all' | 'unread';

/** Avatar (46) + its 12pt gap + the row's 16pt gutter — where a separator should start. */
const AVATAR = 46;
const SEP_INSET = spacing.lg + AVATAR + spacing.md;

/**
 * `timeAgo` falls through to `fmtDay` on an unparseable date, which renders an em dash.
 * A thread whose `last_at` never came through should show nothing at all rather than a
 * placeholder glyph that reads as data.
 */
function whenLabel(iso: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? timeAgo(iso) : '';
}

function sortTime(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

export default function WhatsAppHub() {
  const c = useTheme();
  const tr = useT(); // `t` is a thread iteration variable throughout this component; translator is `tr`
  const router = useRouter();
  const health = useDataHealth();

  const [data, setData] = useState<WaThread[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  /** Flipped on unmount. Every setState that follows an await is gated on it. */
  const alive = useRef(true);
  /** Monotonic request id, so a slow load can never overwrite a newer one's result. */
  const reqId = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async (pull: boolean) => {
    const my = ++reqId.current;
    if (pull) setRefreshing(true);
    try {
      const list = await api.getWaThreads();
      if (!alive.current || my !== reqId.current) return;
      setData(list ?? []);
    } catch {
      // getWaThreads resolves empty and reports to data/health rather than rejecting, so
      // this only catches a synchronous throw. Either way the list must settle, never
      // invent rows, and never hang on its skeleton.
      if (!alive.current || my !== reqId.current) return;
      setData((prev) => prev ?? []);
    } finally {
      // Only the newest request is allowed to clear the flags a newer one may have set.
      if (alive.current && my === reqId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Refocus re-reads the inbox. `loading` is already false by then, so returning to this
  // screen refreshes in place instead of flashing the skeleton over readable rows.
  useFocusEffect(useCallback(() => { load(false); }, [load]));

  const refresh = useCallback(() => { load(true); }, [load]);

  // Newest conversation first. The endpoint usually returns them ordered, but an inbox
  // that is even occasionally out of sequence is an inbox nobody trusts.
  const threads = useMemo(() => {
    const list = data ?? [];
    return [...list].sort((a, b) => sortTime(b.lastAt) - sortTime(a.lastAt));
  }, [data]);

  const unread = threads.reduce((s, t) => s + (t.unread > 0 ? t.unread : 0), 0);
  const waiting = threads.reduce((n, t) => (t.unread > 0 ? n + 1 : n), 0);

  // The change is the information: this figure moving is the whole reason to open the app.
  const unreadDisplay = useCountUp(unread);

  const query = q.trim().toLowerCase();
  const shown = useMemo(() => threads.filter((t) => {
    if (filter === 'unread' && t.unread <= 0) return false;
    if (!query) return true;
    return t.name.toLowerCase().includes(query)
      || (t.lastMessage || '').toLowerCase().includes(query)
      || (t.phone || '').includes(query)
      || (t.tag || '').toLowerCase().includes(query);
  }), [threads, filter, query]);

  /** Swipe only offers anything on a thread that has a number, so the hint has to know. */
  const swipeable = useMemo(() => shown.some((t) => !!t.phone), [shown]);

  const pickFilter = useCallback((f: Filter) => {
    haptics.select();
    setFilter(f);
  }, []);

  const clearSearch = useCallback(() => { setQ(''); }, []);

  const subtitle = loading
    ? 'Loading your inbox'
    : threads.length === 0
      ? 'Nothing to read right now'
      : waiting > 0
        ? `${threads.length} chats, ${waiting} waiting on you`
        : `${threads.length} chats, all caught up`;

  /* ---------- empty ----------
   * Four outcomes that must not look alike. "No match" and "nothing here yet" ask the user
   * for opposite things, and an outage asks for something different again.
   *
   * AN EMPTY INBOX IS CLASSIFIED BEFORE THE QUERY IS. The search bar is hidden once the
   * list is empty, so a stale query left over from a refresh that came back empty would
   * otherwise report "no chat matches" over what is really an outage or a genuinely empty
   * inbox — and send the user hunting for a search field that is no longer on screen. */
  const emptyKind = threads.length === 0
    ? (health.degraded ? 'outage' : 'none')
    : query ? 'search'
      : filter === 'unread' ? 'filter'
        : 'none';

  const empty = (
    <EmptyState
      icon={
        emptyKind === 'search' ? 'search-outline'
          : emptyKind === 'filter' ? 'checkmark-done-outline'
            : emptyKind === 'outage' ? 'cloud-offline-outline'
              : 'chatbubbles-outline'
      }
      title={
        emptyKind === 'search' ? `No chat matches "${q.trim()}"`
          : emptyKind === 'filter' ? 'Nothing unread'
            : emptyKind === 'outage' ? 'Your inbox could not load'
              : 'No conversations yet'
      }
      subtitle={
        emptyKind === 'search' ? 'Search runs over the name, the last message, the tag and the mobile number.'
          : emptyKind === 'filter' ? 'Every chat here has been read. Switch back to All to see the rest of the inbox.'
            : emptyKind === 'outage' ? 'The server did not answer, so nothing here is confirmed. Check your connection and pull to refresh.'
              : 'Conversations appear here as soon as someone messages the business number.'
      }
      action={
        emptyKind === 'search' ? { label: tr('common.clearSearch'), onPress: clearSearch }
          : emptyKind === 'filter' ? { label: 'Show all chats', onPress: () => pickFilter('all') }
            : { label: tr('common.tryAgain'), onPress: refresh }
      }
    />
  );

  return (
    <Screen>
      <Header
        title="WhatsApp"
        subtitle={subtitle}
        back
        right={!loading && unread > 0 ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Metric value={String(unreadDisplay)} size={font.h3} color={c.whatsapp} />
            <Eyebrow>Unread</Eyebrow>
          </View>
        ) : undefined}
      />

      {!loading && threads.length > 0 ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }}>
          {/* Not debounced, and deliberately so: this filters an array already in memory
              (the endpoint caps at 100 threads), so a timer would only add latency to a
              keystroke that already costs nothing. There is no timer here to leak. */}
          <SearchBar value={q} onChange={setQ} placeholder="Name, message or mobile number" />
          <Segmented<Filter>
            full
            value={filter}
            onChange={pickFilter}
            options={[
              { key: 'all', label: `All ${threads.length}` },
              { key: 'unread', label: waiting > 0 ? `Unread ${waiting}` : 'Unread' },
            ]}
          />
        </View>
      ) : null}

      {loading ? (
        <InboxSkeleton />
      ) : (
        <FlatList<WaThread>
          data={shown}
          keyExtractor={(t) => t.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={c.primary}
              colors={[c.primary]}
              progressBackgroundColor={c.card}
            />
          }
          ListHeaderComponent={shown.length > 0 ? <Hairline top /> : null}
          ItemSeparatorComponent={RowSeparator}
          ListEmptyComponent={empty}
          ListFooterComponent={
            shown.length > 0 ? <ListFooter count={shown.length} swipeable={swipeable} /> : null
          }
          renderItem={({ item, index }) => (
            <Appear index={index}>
              <ThreadRow
                thread={item}
                onOpen={() => router.push(`/whatsapp/${encodeURIComponent(item.id)}`)}
              />
            </Appear>
          )}
        />
      )}
    </Screen>
  );
}

/* ================================================================== *
 * Row
 * ================================================================== */

function ThreadRow({ thread, onOpen }: { thread: WaThread; onOpen: () => void }) {
  const c = useTheme();
  const t = useT();
  const when = whenLabel(thread.lastAt);
  const hasUnread = thread.unread > 0;

  // Two actions maximum, ranked by what the thumb most likely meant: answer in the real
  // WhatsApp app, or pick up the phone.
  const actions: SwipeAction[] = [];
  if (thread.phone) {
    actions.push({
      icon: 'logo-whatsapp',
      label: t('common.whatsapp'),
      tone: 'whatsapp',
      onPress: () => { haptics.tap(); whatsapp(thread.phone); },
    });
    actions.push({
      icon: 'call',
      label: t('common.call'),
      tone: 'primary',
      onPress: () => { haptics.tap(); call(thread.phone); },
    });
  }

  return (
    <SwipeRow actions={actions} onPress={onOpen} radius={0} surface={c.card}>
      <PersonRow
        name={thread.name}
        size={AVATAR}
        subtitle={thread.lastMessage || 'No message text on this thread'}
        badge={hasUnread ? { tone: 'whatsapp' } : undefined}
        style={{ marginHorizontal: 0, paddingHorizontal: spacing.lg, borderRadius: 0 }}
        right={
          <View style={{ alignItems: 'flex-end', gap: 5, maxWidth: 104 }}>
            {when ? (
              <Txt
                size={font.tiny}
                weight={hasUnread ? '700' : '500'}
                color={hasUnread ? c.whatsapp : c.faint}
                numeric
                numberOfLines={1}
              >
                {when}
              </Txt>
            ) : null}
            {hasUnread ? (
              <Pill label={String(thread.unread)} tone="success" small numeric />
            ) : thread.tag ? (
              <Pill label={thread.tag} tone="neutral" small />
            ) : null}
          </View>
        }
      />
    </SwipeRow>
  );
}

/* ---------- list furniture ---------- */

function Hairline({ top }: { top?: boolean }) {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: top ? c.border : c.hairline }} />;
}

function RowSeparator() {
  const c = useTheme();
  return (
    <View style={{ backgroundColor: c.card }}>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: SEP_INSET }} />
    </View>
  );
}

function ListFooter({ count, swipeable }: { count: number; swipeable: boolean }) {
  const c = useTheme();
  return (
    <View style={{
      backgroundColor: c.card, paddingVertical: spacing.md, alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    }}>
      {/* The swipe hint is only printed when a swipe would actually reveal something.
          Threads with no number on file expose no actions, and promising two buttons that
          are not there is how a gesture gets written off as broken. */}
      <Txt size={font.cap} color={c.faint} numeric>
        {count === 1 ? '1 chat' : `${count} chats`}
        {swipeable ? '. Swipe a row to call or reply.' : ''}
      </Txt>
    </View>
  );
}

/* ================================================================== *
 * Loading — shaped like the rows it replaces, not a centred spinner
 * ================================================================== */

function SkeletonRow() {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, minHeight: 66,
    }}>
      <Skeleton width={AVATAR} height={AVATAR} radius={AVATAR / 2.6} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Skeleton width="48%" height={13} />
        <Skeleton width="76%" height={11} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Skeleton width={38} height={10} />
        <Skeleton width={24} height={18} radius={radius.pill} />
      </View>
    </View>
  );
}

function InboxSkeleton() {
  const c = useTheme();
  return (
    <View style={{ backgroundColor: c.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
      {Array.from({ length: 8 }, (_, i) => (
        <View key={i}>
          {i > 0 ? (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: SEP_INSET }} />
          ) : null}
          <SkeletonRow />
        </View>
      ))}
    </View>
  );
}
