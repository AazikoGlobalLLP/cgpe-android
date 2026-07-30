import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Card, Chips, EmptyState, Fab, Header, Loader, Pill } from '@/ui/kit';
import { useData } from '@/hooks/useData';
import * as api from '@/data/api';
import type { Claim, ClaimStatus } from '@/data/types';
import { inrShort, timeAgo } from '@/lib/format';
import { CLAIM_STATUS } from '@/data/labels';

export default function Claims() {
  const c = useTheme();
  const router = useRouter();
  const { data, loading, refresh } = useData(api.getClaims);
  const { data: sum } = useData(api.getClaimsSummary);
  const [filter, setFilter] = useState<'all' | ClaimStatus>('all');

  const claims = data ?? [];
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: claims.length };
    claims.forEach((cl) => (m[cl.status] = (m[cl.status] ?? 0) + 1));
    return m;
  }, [claims]);
  const filtered = filter === 'all' ? claims : claims.filter((cl) => cl.status === filter);
  const activeValue = claims.filter((cl) => cl.status !== 'settled' && cl.status !== 'rejected').reduce((s, cl) => s + cl.amount, 0);

  const options = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'intake', label: 'Intake', count: counts.intake },
    { key: 'docs_pending', label: 'Docs pending', count: counts.docs_pending },
    { key: 'under_review', label: 'Review', count: counts.under_review },
    { key: 'submitted', label: 'Submitted', count: counts.submitted },
    { key: 'settled', label: 'Settled', count: counts.settled },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header
        title="Claims"
        subtitle={sum
          ? `${sum.total_claims} claims · ${inrShort(sum.pending_amount)} pending · ${inrShort(sum.paid_amount)} paid`
          : `${claims.length} claims · ${inrShort(activeValue)} in progress`}
      />

      {/* Live claims register (un-scoped org totals) */}
      {sum && (
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          {[
            { label: 'Total', value: String(sum.total_claims), tint: c.primary },
            { label: 'Paid', value: inrShort(sum.paid_amount), tint: c.success },
            { label: 'Pending', value: inrShort(sum.pending_amount), tint: c.warning },
          ].map((k) => (
            <Card key={k.label} style={{ flex: 1, padding: spacing.md }}>
              <Text style={{ color: c.text, fontSize: 17, fontWeight: '900' }} numberOfLines={1}>{k.value}</Text>
              <Text style={{ color: k.tint, fontSize: 11, marginTop: 2, fontWeight: '700' }}>{k.label}</Text>
            </Card>
          ))}
        </View>
      )}

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 6 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chips options={options as any} value={filter} onChange={setFilter as any} />
        </ScrollView>
      </View>

      {loading ? <Loader /> : (
        <FlatList
          data={filtered}
          keyExtractor={(cl) => cl.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 6, gap: 10, paddingBottom: 120 }}
          onRefresh={refresh}
          refreshing={false}
          ListEmptyComponent={<EmptyState icon="shield-outline" title="No claims here" subtitle="Start a new claim from the button below." />}
          renderItem={({ item }) => <ClaimCard claim={item} onPress={() => router.push(`/claim/${item.id}`)} />}
        />
      )}

      <Fab icon="add" label="New claim" onPress={() => router.push('/claim-new')} />
    </View>
  );
}

function ClaimCard({ claim, onPress }: { claim: Claim; onPress: () => void }) {
  const c = useTheme();
  const st = CLAIM_STATUS[claim.status];
  const received = claim.docs.filter((d) => d.received).length;
  const total = claim.docs.length;
  return (
    <Card onPress={onPress} padded={false} style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{claim.clientName}</Text>
          </View>
          <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>{claim.ref} · {claim.insurer}</Text>
        </View>
        <Pill label={st.label} tone={st.tone} small />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}>
        <Pill label={claim.type} tone="neutral" small />
        <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{inrShort(claim.amount)}</Text>
        <View style={{ flex: 1 }} />
        <Ionicons name="time-outline" size={13} color={c.faint} />
        <Text style={{ color: c.faint, fontSize: 12 }}>{claim.ageDays}d old</Text>
      </View>

      {claim.status !== 'settled' && total > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <Ionicons name="document-attach-outline" size={14} color={received === total ? c.success : c.warning} />
          <Text style={{ color: received === total ? c.success : c.warning, fontSize: 12, fontWeight: '700' }}>
            {received}/{total} documents
          </Text>
          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.cardAlt, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${(received / total) * 100}%`, backgroundColor: received === total ? c.success : c.warning }} />
          </View>
        </View>
      )}
    </Card>
  );
}
