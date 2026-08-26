import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme';
import { Card, Header, Row, Screen, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Chips, Fab } from '@/ui/controls';
import { EmptyState, Skeleton } from '@/ui/feedback';
import { DataRow, KpiStrip, Pill } from '@/ui/data';
import type { KpiItem } from '@/ui/data';
import { Appear, useCountUp } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';

import * as api from '@/data/api';
import type { ClaimsSummary } from '@/data/api';
import type { Claim, ClaimStatus } from '@/data/types';
import { CLAIM_STATUS } from '@/data/labels';
import { useT } from '@/i18n';
import { inrShort } from '@/lib/format';
import { useAppUi } from '@/store/appUi';

/* ------------------------------------------------------------------ *
 * The claims register.
 *
 * A claim is the one thing in this product where the customer is already unhappy and the
 * clock is already running, so the screen answers two questions and nothing else:
 *
 *   1. HOW MUCH MONEY IS IN FLIGHT?  The KPI strip. Register totals come from
 *      /claims/stats/summary (un-scoped) and are labelled as such; when that endpoint is
 *      unavailable the strip falls back to what THIS list actually contains and says so in
 *      the labels. It never mixes the two, because "paid out" across the branch and "paid
 *      out on my rows" are different facts.
 *   2. WHICH ONE IS STUCK?  The status chips. Every status carries its own count, so the
 *      filter doubles as the register's shape at a glance, and each view has its own
 *      honest empty message. "Nothing waiting on documents" and "nothing settled yet" are
 *      opposite pieces of news and must never share one line of copy.
 *
 * ROWS ARE DataRow ON ONE CONTINUOUS SURFACE, not a stack of cards. A card per claim turns
 * a register into a pile of floating objects and the eye has to re-acquire the left edge on
 * every row. This is ListSection's shape rebuilt on a FlatList, for the same reason the
 * client book does it: /claims returns up to 500 records and the list has to stay
 * virtualised. Money is the `value` so the amounts align down a tabular column; status is
 * the trailing Pill.
 *
 * NO GRADIENT HERE. The brand ramp is rationed to the clock-in ring and the active tab.
 * ------------------------------------------------------------------ */

type Filter = 'all' | ClaimStatus;

/** The claim type carries its own glyph so a register can be scanned without reading. */
const TYPE_ICON: Record<Claim['type'], IconName> = {
  Health: 'medkit-outline',
  Death: 'flower-outline',
  Maturity: 'cash-outline',
  Surrender: 'exit-outline',
  Accident: 'car-outline',
};

/** One honest message per view. A shared "nothing here" would misreport six of the seven. */
const EMPTY_COPY: Record<Filter, { icon: IconName; title: string; subtitle: string; add?: boolean }> = {
  all: {
    icon: 'shield-outline',
    title: 'No claims in your register',
    subtitle: 'Claims you register appear here with their documents and status. Start one with the button below.',
    add: true,
  },
  intake: {
    icon: 'download-outline',
    title: 'Nothing at intake',
    subtitle: 'No claim is waiting to be opened. New claims land here first.',
    add: true,
  },
  docs_pending: {
    icon: 'document-attach-outline',
    title: 'Nothing waiting on documents',
    subtitle: 'Every open claim has the paperwork it needs right now.',
  },
  under_review: {
    icon: 'search-outline',
    title: 'Nothing under review',
    subtitle: 'No claim is being assessed by the insurer at the moment.',
  },
  submitted: {
    icon: 'paper-plane-outline',
    title: 'Nothing submitted',
    subtitle: 'No claim has been sent to the insurer yet.',
  },
  settled: {
    icon: 'checkmark-done-circle-outline',
    title: 'Nothing settled yet',
    subtitle: 'Claims move here once the insurer has paid out.',
  },
  rejected: {
    icon: 'close-circle-outline',
    title: 'Nothing rejected',
    subtitle: 'No claim in your register has been turned down.',
  },
};

/* ---------- loading ----------
 * Shaped like the real screen: three KPI chips, a filter rail, then rows on one surface.
 * The layout does not shift when the register lands, which a centred spinner cannot
 * promise. */
