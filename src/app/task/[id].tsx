import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Header, Row, Screen, SectionHeader, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Button, IconBtn, SearchBar } from '@/ui/controls';
import { Banner, EmptyState, Meter, Skeleton, SkeletonText, useToast } from '@/ui/feedback';
import type { FeedbackTone } from '@/ui/feedback';
import { DataRow, ListSection, Pill } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { Sheet } from '@/ui/sheet';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';

import * as api from '@/data/api';
import { CATEGORY_ICON, Task, TaskStatus, TASK_PRIORITY, TASK_STATUS, taskProgress } from '@/data/tasks';
import { filterMembers } from '@/data/team';
import type { TeamMember } from '@/data/team';
import type { Client } from '@/data/types';
import { fmtDate, fmtTime } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { capabilitiesOf } from '@/store/roles';

/* ------------------------------------------------------------------ *
 * Task detail — the workflow screen.
 *
 * This is where a task is actually WORKED, so the checklist is the subject and everything
 * else is context. Three decisions shape the layout:
 *
 *   1. THE PRIMARY ACTION IS PINNED. "Mark task complete" used to sit at the bottom of a
 *      scroll, so on a task with a description and eight steps it was off screen at the
 *      moment it was needed. It now lives in a footer bar, permanently inside thumb reach.
 *   2. STATUS MOVES THROUGH A SHEET, not a row of pills. Four statuses laid out as chips
 *      read as filters and invite an accidental tap that writes to the server; a sheet
 *      makes the change deliberate and has room to say what each status means.
 *   3. FACTS ARE GROUPED, NOT STACKED. Due date, owner and client are hairline-separated
 *      rows in one card rather than four cards with four shadows. The phone number is
 *      copyable because otherwise it gets typed out by hand.
 *
 * WRITES ARE OPTIMISTIC AND REVERSIBLE. `updateTaskStatus` can come back 403 when the task
 * belongs to someone else; the state is put back and a Banner explains it rather than
 * leaving a tick the server never accepted.
 *
 * NOTHING OUTLIVES THE SCREEN. Every await is followed by a `live.current` check before it
 * touches state, and the two "leave in a moment" delays that let a success toast be read
 * are held in a ref and cleared on unmount. An orphaned `router.back()` firing after the
 * user has already navigated somewhere else pops the WRONG screen out from under them,
 * which is a far worse bug than the missing animation it was added to smooth over.
 * ------------------------------------------------------------------ */

const FLOW: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];

const STATUS_NOTE: Record<TaskStatus, string> = {
  todo: 'Not started yet.',
  in_progress: 'Being worked on right now.',
  blocked: 'Waiting on someone else or on a document.',
  done: 'Finished. Every step is ticked.',
};

/** Long enough for a success toast to be read, short enough to feel like one gesture. */
const LEAVE_AFTER_DONE = 700;
const LEAVE_AFTER_TRANSFER = 600;

/** `assignee` rides along on the adapted team task but is not on the Task type. */
const assigneeOf = (t: Task): string => String((t as unknown as { assignee?: string }).assignee || '').trim();

/* ---------- loading ----------
 * Shaped like the real screen so nothing jumps when the task lands. */
function DetailSkeleton() {
  const c = useTheme();
  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Skeleton width={44} height={44} radius={14} />
          <View style={{ flex: 1, gap: 9 }}>
            <Skeleton width="86%" height={16} />
            <Skeleton width="58%" height={16} />
            <Row style={{ gap: 6, marginTop: 2 }}>
              <Skeleton width={68} height={20} radius={radius.pill} />
              <Skeleton width={86} height={20} radius={radius.pill} />
            </Row>
          </View>
        </Row>
        <SkeletonText lines={2} lineHeight={11} style={{ marginTop: spacing.lg }} />
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Skeleton width="28%" height={10} />
        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            {[0, 1, 2].map((i) => (
              <Row key={i}>
                <Skeleton width="34%" height={12} />
                <View style={{ flex: 1 }} />
                <Skeleton width="40%" height={12} />
              </Row>
            ))}
          </View>
        </Card>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Skeleton width="34%" height={13} />
        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <Skeleton width="100%" height={10} radius={5} />
            {[0, 1, 2].map((i) => (
              <Row key={i} style={{ gap: spacing.md }}>
                <Skeleton width={24} height={24} radius={12} />
                <Skeleton width="62%" height={12} />
              </Row>
            ))}
          </View>
        </Card>
      </View>

      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline }} />
    </View>
  );
}

