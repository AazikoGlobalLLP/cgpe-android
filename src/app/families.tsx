import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Eyebrow, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import { Button, SearchBar } from '@/ui/controls';
import { Banner, EmptyState, Skeleton, SkeletonText } from '@/ui/feedback';
import { DataRow, KpiStrip, ListSection, Pill } from '@/ui/data';
import type { KpiItem } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { Sheet } from '@/ui/sheet';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';

import * as api from '@/data/api';
import type { Family } from '@/data/api';
import { inrShort } from '@/lib/format';
import { call } from '@/lib/actions';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { canViewClients } from '@/store/roles';
import { RestrictedNotice } from '@/ui/RestrictedNotice';

/* ------------------------------------------------------------------ *
 * Families — the book, read as households.
 *
 * The backend derives this from the SAME client rows the rest of the app uses: it
 * de-duplicates policies down to people, then groups those people into households by
 * Gujarati naming structure (first / father-or-husband / surname). Nothing is stored, so
 * a household is an inference, and the API is honest about it: every member carries a
 * confidence, and `review_count` is how many were matched weakly.
 *
 * THAT UNCERTAINTY IS SHOWN, NOT HIDDEN. A "Check" pill on the row and a per-member marker
 * in the sheet is the difference between a grouping the advisor can trust and one they
 * quietly stop believing. An advisor greeting the wrong person as somebody's son is a real
 * cost, so the screen says which links are shaky.
 *
 * THE DETAIL SHEET PREFERS THE SERVER BUT SURVIVES WITHOUT IT. `getFamily(id)` is the
 * source of truth and is fetched on open; the list response already carried the same units
 * and members, so a failed refresh falls back to that with a banner saying so. It is the
 * same data from the same request, never a substitute invented to fill the sheet.
 * ------------------------------------------------------------------ */

const PAGE = 25;
const DEBOUNCE_MS = 400;

