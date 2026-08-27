import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Header, Row, Screen, SectionHeader, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { IconBtn } from '@/ui/controls';
import { Banner, EmptyState, Skeleton } from '@/ui/feedback';
import { SyncChip } from '@/ui/SyncChip';
import type { FeedbackTone } from '@/ui/feedback';
import { Spine, SpineRow } from '@/ui/spine';
import type { SpineTone } from '@/ui/spine';
import { SwipeRow } from '@/ui/swipe';
import type { SwipeAction } from '@/ui/swipe';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';

import * as api from '@/data/api';
import type { Reminder } from '@/data/types';
import { REMINDER_ICON } from '@/data/labels';
import { daysUntil, fmtDay } from '@/lib/format';
import { whatsapp } from '@/lib/actions';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * Reminders — the follow-up spine.
 *
 * WHY THE SPINE AND NOT A STACK OF CARDS. A reminder has exactly one thing that orders it:
 * when it comes due. Ten identical floating cards encode nothing about that; the date
 * spine puts the day in a gutter, hangs each row off a node, and draws the rule between
 * them, so the sequence in time IS the structure of the screen rather than a field inside
 * a card. That is the same device home.tsx uses for the day, which keeps one language for
 * "work, in order".
 *
 * THE GUTTER CARRIES A DATE RHYTHM, NOT A DATE COLUMN. Rows are sorted by due date and the
 * day label is printed only when the day CHANGES. Repeating "12 Jul" down six consecutive
 * rows turns the gutter into a column of noise that the eye stops reading; printed once, it
 * becomes a heading for the block beneath it and the rule visibly groups a day's work.
 *
 * OVERDUE IS ITS OWN BUCKET. Lumping "three days late" in with "due today" hides the only
 * distinction on this screen that costs money, and the spine already tones them apart
 * (danger against primary), so the grouping now matches what the colour is saying.
 *
 * COMPLETING IS A SWIPE AND A BUTTON, ON PURPOSE. A field agent works one-handed and
 * walking, and the swipe is the fastest possible close. But a gesture with no affordance is
 * undiscoverable and unusable for anyone who cannot swipe precisely, so the same action is
 * also a 44pt tick in the row. Neither is the "real" one.
 *
 * COMPLETION IS OPTIMISTIC BUT CONFIRMED, AND ONE-WAY. PHASE 9: `toggleReminder` now writes
 * to the server (`POST /reminders/:id/acknowledge`) and returns whether it was accepted. The
 * tick lands on the touch for a walking agent, but if the server refuses it the row is put
 * back and a Banner says so — an optimistic UI that cannot un-promise is a lie with good
 * timing. Only a confirmed write earns `haptics.success`. There is NO reopen: the backend has
 * no un-acknowledge, so a reopen control could only revert on the next refetch, which is the
 * exact silent-tick failure this phase removes.
 * ------------------------------------------------------------------ */

/** Milliseconds since epoch, or NaN for a record with no usable date. */
function stamp(d: string): number {
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : NaN;
}

/** Undated records sort last rather than to 1970, which is where a NaN comparator drops them. */
function byDate(a: Reminder, b: Reminder): number {
  const ta = stamp(a.date);
  const tb = stamp(b.date);
  const va = Number.isFinite(ta);
  const vb = Number.isFinite(tb);
  if (!va && !vb) return 0;
  if (!va) return 1;
  if (!vb) return -1;
  return ta - tb;
}

/** Calendar day, for deciding whether the gutter reprints its label. */
function dayKey(d: string): string {
  const dt = new Date(d);
  return Number.isFinite(dt.getTime())
    ? `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`
    : 'undated';
}

function toneFor(r: Reminder): SpineTone {
  if (r.done) return 'success';
  const d = daysUntil(r.date);
  if (!Number.isFinite(d)) return 'neutral';
  if (d < 0) return 'danger';
  if (d === 0) return 'primary';
  return 'neutral';
}

/**
 * The gutter label. An undated reminder gets an EMPTY gutter rather than a placeholder:
 * `fmtDay` answers an em-dash for an unparseable date, which is both a fabricated-looking
 * mark and punctuation this app's copy does not use. The missing date is stated in the
 * subtitle instead, where there is room to say it in words.
 */
function timeFor(r: Reminder): string {
  const d = daysUntil(r.date);
  if (!Number.isFinite(d)) return '';
  if (d === 0) return 'Today';
  return fmtDay(r.date);
}

