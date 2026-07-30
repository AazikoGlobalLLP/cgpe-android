import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useJobs } from '@/store/jobs';
import { useTheme, spacing, radius, shadow } from '@/theme/theme';
import { Avatar, Button, Card, Chips, EmptyState, Grad, Header, Loader } from '@/ui/kit';
import { useConfirm } from '@/ui/Confirm';
import { useT } from '@/i18n';
import * as api from '@/data/api';
import type { Client } from '@/data/types';
import { isPremiumDueThisMonth, isBirthdayThisMonth, monthMatches } from '@/data/adapt';
import { renewalMessage, birthdayMessage, maturityMessage, anniversaryMessage } from '@/lib/messages';
import { whatsapp } from '@/lib/actions';

type Kind = 'renewal' | 'birthday' | 'maturity' | 'anniversary';
type Rec = { name: string; phone: string; message: string };

const KIND_META: Record<Kind, { icon: any; tint: (c: any) => string }> = {
  renewal: { icon: 'refresh-circle', tint: (c) => c.warning },
  birthday: { icon: 'gift', tint: (c) => c.accent },
  maturity: { icon: 'cash', tint: (c) => c.info },
  anniversary: { icon: 'heart', tint: (c) => c.danger },
};

function msgFor(kind: Kind, cl: Client): string {
  const p = cl.policies[0];
  const ctx = { name: cl.name, premium: p?.premium, sumAssured: p?.sumAssured, policyNo: p?.number, mode: p?.frequency, dueDate: p?.nextRenewal, dob: cl.dob, maturity: p?.maturityDate, since: Number(cl.since) || undefined };
  if (kind === 'birthday') return birthdayMessage(ctx);
  if (kind === 'maturity') return maturityMessage(ctx);
  if (kind === 'anniversary') return anniversaryMessage(ctx);
  return renewalMessage(ctx);
}
function matches(kind: Kind, cl: Client): boolean {
  if (kind === 'renewal') return isPremiumDueThisMonth(cl);
  if (kind === 'birthday') return isBirthdayThisMonth(cl);
  if (kind === 'maturity') return cl.segment.includes('maturity_soon');
  if (kind === 'anniversary') return monthMatches(cl.policies[0]?.startDate);
  return false;
}

