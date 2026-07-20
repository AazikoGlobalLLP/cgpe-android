import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, spacing } from '@/theme/theme';
import { Avatar, Card, Chips, EmptyState, Header, Loader, Pill, SearchBar } from '@/ui/kit';
import { useData } from '@/hooks/useData';
import * as api from '@/data/api';
import type { Client } from '@/data/types';
import { inrShort } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';

const SEG_META: Record<string, { label: string; tone: any; icon: any }> = {
  renewal_due: { label: 'Renewal due', tone: 'warning', icon: 'refresh-circle' },
  maturity_soon: { label: 'Maturity soon', tone: 'info', icon: 'cash' },
  birthday: { label: 'Birthday', tone: 'accent', icon: 'gift' },
  cross_sell: { label: 'Cross-sell', tone: 'primary', icon: 'trending-up' },
  hot_lead: { label: 'Hot', tone: 'danger', icon: 'flame' },
};

export default function Clients() {
  const c = useTheme();
  const router = useRouter();
  const { data, loading, refresh } = useData(api.getClients);
  const [q, setQ] = useState('');
  const [seg, setSeg] = useState<'all' | string>('all');

  const clients = data ?? [];
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: clients.length };
    clients.forEach((cl) => cl.segment.forEach((s) => (m[s] = (m[s] ?? 0) + 1)));
    return m;
  }, [clients]);

  const filtered = clients.filter((cl) => {
    const matchSeg = seg === 'all' || cl.segment.includes(seg as any);
    const matchQ = !q.trim() || cl.name.toLowerCase().includes(q.toLowerCase()) || cl.phone.includes(q);
    return matchSeg && matchQ;
  });

  const totalCover = clients.reduce((s, cl) => s + cl.totalCover, 0);
  const options = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'renewal_due', label: 'Renewal due', count: counts.renewal_due },
    { key: 'maturity_soon', label: 'Maturity', count: counts.maturity_soon },
    { key: 'birthday', label: 'Birthday', count: counts.birthday },
    { key: 'cross_sell', label: 'Cross-sell', count: counts.cross_sell },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Clients" subtitle={`${clients.length} clients · ${inrShort(totalCover)} total cover`} />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search clients by name or number" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chips options={options} value={seg} onChange={setSeg} />
        </ScrollView>
      </View>

      {loading ? <Loader /> : (
        <FlatList
          data={filtered}
          keyExtractor={(cl) => cl.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, gap: 10, paddingBottom: 40 }}
          onRefresh={refresh}
          refreshing={false}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No clients found" subtitle="Try a different search or segment." />}
          renderItem={({ item }) => <ClientCard client={item} onPress={() => router.push(`/client/${item.id}`)} />}
        />
      )}
    </View>
  );
}

function ClientCard({ client, onPress }: { client: Client; onPress: () => void }) {
  const c = useTheme();
  return (
    <Card onPress={onPress} padded={false} style={{ padding: 13 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar name={client.name} size={46} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{client.name}</Text>
          <Text style={{ color: c.muted, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
            {client.city} · {client.policies.length} {client.policies.length === 1 ? 'policy' : 'policies'} · {inrShort(client.totalCover)} cover
          </Text>
          {client.segment.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
              {client.segment.slice(0, 2).map((s) => {
                const m = SEG_META[s];
                return m ? <Pill key={s} label={m.label} tone={m.tone} small icon={m.icon} /> : null;
              })}
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable onPress={() => call(client.phone)} hitSlop={6} style={{ padding: 4 }}><Ionicons name="call" size={19} color={c.primary} /></Pressable>
          <Pressable onPress={() => whatsapp(client.phone)} hitSlop={6} style={{ padding: 4 }}><Ionicons name="logo-whatsapp" size={19} color={c.whatsapp} /></Pressable>
        </View>
      </View>
    </Card>
  );
}
