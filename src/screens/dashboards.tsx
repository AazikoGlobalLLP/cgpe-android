/**
 * Tier dashboards — the admin and master surfaces that render below the hero on Home.
 *
 * PHASE 8 MIGRATION NOTE. This file was the last screen-level module still importing the
 * legacy `@/ui/kit` barrel and still writing raw `fontFamily` / `fontWeight` pairs by hand.
 * Both are now gone. The raw-font issue was not cosmetic: on Android, React Native does not
 * synthesise weights, so `fontFamily: 'Geist_700Bold'` together with `fontWeight: '700'`
 * only works because the family name already carries the weight. Any place that set a
 * `fontWeight` WITHOUT the matching family silently rendered regular. `type(weight, size)`
 * from the theme is the single correct way to express a weight and is used throughout now.
 *
 * The tier gradient here is a deliberate, documented exception to the app's gradient
 * rationing. `TIER_THEME[tier].grad` is an IDENTITY signal, not decoration: it is how a
 * master instantly knows they are looking at the organisation-wide view rather than their
 * own. It appears exactly once per dashboard, on the hero.
 */
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { radius, shadow, spacing, type, useTheme } from '@/theme/theme';
import { Card, Grad, IconName, Metric, SectionHeader, Txt } from '@/ui/base';
import { Pill } from '@/ui/data';
import { Avatar } from '@/ui/identity';
import { Appear } from '@/ui/motion';
import { TIER_THEME, Tier } from '@/store/roles';
import { inrShort, timeAgo } from '@/lib/format';
import type { TeamMember } from '@/data/team';
import type { Task } from '@/data/tasks';
import type { OrgSnapshot } from '@/data/api';

/**
 * Placeholder for a figure the server has not returned yet.
 *
 * Deliberately NOT an em-dash. UI copy in this app contains zero em-dashes, and this string
 * previously carried one. A regular hyphen reads identically at this size.
 */
const NO_VALUE = '-';

/* ------------------------------------------------------------------ pieces */

export function TierHero({ tier, title, big, sub, right, children }: {
  tier: Tier; title: string; big: string; sub?: string; right?: React.ReactNode; children?: React.ReactNode;
}) {
  const c = useTheme();
  const th = TIER_THEME[tier];
  return (
    <View style={{ borderRadius: radius.xl, overflow: 'hidden', ...shadow(c, 2) }}>
      <Grad colors={th.grad} style={{ padding: spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{
                backgroundColor: th.accent + '26', borderWidth: 1, borderColor: th.accent + '55',
                paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill,
              }}>
                <Txt style={{ ...type('900', 10), letterSpacing: 1 }} color={th.accent}>{th.badge}</Txt>
              </View>
              <Txt size={12.5} color="rgba(255,255,255,0.65)">{title}</Txt>
            </View>
            {/* Metric carries tabular numerals so the figure does not jitter as it updates. */}
            <Metric value={big} size={34} color="#ffffff" style={{ marginTop: 8 }} />
            {sub ? <Txt size={12.5} color="rgba(255,255,255,0.6)" style={{ marginTop: 3 }}>{sub}</Txt> : null}
          </View>
          {right}
        </View>
        {children}
      </Grad>
    </View>
  );
}

export function KpiGrid({ items }: {
  items: { label: string; value: string; icon: IconName; tint: string; onPress?: () => void }[];
}) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map((k, i) => (
        <Appear key={k.label} index={i} style={{ flexGrow: 1, minWidth: '30%' }}>
          <Card onPress={k.onPress} style={{ padding: spacing.md }}>
            <View style={{
              width: 32, height: 32, borderRadius: radius.sm, backgroundColor: k.tint + '1f',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name={k.icon} size={16} color={k.tint} />
            </View>
            <Metric value={k.value} size={18} style={{ marginTop: 9 }} />
            <Txt size={11} color={c.muted} numberOfLines={1} style={{ marginTop: 2 }}>{k.label}</Txt>
          </Card>
        </Appear>
      ))}
    </View>
  );
}

