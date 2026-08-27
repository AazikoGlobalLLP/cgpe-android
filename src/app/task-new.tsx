import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Header, KeyboardScroll, Row, Screen, Txt } from '@/ui/base';
import { Button, Chips, Field, Segmented, SearchBar } from '@/ui/controls';
import { Banner, EmptyState, Skeleton, useToast } from '@/ui/feedback';
import type { FeedbackTone } from '@/ui/feedback';
import { Avatar, PersonRow } from '@/ui/identity';
import { Sheet } from '@/ui/sheet';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';

import * as api from '@/data/api';
import type { TaskPriority } from '@/data/tasks';
import { filterMembers } from '@/data/team';
import type { TeamMember } from '@/data/team';
import { fmtDate, fmtTime } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { useAppUi } from '@/store/appUi';
import { capabilitiesOf } from '@/store/roles';

/* ------------------------------------------------------------------ *
 * New task — the app's main data-entry screen.
 *
 * FOUR THINGS A FORM ON A PHONE HAS TO GET RIGHT, and what each costs when it is wrong:
 *
 *   1. THE SUBMIT MUST NEVER HIDE BEHIND THE KEYBOARD. `<Screen keyboard>` plus a footer
 *      bar outside the scroller: the button is on screen at every scroll position and with
 *      the keyboard up. Chasing a button down a scroll view is how half-filled forms get
 *      abandoned. The FIELDS need the other half of that pair, `<KeyboardScroll>`: shrinking
 *      the container alone just clips a field that sits below the fold, so the content has
 *      to scroll by the keyboard's height as well. iOS gets there through
 *      automaticallyAdjustKeyboardInsets (the keyboard overlays the window, so the scroller
 *      takes a matching bottom inset); Android through the resized window, where
 *      ReactScrollView pulls the focused input back into view itself. Different mechanism,
 *      same result on both.
 *   2. LABELS ABOVE, ERRORS BELOW. Every control names itself before it is touched, and a
 *      rejection appears attached to the field that caused it, not in a modal that has to
 *      be dismissed before the field can be corrected.
 *   3. PICK, DO NOT TYPE. Priority, due date and category are closed sets, so they are
 *      Segmented and Chips. The assignee is an open set of real people, so it is a sheet
 *      with faces in it rather than a horizontal chip rail that hid names past the edge.
 *   4. THE DATE IS SHOWN, NOT IMPLIED. "In a week" resolves to a real date under the
 *      control, because "week" means different things on a Friday and a Monday.
 *
 * A REFUSAL IS NOT AN ERROR DIALOG. The backend rejects task creation for accounts without
 * the role, which is a normal, explainable condition; it raises an inline Banner that names
 * the missing role instead of a modal that says "Not allowed" and blocks the form.
 *
 * THE ROSTER FETCH AND THE SAVE ARE BOTH CANCELLABLE. A form is the screen a user is most
 * likely to abandon mid-request, by backing out or by hitting the hardware back button
 * while the POST is in flight, so neither the roster read nor the save may touch state once
 * this screen is gone.
 * ------------------------------------------------------------------ */

const CATEGORIES = ['Follow-up', 'Claim', 'Renewal', 'Meeting', 'Documentation', 'Collection', 'Training', 'General'];

const UNASSIGNED = 'Unassigned';

type When = 'today' | 'tomorrow' | 'week';

/** Tasks land at 5pm on their day, matching the branch cut-off the old form used. */
function dueDateFor(when: When): Date {
  const d = new Date();
  if (when === 'tomorrow') d.setDate(d.getDate() + 1);
  if (when === 'week') d.setDate(d.getDate() + 7);
  d.setHours(17, 0, 0, 0);
  return d;
}

/** Label above, control, caption below. Matches Field's own label metrics exactly. */
function Group({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Txt size={font.sub} weight="700" color={c.muted} numberOfLines={1}>{label}</Txt>
      {children}
      {hint ? <Txt size={font.cap} color={c.faint} numberOfLines={2}>{hint}</Txt> : null}
    </View>
  );
}

