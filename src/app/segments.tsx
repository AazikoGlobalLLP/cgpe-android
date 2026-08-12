import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Eyebrow, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import { Button, Chips, IconBtn, SearchBar, Segmented } from '@/ui/controls';
import { EmptyState, Skeleton } from '@/ui/feedback';
import { DataRow, ListSection, Pill } from '@/ui/data';
import type { Tone } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { FilterSheet, Sheet } from '@/ui/sheet';
import type { FilterGroup } from '@/ui/sheet';
import { Appear, useCountUp } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';

import * as api from '@/data/api';
import type { SegmentRow } from '@/data/api';
import { fmtDay, inrShort } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * Smart segments — the advisor's working list.
 *
 * WHAT THIS SCREEN IS. `/clients/segments` de-duplicates the policy book down to PEOPLE
 * (or to HOUSEHOLDS) and tags each one with business flags: underinsured, birthday soon,
 * renewal due, high value. The screen is the lens over that: pick the unit, pick the
 * flags, decide whether a row must satisfy all of them or any of them, and order the
 * result. It is the only screen in the app where the user builds their own list.
 *
 * THE SEARCH IS DEBOUNCED HARD, AND THAT IS NOT A DETAIL. Every call scans roughly nine
 * thousand documents in memory on the server. A per-keystroke fetch would fire eight of
 * those for one typed name, so the timer lives in a ref, is cleared before each retype and
 * on unmount, and only a settled query reaches the network.
 *
 * WHERE EACH CONTROL LIVES, and why:
 *   · unit (individual / family)  Segmented, top, because it changes what a row even IS.
 *   · flags                       FilterSheet, because the catalogue is long and carries
 *                                 live facet counts from the server.
 *   · match all / any             inline, and ONLY once two flags are picked. With zero or
 *                                 one flag the toggle has no effect, and a control that
 *                                 does nothing teaches people to ignore controls.
 *   · sort                        its own small sheet. Six options do not fit a segmented
 *                                 control and would wrap two rows of chips over the list.
 *
 * Rows are never fabricated. A failed fetch resolves empty and the app-wide HealthBanner
 * explains it; the empty state here distinguishes "no match" from "nothing loaded".
 * ------------------------------------------------------------------ */

const PAGE = 25;
/** Long enough that a typed name is one request, short enough to feel live. */
const DEBOUNCE_MS = 450;

type Unit = 'individual' | 'family';
type Match = 'all' | 'any';

/* ---------- untrusted-field helpers ----------
 * `SegmentRow` is `Record<string, unknown>`, so every read below is guarded. Nothing is
 * defaulted to a plausible-looking value: a missing number stays null and is not drawn. */
const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const asNum = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const asStrArr = (v: unknown): string[] =>
  (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []);

function asCounts(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (typeof n === 'number' && Number.isFinite(n)) out[k] = n;
  }
  return out;
}

/* ---------- flag catalogue ---------- */

type FlagDef = { key: string; label: string; tone: Tone; units: Unit[] };

/** Backend tone vocabulary -> this app's semantic tones. */
function mapTone(t: string): Tone {
  switch (t) {
    case 'red': return 'danger';
    case 'amber': return 'warning';
    case 'gold': return 'warning';
    case 'green': return 'success';
    case 'purple': return 'accent';
    case 'blue': return 'info';
    case 'navy': return 'primary';
    default: return 'neutral';
  }
}

/**
 * Mirrors services/clientFlags.js FLAG_DEFS. This is CONTROL VOCABULARY, not data: it is
 * only used to keep the filter usable before the first response lands or during an outage,
 * and the server's own `flagDefs` replaces it the moment one arrives. No row, name, amount
 * or date is ever sourced from here.
 */
