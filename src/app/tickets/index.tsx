import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/theme';
import { Eyebrow, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Button, Chips, SearchBar, Segmented } from '@/ui/controls';
import { EmptyState, Skeleton } from '@/ui/feedback';
import { Pill } from '@/ui/data';
import type { Tone } from '@/ui/data';
import { SwipeRow } from '@/ui/swipe';
import type { SwipeAction } from '@/ui/swipe';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import * as api from '@/data/api';
import { timeAgo } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';

/* ------------------------------------------------------------------ *
 * The request inbox — every ticket the WhatsApp bot, AI-Ops or an admin raised.
 *
 * WHY THE REASON IS THE BIGGEST THING IN A ROW. A ticket reference is an index, not
 * information: nobody triages by "TKT-4F21A0". The advisor is scanning for "what does this
 * person want and can I do it now", so the row leads with the client and the AI's
 * understanding, and the reference sits above it as a caption. Status and priority are
 * tokens on the right where the eye lands last, after it has decided the item matters.
 *
 * FILTERING IS SERVER-SIDE, ALL OF IT. The backend paginates, searches and returns facet
 * counts computed over a search-only base, which is why switching the state segment never
 * zeroes the type chips. That means the counts on the controls are true for the whole
 * inbox, not for the page in hand — so the readout under the controls states the scope of
 * what is actually on screen rather than implying the filters ran locally.
 *
 * PRIORITY IS A RAIL PLUS A WORD. A colour alone is unreadable to a third of the people who
 * use this app on a bright screen at arm's length, so P1/P2/P3 is also spelled out in the
 * meta line. The rail is the fast signal, the word is the honest one.
 * ------------------------------------------------------------------ */

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE = 350;

type StateKey = 'all' | 'active' | 'closed';

/* type -> glyph + tone. Open set: the backend normalises anything it does not recognise to
 * a slug, so an unknown key must still render rather than crash the row. */
const TYPE_META: Record<string, { icon: IconName; tone: Tone }> = {
  claim: { icon: 'shield-checkmark-outline', tone: 'danger' },
  lead: { icon: 'flag-outline', tone: 'accent' },
  investment: { icon: 'trending-up-outline', tone: 'primary' },
  policy_review: { icon: 'document-text-outline', tone: 'info' },
  renewal: { icon: 'refresh-outline', tone: 'warning' },
  maturity: { icon: 'cash-outline', tone: 'success' },
  service: { icon: 'construct-outline', tone: 'neutral' },
  call: { icon: 'call-outline', tone: 'primary' },
  complaint: { icon: 'alert-circle-outline', tone: 'danger' },
  other: { icon: 'file-tray-outline', tone: 'neutral' },
};
const FALLBACK_TYPE = { icon: 'file-tray-outline' as IconName, tone: 'neutral' as Tone };
const typeMeta = (k?: string) => TYPE_META[String(k ?? '').toLowerCase()] ?? FALLBACK_TYPE;

const STATUS_TONE: Record<string, Tone> = {
  new: 'info', new_inquiry: 'info', open: 'info',
  assigned: 'primary', in_progress: 'primary', working: 'primary',
  awaiting_customer: 'warning', awaiting_docs: 'warning', pending: 'warning', on_hold: 'warning',
  resolved: 'success', done: 'success', completed: 'success',
  closed: 'neutral', cancelled: 'neutral', canceled: 'neutral',
  lost: 'danger', rejected: 'danger',
};
const statusTone = (s?: string): Tone => STATUS_TONE[String(s ?? '').toLowerCase()] ?? 'neutral';

/** P1 is the loudest thing on the row; anything unlabelled stays structural grey. */
function priorityColor(c: Palette, p?: string): string {
  switch (String(p ?? '').toUpperCase()) {
    case 'P1': return c.danger;
    case 'P2': return c.warning;
    case 'P3': return c.primary;
    default: return c.spine;
  }
}

/** RAG zone the bot stamps on a ticket. Kept separate from priority: they disagree often. */
function zoneTone(z?: string): Tone | null {
  switch (String(z ?? '').toLowerCase()) {
    case 'red': return 'danger';
    case 'amber': return 'warning';
    case 'green': return 'success';
    default: return null;
  }
}

const titleCase = (s: string) =>
  s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

/** Segment labels carry the facet count. Four digits would break the track, so cap it. */
const withCount = (label: string, n: number) => `${label} ${n > 999 ? '999+' : n}`;

/**
 * The wire shape carries `created_at` while the typed model exposes `createdAt`. Both are
 * read, in that order, so the row shows a real age against either backend build instead of
 * silently dropping the timestamp.
 */
type TicketWire = api.Ticket & { created_at?: string | null; updated_at?: string | null };
const createdAtOf = (t: api.Ticket): string | null => {
  const w = t as TicketWire;
  return t.createdAt ?? w.created_at ?? null;
};

