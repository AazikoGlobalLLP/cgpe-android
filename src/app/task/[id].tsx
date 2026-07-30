import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Button, Card, EmptyState, Header, Loader, Pill, SectionHeader } from '@/ui/kit';
import { useConfirm } from '@/ui/Confirm';
import * as api from '@/data/api';
import { Task, TaskStatus, TASK_STATUS, TASK_PRIORITY, CATEGORY_ICON, taskProgress } from '@/data/tasks';
import { fmtDate, fmtTime } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';

const FLOW: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];

export default function TaskDetail() {
  const c = useTheme();
  const router = useRouter();
  const { toast, choose } = useConfirm();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Transfer this task to another team member (any member may do this).
  const transfer = async () => {
    if (!task) return;
    setBusy(true);
    const team = await api.getTeam().catch(() => []);
    setBusy(false);
    const current = (task as any).assignee;
    const options = team.filter((m) => m.name && m.name !== current).slice(0, 24).map((m) => ({ label: m.name, value: m.name, icon: 'person' as const }));
    if (!options.length) { toast('No other team members to transfer to.'); return; }
    const to = await choose<string>('Transfer task to…', options);
    if (!to) return;
    setBusy(true);
    const ok = await api.reassignTask(task.id, to);
    setBusy(false);
    if (ok) { toast(`Task transferred to ${to}.`); setTimeout(() => router.back(), 600); }
    else toast('Could not transfer the task. Please try again.');
  };

  // Contact the client — use the phone on the task, else resolve it from the book.
  const contactClient = async () => {
    if (!task) return;
    let phone = task.clientPhone || '';
    let clientId = '';
    let name = task.client || 'Client';
    if (!phone && task.client) {
      setBusy(true);
      const page = await api.getClientsPage(1, task.client).catch(() => ({ items: [] as any[] }));
      setBusy(false);
      const match = (page.items || []).find((cl: any) => cl.phone) || (page.items || [])[0];
      if (match) { phone = match.phone; clientId = match.id; name = match.name; }
    }
    const opts: { label: string; value: string; icon: any }[] = [];
    if (phone) { opts.push({ label: 'Call', value: 'call', icon: 'call' }); opts.push({ label: 'WhatsApp', value: 'wa', icon: 'logo-whatsapp' }); }
    if (clientId) opts.push({ label: 'Open client profile', value: 'open', icon: 'person-circle' });
    if (!opts.length) { toast('No contact number on file for this client.'); return; }
    const how = await choose<string>(`Contact ${name}`, opts);
    if (how === 'call') call(phone);
    else if (how === 'wa') whatsapp(phone);
    else if (how === 'open' && clientId) router.push(`/client/${clientId}`);
  };

  const load = useCallback(async () => {
    const t = await api.getTask(String(id));
    setTask(t ?? null); setLoading(false);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleStep = async (stepId: string) => {
    if (!task) return;
    try { Haptics.selectionAsync(); } catch {}
    const steps = task.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s));
    const allDone = steps.every((s) => s.done);
    setTask({ ...task, steps, status: allDone ? 'done' : task.status === 'todo' ? 'in_progress' : task.status });
    await api.toggleTaskStep(task.id, stepId);
  };

  const setStatus = async (s: TaskStatus) => {
    if (!task) return;
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    setTask({ ...task, status: s, steps: s === 'done' ? task.steps.map((x) => ({ ...x, done: true })) : task.steps });
    await api.updateTaskStatus(task.id, s);
    if (s === 'done') { toast('Task completed ✓'); setTimeout(() => router.back(), 700); }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Task" back /><Loader /></View>;
  if (!task) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Task" back /><EmptyState icon="alert-circle-outline" title="Task not found" /></View>;

  const st = TASK_STATUS[task.status];
  const pr = TASK_PRIORITY[task.priority];
  const prog = taskProgress(task);
  const doneSteps = task.steps.filter((s) => s.done).length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={task.category} back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }} showsVerticalScrollIndicator={false}>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={(CATEGORY_ICON[task.category] || 'checkbox') as any} size={21} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', lineHeight: 24 }}>{task.title}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <Pill label={st.label} tone={st.tone} small />
                <Pill label={`${pr.label} priority`} tone={pr.tone} small />
              </View>
            </View>
          </View>

          {task.description ? <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20, marginTop: 14 }}>{task.description}</Text> : null}

          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.hairline, gap: 8 }}>
            <Meta icon="time-outline" label="Due" value={`${fmtDate(task.dueDate)} · ${fmtTime(task.dueDate)}`} />
            <Meta icon="person-outline" label="Assigned by" value={task.assignedBy} />
            {task.client ? <Meta icon="people-outline" label="Client" value={task.client} /> : null}
          </View>

          {task.clientPhone ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Button label="Call" icon="call" variant="secondary" onPress={() => call(task.clientPhone!)} style={{ flex: 1 }} />
              <Button label="WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={() => whatsapp(task.clientPhone!)} style={{ flex: 1 }} />
            </View>
          ) : task.client ? (
            <View style={{ marginTop: 14 }}>
              <Button label="Contact client" icon="call" variant="secondary" onPress={contactClient} loading={busy} full />
            </View>
          ) : null}
        </Card>

        {/* Transfer to another team member */}
        <Card onPress={transfer} padded={false} style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="swap-horizontal" size={20} color={c.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 14.5 }}>Transfer task</Text>
            <Text style={{ color: c.muted, fontSize: 12.5, marginTop: 1 }}>{(task as any).assignee ? `Currently: ${(task as any).assignee}` : 'Hand this task to another team member'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.faint} />
        </Card>

        {/* Workflow steps */}
        {task.steps.length > 0 && (
          <View>
            <SectionHeader title={`Workflow · ${doneSteps}/${task.steps.length}`} />
            <Card padded={false} style={{ padding: 4 }}>
              <View style={{ paddingHorizontal: 10, paddingTop: 8 }}>
                <View style={{ height: 7, borderRadius: 4, backgroundColor: c.cardAlt, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${prog * 100}%`, backgroundColor: prog === 1 ? c.success : c.primary, borderRadius: 4 }} />
                </View>
              </View>
              {task.steps.map((s, i) => (
                <Pressable key={s.id} onPress={() => toggleStep(s.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 13, borderBottomWidth: i === task.steps.length - 1 ? 0 : 1, borderBottomColor: c.hairline }}>
                  <Ionicons name={s.done ? 'checkmark-circle' : 'ellipse-outline'} size={23} color={s.done ? c.success : c.faint} />
                  <Text style={{ color: s.done ? c.muted : c.text, fontSize: 14.5, marginLeft: 12, flex: 1, textDecorationLine: s.done ? 'line-through' : 'none' }}>{s.label}</Text>
                </Pressable>
              ))}
            </Card>
          </View>
        )}

        {/* Status */}
        <View>
          <SectionHeader title="Status" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {FLOW.map((s) => {
              const active = task.status === s;
              return (
                <Pressable key={s} onPress={() => setStatus(s)}
                  style={{ paddingHorizontal: 16, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.primary : c.card, borderWidth: 1, borderColor: active ? c.primary : c.border }}>
                  <Text style={{ color: active ? c.onPrimary : c.muted, fontWeight: '700', fontSize: 13 }}>{TASK_STATUS[s].label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {task.status !== 'done' && <Button label="Mark task complete" icon="checkmark-done" full onPress={() => setStatus('done')} />}
      </ScrollView>
    </View>
  );
}

function Meta({ icon, label, value }: { icon: any; label: string; value: string }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Ionicons name={icon} size={16} color={c.faint} />
      <Text style={{ color: c.muted, fontSize: 13, flex: 1 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
