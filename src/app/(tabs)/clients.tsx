import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/theme';
import { Eyebrow, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import { Button, IconBtn, SearchBar } from '@/ui/controls';
import { EmptyState, Skeleton } from '@/ui/feedback';
import { Pill } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { FilterSheet } from '@/ui/sheet';
import type { FilterGroup } from '@/ui/sheet';
import { SwipeRow } from '@/ui/swipe';
import type { SwipeAction } from '@/ui/swipe';
import { Appear, useCountUp } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import * as api from '@/data/api';
import type { Client } from '@/data/types';
import { SEG_META } from '@/data/labels';
import { daysUntil, fmtDay, inrShort } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { canViewOwnClients } from '@/store/roles';
import { RestrictedNotice } from '@/ui/RestrictedNotice';

/* ------------------------------------------------------------------ *
 * The client book — thousands of rows, one page of 100 at a time.
 *
 * WHY THIS IS A SHEET AND NOT A STACK OF CARDS. A card per row turns a 9,000-row book
 * into 9,000 floating objects; the eye has to re-acquire the left edge on every row.
 * The rows here sit on one continuous `c.card` surface separated by hairlines, which is
 * exactly ListSection's shape — rebuilt on a FlatList because ListSection renders all of
 * its children at once and this list must stay virtualised.
 *
 * FILTERS APPLY TO WHAT IS LOADED, and the readout under the search bar says so. The
 * backend paginates and searches server-side; segment/renewal buckets are derived per
 * record by the adapter, so filtering them client-side is honest as long as the scope is
 * stated. Search stays server-side, so it still reaches the whole book.
 * ------------------------------------------------------------------ */

type Filters = Record<string, string[]>;

const SEG_KEYS = ['renewal_due', 'birthday', 'maturity_soon', 'cross_sell'] as const;

/** Premium-due bucket from the policy's FUP date. '' / unparseable dates fall to 'none'. */
type RenewalBucket = 'overdue' | 'due30' | 'later' | 'none';
function renewalBucket(cl: Client): RenewalBucket {
  const due = cl.policies[0]?.nextRenewal;
  if (!due) return 'none';
  const d = daysUntil(due);
  if (!Number.isFinite(d)) return 'none';
  if (d < 0) return 'overdue';
  if (d <= 30) return 'due30';
  return 'later';
}

const countBy = (items: Client[], pred: (cl: Client) => boolean) => items.reduce((n, cl) => (pred(cl) ? n + 1 : n), 0);

/**
 * Point 9 (owner decision, 2026-08-24): the client book is master/admin-only. A team-tier user
 * gets a restricted panel instead of the directory — the app-side half of the gate (the server
 * `GET /clients` role gate is the real authority, filed for the owner to relay). Kept as a thin
 * wrapper so the real screen's hooks are untouched (no conditional-hooks hazard).
 */
export default function Clients() {
  const { user, viewAs, ready } = useAuth();
  const t = useT();
  if (ready && !canViewOwnClients(user, viewAs)) {
    return (
      <RestrictedNotice
        title={t('tab.clients')}
        back={false}
        heading={t('clients.restrictedTitle')}
        subtitle={t('clients.restrictedBody')}
      />
    );
  }
  return <ClientsScreen />;
}

function ClientsScreen() {
  const c = useTheme();
  const t = useT();
  // Phase 29: layout scale comes off the theme so `theme.density` can tighten it per department.
  const { spacing, radius, font } = c;
  const router = useRouter();
  const health = useDataHealth();

  const [items, setItems] = useState<Client[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const reqId = useRef(0);
  const firstRun = useRef(true);

  // Portfolio total (un-scoped aggregate on the backend)
  useEffect(() => { api.getClientStats().then((s) => s && setTotal(s.total_clients)); }, []);

  const fetchPage = useCallback(async (p: number, search: string, mode: 'replace' | 'append' | 'refresh') => {
    const my = ++reqId.current;
    if (mode === 'replace') setLoading(true);
    else if (mode === 'append') setLoadingMore(true);
    else setRefreshing(true);
    const res = await api.getClientsPage(p, search);
    if (my !== reqId.current) return; // a newer search superseded this
    setItems((prev) => (mode === 'append' ? [...prev, ...res.items] : res.items));
    setHasMore(res.hasMore);
    setPage(p);
    setLoading(false); setLoadingMore(false); setRefreshing(false);
  }, []);

  useEffect(() => { fetchPage(1, '', 'replace'); }, [fetchPage]);

  // Debounced server-side search across the whole book. The first pass is skipped so the
  // mount fetch above is not fired twice against a 9,000-row endpoint.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => { fetchPage(1, q.trim(), 'replace'); }, 400);
    return () => clearTimeout(t);
  }, [q, fetchPage]);

  const loadMore = useCallback(() => {
    if (!loadingMore && !loading && !refreshing && hasMore) fetchPage(page + 1, q.trim(), 'append');
  }, [loadingMore, loading, refreshing, hasMore, fetchPage, page, q]);

  /* ---------- filtering, over the loaded page(s) ---------- */
  const groups: FilterGroup[] = useMemo(() => [
    {
      key: 'segment',
      label: t('filter.segment'),
      mode: 'multi',
      options: SEG_KEYS.map((k) => ({
        key: k,
        label: SEG_META[k] ? t(SEG_META[k].labelKey) : k,
        count: countBy(items, (cl) => cl.segment.includes(k)),
      })),
    },
    {
      key: 'renewal',
      label: t('act.premiumDue'),
      mode: 'single',
      options: [
        { key: 'overdue', label: t('tasks.overdue'), count: countBy(items, (cl) => renewalBucket(cl) === 'overdue') },
        { key: 'due30', label: t('filter.next30'), count: countBy(items, (cl) => renewalBucket(cl) === 'due30') },
        { key: 'later', label: t('filter.later'), count: countBy(items, (cl) => renewalBucket(cl) === 'later') },
      ],
    },
    {
      key: 'contact',
      label: t('filter.contact'),
      mode: 'single',
      options: [
        { key: 'has_phone', label: t('filter.hasPhone'), count: countBy(items, (cl) => !!cl.phone) },
        { key: 'no_phone', label: t('filter.noPhone'), count: countBy(items, (cl) => !cl.phone) },
      ],
    },
  ], [items, t]);

  const activeCount = useMemo(
    () => groups.reduce((n, g) => n + (filters[g.key]?.length ?? 0), 0),
    [groups, filters],
  );

  const shown = useMemo(() => {
    if (activeCount === 0) return items;
    const segs = filters.segment ?? [];
    const ren = filters.renewal?.[0];
    const con = filters.contact?.[0];
    return items.filter((cl) => {
      if (segs.length > 0 && !cl.segment.some((s) => segs.includes(s))) return false;
      if (ren && renewalBucket(cl) !== ren) return false;
      if (con === 'has_phone' && !cl.phone) return false;
      if (con === 'no_phone' && cl.phone) return false;
      return true;
    });
  }, [items, filters, activeCount]);

  const clearFilters = useCallback(() => { haptics.select(); setFilters({}); }, []);

  const loadedDisplay = useCountUp(items.length);

  /* ---------- readout ---------- */
  const readout = activeCount > 0
    ? `${shown.length} of ${loadedDisplay} loaded match these filters`
    : hasMore
      ? `${loadedDisplay} loaded, keep scrolling for more`
      : `${loadedDisplay} loaded`;

  const empty = (
    <EmptyState
      icon={activeCount > 0 ? 'funnel-outline' : q ? 'search-outline' : health.degraded ? 'cloud-offline-outline' : 'people-outline'}
      title={
        activeCount > 0 ? 'Nothing loaded matches these filters'
          : q ? `No client matches "${q.trim()}"`
            : health.degraded ? 'The client book could not load'
              : 'No clients in your book yet'
      }
      subtitle={
        activeCount > 0 ? 'Filters run over the clients loaded so far. Clear them, or load more of the book first.'
          : q ? 'Search runs across the whole book, by name, policy number or mobile number.'
            : health.degraded ? 'The server did not answer, so nothing here is confirmed. Check your connection and pull to refresh.'
              : 'Clients appear here as soon as records are assigned to you.'
      }
      action={
        activeCount > 0 ? { label: 'Clear filters', onPress: clearFilters }
          : q ? { label: t('common.clearSearch'), onPress: () => setQ('') }
            : { label: t('common.tryAgain'), onPress: () => fetchPage(1, q.trim(), 'replace') }
      }
    />
  );

  return (
    <Screen>
      <Header
        title={t('tab.clients')}
        subtitle={t('clients.searchSubtitle')}
        right={total != null && total > 0 ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Metric value={total.toLocaleString('en-IN')} size={font.h3} />
            <Eyebrow>{t('common.inTheBook')}</Eyebrow>
          </View>
        ) : undefined}
      />

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }}>
        <Row>
          <SearchBar
            value={q}
            onChange={setQ}
            placeholder="Name, policy number or mobile"
            style={{ flex: 1 }}
          />
          <View>
            <IconBtn
              icon="options-outline"
              size={48}
              bg={activeCount > 0 ? c.primarySoft : c.cardAlt}
              color={activeCount > 0 ? c.primary : c.muted}
              onPress={() => setFilterOpen(true)}
              accessibilityLabel={activeCount > 0 ? `Filters, ${activeCount} active` : 'Filter clients'}
            />
            {activeCount > 0 ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute', top: -3, right: -3, minWidth: 19, height: 19, paddingHorizontal: 5,
                  borderRadius: radius.pill, backgroundColor: c.primary,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2, borderColor: c.bg,
                }}
              >
                <Txt size={10} weight="800" color={c.onPrimary} numeric>{activeCount}</Txt>
              </View>
            ) : null}
          </View>
        </Row>

        <Row style={{ gap: spacing.sm }}>
          <Txt size={font.cap} color={c.faint} numeric numberOfLines={1} style={{ flex: 1 }}>{readout}</Txt>
          {activeCount > 0 ? (
            <Button label={t('common.clear')} variant="ghost" size="sm" onPress={clearFilters} />
          ) : null}
        </Row>
      </View>

      {loading ? (
        <ClientListSkeleton />
      ) : (
        <FlatList<Client>
          data={shown}
          keyExtractor={(cl, i) => `${cl.id}_${i}`}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.xxxl }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchPage(1, q.trim(), 'refresh')}
              tintColor={c.primary}
              colors={[c.primary]}
              progressBackgroundColor={c.card}
            />
          }
          ListHeaderComponent={shown.length > 0 ? <Hairline top /> : null}
          ItemSeparatorComponent={RowSeparator}
          ListEmptyComponent={empty}
          ListFooterComponent={
            <ListFooter
              loadingMore={loadingMore}
              hasMore={hasMore}
              count={shown.length}
              onLoadMore={loadMore}
            />
          }
          renderItem={({ item, index }) => (
            <Appear index={index}>
              <ClientRow client={item} onOpen={() => router.push(`/client/${item.id}`)} />
            </Appear>
          )}
        />
      )}

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        groups={groups}
        value={filters}
        onChange={(next) => { haptics.select(); setFilters(next); }}
        onReset={() => { haptics.select(); setFilters({}); }}
        title="Filter loaded clients"
        applyLabel={t('common.showResults')}
      />
    </Screen>
  );
}

