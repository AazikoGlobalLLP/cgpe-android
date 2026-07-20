import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Card, EmptyState, Header, Loader } from '@/ui/kit';
import { useData } from '@/hooks/useData';
import * as api from '@/data/api';
import { REMINDER_ICON } from '@/data/labels';
import { daysUntil } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar() {
  const c = useTheme();
  const { data, loading } = useData(api.getReminders);
  const [sel, setSel] = useState(0);

  if (loading || !data) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Calendar" back /><Loader /></View>;

  const days = Array.from({ length: 14 }, (_, i) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + i);
    const count = data.filter((r) => daysUntil(r.date) === i && !r.done).length;
    return { offset: i, date: dt.getDate(), wd: WD[dt.getDay()], count };
  });

  const events = data.filter((r) => daysUntil(r.date) === sel).sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const selDate = new Date();
  selDate.setDate(selDate.getDate() + sel);
  const label = sel === 0 ? 'Today' : sel === 1 ? 'Tomorrow' : `${WD[selDate.getDay()]}, ${selDate.getDate()}`;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Calendar" back />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 8 }}>
        {days.map((d) => {
          const active = d.offset === sel;
          return (
            <Pressable key={d.offset} onPress={() => setSel(d.offset)}
              style={{ width: 52, height: 68, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.primary : c.card, borderWidth: 1, borderColor: active ? c.primary : c.border }}>
              <Text style={{ color: active ? 'rgba(255,255,255,0.85)' : c.muted, fontSize: 11, fontWeight: '600' }}>{d.wd}</Text>
              <Text style={{ color: active ? '#fff' : c.text, fontSize: 18, fontWeight: '800', marginTop: 2 }}>{d.date}</Text>
              {d.count > 0 && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: active ? '#fff' : c.accent, marginTop: 3 }} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 6, gap: 10, paddingBottom: 40 }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: '800', marginBottom: 2 }}>{label}</Text>
        {events.length === 0 ? (
          <Card><EmptyState icon="calendar-clear-outline" title="Nothing scheduled" subtitle="No events or follow-ups on this day." /></Card>
        ) : events.map((e) => (
          <Card key={e.id} padded={false} style={{ padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={REMINDER_ICON[e.type] ?? 'notifications'} size={19} color={c.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{e.title}</Text>
                <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{e.subtitle}</Text>
              </View>
              {e.phone && (
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <Pressable onPress={() => call(e.phone!)} hitSlop={6} style={{ padding: 5 }}><Ionicons name="call" size={19} color={c.primary} /></Pressable>
                  <Pressable onPress={() => whatsapp(e.phone!)} hitSlop={6} style={{ padding: 5 }}><Ionicons name="logo-whatsapp" size={19} color={c.whatsapp} /></Pressable>
                </View>
              )}
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