const FALLBACK_FLAGS: FlagDef[] = [
  { key: 'hot_lead', label: 'Hot lead', tone: 'danger', units: ['individual', 'family'] },
  { key: 'underinsured', label: 'Underinsured', tone: 'warning', units: ['individual', 'family'] },
  { key: 'well_insured', label: 'Well insured', tone: 'success', units: ['individual', 'family'] },
  { key: 'no_coverage', label: 'No cover on file', tone: 'neutral', units: ['individual', 'family'] },
  { key: 'birthday_soon', label: 'Birthday soon', tone: 'accent', units: ['individual', 'family'] },
  { key: 'birthday_today', label: 'Birthday today', tone: 'accent', units: ['individual', 'family'] },
  { key: 'renewal_due', label: 'Renewal due', tone: 'info', units: ['individual', 'family'] },
  { key: 'maturity_soon', label: 'Maturing soon', tone: 'info', units: ['individual', 'family'] },
  { key: 'high_value', label: 'High value', tone: 'warning', units: ['individual', 'family'] },
  { key: 'large_family', label: 'Large family', tone: 'primary', units: ['family'] },
  { key: 'inactive', label: 'Inactive', tone: 'neutral', units: ['individual'] },
];

function parseFlagDefs(v: unknown): FlagDef[] {
  if (!Array.isArray(v)) return [];
  const out: FlagDef[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const key = asStr(o.key);
    if (!key) continue;
    const segs = asStrArr(o.segments);
    const units: Unit[] = segs.length
      ? segs.filter((s): s is Unit => s === 'individual' || s === 'family')
      : ['individual', 'family'];
    out.push({ key, label: asStr(o.label) || key, tone: mapTone(asStr(o.tone)), units });
  }
  return out;
}

/**
 * Keys are the backend's own sort names (services/clientFlags.js sortRows). Labels are kept
 * short because the current one is printed on the control that opens this list, and a
 * six-word label there either wraps or ellipsises into nonsense.
 */
const SORTS: { key: string; label: string }[] = [
  { key: 'priority', label: 'Priority' },
  { key: 'birthday', label: 'Birthday first' },
  { key: 'coverage_asc', label: 'Lowest cover' },
  { key: 'coverage_desc', label: 'Highest cover' },
  { key: 'premium_desc', label: 'Highest premium' },
  { key: 'name', label: 'Name A to Z' },
];
const sortLabel = (k: string) => SORTS.find((s) => s.key === k)?.label ?? 'Priority';

/* ---------- normalised row ---------- */

type MemberView = {
  key: string;
  name: string;
  phone: string;
  role: string;
  age: number | null;
  cover: number | null;
};

type RowView = {
  key: string;
  kind: Unit;
  title: string;
  /** The DataRow value: a phone for a person, a member count for a household. */
  value: string;
  phone: string;
  flags: string[];
  cover: number | null;
  premium: number | null;
  policyCount: number | null;
  memberCount: number | null;
  age: number | null;
  city: string;
  birthdayIn: number | null;
  birthdayName: string;
  renewalDate: string;
  renewalIn: number | null;
  maturityDate: string;
  maturityIn: number | null;
  members: MemberView[];
};

function parseMembers(v: unknown): MemberView[] {
  if (!Array.isArray(v)) return [];
  const out: MemberView[] = [];
  v.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return;
    const o = raw as Record<string, unknown>;
    const name = asStr(o.name);
    if (!name) return;
    out.push({
      key: asStr(o.personKey) || `${name}-${i}`,
      name,
      phone: asStr(o.phone),
      role: asStr(o.role),
      age: asNum(o.age),
      cover: asNum(o.coverage),
    });
  });
  return out;
}

