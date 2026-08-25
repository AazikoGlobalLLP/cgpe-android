import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Metric, Row, Screen, SectionHeader, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { EmptyState, Skeleton } from '@/ui/feedback';
import { KpiStrip, Pill } from '@/ui/data';
import type { KpiItem, Tone } from '@/ui/data';
import { Spine, SpineRow } from '@/ui/spine';
import type { SpineTone } from '@/ui/spine';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import { clockKeyFor } from '@/lib/clockKey';

import * as api from '@/data/api';
import { fmtDay, fmtTime } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * My attendance — the clock-in history.
 *
 * This is a record ordered in time and nothing else, so it is drawn on the date-spine
 * rather than as a stack of identical cards. The gutter carries the day, the node carries
 * the outcome (closed day / still open / nothing logged), and the rule carries the fact
 * that these entries are consecutive. A card list would have said none of that.
 *
 * The times arrive from two different backend shapes (`/time-tracker/history` and the
 * older `/attendance/history`), so every timestamp goes through `timeLabel`, which falls
 * back to the raw string when it is not a parseable date. Rendering "NaN:NaN AM" would be
 * worse than showing what the server actually said.
 *
 * EMPTY IS NOT ONE STATE. Sample data is gone, so a failed fetch resolves empty. The copy
 * therefore reads `useDataHealth()` and says "could not load" during an outage and "nothing
 * logged yet" otherwise. Those two demand opposite reactions and must never look alike.
 *
 * CANCELLATION. `load` is fired by `useFocusEffect`, so it can be re-entered by a focus
 * while a pull-to-refresh is still in flight, and it can outlive the screen when the stack
 * is popped mid-request. Both are fenced: `alive` is the unmount gate and `seq` is the
 * supersession gate, and every write past an `await` clears both. Nothing is cancelled on
 * BLUR, deliberately: the component is still mounted, so letting a nearly-finished fetch
 * land leaves the screen fresher than throwing the result away would.
 * ------------------------------------------------------------------ */

/** One day of the history. Named `Entry`, not `Row`, so it cannot be confused with the
 *  layout primitive of that name imported from '@/ui/base' and used below. */
type Entry = { date: string; inTime?: string; outTime?: string; location?: string };

type Group = { key: string; label: string; rows: Entry[]; offset: number };

/** Shape written by the clock-in ring on the Today tab. Read-only here. */
type Today = { in: boolean; time?: string; place?: string };

const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const stamp = (v?: string): number => {
  if (!v) return NaN;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : NaN;
};

/** A clock time, or the server's raw string when it is not a parseable date. */
function timeLabel(v?: string): string {
  if (!v) return '';
  return Number.isNaN(stamp(v)) ? v.trim() : fmtTime(v);
}

/** Short day for the spine gutter. 48pt wide, so "29 Jul" is the budget. */
function dayLabel(v?: string): string {
  if (!v) return '';
  return Number.isNaN(stamp(v)) ? v.trim() : fmtDay(v);
}

