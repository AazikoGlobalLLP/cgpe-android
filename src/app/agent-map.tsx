import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, spacing, radius, shadow } from '@/theme/theme';
import { Avatar, Card, EmptyState, Grad, Header, Loader, Pill } from '@/ui/kit';
import * as api from '@/data/api';
import type { AgentPin } from '@/data/api';
import type { TeamMember } from '@/data/team';
import { fmtTime } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';
import { LeafletMap } from '@/ui/LeafletMap';

type Mine = { in: boolean; time?: string; place?: string; lat?: number; lng?: number; outTime?: string; outPlace?: string };

export default function AgentMap() {
  const c = useTheme();
  const router = useRouter();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [pins, setPins] = useState<AgentPin[]>([]);
  const [mine, setMine] = useState<Mine | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [tm, pn, saved] = await Promise.all([
      api.getTeam(),
      api.getAgentLocations(),
      AsyncStorage.getItem('clock.' + new Date().toDateString()),
    ]);
    setTeam(tm); setPins(pn);
    if (saved) setMine(JSON.parse(saved));
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Agent locations" back /><Loader /></View>;

  // Live pins are the source of truth for duty status; fall back to the roster.
  const pinOnDuty = pins.filter((p) => p.onDuty);
  const onDuty = pins.length ? pins.filter((p) => p.onDuty) as any[] : team.filter((m) => m.clockedIn);
  const off = pins.length ? pins.filter((p) => !p.onDuty) as any[] : team.filter((m) => !m.clockedIn);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Agent locations" subtitle={`${pinOnDuty.length} on duty · ${pins.length || team.length} tracked`} back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }} showsVerticalScrollIndicator={false}>

        {/* Live summary */}
        <View style={{ borderRadius: radius.xl, overflow: 'hidden', ...shadow(c, 2) }}>
          <Grad colors={c.gradientHero} style={{ padding: spacing.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ee6a6' }} />
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>Live field status</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 8 }}>{pinOnDuty.length}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, marginTop: 2 }}>agents currently clocked in</Text>
          </Grad>
        </View>

        {/* Live map */}
        <LeafletMap pins={pins} height={330} />
        <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }}>
          <Legend c={c} color="#2ee6a6" label="On duty" />
          <Legend c={c} color="#8b83ff" label="Clock-in point" />
          <Legend c={c} color="#94a3b8" label="Clock-out point" />
        </View>

        {/* Replay a member's full movement path (master only) */}
        <Card onPress={() => router.push('/agent-track')} padded={false} style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#6b62f51f', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="navigate" size={19} color="#6b62f5" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>Movement paths</Text>
            <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }}>Replay where each agent went, by date</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.faint} />
        </Card>

        {/* My own clock record */}
        {mine?.in && (
          <View>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, marginLeft: 4 }}>My check-in</Text>
            <Card>
              <PinRow c={c} icon="log-in" tint={c.success} label="Clocked in" time={mine.time} place={mine.place} />
              {mine.outTime ? <PinRow c={c} icon="log-out" tint={c.danger} label="Clocked out" time={mine.outTime} place={mine.outPlace} last /> : (
                <Text style={{ color: c.faint, fontSize: 12, marginTop: 10 }}>Still on duty — clock out from the Today tab.</Text>
              )}
            </Card>
          </View>
        )}

        {/* On duty */}
        <View>
          <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, marginLeft: 4 }}>On duty ({onDuty.length})</Text>
          {onDuty.length === 0 ? (
            <Card><EmptyState icon="location-outline" title="Nobody on duty" subtitle="Agent pins appear here as soon as someone clocks in." /></Card>
          ) : (
            <View style={{ gap: 10 }}>
              {onDuty.map((m) => (
                <Card key={m.id} onPress={() => router.push(`/team/${m.id}`)} padded={false} style={{ padding: 13 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View>
                      <Avatar name={m.name} size={44} />
                      <View style={{ position: 'absolute', right: -2, bottom: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: c.success, borderWidth: 2, borderColor: c.card }} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: c.text, fontWeight: '700', fontSize: 14.5 }}>{m.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                        <Ionicons name="location" size={13} color={c.success} />
                        <Text style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>{m.city || m.branch || 'On field'}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {!!m.phone && <Pressable onPress={() => call(m.phone)} hitSlop={6} style={{ padding: 5 }}><Ionicons name="call" size={18} color={c.primary} /></Pressable>}
                      {!!m.phone && <Pressable onPress={() => whatsapp(m.phone)} hitSlop={6} style={{ padding: 5 }}><Ionicons name="logo-whatsapp" size={18} color={c.whatsapp} /></Pressable>}
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>

        {/* Off duty */}
        {off.length > 0 && (
          <View>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, marginLeft: 4 }}>Off duty ({off.length})</Text>
            <Card padded={false} style={{ padding: 4 }}>
              {off.slice(0, 12).map((m, i) => (
                <Pressable key={m.id} onPress={() => router.push(`/team/${m.id}`)} style={{ flexDirection: 'row', alignItems: 'center', padding: 11, borderBottomWidth: i === Math.min(11, off.length - 1) ? 0 : 1, borderBottomColor: c.hairline }}>
                  <Avatar name={m.name} size={34} />
                  <Text style={{ color: c.text, fontSize: 13.5, marginLeft: 11, flex: 1 }} numberOfLines={1}>{m.name}</Text>
                  <Pill label="Off" tone="neutral" small />
                </Pressable>
              ))}
            </Card>
          </View>
        )}

        <Text style={{ color: c.faint, fontSize: 11.5, textAlign: 'center', lineHeight: 17 }}>
          Shows clock-in / clock-out points only — no travel history is recorded.
        </Text>
      </ScrollView>
    </View>
  );
}

function PinRow({ c, icon, tint, label, time, place, last }: any) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: last ? 0 : 12 }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: tint + '1f', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{label}</Text>
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }}>{time ? fmtTime(time) : '—'}{place ? ` · ${place}` : ''}</Text>
      </View>
    </View>
  );
}

function Legend({ c, color, label }: any) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: c.muted, fontSize: 11.5 }}>{label}</Text>
    </View>
  );
}