function ClaimsSkeleton() {
  const c = useTheme();
  const { spacing, radius } = c;
  return (
    <View style={{ gap: spacing.lg }}>
      <Row style={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
        {[0, 1, 2].map((i) => <Skeleton key={i} width={104} height={52} radius={radius.md} />)}
      </Row>

      <Row style={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
        {[56, 74, 106, 82].map((w, i) => <Skeleton key={i} width={w} height={36} radius={radius.pill} />)}
      </Row>

      <View style={{
        backgroundColor: c.card,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
      }}>
        {Array.from({ length: 7 }, (_, i) => (
          <View key={i}>
            {i > 0 ? (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: spacing.lg }} />
            ) : null}
            <Row style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 48 }}>
              <Skeleton width={16} height={16} radius={4} />
              <Skeleton width="34%" height={12} />
              <View style={{ flex: 1 }} />
              <Skeleton width={48} height={13} />
              <Skeleton width={70} height={20} radius={radius.pill} />
            </Row>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function Claims() {
  const c = useTheme();
  const t = useT();
  // Phase 30: layout scale comes off the theme so `theme.density` can tighten it per department.
  const { spacing, font } = c;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { can, ready: uiReady } = useAppUi();
  // Band 2 #8 (2026-08-25): registering a claim is a team-allowed action (schema default true), so
  // there is no tier gate — the RBAC `can_create_claim` flag gates the affordance alone, failing
  // OPEN (missing/loading = allowed) so today every tier keeps it and a future config can hide it.
  const canCreateClaim = uiReady ? can('can_create_claim') !== false : true;
  const health = useDataHealth();

  const [claims, setClaims] = useState<Claim[]>([]);
  const [sum, setSum] = useState<ClaimsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  /** Bumped to re-run the focus effect for an explicit refresh or retry. */
  const [nonce, setNonce] = useState(0);

  /* The register and its money totals are fetched together and CANCELLED together. `alive` is
   * the guard a shared loader hook cannot give us: this screen is a tab, so a blur, a
   * logout or a fast back-out can land a response on a component that is already gone. */
  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      const [list, summary] = await Promise.all([api.getClaims(), api.getClaimsSummary()]);
      if (!alive) return;
      setClaims(list);
      setSum(summary);
      setLoading(false);
      setRefreshing(false);
    })();
    return () => { alive = false; };
  }, [nonce]));

  const counts = useMemo(() => {
    const m: Partial<Record<Filter, number>> = { all: claims.length };
    claims.forEach((cl) => { m[cl.status] = (m[cl.status] ?? 0) + 1; });
    return m;
  }, [claims]);

  const filtered = useMemo(
    () => (filter === 'all' ? claims : claims.filter((cl) => cl.status === filter)),
    [claims, filter],
  );

  /** Money still moving: everything that is neither paid out nor turned down. */
  const activeValue = useMemo(
    () => claims
      .filter((cl) => cl.status !== 'settled' && cl.status !== 'rejected')
      .reduce((s, cl) => s + cl.amount, 0),
    [claims],
  );

  // The one count-up on this screen. It moves when the register itself changes, which is
  // the information: a refresh that brings a newly filed claim should be felt, not hunted.
  const registerTotal = sum ? sum.total_claims : claims.length;
  const shownTotal = useCountUp(registerTotal);

  const kpis: KpiItem[] = sum
    ? [
      { label: 'In the register', value: String(shownTotal), icon: 'shield-checkmark-outline', tone: 'primary' },
      { label: 'Paid out', value: inrShort(sum.paid_amount), icon: 'checkmark-circle', tone: 'success' },
      { label: 'Pending', value: inrShort(sum.pending_amount), icon: 'hourglass-outline', tone: 'warning' },
    ]
    : claims.length > 0
      ? [
        { label: 'Your claims', value: String(shownTotal), icon: 'shield-checkmark-outline', tone: 'primary' },
        { label: 'Still in progress', value: inrShort(activeValue), icon: 'hourglass-outline', tone: 'warning' },
        { label: 'Settled', value: String(counts.settled ?? 0), icon: 'checkmark-circle', tone: 'success' },
      ]
      : [];

  const options = useMemo(() => {
    const list: { key: Filter; label: string; count?: number }[] = [
      { key: 'all', label: t('common.all'), count: counts.all },
      { key: 'intake', label: 'Intake', count: counts.intake },
      { key: 'docs_pending', label: 'Docs pending', count: counts.docs_pending },
      { key: 'under_review', label: 'Review', count: counts.under_review },
      { key: 'submitted', label: 'Submitted', count: counts.submitted },
      { key: 'settled', label: 'Settled', count: counts.settled },
    ];
    // Rejected only earns a chip when there is one, but it must stay while it is selected,
    // otherwise a refresh that clears the last rejection strands the user in a dead filter.
    if ((counts.rejected ?? 0) > 0 || filter === 'rejected') {
      list.push({ key: 'rejected', label: 'Rejected', count: counts.rejected });
    }
    return list;
  }, [counts, filter, t]);

  const pickFilter = (next: Filter) => {
    if (next === filter) return;
    haptics.select();
    setFilter(next);
  };

  /** Pull-to-refresh: the list stays on screen and the control carries the spinner. */
  const reload = useCallback(() => { setRefreshing(true); setNonce((k) => k + 1); }, []);
  /** Retry from an empty state: there is nothing on screen to keep, so show the skeleton. */
  const retry = useCallback(() => { setLoading(true); setNonce((k) => k + 1); }, []);

  const n = filtered.length;
  const readout = filter === 'all'
    ? `${n} claim${n === 1 ? '' : 's'} · ${inrShort(activeValue)} still in progress`
    : `${n} of ${claims.length} claim${claims.length === 1 ? '' : 's'} match this status`;

  const empty = EMPTY_COPY[filter];
  // An empty register under an outage means "could not load", not "nothing to work on".
  // Those demand opposite reactions, so they must never look alike.
  const outage = health.degraded && claims.length === 0;

  const subtitle = loading
    ? 'Loading the register'
    : sum
      ? `${sum.total_claims} in the register · ${inrShort(sum.pending_amount)} pending`
      : `${claims.length} on your rows · ${inrShort(activeValue)} in progress`;

  const listHeader = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <KpiStrip items={kpis} contentStyle={{ paddingHorizontal: spacing.lg }} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      >
        <Chips options={options} value={filter} onChange={pickFilter} />
      </ScrollView>

      <Txt
        size={font.cap}
        color={c.faint}
        numeric
        numberOfLines={1}
        style={{ paddingHorizontal: spacing.lg }}
      >
        {readout}
      </Txt>

      {n > 0 ? (
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginTop: spacing.xs }} />
      ) : null}
    </View>
  );

  return (
    <Screen>
      <Header title="Claims" subtitle={subtitle} />

      {loading ? (
        <ClaimsSkeleton />
      ) : (
        <FlatList<Claim>
          data={filtered}
          keyExtractor={(cl, i) => `${cl.id}_${i}`}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}
          removeClippedSubviews={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={reload}
              tintColor={c.primary}
              colors={[c.primary]}
              progressBackgroundColor={c.card}
            />
          }
          ListHeaderComponent={listHeader}
          ItemSeparatorComponent={RowSeparator}
          ListFooterComponent={n > 0 ? <Hairline /> : null}
          ListEmptyComponent={
            <Card style={{ marginHorizontal: spacing.lg }}>
              {outage ? (
                <EmptyState
                  icon="cloud-offline-outline"
                  title="The register did not load"
                  subtitle="The server could not be reached, so this is not a confirmed empty register. Pull down to try again."
                  action={{ label: t('common.tryAgain'), onPress: retry }}
                />
              ) : (
                <EmptyState
                  icon={empty.icon}
                  title={empty.title}
                  subtitle={empty.subtitle}
                  action={empty.add && canCreateClaim
                    ? { label: 'New claim', onPress: () => router.push('/claim-new') }
                    : { label: 'Show all claims', onPress: () => pickFilter('all') }}
                />
              )}
            </Card>
          }
          renderItem={({ item, index }) => (
            <ClaimRow
              claim={item}
              index={index}
              onOpen={() => router.push(`/claim/${item.id}`)}
            />
          )}
        />
      )}

      {canCreateClaim ? (
        <Fab
          icon="add"
          label="New claim"
          onPress={() => router.push('/claim-new')}
          style={{ bottom: insets.bottom + 76 }}
        />
      ) : null}
    </Screen>
  );
}

