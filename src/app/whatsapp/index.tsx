import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing } from '@/theme/theme';
import { Avatar, Card, EmptyState, Header, Loader, Pill } from '@/ui/kit';
import { useData } from '@/hooks/useData';
import * as api from '@/data/api';
import type { WaThread } from '@/data/types';
import { timeAgo } from '@/lib/format';

export default function WhatsAppHub() {
  const c = useTheme();
  const router = useRouter();
  const { data, loading, refresh } = useData(api.getWaThreads);
  const threads = data ?? [];
  const unread = threads.reduce((s, t) => s + t.unread, 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="WhatsApp Hub" subtitle={`${threads.length} chats · ${unread} unread`} back />
      {loading ? <Loader /> : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
          onRefresh={refresh}
          refreshing={false}
          contentContainerStyle={{ padding: spacing.lg, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title="No conversations" />}
          renderItem={({ item }) => <ThreadRow t={item} onPress={() => router.push(`/whatsapp/${item.id}`)} />}
        />
      )}
    </View>
  );
}

function ThreadRow({ t, onPress }: { t: WaThread; onPress: () => void }) {
  const c = useTheme();
  return (
    <Card onPress={onPress} padded={false} style={{ padding: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar name={t.name} size={48} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 15, flex: 1 }} numberOfLines={1}>{t.name}</Text>
            <Text style={{ color: c.faint, fontSize: 11 }}>{timeAgo(t.lastAt)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <Text style={{ color: t.unread ? c.text : c.muted, fontSize: 13, flex: 1, fontWeight: t.unread ? '600' : '400' }} numberOfLines={1}>{t.lastMessage}</Text>
            {t.unread > 0 && (
              <View style={{ backgroundColor: c.whatsapp, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginLeft: 8 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{t.unread}</Text>
              </View>
            )}
          </View>
          {t.tag ? <View style={{ marginTop: 6 }}><Pill label={t.tag} tone="success" small /></View> : null}
        </View>
      </View>
    </Card>
  );
}