/** Hours worked, only when both ends are real timestamps. Never estimated. */
function workedLabel(a?: string, b?: string): string {
  const t1 = stamp(a);
  const t2 = stamp(b);
  if (Number.isNaN(t1) || Number.isNaN(t2) || t2 <= t1) return '';
  const mins = Math.round((t2 - t1) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function monthOf(v?: string): { key: string; label: string } {
  const t = stamp(v);
  if (Number.isNaN(t)) return { key: 'undated', label: 'Undated entries' };
  const d = new Date(t);
  return { key: `${d.getFullYear()}-${d.getMonth()}`, label: `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}` };
}

/* ---------- loading shape ----------
 * Deliberately shaped like the spine below it (gutter, rail, two text lines) so the page
 * does not jump when the history lands. A centred spinner would hold no layout at all. */
function SpineSkeleton() {
  const c = useTheme();
  return (
    <View>
      {Array.from({ length: 5 }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row' }}>
          <View style={{ width: 48, alignItems: 'flex-end', paddingRight: 10, paddingTop: 1 }}>
            <Skeleton width={36} height={10} />
          </View>
          <View style={{ width: 18, alignItems: 'center' }}>
            <View style={{
              width: 9, height: 9, borderRadius: 4.5, marginTop: 3,
              backgroundColor: c.card, borderWidth: 2, borderColor: c.spine,
            }} />
            {i < 4 ? (
              <View style={{ flex: 1, width: 1.5, backgroundColor: c.spine, marginTop: 4, borderRadius: 1 }} />
            ) : null}
          </View>
          <View style={{ flex: 1, paddingLeft: 12, paddingBottom: i === 4 ? 2 : 18, gap: spacing.sm }}>
            <Skeleton width="54%" height={13} />
            <Skeleton width="76%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function Attendance() {
  const c = useTheme();
  const t = useT();
  const router = useRouter();
  const health = useDataHealth();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<Entry[]>([]);
  const [today, setToday] = useState<Today | null>(null);

  /** Unmount gate. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  /** Supersession gate: only the newest run may write. */
  const seq = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    const my = ++seq.current;
    const current = () => alive.current && my === seq.current;

    if (isRefresh) setRefreshing(true);
    try {
      // A storage read can reject on a locked device, and a half-written entry can fail to
      // parse. Neither is a reason to lose the history below it.
      const saved = await AsyncStorage.getItem(clockKeyFor(user?.id)).catch(() => null);
      if (!current()) return;
      let mark: Today | null = null;
      if (saved) {
        try { mark = JSON.parse(saved) as Today; } catch { mark = null; }
      }
      setToday(mark);

      const hist = await api.getAttendanceHistory();
      if (!current()) return;
      const list = Array.isArray(hist) ? hist : [];
      setRows(list.map((h: any) => ({
        date: h.date || h.day || '',
        inTime: h.clock_in?.time || h.clockIn,
        outTime: h.clock_out?.time || h.clockOut,
        location: h.clock_in?.location || h.location,
      })));
    } catch {
      // api.* already resolves empty and reports the outage to data/health, so there is
      // nothing to invent here. The empty state below reads that flag and says which of
      // the two empties this is.
      if (current()) setRows([]);
    } finally {
      if (current()) { setLoading(false); setRefreshing(false); }
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  /** Newest first, then split by month so the spine reads as a real calendar record. */
  const groups = useMemo<Group[]>(() => {
    const sorted = [...rows].sort((a, b) => {
      const ta = stamp(a.date);
      const tb = stamp(b.date);
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });
    const out: Group[] = [];
    let seen = 0;
    for (const r of sorted) {
      const m = monthOf(r.date);
      const tail = out[out.length - 1];
      if (tail && tail.key === m.key) tail.rows.push(r);
      else { out.push({ key: m.key, label: m.label, rows: [r], offset: seen }); }
      seen += 1;
    }
    return out;
  }, [rows]);

  const { logged, closed } = useMemo(() => ({
    logged: rows.reduce((n, r) => (r.inTime ? n + 1 : n), 0),
    closed: rows.reduce((n, r) => (r.inTime && r.outTime ? n + 1 : n), 0),
  }), [rows]);

  const kpis = useMemo<KpiItem[]>(() => [
    { label: 'Days logged', value: String(logged), icon: 'calendar', tone: 'primary' },
    { label: 'Closed days', value: String(closed), icon: 'checkmark-done', tone: closed > 0 ? 'success' : 'neutral' },
  ], [logged, closed]);

  const clockedAt = today?.in ? timeLabel(today.time) : '';

  const retry = useCallback(() => { haptics.tap(); void load(true); }, [load]);

  return (
    <Screen>
      <Header title="My attendance" subtitle="Your GPS clock-in history" back />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { void load(true); }}
            tintColor={c.primary}
            colors={[c.primary]}
          />
        }
      >
        {/* These same days drive your pay — one tap to the self-view earnings screen (Phase 16). */}
        <Card onPress={() => router.push('/earnings' as Href)}>
          <Row style={{ alignItems: 'center', gap: spacing.md }}>
            <View style={{
              width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.cardAlt,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="wallet-outline" size={20} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={font.body} weight="700" numberOfLines={1}>My earnings</Txt>
              <Txt size={font.sub} color={c.muted} numberOfLines={1}>Your pay for the month, from these days</Txt>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.faint} />
          </Row>
        </Card>

        {loading ? (
          <>
            <Card>
              <Row style={{ gap: spacing.lg }}>
                <Skeleton width={46} height={46} radius={15} />
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <Skeleton width="30%" height={10} />
                  <Skeleton width="58%" height={20} />
                  <Skeleton width="46%" height={11} />
                </View>
                <Skeleton width={62} height={22} radius={radius.pill} />
              </Row>
            </Card>
            <SpineSkeleton />
          </>
        ) : (
          <>
            <Appear distance={12}>
              <Card>
                <Row style={{ gap: spacing.lg }}>
                  <View style={{
                    width: 46, height: 46, borderRadius: 15,
                    backgroundColor: today?.in ? c.successSoft : c.cardAlt,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons
                      name={today?.in ? 'checkmark-circle' : 'time-outline'}
                      size={24}
                      color={today?.in ? c.success : c.faint}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Eyebrow>{t('common.today')}</Eyebrow>
                    {today?.in && clockedAt ? (
                      <Metric value={clockedAt} size={font.h2} style={{ marginTop: 2 }} />
                    ) : (
                      <Txt size={font.h3} weight="700" style={{ marginTop: 3 }} numberOfLines={1}>
                        {today?.in ? 'Clocked in' : 'Not clocked in'}
                      </Txt>
                    )}
                    <Txt size={font.sub} color={c.muted} numberOfLines={1} style={{ marginTop: 2 }}>
                      {today?.in
                        ? (today.place || 'Location not recorded')
                        : 'Clock in from the Today tab to start the day.'}
                    </Txt>
                  </View>

                  {today?.in ? <Pill label="Present" tone="success" small /> : null}
                </Row>
              </Card>
            </Appear>

            {rows.length > 0 ? (
              <Appear index={1} distance={12}>
                <KpiStrip items={kpis} />
              </Appear>
            ) : null}

            {rows.length === 0 ? (
              <Appear index={1} distance={12}>
                <Card>
                  {health.degraded ? (
                    <EmptyState
                      icon="cloud-offline-outline"
                      title="Attendance could not load"
                      subtitle="The server did not answer, so this history is unconfirmed rather than empty."
                      action={{ label: 'Try again', onPress: retry }}
                    />
                  ) : (
                    <EmptyState
                      icon="calendar-outline"
                      title="No clock-in history yet"
                      subtitle="Every day you clock in appears here with its times and the location it was marked from."
                      action={{ label: 'Go to Today', onPress: () => router.push('/(tabs)/home') }}
                    />
                  )}
                </Card>
              </Appear>
            ) : (
              groups.map((g, gi) => (
                <View key={g.key}>
                  <Appear index={2 + gi} distance={8}>
                    <SectionHeader title={g.label} />
                  </Appear>

                  <Spine>
                    {g.rows.map((r, i) => {
                      const inAt = timeLabel(r.inTime);
                      const outAt = timeLabel(r.outTime);
                      const worked = workedLabel(r.inTime, r.outTime);

                      const state: 'closed' | 'open' | 'none' =
                        inAt && outAt ? 'closed' : inAt ? 'open' : 'none';

                      const tone: SpineTone =
                        state === 'closed' ? 'success' : state === 'open' ? 'warning' : 'neutral';
                      const pillTone: Tone =
                        state === 'closed' ? 'success' : state === 'open' ? 'warning' : 'neutral';
                      const icon: IconName =
                        state === 'closed' ? 'checkmark-circle'
                          : state === 'open' ? 'time-outline'
                            : 'ellipse-outline';

                      const title =
                        state === 'closed' ? `${inAt} to ${outAt}`
                          : state === 'open' ? `In at ${inAt}`
                            : 'No clock-in recorded';

                      const subtitle = [worked, r.location].filter(Boolean).join(' · ');

                      return (
                        <SpineRow
                          key={`${g.key}-${r.date}-${i}`}
                          index={g.offset + i}
                          last={i === g.rows.length - 1}
                          time={dayLabel(r.date)}
                          title={title}
                          subtitle={subtitle || undefined}
                          tone={tone}
                          icon={icon}
                          right={
                            <Pill
                              label={state === 'closed' ? 'Full day' : state === 'open' ? 'Open' : 'No entry'}
                              tone={pillTone}
                              small
                            />
                          }
                        />
                      );
                    })}
                  </Spine>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