/* ---------- untrusted-field helpers ---------- */
const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const asNum = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const asObj = (v: unknown): Record<string, unknown> =>
  (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

type MemberView = {
  key: string;
  name: string;
  role: string;
  age: number | null;
  phone: string;
  cover: number | null;
  premium: number | null;
  policies: number | null;
  /** 'low' means the name-matching engine was unsure this person belongs here. */
  weak: boolean;
  notes: string;
};

type UnitView = {
  key: string;
  no: number;
  generation: number | null;
  head: string;
  members: MemberView[];
};

type FamilyView = {
  id: string;
  head: string;
  surname: string;
  memberCount: number | null;
  unitCount: number | null;
  reviewCount: number;
  generations: number | null;
  premium: number | null;
  cover: number | null;
  policies: number | null;
  units: UnitView[];
};

function parseMembers(v: unknown, unitNo: number): MemberView[] {
  if (!Array.isArray(v)) return [];
  const out: MemberView[] = [];
  v.forEach((raw, i) => {
    const o = asObj(raw);
    const name = asStr(o.name);
    if (!name) return;
    const extra = asObj(o.extra);
    out.push({
      key: asStr(o.id) || `u${unitNo}-${i}-${name}`,
      name,
      role: asStr(o.role),
      age: asNum(o.age),
      phone: asStr(extra.phone),
      cover: asNum(extra.coverage),
      premium: asNum(extra.premium),
      policies: asNum(extra.policies),
      weak: asStr(o.confidence) === 'low',
      notes: asStr(o.notes),
    });
  });
  return out;
}

function parseUnits(v: unknown): UnitView[] {
  if (!Array.isArray(v)) return [];
  const out: UnitView[] = [];
  v.forEach((raw, i) => {
    const o = asObj(raw);
    const no = asNum(o.unit_no) ?? i + 1;
    out.push({
      key: `unit-${no}-${i}`,
      no,
      generation: asNum(o.generation),
      head: asStr(o.head),
      members: parseMembers(o.members, no),
    });
  });
  return out;
}

/** Sum a member field across the household. Returns null when no member carries it. */
function sumOf(units: UnitView[], pick: (m: MemberView) => number | null): number | null {
  let total = 0;
  let seen = false;
  for (const u of units) {
    for (const m of u.members) {
      const n = pick(m);
      if (n != null) { total += n; seen = true; }
    }
  }
  return seen ? total : null;
}

function toFamilyView(raw: Family, i: number): FamilyView {
  const o = raw as Record<string, unknown>;
  const units = parseUnits(o.units);
  const surname = asStr(o.surname);
  const head = asStr(o.head_name) || asStr(o.root) || units[0]?.head || surname || 'Unnamed household';

  return {
    id: asStr(o.family_id) || asStr(o.id) || `family-${i}`,
    head,
    surname,
    memberCount: asNum(o.member_count) ?? (units.length ? units.reduce((n, u) => n + u.members.length, 0) : null),
    unitCount: asNum(o.unit_count) ?? (units.length || null),
    reviewCount: asNum(o.review_count) ?? 0,
    generations: asNum(o.generations),
    // Household totals are not sent as fields; they are summed from the members that were.
    premium: asNum(o.total_premium) ?? sumOf(units, (m) => m.premium),
    cover: asNum(o.total_cover) ?? sumOf(units, (m) => m.cover),
    policies: sumOf(units, (m) => m.policies),
    units,
  };
}

/* ================================================================== *
 * Screen
 * ================================================================== */

/**
 * Point 9 (owner decision, 2026-08-24): Families groups the client book into households, so it is
 * part of the master/admin-only client surface — a team user gets the restricted panel. Thin
 * wrapper so the real screen's hooks are untouched.
 */
export default function Families() {
  const { user, viewAs, ready } = useAuth();
  if (ready && !canViewClients(user, viewAs)) {
    return (
      <RestrictedNotice
        title="Families"
        heading="Families are master and admin only"
        subtitle="Household groupings are built from the client book, which is available to administrators and the master account."
      />
    );
  }
  return <FamiliesScreen />;
}

function FamiliesScreen() {
  const c = useTheme();
  const t = useT();
  const health = useDataHealth();

  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');

  const [rows, setRows] = useState<FamilyView[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<api.FamilyStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [open, setOpen] = useState<FamilyView | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  /* ---------- household totals ---------- */
  const loadStats = useCallback(async () => {
    const s = await api.getFamilyStats();
    if (!mounted.current) return;
    setStats(s);
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);

  /* ---------- debounced search ---------- */
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      setQuery(q.trim());
    }, DEBOUNCE_MS);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = null;
    };
  }, [q]);

  /* ---------- list ---------- */
  const run = useCallback(async (p: number, mode: 'replace' | 'append' | 'refresh') => {
    const my = ++reqId.current;
    if (mode === 'replace') setLoading(true);
    else if (mode === 'append') setLoadingMore(true);
    else setRefreshing(true);

    const res = await api.getFamilies({ search: query || undefined, page: p, limit: PAGE });
    if (!mounted.current || my !== reqId.current) return;

    const next = (Array.isArray(res.data) ? res.data : []).map(toFamilyView);
    setRows((prev) => (mode === 'append' ? [...prev, ...next] : next));
    setTotal(res.total ?? next.length);
    setTotalPages(Math.max(1, res.totalPages ?? 1));
    setPage(p);
    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
  }, [query]);

  useEffect(() => { void run(1, 'replace'); }, [run]);

  const hasMore = page < totalPages;
  const loadMore = useCallback(() => {
    if (loading || loadingMore || refreshing || !hasMore) return;
    void run(page + 1, 'append');
  }, [loading, loadingMore, refreshing, hasMore, page, run]);

  const refresh = useCallback(() => {
    void run(1, 'refresh');
    void loadStats();
  }, [run, loadStats]);

  /* ---------- KPI strip ---------- */
  const kpis: KpiItem[] = useMemo(() => {
    if (!stats) return [];
    const n = (v: number) => v.toLocaleString('en-IN');
    const items: KpiItem[] = [
      { label: 'Households', value: n(stats.families), icon: 'home', tone: 'primary' },
      { label: 'People', value: n(stats.persons), icon: 'people', tone: 'accent' },
      { label: 'Multi-person', value: n(stats.multi_person_families), icon: 'git-merge', tone: 'info' },
    ];
    if (stats.review > 0) items.push({ label: 'Needs a check', value: n(stats.review), icon: 'alert-circle', tone: 'warning' });
    if (stats.largest > 0) items.push({ label: 'Largest', value: n(stats.largest), icon: 'trending-up', tone: 'success' });
    return items;
  }, [stats]);

  const readout = loading
    ? 'Grouping your book into households'
    : total === 0
      ? 'No households'
      : `${total.toLocaleString('en-IN')} household${total === 1 ? '' : 's'}${hasMore ? ', keep scrolling' : ''}`;

  const emptyView = (
    <EmptyState
      icon={query ? 'search-outline' : health.degraded ? 'cloud-offline-outline' : 'home-outline'}
      title={
        query ? `No household matches "${query}"`
          : health.degraded ? 'Households could not load'
            : 'No households to group yet'
      }
      subtitle={
        query ? 'Search looks at every member name and the household surname.'
          : health.degraded ? 'The server did not answer, so nothing here is confirmed. Pull down to try again.'
            : 'Households are grouped from your client book. They appear once records are assigned to you.'
      }
      action={
        query ? { label: t('common.clearSearch'), onPress: () => setQ('') }
          : { label: t('common.tryAgain'), onPress: () => { haptics.tap(); refresh(); } }
      }
    />
  );

  return (
    <Screen>
      <Header
        title="Families"
        subtitle="Your book, grouped into households"
        back
        right={stats && stats.families > 0 ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Metric value={stats.families.toLocaleString('en-IN')} size={font.h3} />
            <Eyebrow>Households</Eyebrow>
          </View>
        ) : undefined}
      />

      {loading && !stats ? (
        <KpiSkeleton />
      ) : kpis.length > 0 ? (
        <Appear index={0}>
          <KpiStrip items={kpis} style={{ marginBottom: spacing.md }} contentStyle={{ paddingHorizontal: spacing.lg }} />
        </Appear>
      ) : null}

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm }}>
        <SearchBar value={q} onChange={setQ} placeholder="Household or member name" />
        <Txt size={font.cap} color={c.faint} numeric numberOfLines={1}>{readout}</Txt>
      </View>

      {loading ? (
        <FamilyListSkeleton />
      ) : (
        <FlatList<FamilyView>
          data={rows}
          keyExtractor={(f, i) => `${f.id}_${i}`}
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
          ListHeaderComponent={rows.length > 0 ? <Hairline top /> : null}
          ItemSeparatorComponent={RowSeparator}
          ListEmptyComponent={emptyView}
          ListFooterComponent={
            <ListFooter
              loadingMore={loadingMore}
              hasMore={hasMore}
              count={rows.length}
              total={total}
              onLoadMore={loadMore}
            />
          }
          renderItem={({ item, index }) => (
            <Appear index={index}>
              <FamilyRow family={item} onOpen={() => setOpen(item)} />
            </Appear>
          )}
        />
      )}

      <FamilySheet family={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

/* ================================================================== *
 * Row
 * ================================================================== */

function FamilyRow({ family, onOpen }: { family: FamilyView; onOpen: () => void }) {
  const c = useTheme();

  const bits: string[] = [];
  if (family.memberCount != null) bits.push(`${family.memberCount} ${family.memberCount === 1 ? 'person' : 'people'}`);
  if (family.unitCount != null && family.unitCount > 1) bits.push(`${family.unitCount} units`);
  if (family.generations != null && family.generations > 1) bits.push(`${family.generations} generations`);

  // The surface lives on a wrapper, not on PersonRow's own `style`: PersonRow applies the
  // caller's style AFTER its pressed tint, so a backgroundColor passed there would silently
  // cancel the press feedback on every row in the list.
  return (
    <View style={{ backgroundColor: c.card }}>
      <PersonRow
        name={family.head}
        subtitle={bits.join(' · ') || family.surname || undefined}
        subtitleIcon="people-outline"
        subtitleNumeric
        onPress={onOpen}
        style={{ marginHorizontal: 0, paddingHorizontal: spacing.lg, borderRadius: 0 }}
        right={
          <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: 116 }}>
            {family.premium != null && family.premium > 0 ? (
              <Metric value={inrShort(family.premium)} size={font.sub} />
            ) : null}
            {family.reviewCount > 0 ? (
              <Pill label={`${family.reviewCount} to check`} tone="warning" small numeric />
            ) : family.cover != null && family.cover > 0 ? (
              <Txt size={font.tiny} color={c.faint} numeric numberOfLines={1}>{inrShort(family.cover)} cover</Txt>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

/* ================================================================== *
 * Detail sheet
 * ================================================================== */

function FamilySheet({ family, onClose }: { family: FamilyView | null; onClose: () => void }) {
  const c = useTheme();
  const t = useT();
  const id = family?.id ?? null;

  /**
   * One state, stamped with the household it belongs to. Separate booleans would let the
   * previous household's members and its failure banner linger into the next one for a
   * frame, which is exactly the kind of mix-up this screen exists to prevent.
   */
  const [load, setLoad] = useState<{ id: string; status: 'busy' | 'done' | 'failed'; data: FamilyView | null } | null>(null);
  /** Bumped by Retry so the effect below re-runs for the same id. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoad({ id, status: 'busy', data: null });
    (async () => {
      const f = await api.getFamily(id);
      if (!alive) return;
      setLoad(f
        ? { id, status: 'done', data: toFamilyView(f, 0) }
        : { id, status: 'failed', data: null });
    })();
    return () => { alive = false; };
  }, [id, attempt]);

  const current = load && load.id === id ? load : null;
  const failed = current?.status === 'failed';
  const busy = current?.status === 'busy';

  // The list row already carries the same units and members, so a failed refresh still has
  // something real to show. The server's answer wins whenever there is one.
  const shown = current?.data ?? family;
  const units = shown?.units ?? [];
  const showSkeleton = busy && units.length === 0;

  const subtitleBits: string[] = [];
  if (shown?.memberCount != null) subtitleBits.push(`${shown.memberCount} people`);
  if (shown?.unitCount != null && shown.unitCount > 1) subtitleBits.push(`${shown.unitCount} units`);

  return (
    <Sheet
      visible={!!family}
      onClose={onClose}
      title={shown?.head ?? ''}
      subtitle={subtitleBits.join(' · ') || undefined}
    >
      <View style={{ gap: spacing.lg, paddingTop: spacing.xs }}>
        {failed ? (
          <Banner
            tone="offline"
            title={units.length > 0 ? 'Could not refresh this household' : 'This household could not be opened'}
            message={units.length > 0
              ? 'Showing the copy that arrived with the list. It may be a few minutes old.'
              : 'The server did not answer. Nothing is missing from your book, it just could not be read right now.'}
            action={{ label: t('common.tryAgain'), onPress: () => { haptics.tap(); setAttempt((n) => n + 1); } }}
          />
        ) : null}

        {showSkeleton ? (
          <FamilySheetSkeleton />
        ) : (
          <>
            {shown ? (
              <ListSection>
                {shown.memberCount != null
                  ? <DataRow label="People" value={String(shown.memberCount)} icon="people-outline" numeric />
                  : null}
                {shown.unitCount != null
                  ? <DataRow label="Units" value={String(shown.unitCount)} icon="git-branch-outline" numeric />
                  : null}
                {shown.generations != null
                  ? <DataRow label="Generations" value={String(shown.generations)} icon="layers-outline" numeric />
                  : null}
                {shown.policies != null
                  ? <DataRow label="Policies" value={String(shown.policies)} icon="document-text-outline" numeric />
                  : null}
                {shown.cover != null && shown.cover > 0
                  ? <DataRow label="Total cover" value={inrShort(shown.cover)} icon="shield-checkmark-outline" numeric />
                  : null}
                {shown.premium != null && shown.premium > 0
                  ? <DataRow label="Yearly premium" value={inrShort(shown.premium)} icon="cash-outline" numeric />
                  : null}
                {shown.reviewCount > 0
                  ? <DataRow label="Weak matches" value={String(shown.reviewCount)} icon="alert-circle-outline" tone="warning" numeric />
                  : null}
              </ListSection>
            ) : null}

            {units.map((u, ui) => (
              <View key={u.key} style={{ gap: spacing.sm }}>
                <Txt size={font.cap} weight="700" color={c.muted}>
                  {u.head ? `${u.head}'s family` : `Unit ${u.no}`}
                  {u.generation != null ? `  ·  generation ${u.generation}` : ''}
                </Txt>
                {u.members.map((m, mi) => (
                  <Appear key={m.key} index={ui + mi}>
                    <PersonRow
                      name={m.name}
                      subtitle={[m.role, m.age != null ? `${m.age} yrs` : '', m.phone]
                        .filter(Boolean).join(' · ') || undefined}
                      subtitleNumeric
                      size={40}
                      badge={m.weak ? { tone: 'warning', icon: 'help' } : undefined}
                      onPress={m.phone ? () => { haptics.tap(); call(m.phone); } : undefined}
                      right={
                        m.cover != null && m.cover > 0
                          ? <Metric value={inrShort(m.cover)} size={font.sub} />
                          : m.phone
                            ? <Pill label={t('common.call')} tone="primary" small icon="call" />
                            : undefined
                      }
                    />
                  </Appear>
                ))}
              </View>
            ))}

            {!showSkeleton && units.length === 0 && !failed ? (
              <EmptyState
                icon="people-outline"
                title="No members on this household"
                subtitle="The grouping engine returned this household without any member records."
              />
            ) : null}

            {units.some((u) => u.members.some((m) => m.weak)) ? (
              <Txt size={font.tiny} color={c.faint} style={{ lineHeight: 16 }}>
                Members marked with a question mark were matched to this household by name alone.
                Confirm the relation before you use it in a conversation.
              </Txt>
            ) : null}
          </>
        )}
      </View>
    </Sheet>
  );
}

/* ================================================================== *
 * List furniture
 * ================================================================== */

/** Avatar (44) + its 12pt gap + the row's 16pt gutter. */
const SEP_INSET = spacing.lg + 44 + spacing.md;

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

function ListFooter({ loadingMore, hasMore, count, total, onLoadMore }: {
  loadingMore: boolean; hasMore: boolean; count: number; total: number; onLoadMore: () => void;
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
        <Button label="Load more households" variant="ghost" size="sm" onPress={onLoadMore} />
      ) : (
        <Txt size={font.cap} color={c.faint} numeric>All {total.toLocaleString('en-IN')} shown</Txt>
      )}
    </View>
  );
}

/* ================================================================== *
 * Loading
 * ================================================================== */

function KpiSkeleton() {
  const c = useTheme();
  return (
    <Row style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md, gap: spacing.sm }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            flex: 1, backgroundColor: c.card, borderRadius: radius.md,
            paddingHorizontal: spacing.md, paddingVertical: 10, gap: 6,
            borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
          }}
        >
          <Skeleton width="70%" height={9} />
          <Skeleton width="46%" height={16} />
        </View>
      ))}
    </Row>
  );
}

