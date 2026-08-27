import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { font, spacing, useTheme } from '@/theme/theme';
import { Header, KeyboardScroll, Screen, Txt } from '@/ui/base';
import { Button, Field, Segmented } from '@/ui/controls';
import { Banner, EmptyState, useToast } from '@/ui/feedback';
import type { FeedbackTone } from '@/ui/feedback';
import { Appear } from '@/ui/motion';
import { haptics } from '@/lib/haptics';

import * as api from '@/data/api';
import type { TaskPriority } from '@/data/tasks';
import { fmtDate, fmtTime } from '@/lib/format';

/* ------------------------------------------------------------------ *
 * Edit task — Band 2 #3 (owner backlog Point 5).
 *
 * The backend PATCH /team/tasks/:id has always accepted title/details/priority/dueAt; the app only
 * ever sent {status} (complete/reopen) and {assigneeName} (transfer), so a task's title, priority or
 * due date could never be corrected after creation. This screen closes that gap by reusing the same
 * field controls as the create form.
 *
 * TWO THINGS IT MUST GET RIGHT:
 *   1. IT MUST NOT SILENTLY MOVE THE DUE DATE. The create form only offers today/tomorrow/in-a-week
 *      presets, which cannot represent an existing arbitrary due date. So Due defaults to "Keep" and
 *      the due date is sent ONLY when the user picks a new preset — an edit of the title never
 *      disturbs the timestamp. (An arbitrary in-app date picker is Point 4, next phase.)
 *   2. IT IS NOT GATED. The backend PATCH has NO ownership/role check — any staff may edit any team
 *      task — so a team member may edit the task assigned to them. Reassignment (assign-to-others) is
 *      the gated action and stays on the detail screen's Transfer control, not here.
 *
 * Prefilled from the detail screen via params (no refetch, no load flash); on save it PATCHes and
 * pops back, and the detail screen refetches on focus so the change lands there.
 * ------------------------------------------------------------------ */

type DueChoice = 'keep' | 'today' | 'tomorrow' | 'week';

/** Tasks land at 5pm on their day, matching the create form's branch cut-off. */
function dueDateFor(when: 'today' | 'tomorrow' | 'week'): Date {
  const d = new Date();
  if (when === 'tomorrow') d.setDate(d.getDate() + 1);
  if (when === 'week') d.setDate(d.getDate() + 7);
  d.setHours(17, 0, 0, 0);
  return d;
}

const isPriority = (v: unknown): v is TaskPriority => v === 'high' || v === 'medium' || v === 'low';

/** Label above, control, caption below — mirrors the create form's Group exactly. */
function Group({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Txt size={font.sub} weight="700" color={c.muted} numberOfLines={1}>{label}</Txt>
      {children}
      {hint ? <Txt size={font.cap} color={c.faint} numberOfLines={2}>{hint}</Txt> : null}
    </View>
  );
}

