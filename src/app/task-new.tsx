import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing } from '@/theme/theme';
import { Button, Chips, Field, Header } from '@/ui/kit';
import { useConfirm } from '@/ui/Confirm';
import * as api from '@/data/api';
import type { TaskPriority } from '@/data/tasks';

const CATEGORIES = ['Follow-up', 'Claim', 'Renewal', 'Meeting', 'Documentation', 'Collection', 'Training', 'General'];

export default function TaskNew() {
  const c = useTheme();
  const router = useRouter();
  const { toast, confirm } = useConfirm();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [client, setClient] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [category, setCategory] = useState('Follow-up');
  const [when, setWhen] = useState<'today' | 'tomorrow' | 'week'>('today');
  const [assignee, setAssignee] = useState('Unassigned');
  const [members, setMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getTeam().then((t) => setMembers(['Unassigned', ...t.map((m) => m.name).slice(0, 20)])).catch(() => setMembers(['Unassigned']));
  }, []);

  const save = async () => {
    if (!title.trim()) { toast('Add a task title.'); return; }
    setSaving(true);
    const d = new Date();
    if (when === 'tomorrow') d.setDate(d.getDate() + 1);
    if (when === 'week') d.setDate(d.getDate() + 7);
    d.setHours(17, 0, 0, 0);
    const created = await api.addTask({
      title, description: desc, client: client || undefined, priority, category,
      dueDate: d.toISOString(), assigneeName: assignee !== 'Unassigned' ? assignee : undefined,
    });
    setSaving(false);
    if ((created as any).forbidden) {
      confirm({ title: 'Not allowed', message: 'Your account can’t create tasks. This needs an admin, leader, or super-admin role.', confirmText: 'OK', icon: 'lock-closed' });
      return;
    }
    toast(assignee !== 'Unassigned' ? `Task assigned to ${assignee}.` : 'Task created.');
    router.replace(`/task/${created.id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="New task" back />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Field label="Task title *" value={title} onChange={setTitle} placeholder="e.g. Collect KYC from Rameshbhai" />
          <Field label="Details" value={desc} onChange={setDesc} placeholder="What needs to be done?" multiline />
          <Field label="Client (optional)" value={client} onChange={setClient} placeholder="Client name" />

          {members.length > 1 && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: c.muted, fontSize: 13, fontWeight: '700' }}>Assign to</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Chips options={members.map((m) => ({ key: m, label: m }))} value={assignee} onChange={setAssignee} />
              </ScrollView>
            </View>
          )}

          <View style={{ gap: 8 }}>
            <Text style={{ color: c.muted, fontSize: 13, fontWeight: '700' }}>Priority</Text>
            <Chips options={[{ key: 'high' as TaskPriority, label: 'High' }, { key: 'medium' as TaskPriority, label: 'Medium' }, { key: 'low' as TaskPriority, label: 'Low' }]} value={priority} onChange={setPriority} />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ color: c.muted, fontSize: 13, fontWeight: '700' }}>Due</Text>
            <Chips options={[{ key: 'today' as const, label: 'Today' }, { key: 'tomorrow' as const, label: 'Tomorrow' }, { key: 'week' as const, label: 'In a week' }]} value={when} onChange={setWhen} />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ color: c.muted, fontSize: 13, fontWeight: '700' }}>Category</Text>
            <Chips options={CATEGORIES.map((x) => ({ key: x, label: x }))} value={category} onChange={setCategory} />
          </View>

          <Button label="Create task" icon="checkmark" onPress={save} loading={saving} size="lg" full />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
