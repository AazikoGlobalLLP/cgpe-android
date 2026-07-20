import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Card, Header, Loader, Pill, ProgressBar } from '@/ui/kit';
import { useData } from '@/hooks/useData';
import * as api from '@/data/api';
import { daysUntil } from '@/lib/format';

export default function Contests() {
  const c = useTheme();
  const { data, loading } = useData(api.getContests);
  if (loading || !data) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Contests" back /><Loader /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Contests" subtitle="Leaderboards & rewards" back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 12, paddingBottom: 40 }}>
        {data.map((ct) => {
          const left = daysUntil(ct.ends);
          const tone = ct.progress >= 0.85 ? c.success : ct.progress >= 0.5 ? c.primary : c.warning;
          return (
            <Card key={ct.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="trophy" size={23} color={c.accent} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>{ct.name}</Text>
                  <Text style={{ color: c.muted, fontSize: 12.5, marginTop: 2 }}>🎁 {ct.reward}</Text>
                </View>
                {ct.rank != null && (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: c.accent, fontWeight: '900', fontSize: 20 }}>#{ct.rank}</Text>
                    <Text style={{ color: c.faint, fontSize: 10 }}>rank</Text>
                  </View>
                )}
              </View>

              <View style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: c.muted, fontSize: 12 }}>{ct.metric}</Text>
                  <Text style={{ color: tone, fontSize: 12, fontWeight: '800' }}>{Math.round(ct.progress * 100)}%</Text>
                </View>
                <ProgressBar value={ct.progress} tone={tone} />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 }}>
                <Ionicons name="time-outline" size={14} color={c.faint} />
                <Text style={{ color: c.faint, fontSize: 12 }}>{left > 0 ? `${left} days left` : 'Ended'}</Text>
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}