export default function TaskEdit() {
  const c = useTheme();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<{
    id?: string; title?: string; description?: string; client?: string;
    priority?: string; dueDate?: string;
  }>();

  const id = String(params.id ?? '');
  const originalDue = String(params.dueDate ?? '');

  const [title, setTitle] = useState(String(params.title ?? ''));
  const [titleError, setTitleError] = useState('');
  const [desc, setDesc] = useState(String(params.description ?? ''));
  const [client, setClient] = useState(String(params.client ?? ''));
  const [priority, setPriority] = useState<TaskPriority>(isPriority(params.priority) ? params.priority : 'medium');
  const [dueChoice, setDueChoice] = useState<DueChoice>('keep');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: FeedbackTone; title: string; message: string } | null>(null);

  /** The leak guard. Nothing lands on this form once it has been left. */
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);

  const pick = <T,>(set: (v: T) => void) => (v: T) => { haptics.select(); set(v); };

  const newDue = dueChoice === 'keep' ? null : dueDateFor(dueChoice);
  const dueHint = newDue
    ? `${fmtDate(newDue)} at ${fmtTime(newDue)}`
    : originalDue
      ? `Unchanged — ${fmtDate(originalDue)} at ${fmtTime(originalDue)}`
      : 'No due date set';

  const save = async () => {
    if (saving) return;

    if (!title.trim()) {
      haptics.warn();
      setTitleError('Give the task a title so it can be recognised in a list.');
      return;
    }
    setTitleError('');
    setNotice(null);
    setSaving(true);

    const res = await api.updateTask(id, {
      title: title.trim(),
      description: desc,
      client: client || '',
      priority,
      // dueDate is sent ONLY when a preset is chosen, so "Keep" preserves the exact original timestamp.
      ...(newDue ? { dueDate: newDue.toISOString() } : {}),
    });
    // The form was left while the PATCH was in the air: do not set state and do not navigate.
    if (!live.current) return;
    setSaving(false);

    if (!res.ok) {
      haptics.warn();
      setNotice({
        tone: 'warning',
        title: 'Task was not updated',
        message: res.reason === 'network'
          ? 'The change could not be sent. Check your connection and try again.'
          : 'The server did not accept the change, so nothing was altered. Try again in a moment.',
      });
      return;
    }
    haptics.success();
    toast('Task updated.', 'success');
    router.back();
  };

  // A missing id (navigated here without the task) has nothing to edit — say so instead of a blank form.
  if (!id) {
    return (
      <Screen>
        <Header title="Edit task" back />
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}>
          <EmptyState
            icon="alert-circle-outline"
            title="Nothing to edit"
            subtitle="This task could not be opened for editing. Go back and open it again."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <Header title="Edit task" back subtitle="Change the title, priority, due date or details" />

      <KeyboardScroll
        contentStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.xl }}
        bottomPad={spacing.xxl}
      >
        {notice ? (
          <Banner
            tone={notice.tone}
            title={notice.title}
            message={notice.message}
            onDismiss={() => setNotice(null)}
          />
        ) : null}

        <Appear>
          <View style={{ gap: spacing.xl }}>
            <Field
              label="Task title"
              value={title}
              onChange={(v) => { setTitle(v); if (titleError) setTitleError(''); }}
              placeholder="Collect KYC from the client"
              error={titleError}
              hint="Required. What has to happen, in a few words."
              maxLength={140}
            />
            <Field
              label="Details"
              value={desc}
              onChange={setDesc}
              placeholder="Anything the person doing this needs to know"
              multiline
            />
            <Field
              label="Client"
              value={client}
              onChange={setClient}
              placeholder="Client name"
              icon="person-outline"
              hint="Optional. Links the task to a name in the book."
            />
          </View>
        </Appear>

        {/* WHEN. Defaults to Keep so an unrelated edit never moves the due date. */}
        <Appear index={1}>
          <Group label={t('task.due')} hint={dueHint}>
            <Segmented<DueChoice>
              full
              options={[
                { key: 'keep', label: t('task.keep') },
                { key: 'today', label: t('common.today') },
                { key: 'tomorrow', label: t('tasks.tomorrow') },
                { key: 'week', label: t('task.inAWeek') },
              ]}
              value={dueChoice}
              onChange={pick<DueChoice>(setDueChoice)}
            />
          </Group>
        </Appear>

        <Appear index={2}>
          <Group label={t('task.priority')}>
            <Segmented<TaskPriority>
              full
              options={[
                { key: 'high', label: t('priority.high') },
                { key: 'medium', label: t('priority.medium') },
                { key: 'low', label: t('priority.low') },
              ]}
              value={priority}
              onChange={pick<TaskPriority>(setPriority)}
            />
          </Group>
        </Appear>
      </KeyboardScroll>

      {/* The submit, above the keyboard, at every scroll position — outside the scroller. */}
      <View style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.md,
        backgroundColor: c.bg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: c.hairline,
      }}>
        <Button label="Save changes" icon="checkmark" onPress={save} loading={saving} size="lg" full />
      </View>
    </Screen>
  );
}
