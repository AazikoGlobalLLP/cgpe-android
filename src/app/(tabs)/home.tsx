import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { useTheme, spacing, radius, shadow } from '@/theme/theme';
import { ActionTile, Avatar, Card, EmptyState, Grad, Pill, SectionHeader } from '@/ui/kit';
import { useAuth } from '@/store/auth';
import { useT } from '@/i18n';
import * as api from '@/data/api';
import type { Reminder } from '@/data/types';
import { Task, CATEGORY_ICON, taskProgress } from '@/data/tasks';
import { REMINDER_ICON } from '@/data/labels';
import { fmtTime } from '@/lib/format';
import { whatsapp } from '@/lib/actions';
import { capabilitiesOf, TIER_THEME } from '@/store/roles';
import { AdminDashboard, MasterDashboard } from '@/screens/dashboards';
import { useConfirm } from '@/ui/Confirm';
import { startTracking, stopTracking } from '@/lib/tracker';
import type { TeamMember } from '@/data/team';

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function bucket(t: Task): 'overdue' | 'today' | 'upcoming' {
  const due = startOfDay(new Date(t.dueDate)).getTime();
  const today = startOfDay(new Date()).getTime();
  return due < today ? 'overdue' : due === today ? 'today' : 'upcoming';
}

export default function Home() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, viewAs } = useAuth();
  const t = useT();
  const { confirm } = useConfirm();
  const hour = new Date().getHours();
  const greet = hour < 12 ? t('greet.morning') : hour < 17 ? t('greet.afternoon') : t('greet.evening');

  const caps = capabilitiesOf(user, viewAs);
  const isTeam = caps.tier === 'team';

  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [snapshot, setSnapshot] = useState<api.OrgSnapshot | null>(null);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [clock, setClock] = useState<{ in: boolean; time?: string; place?: string }>({ in: false });
  const [clocking, setClocking] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  // Live "on duty" timer — refresh every 30s while clocked in.
  useEffect(() => {
    if (!clock.in) return;
    setNowTick(Date.now());
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, [clock.in, clock.time]);

  const onDutyFor = (since?: string) => {
    if (!since) return '';
    const mins = Math.max(0, Math.floor((nowTick - new Date(since).getTime()) / 60000));
    return mins < 60 ? `${mins}m on duty` : `${Math.floor(mins / 60)}h ${mins % 60}m on duty`;
  };

  const todayKey = 'clock.' + new Date().toDateString();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const [tk, r, nt, saved] = await Promise.all([
      api.getTasks(capabilitiesOf(user, viewAs).tier === 'team'), api.getReminders(), api.getNotifications(), AsyncStorage.getItem(todayKey),
    ]);
    setTasks(tk); setReminders(r); setNotifs(nt);
    setUnread(nt.filter((n) => !n.read).length);
    if (saved) setClock(JSON.parse(saved));
    // Leadership data only for admin / master
    if (capabilitiesOf(user).manageTeam) {
      const [tm, snap] = await Promise.all([api.getTeam(), api.getOrgSnapshot()]);
      setTeam(tm); setSnapshot(snap);
    }
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  // Capture a GPS fix (with accuracy + reverse-geocoded place). Returns null if the
  // user denies location — we must NOT clock in/out without it (geofence needs it).
  const getFix = async (): Promise<{ lat: number; lng: number; accuracy?: number; city: string } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      let place = 'On field';
      try {
        const g = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        place = g[0]?.city || g[0]?.district || g[0]?.region || 'On field';
      } catch { place = 'Location captured'; }
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? undefined, city: place };
    } catch { return null; }
  };

  const toggleClock = async () => {
    setClocking(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    try {
      const fix = await getFix();
      // On web (no GPS / demo) allow the toggle so the flow is testable.
      const webDemo = Platform.OS === 'web' || !api.isRealSession();

      if (!fix && !webDemo) {
        setClocking(false);
        confirm({ title: 'Location needed', message: 'Turn on location to clock in or out — attendance is confirmed by GPS at the office.', confirmText: 'OK', icon: 'location' });
        return;
      }

      // Geofence pre-check (server re-validates). Skip in web/demo.
      if (fix && !webDemo) {
        const geo = await api.checkGeofence(fix.lat, fix.lng, fix.accuracy);
        if (!geo.allowed) {
          setClocking(false);
          confirm({ title: clock.in ? 'Too far to clock out' : 'Too far to clock in', message: geo.message, confirmText: 'OK', icon: 'navigate' });
          return;
        }
      }

      const coords = fix ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, city: fix.city } : {};

      if (clock.in) {
        const res = await api.clockOut(coords);
        if (res.blocked) { setClocking(false); confirm({ title: 'Too far to clock out', message: res.message || 'You must be at the office to clock out.', confirmText: 'OK', icon: 'navigate' }); return; }
        await stopTracking();
        const next = { in: false };
        setClock(next); await AsyncStorage.setItem(todayKey, JSON.stringify(next)); setClocking(false);
        return;
      }

      const res = await api.clockIn(coords);
      if (res.blocked) { setClocking(false); confirm({ title: 'Too far to clock in', message: res.message || 'You must be within the office area to clock in.', confirmText: 'OK', icon: 'navigate' }); return; }
      // Start recording the field route for this shift.
      startTracking(res.sessionId).catch(() => {});
      const next = { in: !!res.ok || webDemo, time: new Date().toISOString(), place: fix?.city || 'On field' };
      setClock(next); await AsyncStorage.setItem(todayKey, JSON.stringify(next));
      setClocking(false);
    } catch {
      setClocking(false);
    }
  };

  const completeTask = async (id: string) => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'done', steps: x.steps.map((s) => ({ ...s, done: true })) } : x)));
    await api.updateTaskStatus(id, 'done');
  };

  const open = tasks.filter((x) => x.status !== 'done');
  const overdue = open.filter((x) => bucket(x) === 'overdue');
  const dueToday = open.filter((x) => bucket(x) === 'today');
  const inProgress = open.filter((x) => x.status === 'in_progress');
  const todayAll = tasks.filter((x) => bucket(x) === 'today' || (x.status === 'done' && bucket(x) !== 'upcoming'));
  const todayDone = todayAll.filter((x) => x.status === 'done').length;
  const pct = todayAll.length ? todayDone / todayAll.length : 0;
  const focus = [...overdue, ...dueToday].slice(0, 4);
  const pendingReminders = reminders.filter((r) => !r.done).slice(0, 3);

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
            <Text style={{ color: c.text, fontSize: 21, fontWeight: '900', letterSpacing: -0.4 }}>{user?.name?.split(' ')[0] ?? 'Team'} 👋</Text>
          </View>
          <Pressable onPress={() => router.push('/notifications')} hitSlop={8} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border, marginRight: 10 }}>
            <Ionicons name="notifications-outline" size={21} color={c.text} />
            {unread > 0 && <View style={{ position: 'absolute', top: 8, right: 9, backgroundColor: c.danger, borderRadius: 9, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: c.card }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{unread}</Text>
            </View>}
          </Pressable>
          <Pressable onPress={() => router.push('/profile')} hitSlop={8}><Avatar name={user?.name ?? 'A'} size={44} /></Pressable>
        </View>

        {/* ADMIN / MASTER dashboards — completely different surfaces */}
        {!isTeam && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: 16 }}>
            {caps.tier === 'master'
              ? <MasterDashboard team={team} tasks={tasks} snapshot={snapshot} notifications={notifs} />
              : <AdminDashboard team={team} tasks={tasks} snapshot={snapshot} />}
          </View>
        )}

        {/* TEAM: task progress hero */}
        {isTeam && (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: 16 }}>
          <Pressable onPress={() => router.push('/(tabs)/tasks')} style={{ borderRadius: radius.xl, overflow: 'hidden', ...shadow(c, 2) }}>
            <Grad colors={c.gradientHero} style={{ padding: spacing.xl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{t('tasks.todayProgress')}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 6 }}>
                    <Text style={{ color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1 }}>{todayDone}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: '700', marginBottom: 6 }}>/ {todayAll.length}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 8 }}>tasks done</Text>
                  </View>
                </View>
                <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </View>
              </View>

              <View style={{ height: 9, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden', marginTop: 16 }}>
                <View style={{ height: '100%', width: `${pct * 100}%`, borderRadius: 5 }}>
                  <Grad colors={c.gradientAccent} angle="horiz" style={{ flex: 1 }} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 18, marginTop: 16 }}>
                <HeroStat label={t('tasks.overdue')} value={overdue.length} tint="#ff8f8f" />
                <HeroStat label={t('tasks.inProgress')} value={inProgress.length} tint="#7cc7ff" />
                <HeroStat label={t('tasks.today')} value={dueToday.length} tint="#ffd48a" />
              </View>
            </Grad>
          </Pressable>
        </View>
        )}

        {/* Clock-in */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: 14 }}>
          <Card style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: clock.in ? c.successSoft : c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={clock.in ? 'checkmark-circle' : 'location'} size={23} color={clock.in ? c.success : c.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>
                {clock.in ? `Clocked in · ${fmtTime(clock.time!)}` : t('home.markAttendance')}
              </Text>
              <Text style={{ color: clock.in ? c.success : c.muted, fontSize: 12.5, marginTop: 1, fontWeight: clock.in ? '600' : '400' }} numberOfLines={1}>
                {clock.in ? `${onDutyFor(clock.time)}${clock.place ? ` · ${clock.place}` : ''}` : t('home.gpsCheckin')}
              </Text>
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

        {isTeam && (<>
        {/* Quick actions */}
        <View style={{ marginTop: 22 }}>
          <View style={{ paddingHorizontal: spacing.lg }}><SectionHeader title={t('home.quickActions')} /></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 14 }}>
            <ActionTile icon="add-circle" label={t('tasks.add')} tileIndex={0} onPress={() => router.push('/task-new')} />
            <ActionTile icon="gift" label={t('act.premiumDue')} tileIndex={2} onPress={() => router.push('/premium')} />
            <ActionTile icon="logo-whatsapp" label={t('act.whatsapp')} tileIndex={4} tint={c.whatsapp} onPress={() => router.push('/whatsapp')} />
            <ActionTile icon="shield-half" label={t('tab.claims')} tileIndex={1} onPress={() => router.push('/(tabs)/claims')} />
            <ActionTile icon="calculator" label={t('act.licPlans')} tileIndex={3} onPress={() => router.push('/lic-plans')} />
            <ActionTile icon="calendar" label={t('act.calendar')} tileIndex={5} onPress={() => router.push('/calendar')} />
          </ScrollView>
        </View>

        {/* Today's tasks */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: 24 }}>
          <SectionHeader title={t('home.tasksToday')} action={t('home.viewAll')} onAction={() => router.push('/(tabs)/tasks')} />
          {focus.length === 0 ? (
            <Card><EmptyState icon="checkmark-done-circle" title={t('tasks.allClear')} subtitle={t('home.noFollowups')} /></Card>
          ) : (
            <View style={{ gap: 10 }}>
              {focus.map((task) => {
                const isOver = bucket(task) === 'overdue';
                const prog = taskProgress(task);
                return (
                  <Card key={task.id} onPress={() => router.push(`/task/${task.id}`)} padded={false} style={{ padding: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isOver ? c.dangerSoft : c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={(CATEGORY_ICON[task.category] || 'checkbox') as any} size={18} color={isOver ? c.danger : c.primary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{task.title}</Text>
                        <Text style={{ color: isOver ? c.danger : c.muted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                          {isOver ? 'Overdue' : fmtTime(task.dueDate)}{task.client ? ` · ${task.client}` : ''}
                        </Text>
                      </View>
                      <Pressable onPress={() => completeTask(task.id)} hitSlop={8} style={{ padding: 4 }}>
                        <Ionicons name="checkmark-circle-outline" size={25} color={c.success} />
                      </Pressable>
                    </View>
                    {task.steps.length > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                        <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: c.cardAlt, overflow: 'hidden' }}>
                          <View style={{ height: '100%', width: `${prog * 100}%`, backgroundColor: c.primary, borderRadius: 3 }} />
                        </View>
                        <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700' }}>{task.steps.filter((s) => s.done).length}/{task.steps.length}</Text>
                      </View>
                    )}
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        {/* Client follow-ups */}
        {pendingReminders.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: 24 }}>
            <SectionHeader title={t('home.followups')} action={t('common.seeAll')} onAction={() => router.push('/reminders')} />
            <View style={{ gap: 10 }}>
              {pendingReminders.map((r) => (
                <Card key={r.id} padded={false} style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={REMINDER_ICON[r.type] ?? 'notifications'} size={18} color={c.accent} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{r.title}</Text>
                    <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{r.subtitle}</Text>
                  </View>
                  {r.phone && (
                    <Pressable onPress={() => whatsapp(r.phone!, `Namaste ${r.clientName || ''}`)} hitSlop={6} style={{ padding: 6 }}>
                      <Ionicons name="logo-whatsapp" size={22} color={c.whatsapp} />
                    </Pressable>
                  )}
                </Card>
              ))}
            </View>
          </View>
        )}
        </>)}
      </ScrollView>
    </View>
  );
}

function HeroStat({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <View>
      <Text style={{ color: tint, fontSize: 19, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1 }}>{label}</Text>
    </View>
  );
}
