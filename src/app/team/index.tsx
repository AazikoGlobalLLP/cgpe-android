import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Avatar, Card, Header, Loader, Pill, SectionHeader, StatCard } from '@/ui/kit';
import { useData } from '@/hooks/useData';
import * as api from '@/data/api';
import type { TeamMember } from '@/data/team';
import { inrShort, timeAgo } from '@/lib/format';

export default function Team() {
  const c = useTheme();
  const router = useRouter();
  const { data, loading } = useData(api.getTeam);
  const { data: activity } = useData(api.getTeamActivity);
  const team = data ?? [];

  if (loading) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Team" back /><Loader /></View>;

  const online = team.filter((m) => m.online).length;
  const clockedIn = team.filter((m) => m.clockedIn).length;
  const premiumMtd = team.reduce((s, m) => s + m.stats.premiumMtd, 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Team" subtitle={`${team.length} members · ${online} online`} back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <StatCard label="Team premium (MTD)" value={inrShort(premiumMtd)} icon="cash" tone="success" />
          <StatCard label="Clocked in" value={`${clockedIn}/${team.length}`} icon="location" tone="primary" />
          <StatCard label="Online now" value={String(online)} icon="pulse" tone="info" />
        </View>

        {/* Live activity feed */}
        {activity && activity.length > 0 && (
          <View>
            <SectionHeader title="Team activity" />
            <Card padded={false} style={{ padding: 4 }}>
              {activity.slice(0, 6).map((a, i) => (
                <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 11, borderBottomWidth: i === 5 ? 0 : 1, borderBottomColor: c.hairline }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={a.icon as any} size={16} color={c.primary} />
                  </View>
                  <Text style={{ color: c.text, fontSize: 13, flex: 1, marginLeft: 11 }} numberOfLines={1}>{a.text}</Text>
                  <Text style={{ color: c.faint, fontSize: 11 }}>{timeAgo(a.at)}</Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Members */}
        <View>
          <SectionHeader title={`Members (${team.length})`} />
          <View style={{ gap: 10 }}>
            {team.map((m) => <MemberRow key={m.id} m={m} onPress={() => router.push(`/team/${m.id}`)} />)}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function MemberRow({ m, onPress }: { m: TeamMember; onPress: () => void }) {
  const c = useTheme();
  return (
    <Card onPress={onPress} padded={false} style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
      <View>
        <Avatar name={m.name} size={46} />
        <View style={{ position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, backgroundColor: m.online ? c.success : c.faint, borderWidth: 2, borderColor: c.card }} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 14.5 }}>{m.name}</Text>
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }}>{m.role.replace('_', ' ')} · {m.branch}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          <Pill label={`${m.tier}`} tone="accent" small icon="star" />
          {m.clockedIn && <Pill label="Clocked in" tone="success" small />}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: c.success, fontWeight: '800', fontSize: 14 }}>{inrShort(m.stats.premiumMtd)}</Text>
        <Text style={{ color: c.faint, fontSize: 10.5, marginTop: 2 }}>MTD</Text>
        <Ionicons name="chevron-forward" size={16} color={c.faint} style={{ marginTop: 4 }} />
      </View>
    </Card>
  );
}
