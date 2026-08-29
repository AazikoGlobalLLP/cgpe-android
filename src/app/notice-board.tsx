import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Metric, Screen, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Chips } from '@/ui/controls';
import { EmptyState, Skeleton } from '@/ui/feedback';
import { DataRow, ListSection, Pill } from '@/ui/data';
import type { Tone } from '@/ui/data';
import { Sheet } from '@/ui/sheet';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import { fmtDate, fmtDay, fmtTime, timeAgo } from '@/lib/format';
import { getHealth } from '@/data/health';
import * as api from '@/data/api';
import { useT, type TFn, type TKey } from '@/i18n';

/* ------------------------------------------------------------------ *
 * Notice Board — the firm talking to the field. READ ONLY.
 *
 * This is the counterpart to /notes and is deliberately built from different material.
 * Notes is a stack of your own jottings you can write, pin and delete. This is a bulletin:
 * you cannot post to it, cannot edit it and cannot remove anything from it. Only admins
 * write here, so every affordance that would imply otherwise is absent, and the screen
 * leads with STRUCTURE (grouped sections, a pinned block, dated events) rather than with a
 * composer.
 *
 * WHAT MAKES IT A BULLETIN AND NOT A FEED. A flat reverse-chronological list is what a
 * notepad looks like. Here the notices are grouped by what they ARE — pinned first, then
 * events, meetings, announcements, policy, holidays — because "when is the branch meeting"
 * and "what changed in the policy" are different questions asked on different days.
 *
 * THE DATED ONES CARRY THEIR DATE ON THE ROW. An event or a meeting is only useful if you
 * can see when it is without opening it, so `event_at` is rendered as a status token that
 * turns urgent inside a week and goes muted once it has passed. A past meeting is not
 * hidden: it is still the record of what was announced.
 *
 * MARKING READ. Opening a notice acknowledges it through `markNoticeRead`. The backend
 * treats that as a no-op ack and returns NO per-user read state, so the screen deliberately
 * shows no unread badges. Painting an "unread" dot from state we do not have would be an
 * invented figure of exactly the kind this app forbids.
 * ------------------------------------------------------------------ */

/**
 * The stored document carries more than `api.CompanyNotice` declares (`body`, `event_at`,
 * `location`, `audience`, `created_by`, `noticeId`). The API module is shared and off
 * limits this phase, so the extra fields are declared here as an intersection rather than
 * reached for through a cast to `any`.
 */
type NoticeRow = api.CompanyNotice & {
  noticeId?: string;
  body?: string;
  event_at?: string | null;
  location?: string;
  audience?: string;
  created_by?: string;
};

type CatMeta = { label: string; group: string; tone: Tone; icon: IconName };

// Phase 84 (2026-08-29): CATEGORY holds i18n KEYS (chip label + section heading), resolved to the
// active language by catMeta(key, t) (docs/i18n §6c). The fallback for an unrecognised server
// category stays a literal — there is no key to translate an arbitrary value.
const CATEGORY: Record<string, { labelKey: TKey; groupKey: TKey; tone: Tone; icon: IconName }> = {
  event: { labelKey: 'notice.eventLabel', groupKey: 'notice.eventGroup', tone: 'accent', icon: 'calendar-outline' },
  meeting: { labelKey: 'notice.meetingLabel', groupKey: 'notice.meetingGroup', tone: 'info', icon: 'people-outline' },
  announcement: { labelKey: 'notice.announcementLabel', groupKey: 'notice.announcementGroup', tone: 'primary', icon: 'megaphone-outline' },
  policy: { labelKey: 'notice.policyLabel', groupKey: 'notice.policyGroup', tone: 'warning', icon: 'document-text-outline' },
  holiday: { labelKey: 'notice.holidayLabel', groupKey: 'notice.holidayGroup', tone: 'success', icon: 'sunny-outline' },
};

/** Reading order of the board. Anything unrecognised falls in after these. */
const GROUP_ORDER = ['event', 'meeting', 'announcement', 'policy', 'holiday'];

function catMeta(key: string, t: TFn): CatMeta {
  const c = CATEGORY[key];
  if (c) return { label: t(c.labelKey), group: t(c.groupKey), tone: c.tone, icon: c.icon };
  return { label: key || 'Notice', group: 'Other notices', tone: 'neutral', icon: 'information-circle-outline' };
}