function subtitleFor(r: Reminder): string {
  const d = daysUntil(r.date);
  // Guard first. An unparseable date makes daysUntil NaN, and the old comparison chain
  // fell through to the overdue branch and rendered the literal "Overdue by NaN days".
  if (!Number.isFinite(d)) {
    return r.subtitle ? `No date on record. ${r.subtitle}` : 'No date on record.';
  }
  if (r.done || d >= 0) return r.subtitle;
  const late = Math.abs(d);
  return `Overdue by ${late} day${late === 1 ? '' : 's'}. ${r.subtitle}`;
}

/* ---------- loading ----------
 * The spine's own proportions: a date gutter, a node, then two lines of content. The rows
 * do not move when the real reminders land. */
function RemindersSkeleton() {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.lg }}>
      {[0, 1].map((g) => (
        <View key={g}>
          <Skeleton width={g === 0 ? '28%' : '34%'} height={15} style={{ marginBottom: spacing.md }} />
          <Card>
            {[0, 1, 2].map((i) => (
              <Row key={i} style={{ alignItems: 'flex-start', marginBottom: i === 2 ? 0 : spacing.xl }}>
                <Skeleton width={34} height={11} />
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.cardAlt }} />
                <View style={{ flex: 1, gap: 7 }}>
                  <Skeleton width="62%" height={13} />
                  <Skeleton width="44%" height={11} />
                </View>
                <Skeleton width={34} height={34} radius={13} />
              </Row>
            ))}
          </Card>
        </View>
      ))}
    </View>
  );
}

