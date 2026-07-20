import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Avatar, Button, Card, EmptyState, IconBtn, Loader, Pill, SectionHeader } from '@/ui/kit';
import * as api from '@/data/api';
import type { TeamMember } from '@/data/team';
import { inr, inrShort, fmtTime, fmtDate, timeAgo } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';

export default function TeamMemberDetail() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [m, setM] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await api.getTeamMember(String(id));
    setM(r ?? null); setLoading(false);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={{ flex: 1, backgroundColor: c.bg }}><Loader /></View>;
  if (!m) return <View style={{ flex: 1, backgroundColor: c.bg }}><EmptyState icon="person-outline" title="Member not found" /></View>;

  const stats = [
    { label: 'Clients', value: String(m.stats.clients), icon: 'people', tint: c.primary },
    { label: 'Premium (MTD)', value: inrShort(m.stats.premiumMtd), icon: 'cash', tint: c.success },
    { label: 'Policies (MTD)', value: String(m.stats.policiesMtd), icon: 'documents', tint: c.accent },
    { label: 'Renewal %', value: `${m.stats.renewalPct}%`, icon: 'refresh-circle', tint: c.info },
    { label: 'Open claims', value: String(m.stats.openClaims), icon: 'shield-half', tint: c.warning },
    { label: 'Active leads', value: String(m.stats.leads), icon: 'flame', tint: c.danger },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={{ paddingTop: insets.top + 8, paddingBottom: 22, paddingHorizontal: spacing.lg, backgroundColor: c.primary, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, alignItems: 'center' }}>
          <View style={{ alignSelf: 'stretch' }}><IconBtn icon="chevron-back" onPress={() => router.back()} bg="rgba(255,255,255,0.18)" color="#fff" size={38} /></View>
          <View>
            <Avatar name={m.name} size={82} color="rgba(255,255,255,0.22)" />
            <View style={{ position: 'absolute', right: 2, bottom: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: m.online ? '#34d399' : '#94a3b8', borderWidth: 3, borderColor: c.primary }} />
          </View>
          <Text style={{ color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 12 }}>{m.name}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 3 }}>{m.role.replace('_', ' ')} · {m.branch}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="star" size={13} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700', fontSize: 12.5 }}>{m.tier} Club</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12.5 }}>{m.agentCode}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' }}>
            <Button label="Call" icon="call" variant="secondary" onPress={() => call(m.phone)} style={{ flex: 1 }} />
            <Button label="WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={() => whatsapp(m.phone)} style={{ flex: 1 }} />
          </View>
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <View>
            <SectionHeader title="Performance" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {stats.map((s) => (
                <Card key={s.label} style={{ flexGrow: 1, minWidth: '30%', padding: spacing.md, alignItems: 'flex-start' }}>
                  <Ionicons name={s.icon as any} size={18} color={s.tint} />
                  <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', marginTop: 8 }}>{s.value}</Text>
                  <Text style={{ color: c.muted, fontSize: 11, marginTop: 2 }}>{s.label}</Text>
                </Card>
              ))}
            </View>
          </View>

          <View>
            <SectionHeader title="Recent activity" />
            <Card>
              {m.activity.length === 0 ? <Text style={{ color: c.muted, fontSize: 13, textAlign: 'center' }}>No recent activity.</Text> : m.activity.map((a, i) => (
                <View key={a.id} style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={a.icon as any} size={15} color={c.primary} /></View>
                    {i < m.activity.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: c.border, marginVertical: 2 }} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: i < m.activity.length - 1 ? 14 : 0 }}>
                    <Text style={{ color: c.text, fontSize: 13.5, fontWeight: '600' }}>{a.text}</Text>
                    <Text style={{ color: c.faint, fontSize: 11.5, marginTop: 2 }}>{timeAgo(a.at)}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>

          <Text style={{ color: c.faint, fontSize: 11.5, textAlign: 'center' }}>Last active {timeAgo(m.lastActive)} · {m.email || m.phone}</Text>
        </View>
      </ScrollView>
    </View>
  );
}