function toRowView(raw: SegmentRow, i: number): RowView {
  const o = raw as Record<string, unknown>;
  const kind: Unit = asStr(o.type) === 'family' ? 'family' : 'individual';
  const phone = asStr(o.phone);
  const memberCount = asNum(o.memberCount);
  const title = kind === 'family'
    ? (asStr(o.familyName) || asStr(o.name) || 'Unnamed household')
    : (asStr(o.name) || 'Unnamed client');

  const value = kind === 'family'
    ? (memberCount != null ? `${memberCount} ${memberCount === 1 ? 'member' : 'members'}` : 'Household')
    : (phone || 'No phone on file');

  return {
    key: asStr(o.personKey) || asStr(o.familyKey) || asStr(o.id) || `${title}-${i}`,
    kind,
    title,
    value,
    phone,
    flags: asStrArr(o.flags),
    cover: kind === 'family' ? asNum(o.totalCoverage) : asNum(o.coverage),
    premium: kind === 'family' ? asNum(o.totalPremium) : asNum(o.premium),
    policyCount: asNum(o.policyCount),
    memberCount,
    age: asNum(o.age),
    city: asStr(o.city),
    birthdayIn: kind === 'family' ? asNum(o.nearestBirthdayInDays) : asNum(o.nextBirthdayInDays),
    birthdayName: asStr(o.nearestBirthdayName),
    renewalDate: asStr(o.renewalDate),
    renewalIn: asNum(o.renewalInDays),
    maturityDate: kind === 'family' ? asStr(o.nearestMaturityDate) : asStr(o.maturityDate),
    maturityIn: kind === 'family' ? asNum(o.nearestMaturityInDays) : asNum(o.maturityInDays),
    members: parseMembers(o.members),
  };
}

/** "in 4 days" / "today" / "in 2 months", from a day count. Never invents a date. */
function inDays(n: number | null): string | null {
  if (n == null) return null;
  if (n === 0) return 'today';
  if (n < 0) return `${Math.abs(n)} days ago`;
  if (n === 1) return 'tomorrow';
  if (n < 45) return `in ${n} days`;
  return `in ${Math.round(n / 30)} months`;
}

/* ================================================================== *
 * Screen
 * ================================================================== */

