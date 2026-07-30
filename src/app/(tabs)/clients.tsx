import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Avatar, Card, EmptyState, Header, Loader, SearchBar } from '@/ui/kit';
import * as api from '@/data/api';
import type { Client } from '@/data/types';
import { inr } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';

export default function Clients() {
  const c = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<Client[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const reqId = useRef(0);

  // Portfolio total (un-scoped aggregate on the backend)
  useEffect(() => { api.getClientStats().then((s) => s && setTotal(s.total_clients)); }, []);

  const fetchPage = useCallback(async (p: number, search: string, replace: boolean) => {
    const my = ++reqId.current;
    if (replace) setLoading(true); else setLoadingMore(true);
    const res = await api.getClientsPage(p, search);
    if (my !== reqId.current) return; // a newer search superseded this
    setItems((prev) => (replace ? res.items : [...prev, ...res.items]));
    setHasMore(res.hasMore);
    setPage(p);
    setLoading(false); setLoadingMore(false);
  }, []);

  useEffect(() => { fetchPage(1, '', true); }, [fetchPage]);

  // debounced server-side search
  useEffect(() => {
    const t = setTimeout(() => { fetchPage(1, q.trim(), true); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const loadMore = () => { if (!loadingMore && !loading && hasMore) fetchPage(page + 1, q.trim(), false); };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header
        title="Clients"
        subtitle={total != null ? `${total.toLocaleString('en-IN')} clients · showing ${items.length}` : `${items.length} loaded`}
      />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 4 }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search all clients by name or number" />
      </View>

      {loading ? <Loader /> : (
        <FlatList
          data={items}
          keyExtractor={(cl, i) => cl.id + '_' + i}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: 10, paddingBottom: 40 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<EmptyState icon="people-outline" title="No clients found" subtitle={q ? `Nothing matches “${q}”.` : 'Pull to refresh or check your connection.'} />}
          ListFooterComponent={
            loadingMore ? <View style={{ paddingVertical: 18 }}><ActivityIndicator color={c.primary} /></View>
              : hasMore && items.length > 0 ? (
                <Pressable onPress={loadMore} style={{ paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: c.primary, fontWeight: '700', fontSize: 13.5 }}>Load more</Text>
                </Pressable>
              ) : items.length > 0 ? (
                <Text style={{ color: c.faint, fontSize: 12, textAlign: 'center', paddingVertical: 16 }}>All {items.length} loaded</Text>
              ) : null
          }
          renderItem={({ item }) => <ClientCard client={item} onPress={() => router.push(`/client/${item.id}`)} />}
        />
      )}
    </View>
  );
}

function ClientCard({ client, onPress }: { client: Client; onPress: () => void }) {
  const c = useTheme();
  const p = client.policies[0];
  return (
    <Card onPress={onPress} padded={false} style={{ padding: 13 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar name={client.name} size={46} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 14.5 }} numberOfLines={1}>{client.name}</Text>
          <Text style={{ color: c.muted, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
            {p?.number && p.number !== '—' ? `Policy ${p.number}` : 'No policy no.'}{client.totalPremium ? ` · ${inr(client.totalPremium)}` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {!!client.phone && <Pressable onPress={() => call(client.phone)} hitSlop={6} style={{ padding: 5 }}><Ionicons name="call" size={19} color={c.primary} /></Pressable>}
          {!!client.phone && <Pressable onPress={() => whatsapp(client.phone)} hitSlop={6} style={{ padding: 5 }}><Ionicons name="logo-whatsapp" size={19} color={c.whatsapp} /></Pressable>}
        </View>
      </View>
    </Card>
  );
}
