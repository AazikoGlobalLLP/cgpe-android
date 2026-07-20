import React, { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Header, IconBtn, Loader } from '@/ui/kit';
import * as api from '@/data/api';
import type { WaThread } from '@/data/types';
import { fmtTime } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';

export default function Chat() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [thread, setThread] = useState<WaThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    const t = await api.getWaThread(String(id));
    setThread(t ?? null); setLoading(false);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const send = async () => {
    if (!text.trim() || !thread) return;
    const msg = { id: 'm' + Date.now(), fromMe: true, text: text.trim(), at: new Date().toISOString() };
    setThread({ ...thread, messages: [...thread.messages, msg] });
    setText('');
    await api.sendWaMessage(thread.id, msg.text);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  };

  if (loading || !thread) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Chat" back /><Loader /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={thread.name} subtitle="WhatsApp Hub · demo" back
        right={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <IconBtn icon="call" onPress={() => call(thread.phone)} size={36} />
            <IconBtn icon="open-outline" onPress={() => whatsapp(thread.phone)} size={36} bg={c.whatsappSoft} color={c.whatsapp} />
          </View>
        } />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0} style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={thread.messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <View style={{ alignSelf: item.fromMe ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
              <View style={{
                backgroundColor: item.fromMe ? c.whatsapp : c.card,
                borderRadius: 16, borderBottomRightRadius: item.fromMe ? 4 : 16, borderBottomLeftRadius: item.fromMe ? 16 : 4,
                paddingHorizontal: 13, paddingVertical: 9, borderWidth: item.fromMe ? 0 : 1, borderColor: c.border,
              }}>
                <Text style={{ color: item.fromMe ? '#fff' : c.text, fontSize: 14.5, lineHeight: 20 }}>{item.text}</Text>
                <Text style={{ color: item.fromMe ? 'rgba(255,255,255,0.75)' : c.faint, fontSize: 10, marginTop: 4, alignSelf: 'flex-end' }}>{fmtTime(item.at)}</Text>
              </View>
            </View>
          )}
        />

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: spacing.md, paddingTop: 8, paddingBottom: insets.bottom + 8, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bgElevated }}>
          <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 22, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 4, maxHeight: 120 }}>
            <TextInput value={text} onChangeText={setText} placeholder="Type a message" placeholderTextColor={c.faint} multiline style={{ color: c.text, fontSize: 15 }} />
          </View>
          <Pressable onPress={send} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: c.whatsapp, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
