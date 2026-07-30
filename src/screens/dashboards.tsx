import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius, shadow } from '@/theme/theme';
import { Card, Grad, Pill, SectionHeader, Avatar } from '@/ui/kit';
import { TIER_THEME, Tier } from '@/store/roles';
import { inrShort, timeAgo } from '@/lib/format';
import type { TeamMember } from '@/data/team';
import type { Task } from '@/data/tasks';
import type { OrgSnapshot } from '@/data/api';

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
              <View style={{ backgroundColor: th.accent + '26', borderWidth: 1, borderColor: th.accent + '55', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 }}>
                <Text style={{ color: th.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{th.badge}</Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12.5 }}>{title}</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 8 }}>{big}</Text>
            {sub ? <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, marginTop: 3 }}>{sub}</Text> : null}
          </View>
          {right}
        </View>
        {children}
      </Grad>
    </View>
  );
}

export function KpiGrid({ items }: { items: { label: string; value: string; icon: any; tint: string; onPress?: () => void }[] }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map((k) => (
        <Card key={k.label} onPress={k.onPress} style={{ flexGrow: 1, minWidth: '30%', padding: spacing.md }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: k.tint + '1f', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={k.icon} size={16} color={k.tint} />
          </View>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '900', marginTop: 9, letterSpacing: -0.4 }} numberOfLines={1}>{k.value}</Text>
          <Text style={{ color: c.muted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{k.label}</Text>
        </Card>
      ))}
    </View>
  );
}

function QuickRow({ actions }: { actions: { icon: any; label: string; tint: string; onPress: () => void }[] }) {
  const c = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
      {actions.map((a) => (
        <Pressable key={a.label} onPress={a.onPress} style={({ pressed }) => [{ alignItems: 'center', width: 74, opacity: pressed ? 0.7 : 1 }]}>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: a.tint + '1f', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: a.tint + '33' }}>
            <Ionicons name={a.icon} size={23} color={a.tint} />
          </View>
          <Text style={{ color: c.muted, fontSize: 11, fontWeight: '600', marginTop: 7, textAlign: 'center' }} numberOfLines={2}>{a.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
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
        right={<Pressable onPress={() => router.push('/team')} style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="people" size={20} color="#fff" />
        </Pressable>}>
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
        { label: 'Open tickets', value: String(snapshot?.tickets ?? 0), icon: 'chatbox-ellipses', tint: c.info, onPress: () => router.push('/(tabs)/claims') },
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
          {team.slice(0, 4).map((m) => (
            <Card key={m.id} onPress={() => router.push(`/team/${m.id}`)} padded={false} style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
              <View>
                <Avatar name={m.name} size={42} />
                <View style={{ position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: m.clockedIn ? c.success : c.faint, borderWidth: 2, borderColor: c.card }} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{m.name}</Text>
                <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }}>{m.role.replace('_', ' ')}{m.branch ? ` · ${m.branch}` : ''}</Text>
              </View>
              {m.clockedIn ? <Pill label="On duty" tone="success" small /> : <Pill label="Off" tone="neutral" small />}
            </Card>
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
        big={snapshot ? snapshot.total_clients.toLocaleString('en-IN') : '—'}
        sub={snapshot ? `clients · ${snapshot.leads.toLocaleString('en-IN')} active leads · ${team.length} team` : 'loading…'}
        right={<Pressable onPress={() => router.push('/analytics')} style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="stats-chart" size={20} color="#fff" />
        </Pressable>}>
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
          { icon: 'navigate', label: 'Movement', tint: '#6b62f5', onPress: () => router.push('/agent-track') },
          { icon: 'stats-chart', label: 'Analytics', tint: c.primary, onPress: () => router.push('/analytics') },
          { icon: 'paper-plane', label: 'Campaigns', tint: c.warning, onPress: () => router.push('/premium') },
          { icon: 'person-add', label: 'Assign task', tint: c.success, onPress: () => router.push('/task-new') },
        ]} />
      </View>

      <View>
        <SectionHeader title={`Admins (${admins.length})`} action="All teams" onAction={() => router.push('/team')} />
        <View style={{ gap: 10 }}>
          {(admins.length ? admins : team).slice(0, 4).map((m) => (
            <Card key={m.id} onPress={() => router.push(`/team/${m.id}`)} padded={false} style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={m.name} size={42} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{m.name}</Text>
                <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }}>{m.role.replace('_', ' ')} · {m.stats.clients} clients</Text>
              </View>
              <Text style={{ color: th.accent, fontWeight: '800', fontSize: 13 }}>{inrShort(m.stats.premiumMtd)}</Text>
            </Card>
          ))}
        </View>
      </View>

      {notifications.length > 0 && (
        <View>
          <SectionHeader title="Live activity" action="All" onAction={() => router.push('/notifications')} />
          <Card padded={false} style={{ padding: 4 }}>
            {notifications.slice(0, 5).map((n, i) => (
              <View key={n.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderBottomWidth: i === Math.min(4, notifications.length - 1) ? 0 : 1, borderBottomColor: c.hairline }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="pulse" size={15} color={th.accent} />
                </View>
                <Text style={{ color: c.text, fontSize: 13, flex: 1 }} numberOfLines={1}>{n.title || n.body}</Text>
                <Text style={{ color: c.faint, fontSize: 11 }}>{n.at ? timeAgo(n.at) : ''}</Text>
              </View>
            ))}
          </Card>
        </View>
      )}
    </View>
  );
}

function Mini({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <View>
      <Text style={{ color: tint, fontSize: 19, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1 }}>{label}</Text>
    </View>
  );
}
