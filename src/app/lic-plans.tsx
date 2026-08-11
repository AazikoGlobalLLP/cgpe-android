import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Header, Row, Screen, Txt } from '@/ui/base';
import { Chips } from '@/ui/controls';
import { EmptyState, Skeleton } from '@/ui/feedback';
import { DataRow, ListSection, Pill } from '@/ui/data';
import { Sheet } from '@/ui/sheet';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';

import * as api from '@/data/api';
import type { LicPlan } from '@/data/types';

/* ------------------------------------------------------------------ *
 * LIC Plans — the product library.
 *
 * THE ENDPOINT IS LIVE. `GET /api/lic-plans` is mounted in production (app.js:461) and returns
 * `{ meta, plans }`; `getLicPlans` unwraps `data.plans` and maps the legacy LIC shape through
 * `adaptLicPlan` (Phase 6). An earlier version of this screen assumed the route 404'd in
 * production and framed its empty state as "not published to this build" — that is now wrong,
 * so the empty state branches on `useDataHealth().degraded` like every other list screen:
 * "couldn't load, retry" for an outage, a calm "no plans on file yet" for a genuinely empty
 * library. It is calm on purpose — a red alarm on an empty-but-healthy library trains people
 * to ignore the alarms that matter.
 *
 *   · NOTHING IS SYNTHESISED TO FILL IT. The previous version of this screen carried a
 *     "benefit estimator" that multiplied the sum assured by a made-up factor and printed
 *     an estimated premium and maturity value. Those figures came from nowhere: not from
 *     LIC, not from the backend, not from an actuary. On a phone in front of a customer an
 *     indicative-looking rupee figure IS a quote, which is exactly the class of fabrication
 *     the no-mock-data contract exists to stop. It has been removed, not restyled. In the
 *     same spirit `adaptLicPlan` leaves entry-age and term EMPTY (the wire carries neither as
 *     a plan-level fact) rather than mining one worked example — see its doc comment.
 *
 * FIELDS ARE STILL TREATED AS UNTRUSTED. Even with an adapter, any field can be missing at
 * runtime whatever the type says, so everything is normalised once more in `views` and every
 * optional value is dropped rather than printed as "undefined to undefined years".
 * ------------------------------------------------------------------ */

/** A plan, normalised once so nothing downstream has to defend itself. */
type PlanView = {
  id: string;
  name: string;
  code: string;
  kind: string;
  term: string;
  highlight: string;
  tags: string[];
  /** "18 to 60 years", or null when the record does not carry a usable age band. */
  ages: string | null;
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const posInt = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null);

function ageBand(min: unknown, max: unknown): string | null {
  const lo = posInt(min);
  const hi = posInt(max);
  if (lo != null && hi != null) return `${lo} to ${hi} years`;
  if (lo != null) return `From ${lo} years`;
  if (hi != null) return `Up to ${hi} years`;
  return null;
}

const ALL = 'all';