const noticeId = (n: NoticeRow): string => String(n._id ?? n.id ?? n.noticeId ?? '');
const noticeCat = (n: NoticeRow): string => String(n.category || 'announcement');
const noticeBody = (n: NoticeRow): string => String(n.body ?? n.message ?? n.content ?? '').trim();
const noticeTitle = (n: NoticeRow): string => String(n.title || '').trim() || 'Untitled notice';
const noticeAuthor = (n: NoticeRow): string => String(n.created_by ?? n.author ?? '').trim();

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
const postedAt = (n: NoticeRow) => parseDate(n.created_at ?? n.createdAt ?? null);
const eventAt = (n: NoticeRow) => parseDate(n.event_at ?? null);

const DAY = 86400000;

/**
 * The date token on a dated notice. Urgent inside a week, muted once it has passed.
 *
 * `now` is passed in rather than read from the clock here, for two reasons. It keeps this
 * a pure function of its arguments (calling `Date.now()` during render makes the output
 * depend on when React happened to re-render), and it means every row on the board is
 * measured against ONE instant, so two meetings an hour apart can never disagree about
 * which of them is "today".
 */
function eventToken(d: Date, now: number): { label: string; tone: Tone; icon: IconName } {
  // No reference time yet (the board has not resolved). State the date, judge nothing.
  if (!(now > 0)) return { label: fmtDay(d), tone: 'neutral', icon: 'calendar-outline' };
  const delta = d.getTime() - now;
  if (delta < 0) return { label: `Was ${fmtDay(d)}`, tone: 'neutral', icon: 'time-outline' };
  const label = `${fmtDay(d)}, ${fmtTime(d)}`;
  if (delta <= 2 * DAY) return { label, tone: 'danger', icon: 'alarm-outline' };
  if (delta <= 7 * DAY) return { label, tone: 'warning', icon: 'calendar-outline' };
  return { label, tone: 'primary', icon: 'calendar-outline' };
}

type Group = { key: string; title: string; rows: NoticeRow[] };

