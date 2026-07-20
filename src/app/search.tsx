import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, spacing } from '@/theme/theme';
import { Avatar, Card, EmptyState, Header, Pill, SearchBar, SectionHeader } from '@/ui/kit';
import * as api from '@/data/api';
import type { Claim, Client, Lead } from '@/data/types';
import { inrShort } from '@/lib/format';
import { STAGE_META, CLAIM_STATUS } from '@/data/labels';

export default function Search() {
  const c = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ leads: Lead[]; clients: Client[]; claims: Claim[] }>({ leads: [], clients: [], claims: [] });
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let active = true;
    if (!q.trim()) { setRes({ leads: [], clients: [], claims: [] }); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await api.search(q);
      if (active) { setRes(r as any); setSearching(false); }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [q]);

  const total = res.leads.length + res.clients.length + res.claims.length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Search" back />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search clients, leads, claims…" autoFocus />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {!q.trim() ? (
          <EmptyState icon="search" title="Search everything" subtitle="Find any client, lead or claim by name, number or reference." />
        ) : total === 0 && !searching ? (
          <EmptyState icon="sad-outline" title={`No results for "${q}"`} />
        ) : (
          <>
            {res.clients.length > 0 && (
              <View>
                <SectionHeader title={`Clients (${res.clients.length})`} />
                <View style={{ gap: 8 }}>
                  {res.clients.map((cl) => (
                    <Card key={cl.id} onPress={() => router.push(`/client/${cl.id}`)} padded={false} style={{ padding: 11, flexDirection: 'row', alignItems: 'center' }}>
                      <Avatar name={cl.name} size={40} />
                      <View style={{ flex: 1, marginLeft: 11 }}>
                        <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{cl.name}</Text>
                        <Text style={{ color: c.muted, fontSize: 12 }}>{cl.city} · {inrShort(cl.totalCover)} cover</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={c.faint} />
                    </Card>
                  ))}
                </View>
              </View>
            )}
            {res.leads.length > 0 && (
              <View>
                <SectionHeader title={`Leads (${res.leads.length})`} />
                <View style={{ gap: 8 }}>
                  {res.leads.map((l) => (
                    <Card key={l.id} onPress={() => router.push(`/lead/${l.id}`)} padded={false} style={{ padding: 11, flexDirection: 'row', alignItems: 'center' }}>
                      <Avatar name={l.name} size={40} />
                      <View style={{ flex: 1, marginLeft: 11 }}>
                        <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{l.name}</Text>
                        <Text style={{ color: c.muted, fontSize: 12 }}>{l.interest}</Text>
                      </View>
                      <Pill label={STAGE_META[l.stage].label} tone={STAGE_META[l.stage].tone} small />
                    </Card>
                  ))}
                </View>
              </View>
            )}
            {res.claims.length > 0 && (
              <View>
                <SectionHeader title={`Claims (${res.claims.length})`} />
                <View style={{ gap: 8 }}>
                  {res.claims.map((cl) => (
                    <Card key={cl.id} onPress={() => router.push(`/claim/${cl.id}`)} padded={false} style={{ padding: 11, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="shield-half" size={19} color={c.primary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 11 }}>
                        <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{cl.clientName}</Text>
                        <Text style={{ color: c.muted, fontSize: 12 }}>{cl.ref} · {inrShort(cl.amount)}</Text>
                      </View>
                      <Pill label={CLAIM_STATUS[cl.status].label} tone={CLAIM_STATUS[cl.status].tone} small />
                    </Card>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
