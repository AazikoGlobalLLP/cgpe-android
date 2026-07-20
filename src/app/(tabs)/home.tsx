import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useTheme, spacing, radius, shadow } from '@/theme/theme';
import { ActionTile, Avatar, Card, EmptyState, Grad, Pill, SectionHeader } from '@/ui/kit';
import { useAuth } from '@/store/auth';
import { useT } from '@/i18n';
import * as api from '@/data/api';
import type { Claim, Client, Commission, Lead, Reminder } from '@/data/types';
import { REMINDER_ICON } from '@/data/labels';
import { inr, inrShort, fmtTime } from '@/lib/format';
import { whatsapp } from '@/lib/actions';

export default function Home() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const t = useT();
  const hour = new Date().getHours();
  const greet = hour < 12 ? t('greet.morning') : hour < 17 ? t('greet.afternoon') : t('greet.evening');

  const [refreshing, setRefreshing] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [comm, setComm] = useState<Commission | null>(null);
  const [unread, setUnread] = useState(0);
  const [clock, setClock] = useState<{ in: boolean; time?: string; place?: string }>({ in: false });
  const [clocking, setClocking] = useState(false);

  const todayKey = 'clock.' + new Date().toDateString();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const [r, l, cl, cli, cm, nt, saved] = await Promise.all([
      api.getReminders(), api.getLeads(), api.getClaims(), api.getClients(), api.getCommission(),
      api.getNotifications(), AsyncStorage.getItem(todayKey),
    ]);
    setReminders(r); setLeads(l); setClaims(cl); setClients(cli); setComm(cm);
    setUnread(nt.filter((n) => !n.read).length);
    if (saved) setClock(JSON.parse(saved));
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleClock = async () => {
    setClocking(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    if (clock.in) {
      await api.clockOut();
      const next = { in: false };
      setClock(next); await AsyncStorage.setItem(todayKey, JSON.stringify(next)); setClocking(false); return;
    }
    let place = 'On field';
    let coords: { lat?: number; lng?: number; accuracy?: number; city?: string } = {};
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? undefined };
        try {
          const geo = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          place = geo[0]?.city || geo[0]?.district || geo[0]?.region || 'On field';
        } catch { place = 'Location captured'; }
        coords.city = place;
      } else place = 'Location off';
    } catch { place = 'On field'; }
    // Record attendance on the backend (stored in the attendance/day-log collection).
    const res = await api.clockIn(coords);
    if (!res.ok && res.message) place = res.message;
    const next = { in: !!res.ok || !api.isRealSession(), time: new Date().toISOString(), place };
    setClock(next); await AsyncStorage.setItem(todayKey, JSON.stringify(next)); setClocking(false);
  };

  const doneReminder = async (id: string) => {
    try { Haptics.selectionAsync(); } catch {}
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, done: true } : r)));
    await api.toggleReminder(id);
  };

  const pending = reminders.filter((r) => !r.done).sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const hotLeads = leads.filter((l) => l.priority === 'hot' && !l.stage.startsWith('closed')).slice(0, 3);
  const openClaims = claims.filter((cl) => cl.status !== 'settled' && cl.status !== 'rejected');
  const renewals = reminders.filter((r) => r.type === 'renewal' && !r.done);
  const growth = comm && comm.lastMonth ? ((comm.thisMonth - comm.lastMonth) / comm.lastMonth) * 100 : 0;
  const targetPct = comm ? Math.min(1, comm.thisMonth / comm.target) : 0;
  const contacts = [...leads.filter((l) => l.priority === 'hot'), ...clients].slice(0, 8);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={c.primary} />}
        showsVerticalScrollIndicator={false}>

        {/* Top bar */}
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.muted, fontSize: 13 }}>{greet},</Text>
            <Text style={{ color: c.text, fontSize: 21, fontWeight: '900', letterSpacing: -0.4 }}>{user?.name?.split(' ')[0] ?? 'Advisor'} 👋</Text>
          </View>
          <Pressable onPress={() => router.push('/notifications')} hitSlop={8} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border, marginRight: 10 }}>
            <Ionicons name="notifications-outline" size={21} color={c.text} />
            {unread > 0 && <View style={{ position: 'absolute', top: 8, right: 9, backgroundColor: c.danger, borderRadius: 9, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: c.card }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{unread}</Text>
            </View>}
          </Pressable>
          <Pressable onPress={() => router.push('/profile')} hitSlop={8}><Avatar name={user?.name ?? 'A'} size={44} /></Pressable>
        </View>

        {/* Commission hero card */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: 16 }}>
          <View style={{ borderRadius: radius.xl, overflow: 'hidden', ...shadow(c, 2) }}>
            <Grad colors={c.gradientHero} style={{ padding: spacing.xl }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{t('home.commission')}</Text>
                  <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 6 }}>{comm ? inr(comm.thisMonth) : '—'}</Text>
                </View>
                <Pressable onPress={() => router.push('/commissions')} style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(46,230,166,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Ionicons name={growth >= 0 ? 'trending-up' : 'trending-down'} size={13} color="#4ee6a6" />
                  <Text style={{ color: '#4ee6a6', fontSize: 11.5, fontWeight: '800' }}>{growth >= 0 ? '+' : ''}{growth.toFixed(0)}%</Text>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5 }}>{t('home.vsLast')}</Text>
              </View>

              <View style={{ marginTop: 18 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11.5 }}>{t('home.target')}</Text>
                  <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '700' }}>{comm ? inrShort(comm.thisMonth) : '—'} / {comm ? inrShort(comm.target) : '—'}</Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${targetPct * 100}%`, borderRadius: 4 }}>
                    <Grad colors={c.gradientAccent} angle="horiz" style={{ flex: 1 }} />
                  </View>
                </View>
              </View>
            </Grad>
          </View>
        </View>

        {/* Clock-in row */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: 14 }}>
          <Card style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: clock.in ? c.successSoft : c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={clock.in ? 'checkmark-circle' : 'location'} size={23} color={clock.in ? c.success : c.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{clock.in ? t('home.clockedIn') : t('home.markAttendance')}</Text>
              <Text style={{ color: c.muted, fontSize: 12.5, marginTop: 1 }} numberOfLines={1}>{clock.in ? `${fmtTime(clock.time!)} · ${clock.place}` : t('home.gpsCheckin')}</Text>
            </View>
            <Pressable onPress={toggleClock} disabled={clocking} style={{ borderRadius: 12, overflow: 'hidden' }}>
              {clock.in ? (
                <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: c.border }}>
                  <Text style={{ color: c.muted, fontWeight: '800', fontSize: 13 }}>{t('home.clockOut')}</Text>
                </View>
              ) : (
                <Grad colors={c.gradientBrand} style={{ paddingHorizontal: 18, paddingVertical: 11 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{clocking ? '…' : t('home.clockIn')}</Text>
                </Grad>
              )}
            </Pressable>
          </Card>
        </View>

        {/* Mini stats */}
        <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: 14 }}>
          <MiniStat label={t('home.hotLeads')} value={String(hotLeads.length)} icon="flame" tone={c.danger} onPress={() => router.push('/(tabs)/leads')} />
          <MiniStat label={t('home.openClaims')} value={String(openClaims.length)} icon="shield-half" tone={c.warning} onPress={() => router.push('/(tabs)/claims')} />
          <MiniStat label={t('home.renewals')} value={String(renewals.length)} icon="refresh-circle" tone={c.info} onPress={() => router.push('/premium')} />
        </View>

        {/* Quick actions */}
        <View style={{ marginTop: 22 }}>
          <View style={{ paddingHorizontal: spacing.lg }}><SectionHeader title={t('home.quickActions')} /></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 14 }}>
            <ActionTile icon="gift" label={t('act.premiumDue')} tileIndex={2} onPress={() => router.push('/premium')} />
            <ActionTile icon="person-add" label={t('act.newLead')} tileIndex={0} onPress={() => router.push('/(tabs)/leads')} />
            <ActionTile icon="add-circle" label={t('act.newClaim')} tileIndex={1} onPress={() => router.push('/claim-new')} />
            <ActionTile icon="logo-whatsapp" label={t('act.whatsapp')} tileIndex={4} tint={c.whatsapp} onPress={() => router.push('/whatsapp')} />
            <ActionTile icon="calculator" label={t('act.licPlans')} tileIndex={3} onPress={() => router.push('/lic-plans')} />
            <ActionTile icon="trophy" label={t('act.contests')} tileIndex={5} onPress={() => router.push('/contests')} />
          </ScrollView>
        </View>

        {/* Quick contacts */}
        {contacts.length > 0 && (
          <View style={{ marginTop: 22 }}>
            <View style={{ paddingHorizontal: spacing.lg }}><SectionHeader title={t('home.quickContacts')} action={t('common.search')} onAction={() => router.push('/search')} /></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 16 }}>
              {contacts.map((p: any) => (
                <Pressable key={p.id} onPress={() => router.push(p.interest !== undefined ? `/lead/${p.id}` : `/client/${p.id}`)} style={{ alignItems: 'center', width: 62 }}>
                  <Avatar name={p.name} size={56} />
                  <Text style={{ color: c.muted, fontSize: 11, marginTop: 6, fontWeight: '600' }} numberOfLines={1}>{p.name.split(' ')[0]}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Today's follow-ups */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: 24 }}>
          <SectionHeader title={t('home.followups')} action={t('common.seeAll')} onAction={() => router.push('/reminders')} />
          {pending.length === 0 ? (
            <Card><EmptyState icon="checkmark-done-circle" title={t('home.allCaught')} subtitle={t('home.noFollowups')} /></Card>
          ) : (
            <View style={{ gap: 10 }}>
              {pending.slice(0, 4).map((r) => (
                <Card key={r.id} padded={false} style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={REMINDER_ICON[r.type] ?? 'notifications'} size={19} color={c.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{r.title}</Text>
                    <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{r.subtitle}</Text>
                  </View>
                  {r.phone && (
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      <Pressable onPress={() => whatsapp(r.phone!, `Namaste ${r.clientName || ''}`)} hitSlop={6} style={{ padding: 6 }}><Ionicons name="logo-whatsapp" size={22} color={c.whatsapp} /></Pressable>
                      <Pressable onPress={() => doneReminder(r.id)} hitSlop={6} style={{ padding: 6 }}><Ionicons name="checkmark-circle-outline" size={23} color={c.success} /></Pressable>
                    </View>
                  )}
                </Card>
              ))}
            </View>
          )}
        </View>

        {/* Hot leads */}
        {hotLeads.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: 24 }}>
            <SectionHeader title={t('home.hotLeads')} action={t('common.pipeline')} onAction={() => router.push('/(tabs)/leads')} />
            <View style={{ gap: 10 }}>
              {hotLeads.map((l) => (
                <Card key={l.id} onPress={() => router.push(`/lead/${l.id}`)} padded={false} style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
                  <Avatar name={l.name} size={44} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 14.5 }}>{l.name}</Text>
                    <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{l.interest}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 5 }}>
                    <Text style={{ color: c.success, fontWeight: '800', fontSize: 14 }}>{inrShort(l.potential)}</Text>
                    <Pill label="Hot" tone="danger" small icon="flame" />
                  </View>
                </Card>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function MiniStat({ label, value, icon, tone, onPress }: { label: string; value: string; icon: any; tone: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Card onPress={onPress} style={{ flex: 1, padding: 13 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: tone + '1f', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={16} color={tone} />
        </View>
        <Text style={{ color: c.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>{value}</Text>
      </View>
      <Text style={{ color: c.muted, fontSize: 11.5, marginTop: 8, fontWeight: '600' }}>{label}</Text>
    </Card>
  );
}
