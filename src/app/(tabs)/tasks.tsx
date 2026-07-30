import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme, spacing, radius, shadow } from '@/theme/theme';
import { Card, Chips, EmptyState, Fab, Grad, Header, Loader, Pill } from '@/ui/kit';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { capabilitiesOf } from '@/store/roles';
import * as api from '@/data/api';
import { Task, TASK_STATUS, TASK_PRIORITY, CATEGORY_ICON, taskProgress } from '@/data/tasks';
import { fmtDay, fmtTime } from '@/lib/format';

type Filter = 'today' | 'overdue' | 'in_progress' | 'upcoming' | 'done';

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export function dueBucket(t: Task): 'overdue' | 'today' | 'upcoming' {
  const due = startOfDay(new Date(t.dueDate)).getTime();
  const today = startOfDay(new Date()).getTime();
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return 'upcoming';
}

export default function Tasks() {
  const c = useTheme();
  const t = useT();
  const router = useRouter();
  const { user, viewAs } = useAuth();
  const ownOnly = capabilitiesOf(user, viewAs).tier === 'team';
  const [list, setList] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('today');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setList(await api.getTasks(ownOnly));
    setLoading(false); setRefreshing(false);
  }, [ownOnly]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const counts = useMemo(() => {
    const open = list.filter((x) => x.status !== 'done');
    return {
      today: open.filter((x) => dueBucket(x) === 'today').length,
      overdue: open.filter((x) => dueBucket(x) === 'overdue').length,
      in_progress: open.filter((x) => x.status === 'in_progress').length,
      upcoming: open.filter((x) => dueBucket(x) === 'upcoming').length,
      done: list.filter((x) => x.status === 'done').length,
    };
  }, [list]);

  const filtered = useMemo(() => {
    const open = list.filter((x) => x.status !== 'done');
    if (filter === 'done') return list.filter((x) => x.status === 'done');
    if (filter === 'in_progress') return open.filter((x) => x.status === 'in_progress');
    return open.filter((x) => dueBucket(x) === filter);
  }, [list, filter]);

  // Today's completion = today's tasks done vs all of today's tasks
  const todayAll = list.filter((x) => dueBucket(x) === 'today' || (x.status === 'done' && dueBucket(x) !== 'upcoming'));
  const todayDone = todayAll.filter((x) => x.status === 'done').length;
  const pct = todayAll.length ? todayDone / todayAll.length : 0;

  const quickDone = async (task: Task) => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    setList((prev) => prev.map((x) => (x.id === task.id ? { ...x, status: 'done', steps: x.steps.map((s) => ({ ...s, done: true })) } : x)));
    await api.updateTaskStatus(task.id, 'done');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t('tasks.title')} subtitle={`${counts.today + counts.overdue} ${t('tasks.dueNow')} · ${counts.done} ${t('tasks.doneLabel')}`} />

      {loading ? <Loader /> : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 4, paddingBottom: 110, gap: spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={c.primary} />}
          showsVerticalScrollIndicator={false}>

          {/* Progress hero */}
          <View style={{ borderRadius: radius.xl, overflow: 'hidden', ...shadow(c, 2) }}>
            <Grad colors={c.gradientHero} style={{ padding: spacing.xl }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{t('tasks.todayProgress')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 6 }}>
                <Text style={{ color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1 }}>{todayDone}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: '700', marginBottom: 6 }}>/ {todayAll.length || 0}</Text>
                <View style={{ flex: 1 }} />
                <View style={{ backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{Math.round(pct * 100)}%</Text>
                </View>
              </View>
              <View style={{ height: 9, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden', marginTop: 16 }}>
                <View style={{ height: '100%', width: `${pct * 100}%`, borderRadius: 5 }}>
                  <Grad colors={c.gradientAccent} angle="horiz" style={{ flex: 1 }} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 16 }}>
                <HeroStat label={t('tasks.overdue')} value={counts.overdue} tint="#ff8f8f" />
                <HeroStat label={t('tasks.inProgress')} value={counts.in_progress} tint="#7cc7ff" />
                <HeroStat label={t('tasks.upcoming')} value={counts.upcoming} tint="#ffd48a" />
              </View>
            </Grad>
          </View>

          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Chips
              options={[
                { key: 'today' as Filter, label: t('tasks.today'), count: counts.today },
                { key: 'overdue' as Filter, label: t('tasks.overdue'), count: counts.overdue },
                { key: 'in_progress' as Filter, label: t('tasks.inProgress'), count: counts.in_progress },
                { key: 'upcoming' as Filter, label: t('tasks.upcoming'), count: counts.upcoming },
                { key: 'done' as Filter, label: t('tasks.doneLabel'), count: counts.done },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </ScrollView>

          {/* List */}
          {filtered.length === 0 ? (
            <Card><EmptyState icon="checkmark-done-circle" title={t('tasks.allClear')} subtitle={t('tasks.nothingHere')} /></Card>
          ) : (
            <View style={{ gap: 10 }}>
              {filtered.map((task) => (
                <TaskCard key={task.id} task={task} onPress={() => router.push(`/task/${task.id}`)} onDone={() => quickDone(task)} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <Fab icon="add" label={t('tasks.add')} onPress={() => router.push('/task-new')} />
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

export function TaskCard({ task, onPress, onDone }: { task: Task; onPress: () => void; onDone?: () => void }) {
  const c = useTheme();
  const st = TASK_STATUS[task.status];
  const pr = TASK_PRIORITY[task.priority];
  const prog = taskProgress(task);
  const bucket = dueBucket(task);
  const overdue = bucket === 'overdue' && task.status !== 'done';
  const prTint = task.priority === 'high' ? c.danger : task.priority === 'medium' ? c.warning : c.faint;

  return (
    <Card onPress={onPress} padded={false} style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 4, backgroundColor: prTint }} />
        <View style={{ flex: 1, padding: 13 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={(CATEGORY_ICON[task.category] || 'checkbox') as any} size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 14.5, textDecorationLine: task.status === 'done' ? 'line-through' : 'none' }} numberOfLines={2}>{task.title}</Text>
              <Text style={{ color: overdue ? c.danger : c.muted, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                {overdue ? 'Overdue · ' : ''}{fmtDay(task.dueDate)} · {fmtTime(task.dueDate)}{task.client ? ` · ${task.client}` : ''}
              </Text>
            </View>
            {onDone && task.status !== 'done' && (
              <Pressable onPress={onDone} hitSlop={8} style={{ padding: 2 }}>
                <Ionicons name="checkmark-circle-outline" size={26} color={c.success} />
              </Pressable>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <Pill label={st.label} tone={st.tone} small />
            <Pill label={pr.label} tone={pr.tone} small />
            <Pill label={task.category} tone="neutral" small />
          </View>

          {task.steps.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.cardAlt, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${prog * 100}%`, backgroundColor: prog === 1 ? c.success : c.primary, borderRadius: 3 }} />
              </View>
              <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700' }}>{task.steps.filter((s) => s.done).length}/{task.steps.length}</Text>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}
