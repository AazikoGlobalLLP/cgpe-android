import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Avatar, Button, Chips, Field, Header, SearchBar } from '@/ui/kit';
import { useConfirm } from '@/ui/Confirm';
import * as api from '@/data/api';
import type { Claim, Client } from '@/data/types';

const TYPES: { key: Claim['type']; label: string }[] = [
  { key: 'Health', label: 'Health' },
  { key: 'Death', label: 'Death' },
  { key: 'Maturity', label: 'Maturity' },
  { key: 'Surrender', label: 'Surrender' },
  { key: 'Accident', label: 'Accident' },
];

export default function ClaimNew() {
  const c = useTheme();
  const router = useRouter();
  const { toast, confirm } = useConfirm();

  // Client picker — a real claim needs an existing client_id from the book.
  const [picked, setPicked] = useState<Client | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);

  const [type, setType] = useState<Claim['type']>('Health');
  const [policy, setPolicy] = useState('');
  const [amount, setAmount] = useState('');
  const [insurer, setInsurer] = useState('LIC of India');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (picked || q.trim().length < 2) { setResults([]); return; }
    let live = true;
    setSearching(true);
    const t = setTimeout(async () => {
      const page = await api.getClientsPage(1, q.trim());
      if (live) { setResults(page.items.slice(0, 8)); setSearching(false); }
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [q, picked]);

  const pick = (cl: Client) => {
    setPicked(cl);
    setPolicy(cl.policies[0]?.number && cl.policies[0].number !== '—' ? cl.policies[0].number : '');
    setResults([]); setQ('');
  };

  const save = async () => {
    if (!picked) { toast('Search and select a client first.'); return; }
    setSaving(true);
    const created = await api.addClaim({
      clientId: picked.id, clientName: picked.name, clientPhone: picked.phone,
      type, policyNumber: policy, amount: Number(amount) || 0, insurer, notes,
    });
    setSaving(false);
    if ((created as any).forbidden) {
      confirm({ title: 'Not allowed', message: 'Your account can’t create claims. Ask an admin to enable this, or sign in with an admin/super-admin account.', confirmText: 'OK', icon: 'lock-closed' });
      return;
    }
    if ((created as any).error) { toast((created as any).error); return; }
    toast('Claim created.');
    router.replace(`/claim/${created.id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="New claim" back />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

          {/* Step 1 — client */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: c.muted, fontSize: 13, fontWeight: '700' }}>Client</Text>
            {picked ? (
              <Pressable onPress={() => setPicked(null)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: 12 }}>
                <Avatar name={picked.name} size={42} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: c.text, fontWeight: '700', fontSize: 14.5 }} numberOfLines={1}>{picked.name}</Text>
                  <Text style={{ color: c.muted, fontSize: 12.5, marginTop: 1 }} numberOfLines={1}>{picked.phone || 'No number'}{picked.policies[0]?.number && picked.policies[0].number !== '—' ? ` · ${picked.policies[0].number}` : ''}</Text>
                </View>
                <Text style={{ color: c.primary, fontWeight: '700', fontSize: 12.5 }}>Change</Text>
              </Pressable>
            ) : (
              <>
                <SearchBar value={q} onChange={setQ} placeholder="Search client by name or number" />
                {searching && <ActivityIndicator color={c.primary} style={{ marginTop: 6 }} />}
                {results.length > 0 && (
                  <View style={{ backgroundColor: c.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
                    {results.map((cl, i) => (
                      <Pressable key={cl.id} onPress={() => pick(cl)} style={{ flexDirection: 'row', alignItems: 'center', padding: 11, borderBottomWidth: i === results.length - 1 ? 0 : 1, borderBottomColor: c.hairline }}>
                        <Avatar name={cl.name} size={34} />
                        <View style={{ flex: 1, marginLeft: 11 }}>
                          <Text style={{ color: c.text, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>{cl.name}</Text>
                          <Text style={{ color: c.muted, fontSize: 11.5 }} numberOfLines={1}>{cl.phone || 'No number'}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
                {!searching && q.trim().length >= 2 && results.length === 0 && (
                  <Text style={{ color: c.faint, fontSize: 12.5, paddingHorizontal: 4 }}>No clients match “{q}”.</Text>
                )}
              </>
            )}
          </View>

          {/* Step 2 — claim details (only once a client is chosen) */}
          {picked && (
            <>
              <View style={{ gap: 8 }}>
                <Text style={{ color: c.muted, fontSize: 13, fontWeight: '700' }}>Claim type</Text>
                <Chips options={TYPES} value={type} onChange={setType} />
              </View>
              <Field label="Policy number" value={policy} onChange={setPolicy} placeholder="82C-…" />
              <Field label="Claim amount (₹)" value={amount} onChange={setAmount} placeholder="e.g. 500000" keyboardType="numeric" />
              <Field label="Insurer / TPA" value={insurer} onChange={setInsurer} placeholder="LIC of India" />
              <Field label="Notes" value={notes} onChange={setNotes} placeholder="Anything the team should know…" />
              <Button label="Create claim" icon="checkmark" onPress={save} loading={saving} size="lg" full />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