export default function LicPlans() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();

  const [plans, setPlans] = useState<LicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kind, setKind] = useState<string>(ALL);
  const [open, setOpen] = useState<PlanView | null>(null);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async (mode: 'first' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    const list = await api.getLicPlans();
    // The route can be popped while this is in flight; without the guard this is a setState
    // on an unmounted screen every time someone backs out of a slow fetch.
    if (!alive.current) return;
    setPlans(Array.isArray(list) ? list : []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void load('first'); }, [load]);

  const views = useMemo<PlanView[]>(() => plans.map((p, i) => ({
    id: str(p?.id) || `plan-${i}`,
    name: str(p?.name) || 'Unnamed plan',
    code: str(p?.code),
    kind: str(p?.type) || 'Other',
    term: str(p?.term),
    highlight: str(p?.highlight),
    tags: Array.isArray(p?.tags) ? p.tags.filter((t): t is string => typeof t === 'string' && !!t.trim()) : [],
    ages: ageBand(p?.minAge, p?.maxAge),
  })), [plans]);

  const kinds = useMemo(() => {
    const counts = new Map<string, number>();
    views.forEach((p) => counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1));
    return [
      { key: ALL, label: 'All plans', count: views.length },
      ...Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => ({ key: k, label: k, count: n })),
    ];
  }, [views]);

  const shown = useMemo(
    () => (kind === ALL ? views : views.filter((p) => p.kind === kind)),
    [views, kind],
  );

  /* Grouped by product type when nothing is filtered, so a long library still reads as a
     catalogue rather than one 40-row wall. A filtered view is already one type. */
  const sections = useMemo(() => {
    if (kind !== ALL) return [{ key: kind, title: kind, rows: shown }];
    const map = new Map<string, PlanView[]>();
    shown.forEach((p) => {
      const list = map.get(p.kind);
      if (list) list.push(p);
      else map.set(p.kind, [p]);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([k, rows]) => ({ key: k, title: k, rows }));
  }, [shown, kind]);

  const pickKind = useCallback((next: string) => {
    if (next === kind) return;
    haptics.select();
    setKind(next);
  }, [kind]);

  const retry = useCallback(() => {
    haptics.tap();
    void load('refresh');
  }, [load]);

  const subtitle = loading
    ? 'Loading the product library'
    : views.length === 0
      ? 'Product library'
      : `${views.length} plan${views.length === 1 ? '' : 's'} on file`;

  return (
    <Screen>
      <Header title="LIC Plans" subtitle={subtitle} back />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 48,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load('refresh')}
            tintColor={c.primary}
            colors={[c.primary]}
            progressBackgroundColor={c.card}
          />
        }
      >
        {loading ? (
          <LibrarySkeleton />
        ) : views.length === 0 ? (
          /* EMPTY. Two truthful cases, branched on health like every other list screen: the
             server did not answer (outage), or it answered with an empty library. Never the old
             "not published to this build" claim — the endpoint is live (Phase 6, D-4). */
          <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
            <Card>
              <EmptyState
                icon={health.degraded ? 'cloud-offline-outline' : 'library-outline'}
                title={health.degraded ? 'The plan library could not load' : 'No plans on file yet'}
                subtitle={health.degraded
                  ? 'The server did not answer, so nothing here is confirmed. Pull down to try again.'
                  : 'The product catalogue is empty right now, so there is nothing to list here. Nothing has gone wrong with your account.'}
                action={{ label: 'Check again', onPress: retry }}
              />
            </Card>
            <Txt size={font.tiny} color={c.faint} style={{ textAlign: 'center', lineHeight: 16 }}>
              Plan wordings and benefit tables stay with your branch until the library is populated.
            </Txt>
          </View>
        ) : (
          <>
            {kinds.length > 2 ? (
              <Appear index={0}>
                <Chips options={kinds} value={kind} onChange={pickKind} style={{ paddingTop: spacing.xs }} />
              </Appear>
            ) : null}

            {shown.length === 0 ? (
              /* FILTER MISS. Unframed, inline, and it echoes the filter that produced it. */
              <EmptyState
                icon="funnel-outline"
                title={`No plan is filed under "${kind}"`}
                subtitle={`The library holds ${views.length} plan${views.length === 1 ? '' : 's'}, none of them in this group.`}
                action={{ label: 'Show all plans', onPress: () => pickKind(ALL) }}
              />
            ) : (
              sections.map((s, si) => {
                const offset = sections.slice(0, si).reduce((n, x) => n + x.rows.length, 0);
                return (
                  <ListSection
                    key={s.key}
                    title={`${s.title} (${s.rows.length})`}
                    footer={si === sections.length - 1
                      ? 'Tap a plan for its entry ages, term and what it is usually sold for.'
                      : undefined}
                  >
                    {s.rows.map((p, i) => (
                      <Appear key={p.id} index={offset + i}>
                        <DataRow
                          icon="ribbon-outline"
                          label={p.name}
                          value={p.code ? `Plan ${p.code}` : p.term || p.kind}
                          onPress={() => setOpen(p)}
                        />
                      </Appear>
                    ))}
                  </ListSection>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <PlanSheet plan={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

/* ================================================================== *
 * Plan detail
 *
 * A sheet rather than a route: the user is comparing plans and comes straight back, so
 * keeping the list visible behind it is worth more than a push transition.
 * ================================================================== */

function PlanSheet({ plan, onClose }: { plan: PlanView | null; onClose: () => void }) {
  const c = useTheme();
  return (
    <Sheet
      visible={!!plan}
      onClose={onClose}
      title={plan?.name ?? 'Plan'}
      subtitle={plan?.code ? `Plan number ${plan.code}` : plan?.kind}
    >
      {plan ? (
        <View style={{ gap: spacing.lg, paddingTop: spacing.xs }}>
          {plan.highlight ? (
            <Txt size={font.body} style={{ lineHeight: 21 }}>{plan.highlight}</Txt>
          ) : null}

          <ListSection>
            <DataRow label="Type" value={plan.kind} icon="pricetags-outline" />
            {plan.ages ? <DataRow label="Entry age" value={plan.ages} icon="person-outline" numeric /> : null}
            {plan.term ? <DataRow label="Term" value={plan.term} icon="time-outline" /> : null}
            {plan.code ? <DataRow label="Plan number" value={plan.code} icon="barcode-outline" numeric copyable /> : null}
          </ListSection>

          {plan.tags.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Txt size={font.cap} weight="700" color={c.muted}>Riders</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {plan.tags.map((t) => <Pill key={t} label={t} tone="primary" small />)}
              </View>
            </View>
          ) : null}

          {!plan.highlight && !plan.ages && !plan.term && plan.tags.length === 0 ? (
            <Txt size={font.sub} color={c.muted} style={{ lineHeight: 20 }}>
              This record carries only a name and a type. Ask your branch for the full plan wording.
            </Txt>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

/* ================================================================== *
 * Loading — chips over a grouped list, the shape that is coming
 * ================================================================== */

function LibrarySkeleton() {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.md, paddingTop: spacing.xs }}>
      <Row style={{ gap: spacing.sm }}>
        {[78, 96, 84, 62].map((w, i) => <Skeleton key={i} width={w} height={36} radius={radius.pill} />)}
      </Row>
      <Skeleton width={92} height={10} style={{ marginLeft: spacing.xs, marginTop: spacing.xs }} />
      <View style={{
        backgroundColor: c.card,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.border,
      }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Row key={i} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 48 }}>
            <Skeleton width={16} height={16} radius={4} />
            <Skeleton width="44%" height={12} />
            <View style={{ flex: 1 }} />
            <Skeleton width={62} height={13} />
          </Row>
        ))}
      </View>
    </View>
  );
}