/* ================================================================== *
 * Row
 * ================================================================== */

function ClientRow({ client, onOpen }: { client: Client; onOpen: () => void }) {
  const c = useTheme();
  const { spacing, font } = c;
  const t = useT();
  const p = client.policies[0];
  const hasPolicyNo = !!p?.number && p.number !== '—';
  const due = p?.nextRenewal ? daysUntil(p.nextRenewal) : NaN;
  const hasDue = Number.isFinite(due);

  const subtitle = hasPolicyNo ? `Policy ${p!.number}` : client.phone || client.city || 'No policy number on record';
  const subtitleIcon = hasPolicyNo ? 'document-text-outline' : client.phone ? 'call-outline' : 'alert-circle-outline';

  // One status token per row, ranked by urgency: money first, then the courtesy touch.
  const pill = hasDue && due < 0 ? { label: t('tasks.overdue'), tone: 'danger' as const }
    : hasDue && due === 0 ? { label: t('common.dueToday'), tone: 'danger' as const }
      : hasDue && due <= 30 ? { label: t('common.dueOn', { date: fmtDay(p!.nextRenewal) }), tone: 'warning' as const }
        : client.segment.includes('birthday') ? { label: t('seg.birthday'), tone: 'accent' as const }
          : null;

  const actions: SwipeAction[] = client.phone ? [
    {
      icon: 'call', label: t('common.call'), tone: 'primary',
      onPress: () => { haptics.tap(); call(client.phone); },
    },
    {
      icon: 'logo-whatsapp', label: t('common.whatsapp'), tone: 'whatsapp',
      onPress: () => { haptics.tap(); whatsapp(client.phone, `Namaste ${client.name}`); },
    },
  ] : [];

  return (
    <SwipeRow actions={actions} onPress={onOpen} radius={0} surface={c.card}>
      <PersonRow
        name={client.name}
        subtitle={subtitle}
        subtitleIcon={subtitleIcon}
        subtitleNumeric
        style={{ marginHorizontal: 0, paddingHorizontal: spacing.lg, borderRadius: 0 }}
        right={
          <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: 112 }}>
            {client.totalPremium > 0 ? <Metric value={inrShort(client.totalPremium)} size={font.sub} /> : null}
            {pill ? <Pill label={pill.label} tone={pill.tone} small /> : null}
          </View>
        }
      />
    </SwipeRow>
  );
}

