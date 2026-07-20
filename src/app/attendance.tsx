import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Card, EmptyState, Header, Loader, Pill } from '@/ui/kit';
import * as api from '@/data/api';
import { fmtDate, fmtTime } from '@/lib/format';

type Row = { date: string; inTime?: string; outTime?: string; location?: string };

export default function Attendance() {
  const c = useTheme();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [today, setToday] = useState<{ in: boolean; time?: string; place?: string } | null>(null);

  const load = useCallback(async () => {
    const saved = await AsyncStorage.getItem('clock.' + new Date().toDateString());
    if (saved) setToday(JSON.parse(saved));
    const hist = await api.getAttendanceHistory();
    if (hist && hist.length) {
      setRows(hist.map((h: any) => ({
        date: h.date || h.day || '',
        inTime: h.clock_in?.time || h.clockIn,
        outTime: h.clock_out?.time || h.clockOut,
        location: h.clock_in?.location || h.location,
      })));
    }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="My attendance" back /><Loader /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="My attendance" subtitle="Your GPS clock-in history" back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }}>
        {/* Today */}
        <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: today?.in ? c.successSoft : c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={today?.in ? 'checkmark-circle' : 'time-outline'} size={24} color={today?.in ? c.success : c.faint} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>Today</Text>
            <Text style={{ color: c.muted, fontSize: 12.5, marginTop: 1 }}>
              {today?.in ? `Clocked in ${fmtTime(today.time!)} · ${today.place}` : 'Not clocked in yet — use the Today tab.'}
            </Text>
          </View>
          {today?.in && <Pill label="Present" tone="success" small />}
        </Card>

        {/* History */}
        {rows.length === 0 ? (
          <Card>
            <EmptyState icon="calendar-outline" title="No history yet" subtitle="Your clock-in records will appear here once you check in against the live backend." />
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {rows.map((r, i) => {
              const worked = r.inTime && r.outTime;
              return (
                <Card key={i} padded={false} style={{ padding: 13, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="calendar" size={18} color={c.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{r.date ? fmtDate(r.date) : '—'}</Text>
                    <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }}>
                      {r.inTime ? `In ${fmtTime(r.inTime)}` : '—'}{r.outTime ? ` · Out ${fmtTime(r.outTime)}` : ''}{r.location ? ` · ${r.location}` : ''}
                    </Text>
                  </View>
                  <Pill label={worked ? 'Full day' : r.inTime ? 'Open' : '—'} tone={worked ? 'success' : 'warning'} small />
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