export default function Segments() {
  const c = useTheme();
  const health = useDataHealth();

  const [unit, setUnit] = useState<Unit>('individual');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');            // the settled, debounced query
  const [flags, setFlags] = useState<string[]>([]);
  const [match, setMatch] = useState<Match>('all');
  const [sort, setSort] = useState('priority');

  const [rows, setRows] = useState<RowView[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [facets, setFacets] = useState<Record<string, number>>({});
  const [defs, setDefs] = useState<FlagDef[]>(FALLBACK_FLAGS);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [open, setOpen] = useState<RowView | null>(null);

  /** Debounce timer. Held in a ref so it can be cleared before each retype AND on unmount. */
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Supersede guard: a slow page must never overwrite a newer filter's result. */
  const reqId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

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

  /* ---------- fetch ---------- */
  const flagKey = flags.join(',');

  const run = useCallback(async (p: number, mode: 'replace' | 'append' | 'refresh') => {
    const my = ++reqId.current;
    if (mode === 'replace') setLoading(true);
    else if (mode === 'append') setLoadingMore(true);
    else setRefreshing(true);

    const res = await api.getClientSegments({
      segment: unit,
      flags: flagKey ? flagKey.split(',') : [],
      match,
      sort,
      search: query || undefined,
      page: p,
      limit: PAGE,
    });

    // Two separate guards, deliberately: `mounted` covers the user leaving the screen,
    // `reqId` covers a newer filter having already answered.
    if (!mounted.current || my !== reqId.current) return;

    const next = (Array.isArray(res.rows) ? res.rows : []).map(toRowView);
    setRows((prev) => (mode === 'append' ? [...prev, ...next] : next));
    setTotal(asNum(res.total) ?? next.length);
    setTotalPages(Math.max(1, asNum(res.totalPages) ?? 1));
    setFacets(asCounts(res.facets));
    const serverDefs = parseFlagDefs(res.flagDefs);
    if (serverDefs.length) setDefs(serverDefs);
    setPage(p);
    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
  }, [unit, flagKey, match, sort, query]);

  // `run` changes identity whenever any query input changes, so this is the single place
  // a filter change turns into a request.
  useEffect(() => { void run(1, 'replace'); }, [run]);

  const hasMore = page < totalPages;
  const loadMore = useCallback(() => {
    if (loading || loadingMore || refreshing || !hasMore) return;
    void run(page + 1, 'append');
  }, [loading, loadingMore, refreshing, hasMore, page, run]);

  /* ---------- flag catalogue for the current unit ---------- */
  const unitDefs = useMemo(() => defs.filter((d) => d.units.includes(unit)), [defs, unit]);
  const defMap = useMemo(() => new Map(defs.map((d) => [d.key, d])), [defs]);

  const groups: FilterGroup[] = useMemo(() => [{
    key: 'flags',
    label: unit === 'family' ? 'Household flags' : 'Client flags',
    mode: 'multi',
    options: unitDefs.map((d) => ({ key: d.key, label: d.label, count: facets[d.key] })),
  }], [unitDefs, facets, unit]);

  /* ---------- control handlers ---------- */
  const pickUnit = useCallback((next: Unit) => {
    if (next === unit) return;
    haptics.select();
    setUnit(next);
    // A flag that does not exist for the new unit would silently return nothing.
    setFlags((prev) => prev.filter((k) => (defMap.get(k)?.units ?? []).includes(next)));
  }, [unit, defMap]);

  const changeFilters = useCallback((next: Record<string, string[]>) => {
    haptics.select();
    setFlags(next.flags ?? []);
  }, []);

  const clearFlags = useCallback(() => { haptics.select(); setFlags([]); }, []);

  const pickMatch = useCallback((m: Match) => {
    if (m === match) return;
    haptics.select();
    setMatch(m);
  }, [match]);

  const pickSort = useCallback((k: string) => {
    haptics.select();
    setSort(k);
    setSortOpen(false);
  }, []);

  /* ---------- readout ---------- */
  const totalDisplay = useCountUp(total);
  const unitWord = unit === 'family' ? 'household' : 'client';
  const readout = loading
    ? 'Working through the book'
    : total === 0
      ? 'Nothing matches'
      : `${totalDisplay.toLocaleString('en-IN')} ${total === 1 ? unitWord : `${unitWord}s`} match`;

  /* Four genuinely different emptinesses, and they must not look alike: a flag combination
     that matches nobody, a search that found nobody, an outage, and a book with nothing in
     it. Each names its own cause and offers the way out of that cause. */
  const flagTitle = query
    ? 'No match for those flags and that search'
    : flags.length === 1
      ? 'Nobody carries that flag right now'
      : match === 'all'
        ? 'Nobody carries all of those flags'
        : 'Nobody carries any of those flags';

  const flagSubtitle = query
    ? 'The search and the flags both have to agree. Clear one of them to widen the list.'
    : flags.length > 1 && match === 'all'
      ? 'A row has to carry every flag you picked. Switch the match to "Any flag", or drop one.'
      : 'Nothing in your book qualifies today. This changes as renewals, birthdays and maturities come round.';

  const emptyView = (
    <EmptyState
      icon={flags.length > 0 ? 'funnel-outline'
        : query ? 'search-outline'
          : health.degraded ? 'cloud-offline-outline' : 'people-outline'}
      title={
        flags.length > 0 ? flagTitle
          : query ? `No ${unitWord} matches "${query}"`
            : health.degraded ? 'Segments could not load'
              : `No ${unitWord}s in your book yet`
      }
      subtitle={
        flags.length > 0 ? flagSubtitle
          : query
            ? (unit === 'family'
              ? 'Search looks at every member name and the household surname.'
              : 'Search covers names, mobile numbers and policy numbers across the whole book.')
            : health.degraded ? 'The server did not answer, so nothing here is confirmed. Pull down to try again.'
              : 'Segments are built from your client book. They fill in as records are assigned to you.'
      }
      action={
        flags.length > 0 ? { label: 'Clear flags', onPress: clearFlags }
          : query ? { label: 'Clear search', onPress: () => setQ('') }
            : { label: 'Try again', onPress: () => { haptics.tap(); void run(1, 'replace'); } }
      }
    />
  );

  return (
    <Screen>
      <Header
        title="Smart segments"
        subtitle="Build a working list from your book"
        back
        right={total > 0 ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Metric value={total.toLocaleString('en-IN')} size={font.h3} />
            <Eyebrow>Matching</Eyebrow>
          </View>
        ) : undefined}
      />

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }}>
        <Row>
          <Segmented<Unit>
            options={[{ key: 'individual', label: 'People' }, { key: 'family', label: 'Households' }]}
            value={unit}
            onChange={pickUnit}
          />
          <View style={{ flex: 1 }} />
          <Button
            label={sortLabel(sort)}
            icon="swap-vertical"
            variant="ghost"
            size="sm"
            // flexShrink so a long sort name ellipsises instead of shoving the segmented
            // control off a narrow screen. Yoga defaults flexShrink to 0, unlike CSS.
            style={{ flexShrink: 1 }}
            // No haptic: opening a chooser commits nothing. The buzz belongs on the choice.
            onPress={() => setSortOpen(true)}
          />
        </Row>

        <Row>
          <SearchBar
            value={q}
            onChange={setQ}
            placeholder={unit === 'family' ? 'Household or member name' : 'Name, mobile or policy number'}
            style={{ flex: 1 }}
          />
          <View>
            <IconBtn
              icon="options-outline"
              size={48}
              bg={flags.length > 0 ? c.primarySoft : c.cardAlt}
              color={flags.length > 0 ? c.primary : c.muted}
              onPress={() => setFilterOpen(true)}
              accessibilityLabel={flags.length > 0 ? `Flags, ${flags.length} active` : 'Filter by flag'}
            />
            {flags.length > 0 ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute', top: -3, right: -3, minWidth: 19, height: 19, paddingHorizontal: 5,
                  borderRadius: radius.pill, backgroundColor: c.primary,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2, borderColor: c.bg,
                }}
              >
                <Txt size={10} weight="800" color={c.onPrimary} numeric>{flags.length}</Txt>
              </View>
            ) : null}
          </View>
        </Row>

        <Row style={{ gap: spacing.sm }}>
          <Txt size={font.cap} color={c.faint} numeric numberOfLines={1} style={{ flex: 1 }}>{readout}</Txt>
          {flags.length > 0 ? (
            <Button label="Clear flags" variant="ghost" size="sm" onPress={clearFlags} />
          ) : null}
        </Row>

        {/* Only meaningful with two or more flags, so it only exists then. */}
        {flags.length > 1 ? (
          <Row style={{ gap: spacing.sm }}>
            <Txt size={font.cap} color={c.muted} numberOfLines={1} style={{ flex: 1 }}>
              A row must carry
            </Txt>
            <Segmented<Match>
              options={[{ key: 'all', label: 'All flags' }, { key: 'any', label: 'Any flag' }]}
              value={match}
              onChange={pickMatch}
            />
          </Row>
        ) : null}
      </View>

      {loading ? (
        <SegmentListSkeleton />
      ) : (
        <FlatList<RowView>
          data={rows}
          keyExtractor={(r, i) => `${r.key}_${i}`}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.xxxl }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => run(1, 'refresh')}
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
              <SegRow row={item} defs={defMap} onOpen={() => setOpen(item)} />
            </Appear>
          )}
        />
      )}

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        groups={groups}
        value={{ flags }}
        onChange={changeFilters}
        onReset={clearFlags}
        title={unit === 'family' ? 'Household flags' : 'Client flags'}
        applyLabel="Show results"
      />

      <Sheet
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        title="Sort"
        subtitle="Order the matching rows"
      >
        <Chips options={SORTS} value={sort} onChange={pickSort} style={{ paddingTop: spacing.xs }} />
      </Sheet>

      <DetailSheet row={open} defs={defMap} onClose={() => setOpen(null)} />
    </Screen>
  );
}

