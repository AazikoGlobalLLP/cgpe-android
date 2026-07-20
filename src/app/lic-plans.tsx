import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Card, EmptyState, Field, Header, Loader, Pill, SearchBar, SectionHeader } from '@/ui/kit';
import { useData } from '@/hooks/useData';
import * as api from '@/data/api';
import type { LicPlan } from '@/data/types';
import { inr, inrShort } from '@/lib/format';

export default function LicPlans() {
  const c = useTheme();
  const { data, loading } = useData(api.getLicPlans);
  const [q, setQ] = useState('');

  // simple demo estimator
  const [age, setAge] = useState('35');
  const [sa, setSa] = useState('1000000');
  const [term, setTerm] = useState('20');
  const sumA = Number(sa) || 0;
  const t = Number(term) || 20;
  const a = Number(age) || 35;
  const yearly = Math.round((sumA / t) * (1 + a / 100) * 0.9);
  const maturity = Math.round(sumA + sumA * 0.045 * t); // rough bonus accrual

  const plans = (data ?? []).filter((p) => !q.trim() || p.name.toLowerCase().includes(q.toLowerCase()) || p.type.toLowerCase().includes(q.toLowerCase()));

  if (loading) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="LIC Plans" back /><Loader /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="LIC Plans" subtitle="Product library & estimator" back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        {/* Estimator */}
        <View>
          <SectionHeader title="Benefit estimator" />
          <Card>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label="Age" value={age} onChange={setAge} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Field label="Term (yrs)" value={term} onChange={setTerm} keyboardType="numeric" /></View>
            </View>
            <View style={{ marginTop: 12 }}><Field label="Sum assured (₹)" value={sa} onChange={setSa} keyboardType="numeric" /></View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <View style={{ flex: 1, backgroundColor: c.primarySoft, borderRadius: 12, padding: 14 }}>
                <Text style={{ color: c.primary, fontSize: 11.5, fontWeight: '700' }}>Est. yearly premium</Text>
                <Text style={{ color: c.text, fontSize: 20, fontWeight: '900', marginTop: 4 }}>{inrShort(yearly)}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: c.successSoft, borderRadius: 12, padding: 14 }}>
                <Text style={{ color: c.success, fontSize: 11.5, fontWeight: '700' }}>Est. maturity value</Text>
                <Text style={{ color: c.text, fontSize: 20, fontWeight: '900', marginTop: 4 }}>{inrShort(maturity)}</Text>
              </View>
            </View>
            <Text style={{ color: c.faint, fontSize: 10.5, marginTop: 10 }}>Indicative demo estimate only — not an official LIC illustration.</Text>
          </Card>
        </View>

        {/* Plan library */}
        <View>
          <SectionHeader title="Plan library" />
          <View style={{ marginBottom: 10 }}><SearchBar value={q} onChange={setQ} placeholder="Search plans" /></View>
          {plans.length === 0 ? <EmptyState icon="search" title="No plans found" /> : (
            <View style={{ gap: 10 }}>
              {plans.map((p) => <PlanCard key={p.id} p={p} />)}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function PlanCard({ p }: { p: LicPlan }) {
  const c = useTheme();
  return (
    <Card padded={false} style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="ribbon" size={22} color={c.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{p.name}</Text>
          <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>Plan {p.code} · {p.type}</Text>
        </View>
      </View>
      <Text style={{ color: c.text, fontSize: 13, marginTop: 10, lineHeight: 18 }}>{p.highlight}</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <Pill label={`Age ${p.minAge}-${p.maxAge}`} tone="neutral" small />
        <Pill label={p.term} tone="neutral" small />
        {p.tags.map((tg) => <Pill key={tg} label={tg} tone="primary" small />)}
      </View>
    </Card>
  );
}
