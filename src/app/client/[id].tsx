import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Modal, Pressable, Linking, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Avatar, Button, Card, EmptyState, Header, Loader, Pill, SectionHeader } from '@/ui/kit';
import { useConfirm } from '@/ui/Confirm';
import * as api from '@/data/api';
import type { Client, Policy } from '@/data/types';
import { SEG_META } from '@/data/labels';
import { inr, inrShort, fmtDate, daysUntil } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';
import { renewalMessage, birthdayMessage } from '@/lib/messages';

export default function ClientDetail() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toast } = useConfirm();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [reporting, setReporting] = useState(false);
  const [report, setReport] = useState<any | null>(null);

  const load = useCallback(async () => {
    const cl = await api.getClient(String(id));
    setClient(cl ?? null); setLoading(false);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doReport = async () => {
    if (!client) return;
    setReporting(true);
    const r = await api.generateReport(client.name);
    setReporting(false);
    if (r?.ok) setReport(r);
    else toast('Could not generate the report. Please try again.');
  };

  const sendReminder = () => {
    if (!client) return;
    const p = client.policies[0];
    whatsapp(client.phone, renewalMessage({
      name: client.name, premium: p?.premium, sumAssured: p?.sumAssured, policyNo: p?.number,
      mode: p?.frequency, dueDate: p?.nextRenewal, since: Number(client.since) || undefined,
    }));
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Client" back /><Loader /></View>;
  if (!client) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Client" back /><EmptyState icon="alert-circle-outline" title="Client not found" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Client 360" back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }} showsVerticalScrollIndicator={false}>

        <Card style={{ alignItems: 'center' }}>
          <Avatar name={client.name} size={72} />
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '800', marginTop: 12 }}>{client.name}</Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>{client.city} · Client since {client.since}</Text>
          {client.segment.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {client.segment.map((s) => { const m = SEG_META[s]; return m ? <Pill key={s} label={m.label} tone={m.tone} small icon={m.icon} /> : null; })}
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' }}>
            <Button label="Call" icon="call" variant="secondary" onPress={() => call(client.phone)} style={{ flex: 1 }} />
            <Button label="WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={() => whatsapp(client.phone, `Namaste ${client.name}`)} style={{ flex: 1 }} />
          </View>
        </Card>

        {/* Portfolio summary */}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <SummaryBox label="Total cover" value={inrShort(client.totalCover)} icon="shield-checkmark" tint={c.primary} />
          <SummaryBox label="Annual premium" value={inrShort(client.totalPremium)} icon="cash" tint={c.success} />
          <SummaryBox label="Policies" value={String(client.policies.length)} icon="documents" tint={c.accent} />
        </View>

        {/* Policies */}
        <View>
          <SectionHeader title={`Policies (${client.policies.length})`} />
          <View style={{ gap: 10 }}>
            {client.policies.map((p) => <PolicyCard key={p.id} p={p} />)}
          </View>
        </View>

        <Button label="Send premium reminder" icon="logo-whatsapp" variant="whatsapp" full onPress={sendReminder} />
        <Button label={reporting ? 'Generating report…' : 'Generate client report'} icon="document-text" variant="outline" full onPress={doReport} loading={reporting} style={{ marginTop: 10 }} />
      </ScrollView>

      <ReportModal report={report} onClose={() => setReport(null)} />
    </View>
  );
}

function ReportModal({ report, onClose }: { report: any | null; onClose: () => void }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  if (!report) return null;
  const s = report.summary || {};
  const rows: { label: string; value: string }[] = [];
  if (s.total_policies != null) rows.push({ label: 'Total policies', value: String(s.total_policies) });
  if (s.life_cover != null) rows.push({ label: 'Total life cover', value: inr(s.life_cover) });
  if (s.annual_premium != null) rows.push({ label: 'Annual premium', value: inr(s.annual_premium) });
  if (s.members != null) rows.push({ label: 'Family members', value: String(s.members) });
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: c.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + 16, maxHeight: '86%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Client report</Text>
              <Text style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>{report.familyHead}{report.source === 'demo' ? ' · sample' : ''}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={24} color={c.muted} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 12 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {rows.map((r) => (
                <Card key={r.label} style={{ flexGrow: 1, minWidth: '46%', padding: spacing.md }}>
                  <Text style={{ color: c.muted, fontSize: 12 }}>{r.label}</Text>
                  <Text style={{ color: c.text, fontSize: 19, fontWeight: '800', marginTop: 4 }}>{r.value}</Text>
                </Card>
              ))}
            </View>
            {report.viewUrl ? <Button label="View full report" icon="open-outline" full onPress={() => Linking.openURL(report.viewUrl)} /> : null}
            {report.pdfUrl ? <Button label="Download PDF" icon="download" variant="outline" full onPress={() => Linking.openURL(report.pdfUrl)} /> : null}
            <Button
              label="Share report"
              icon="share-social"
              variant={report.viewUrl ? 'outline' : 'primary'}
              full
              onPress={() => {
                const lines = [`${report.familyHead} — CGPE client report`];
                if (s.life_cover != null) lines.push(`Total life cover: ${inr(s.life_cover)}`);
                if (s.annual_premium != null) lines.push(`Annual premium: ${inr(s.annual_premium)}`);
                if (s.total_policies != null) lines.push(`Policies: ${s.total_policies}`);
                const url = report.viewUrl || report.pdfUrl;
                if (url) lines.push(url);
                Share.share({ message: lines.join('\n'), ...(url ? { url } : {}) }).catch(() => {});
              }}
            />
            {!report.viewUrl && !report.pdfUrl ? <Text style={{ color: c.faint, fontSize: 12.5, textAlign: 'center' }}>A hosted report link appears here when generated against your live backend.</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SummaryBox({ label, value, icon, tint }: { label: string; value: string; icon: any; tint: string }) {
  const c = useTheme();
  return (
    <Card style={{ flex: 1, padding: spacing.md, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={18} color={tint} />
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '800', marginTop: 8 }}>{value}</Text>
      <Text style={{ color: c.muted, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </Card>
  );
}

function PolicyCard({ p }: { p: Policy }) {
  const c = useTheme();
  const days = daysUntil(p.nextRenewal);
  const renewalTone = days <= 7 ? c.danger : days <= 30 ? c.warning : c.muted;
  return (
    <Card padded={false} style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: c.text, fontWeight: '800', fontSize: 14.5, flex: 1 }} numberOfLines={1}>{p.plan}</Text>
        <Pill label={p.status === 'in_force' ? 'In force' : p.status} tone={p.status === 'in_force' ? 'success' : 'warning'} small />
      </View>
      <Text style={{ color: c.muted, fontSize: 12, marginTop: 3 }}>Policy {p.number}</Text>

      <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
        <MiniStat label="Sum assured" value={inrShort(p.sumAssured)} />
        <MiniStat label="Premium" value={`${inrShort(p.premium)}/yr`} />
        <MiniStat label="Maturity" value={fmtDate(p.maturityDate).split(' ').slice(1).join(' ')} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.hairline }}>
        <Ionicons name="refresh-circle" size={15} color={renewalTone} />
        <Text style={{ color: renewalTone, fontSize: 12.5, fontWeight: '700' }}>
          {days < 0 ? `Renewal overdue` : days === 0 ? 'Renewal due today' : `Renewal in ${days} days`}
        </Text>
        <Text style={{ color: c.faint, fontSize: 12 }}>· {fmtDate(p.nextRenewal)}</Text>
      </View>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: c.faint, fontSize: 10.5, marginBottom: 2 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{value}</Text>
    </View>
  );
}
