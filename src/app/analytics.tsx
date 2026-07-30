import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radius, shadow } from '@/theme/theme';
import { Card, EmptyState, Grad, Header, Loader, SectionHeader } from '@/ui/kit';
import { useData } from '@/hooks/useData';
import * as api from '@/data/api';
import { inr, inrShort } from '@/lib/format';

export default function Analytics() {
  const c = useTheme();
  const { data: stats, loading } = useData(api.getClientStats);
  const { data: camp } = useData(api.getCampaignSummary);

  if (loading) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Analytics" back /><Loader /></View>;
  if (!stats) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Analytics" back /><EmptyState icon="stats-chart" title="No analytics yet" subtitle="Sign in with your CGPE account to load live portfolio data." /></View>;

  const mix: { label: string; value: number }[] = (stats as any).product_mix || [];
  const max = Math.max(1, ...mix.map((m) => m.value));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Portfolio analytics" subtitle="Organisation-wide · live" back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }} showsVerticalScrollIndicator={false}>

        <View style={{ borderRadius: radius.xl, overflow: 'hidden', ...shadow(c, 2) }}>
          <Grad colors={c.gradientHero} style={{ padding: spacing.xl }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Total annual premium</Text>
            <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 6 }}>{inr(stats.total_premium)}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, marginTop: 4 }}>
              {stats.total_clients.toLocaleString('en-IN')} clients · {inrShort((stats as any).total_sum_assured)} sum assured
            </Text>
          </Grad>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {[
            { label: 'Clients', value: stats.total_clients.toLocaleString('en-IN'), icon: 'people', tint: c.primary },
            { label: 'Renewals due', value: String(camp?.renewal_due ?? 0), icon: 'refresh-circle', tint: c.warning },
            { label: 'Reachable', value: (camp?.opted_in ?? 0).toLocaleString('en-IN'), icon: 'logo-whatsapp', tint: c.whatsapp },
            { label: 'Birthdays (mo)', value: String(stats.birthdays_this_month ?? 0), icon: 'gift', tint: c.accent },
            { label: 'Maturity soon', value: String(camp?.maturity_soon ?? 0), icon: 'cash', tint: c.info },
            { label: 'Anniversaries', value: String(camp?.anniversary_month ?? 0), icon: 'heart', tint: c.danger },
          ].map((k) => (
            <Card key={k.label} style={{ flexGrow: 1, minWidth: '30%', padding: spacing.md }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: k.tint + '1f', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={k.icon as any} size={16} color={k.tint} />
              </View>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '900', marginTop: 9 }} numberOfLines={1}>{k.value}</Text>
              <Text style={{ color: c.muted, fontSize: 11, marginTop: 2 }}>{k.label}</Text>
            </Card>
          ))}
        </View>

        {mix.length > 0 && (
          <View>
            <SectionHeader title="Premium band distribution" />
            <Card>
              <View style={{ gap: 12 }}>
                {mix.map((m) => (
                  <View key={m.label}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>{m.label}</Text>
                      <Text style={{ color: c.muted, fontSize: 12.5, fontWeight: '700' }}>{m.value.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={{ height: 9, borderRadius: 5, backgroundColor: c.cardAlt, overflow: 'hidden' }}>
                      <View style={{ height: '100%', width: `${(m.value / max) * 100}%`, borderRadius: 5, overflow: 'hidden' }}>
                        <Grad colors={c.gradientBrand} angle="horiz" style={{ flex: 1 }} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