export default function TaskDetail() {
  const c = useTheme();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const health = useDataHealth();
  const { user, viewAs } = useAuth();
  // Band 2 #3 (Point 5): reassignment is an assign-to-others action. A team-tier advisor has no
  // roster to transfer to (the directory endpoints 403 them) and the RBAC config sets
  // can_assign_task_to_others:false for team, so the transfer affordance is shown only to entitled
  // tiers (admin/leader/master). EDIT is NOT gated — the backend PATCH has no ownership gate, so a
  // member may edit the task assigned to them.
  const canAssign = capabilitiesOf(user, viewAs).assignTasks;
  const { id } = useLocalSearchParams<{ id: string }>();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: FeedbackTone; title: string; message: string } | null>(null);

  const [statusOpen, setStatusOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferQuery, setTransferQuery] = useState('');
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contact, setContact] = useState<{ name: string; phone: string; clientId: string } | null>(null);

  /** The leak guard for every await on this screen. */
  const live = useRef(true);
  /** The single deferred navigation. Held so unmount can cancel it. */
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    };
  }, []);

  /** Pop back once the confirmation has had a moment to be read. Cancelled on unmount. */
  const leaveShortly = useCallback((ms: number) => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => {
      leaveTimer.current = null;
      if (live.current) router.back();
    }, ms);
  }, [router]);

  const load = useCallback(async (focused?: () => boolean) => {
    const next = await api.getTask(String(id));
    if (!live.current || (focused && !focused())) return;
    setTask(next ?? null);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => {
    let focused = true;
    void load(() => focused);
    return () => { focused = false; };
  }, [load]));

  /* ---------- writes ---------- */

  /* The step checklist is READ-ONLY as of Phase 1.
   *
   * `toggleStep` used to set local state and fire a success haptic on the last tick, over an
   * API call that made no request at all — so an advisor ticked off KYC and claim-documentation
   * steps, was confirmed, and lost every tick on the next focus refetch. There is no endpoint
   * for a task step; Phase 9 adds one. Until then the steps show progress that came from the
   * server and nothing pretends to accept a tap. */

  const setStatus = async (s: TaskStatus) => {
    if (!task) return;
    setStatusOpen(false);
    const before = task;
    setTask({ ...task, status: s, steps: s === 'done' ? task.steps.map((x) => ({ ...x, done: true })) : task.steps });

    const res = await api.updateTaskStatus(task.id, s);
    if (!live.current) return;

    if (!res.ok) {
      setTask(before);
      haptics.warn();
      setNotice({
        tone: 'warning',
        title: 'Status was not saved',
        message: res.forbidden
          ? 'This task is assigned to someone else, so it cannot be changed from here.'
          : 'The server did not accept the change. Try again in a moment.',
      });
      return;
    }
    haptics.success();
    setNotice(null);
    if (s === 'done') {
      toast('Task completed.', 'success');
      leaveShortly(LEAVE_AFTER_DONE);
    }
  };

  /** Hand this task to another team member. Any member may do this. */
  const openTransfer = async () => {
    setTransferOpen(true);
    if (team) return;
    // Band 2 #3: the assignable roster is the staff DIRECTORY (/profiles) for an entitled user, not
    // the task-derived getTeam() roster — so a colleague with no task yet is still a transfer target.
    const list = await api.getAssignableTeam().catch(() => [] as TeamMember[]);
    if (!live.current) return;
    setTeam(list);
  };

  const confirmTransfer = async (to: string) => {
    if (!task) return;
    setTransferOpen(false);
    setTransferQuery('');
    setBusy(true);

    const ok = await api.reassignTask(task.id, to);
    if (!live.current) return;
    setBusy(false);

    if (!ok) {
      haptics.error();
      setNotice({
        tone: 'danger',
        title: 'Transfer failed',
        message: 'The server did not accept the reassignment. Check your connection and try again.',
      });
      return;
    }
    haptics.success();
    toast(`Task transferred to ${to}.`, 'success');
    leaveShortly(LEAVE_AFTER_TRANSFER);
  };

  /** Contact the client. Use the phone on the task, else resolve it from the book. */
  const contactClient = async () => {
    if (!task) return;
    let phone = task.clientPhone || '';
    let clientId = '';
    let name = task.client || 'Client';

    if (!phone && task.client) {
      setBusy(true);
      const page = await api
        .getClientsPage(1, task.client)
        .catch(() => ({ items: [] as Client[], hasMore: false, total: 0 }));
      if (!live.current) return;
      setBusy(false);
      const match = page.items.find((cl) => cl.phone) || page.items[0];
      if (match) { phone = match.phone; clientId = match.id; name = match.name; }
    }

    if (!phone && !clientId) {
      haptics.warn();
      setNotice({
        tone: 'warning',
        title: 'No number on file',
        message: `There is no phone number saved for ${name}, so this client cannot be reached from here.`,
      });
      return;
    }
    setContact({ name, phone, clientId });
    setContactOpen(true);
  };

  /* ---------- states ---------- */

  if (loading) {
    return (
      <Screen>
        <Header title="Task" back />
        <DetailSkeleton />
      </Screen>
    );
  }

  if (!task) {
    return (
      <Screen>
        <Header title="Task" back />
        <Card style={{ margin: spacing.lg }}>
          {health.degraded ? (
            <EmptyState
              icon="cloud-offline"
              title="This task did not load"
              subtitle="The server could not be reached, so we cannot confirm whether this task still exists."
              action={{ label: 'Try again', onPress: () => { setLoading(true); void load(); } }}
            />
          ) : (
            <EmptyState
              icon="alert-circle-outline"
              title="Task not found"
              subtitle="It may have been closed or reassigned to someone else."
              action={{ label: 'Back to tasks', onPress: () => router.back() }}
            />
          )}
        </Card>
      </Screen>
    );
  }

  const st = TASK_STATUS[task.status];
  const pr = TASK_PRIORITY[task.priority];
  const prog = taskProgress(task);
  const doneSteps = task.steps.filter((s) => s.done).length;
  const isDone = task.status === 'done';
  const assignee = assigneeOf(task);
  const transferTargets = (team ?? []).filter((m) => m.name && m.name !== assignee);
  // Band 2 #3 review fix: filter + cap the (now full-directory) transfer roster with the sheet's
  // search, so an entitled user can reach any colleague and the list is never silently truncated.
  const TRANSFER_CAP = 24;
  const filteredTargets = filterMembers(transferTargets, transferQuery);
  const shownTargets = filteredTargets.slice(0, TRANSFER_CAP);
  const targetsSearchable = transferTargets.length > 8;

  return (
    <Screen>
      <Header
        title={task.category}
        back
        right={
          /* Band 2 #3: no Edit on a DONE task. A field-edit PATCH bumps the backend's updatedAt,
             which adaptTeamTask reads as a done task's completedAt — editing a task finished days ago
             would re-credit it to TODAY's completed count. Correct a done task via Reopen first. */
          isDone ? undefined : (
            <IconBtn
              icon="create-outline"
              accessibilityLabel="Edit task"
              onPress={() => router.push({
                pathname: '/task-edit',
                params: {
                  id: task.id,
                  title: task.title,
                  description: task.description ?? '',
                  client: task.client ?? '',
                  priority: task.priority,
                  dueDate: task.dueDate,
                },
              })}
            />
          )
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* WHAT this is. */}
        <Appear>
          <Card>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{
                width: 44, height: 44, borderRadius: 14,
                backgroundColor: isDone ? c.successSoft : c.primarySoft,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons
                  name={(CATEGORY_ICON[task.category] || 'checkbox') as IconName}
                  size={21}
                  color={isDone ? c.success : c.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Txt size={18} weight="800" style={{ lineHeight: 24 }}>{task.title}</Txt>
                <Row style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <Pill label={st.label} tone={st.tone} small />
                  <Pill label={`${pr.label} priority`} tone={pr.tone} small />
                </Row>
              </View>
            </Row>

            {task.description ? (
              <Txt size={font.body} color={c.muted} style={{ lineHeight: 21, marginTop: 14 }}>
                {task.description}
              </Txt>
            ) : null}

            {task.clientPhone ? (
              <Row style={{ marginTop: 16, gap: spacing.md }}>
                <Button label={t('common.call')} icon="call" variant="secondary" style={{ flex: 1 }}
                  onPress={() => { haptics.tap(); call(task.clientPhone!); }} />
                <Button label={t('common.whatsapp')} icon="logo-whatsapp" variant="whatsapp" style={{ flex: 1 }}
                  onPress={() => { haptics.tap(); whatsapp(task.clientPhone!); }} />
              </Row>
            ) : task.client ? (
              <Button label="Contact client" icon="call" variant="secondary" loading={busy} full
                style={{ marginTop: 16 }} onPress={contactClient} />
            ) : null}
          </Card>
        </Appear>

        {notice ? (
          <Banner
            tone={notice.tone}
            title={notice.title}
            message={notice.message}
            onDismiss={() => setNotice(null)}
          />
        ) : null}

        {/* THE FACTS. Grouped rows, one card, hairlines between. */}
        <Appear index={1}>
          <ListSection title="Details">
            <DataRow
              icon="time-outline"
              label="Due"
              value={`${fmtDate(task.dueDate)} · ${fmtTime(task.dueDate)}`}
            />
            <DataRow icon="person-outline" label="Assigned by" value={task.assignedBy || 'Not recorded'} />
            {assignee ? (
              /* Band 2 #3: only an entitled tier may reassign; a team-tier sees it read-only. */
              <DataRow
                icon="swap-horizontal-outline"
                label="Assigned to"
                value={assignee}
                onPress={canAssign ? openTransfer : undefined}
              />
            ) : canAssign ? (
              <DataRow
                icon="swap-horizontal-outline"
                label="Assigned to"
                value="Transfer this task"
                tone="primary"
                onPress={openTransfer}
              />
            ) : (
              <DataRow
                icon="swap-horizontal-outline"
                label="Assigned to"
                value="Unassigned"
              />
            )}
            {task.client ? <DataRow icon="people-outline" label="Client" value={task.client} /> : null}
            {task.clientPhone ? (
              <DataRow icon="call-outline" label="Phone" value={task.clientPhone} numeric copyable />
            ) : null}
            <DataRow
              icon="flag-outline"
              label="Status"
              value=""
              right={<Pill label={st.label} tone={st.tone} small />}
              onPress={() => setStatusOpen(true)}
            />
          </ListSection>
        </Appear>

        {/* THE WORK — a checklist, shown ONLY when the task carries steps (Band 2 #3, Point 5).
            Real team tasks never carry steps (the backend team_tasks have no step field, and
            adaptTeamTask returns steps:[]), so an always-empty "Workflow" card with a "No checklist"
            message read as broken. It is now hidden entirely when empty. A legacy /tasks record CAN
            carry steps, so the card still renders for the (currently dead) path that has them — this
            is "hide when empty", not "deleted". The old empty-state's "Change status" shortcut is
            redundant: the Status row above and the footer button both open the status control. */}
        {task.steps.length > 0 ? (
          <Appear index={2}>
            <View>
              <SectionHeader title="Workflow" />
              <Card padded={false}>
                {/* Clip on an INNER view: `overflow: hidden` alongside `elevation` kills the
                    Android shadow, and the card would lose its depth. */}
                <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
                  <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md }}>
                    <Meter
                      value={prog}
                      label="Steps completed"
                      valueLabel={`${doneSteps}/${task.steps.length}`}
                      tone={prog >= 1 ? 'success' : 'primary'}
                    />
                  </View>
                  {task.steps.map((s, i) => (
                    <Appear key={s.id} index={i} distance={6}>
                      <View style={{
                        height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: spacing.lg,
                      }} />
                      <View
                        accessibilityRole="text"
                        accessibilityLabel={`${s.label}. ${s.done ? 'Completed' : 'Not completed'}.`}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                          minHeight: 52, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
                        }}
                      >
                        <Ionicons
                          name={s.done ? 'checkmark-circle' : 'ellipse-outline'}
                          size={24}
                          color={s.done ? c.success : c.faint}
                        />
                        <Txt
                          size={14.5}
                          weight={s.done ? '400' : '600'}
                          color={s.done ? c.muted : c.text}
                          style={{ flex: 1, textDecorationLine: s.done ? 'line-through' : 'none' }}
                        >
                          {s.label}
                        </Txt>
                      </View>
                    </Appear>
                  ))}
                </View>
              </Card>
            </View>
          </Appear>
        ) : null}
      </ScrollView>

      {/* The commit, permanently in thumb reach. */}
      <View style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.md,
        backgroundColor: c.bg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: c.hairline,
        gap: spacing.sm,
      }}>
        {isDone ? (
          <Button label="Reopen task" icon="arrow-undo" variant="outline" size="lg" full
            onPress={() => setStatus('in_progress')} />
        ) : (
          <Button label="Mark task complete" icon="checkmark-done" size="lg" full
            onPress={() => setStatus('done')} />
        )}
      </View>

      {/* ---------- status flow ---------- */}
      <Sheet
        visible={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Move this task"
        subtitle={`Currently ${st.label.toLowerCase()}`}
      >
        <View style={{ paddingTop: spacing.xs }}>
          {FLOW.map((s, i) => {
            const active = task.status === s;
            const meta = TASK_STATUS[s];
            return (
              <View key={s}>
                {i > 0 ? (
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline }} />
                ) : null}
                <Pressable
                  onPress={() => setStatus(s)}
                  disabled={active}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: active }}
                  accessibilityLabel={`${meta.label}. ${STATUS_NOTE[s]}`}
                  style={({ pressed }) => [{
                    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                    minHeight: 56, paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
                    marginHorizontal: -spacing.sm, borderRadius: radius.md,
                    backgroundColor: pressed ? c.cardAlt : 'transparent',
                    opacity: active ? 0.55 : 1,
                  }]}
                >
                  <Pill label={meta.label} tone={meta.tone} />
                  <Txt size={font.sub} color={c.muted} numberOfLines={2} style={{ flex: 1 }}>
                    {STATUS_NOTE[s]}
                  </Txt>
                  {active ? <Ionicons name="checkmark" size={18} color={c.primary} /> : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      </Sheet>

      {/* ---------- transfer ---------- */}
      <Sheet
        visible={transferOpen}
        onClose={() => { setTransferOpen(false); setTransferQuery(''); }}
        title="Transfer task"
        subtitle={assignee ? `Currently with ${assignee}` : 'Hand this task to another team member'}
      >
        {team === null ? (
          <View style={{ gap: spacing.lg, paddingTop: spacing.xs }}>
            {[0, 1, 2, 3].map((i) => (
              <Row key={i} style={{ gap: spacing.md }}>
                <Skeleton width={40} height={40} radius={40 / 2.6} />
                <View style={{ flex: 1, gap: 7 }}>
                  <Skeleton width="52%" height={12} />
                  <Skeleton width="34%" height={10} />
                </View>
              </Row>
            ))}
          </View>
        ) : transferTargets.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No one to transfer to"
            subtitle={health.degraded
              ? 'The team roster could not be loaded, so this list is not confirmed. Close this and try again.'
              : 'There is no other team member on your roster right now.'}
          />
        ) : (
          <View style={{ paddingTop: spacing.xs }}>
            {/* Search — shown only when the roster is large enough to need narrowing. The sheet's
                own ScrollView carries keyboardShouldPersistTaps, so the first tap still lands. */}
            {targetsSearchable ? (
              <View style={{ marginBottom: spacing.md }}>
                <SearchBar
                  value={transferQuery}
                  onChange={setTransferQuery}
                  onSubmit={() => {}}
                  placeholder="Search colleagues"
                />
              </View>
            ) : null}
            {shownTargets.length === 0 ? (
              <EmptyState
                icon="search-outline"
                title={`No colleague matches "${transferQuery.trim()}"`}
                subtitle="Try a shorter piece of the name, or clear the search to see everyone."
              />
            ) : (
              <>
                {shownTargets.map((m, i) => (
                  <PersonRow
                    key={m.id}
                    name={m.name}
                    subtitle={m.branch || m.role}
                    chevron
                    onPress={() => confirmTransfer(m.name)}
                    style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline } : undefined}
                  />
                ))}
                {filteredTargets.length > TRANSFER_CAP ? (
                  <Txt size={font.sub} color={c.faint} style={{ paddingVertical: spacing.md, textAlign: 'center' }}>
                    {`Showing ${TRANSFER_CAP} of ${filteredTargets.length} — search by name to find more`}
                  </Txt>
                ) : null}
              </>
            )}
          </View>
        )}
      </Sheet>

      {/* ---------- contact ---------- */}
      <Sheet
        visible={contactOpen}
        onClose={() => setContactOpen(false)}
        title={contact ? contact.name : 'Contact'}
        subtitle={contact?.phone ? contact.phone : 'Open the client record'}
      >
        <View style={{ gap: spacing.md, paddingTop: spacing.xs }}>
          {contact?.phone ? (
            <>
              <Button label={t('common.call')} icon="call" size="lg" full
                onPress={() => { haptics.tap(); setContactOpen(false); call(contact.phone); }} />
              <Button label={t('common.whatsapp')} icon="logo-whatsapp" variant="whatsapp" size="lg" full
                onPress={() => { haptics.tap(); setContactOpen(false); whatsapp(contact.phone); }} />
            </>
          ) : null}
          {contact?.clientId ? (
            <Button label="Open client profile" icon="person-circle" variant="outline" size="lg" full
              onPress={() => { setContactOpen(false); router.push(`/client/${contact.clientId}`); }} />
          ) : null}
        </View>
      </Sheet>
    </Screen>
  );
}