/* ================================================================== *
 * Row
 *
 * Name and phone through DataRow, flags on a second line as Pills, and the household or
 * personal cover parked on the right of that line. Cover is the figure every flag on this
 * screen is ultimately about, so it belongs on the row rather than one tap deeper.
 * ================================================================== */

const MAX_PILLS = 3;

function SegRow({ row, defs, onOpen }: {
  row: RowView; defs: Map<string, FlagDef>; onOpen: () => void;
}) {
  const c = useTheme();
  const shown = row.flags.slice(0, MAX_PILLS);
  const extra = row.flags.length - shown.length;
  const hasCover = row.cover != null && row.cover > 0;
  // A zero cover is real data but not worth a line of its own; the "No cover on file" flag
  // already says it, and an empty strip of padding reads as a rendering fault.
  const hasSecondLine = shown.length > 0 || hasCover;

  const flagWords = row.flags.map((f) => defs.get(f)?.label ?? f.replace(/_/g, ' ')).join(', ');

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={flagWords ? `${row.title}, ${flagWords}` : row.title}
      // The row owns the card surface: the list is one continuous sheet split by hairlines,
      // not a stack of floating cards, so an opaque skin has to come from somewhere.
      style={({ pressed }) => [{ backgroundColor: pressed ? c.cardAlt : c.card }]}
    >
      <DataRow
        icon={row.kind === 'family' ? 'home-outline' : 'person-outline'}
        label={row.title}
        value={row.value}
        numeric={row.kind === 'individual'}
        right={<Ionicons name="chevron-forward" size={16} color={c.faint} />}
      />
      {hasSecondLine ? (
        // DataRow owns its own 12pt bottom padding; the negative margin pulls the flag line
        // back up against the name instead of leaving a dead band between the two.
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2,
          paddingHorizontal: spacing.lg, paddingBottom: spacing.md, marginTop: -6,
        }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, flex: 1 }}>
            {shown.map((f) => (
              <Pill key={f} label={defs.get(f)?.label ?? f.replace(/_/g, ' ')} tone={defs.get(f)?.tone ?? 'neutral'} small />
            ))}
            {extra > 0 ? <Pill label={`+${extra}`} tone="neutral" small numeric /> : null}
          </View>
          {hasCover ? (
            <Txt size={font.cap} weight="700" color={c.muted} numeric numberOfLines={1}>
              {inrShort(row.cover ?? 0)} cover
            </Txt>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/* ================================================================== *
 * Detail
 *
 * Everything shown here already arrived with the row, so opening it costs no request and
 * cannot half-load. Call and WhatsApp sit in the pinned footer: the actions live in the
 * lower third where the thumb is.
 * ================================================================== */

function DetailSheet({ row, defs, onClose }: {
  row: RowView | null; defs: Map<string, FlagDef>; onClose: () => void;
}) {
  const c = useTheme();
  const t = useT();

  const birthday = inDays(row?.birthdayIn ?? null);
  const renewal = inDays(row?.renewalIn ?? null);
  const maturity = inDays(row?.maturityIn ?? null);

  return (
    <Sheet
      visible={!!row}
      onClose={onClose}
      title={row?.title ?? ''}
      subtitle={row?.kind === 'family'
        ? (row.memberCount != null ? `${row.memberCount} people in this household` : 'Household')
        : (row?.city || undefined)}
      footer={row && row.kind === 'individual' && row.phone ? (
        <Row>
          <Button
            label={t('common.call')}
            icon="call"
            full
            style={{ flex: 1 }}
            onPress={() => { haptics.tap(); call(row.phone); }}
          />
          <Button
            label={t('common.whatsapp')}
            icon="logo-whatsapp"
            variant="whatsapp"
            full
            style={{ flex: 1 }}
            onPress={() => { haptics.tap(); whatsapp(row.phone, `Namaste ${row.title}`); }}
          />
        </Row>
      ) : undefined}
    >
      {row ? (
        <View style={{ gap: spacing.lg, paddingTop: spacing.xs }}>
          {row.flags.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {row.flags.map((f) => (
                <Pill key={f} label={defs.get(f)?.label ?? f.replace(/_/g, ' ')} tone={defs.get(f)?.tone ?? 'neutral'} />
              ))}
            </View>
          ) : null}

          <ListSection>
            {row.kind === 'individual' && row.phone
              ? <DataRow label="Mobile" value={row.phone} icon="call-outline" numeric copyable />
              : null}
            {row.kind === 'individual' && row.age != null
              ? <DataRow label="Age" value={`${row.age} years`} icon="person-outline" numeric />
              : null}
            {row.memberCount != null
              ? <DataRow label="Members" value={String(row.memberCount)} icon="people-outline" numeric />
              : null}
            {row.policyCount != null
              ? <DataRow label="Policies" value={String(row.policyCount)} icon="document-text-outline" numeric />
              : null}
            {row.cover != null
              ? <DataRow label="Life cover" value={inrShort(row.cover)} icon="shield-checkmark-outline" numeric />
              : null}
            {row.premium != null
              ? <DataRow label="Yearly premium" value={inrShort(row.premium)} icon="cash-outline" numeric />
              : null}
          </ListSection>

          {birthday || renewal || maturity ? (
            <ListSection title="Dates">
              {birthday ? (
                <DataRow
                  label={row.birthdayName ? `Birthday, ${row.birthdayName}` : 'Birthday'}
                  value={birthday}
                  icon="gift-outline"
                  tone={row.birthdayIn === 0 ? 'accent' : 'neutral'}
                />
              ) : null}
              {renewal ? (
                <DataRow
                  label="Premium due"
                  value={row.renewalDate ? `${fmtDay(row.renewalDate)}, ${renewal}` : renewal}
                  icon="calendar-outline"
                  tone={row.renewalIn != null && row.renewalIn <= 7 ? 'warning' : 'neutral'}
                />
              ) : null}
              {maturity ? (
                <DataRow
                  label="Next maturity"
                  value={row.maturityDate ? `${fmtDay(row.maturityDate)}, ${maturity}` : maturity}
                  icon="trophy-outline"
                />
              ) : null}
            </ListSection>
          ) : null}

          {row.members.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Txt size={font.cap} weight="700" color={c.muted}>Household</Txt>
              {row.members.map((m, i) => (
                <Appear key={m.key} index={i}>
                  <PersonRow
                    name={m.name}
                    subtitle={[m.role, m.age != null ? `${m.age} yrs` : '', m.phone].filter(Boolean).join(' · ') || undefined}
                    subtitleNumeric
                    size={38}
                    right={m.phone ? (
                      <IconBtn
                        icon="call"
                        size={38}
                        bg={c.primarySoft}
                        color={c.primary}
                        onPress={() => { haptics.tap(); call(m.phone); }}
                        accessibilityLabel={`Call ${m.name}`}
                      />
                    ) : (
                      m.cover != null && m.cover > 0
                        ? <Txt size={font.cap} color={c.faint} numeric>{inrShort(m.cover)}</Txt>
                        : undefined
                    )}
                  />
                </Appear>
              ))}
            </View>
          ) : null}

          {row.kind === 'individual' && !row.phone ? (
            <Txt size={font.sub} color={c.muted} style={{ lineHeight: 20 }}>
              No mobile number is on file for this client, so there is nothing to dial from here.
            </Txt>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

/* ================================================================== *
 * List furniture
 * ================================================================== */

/** The DataRow icon (16) + its 12pt gap + the row's 16pt gutter. */
const SEP_INSET = spacing.lg + 16 + spacing.md;

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
        <Button label="Load more" variant="ghost" size="sm" onPress={onLoadMore} />
      ) : (
        <Txt size={font.cap} color={c.faint} numeric>
          All {total.toLocaleString('en-IN')} shown
        </Txt>
      )}
    </View>
  );
}

/* ================================================================== *
 * Loading — the row shape, not a spinner
 * ================================================================== */

function SkeletonRow() {
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 24 }}>
        <Skeleton width={16} height={16} radius={4} />
        <Skeleton width="42%" height={13} />
        <View style={{ flex: 1 }} />
        <Skeleton width={82} height={13} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, marginTop: 10 }}>
        <Skeleton width={72} height={20} radius={radius.pill} />
        <Skeleton width={88} height={20} radius={radius.pill} />
        <View style={{ flex: 1 }} />
        <Skeleton width={64} height={11} />
      </View>
    </View>
  );
}

function SegmentListSkeleton() {
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