export default function TicketsInbox() {
  const c = useTheme();
  const router = useRouter();
  const health = useDataHealth();

  const [items, setItems] = useState<api.Ticket[]>([]);
  const [meta, setMeta] = useState<api.TicketPage['meta']>({
    typeCounts: {},
    stateCounts: { all: 0, active: 0, closed: 0 },
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [state, setState] = useState<StateKey>('active');
  const [type, setType] = useState<string>('all');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');

  /**
   * `loading` is DERIVED, not a flag. It is "the page in hand does not belong to the filter
   * in hand", which is true by construction on mount and the instant a control changes.
   * A separate boolean would have to be flipped in the fetch effect, and a spinner flag that
   * is set in one place and cleared in another is exactly how a screen ends up stuck on a
   * skeleton after a superseded read.
   */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // state and type are fixed-vocabulary tokens with no spaces, so a space join stays unambiguous however the query reads.
  const filterKey = useMemo(() => [state, type, query].join(' '), [state, type, query]);
  const loading = loadedKey !== filterKey;

  /** Newest read wins. An older response that lands late must not repaint the list. */
  const reqId = useRef(0);
  const alive = useRef(true);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // The backend scans the whole ticket collection per keystroke, so the query is committed
  // on a pause. The timer is cleared before every retype and on unmount.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      if (alive.current) setQuery(q.trim());
    }, SEARCH_DEBOUNCE);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = null;
    };
  }, [q]);

  /**
   * Reads only. The caller owns its own spinner, so nothing here writes state before the
   * await and the mount/filter effect below stays free of synchronous renders.
   *
   * Three independent guards, because three different things can invalidate a read in
   * flight: the screen unmounted (`alive`), the effect that started it was torn down by a
   * filter change (`isLive`), or a newer read has already been issued (`reqId`).
   */
  const fetchPage = useCallback(async (
    p: number,
    mode: 'replace' | 'append',
    isLive: () => boolean = () => true,
  ) => {
    const my = ++reqId.current;
    const key = filterKey;

    const res = await api.getTickets({ state, type, search: query, page: p, limit: PAGE_SIZE });

    if (!alive.current || !isLive() || my !== reqId.current) return;
    setItems((prev) => (mode === 'append' ? [...prev, ...res.data] : res.data));
    setMeta(res.meta);
    setTotal(res.total);
    setTotalPages(Math.max(1, res.totalPages));
    setPage(res.page || p);
    setLoadedKey(key);
    setLoadingMore(false);
    setRefreshing(false);
  }, [state, type, query, filterKey]);

  // Re-runs whenever the state segment, the type chip or the committed query changes,
  // because those are `fetchPage`'s only dependencies. The cleanup cancels the read rather
  // than letting a superseded response repaint the list behind a newer one.
  useEffect(() => {
    let running = true;
    void fetchPage(1, 'replace', () => running);
    return () => { running = false; };
  }, [fetchPage]);

  const hasMore = page < totalPages;

  const loadMore = useCallback(() => {
    if (loading || loadingMore || refreshing || !hasMore) return;
    setLoadingMore(true);
    void fetchPage(page + 1, 'append');
  }, [loading, loadingMore, refreshing, hasMore, fetchPage, page]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void fetchPage(1, 'replace');
  }, [fetchPage]);

  /** Retry from an empty state: force the skeleton back so the tap visibly does something. */
  const reload = useCallback(() => {
    setLoadedKey(null);
    void fetchPage(1, 'replace');
  }, [fetchPage]);

  /* ---------- controls ---------- */

  const stateOptions = useMemo(() => ([
    { key: 'all' as StateKey, label: withCount('All', meta.stateCounts.all) },
    { key: 'active' as StateKey, label: withCount('Active', meta.stateCounts.active) },
    { key: 'closed' as StateKey, label: withCount('Closed', meta.stateCounts.closed) },
  ]), [meta.stateCounts]);

  const typeOptions = useMemo(() => {
    const entries = Object.entries(meta.typeCounts).filter(([, n]) => n > 0);
    entries.sort((a, b) => b[1] - a[1]);
    const all = entries.reduce((n, [, v]) => n + v, 0);
    return [
      { key: 'all', label: 'All types', count: all },
      ...entries.map(([k, n]) => ({ key: k, label: titleCase(k), count: n })),
    ];
  }, [meta.typeCounts]);

  const onState = useCallback((next: StateKey) => { haptics.select(); setState(next); }, []);
  const onType = useCallback((next: string) => { haptics.select(); setType(next); }, []);

  const filtered = type !== 'all' || state !== 'all' || query.length > 0;

  const readout = total === 0
    ? 'Nothing to show'
    : hasMore
      ? `${items.length} of ${total} loaded, page ${page} of ${totalPages}`
      : `${items.length} of ${total} shown`;

  /* ---------- empty ----------
   * Four different facts, four different messages. "The server did not answer", "your search
   * found nothing", "this type is empty in this view" and "the inbox is genuinely clear" are
   * not the same event and must never look the same.
   *
   * The outage check comes FIRST on purpose. A successful read clears `data/health`, so a
   * degraded flag at the moment an empty list renders means the read actually failed, and
   * telling someone "no request matches" when the request never reached the server is the
   * one message here that can send them to the wrong conclusion. */
  const empty = health.degraded
    ? (
      <EmptyState
        icon="cloud-offline-outline"
        title="The request inbox could not load"
        subtitle="The server did not answer, so nothing here is confirmed. Check your connection and pull down to refresh."
        action={{ label: 'Try again', onPress: reload }}
      />
    )
    : query
      ? (
        <EmptyState
          icon="search-outline"
          title={`No request matches "${query}"`}
          subtitle="Search runs over the whole inbox, by client name, phone, ticket reference, policy number or task."
          action={{ label: 'Clear search', onPress: () => setQ('') }}
        />
      )
      : type !== 'all'
        ? (
          <EmptyState
            icon="funnel-outline"
            title={`No ${titleCase(type).toLowerCase()} requests in this view`}
            subtitle="This type has nothing in the state you are looking at. Try another state, or drop the type filter."
            action={{ label: 'Show all types', onPress: () => onType('all') }}
          />
        )
        : state === 'closed'
          ? (
            <EmptyState
              icon="archive-outline"
              title="Nothing closed yet"
              subtitle="Requests move here once they are resolved, completed or cancelled."
              action={{ label: 'See active requests', onPress: () => onState('active') }}
            />
          )
          : (
            <EmptyState
              icon="checkmark-done-circle-outline"
              title={state === 'active' ? 'No open requests' : 'No requests raised yet'}
              subtitle={state === 'active'
                ? 'Every request raised for your clients has been closed. New ones arrive here from WhatsApp automatically.'
                : 'Requests raised by the WhatsApp bot, by AI-Ops or from the admin panel land here.'}
              action={state === 'active'
                ? { label: 'Include closed', onPress: () => onState('all') }
                : { label: 'Refresh', onPress: reload }}
            />
          );

  return (
    <Screen>
      <Header
        title="Requests"
        subtitle="Every ticket raised across the firm"
        back
        right={meta.stateCounts.all > 0 ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Metric value={meta.stateCounts.all.toLocaleString('en-IN')} size={font.h3} />
            <Eyebrow>In the inbox</Eyebrow>
          </View>
        ) : undefined}
      />

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }}>
        <SearchBar
          value={q}
          onChange={setQ}
          placeholder="Client, phone, reference or task"
        />

        <Segmented options={stateOptions} value={state} onChange={onState} full />

        {typeOptions.length > 1 ? (
          // Bleeds to both edges so the strip reads as scrollable; `nowrap` keeps every
          // chip on one line instead of stacking three rows of chrome over the list.
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -spacing.lg }}
            contentContainerStyle={{ paddingHorizontal: spacing.lg }}
            keyboardShouldPersistTaps="handled"
          >
            <Chips options={typeOptions} value={type} onChange={onType} style={{ flexWrap: 'nowrap' }} />
          </ScrollView>
        ) : null}

        <Row style={{ gap: spacing.sm }}>
          <Txt size={font.cap} color={c.faint} numeric numberOfLines={1} style={{ flex: 1 }}>
            {readout}
          </Txt>
          {type !== 'all' ? (
            <Button label="Clear type" variant="ghost" size="sm" onPress={() => onType('all')} />
          ) : null}
        </Row>
      </View>

      {loading ? (
        <InboxSkeleton />
      ) : (
        <FlatList<api.Ticket>
          data={items}
          keyExtractor={(t, i) => `${t.id}_${i}`}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.xxxl }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
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
          ListHeaderComponent={items.length > 0 ? <Hairline top /> : null}
          ItemSeparatorComponent={RowSeparator}
          ListEmptyComponent={empty}
          ListFooterComponent={
            <ListFooter
              loadingMore={loadingMore}
              hasMore={hasMore}
              count={items.length}
              total={total}
              filtered={filtered}
              onLoadMore={loadMore}
            />
          }
          renderItem={({ item, index }) => (
            <Appear index={index}>
              <TicketRow ticket={item} onOpen={() => router.push(`/tickets/${item.id}`)} />
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

function TicketRow({ ticket, onOpen }: { ticket: api.Ticket; onOpen: () => void }) {
  const c = useTheme();
  const t = typeMeta(ticket.type);
  const rail = priorityColor(c, ticket.priority);
  const zone = zoneTone(ticket.zone);
  const phone = ticket.client?.phone ?? '';
  const name = ticket.client?.name || 'Customer';

  const reason = ticket.reason || ticket.task || ticket.request_text || '';
  const created = createdAtOf(ticket);

  const meta = [
    ticket.priority ? String(ticket.priority).toUpperCase() : null,
    ticket.policy_no ? `Policy ${ticket.policy_no}` : null,
    ticket.owner?.name ? `With ${ticket.owner.name}` : 'Unclaimed',
    created ? timeAgo(created) : null,
  ].filter(Boolean).join(' · ');

  const actions: SwipeAction[] = phone ? [
    { icon: 'call', label: 'Call', tone: 'primary', onPress: () => { haptics.tap(); call(phone); } },
    {
      icon: 'logo-whatsapp',
      label: 'WhatsApp',
      tone: 'whatsapp',
      onPress: () => { haptics.tap(); whatsapp(phone, `Namaste ${name}`); },
    },
  ] : [];

  return (
    <SwipeRow actions={actions} onPress={onOpen} radius={0} surface={c.card}>
      <View style={{
        flexDirection: 'row', gap: spacing.md,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        opacity: ticket.is_closed ? 0.62 : 1,
      }}>
        {/* Priority rail. Colour is the fast read; the meta line below spells it out. */}
        <View style={{ width: 3, borderRadius: 2, backgroundColor: rail, alignSelf: 'stretch', minHeight: 44 }} />

        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name={t.icon} size={13} color={c.faint} />
            <Txt size={font.tiny} weight="700" color={c.faint} numeric numberOfLines={1} style={{ flexShrink: 1 }}>
              {ticket.ticket_ref || ticket.type_label || 'Request'}
            </Txt>
            <View style={{ flex: 1, minWidth: spacing.xs }} />
            {zone ? <Pill label={titleCase(String(ticket.zone))} tone={zone} small dot /> : null}
            <Pill label={ticket.status_label || titleCase(ticket.status)} tone={statusTone(ticket.status)} small />
          </View>

          <Txt size={font.body} weight="700" numberOfLines={1}>{name}</Txt>

          {reason ? (
            <Txt size={font.sub} color={c.muted} numberOfLines={2} style={{ lineHeight: 19 }}>
              {reason}
            </Txt>
          ) : (
            <Txt size={font.sub} color={c.faint} numberOfLines={1}>No description was captured</Txt>
          )}

          {meta ? (
            <Txt size={font.tiny} color={c.faint} numeric numberOfLines={1}>{meta}</Txt>
          ) : null}
        </View>
      </View>
    </SwipeRow>
  );
}

/* ---------- sheet furniture ---------- */

/** Rail (3) + its 12pt gap + the row's 16pt gutter. */
const SEP_INSET = spacing.lg + 3 + spacing.md;

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

function ListFooter({ loadingMore, hasMore, count, total, filtered, onLoadMore }: {
  loadingMore: boolean; hasMore: boolean; count: number; total: number; filtered: boolean;
  onLoadMore: () => void;
}) {
  const c = useTheme();
  if (count === 0) return null;

  if (loadingMore) {
    return (
      <View style={{ backgroundColor: c.card }}>
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: SEP_INSET }} />
        <SkeletonRow />
        <Hairline />
      </View>
    );
  }

  return (
    <View style={{
      backgroundColor: c.card, paddingVertical: spacing.md, alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    }}>
      {hasMore ? (
        <Button label="Load more requests" variant="ghost" size="sm" onPress={onLoadMore} />
      ) : (
        <Txt size={font.cap} color={c.faint} numeric>
          {filtered ? `All ${total.toLocaleString('en-IN')} matching requests shown` : `All ${total.toLocaleString('en-IN')} requests shown`}
        </Txt>
      )}
    </View>
  );
}

/* ================================================================== *
 * Loading — the shape of the row that is coming, not a centred spinner
 * ================================================================== */

function SkeletonRow() {
  return (
    <View style={{
      flexDirection: 'row', gap: spacing.md,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 96,
    }}>
      <Skeleton width={3} height={64} radius={2} />
      <View style={{ flex: 1, gap: 7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Skeleton width={86} height={10} />
          <View style={{ flex: 1 }} />
          <Skeleton width={62} height={18} radius={radius.pill} />
        </View>
        <Skeleton width="46%" height={14} />
        <Skeleton width="94%" height={11} />
        <Skeleton width="66%" height={11} />
      </View>
    </View>
  );
}

function InboxSkeleton() {
  const c = useTheme();
  return (
    <View style={{
      backgroundColor: c.card,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
    }}>
      {Array.from({ length: 6 }, (_, i) => (
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
