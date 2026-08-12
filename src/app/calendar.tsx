import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Header, Metric, Row, Screen, Txt } from '@/ui/base';
import { Button } from '@/ui/controls';
import { EmptyState, Skeleton } from '@/ui/feedback';
import { Pill } from '@/ui/data';
import { Spine, SpineRow } from '@/ui/spine';
import type { SpineTone } from '@/ui/spine';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import * as api from '@/data/api';
import type { Reminder, ReminderType } from '@/data/types';
import { REMINDER_ICON } from '@/data/labels';
import { daysUntil, fmtTime } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * The 14-day agenda.
 *
 * A day is a SEQUENCE, so it is drawn on the spine rather than as a stack of cards. The
 * gutter carries the clock time, the node carries the kind of touch (a birthday is not a
 * premium chase), and the rule carries the fact that these things happen in an order.
 *
 * The strip above is a scanner, not decoration: the dot under a date means work is
 * waiting there, so the advisor can see the shape of the fortnight without opening it.
 * ------------------------------------------------------------------ */

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HORIZON = 14;

/** Node colour by what the touch is FOR. Money is warning-toned, courtesy is accent. */
const TONE: Record<ReminderType, SpineTone> = {
  renewal: 'warning',
  maturity: 'success',
  birthday: 'accent',
  anniversary: 'accent',
  followup: 'primary',
  meeting: 'primary',
};

/**
 * The gutter shows a clock time only when the record actually carries one. A date-only
 * value ('2026-08-04') parses to midnight UTC, which would render as a confident and
 * completely invented "5:30 AM" in IST.
 */
function timeLabel(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '-';
  return /\d{2}:\d{2}/.test(iso) ? fmtTime(dt) : '-';
}