function SkeletonRow() {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, minHeight: 64,
    }}>
      <Skeleton width={44} height={44} radius={44 / 2.6} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Skeleton width="54%" height={13} />
        <Skeleton width="40%" height={11} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Skeleton width={52} height={13} />
        <Skeleton width={70} height={18} radius={radius.pill} />
      </View>
    </View>
  );
}

function FamilyListSkeleton() {
  const c = useTheme();
  return (
    <View style={{ backgroundColor: c.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
      {Array.from({ length: 7 }, (_, i) => (
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

function FamilySheetSkeleton() {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{
        backgroundColor: c.card, borderRadius: radius.lg, paddingVertical: spacing.xs,
        borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
      }}>
        {[0, 1, 2].map((i) => (
          <Row key={i} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 48 }}>
            <Skeleton width={16} height={16} radius={4} />
            <Skeleton width="34%" height={12} />
            <View style={{ flex: 1 }} />
            <Skeleton width={54} height={13} />
          </Row>
        ))}
      </View>
      <SkeletonText lines={1} lineHeight={10} />
      {[0, 1, 2].map((i) => (
        <Row key={i} style={{ gap: spacing.md }}>
          <Skeleton width={40} height={40} radius={40 / 2.6} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Skeleton width="52%" height={12} />
            <Skeleton width="36%" height={10} />
          </View>
          <Skeleton width={48} height={13} />
        </Row>
      ))}
    </View>
  );
}