export default function TaskNew() {
  const c = useTheme();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const health = useDataHealth();
  const { user, viewAs } = useAuth();
  const { ready: uiReady, can } = useAppUi();
  // Band 2 #3 (Point 5): the backend 403s a team-tier advisor on ANY create (team.js:384). This
  // screen is now reached only by an entitled tier (the Tasks tab / Home hide the create affordances
  // for team), but a deep-link or older entry could still land here — so we ALSO guard at the entry
  // (below) and show an honest "can't create" state instead of a form that only fails at submit.
  const canCreateTask = capabilitiesOf(user, viewAs).assignTasks && (uiReady ? can('can_create_task') !== false : true);

  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [desc, setDesc] = useState('');
  const [client, setClient] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [category, setCategory] = useState('Follow-up');
  const [when, setWhen] = useState<When>('today');
  const [assignee, setAssignee] = useState(UNASSIGNED);
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: FeedbackTone; title: string; message: string } | null>(null);

  /** The leak guard. Nothing lands on this form once it has been left. */
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);

  useEffect(() => {
    if (!canCreateTask) return;   // a non-creator gets the entry guard below — no roster needed
    let alive = true;
    (async () => {
      // Band 2 #3: assign from the staff DIRECTORY, not the task-derived roster, so a colleague
      // with no task yet is still assignable (getTeam missed them for a plain admin).
      const roster = await api.getAssignableTeam().catch(() => [] as TeamMember[]);
      if (!alive) return;
      setMembers(roster.filter((m) => !!m.name));
    })();
    return () => { alive = false; };
  }, [canCreateTask]);

  const due = dueDateFor(when);

  const pick = <T,>(set: (v: T) => void) => (v: T) => { haptics.select(); set(v); };

  const choose = (name: string) => {
    haptics.select();
    setAssignee(name);
    setPickerOpen(false);
    setPickerQuery('');
  };

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

    const created = await api.addTask({
      title,
      description: desc,
      client: client || undefined,
      priority,
      category,
      dueDate: due.toISOString(),
      assigneeName: assignee !== UNASSIGNED ? assignee : undefined,
    });
    // The form was left while the POST was in the air. The record may well have been
    // created, but this screen is gone: it must not set state and must not navigate.
    if (!live.current) return;
    setSaving(false);

    // PHASE 57b — four honest outcomes, no fabricated success. A 403, and a server refusal, each say
    // so; a network failure is QUEUED (offline draft) with a neutral toast, never the success buzz.
    if (created.status === 'forbidden') {
      haptics.warn();
      setNotice({
        tone: 'warning',
        title: 'This account cannot create tasks',
        message: 'Creating work for the team needs an admin, leader, or super admin role. Ask your branch admin to raise it, or ask them to add the task.',
      });
      return;
    }

    if (created.status === 'failed') {
      haptics.error();
      setNotice({
        tone: 'warning',
        title: 'Task was not created',
        message: 'The server refused the request, so nothing was added. Check the details and try again in a moment.',
      });
      return;
    }

    if (created.status === 'queued') {
      haptics.tap();   // a neutral acknowledgement, never the success buzz — it isn't on the server yet
      toast("Saved on this device — it'll sync when you're back online.", 'offline');
      router.replace('/(tabs)/tasks');   // the Tasks tab shows it with a "Pending sync" badge
      return;
    }

    // created.status === 'saved' — the server accepted it.
    haptics.success();
    toast(assignee !== UNASSIGNED ? `Task assigned to ${assignee}.` : 'Task created.', 'success');
    router.replace(`/task/${created.task.id}`);
  };

  const roster = members ?? [];
  // Band 2 #3 review fix: the assignable roster is now the FULL staff directory, so filter it by the
  // picker's search box and cap the render — an entitled user can reach any colleague, and the list is
  // never silently truncated (a hint names the overflow). Blank query returns the roster by reference.
  const ROSTER_CAP = 40;
  const filteredRoster = filterMembers(roster, pickerQuery);
  const shownRoster = filteredRoster.slice(0, ROSTER_CAP);
  const rosterSearchable = !!members && roster.length > 8;

  // Band 2 #3 — the entry guard. A team-tier advisor who reaches this screen (deep link / stale
  // entry) sees an honest refusal immediately, not a full form that only 403s at submit.
  if (!canCreateTask) {
    return (
      <Screen>
        <Header title="New task" back />
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}>
          <EmptyState
            icon="lock-closed-outline"
            title="Only admins can create tasks"
            subtitle="Creating work for the team needs an admin, leader, or super admin role. Ask your branch admin to add the task, or to raise your access."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <Header title="New task" back subtitle="Assign work to yourself or the team" />

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

        {/* WHO. An open set of real people, so it opens a sheet with faces in it. */}
        <Appear index={1}>
          <Group label="Assign to" hint={assignee === UNASSIGNED ? 'Nobody is assigned yet. The task stays on your own list.' : undefined}>
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Assign to. Currently ${assignee}`}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                height: 50, paddingHorizontal: 15,
                backgroundColor: pressed ? c.cardAlt : c.card,
                borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
              }]}
            >
              {assignee === UNASSIGNED ? (
                <Ionicons name="person-add-outline" size={19} color={c.faint} />
              ) : (
                <Avatar name={assignee} size={30} />
              )}
              <Txt size={font.body} weight="500" color={assignee === UNASSIGNED ? c.faint : c.text}
                numberOfLines={1} style={{ flex: 1 }}>
                {assignee === UNASSIGNED ? 'Nobody yet' : assignee}
              </Txt>
              <Ionicons name="chevron-down" size={18} color={c.faint} />
            </Pressable>
          </Group>
        </Appear>

        {/* WHEN. Closed set, and the choice resolves to a real date underneath. */}
        <Appear index={2}>
          <Group label="Due" hint={`${fmtDate(due)} at ${fmtTime(due)}`}>
            <Segmented<When>
              full
              options={[
                { key: 'today', label: t('common.today') },
                { key: 'tomorrow', label: t('tasks.tomorrow') },
                { key: 'week', label: 'In a week' },
              ]}
              value={when}
              onChange={pick<When>(setWhen)}
            />
          </Group>
        </Appear>

        <Appear index={3}>
          <Group label="Priority">
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

        <Appear index={4}>
          <Group label="Category">
            <Chips
              options={CATEGORIES.map((x) => ({ key: x, label: x }))}
              value={category}
              onChange={pick<string>(setCategory)}
            />
          </Group>
        </Appear>
      </KeyboardScroll>

      {/* The submit, above the keyboard, at every scroll position. It sits OUTSIDE the
          scroller, so on iOS the Screen's KeyboardAvoidingView lifts it and on Android the
          resized window does — the bar never needs scrolling to. */}
      <View style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.md,
        backgroundColor: c.bg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: c.hairline,
      }}>
        <Button label="Create task" icon="checkmark" onPress={save} loading={saving} size="lg" full />
      </View>

      {/* ---------- assignee picker ---------- */}
      <Sheet
        visible={pickerOpen}
        onClose={() => { setPickerOpen(false); setPickerQuery(''); }}
        title="Assign to"
        subtitle={assignee === UNASSIGNED ? 'Leave it unassigned to keep it on your own list' : `Currently ${assignee}`}
      >
        <View style={{ paddingTop: spacing.xs }}>
          {/* Search — shown only when the roster is large enough to need narrowing. The sheet's own
              ScrollView carries keyboardShouldPersistTaps, so the first tap on a result still lands. */}
          {rosterSearchable ? (
            <View style={{ marginBottom: spacing.md }}>
              <SearchBar
                value={pickerQuery}
                onChange={setPickerQuery}
                onSubmit={() => {}}
                placeholder="Search colleagues"
              />
            </View>
          ) : null}

          {/* Unassigned — hidden while searching for a specific person. */}
          {!pickerQuery.trim() ? (
            <Pressable
              onPress={() => choose(UNASSIGNED)}
              accessibilityRole="button"
              accessibilityLabel="Leave unassigned"
              accessibilityState={{ selected: assignee === UNASSIGNED }}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                minHeight: 56, paddingVertical: spacing.sm + 2,
                paddingHorizontal: spacing.sm, marginHorizontal: -spacing.sm,
                borderRadius: radius.md,
                backgroundColor: pressed ? c.cardAlt : 'transparent',
              }]}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 44 / 2.6, backgroundColor: c.cardAlt,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="person-outline" size={20} color={c.faint} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt size={font.body} weight="700" numberOfLines={1}>Leave unassigned</Txt>
                <Txt size={font.sub} color={c.muted} numberOfLines={1} style={{ marginTop: 2 }}>
                  Stays on your own list
                </Txt>
              </View>
              {assignee === UNASSIGNED ? <Ionicons name="checkmark" size={19} color={c.primary} /> : null}
            </Pressable>
          ) : null}

          {members === null ? (
            <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
              {[0, 1, 2, 3].map((i) => (
                <Row key={i} style={{ gap: spacing.md }}>
                  <Skeleton width={44} height={44} radius={44 / 2.6} />
                  <View style={{ flex: 1, gap: 7 }}>
                    <Skeleton width="54%" height={12} />
                    <Skeleton width="36%" height={10} />
                  </View>
                </Row>
              ))}
            </View>
          ) : roster.length === 0 ? (
            <EmptyState
              icon={health.degraded ? 'cloud-offline-outline' : 'people-outline'}
              title={health.degraded ? 'The roster did not load' : 'No team members yet'}
              subtitle={health.degraded
                ? 'The server could not be reached, so this list is not confirmed. The task can still be created unassigned.'
                : 'There is nobody else on your roster, so this task can only stay on your own list.'}
            />
          ) : shownRoster.length === 0 ? (
            <EmptyState
              icon="search-outline"
              title={`No colleague matches "${pickerQuery.trim()}"`}
              subtitle="Try a shorter piece of the name, or clear the search to see everyone."
            />
          ) : (
            <>
              {shownRoster.map((m) => (
                <PersonRow
                  key={m.id}
                  name={m.name}
                  subtitle={m.branch || m.role}
                  onPress={() => choose(m.name)}
                  right={m.name === assignee
                    ? <Ionicons name="checkmark" size={19} color={c.primary} />
                    : undefined}
                  chevron={m.name !== assignee}
                  style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline }}
                />
              ))}
              {filteredRoster.length > ROSTER_CAP ? (
                <Txt size={font.sub} color={c.faint} style={{ paddingVertical: spacing.md, textAlign: 'center' }}>
                  {`Showing ${ROSTER_CAP} of ${filteredRoster.length} — search by name to find more`}
                </Txt>
              ) : null}
            </>
          )}
        </View>
      </Sheet>
    </Screen>
  );
}