export default function Premium() {
  const c = useTheme();
  const t = useT();
  const { confirm, toast } = useConfirm();
  const router = useRouter();
  const { startCampaign } = useJobs();
  const [kind, setKind] = useState<Kind>('renewal');
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [more, setMore] = useState(0);
  const [list, setList] = useState<Rec[]>([]);
  const [sending, setSending] = useState(false);

  const load = useCallback(async (k: Kind) => {
    setLoading(true);
    // Renewals are scanned from the real client book by the background job
    // (the campaign aggregation is scope-buggy for super_admin), so this tab is a
    // call-to-action rather than a pre-loaded list.
    if (k === 'renewal') { setCount(-1); setList([]); setMore(0); setLoading(false); return; }
    const audience = await api.getCampaignAudience(k);
    if (audience && audience.count > 0) {
      setCount(audience.count);
      setMore(Math.max(0, audience.count - audience.sample.length));
      setList(audience.sample.map((s) => ({ name: s.name, phone: '+' + String(s.phone).replace(/\D/g, ''), message: s.message })));
    } else {
      const clients = await api.getClients();
      const m = clients.filter((cl) => matches(k, cl) && cl.phone);
      setCount(m.length);
      setMore(Math.max(0, m.length - 20));
      setList(m.slice(0, 20).map((cl) => ({ name: cl.name, phone: cl.phone, message: msgFor(k, cl) })));
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(kind); }, [load, kind]));

  const changeKind = (k: Kind) => { setKind(k); load(k); };

  const sendAll = async () => {
    if (kind !== 'renewal' && count <= 0) { toast('No matching clients right now.'); return; }
    const ok = await confirm({
      title: kind === 'renewal' ? 'Find & send renewal reminders?' : `Send to ${count} client(s)?`,
      message: kind === 'renewal'
        ? `We'll scan your entire client book for premiums due in the next 30 days and send each a personalised WhatsApp. This runs in the background — you can keep working.`
        : `A personalised WhatsApp will be sent to all ${count} matching client(s). This runs in the background.`,
      confirmText: kind === 'renewal' ? 'Scan & send' : 'Start sending', icon: KIND_META[kind].icon,
    });
    if (!ok) return;

    setSending(true);
    const jobId = await startCampaign(kind, title);
    setSending(false);

    const monitor = await confirm({
      title: kind === 'renewal' ? 'Scan started' : 'Sending started',
      message: kind === 'renewal'
        ? `Your client book is being scanned and renewal reminders dispatched in the background. Watch the progress or keep working?`
        : `${count} message(s) are being dispatched in the background. Do you want to watch the progress or keep working?`,
      confirmText: 'Monitor progress', cancelText: 'Continue working', icon: 'paper-plane',
    });
    if (monitor) router.push(`/job/${jobId}`);
    else toast('Running in the background — tap the progress bar to monitor.');
  };

  const title = kind === 'renewal' ? t('premium.dueThisMonth') : kind === 'birthday' ? t('premium.birthdaysThisMonth') : kind === 'maturity' ? t('premium.maturitySoon') : t('premium.anniversaries');
  const tint = KIND_META[kind].tint(c);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t('premium.title')} back />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 6 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chips
            options={[
              { key: 'renewal' as Kind, label: t('premium.renewalDue') },
              { key: 'birthday' as Kind, label: t('act.birthdays') },
              { key: 'maturity' as Kind, label: t('premium.maturitySoon') },
              { key: 'anniversary' as Kind, label: t('premium.anniversaries') },
            ]}
            value={kind}
            onChange={changeKind}
          />
        </ScrollView>
      </View>

      {loading ? <Loader /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 8, gap: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Hero: count + send-all */}
          <View style={{ borderRadius: radius.xl, overflow: 'hidden', ...shadow(c, 2) }}>
            <Grad colors={c.gradientHero} style={{ padding: spacing.xl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={KIND_META[kind].icon} size={24} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>{count < 0 ? 'Scan' : count}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{count < 0 ? 'your book for premiums due in 30 days' : title}</Text>
                </View>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginTop: 14, lineHeight: 18 }}>{count < 0 ? 'We scan all 9,000+ clients in the background and send each a personalised renewal reminder on WhatsApp. Keep working while it runs.' : t('premium.oneClick')}</Text>
              <Pressable onPress={sendAll} disabled={sending || (kind !== 'renewal' && count === 0)} style={{ marginTop: 16, borderRadius: radius.md, overflow: 'hidden', opacity: (kind !== 'renewal' && count === 0) ? 0.5 : 1 }}>
                <Grad colors={c.gradientAccent} style={{ height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Ionicons name={count < 0 ? 'search' : 'logo-whatsapp'} size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{sending ? 'Sending…' : count < 0 ? 'Find & send renewals' : `${t('premium.sendAll')} (${count})`}</Text>
                </Grad>
              </Pressable>
            </Grad>
          </View>

          {/* Individual list */}
          {list.length === 0 ? (
            <Card><EmptyState
              icon={kind === 'renewal' ? 'sync-circle' : 'checkmark-done-circle'}
              title={kind === 'renewal' ? 'Scan on demand' : 'Nothing due'}
              subtitle={kind === 'renewal' ? 'Renewals are read live from your full client book. Tap “Find & send renewals” above to scan and message everyone due in the next 30 days.' : 'No matching clients for this category this month.'}
            /></Card>
          ) : (
            <View style={{ gap: 10 }}>
              {list.map((r, i) => (
                <Card key={i} padded={false} style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
                  <Avatar name={r.name} size={44} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 14.5 }} numberOfLines={1}>{r.name}</Text>
                    <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{r.phone}</Text>
                  </View>
                  <Pressable onPress={() => whatsapp(r.phone, r.message)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.whatsappSoft, paddingHorizontal: 14, height: 38, borderRadius: radius.pill, opacity: pressed ? 0.7 : 1 }]}>
                    <Ionicons name="logo-whatsapp" size={17} color={c.whatsapp} />
                    <Text style={{ color: c.whatsapp, fontWeight: '700', fontSize: 13 }}>{t('common.send')}</Text>
                  </Pressable>
                </Card>
              ))}
              {more > 0 && <Text style={{ color: c.faint, fontSize: 12.5, textAlign: 'center' }}>+ {more} more — use “{t('premium.sendAll')}” to reach everyone.</Text>}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
