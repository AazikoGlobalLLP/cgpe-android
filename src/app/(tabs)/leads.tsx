import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Avatar, Button, Card, Chips, EmptyState, Fab, Field, Header, Loader, Pill } from '@/ui/kit';
import { useData } from '@/hooks/useData';
import * as api from '@/data/api';
import type { Lead, LeadStage } from '@/data/types';
import { inrShort, timeAgo } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';
import { STAGE_META, PRIORITY_TONE } from '@/data/labels';

export default function Leads() {
  const c = useTheme();
  const router = useRouter();
  const { data, loading, refresh } = useData(api.getLeads);
  const [filter, setFilter] = useState<'all' | LeadStage>('all');
  const [addOpen, setAddOpen] = useState(false);

  const leads = data ?? [];
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: leads.length };
    leads.forEach((l) => (m[l.stage] = (m[l.stage] ?? 0) + 1));
    return m;
  }, [leads]);

  const filtered = filter === 'all' ? leads : leads.filter((l) => l.stage === filter);
  const activePotential = leads.filter((l) => !l.stage.startsWith('closed')).reduce((s, l) => s + l.potential, 0);

  const options = [
    { key: 'all' as const, label: 'All', count: counts.all },
    { key: 'new' as const, label: 'New', count: counts.new },
    { key: 'contacted' as const, label: 'Contacted', count: counts.contacted },
    { key: 'meeting' as const, label: 'Meeting', count: counts.meeting },
    { key: 'proposal' as const, label: 'Proposal', count: counts.proposal },
    { key: 'closed_won' as const, label: 'Won', count: counts.closed_won },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Leads" subtitle={`${leads.length} leads · ${inrShort(activePotential)} in pipeline`} />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 6 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chips options={options} value={filter} onChange={setFilter} />
        </ScrollView>
      </View>

      {loading ? <Loader /> : (
        <FlatList
          data={filtered}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 6, gap: 10, paddingBottom: 120 }}
          onRefresh={refresh}
          refreshing={false}
          ListEmptyComponent={<EmptyState icon="funnel-outline" title="No leads here" subtitle="Add a lead or switch filter." />}
          renderItem={({ item }) => <LeadCard lead={item} onPress={() => router.push(`/lead/${item.id}`)} />}
        />
      )}

      <Fab icon="add" label="Add lead" onPress={() => setAddOpen(true)} />
      <AddLeadModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={refresh} />
    </View>
  );
}

function LeadCard({ lead, onPress }: { lead: Lead; onPress: () => void }) {
  const c = useTheme();
  const st = STAGE_META[lead.stage];
  return (
    <Card onPress={onPress} padded={false} style={{ padding: 13 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar name={lead.name} size={46} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{lead.name}</Text>
          </View>
          <Text style={{ color: c.muted, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>{lead.interest || 'No interest set'}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 7 }}>
            <Pill label={st.label} tone={st.tone} small />
            <Pill label={lead.priority} tone={PRIORITY_TONE[lead.priority]} small />
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <Text style={{ color: c.success, fontWeight: '800', fontSize: 14 }}>{inrShort(lead.potential)}</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Pressable onPress={() => call(lead.phone)} hitSlop={6} style={{ padding: 4 }}><Ionicons name="call" size={19} color={c.primary} /></Pressable>
            <Pressable onPress={() => whatsapp(lead.phone)} hitSlop={6} style={{ padding: 4 }}><Ionicons name="logo-whatsapp" size={19} color={c.whatsapp} /></Pressable>
          </View>
        </View>
      </View>
    </Card>
  );
}

function AddLeadModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [interest, setInterest] = useState('');
  const [potential, setPotential] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(''); setPhone(''); setInterest(''); setPotential(''); setCity(''); };
  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await api.addLead({ name, phone, interest, city, potential: Number(potential) || 0, priority: 'warm' });
    setSaving(false); reset(); onClose(); onAdded();
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: insets.bottom + 16, maxHeight: '88%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Text style={{ flex: 1, color: c.text, fontSize: 18, fontWeight: '800' }}>New lead</Text>
              <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={24} color={c.muted} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
              <Field label="Name *" value={name} onChange={setName} placeholder="Client name" />
              <Field label="Mobile number" value={phone} onChange={setPhone} placeholder="+91 …" keyboardType="phone-pad" />
              <Field label="Interested in" value={interest} onChange={setInterest} placeholder="e.g. Jeevan Anand" />
              <Field label="Premium potential (₹)" value={potential} onChange={setPotential} placeholder="e.g. 120000" keyboardType="numeric" />
              <Field label="City" value={city} onChange={setCity} placeholder="e.g. Anand" />
              <Button label="Add lead" icon="checkmark" onPress={save} loading={saving} size="lg" full style={{ marginTop: 4 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
