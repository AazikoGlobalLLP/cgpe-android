import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import { EmptyState, Meter, Skeleton } from '@/ui/feedback';
import type { MeterTone } from '@/ui/feedback';
import { Pill } from '@/ui/data';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import * as api from '@/data/api';
import type { Contest } from '@/data/types';
import { daysUntil } from '@/lib/format';

/* ------------------------------------------------------------------ *
 * Contests — club qualification, read as progress against a deadline.
 *
 * The only two questions an advisor has here are "how far am I" and "how long have I
 * got", so each card is a Meter plus a countdown token and nothing else. The rank, where
 * the backend supplies one, is the one figure that gets the Metric treatment.
 * ------------------------------------------------------------------ */

type Shape = {
  ct: Contest;
  pct: number;
  tone: MeterTone;
  /** Days to the close date. NaN when the record carries no usable end date. */
  left: number;
  hasEnd: boolean;
};

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export default function Contests() {
  const health = useDataHealth();

  const [items, setItems] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const rows = await api.getContests();
      if (!alive) return;
      setItems(rows);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [attempt]);

  // Raised here, not inside the effect: a synchronous setState in an effect body costs an
  // extra render pass on every run.
  const retry = useCallback(() => { setLoading(true); setAttempt((n) => n + 1); }, []);

  const shaped: Shape[] = useMemo(() => items.map((ct) => {
    const pct = clamp01(ct.progress);
    const left = ct.ends ? daysUntil(ct.ends) : NaN;
    return {
      ct,
      pct,
      tone: pct >= 0.85 ? 'success' : pct >= 0.5 ? 'primary' : 'warning',
      left,
      hasEnd: Number.isFinite(left),
    };
  }), [items]);

  const live = shaped.filter((s) => !s.hasEnd || s.left >= 0).length;

  return (
    <Screen>
      <Header
        title="Contests"
        subtitle={loading ? 'Loading your qualifications' : live > 0 ? `${live} running` : 'Leaderboards and rewards'}
        back
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <>
            <ContestSkeleton />
            <ContestSkeleton />
            <ContestSkeleton />
          </>
        ) : shaped.length === 0 ? (
          <EmptyState
            icon={health.degraded ? 'cloud-offline-outline' : 'trophy-outline'}
            title={health.degraded ? 'Contests could not load' : 'No contest running right now'}
            subtitle={health.degraded
              ? 'The server did not answer, so this is unconfirmed rather than empty. Check your connection and try again.'
              : 'Club and campaign contests appear here while they are open, with your live progress against each one.'}
            action={{ label: 'Try again', onPress: retry }}
          />
        ) : (
          shaped.map((s, i) => <ContestCard key={s.ct.id} s={s} index={i} />)
        )}
      </ScrollView>
    </Screen>
  );
}

/* ================================================================== *
 * Card
 * ================================================================== */

function ContestCard({ s, index }: { s: Shape; index: number }) {
  const c = useTheme();
  const { ct, pct, left, hasEnd } = s;
  const ended = hasEnd && left < 0;

  const countdown = !hasEnd ? null
    : left < 0 ? { label: 'Closed', tone: 'neutral' as const }
      : left === 0 ? { label: 'Closes today', tone: 'danger' as const }
        : left <= 7 ? { label: `${left} days left`, tone: 'warning' as const }
          : { label: `${left} days left`, tone: 'neutral' as const };

  return (
    <Appear index={index}>
      <Card>
        <Row>
          <View style={{
            width: 46, height: 46, borderRadius: 14, backgroundColor: c.accentSoft,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="trophy" size={22} color={c.accent} />
          </View>

          <View style={{ flex: 1, gap: 3 }}>
            <Txt size={16} weight="800" numberOfLines={2}>{ct.name}</Txt>
            {ct.reward ? (
              <Row style={{ gap: 5 }}>
                <Ionicons name="gift-outline" size={13} color={c.faint} />
                <Txt size={font.cap} color={c.muted} numberOfLines={1} style={{ flex: 1 }}>{ct.reward}</Txt>
              </Row>
            ) : null}
          </View>

          {ct.rank != null ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Metric value={`#${ct.rank}`} size={20} color={c.accent} />
              <Txt size={font.tiny} color={c.faint}>rank</Txt>
            </View>
          ) : null}
        </Row>

        <View style={{
          marginTop: spacing.lg, paddingTop: spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline,
        }}>
          <Meter
            value={pct}
            label={ct.metric}
            tone={ended ? 'neutral' : s.tone}
            valueLabel={`${Math.round(pct * 100)}%`}
          />
        </View>

        {countdown ? (
          <Row style={{ marginTop: spacing.md }}>
            <Pill label={countdown.label} tone={countdown.tone} icon="time-outline" small numeric />
          </Row>
        ) : null}
      </Card>
    </Appear>
  );
}

/* ================================================================== *
 * Loading — the card that is coming, not a spinner
 * ================================================================== */

function ContestSkeleton() {
  const c = useTheme();
  return (
    <Card>
      <Row>
        <Skeleton width={46} height={46} radius={14} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Skeleton width="64%" height={15} />
          <Skeleton width="40%" height={11} />
        </View>
        <Skeleton width={38} height={22} />
      </Row>
      <View style={{
        marginTop: spacing.lg, paddingTop: spacing.md, gap: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline,
      }}>
        <Skeleton width="48%" height={11} />
        <Skeleton width="100%" height={10} radius={radius.pill} />
      </View>
      <Skeleton width={92} height={20} radius={radius.pill} style={{ marginTop: spacing.md }} />
    </Card>
  );
}
