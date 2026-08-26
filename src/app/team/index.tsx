import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Header, Row, Screen, SectionHeader, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { SearchBar } from '@/ui/controls';
import { EmptyState, Skeleton } from '@/ui/feedback';
import { KpiStrip, ListSection, Pill } from '@/ui/data';
import type { KpiItem } from '@/ui/data';
import { AvatarStack, PersonRow } from '@/ui/identity';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import * as api from '@/data/api';
import type { TeamActivity, TeamMember } from '@/data/team';
import { inrShort, timeAgo } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { capabilitiesOf } from '@/store/roles';
import { RestrictedNotice } from '@/ui/RestrictedNotice';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * The roster.
 *
 * Ranked by who is ON DUTY, not alphabetically. The question this screen answers at 10am
 * is "who is out there right now", and a name-sorted list buries that under the letter A.
 * Premium (MTD) rides the trailing slot because it is the one figure that separates two
 * otherwise identical rows.
 *
 * `clockedIn` is cross-referenced from the live attendance pins inside api.getTeam(), so
 * the duty state here is real rather than a roster flag.
 * ------------------------------------------------------------------ */

export default function Team() {
  const router = useRouter();
  const c = useTheme();
  const t = useT();
  const health = useDataHealth();
  const { user, viewAs, ready } = useAuth();

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [activity, setActivity] = useState<TeamActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      // The activity feed is not wired to any endpoint yet, so it resolves `[]` and reports
      // nothing. The `.catch()` that used to sit on it was dead code twice over: the old
      // implementation could not reject (it resolved through `unavailable()`), and it never
      // made a request in the first place — it just raised a false outage banner on every
      // mount of this screen. See `getTeamActivity` in `src/data/api.ts`.
      const [roster, feed] = await Promise.all([
        api.getTeam(),
        api.getTeamActivity(),
      ]);
      if (!alive) return;
      setTeam(roster);
      setActivity(feed);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [attempt]);

  // Raised here, not inside the effect: a synchronous setState in an effect body costs an
  // extra render pass on every run.
  const retry = useCallback(() => { setLoading(true); setAttempt((n) => n + 1); }, []);

  const onDuty = useMemo(() => team.filter((m) => m.clockedIn), [team]);
  const online = useMemo(() => team.filter((m) => m.online).length, [team]);
  const premiumMtd = useMemo(() => team.reduce((s, m) => s + (m.stats.premiumMtd || 0), 0), [team]);

  const kpis: KpiItem[] = useMemo(() => {
    const out: KpiItem[] = [
      { label: 'On duty now', value: `${onDuty.length}/${team.length}`, icon: 'location-outline', tone: 'primary' },
      { label: 'Signed in', value: String(online), icon: 'pulse-outline', tone: 'info' },
    ];
    // Premium only appears when the roster actually carries it. A confident "₹0" against a
    // team that sold all month is a lie the aggregation cannot back up.
    if (premiumMtd > 0) {
      out.unshift({ label: 'Team premium (MTD)', value: inrShort(premiumMtd), icon: 'cash-outline', tone: 'success' });
    }
    return out;
  }, [onDuty.length, team.length, online, premiumMtd]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const matched = s
      ? team.filter((m) => m.name.toLowerCase().includes(s)
        || m.role.toLowerCase().includes(s)
        || (m.branch || '').toLowerCase().includes(s))
      : team;
    // On duty first, then the higher earner, then by name so the order is stable.
    return matched.slice().sort((a, b) => {
      if (a.clockedIn !== b.clockedIn) return a.clockedIn ? -1 : 1;
      if (b.stats.premiumMtd !== a.stats.premiumMtd) return b.stats.premiumMtd - a.stats.premiumMtd;
      return a.name.localeCompare(b.name);
    });
  }, [team, q]);

  const searching = q.trim().length > 0;

  // Round-4 loophole hunt (2026-08-25): the roster carries every colleague's premium (MTD) figure and
  // links to /team/[id], so it is a team-management surface — gate it IN-SCREEN, not only behind the
  // Home affordance (which this same audit hardened). Wait for `ready` so a real manager is not
  // flashed the refusal during session restore (the monitor/performance pattern). View-as-aware, so a
  // master previewing "view as team" sees the team's own (blocked) experience.
  if (ready && !capabilitiesOf(user, viewAs).manageTeam) {
    return (
      <RestrictedNotice
        title="Team"
        heading="Team view is for managers"
        subtitle="The team roster and each member's figures are visible to team leads and admins. You can see your own work from the Home and Tasks tabs."
      />
    );
  }

  return (
    <Screen>
      <Header
        title="Team"
        subtitle={loading ? 'Loading the roster' : `${team.length} member${team.length === 1 ? '' : 's'}, ${onDuty.length} on duty`}
        back
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xxxl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? <TeamSkeleton /> : team.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <EmptyState
              icon={health.degraded ? 'cloud-offline-outline' : 'people-outline'}
              title={health.degraded ? 'The roster could not load' : 'No team members yet'}
              subtitle={health.degraded
                ? 'The server did not answer, so this is unconfirmed rather than empty. Check your connection and try again.'
                : 'People appear here once they are added to your branch in the admin panel.'}
              action={{ label: t('common.tryAgain'), onPress: retry }}
            />
          </View>
        ) : (
          <>
            {/* Bleeds to both edges so the strip reads as scrollable. */}
            <Appear index={0}>
              <KpiStrip items={kpis} contentStyle={{ paddingHorizontal: spacing.lg }} />
            </Appear>

            {onDuty.length > 0 ? (
              <Appear index={1} style={{ paddingHorizontal: spacing.lg }}>
                <Card>
                  <Row>
                    <AvatarStack names={onDuty.map((m) => m.name)} size={34} max={5} />
                    <View style={{ flex: 1 }}>
                      <Txt size={font.sub} weight="700" numberOfLines={1}>
                        {onDuty.length === 1 ? '1 agent in the field' : `${onDuty.length} agents in the field`}
                      </Txt>
                      <Txt size={font.cap} color={c.muted} numberOfLines={1}>Clocked in today</Txt>
                    </View>
                  </Row>
                </Card>
              </Appear>
            ) : null}

            {activity.length > 0 ? (
              <Appear index={2} style={{ paddingHorizontal: spacing.lg }}>
                <ListSection title="Team activity">
                  {activity.slice(0, 6).map((a) => (
                    <ActivityRow key={a.id} icon={(a.icon as IconName) || 'ellipse-outline'} text={a.text} at={a.at} />
                  ))}
                </ListSection>
              </Appear>
            ) : null}

            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              <SectionHeader title={`Members (${team.length})`} />
              <SearchBar
                value={q}
                onChange={setQ}
                placeholder="Name, role or branch"
              />

              {shown.length === 0 ? (
                <Card>
                  <EmptyState
                    icon="search-outline"
                    title={`No member matches "${q.trim()}"`}
                    subtitle="Search runs over the names, roles and branches on the roster loaded here."
                    action={{ label: t('common.clearSearch'), onPress: () => { haptics.select(); setQ(''); } }}
                  />
                </Card>
              ) : (
                <ListSection footer={searching ? `${shown.length} of ${team.length} shown` : undefined}>
                  {shown.map((m, i) => (
                    <Appear key={m.id} index={i}>
                      <MemberRow m={m} onPress={() => router.push(`/team/${m.id}`)} />
                    </Appear>
                  ))}
                </ListSection>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/* ================================================================== *
 * Rows
 * ================================================================== */

function MemberRow({ m, onPress }: { m: TeamMember; onPress: () => void }) {
  const c = useTheme();
  const t = useT();
  const role = m.role.replace(/_/g, ' ');
  const subtitle = [role, m.branch].filter(Boolean).join(' · ');

  return (
    <PersonRow
      name={m.name}
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
  );
}

/** ListSection accepts any child, so the activity feed keeps the grouped-card treatment
 *  without forcing a DataRow's label/value shape onto a sentence. */
function ActivityRow({ icon, text, at }: { icon: IconName; text: string; at: string }) {
  const c = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    }}>
      <View style={{
        width: 30, height: 30, borderRadius: 10, backgroundColor: c.cardAlt,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={15} color={c.primary} />
      </View>
      <Txt size={font.sub} numberOfLines={2} style={{ flex: 1 }}>{text}</Txt>
      <Txt size={font.tiny} color={c.faint} numeric numberOfLines={1}>{timeAgo(at)}</Txt>
    </View>
  );
}

/* ================================================================== *
 * Loading — KPI chips, then roster rows
 * ================================================================== */

function TeamSkeleton() {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.lg }}>
      <Row style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        {[0, 1, 2].map((i) => <Skeleton key={i} width={118} height={58} radius={radius.md} />)}
      </Row>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <Skeleton width={140} height={16} />
        <Skeleton width="100%" height={48} radius={radius.md} />
        <Card padded={false}>
          <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i}>
                {i > 0 ? (
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: spacing.lg }} />
                ) : null}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, minHeight: 64,
                }}>
                  <Skeleton width={44} height={44} radius={44 / 2.6} />
                  <View style={{ flex: 1, gap: spacing.sm }}>
                    <Skeleton width="56%" height={13} />
                    <Skeleton width="38%" height={11} />
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Skeleton width={52} height={13} />
                    <Skeleton width={62} height={18} radius={radius.pill} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </Card>
      </View>
    </View>
  );
}