export default function Reminders() {
  const c = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();

  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<{ tone: FeedbackTone; title: string; message: string } | null>(null);

  /** The leak guard. No state is written once the screen is gone. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  /**
   * Blurring mid-read must not strand the RefreshControl. The rows are dropped when the
   * screen is no longer focused (a refocus refetches them), but the spinners always come
   * down while the component is still mounted.
   */
  const load = useCallback(async (isRefresh = false, focused?: () => boolean) => {
    if (isRefresh) setRefreshing(true);
    const next = await api.getReminders();
    if (!mounted.current) return;
    if (!focused || focused()) setItems(next);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let focused = true;
    void load(false, () => focused);
    return () => { focused = false; };
  }, [load]));

  /**
   * Optimistic completion with a real rollback. PHASE 9. The row flips to done on the same
   * frame as the touch, because a follow-up being ticked while walking cannot wait for a round
   * trip — but `toggleReminder` now returns whether the server accepted it, so a refusal puts
   * THIS row back and raises a notice rather than leaving a tick the next refetch would wipe.
   * Completion is one-way (the backend has no un-acknowledge), so an already-done row is a no-op.
   */
  const toggle = useCallback(async (r: Reminder) => {
    if (r.done) return;
    haptics.tap();
    setItems((prev) => prev.map((x) => (x.id === r.id ? { ...x, done: true } : x)));
    const ok = await api.toggleReminder(r.id);
    if (!mounted.current) return;
    if (ok) {
      haptics.success();
      setNotice(null);
      return;
    }
    // Nothing reached the server — restore only this row, so a failure here never reverts a
    // different reminder the user completed while this request was in the air.
    setItems((prev) => prev.map((x) => (x.id === r.id ? { ...x, done: false } : x)));
    haptics.warn();
    setNotice({
      tone: 'warning',
      title: 'Not marked done',
      message: `"${r.title}" could not be saved — it never reached the server, so it is still open. Check your connection and try again.`,
    });
  }, []);

  /**
   * Four buckets, each sorted by due date so the spine's gutter runs forwards. An undated
   * pending reminder falls into Upcoming and sorts to the end of it; its row says so.
   */
  const groups = useMemo(() => {
    const pending = items.filter((r) => !r.done);
    const due = (r: Reminder) => daysUntil(r.date);
    const dated = (r: Reminder) => Number.isFinite(due(r));
    return {
      pending,
      overdue: pending.filter((r) => dated(r) && due(r) < 0).sort(byDate),
      today: pending.filter((r) => dated(r) && due(r) === 0).sort(byDate),
      upcoming: pending.filter((r) => !dated(r) || due(r) > 0).sort(byDate),
      done: items.filter((r) => r.done).sort(byDate),
    };
  }, [items]);

  const nothing = items.length === 0;

  const subtitle = groups.pending.length === 0
    ? (items.length > 0 ? 'Every follow-up is closed' : 'Nothing pending')
    : groups.overdue.length > 0
      ? `${groups.pending.length} pending, ${groups.overdue.length} overdue`
      : `${groups.pending.length} pending follow-up${groups.pending.length === 1 ? '' : 's'}`;

  return (
    <Screen>
      <Header title={t('common.reminders')} subtitle={subtitle} back />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg, paddingTop: 4,
          paddingBottom: insets.bottom + 48, gap: spacing.xxl,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Phase 57a: shown only when these reminders came from the offline cache after a failed
            refetch, so populated-but-stale rows never read as live data (audit 2026-08-21, #9). */}
        <SyncChip endpointKey="reminders" />

        {notice ? (
          <Banner
            tone={notice.tone}
            title={notice.title}
            message={notice.message}
            onDismiss={() => setNotice(null)}
          />
        ) : null}

        {loading ? <RemindersSkeleton /> : nothing ? (
          <Card>
            {health.degraded ? (
              <EmptyState
                icon="cloud-offline"
                title="Reminders did not load"
                subtitle="The server could not be reached, so this is not a confirmed empty list. Pull down to try again."
                action={{ label: t('common.tryAgain'), onPress: () => void load(true) }}
              />
            ) : (
              <EmptyState
                icon="notifications-off-outline"
                title="No follow-ups yet"
                subtitle="Birthdays, renewals and maturities from your client book appear here as they come due."
              />
            )}
          </Card>
        ) : (
          <>
            {groups.overdue.length > 0 ? (
              <Group index={0} title={t('tasks.overdue')} items={groups.overdue} onToggle={toggle} />
            ) : null}
            {groups.today.length > 0 ? (
              <Group index={1} title={t('common.today')} items={groups.today} onToggle={toggle} />
            ) : null}
            {groups.upcoming.length > 0 ? (
              <Group index={2} title={t('tasks.upcoming')} items={groups.upcoming} onToggle={toggle} />
            ) : null}
            {groups.done.length > 0 ? (
              <Group index={3} title="Completed" items={groups.done} onToggle={toggle} />
            ) : null}

            {/* Every reminder is closed, but the list is not empty — a different state from
                "nothing here yet", and it must not be shown with the same empty screen. */}
            {groups.pending.length === 0 ? (
              <EmptyState
                icon="checkmark-done-circle-outline"
                title="Nothing left to chase"
                subtitle="Every follow-up on your book is closed. New ones appear here as they come due."
              />
            ) : null}

            {/* Said once, at the foot of the list, rather than repeated on every row.
                Long-press is the same door for anyone who cannot swipe precisely. */}
            <Txt size={font.tiny} color={c.faint} style={{ textAlign: 'center' }}>
              Swipe a reminder for quick actions, or press and hold it.
            </Txt>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/* ---------- Group ----------
 * One spine per bucket. The rule runs continuously because each SwipeRow sits flush
 * against the next and terminates on the final node. */
function Group({ title, items, onToggle, index = 0 }: {
  title: string;
  items: Reminder[];
  onToggle: (r: Reminder) => void;
  /** Position among the buckets, so the sections arrive in reading order. */
  index?: number;
}) {
  const c = useTheme();
  const t = useT();

  return (
    <Appear index={index}>
      <View>
        <SectionHeader title={`${title} (${items.length})`} />
        <Card>
          <Spine>
            {items.map((r, i) => {
              // PHASE 9: completion is one-way (no un-acknowledge on the backend), so a done row
              // carries no swipe action — a "Reopen" here could only revert on the next refetch.
              const actions: SwipeAction[] = [];
              if (!r.done) {
                actions.push({ icon: 'checkmark-done', label: t('common.done'), tone: 'success', onPress: () => onToggle(r) });
                if (r.phone) {
                  actions.push({
                    icon: 'logo-whatsapp',
                    label: t('common.whatsapp'),
                    tone: 'whatsapp',
                    onPress: () => { haptics.tap(); whatsapp(r.phone!, `Namaste ${r.clientName || ''}`); },
                  });
                }
              }

              // The rhythm: the day is printed on the first row that belongs to it, and the
              // rows beneath hang off the same block with a clear gutter.
              const sameDayAsPrevious = i > 0 && dayKey(items[i - 1].date) === dayKey(r.date);

              return (
                <SwipeRow key={r.id} actions={actions} radius={radius.md}>
                  <SpineRow
                    index={i}
                    last={i === items.length - 1}
                    time={sameDayAsPrevious ? '' : timeFor(r)}
                    title={r.title}
                    subtitle={subtitleFor(r)}
                    tone={toneFor(r)}
                    icon={r.done ? 'checkmark-circle' : ((REMINDER_ICON[r.type] ?? 'notifications') as IconName)}
                    right={
                      // A done reminder shows no action button — the left success check is the
                      // whole story, and there is nothing to reopen (PHASE 9, one-way completion).
                      r.done ? undefined : (
                        <IconBtn
                          icon="checkmark"
                          size={34}
                          bg={c.successSoft}
                          color={c.success}
                          accessibilityLabel={`Mark ${r.title} done`}
                          onPress={() => onToggle(r)}
                        />
                      )
                    }
                  />
                </SwipeRow>
              );
            })}
          </Spine>
        </Card>
      </View>
    </Appear>
  );
}