export default function NoticeBoard() {
  const c = useTheme();
  const t = useT();
  const health = useDataHealth();

  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [cat, setCat] = useState('all');
  /**
   * The instant the board was last read, and the ONE reference time every date token on
   * the screen is judged against. Stamped when a fetch lands (never during render), so
   * "today" cannot drift between two rows or shift under a re-render.
   */
  const [asOf, setAsOf] = useState(0);

  /** Kept separate from `sheetOpen` so the notice survives the sheet's exit animation
   *  instead of blanking out halfway down the screen. */
  const [detail, setDetail] = useState<NoticeRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const live = useRef(true);
  const reqId = useRef(0);

  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);

  const load = useCallback(async (mode: 'replace' | 'refresh') => {
    const my = ++reqId.current;
    if (mode === 'replace') setLoading(true); else setRefreshing(true);

    const res = await api.getCompanyNotices();
    // A failed fetch resolves to the same empty shape as an empty board, so the failure is
    // read straight after the await while it is still the newest thing health knows about.
    const failed = getHealth().failures.includes('/notices');

    if (!live.current || my !== reqId.current) return;

    setNotices(res.data as NoticeRow[]);
    setLoadFailed(failed);
    setAsOf(Date.now());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load('replace'); }, [load]);

  const open = useCallback((n: NoticeRow) => {
    setDetail(n);
    setSheetOpen(true);
    // Acknowledgement only. Nothing comes back that the screen renders, so there is no
    // state to guard and nothing to clean up.
    const id = noticeId(n);
    if (id) void api.markNoticeRead(id);
  }, []);

  /** ORed with the live reactive signal for THIS endpoint only, so another screen's
   *  outage can never be misattributed to the board. */
  const outage = loadFailed || health.failures.includes('/notices');

  const chips = useMemo(() => {
    const tally = new Map<string, number>();
    notices.forEach((n) => {
      const k = noticeCat(n);
      tally.set(k, (tally.get(k) ?? 0) + 1);
    });
    const known = GROUP_ORDER.filter((k) => tally.has(k));
    const extra = [...tally.keys()].filter((k) => !GROUP_ORDER.includes(k));
    return [
      { key: 'all', label: t('common.all') },
      ...[...known, ...extra].map((k) => ({ key: k, label: catMeta(k, t).group, count: tally.get(k) })),
    ];
  }, [notices, t]);

  const upcoming = useMemo(
    () => (asOf === 0 ? 0 : notices.reduce((n, x) => {
      const e = eventAt(x);
      return e && e.getTime() >= asOf ? n + 1 : n;
    }, 0)),
    [notices, asOf],
  );

  /* ---------- grouping ----------
   * The server already sorts pinned first, then soonest upcoming event, then newest, and
   * a filter preserves that relative order — so grouping never has to re-sort. */
  const groups: Group[] = useMemo(() => {
    const shown = cat === 'all' ? notices : notices.filter((n) => noticeCat(n) === cat);
    const out: Group[] = [];

    const pinned = shown.filter((n) => n.pinned);
    if (pinned.length > 0) out.push({ key: '_pinned', title: 'Pinned', rows: pinned });

    const rest = shown.filter((n) => !n.pinned);
    const buckets = new Map<string, NoticeRow[]>();
    rest.forEach((n) => {
      const k = noticeCat(n);
      const list = buckets.get(k);
      if (list) list.push(n); else buckets.set(k, [n]);
    });

    const keys = [
      ...GROUP_ORDER.filter((k) => buckets.has(k)),
      ...[...buckets.keys()].filter((k) => !GROUP_ORDER.includes(k)),
    ];
    keys.forEach((k) => out.push({ key: k, title: catMeta(k, t).group, rows: buckets.get(k) ?? [] }));

    return out;
  }, [notices, cat, t]);

  const shownCount = groups.reduce((n, g) => n + g.rows.length, 0);

  const empty = outage ? (
    <EmptyState
      icon="cloud-offline-outline"
      title="The notice board could not load"
      subtitle="The server did not answer, so this is not an empty board, it is an unanswered request. Check your connection and try again."
      action={{ label: t('common.tryAgain'), onPress: () => load('replace') }}
    />
  ) : cat !== 'all' ? (
    <EmptyState
      icon="funnel-outline"
      title={`Nothing under ${catMeta(cat, t).group}`}
      subtitle="Other parts of the board still have notices on them."
      action={{ label: 'Show the whole board', onPress: () => { haptics.select(); setCat('all'); } }}
    />
  ) : (
    <EmptyState
      icon="megaphone-outline"
      title="Nothing posted yet"
      subtitle="Announcements, meetings, policy updates and holidays from the firm all land here. Only admins can post, so there is nothing for you to add."
      action={{ label: t('common.refresh'), onPress: () => load('refresh') }}
    />
  );

  return (
    <Screen>
      <Header
        title="Notice Board"
        subtitle="From the firm"
        back
        right={upcoming > 0 ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Metric value={String(upcoming)} size={font.h3} />
            <Eyebrow>Coming up</Eyebrow>
          </View>
        ) : undefined}
      />

      {!loading && !outage && notices.length > 0 && chips.length > 2 ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          <Chips
            options={chips}
            value={cat}
            onChange={(v) => { haptics.select(); setCat(v); }}
          />
        </View>
      ) : null}

      {loading ? (
        <BoardSkeleton />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xs,
            paddingBottom: spacing.xxxl,
            gap: spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={c.primary}
              colors={[c.primary]}
              progressBackgroundColor={c.card}
            />
          }
        >
          {shownCount === 0 ? empty : groups.map((g, i) => (
            <Appear key={g.key} index={i}>
              <ListSection
                title={g.title}
                footer={g.key === '_pinned' ? 'Kept at the top by the office until it is taken down.' : undefined}
              >
                {g.rows.map((n, r) => (
                  // A notice with no id at all is possible from a hand-seeded document, so
                  // the position in its group is the fallback key rather than the title.
                  <NoticeLine
                    key={noticeId(n) || `${g.key}-${r}`}
                    notice={n}
                    now={asOf}
                    onOpen={() => open(n)}
                  />
                ))}
              </ListSection>
            </Appear>
          ))}

          {shownCount > 0 ? (
            <Txt size={font.cap} color={c.faint} numeric style={{ textAlign: 'center' }}>
              {shownCount === 1 ? '1 notice on the board' : `${shownCount} notices on the board`}
            </Txt>
          ) : null}
        </ScrollView>
      )}

      <NoticeSheet
        visible={sheetOpen}
        notice={detail}
        now={asOf}
        onClose={() => setSheetOpen(false)}
      />
    </Screen>
  );
}

/* ================================================================== *
 * One notice, as a bulletin line
 * ================================================================== */