function QuickRow({ actions }: { actions: { icon: IconName; label: string; tint: string; onPress: () => void }[] }) {
  const c = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
      {actions.map((a) => (
        <Pressable
          key={a.label}
          onPress={a.onPress}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          style={({ pressed }) => [{ alignItems: 'center', width: 74, opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={{
            width: 56, height: 56, borderRadius: radius.lg, backgroundColor: a.tint + '1f',
            alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: a.tint + '33',
          }}>
            <Ionicons name={a.icon} size={23} color={a.tint} />
          </View>
          <Txt weight="600" size={11} color={c.muted} numberOfLines={2} style={{ marginTop: 7, textAlign: 'center' }}>
            {a.label}
          </Txt>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** One figure inside a tier hero, drawn on the gradient. */
function Mini({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <View>
      <Metric value={value} size={19} color={tint} />
      <Txt size={11} color="rgba(255,255,255,0.6)" style={{ marginTop: 1 }}>{label}</Txt>
    </View>
  );
}

/** A team member row, shared by both dashboards. */
function MemberRow({ member, onPress, showDuty, trailing }: {
  member: TeamMember;
  onPress: () => void;
  showDuty?: boolean;
  trailing?: React.ReactNode;
}) {
  const c = useTheme();
  return (
    <Card onPress={onPress} padded={false} style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
      <View>
        <Avatar name={member.name} size={42} />
        {showDuty ? (
          <View style={{
            position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6,
            backgroundColor: member.clockedIn ? c.success : c.faint, borderWidth: 2, borderColor: c.card,
          }} />
        ) : null}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Txt weight="700" size={14} numberOfLines={1}>{member.name}</Txt>
        <Txt size={12} color={c.muted} numberOfLines={1} style={{ marginTop: 1 }}>
          {member.role.replace('_', ' ')}{member.branch ? ` · ${member.branch}` : ''}
        </Txt>
      </View>
      {trailing}
    </Card>
  );
}

/* --------------------------------------------------------------- ADMIN */

export function AdminDashboard({ team, tasks, snapshot }: {
  team: TeamMember[]; tasks: Task[];
  snapshot: OrgSnapshot | null;
}) {
  const c = useTheme();
  const router = useRouter();
  const th = TIER_THEME.admin;
  const online = team.filter((m) => m.online).length;
  const clockedIn = team.filter((m) => m.clockedIn).length;
  // Prefer the real org-wide task totals; fall back to the loaded list.
  const total = snapshot?.tasks.total ?? tasks.length;
  const open = snapshot ? snapshot.tasks.open : tasks.filter((t) => t.status !== 'done').length;
  const done = snapshot ? snapshot.tasks.done : tasks.length - open;
  const pct = total ? done / total : 0;

  return (
    <View style={{ gap: spacing.lg }}>
      <TierHero
        tier="admin" title="Team performance today"
        big={`${done}/${total}`} sub="tasks completed across your team"
        right={(
          <Pressable
            onPress={() => router.push('/team')}
            accessibilityRole="button"
            accessibilityLabel="Open team"
            style={{
              width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.14)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="people" size={20} color="#fff" />
          </Pressable>
        )}
      >
        <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden', marginTop: 16 }}>
          <View style={{ height: '100%', width: `${pct * 100}%`, backgroundColor: th.accent, borderRadius: 4 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 14 }}>
          <Mini label="Clocked in" value={`${clockedIn}/${team.length}`} tint={th.accent} />
          <Mini label="Online" value={String(online)} tint="#7cc7ff" />
          <Mini label="Open tasks" value={String(open)} tint="#ffd48a" />
        </View>
      </TierHero>

      <KpiGrid items={[
        { label: 'Client book', value: (snapshot?.total_clients ?? 0).toLocaleString('en-IN'), icon: 'people', tint: c.primary, onPress: () => router.push('/(tabs)/clients') },
        { label: 'Claims in process', value: String(snapshot?.claims.under_process ?? 0), icon: 'shield-half', tint: c.danger, onPress: () => router.push('/(tabs)/claims') },
        { label: 'Open tickets', value: String(snapshot?.tickets ?? 0), icon: 'chatbox-ellipses', tint: c.info, onPress: () => router.push('/tickets') },
      ]} />

      <View>
        <SectionHeader title="Admin actions" />
        <QuickRow actions={[
          { icon: 'person-add', label: 'Assign task', tint: c.primary, onPress: () => router.push('/task-new') },
          { icon: 'paper-plane', label: 'Send renewals', tint: c.warning, onPress: () => router.push('/premium') },
          { icon: 'people-circle', label: 'Team', tint: th.accent, onPress: () => router.push('/team') },
          { icon: 'map', label: 'Agent map', tint: c.info, onPress: () => router.push('/agent-map') },
          { icon: 'shield-half', label: 'Claims', tint: c.danger, onPress: () => router.push('/(tabs)/claims') },
        ]} />
      </View>

      <View>
        <SectionHeader title={`Team (${team.length})`} action="View all" onAction={() => router.push('/team')} />
        <View style={{ gap: 10 }}>
          {team.slice(0, 4).map((m, i) => (
            <Appear key={m.id} index={i}>
              <MemberRow
                member={m}
                showDuty
                onPress={() => router.push(`/team/${m.id}`)}
                trailing={m.clockedIn
                  ? <Pill label="On duty" tone="success" small />
                  : <Pill label="Off" tone="neutral" small />}
              />
            </Appear>
          ))}
        </View>
      </View>
    </View>
  );
}

/* --------------------------------------------------------------- MASTER */

export function MasterDashboard({ team, tasks, snapshot, notifications }: {
  team: TeamMember[]; tasks: Task[];
  snapshot: OrgSnapshot | null;
  notifications: any[];
}) {
  const c = useTheme();
  const router = useRouter();
  const th = TIER_THEME.master;
  const admins = team.filter((m) => m.role === 'admin' || m.role === 'leader');
  const agents = team.filter((m) => m.role !== 'admin' && m.role !== 'leader');
  const clockedIn = team.filter((m) => m.clockedIn).length;

  return (
    <View style={{ gap: spacing.lg }}>
      <TierHero
        tier="master" title="Organisation book"
        big={snapshot ? snapshot.total_clients.toLocaleString('en-IN') : NO_VALUE}
        sub={snapshot
          ? `clients · ${snapshot.leads.toLocaleString('en-IN')} active leads · ${team.length} team`
          : 'Loading the organisation book'}
        right={(
          <Pressable
            onPress={() => router.push('/analytics')}
            accessibilityRole="button"
            accessibilityLabel="Open analytics"
            style={{
              width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.14)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="stats-chart" size={20} color="#fff" />
          </Pressable>
        )}
      >
        <View style={{ flexDirection: 'row', gap: 22, marginTop: 16 }}>
          <Mini label="Admins" value={String(admins.length)} tint={th.accent} />
          <Mini label="Agents" value={String(agents.length)} tint="#7cc7ff" />
          <Mini label="On duty" value={String(clockedIn)} tint="#4ee6a6" />
        </View>
      </TierHero>

      <KpiGrid items={[
        { label: 'Total clients', value: (snapshot?.total_clients ?? 0).toLocaleString('en-IN'), icon: 'people', tint: c.primary, onPress: () => router.push('/(tabs)/clients') },
        { label: 'Active leads', value: (snapshot?.leads ?? 0).toLocaleString('en-IN'), icon: 'trending-up', tint: c.accent, onPress: () => router.push('/(tabs)/leads') },
        { label: 'Claims total', value: String(snapshot?.claims.total ?? 0), icon: 'shield-checkmark', tint: c.warning, onPress: () => router.push('/(tabs)/claims') },
        { label: 'In process', value: String(snapshot?.claims.under_process ?? 0), icon: 'shield-half', tint: c.danger, onPress: () => router.push('/(tabs)/claims') },
        { label: 'Claims paid', value: inrShort(snapshot?.claims.paid_amount ?? 0), icon: 'cash', tint: c.success, onPress: () => router.push('/(tabs)/claims') },
        { label: 'Open tasks', value: String(snapshot?.tasks.open ?? tasks.filter((t) => t.status !== 'done').length), icon: 'checkbox', tint: c.info, onPress: () => router.push('/(tabs)/tasks') },
      ]} />

      <View>
        <SectionHeader title="Master controls" />
        <QuickRow actions={[
          { icon: 'people-circle', label: 'All teams', tint: th.accent, onPress: () => router.push('/team') },
          { icon: 'map', label: 'Agent map', tint: c.info, onPress: () => router.push('/agent-map') },
          { icon: 'navigate', label: 'Movement', tint: c.accent, onPress: () => router.push('/agent-track') },
          { icon: 'stats-chart', label: 'Analytics', tint: c.primary, onPress: () => router.push('/analytics') },
          { icon: 'paper-plane', label: 'Campaigns', tint: c.warning, onPress: () => router.push('/campaigns') },
          { icon: 'person-add', label: 'Assign task', tint: c.success, onPress: () => router.push('/task-new') },
        ]} />
      </View>

      <View>
        <SectionHeader title={`Admins (${admins.length})`} action="All teams" onAction={() => router.push('/team')} />
        <View style={{ gap: 10 }}>
          {(admins.length ? admins : team).slice(0, 4).map((m, i) => (
            <Appear key={m.id} index={i}>
              <MemberRow
                member={m}
                onPress={() => router.push(`/team/${m.id}`)}
                trailing={<Txt weight="800" size={13} color={th.accent} numeric>{inrShort(m.stats.premiumMtd)}</Txt>}
              />
            </Appear>
          ))}
        </View>
      </View>

      {notifications.length > 0 && (
        <View>
          <SectionHeader title="Live activity" action="All" onAction={() => router.push('/notifications')} />
          <Card padded={false} style={{ padding: 4 }}>
            {notifications.slice(0, 5).map((n, i) => (
              <View
                key={n.id || i}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11,
                  borderBottomWidth: i === Math.min(4, notifications.length - 1) ? 0 : 1,
                  borderBottomColor: c.hairline,
                }}
              >
                <View style={{
                  width: 32, height: 32, borderRadius: radius.sm, backgroundColor: c.cardAlt,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="pulse" size={15} color={th.accent} />
                </View>
                <Txt size={13} numberOfLines={1} style={{ flex: 1 }}>{n.title || n.body}</Txt>
                <Txt size={11} color={c.faint} numeric>{n.at ? timeAgo(n.at) : ''}</Txt>
              </View>
            ))}
          </Card>
        </View>
      )}
    </View>
  );
}