function dayTitle(offset: number): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${FULL_WD[d.getDay()]}, ${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`;
}

export default function Calendar() {
  const health = useDataHealth();

  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(0);
  const [attempt, setAttempt] = useState(0);

  // Cancellable: the screen is reachable from a tab and can be popped mid-request, and a
  // resolved fetch must never land on an unmounted tree.
  useEffect(() => {
    let alive = true;
    (async () => {
      const rows = await api.getReminders();
      if (!alive) return;
      setItems(rows);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [attempt]);

  // The spinner is raised HERE rather than inside the effect: an effect that setStates
  // synchronously on every run cascades an extra render pass for nothing.
  const retry = useCallback(() => { setLoading(true); setAttempt((n) => n + 1); }, []);

  /** offset -> open count, so the strip can show where the work is. */
  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of items) {
      if (r.done) continue;
      const d = daysUntil(r.date);
      if (!Number.isFinite(d) || d < 0 || d >= HORIZON) continue;
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const days = useMemo(() => Array.from({ length: HORIZON }, (_, i) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + i);
    return { offset: i, date: dt.getDate(), wd: WD[dt.getDay()], count: counts.get(i) ?? 0 };
  }), [counts]);

  const events = useMemo(() => items
    .filter((r) => daysUntil(r.date) === sel)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date)), [items, sel]);

  const openTotal = useMemo(() => Array.from(counts.values()).reduce((n, v) => n + v, 0), [counts]);

  /** The next day inside the horizon that actually has something on it. */
  const nextBusy = useMemo(() => {
    for (let i = sel + 1; i < HORIZON; i++) if ((counts.get(i) ?? 0) > 0) return i;
    for (let i = 0; i < sel; i++) if ((counts.get(i) ?? 0) > 0) return i;
    return null;
  }, [counts, sel]);

  const pickDay = useCallback((offset: number) => {
    if (offset === sel) return;
    haptics.select();
    setSel(offset);
  }, [sel]);

  const subtitle = loading
    ? 'Loading the next 14 days'
    : openTotal > 0
      ? `${openTotal} open in the next 14 days`
      : 'Next 14 days';

  return (
    <Screen>
      <Header title="Calendar" subtitle={subtitle} back />

      {loading ? <StripSkeleton /> : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm }}
        >
          {days.map((d, i) => (
            <Appear key={d.offset} index={i}>
              <DayCell
                wd={d.wd}
                date={d.date}
                count={d.count}
                active={d.offset === sel}
                label={`${FULL_WD[(new Date().getDay() + d.offset) % 7]} ${d.date}, ${d.count} open`}
                onPress={() => pickDay(d.offset)}
              />
            </Appear>
          ))}
        </ScrollView>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <Row style={{ marginBottom: spacing.md, marginTop: spacing.xs }}>
          <Txt size={font.h3} weight="800" style={{ flex: 1 }} numberOfLines={1}>{dayTitle(sel)}</Txt>
          {!loading && events.length > 0 ? (
            <Pill label={`${events.length} item${events.length === 1 ? '' : 's'}`} tone="neutral" small numeric />
          ) : null}
        </Row>

        {loading ? <AgendaSkeleton /> : events.length === 0 ? (
          <DayEmpty
            degraded={health.degraded && items.length === 0}
            anyLoaded={items.length > 0}
            dayLabel={dayTitle(sel)}
            nextBusy={nextBusy}
            onRetry={retry}
            onJump={(o) => pickDay(o)}
          />
        ) : (
          <Spine>
            {events.map((e, i) => (
              <EventRow key={e.id} r={e} index={i} last={i === events.length - 1} />
            ))}
          </Spine>
        )}
      </ScrollView>
    </Screen>
  );
}

/* ================================================================== *
 * Day strip
 * ================================================================== */

const CELL_W = 54;
const CELL_H = 70;

function DayCell({ wd, date, count, active, label, onPress }: {
  wd: string; date: number; count: number; active: boolean; label: string; onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [{
        width: CELL_W, height: CELL_H, borderRadius: radius.md,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: active ? c.primary : c.card,
        borderWidth: StyleSheet.hairlineWidth, borderColor: active ? c.primary : c.border,
        opacity: pressed ? 0.75 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      }]}
    >
      <Txt size={11} weight="600" color={active ? c.onPrimary : c.muted}>{wd}</Txt>
      <Metric value={String(date)} size={18} color={active ? c.onPrimary : c.text} style={{ marginTop: 2 }} />
      <View style={{
        width: 5, height: 5, borderRadius: 3, marginTop: 4,
        backgroundColor: count > 0 ? (active ? c.onPrimary : c.accent) : 'transparent',
      }} />
    </Pressable>
  );
}

/* ================================================================== *
 * Agenda row
 * ================================================================== */

function EventRow({ r, index, last }: { r: Reminder; index: number; last: boolean }) {
  const t = useT();
  const hasPhone = !!r.phone;
  return (
    <SpineRow
      index={index}
      last={last}
      time={timeLabel(r.date)}
      title={r.title}
      subtitle={r.subtitle || r.clientName}
      tone={r.done ? 'neutral' : TONE[r.type] ?? 'primary'}
      icon={REMINDER_ICON[r.type] ?? 'notifications'}
      right={r.done ? <Pill label="Done" tone="success" small icon="checkmark" /> : undefined}
    >
      {hasPhone && !r.done ? (
        <Row style={{ gap: spacing.sm }}>
          <Button
            label={t('common.call')}
            icon="call"
            variant="secondary"
            size="sm"
            onPress={() => { haptics.tap(); call(r.phone as string); }}
          />
          <Button
            label={t('common.whatsapp')}
            icon="logo-whatsapp"
            variant="whatsapp"
            size="sm"
            onPress={() => { haptics.tap(); whatsapp(r.phone as string); }}
          />
        </Row>
      ) : null}
    </SpineRow>
  );
}

/* ================================================================== *
 * Empty — three genuinely different situations
 * ================================================================== */

function DayEmpty({ degraded, anyLoaded, dayLabel, nextBusy, onRetry, onJump }: {
  degraded: boolean;
  anyLoaded: boolean;
  dayLabel: string;
  nextBusy: number | null;
  onRetry: () => void;
  onJump: (offset: number) => void;
}) {
  if (degraded) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Your calendar could not load"
        subtitle="The server did not answer, so this day is unconfirmed rather than clear. Check your connection and try again."
        action={{ label: 'Try again', onPress: onRetry }}
      />
    );
  }
  if (!anyLoaded) {
    return (
      <EmptyState
        icon="calendar-outline"
        title="Nothing scheduled in the next 14 days"
        subtitle="Birthdays, premium chases and follow-ups appear here as soon as they are raised against your book."
        action={{ label: 'Refresh', onPress: onRetry }}
      />
    );
  }
  return (
    <EmptyState
      icon="calendar-clear-outline"
      title={`${dayLabel} is clear`}
      subtitle="No follow-ups, greetings or premium chases fall on this day."
      action={nextBusy != null
        ? { label: `Go to ${dayTitle(nextBusy)}`, onPress: () => onJump(nextBusy) }
        : undefined}
    />
  );
}

/* ================================================================== *
 * Loading — the shape of the strip and the spine, not a spinner
 * ================================================================== */

function StripSkeleton() {
  return (
    <View style={{
      flexDirection: 'row', gap: spacing.sm,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} width={CELL_W} height={CELL_H} radius={radius.md} />
      ))}
    </View>
  );
}

function AgendaSkeleton() {
  const c = useTheme();
  return (
    <View style={{ paddingTop: 2 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ flexDirection: 'row' }}>
          <View style={{ width: 48, alignItems: 'flex-end', paddingRight: 10, paddingTop: 2 }}>
            <Skeleton width={34} height={10} />
          </View>
          <View style={{ width: 18, alignItems: 'center' }}>
            <View style={{
              width: 9, height: 9, borderRadius: 4.5, marginTop: 3,
              borderWidth: 2, borderColor: c.spine, backgroundColor: c.card,
            }} />
            {i < 3 ? <View style={{ flex: 1, width: 1.5, backgroundColor: c.spine, marginTop: 4, borderRadius: 1 }} /> : null}
          </View>
          <View style={{ flex: 1, paddingLeft: 12, paddingBottom: 18, gap: spacing.sm }}>
            <Skeleton width="62%" height={13} />
            <Skeleton width="44%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}
