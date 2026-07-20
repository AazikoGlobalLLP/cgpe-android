import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTheme, spacing } from '@/theme/theme';
import { Card, EmptyState, Header, Loader } from '@/ui/kit';
import * as api from '@/data/api';
import type { AppNotification } from '@/data/types';
import { timeAgo } from '@/lib/format';

const KIND_TINT: Record<string, string> = { claim: '#0284c7', lead: '#dc2626', renewal: '#e8890c', system: '#5a6a86', contest: '#16a34a' };

export default function Notifications() {
  const c = useTheme();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setItems(await api.getNotifications()); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await api.markAllNotificationsRead();
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Notifications" back /><Loader /></View>;
  const unread = items.filter((n) => !n.read).length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Notifications" subtitle={unread ? `${unread} unread` : 'All caught up'} back
        right={unread ? <Pressable onPress={markAll} hitSlop={8}><Text style={{ color: c.primary, fontWeight: '700', fontSize: 13 }}>Mark all</Text></Pressable> : undefined} />
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: spacing.lg, gap: 10, paddingBottom: 40 }}
        ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="No notifications" />}
        renderItem={({ item }) => {
          const tint = KIND_TINT[item.kind] ?? c.primary;
          return (
            <Card padded={false} style={{ padding: 13, backgroundColor: item.read ? c.card : c.primarySoft }}>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tint + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={item.icon as any} size={19} color={tint} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{item.title}</Text>
                  <Text style={{ color: c.muted, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{item.body}</Text>
                  <Text style={{ color: c.faint, fontSize: 11, marginTop: 5 }}>{timeAgo(item.at)}</Text>
                </View>
                {!item.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary, marginTop: 4 }} />}
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}
