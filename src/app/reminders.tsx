import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme, spacing } from '@/theme/theme';
import { Card, EmptyState, Header, Loader, SectionHeader } from '@/ui/kit';
import * as api from '@/data/api';
import type { Reminder } from '@/data/types';
import { REMINDER_ICON } from '@/data/labels';
import { fmtDay, daysUntil } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';

export default function Reminders() {
  const c = useTheme();
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setItems(await api.getReminders()); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (id: string) => {
    try { Haptics.selectionAsync(); } catch {}
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, done: !r.done } : r)));
    await api.toggleReminder(id);
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Reminders" back /><Loader /></View>;

  const pending = items.filter((r) => !r.done);
  const today = pending.filter((r) => daysUntil(r.date) <= 0);
  const upcoming = pending.filter((r) => daysUntil(r.date) > 0);
  const done = items.filter((r) => r.done);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Reminders" subtitle={`${pending.length} pending follow-ups`} back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        {pending.length === 0 && done.length === 0 && <Card><EmptyState icon="notifications-off-outline" title="No reminders" /></Card>}

        {today.length > 0 && <Group title="Today" items={today} onToggle={toggle} />}
        {upcoming.length > 0 && <Group title="Upcoming" items={upcoming} onToggle={toggle} />}
        {done.length > 0 && <Group title="Completed" items={done} onToggle={toggle} />}
      </ScrollView>
    </View>
  );
}

function Group({ title, items, onToggle }: { title: string; items: Reminder[]; onToggle: (id: string) => void }) {
  const c = useTheme();
  return (
    <View>
      <SectionHeader title={`${title} (${items.length})`} />
      <View style={{ gap: 10 }}>
        {items.map((r) => (
          <Card key={r.id} padded={false} style={{ padding: 12, opacity: r.done ? 0.6 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={() => onToggle(r.id)} hitSlop={6}>
                <Ionicons name={r.done ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={r.done ? c.success : c.faint} />
              </Pressable>
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center', marginLeft: 10 }}>
                <Ionicons name={REMINDER_ICON[r.type] ?? 'notifications'} size={18} color={c.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 14, textDecorationLine: r.done ? 'line-through' : 'none' }} numberOfLines={1}>{r.title}</Text>
                <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{r.subtitle}</Text>
              </View>
              {r.phone && !r.done && (
                <Pressable onPress={() => whatsapp(r.phone!, `Namaste ${r.clientName || ''}`)} hitSlop={6} style={{ padding: 6 }}>
                  <Ionicons name="logo-whatsapp" size={22} color={c.whatsapp} />
                </Pressable>
              )}
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}
