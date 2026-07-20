import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Card, Header, Loader, ProgressBar, SectionHeader, StatCard } from '@/ui/kit';
import { useData } from '@/hooks/useData';
import * as api from '@/data/api';
import { inr, inrShort, fmtDate } from '@/lib/format';

export default function Commissions() {
  const c = useTheme();
  const { data, loading } = useData(api.getCommission);

  if (loading || !data) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Commissions" back /><Loader /></View>;

  const pct = Math.min(1, data.thisMonth / data.target);
  const max = Math.max(...data.history.map((h) => h.amount));
  const growth = data.lastMonth ? ((data.thisMonth - data.lastMonth) / data.lastMonth) * 100 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Commissions" subtitle="Earnings & payouts" back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }} showsVerticalScrollIndicator={false}>

        {/* Hero this month */}
        <Card style={{ backgroundColor: c.primary }}>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>This month's commission</Text>
          <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 4 }}>{inr(data.thisMonth)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <Ionicons name={growth >= 0 ? 'trending-up' : 'trending-down'} size={15} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '700' }}>{growth >= 0 ? '+' : ''}{growth.toFixed(0)}% vs last month</Text>
          </View>
          <View style={{ marginTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11.5 }}>Monthly target</Text>
              <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '700' }}>{inrShort(data.thisMonth)} / {inrShort(data.target)}</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${pct * 100}%`, backgroundColor: '#fff', borderRadius: 4 }} />
            </View>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <StatCard label="Last month" value={inrShort(data.lastMonth)} icon="calendar" tone="neutral" />
          <StatCard label="Pending" value={inrShort(data.pending)} icon="hourglass" tone="warning" />
          <StatCard label="Year to date" value={inrShort(data.ytd)} icon="cash" tone="success" />
        </View>

        {/* Bar chart */}
        <View>
          <SectionHeader title="Last 6 months" />
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 140, gap: 8 }}>
              {data.history.map((h, i) => {
                const isLast = i === data.history.length - 1;
                return (
                  <View key={h.month} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <Text style={{ color: c.muted, fontSize: 9.5, fontWeight: '700', marginBottom: 4 }}>{inrShort(h.amount)}</Text>
                    <View style={{ width: '70%', height: `${(h.amount / max) * 78}%`, backgroundColor: isLast ? c.primary : c.primary + '40', borderRadius: 6 }} />
                    <Text style={{ color: isLast ? c.text : c.faint, fontSize: 11, fontWeight: isLast ? '800' : '500', marginTop: 6 }}>{h.month}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        </View>

        {/* Recent payouts */}
        <View>
          <SectionHeader title="Recent commissions" />
          <Card padded={false} style={{ padding: 4 }}>
            {data.recent.map((r, i) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: i === data.recent.length - 1 ? 0 : 1, borderBottomColor: c.hairline }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.successSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-down" size={16} color={c.success} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>{r.client}</Text>
                  <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }}>{r.plan} · {fmtDate(r.date)}</Text>
                </View>
                <Text style={{ color: c.success, fontSize: 14.5, fontWeight: '800' }}>+{inrShort(r.amount)}</Text>
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
