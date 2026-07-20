import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Avatar, Button, Card, EmptyState, Header, Loader, Pill, SectionHeader } from '@/ui/kit';
import * as api from '@/data/api';
import type { Lead, LeadStage } from '@/data/types';
import { inr, inrShort, fmtDate, timeAgo } from '@/lib/format';
import { call, whatsapp, sms } from '@/lib/actions';
import { STAGE_META } from '@/data/labels';

const FLOW: LeadStage[] = ['new', 'contacted', 'meeting', 'proposal', 'closed_won'];

export default function LeadDetail() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const l = await api.getLead(String(id));
    setLead(l ?? null); setLoading(false);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeStage = async (stage: LeadStage) => {
    if (!lead) return;
    try { Haptics.selectionAsync(); } catch {}
    setLead({ ...lead, stage });
    await api.setLeadStage(lead.id, stage);
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Lead" back /><Loader /></View>;
  if (!lead) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Lead" back /><EmptyState icon="alert-circle-outline" title="Lead not found" /></View>;

  const st = STAGE_META[lead.stage];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Lead" back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }} showsVerticalScrollIndicator={false}>

        <Card style={{ alignItems: 'center' }}>
          <Avatar name={lead.name} size={72} />
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '800', marginTop: 12 }}>{lead.name}</Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>{lead.city || '—'} · {lead.source}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Pill label={st.label} tone={st.tone} />
            <Pill label={`${lead.priority} lead`} tone={lead.priority === 'hot' ? 'danger' : lead.priority === 'warm' ? 'warning' : 'neutral'} icon={lead.priority === 'hot' ? 'flame' : undefined} />
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' }}>
            <Button label="Call" icon="call" variant="secondary" onPress={() => call(lead.phone)} style={{ flex: 1 }} />
            <Button label="WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={() => whatsapp(lead.phone, `Namaste ${lead.name}`)} style={{ flex: 1 }} />
            <Button label="SMS" icon="chatbubble" variant="outline" onPress={() => sms(lead.phone)} style={{ flex: 1 }} />
          </View>
        </Card>

        {/* Pipeline stepper */}
        <View>
          <SectionHeader title="Pipeline stage" />
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {FLOW.map((stg, i) => {
                const reached = FLOW.indexOf(lead.stage) >= i || lead.stage === 'closed_won';
                const active = lead.stage === stg;
                return (
                  <Pressable key={stg} onPress={() => changeStage(stg)} style={{ alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: reached ? c.primary : c.cardAlt, borderWidth: active ? 3 : 0, borderColor: c.accent }}>
                      {reached ? <Ionicons name="checkmark" size={16} color="#fff" /> : <Text style={{ color: c.faint, fontWeight: '800', fontSize: 12 }}>{i + 1}</Text>}
                    </View>
                    <Text style={{ color: active ? c.text : c.muted, fontSize: 10, fontWeight: active ? '800' : '500', marginTop: 6, textAlign: 'center' }}>{STAGE_META[stg].label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: c.faint, fontSize: 12, marginTop: 14, textAlign: 'center' }}>Tap a stage to update the pipeline</Text>
            {lead.stage !== 'closed_won' && lead.stage !== 'closed_lost' && (
              <Button label="Mark as Lost" icon="close-circle-outline" variant="ghost" size="sm" onPress={() => changeStage('closed_lost')} style={{ marginTop: 6 }} />
            )}
          </Card>
        </View>

        {/* Details */}
        <View>
          <SectionHeader title="Details" />
          <Card padded={false} style={{ padding: 4 }}>
            <InfoRow icon="pricetag" label="Interested in" value={lead.interest || '—'} />
            <InfoRow icon="cash" label="Premium potential" value={inr(lead.potential)} />
            <InfoRow icon="call-outline" label="Mobile" value={lead.phone} />
            <InfoRow icon="calendar-outline" label="Added" value={fmtDate(lead.createdAt)} />
            {lead.nextAction ? <InfoRow icon="flag" label="Next action" value={lead.nextAction} last /> : null}
          </Card>
        </View>

        {/* Notes */}
        <View>
          <SectionHeader title={`Notes (${lead.notes.length})`} />
          {lead.notes.length === 0 ? (
            <Card><Text style={{ color: c.muted, fontSize: 13.5, textAlign: 'center' }}>No notes yet.</Text></Card>
          ) : (
            <View style={{ gap: 8 }}>
              {lead.notes.map((n) => (
                <Card key={n.id} padded={false} style={{ padding: 13 }}>
                  <Text style={{ color: c.text, fontSize: 13.5, lineHeight: 19 }}>{n.text}</Text>
                  <Text style={{ color: c.faint, fontSize: 11, marginTop: 6 }}>{timeAgo(n.at)}</Text>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value, last }: { icon: any; label: string; value: string; last?: boolean }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.hairline }}>
      <Ionicons name={icon} size={17} color={c.faint} style={{ width: 26 }} />
      <Text style={{ color: c.muted, fontSize: 13.5, flex: 1 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 13.5, fontWeight: '600', maxWidth: '55%', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}
