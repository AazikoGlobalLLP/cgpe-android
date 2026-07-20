import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Button, Card, EmptyState, Header, Loader, Pill, SectionHeader } from '@/ui/kit';
import { useConfirm } from '@/ui/Confirm';
import * as api from '@/data/api';
import type { Claim, ClaimStatus } from '@/data/types';
import { CLAIM_STATUS } from '@/data/labels';
import { inr, fmtDate, fmtTime, timeAgo } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';

const FLOW: ClaimStatus[] = ['intake', 'docs_pending', 'under_review', 'submitted', 'settled'];

export default function ClaimDetail() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toast } = useConfirm();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const cl = await api.getClaim(String(id));
    setClaim(cl ?? null); setLoading(false);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleDoc = async (docId: string) => {
    if (!claim) return;
    try { Haptics.selectionAsync(); } catch {}
    setClaim({ ...claim, docs: claim.docs.map((d) => (d.id === docId ? { ...d, received: !d.received } : d)) });
    await api.toggleClaimDoc(claim.id, docId);
  };

  const capture = async () => {
    if (!claim) return;
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    let result: ImagePicker.ImagePickerResult;
    if (cam.granted) {
      result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    } else {
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!lib.granted) { toast('Allow camera or photos to attach a document.'); return; }
      result = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
    }
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];

    // Upload to the real backend (falls back to a simulated success offline).
    setUploading(true);
    const up = await api.uploadFile(asset.uri, asset.fileName || `claim-${Date.now()}.jpg`, asset.mimeType || 'image/jpeg');
    setUploading(false);
    if (!up) { toast('Upload failed — check your connection and try again.'); return; }

    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    const firstPending = claim.docs.find((d) => !d.received);
    const docs = firstPending
      ? claim.docs.map((d) => (d.id === firstPending.id ? { ...d, received: true } : d))
      : [...claim.docs, { id: 'd' + Date.now(), name: 'Additional document', received: true }];
    const ev = { id: 't' + Date.now(), label: `Document uploaded: ${firstPending?.name ?? 'Additional document'}`, at: new Date().toISOString(), by: 'Rahul Patel' };
    setClaim({ ...claim, docs, timeline: [...claim.timeline, ev] });
    if (firstPending) await api.toggleClaimDoc(claim.id, firstPending.id);
    toast(up.url.startsWith('demo://') ? 'Document attached (demo).' : 'Document uploaded ✓');
  };

  const advance = () => {
    if (!claim) return;
    const idx = FLOW.indexOf(claim.status);
    if (idx < 0 || idx >= FLOW.length - 1) return;
    const next = FLOW[idx + 1];
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    const ev = { id: 't' + Date.now(), label: `Status → ${CLAIM_STATUS[next].label}`, at: new Date().toISOString(), by: 'Rahul Patel' };
    setClaim({ ...claim, status: next, timeline: [...claim.timeline, ev] });
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Claim" back /><Loader /></View>;
  if (!claim) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Claim" back /><EmptyState icon="alert-circle-outline" title="Claim not found" /></View>;

  const st = CLAIM_STATUS[claim.status];
  const received = claim.docs.filter((d) => d.received).length;
  const canAdvance = claim.status !== 'settled' && claim.status !== 'rejected';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={claim.ref} subtitle={claim.type + ' claim'} back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }} showsVerticalScrollIndicator={false}>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>{claim.clientName}</Text>
            <Pill label={st.label} tone={st.tone} />
          </View>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 3 }}>Policy {claim.policyNumber} · {claim.insurer}</Text>
          <Text style={{ color: c.success, fontSize: 26, fontWeight: '900', marginTop: 12, letterSpacing: -0.5 }}>{inr(claim.amount)}</Text>
          <Text style={{ color: c.faint, fontSize: 12, marginTop: 2 }}>Opened {fmtDate(claim.openedAt)} · {claim.ageDays} days ago</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Button label="Call client" icon="call" variant="secondary" onPress={() => call(claim.clientPhone)} style={{ flex: 1 }} />
            <Button label="Request docs" icon="logo-whatsapp" variant="whatsapp" onPress={() => whatsapp(claim.clientPhone, `Namaste, regarding your ${claim.type} claim ${claim.ref}, we need a few documents to proceed.`)} style={{ flex: 1 }} />
          </View>
        </Card>

        {claim.aiSummary ? (
          <Card style={{ backgroundColor: c.primarySoft, borderColor: c.primary + '40' }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <Ionicons name="sparkles" size={16} color={c.primary} />
              <Text style={{ color: c.primary, fontWeight: '800', fontSize: 13 }}>AI-Ops summary</Text>
            </View>
            <Text style={{ color: c.text, fontSize: 13.5, lineHeight: 20 }}>{claim.aiSummary}</Text>
          </Card>
        ) : null}

        {/* Documents */}
        <View>
          <SectionHeader title={`Documents · ${received}/${claim.docs.length}`} />
          <Card padded={false} style={{ padding: 4 }}>
            {claim.docs.map((d, i) => (
              <Pressable key={d.id} onPress={() => toggleDoc(d.id)}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: i === claim.docs.length - 1 ? 0 : 1, borderBottomColor: c.hairline }}>
                <Ionicons name={d.received ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={d.received ? c.success : c.faint} />
                <Text style={{ color: c.text, fontSize: 14, marginLeft: 12, flex: 1, textDecorationLine: d.received ? 'none' : 'none' }}>{d.name}</Text>
                {d.received ? <Pill label="Received" tone="success" small /> : <Pill label="Pending" tone="warning" small />}
              </Pressable>
            ))}
          </Card>
          <Button label={uploading ? 'Uploading…' : 'Capture / upload document'} icon="camera" variant="outline" full onPress={capture} loading={uploading} style={{ marginTop: 10 }} />
        </View>

        {/* Timeline */}
        <View>
          <SectionHeader title="Timeline" />
          <Card>
            {claim.timeline.map((t, i) => (
              <View key={t.id} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: c.primary, marginTop: 4 }} />
                  {i < claim.timeline.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: c.border, marginVertical: 2 }} />}
                </View>
                <View style={{ flex: 1, paddingBottom: i < claim.timeline.length - 1 ? 16 : 0 }}>
                  <Text style={{ color: c.text, fontSize: 13.5, fontWeight: '600' }}>{t.label}</Text>
                  <Text style={{ color: c.faint, fontSize: 11.5, marginTop: 2 }}>{fmtDate(t.at)} · {fmtTime(t.at)} · {t.by}</Text>
                </View>
              </View>
            ))}
          </Card>
        </View>

        {canAdvance && (
          <Button label={`Advance to ${CLAIM_STATUS[FLOW[Math.min(FLOW.indexOf(claim.status) + 1, FLOW.length - 1)]].label}`} icon="arrow-forward-circle" full onPress={advance} />
        )}
      </ScrollView>
    </View>
  );
}
