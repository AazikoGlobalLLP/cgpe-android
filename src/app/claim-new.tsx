import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing } from '@/theme/theme';
import { Button, Chips, Field, Header } from '@/ui/kit';
import * as api from '@/data/api';
import type { Claim } from '@/data/types';

const TYPES: { key: Claim['type']; label: string }[] = [
  { key: 'Maturity', label: 'Maturity' },
  { key: 'Death', label: 'Death' },
  { key: 'Health', label: 'Health' },
  { key: 'Surrender', label: 'Surrender' },
  { key: 'Accident', label: 'Accident' },
];

const DOC_TEMPLATES: Record<Claim['type'], string[]> = {
  Maturity: ['Discharge form', 'Original policy bond', 'NEFT bank mandate', 'ID proof (Aadhaar/PAN)'],
  Death: ['Death certificate', 'Claim form A', 'Nominee KYC', 'Policy bond'],
  Health: ['Hospital bills', 'Discharge summary', 'Diagnostic reports', 'ID proof'],
  Surrender: ['Surrender form', 'Original policy bond', 'NEFT bank mandate'],
  Accident: ['FIR copy', 'Medical certificate', 'Policy bond', 'ID proof'],
};

export default function ClaimNew() {
  const c = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<Claim['type']>('Maturity');
  const [policy, setPolicy] = useState('');
  const [amount, setAmount] = useState('');
  const [insurer, setInsurer] = useState('LIC of India');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const docs = DOC_TEMPLATES[type].map((n, i) => ({ id: `d${Date.now()}${i}`, name: n, received: false }));
    const created = await api.addClaim({
      clientName: name, clientPhone: phone, type, policyNumber: policy,
      amount: Number(amount) || 0, insurer, docs,
    });
    setSaving(false);
    router.replace(`/claim/${created.id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="New claim" back />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 8 }}>
            <Text style={{ color: c.muted, fontSize: 13, fontWeight: '700' }}>Claim type</Text>
            <Chips options={TYPES} value={type} onChange={setType} />
          </View>
          <Field label="Client name *" value={name} onChange={setName} placeholder="Claimant / policyholder name" />
          <Field label="Client mobile" value={phone} onChange={setPhone} placeholder="+91 …" keyboardType="phone-pad" />
          <Field label="Policy number" value={policy} onChange={setPolicy} placeholder="82C-…" />
          <Field label="Claim amount (₹)" value={amount} onChange={setAmount} placeholder="e.g. 1850000" keyboardType="numeric" />
          <Field label="Insurer / TPA" value={insurer} onChange={setInsurer} placeholder="LIC of India" />

          <View style={{ backgroundColor: c.cardAlt, borderRadius: 12, padding: 14 }}>
            <Text style={{ color: c.muted, fontSize: 12.5, lineHeight: 18 }}>
              A document checklist for a <Text style={{ fontWeight: '800', color: c.text }}>{type}</Text> claim will be created automatically:
              {'\n'}{DOC_TEMPLATES[type].join(' · ')}
            </Text>
          </View>

          <Button label="Create claim" icon="checkmark" onPress={save} loading={saving} size="lg" full />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
