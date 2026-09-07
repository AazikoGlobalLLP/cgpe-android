import { resolveCopy } from '@/i18n/copy';
import { roleLabel } from '@/i18n/display';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Row, Screen, SectionHeader, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { EmptyState, Skeleton } from '@/ui/feedback';
import { KpiStrip, Pill } from '@/ui/data';
import type { KpiItem } from '@/ui/data';
import { AvatarStack, PersonRow } from '@/ui/identity';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { inrShort } from '@/lib/format';
import * as api from '@/data/api';
import type { TeamMember } from '@/data/team';
import { useAuth } from '@/store/auth';
import { canMonitorTeam } from '@/store/roles';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * Monitor — the master's dedicated oversight surface ("the main side"). PHASE-39.
 *
 * The owner wanted ONE place to watch the team — performance, LOCATION (most important) and
 * salary — with NO task UI. Every one of those already exists as its own screen; this hub just
 * gathers them so a master isn't hunting the More menu:
 *   • Locations   → /agent-map            (live pins,     master-gated, Phase 40)
 *   • Movement    → /agent-track          (replay,        master-gated, Phase 40)
 *   • Performance → /performance?view=team (scores,        master-gated, Phase 45)
 *   • Payroll     → /payroll              (salary roster, admin endpoint)
 * plus the team roster (tap → /team/[id], which already carries per-member activity).
 *
 * SECURITY. Master-only, gated on the REAL super_admin role via `canMonitorTeam` — NEVER the
 * folded tier (an admin/leader would otherwise reach the oversight surface; the Phase-40 rule).
 * The hub is only a convenience entry — each destination keeps its own gate — but it refuses
 * non-masters itself, waiting for `ready` so a real master isn't flashed the refusal on restore.
 * This screen invents NOTHING: it carries no scores/salary of its own (those are server-owned on
 * the destination screens); it shows only roster identity + live duty (a real cross-reference
 * already inside getTeam()), and is honest about an outage via useDataHealth().
 * ------------------------------------------------------------------ */

type Lens = { icon: IconName; title: string; hint: string; href: Href; tileIndex: number };

const LENSES: Lens[] = [
  // Location first — the owner's "most important".
  { icon: 'map', title: 'monitor.locations', hint: 'monitor.locationsHint', href: '/agent-map' as Href, tileIndex: 0 },
  { icon: 'navigate', title: 'dash.movement', hint: 'monitor.movementHint', href: '/agent-track' as Href, tileIndex: 1 },
  { icon: 'ribbon', title: 'monitor.performance', hint: 'monitor.performanceHint', href: '/performance?view=team' as Href, tileIndex: 2 },
  { icon: 'cash', title: 'payroll.title', hint: 'monitor.payrollHint', href: '/payroll' as Href, tileIndex: 3 },
];