/* ---------- sheet furniture ---------- */

/** Left inset for a row separator: the row's gutter (`lg`) + the 44pt avatar + its gap (`md`),
 *  computed from the ACTIVE density scale so separators stay aligned when `theme.density` tightens
 *  the gutter. The avatar is a fixed 44pt touch target and does not scale with density. */
const sepInset = (s: { lg: number; md: number }) => s.lg + 44 + s.md;

function Hairline({ top }: { top?: boolean }) {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: top ? c.border : c.hairline }} />;
}

function RowSeparator() {
  const c = useTheme();
  const inset = sepInset(c.spacing);
  return (
    <View style={{ backgroundColor: c.card }}>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: inset }} />
    </View>
  );
}

function ListFooter({ loadingMore, hasMore, count, onLoadMore }: {
  loadingMore: boolean; hasMore: boolean; count: number; onLoadMore: () => void;
}) {
  const c = useTheme();
  const { spacing, font } = c;
  const inset = sepInset(spacing);
  if (count === 0) return null;

  if (loadingMore) {
    return (
      <View style={{ backgroundColor: c.card }}>
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: inset }} />
        <SkeletonRow />
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: inset }} />
        <SkeletonRow />
        <Hairline />
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: c.card, paddingVertical: spacing.md, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }}>
      {hasMore ? (
        <Button label="Load more clients" variant="ghost" size="sm" onPress={onLoadMore} />
      ) : (
        <Txt size={font.cap} color={c.faint} numeric>All {count.toLocaleString('en-IN')} loaded</Txt>
      )}
    </View>
  );
}

/* ================================================================== *
 * Loading — shaped like the row it replaces, not a centred spinner
 * ================================================================== */

function SkeletonRow() {
  const { spacing, radius } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, minHeight: 64,
    }}>
      <Skeleton width={44} height={44} radius={44 / 2.6} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Skeleton width="58%" height={13} />
        <Skeleton width="38%" height={11} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Skeleton width={54} height={13} />
        <Skeleton width={62} height={18} radius={radius.pill} />
      </View>
    </View>
  );
}

function ClientListSkeleton() {
  const c = useTheme();
  const inset = sepInset(c.spacing);
  return (
    <View style={{ backgroundColor: c.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
      {Array.from({ length: 8 }, (_, i) => (
        <View key={i}>
          {i > 0 ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: inset }} /> : null}
          <SkeletonRow />
        </View>
      ))}
    </View>
  );
}