function NoticeLine({ notice, now, onOpen }: {
  notice: NoticeRow; now: number; onOpen: () => void;
}) {
  const c = useTheme();
  const t = useT();
  const meta = catMeta(noticeCat(notice), t);
  const ev = eventAt(notice);
  const token = ev ? eventToken(ev, now) : null;
  const posted = postedAt(notice);
  const author = noticeAuthor(notice);
  const body = noticeBody(notice);

  const sub = [posted ? `Posted ${timeAgo(posted)}` : null, author ? `by ${author}` : null]
    .filter(Boolean).join(' ');

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${noticeTitle(notice)}. ${meta.label}${token ? `, ${token.label}` : ''}`}
      style={({ pressed }) => [{ backgroundColor: pressed ? c.cardAlt : 'transparent' }]}
    >
      <View style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
        minHeight: 64, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      }}>
        <View style={{
          width: 34, height: 34, borderRadius: 11, marginTop: 1,
          backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={meta.icon} size={17} color={c.faint} />
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <Txt size={font.body} weight="700" numberOfLines={2}>{noticeTitle(notice)}</Txt>

          {body ? (
            <Txt size={font.sub} color={c.muted} numberOfLines={2} style={{ lineHeight: 19 }}>{body}</Txt>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
            {token ? <Pill label={token.label} tone={token.tone} icon={token.icon} small numeric /> : null}
            {notice.location ? <Pill label={String(notice.location)} tone="neutral" icon="location-outline" small /> : null}
            {notice.pinned ? <Pill label="Pinned" tone="primary" icon="pin" small /> : null}
            {sub ? <Txt size={font.tiny} color={c.faint} numberOfLines={1}>{sub}</Txt> : null}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={c.faint} style={{ marginTop: 9 }} />
      </View>
    </Pressable>
  );
}

/* ================================================================== *
 * The full notice
 * ================================================================== */

function NoticeSheet({ visible, notice, now, onClose }: {
  visible: boolean; notice: NoticeRow | null; now: number; onClose: () => void;
}) {
  const c = useTheme();
  const t = useT();
  if (!notice) return null;

  const meta = catMeta(noticeCat(notice), t);
  const ev = eventAt(notice);
  const evToken = ev ? eventToken(ev, now) : null;
  const posted = postedAt(notice);
  const author = noticeAuthor(notice);
  const body = noticeBody(notice);
  const audience = String(notice.audience ?? '').trim();
  const ref = String(notice.noticeId ?? '').trim();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={noticeTitle(notice)}
      subtitle={posted ? `${meta.label}, posted ${timeAgo(posted)}` : meta.label}
    >
      <View style={{ gap: spacing.lg, paddingTop: spacing.xs }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Pill label={meta.label} tone={meta.tone} icon={meta.icon} small />
          {evToken ? <Pill label={evToken.label} tone={evToken.tone} icon={evToken.icon} small numeric /> : null}
          {notice.pinned ? <Pill label="Pinned" tone="primary" icon="pin" small /> : null}
        </View>

        {body ? (
          <Txt size={font.body} style={{ lineHeight: 22 }}>{body}</Txt>
        ) : (
          <Txt size={font.sub} color={c.faint}>
            This notice was posted with a title only. There is no further detail on it.
          </Txt>
        )}

        <ListSection title="Details">
          {ev ? <DataRow label="When" value={`${fmtDate(ev)}, ${fmtTime(ev)}`} icon="calendar-outline" numeric /> : null}
          {notice.location ? <DataRow label="Where" value={String(notice.location)} icon="location-outline" /> : null}
          {posted ? <DataRow label="Posted" value={fmtDate(posted)} icon="time-outline" numeric /> : null}
          {author ? <DataRow label="Posted by" value={author} icon="person-circle-outline" /> : null}
          {audience && audience.toLowerCase() !== 'all' ? (
            <DataRow label="For" value={audience} icon="people-outline" />
          ) : null}
          {ref ? <DataRow label="Reference" value={ref} icon="pricetag-outline" copyable numeric /> : null}
        </ListSection>

        <Txt size={font.tiny} color={c.faint} style={{ textAlign: 'center' }}>
          Notices are posted by the office. You cannot edit or remove one from here.
        </Txt>
      </View>
    </Sheet>
  );
}

/* ================================================================== *
 * Loading — the shape of a grouped bulletin, not a spinner
 * ================================================================== */

function SkeletonLine() {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
      minHeight: 64, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    }}>
      <Skeleton width={34} height={34} radius={11} />
      <View style={{ flex: 1, gap: 7 }}>
        <Skeleton width="72%" height={14} />
        <Skeleton width="92%" height={11} />
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
          <Skeleton width={84} height={18} radius={radius.pill} />
          <Skeleton width={58} height={18} radius={radius.pill} />
        </View>
      </View>
    </View>
  );
}

function BoardSkeleton() {
  const c = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xl }}>
      {[2, 3].map((rows, g) => (
        <View key={g} style={{ gap: spacing.sm }}>
          <Skeleton width={g === 0 ? 74 : 108} height={10} style={{ marginLeft: spacing.xs }} />
          <Card padded={false}>
            <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
              {Array.from({ length: rows }, (_, i) => (
                <View key={i}>
                  {i > 0 ? (
                    <View style={{
                      height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: spacing.lg,
                    }} />
                  ) : null}
                  <SkeletonLine />
                </View>
              ))}
            </View>
          </Card>
        </View>
      ))}
    </View>
  );
}