export default function Monitor() {
  const router = useRouter();
  const t = useT();
  const health = useDataHealth();
  const { user, ready } = useAuth();
  const isMaster = canMonitorTeam(user);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // A non-master must never even request the roster.
    if (!isMaster) { setLoading(false); return; }
    let alive = true;
    (async () => {
      const roster = await api.getTeam();
      if (!alive) return;
      setTeam(roster);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [isMaster, attempt]);

  const retry = useCallback(() => { setLoading(true); setAttempt((n) => n + 1); }, []);

  const onDuty = useMemo(() => team.filter((m) => m.clockedIn), [team]);
  const online = useMemo(() => team.filter((m) => m.online).length, [team]);

  const kpis = useMemo<KpiItem[]>(() => [
    { label: t('team.onDutyNow'), value: `${onDuty.length}/${team.length}`, icon: 'location-outline', tone: 'primary' },
    { label: t('team.signedIn'), value: String(online), icon: 'pulse-outline', tone: 'info' },
  ], [onDuty.length, team.length, online, t]);

  // On duty first, then signed-in, then by name — the "who is out there now" order.
  const shown = useMemo(() => team.slice().sort((a, b) => {
    if (a.clockedIn !== b.clockedIn) return a.clockedIn ? -1 : 1;
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.name.localeCompare(b.name);
  }), [team]);

  // Gate before the skeleton, waiting for `ready` so a real master is not flashed the refusal
  // during session restore (the agent-map / performance pattern).
  if (ready && !isMaster) {
    return (
      <Screen>
        <Header title={t('monitor.title')} back />
        <EmptyState
          icon="lock-closed-outline"
          title={t('performance.ownerOnly')}
          subtitle={t('monitor.ownerOnlyBody')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t('monitor.title')} subtitle={t('monitor.subtitle')} back />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* The four lenses. Location first (the owner's "most important"). */}
        <View style={{ gap: spacing.md }}>
          <Eyebrow style={{ marginLeft: spacing.xs }}>{t('monitor.watchTeam')}</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {LENSES.map((l, i) => (
              <Appear key={l.title} index={i} style={{ flexBasis: '47%', flexGrow: 1 }}>
                <LensCard lens={l} onPress={() => router.push(l.href)} />
              </Appear>
            ))}
          </View>
        </View>

        {/* The roster — tap a member for their activity (team/[id]). No task UI. */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title={t('dash.team')} />

          {loading ? (
            <RosterSkeleton />
          ) : team.length === 0 ? (
            <Card>
              <EmptyState
                icon={health.degraded ? 'cloud-offline-outline' : 'people-outline'}
                title={health.degraded ? t('team.rosterFailed') : t('team.noMembersYet')}
                subtitle={health.degraded
                  ? t('team.unconfirmed')
                  : t('team.noMembersBody')}
                action={{ label: t('common.tryAgain'), onPress: retry }}
              />
            </Card>
          ) : (
            <>
              <KpiStrip items={kpis} contentStyle={{ paddingHorizontal: spacing.lg }} style={{ marginHorizontal: -spacing.lg }} />

              {onDuty.length > 0 ? (
                <Card>
                  <Row>
                    <AvatarStack names={onDuty.map((m) => resolveCopy(t, m.name, m.nameCopy))} size={34} max={5} />
                    <View style={{ flex: 1 }}>
                      <MutedTitle
                        title={onDuty.length === 1 ? t('team.oneInField') : t('team.agentsInField', { count: onDuty.length })}
                        sub={t('team.clockedToday')}
                      />
                    </View>
                  </Row>
                </Card>
              ) : null}

              <Card padded={false}>
                <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
                  {shown.map((m, i) => (
                    <Appear key={m.id} index={Math.min(i, 8)}>
                      <MemberRow m={m} first={i === 0} onPress={() => router.push(`/team/${m.id}`)} />
                    </Appear>
                  ))}
                </View>
              </Card>
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

/* ---------------- Lens card ---------------- */
function LensCard({ lens, onPress }: { lens: Lens; onPress: () => void }) {
  const t = useT();
  const c = useTheme();
  const tile = c.tiles[lens.tileIndex % c.tiles.length];
  return (
    <Card onPress={onPress} style={{ gap: spacing.sm }}>
      <View style={{
        width: 42, height: 42, borderRadius: radius.md, backgroundColor: tile.bg,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={lens.icon} size={22} color={tile.fg} />
      </View>
      <Txt size={font.sub} weight="700" numberOfLines={1}>{t(lens.title)}</Txt>
      <Txt size={font.cap} color={c.muted} numberOfLines={1}>{t(lens.hint)}</Txt>
    </Card>
  );
}

/* ---------------- Roster row ---------------- */
function MemberRow({ m, first, onPress }: { m: TeamMember; first: boolean; onPress: () => void }) {
  const c = useTheme();
  const t = useT();
  const role = roleLabel(t, m.role);
  const subtitle = [role, m.branch].filter(Boolean).join(' · ');
  return (
    <View style={first ? undefined : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline, marginLeft: spacing.lg }}>
      <PersonRow
        name={resolveCopy(t, m.name, m.nameCopy)}
        subtitle={subtitle}
        onPress={onPress}
        badge={{ tone: m.clockedIn ? 'success' : m.online ? 'primary' : 'neutral' }}
        style={{ marginHorizontal: 0, paddingHorizontal: spacing.lg, borderRadius: 0 }}
        right={
          <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: 116 }}>
            {m.stats.premiumMtd > 0 ? (
              <Txt size={font.sub} weight="800" color={c.success} numeric>{inrShort(m.stats.premiumMtd)}</Txt>
            ) : null}
            {m.clockedIn ? <Pill label={t('common.onDuty')} tone="success" small dot /> : null}
          </View>
        }
      />
    </View>
  );
}

/** Two-line muted title used in the on-duty summary card. */
function MutedTitle({ title, sub }: { title: string; sub: string }) {
  const c = useTheme();
  return (
    <>
      <Txt size={font.sub} weight="700" numberOfLines={1}>{title}</Txt>
      <Txt size={font.cap} color={c.muted} numberOfLines={1}>{sub}</Txt>
    </>
  );
}

/* ---------------- Loading ---------------- */
function RosterSkeleton() {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Row style={{ gap: spacing.sm }}>
        {[0, 1].map((i) => <Skeleton key={i} width={118} height={58} radius={radius.md} />)}
      </Row>
      <Card padded={false}>
        <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i}>
              {i > 0 ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: spacing.lg }} /> : null}
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, minHeight: 64,
              }}>
                <Skeleton width={44} height={44} radius={44 / 2.6} />
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <Skeleton width="56%" height={13} />
                  <Skeleton width="38%" height={11} />
                </View>
                <Skeleton width={52} height={18} radius={radius.pill} />
              </View>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}
