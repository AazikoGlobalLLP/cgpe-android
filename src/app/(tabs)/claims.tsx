import { resolveCopy } from '@/i18n/copy';
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
const EMPTY_COPY: Record<Filter, { icon: IconName; titleKey: string; subtitleKey: string; add?: boolean }> = {
  all: {
    icon: 'shield-outline',
    titleKey: 'claims.emptyRegisterTitle',
    subtitleKey: 'claims.emptyRegisterBody',
    add: true,
  },
  intake: {
    icon: 'download-outline',
    titleKey: 'claims.emptyIntakeTitle',
    subtitleKey: 'claims.emptyIntakeBody',
    add: true,
  },
  docs_pending: {
    icon: 'document-attach-outline',
    titleKey: 'claims.emptyDocsTitle',
    subtitleKey: 'claims.emptyDocsBody',
  },
  under_review: {
    icon: 'search-outline',
    titleKey: 'claims.emptyReviewTitle',
    subtitleKey: 'claims.emptyReviewBody',
  },
  submitted: {
    icon: 'paper-plane-outline',
    titleKey: 'claims.emptySubmittedTitle',
    subtitleKey: 'claims.emptySubmittedBody',
  },
  settled: {
    icon: 'checkmark-done-circle-outline',
    titleKey: 'claims.emptySettledTitle',
    subtitleKey: 'claims.emptySettledBody',
  },
  rejected: {
    icon: 'close-circle-outline',
    titleKey: 'claims.emptyRejectedTitle',
    subtitleKey: 'claims.emptyRejectedBody',
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
      { label: t('claims.inRegister'), value: String(shownTotal), icon: 'shield-checkmark-outline', tone: 'primary' },
      { label: t('claims.paidOut'), value: inrShort(sum.paid_amount), icon: 'checkmark-circle', tone: 'success' },
      { label: t('claims.pending'), value: inrShort(sum.pending_amount), icon: 'hourglass-outline', tone: 'warning' },
    ]
    : claims.length > 0
      ? [
        { label: t('claims.yours'), value: String(shownTotal), icon: 'shield-checkmark-outline', tone: 'primary' },
        { label: t('claims.stillInProgress'), value: inrShort(activeValue), icon: 'hourglass-outline', tone: 'warning' },
        { label: t('claimStatus.settled'), value: String(counts.settled ?? 0), icon: 'checkmark-circle', tone: 'success' },
      ]
      : [];

  const options = useMemo(() => {
    const list: { key: Filter; label: string; count?: number }[] = [
      { key: 'all', label: t('common.all'), count: counts.all },
      { key: 'intake', label: t('claimStatus.intake'), count: counts.intake },
      { key: 'docs_pending', label: t('claimStatus.docsPending'), count: counts.docs_pending },
      { key: 'under_review', label: t('claims.filterReview'), count: counts.under_review },
      { key: 'submitted', label: t('claimStatus.submitted'), count: counts.submitted },
      { key: 'settled', label: t('claimStatus.settled'), count: counts.settled },
    ];
    // Rejected only earns a chip when there is one, but it must stay while it is selected,
    // otherwise a refresh that clears the last rejection strands the user in a dead filter.
    if ((counts.rejected ?? 0) > 0 || filter === 'rejected') {
      list.push({ key: 'rejected', label: t('claimStatus.rejected'), count: counts.rejected });
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
    ? t('claims.activeSummary', { count: n, amount: inrShort(activeValue) })
    : t('claims.statusSummary', { shown: n, count: claims.length });

  const empty = EMPTY_COPY[filter];
  // An empty register under an outage means "could not load", not "nothing to work on".
  // Those demand opposite reactions, so they must never look alike.
  const outage = health.degraded && claims.length === 0;

  const subtitle = loading
    ? t('claims.loadingRegister')
    : sum
      ? t('claims.registerPendingSummary', { count: sum.total_claims, amount: inrShort(sum.pending_amount) })
      : t('claims.loadedProgressSummary', { count: claims.length, amount: inrShort(activeValue) });

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
      <Header title={t('tab.claims')} subtitle={subtitle} />

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
                  title={t('claims.registerFailed')}
                  subtitle={t('claims.unconfirmedRegister')}
                  action={{ label: t('common.tryAgain'), onPress: retry }}
                />
              ) : (
                <EmptyState
                  icon={empty.icon}
                  title={t(empty.titleKey)}
                  subtitle={t(empty.subtitleKey)}
                  action={empty.add && canCreateClaim
                    ? { label: t('act.newClaim'), onPress: () => router.push('/claim-new') }
                    : { label: t('claims.showAll'), onPress: () => pickFilter('all') }}
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
          label={t('act.newClaim')}
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
          label={resolveCopy(t, claim.clientName, claim.clientNameCopy)}
          value={hasAmount ? inrShort(claim.amount) : t('claims.noAmount')}
          numeric={hasAmount}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {showDocs ? (
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                  accessibilityLabel={t('claims.documentsCount', { received: received, total: total })}
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