/* ================================================================== *
 * Row
 * ================================================================== */

function ClaimRow({ claim, index, onOpen }: { claim: Claim; index: number; onOpen: () => void }) {
  const c = useTheme();
  const { spacing, font } = c;
  const st = CLAIM_STATUS[claim.status] ?? CLAIM_STATUS.intake;
  const t = useT();
  const hasAmount = claim.amount > 0;

  // The paperwork counter is the register's real triage signal: a claim sits still because
  // a document is missing, not because of its amount. Settled and rejected claims drop it —
  // chasing paperwork on a closed claim is noise.
  const total = claim.docs.length;
  const received = claim.docs.filter((d) => d.received).length;
  const closed = claim.status === 'settled' || claim.status === 'rejected';
  const showDocs = total > 0 && !closed;
  const complete = received === total;
  const docTone = complete ? c.success : c.warning;

  return (
    <Appear index={index}>
      {/* The surface lives on the wrapper, not on DataRow: DataRow's pressed tint is
          transparent at rest and has to reveal a card ground, not the screen background. */}
      <View style={{ backgroundColor: c.card }}>
        <DataRow
          icon={TYPE_ICON[claim.type]}
          label={claim.clientName}
          value={hasAmount ? inrShort(claim.amount) : 'No amount'}
          numeric={hasAmount}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {showDocs ? (
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                  accessibilityLabel={`${received} of ${total} documents received`}
                >
                  <Ionicons name="document-attach-outline" size={12} color={docTone} />
                  <Txt size={font.tiny} weight="700" color={docTone} numeric>{received}/{total}</Txt>
                </View>
              ) : null}
              <Pill label={t(st.labelKey)} tone={st.tone} small />
            </View>
          }
          onPress={onOpen}
        />
      </View>
    </Appear>
  );
}

/* ---------- list furniture ---------- */

function Hairline() {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

function RowSeparator() {
  const c = useTheme();
  const { spacing } = c;
  return (
    <View style={{ backgroundColor: c.card }}>
      {/* Inset to the icon column, so the rule reads as a list rather than as a table. */}
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: spacing.lg }} />
    </View>
  );
}
