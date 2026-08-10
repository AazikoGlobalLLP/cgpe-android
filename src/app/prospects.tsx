import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Eyebrow, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Button, Chips, Field, SearchBar } from '@/ui/controls';
import { Banner, EmptyState, Skeleton, useToast } from '@/ui/feedback';
import { DataRow, KpiStrip, ListSection, Pill } from '@/ui/data';
import type { KpiItem, Tone } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { Sheet } from '@/ui/sheet';
import { SwipeRow } from '@/ui/swipe';
import type { SwipeAction } from '@/ui/swipe';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import * as api from '@/data/api';
import type { Prospect } from '@/data/api';
import { fmtDate } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';

/* ------------------------------------------------------------------ *
 * Recruitment prospects — a schema-agnostic pool, read defensively.
 *
 * THE COLLECTION HAS NO SCHEMA. `routes/prospects.js` reads a raw Mongo collection and
 * `services/prospectFlags.js` classifies it by keyword-scanning every string field, because
 * the documents genuinely differ from row to row: some carry `name`, some `firm`, some
 * `contact_person`; the number lives under `phone`, `mobile`, `contactNo` or `whatsapp`.
 * Every field on this screen is therefore resolved through `pick()` over a candidate key
 * list rather than being read from a fixed path, and anything that does not resolve is not
 * rendered at all. A blank DataRow is a lie about the record; a missing one is the truth.
 *
 * STAGE FILTERING IS CLIENT-SIDE, AND THE READOUT SAYS SO. `GET /api/prospects` accepts
 * page, limit and search only. It IGNORES a stage parameter, so sending one would have
 * bought a round trip against a book scan on every chip tap and returned an unfiltered page
 * that looked filtered. Search stays server-side, so it still reaches the whole pool.
 *
 * THE ACTIONS ARE THE THREE THE API CAN ACTUALLY PERFORM. `actOnProspect(id, action, note)`
 * posts `{ action, note }` and nothing else, and the backend's `stage` and `assign` actions
 * both require a `to` value that signature cannot carry (they 400 without it). Offering an
 * "advance to Meeting" control here would therefore fail every time it was pressed, so the
 * screen offers connect / note / respond, which all succeed, and leaves the two that need a
 * target to the web panel. See the note in the report.
 *
 * The buckets come from `/prospects/segments`, whose envelope is loose enough that every
 * read of it goes through a coercion helper. Nothing here trusts a field to exist.
 *
 * WHY A LIST SCREEN OPTS INTO `<Screen keyboard>`. `keyboard` is normally withheld from list
 * screens, and for a good reason (see base.tsx). It is taken here because the search field
 * sits ABOVE the roster and Android already shrinks the roster when the IME opens
 * (softwareKeyboardLayoutMode: resize) while iOS, where the keyboard overlays the window,
 * does not. Without it the last third of the results is tappable on one platform and buried
 * on the other, which is precisely the parity break this pass exists to close. Nothing
 * jumps: the rows are anchored to the top of the list, so the only edge that moves is the
 * bottom one.
 *
 * The roster stays a FlatList rather than becoming a KeyboardScroll. It is paginated over
 * the whole pool with pull-to-refresh, so swapping it for a plain scroller would throw away
 * virtualisation to fix a problem it does not have: it holds no input, and it already
 * carries keyboardShouldPersistTaps="handled" so a row tap under an open keyboard lands on
 * the first touch. The note field in the sheet is covered by Sheet's own
 * KeyboardAvoidingView, which is the only thing that can cover it: a Modal is a separate
 * window on both platforms and no parent KAV reaches inside it.
 * ------------------------------------------------------------------ */

/** One page of the pool. ~370 rows in production, so this is three or four pages. */
const PAGE = 100;
const SEARCH_DEBOUNCE = 400;

const num = (n: number) => n.toLocaleString('en-IN');
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/* ---------- coercion, because the envelope is loose ---------- */
const asStr = (v: unknown): string => (v == null ? '' : String(v).trim());
const asNum = (v: unknown): number => {
  const n = Number(asStr(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const asRec = (v: unknown): Record<string, unknown> =>
  (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

type Facet = { value: string; count: number };
const asFacets = (v: unknown): Facet[] => (Array.isArray(v)
  ? v.map(asRec).map((r) => ({ value: asStr(r.value), count: asNum(r.count) })).filter((f) => f.value)
  : []);

type FlagDef = { key: string; label: string };
const asFlagDefs = (v: unknown): FlagDef[] => (Array.isArray(v)
  ? v.map(asRec).map((r) => ({ key: asStr(r.key), label: asStr(r.label) })).filter((f) => f.key && f.label)
  : []);

/* ---------- field resolution over an unknown document ---------- */
const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '');

function pick(doc: Prospect, keys: string[]): string {
  const want = keys.map(norm);
  for (const k of Object.keys(doc)) {
    if (want.includes(norm(k))) {
      const v = asStr(doc[k]);
      if (v) return v;
    }
  }
  return '';
}

const NAME_KEYS = ['name', 'fullName', 'clientName', 'contactName', 'contact_person', 'person', 'proprietor'];
const FIRM_KEYS = ['firm', 'company', 'organization', 'business', 'party'];
const PHONE_KEYS = ['phone', 'mobile', 'phoneNumber', 'mobileNo', 'whatsapp', 'contactNo', 'contact_number', 'cell'];
const CITY_KEYS = ['city', 'town', 'location', 'district', 'area', 'place'];
const CATEGORY_KEYS = ['category', 'tier', 'segment', 'source', 'type', 'profession', 'occupation', 'industry', 'bucket'];
const OWNER_KEYS = ['owner', 'ownerName', 'assignedTo', 'contactedBy'];
const REMINDER_KEYS = ['reminderCount', 'remindersSent', 'reminders', 'noOfReminders'];
const CONTACTED_KEYS = ['contactedOn', 'lastSentOn', 'lastContacted', 'lastContactedOn'];
const RESPONSE_KEYS = ['response', 'reply', 'feedback'];
const RESPONDED_KEYS = ['respondedOn', 'responseDate', 'repliedOn'];
const NOTE_KEYS = ['notes', 'note', 'remark', 'remarks', 'comment', 'comments'];

const nameOf = (p: Prospect) => pick(p, NAME_KEYS) || pick(p, FIRM_KEYS) || 'Unnamed prospect';
const firmOf = (p: Prospect) => pick(p, FIRM_KEYS);
const phoneOf = (p: Prospect) => pick(p, PHONE_KEYS);
const stageOf = (p: Prospect) => pick(p, ['stage', 'funnelStage', 'outreachStatus', 'outreach_status', 'outreach']);
const idOf = (p: Prospect) => pick(p, ['prospectId']) || asStr(p._id) || asStr(p.id);

/** Never returns format.ts's em-dash placeholder: an unparseable value is shown verbatim. */
const niceDate = (raw: string): string => {
  if (!raw) return '';
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? raw : fmtDate(raw);
};

/* ---------- the pipeline vocabulary ----------
 * Mirrors STAGES / STAGE_META in routes/prospects.js, plus the two outreach states that
 * `prospectFlags` can surface through the same field. Anything the data invents beyond
 * this list is still rendered, just title-cased and toned neutral. */
const STAGE_META: Record<string, { label: string; tone: Tone }> = {
  not_contacted: { label: 'Not contacted', tone: 'warning' },
  prospect: { label: 'Prospect', tone: 'neutral' },
  target: { label: 'Target', tone: 'neutral' },
  contacted: { label: 'Contacted', tone: 'info' },
  responded: { label: 'Responded', tone: 'accent' },
  lead: { label: 'Lead', tone: 'primary' },
  meeting: { label: 'Meeting', tone: 'primary' },
  quotation: { label: 'Quotation', tone: 'primary' },
  documents: { label: 'Documents', tone: 'info' },
  login: { label: 'Policy login', tone: 'info' },
  won: { label: 'Won', tone: 'success' },
  hold: { label: 'Hold', tone: 'warning' },
  lost: { label: 'Lost', tone: 'danger' },
};
const STAGE_ORDER = Object.keys(STAGE_META);
const stageRank = (k: string) => {
  const i = STAGE_ORDER.indexOf(k);
  return i < 0 ? STAGE_ORDER.length : i;
};
const titleise = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
const stageLabel = (k: string) => STAGE_META[k]?.label ?? titleise(k);
const stageTone = (k: string): Tone => STAGE_META[k]?.tone ?? 'neutral';

/** The industry / wealth classification, which is what a recruiter reads the pool for. */
const COMPOSITION_FLAGS = ['hni', 'business', 'salaried', 'real_estate', 'it', 'textile', 'other', 'contactable'];

/* ================================================================== *
 * Loading — shaped like the roster it replaces
 * ================================================================== */

/** Avatar (44) + its 12pt gap + the row's 16pt gutter. */
const SEP_INSET = spacing.lg + 44 + spacing.md;

function SkeletonRow() {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, minHeight: 64,
    }}>
      <Skeleton width={44} height={44} radius={44 / 2.6} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Skeleton width="56%" height={13} />
        <Skeleton width="34%" height={11} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Skeleton width={66} height={18} radius={radius.pill} />
        <Skeleton width={48} height={11} />
      </View>
    </View>
  );
}

function RosterSkeleton() {
  const c = useTheme();
  return (
    <View style={{ backgroundColor: c.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
      {Array.from({ length: 8 }, (_, i) => (
        <View key={i}>
          {i > 0 ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: SEP_INSET }} /> : null}
          <SkeletonRow />
        </View>
      ))}
    </View>
  );
}

/* ================================================================== *
 * Row
 * ================================================================== */

function ProspectRow({ p, onOpen }: { p: Prospect; onOpen: () => void }) {
  const c = useTheme();
  const name = nameOf(p);
  const phone = phoneOf(p);
  const stage = stageOf(p).toLowerCase();
  const reminders = asNum(pick(p, REMINDER_KEYS));
  const firm = firmOf(p);

  const sub = phone || (firm && firm !== name ? firm : '') || pick(p, CITY_KEYS) || pick(p, CATEGORY_KEYS) || 'No number on record';
  const subIcon: IconName = phone ? 'call-outline'
    : firm && firm !== name ? 'business-outline'
      : sub === 'No number on record' ? 'alert-circle-outline' : 'location-outline';

  const actions: SwipeAction[] = phone ? [
    { icon: 'call', label: 'Call', tone: 'primary', onPress: () => { haptics.tap(); call(phone); } },
    {
      icon: 'logo-whatsapp', label: 'WhatsApp', tone: 'whatsapp',
      onPress: () => { haptics.tap(); whatsapp(phone, `Namaste ${name}`); },
    },
  ] : [];

  return (
    <SwipeRow actions={actions} onPress={onOpen} radius={0} surface={c.card}>
      <PersonRow
        name={name}
        subtitle={sub}
        subtitleIcon={subIcon}
        subtitleNumeric={!!phone}
        style={{ marginHorizontal: 0, paddingHorizontal: spacing.lg, borderRadius: 0 }}
        right={
          <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: 120 }}>
            {stage ? <Pill label={stageLabel(stage)} tone={stageTone(stage)} small /> : null}
            {reminders > 0 ? (
              <Txt size={11} color={c.faint} numeric numberOfLines={1}>
                {num(reminders)} {plural(reminders, 'touch', 'touches')}
              </Txt>
            ) : null}
          </View>
        }
      />
    </SwipeRow>
  );
}

/* ================================================================== *
 * Screen
 * ================================================================== */

type Mode = 'replace' | 'append' | 'refresh';
type Action = 'connect' | 'note' | 'respond';

export default function Prospects() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const toast = useToast();

  const [rows, setRows] = useState<Prospect[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('all');
  const [seg, setSeg] = useState<unknown>(null);

  const [selected, setSelected] = useState<Prospect | null>(null);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState<Action | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);

  /** Latest read wins: a slow page 1 must never overwrite a newer search. */
  const reqId = useRef(0);
  /** The unmount guard. No state is written once the screen is gone. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  /** Skips the debounce on the very first render, so the mount fetch does not fire twice. */
  const firstRun = useRef(true);
  /** Held in a ref so it can be cleared on unmount as well as before every retype. */
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------- the pool ---------- */
  const fetchPage = useCallback(async (p: number, search: string, mode: Mode) => {
    const my = ++reqId.current;
    if (mode === 'replace') setLoading(true);
    else if (mode === 'append') setLoadingMore(true);
    else setRefreshing(true);

    // `stage` is deliberately NOT sent: GET /api/prospects ignores it, so it would cost a
    // round trip and return an unfiltered page that looked filtered.
    const res = await api.getProspects({ search, page: p, limit: PAGE });
    if (!alive.current || my !== reqId.current) return;   // superseded, or unmounted

    setRows((prev) => (mode === 'append' ? [...prev, ...res.data] : res.data));
    setTotal(res.total);
    setTotalPages(res.totalPages || 1);
    setPage(res.page || p);
    setLoading(false); setLoadingMore(false); setRefreshing(false);
  }, []);

  const loadSegments = useCallback(async () => {
    const s = await api.getProspectSegments();
    if (!alive.current) return;
    setSeg(s);
  }, []);

  useEffect(() => { void fetchPage(1, '', 'replace'); }, [fetchPage]);
  useEffect(() => { void loadSegments(); }, [loadSegments]);

  /* Debounced server-side search across the whole pool. The cleanup clears the pending
   * timer both on unmount and before every retype, so a fast typist never queues a stack
   * of scans against the collection. */
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      void fetchPage(1, q.trim(), 'replace');
    }, SEARCH_DEBOUNCE);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = null;
    };
  }, [q, fetchPage]);

  const hasMore = page < totalPages;
  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && !refreshing && hasMore) {
      void fetchPage(page + 1, q.trim(), 'append');
    }
  }, [loading, loadingMore, refreshing, hasMore, fetchPage, page, q]);

  const refresh = useCallback(() => {
    void fetchPage(1, q.trim(), 'refresh');
    void loadSegments();
  }, [fetchPage, q, loadSegments]);

  /* ---------- the loose envelope, read defensively ---------- */
  const meta = useMemo(() => asRec(asRec(seg).meta), [seg]);
  const outreach = useMemo(() => asRec(meta.outreach), [meta]);
  const universe = useMemo(
    () => asNum(meta.universe) || asNum(asRec(seg).total),
    [meta, seg],
  );
  const statusFacets = useMemo(() => asFacets(meta.statusFacets), [meta]);
  const flagFacets = useMemo(() => asRec(meta.facets), [meta]);
  const flagDefs = useMemo(() => asFlagDefs(meta.flagDefs), [meta]);

  const kpis: KpiItem[] = useMemo(() => {
    const contacted = asNum(outreach.contacted);
    const notContacted = asNum(outreach.not_contacted);
    const responded = asNum(outreach.responded);
    const reminders = asNum(outreach.reminders_total);
    if (universe === 0 && contacted === 0 && notContacted === 0) return [];
    return [
      { label: 'In the pool', value: num(universe), tone: 'primary', icon: 'people' },
      { label: 'Not contacted', value: num(notContacted), tone: 'warning', icon: 'ellipse-outline' },
      { label: 'Contacted', value: num(contacted), tone: 'info', icon: 'checkmark-circle-outline' },
      { label: 'Responded', value: num(responded), tone: 'accent', icon: 'chatbubble-ellipses-outline' },
      { label: 'Touches logged', value: num(reminders), tone: 'neutral', icon: 'repeat-outline' },
    ];
  }, [outreach, universe]);

  /* ---------- stage chips ----------
   * Vocabulary comes from the pool-wide facets so a stage the pool has does not vanish
   * when it is missing from the loaded page. Counts come from the LOADED rows, because
   * that is the set the chip actually filters. */
  const stageOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const f of statusFacets) if (f.count > 0) seen.add(f.value.toLowerCase());
    const counts = new Map<string, number>();
    for (const r of rows) {
      const s = stageOf(r).toLowerCase();
      if (!s) continue;
      seen.add(s);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const keys = [...seen]
      .filter((k) => (counts.get(k) ?? 0) > 0 || k === stage)
      .sort((a, b) => stageRank(a) - stageRank(b) || a.localeCompare(b));

    return [
      { key: 'all', label: 'All', count: rows.length },
      ...keys.map((k) => ({ key: k, label: stageLabel(k), count: counts.get(k) ?? 0 })),
    ];
  }, [statusFacets, rows, stage]);

  const shown = useMemo(
    () => (stage === 'all' ? rows : rows.filter((r) => stageOf(r).toLowerCase() === stage)),
    [rows, stage],
  );

  const changeStage = useCallback((k: string) => {
    if (k === stage) return;
    haptics.select();
    setStage(k);
  }, [stage]);

  const readout = stage !== 'all'
    ? `${num(shown.length)} of ${num(rows.length)} loaded ${plural(rows.length, 'row', 'rows')} match this stage`
    : q.trim()
      ? `${num(rows.length)} ${plural(rows.length, 'match', 'matches')} loaded for "${q.trim()}"`
      : total > 0
        ? `${num(rows.length)} of ${num(total)} loaded`
        : `${num(rows.length)} loaded`;

  /* ---------- the sheet ---------- */
  const selectedId = selected ? idOf(selected) : '';

  // Pure state reset. A new prospect must not inherit the previous one's draft note or
  // its failure banner.
  useEffect(() => { setNote(''); setSheetError(null); }, [selectedId]);

  const openProspect = useCallback((p: Prospect) => setSelected(p), []);
  const closeSheet = useCallback(() => { if (!acting) setSelected(null); }, [acting]);

  const runAction = useCallback(async (action: Action) => {
    if (!selected || acting) return;

    const id = idOf(selected);
    if (!id) {
      haptics.warn();
      setSheetError('This record carries no id, so nothing can be saved against it. Open it in the web panel instead.');
      return;
    }

    const text = note.trim();
    if ((action === 'note' || action === 'respond') && !text) {
      haptics.warn();
      setSheetError('Write the note first. The server rejects an empty one.');
      return;
    }

    const who = nameOf(selected);
    setActing(action);
    setSheetError(null);

    const ok = await api.actOnProspect(id, action, text || undefined);
    if (!alive.current) return;
    setActing(null);

    if (!ok) {
      haptics.error();
      setSheetError('That did not save. You may be signed out, or the server refused the change. Nothing was recorded.');
      return;
    }

    // A confirmed write, and the only place success is earned on this screen.
    haptics.success();
    setSelected(null);
    setNote('');
    toast(
      action === 'connect' ? `Connect logged for ${who}.`
        : action === 'respond' ? `Reply recorded for ${who}.`
          : `Note saved for ${who}.`,
      'success',
    );
    // The pool is cached server-side and the action clears that cache, so both reads are
    // re-run to keep the roster and the buckets truthful.
    void fetchPage(1, q.trim(), 'refresh');
    void loadSegments();
  }, [selected, acting, note, toast, fetchPage, q, loadSegments]);

  /** Only facts the record actually carries. A blank row would misdescribe the prospect. */
  const facts = useMemo(() => {
    if (!selected) return [] as { label: string; value: string; icon: IconName; copyable?: boolean }[];
    const p = selected;
    const name = nameOf(p);
    const firm = firmOf(p);
    const reminders = asNum(pick(p, REMINDER_KEYS));

    const out: { label: string; value: string; icon: IconName; copyable?: boolean }[] = [];
    const add = (label: string, value: string, icon: IconName, copyable?: boolean) => {
      if (value) out.push({ label, value, icon, copyable });
    };

    add('Mobile', phoneOf(p), 'call-outline', true);
    if (firm && firm !== name) add('Firm', firm, 'business-outline');
    add('City', pick(p, CITY_KEYS), 'location-outline');
    add('Category', pick(p, CATEGORY_KEYS), 'pricetag-outline');
    // Stage is deliberately absent here: the toned Pill at the top of the sheet already
    // carries it, and a status repeated as flat text beside its own token reads as two
    // separate facts about the record.
    add('Owner', pick(p, OWNER_KEYS), 'person-outline');
    if (reminders > 0) add('Touches logged', num(reminders), 'repeat-outline');
    add('Last contacted', niceDate(pick(p, CONTACTED_KEYS)), 'calendar-outline');
    add('Their reply', pick(p, RESPONSE_KEYS), 'chatbubble-ellipses-outline');
    add('Replied on', niceDate(pick(p, RESPONDED_KEYS)), 'calendar-outline');
    add('On file', pick(p, NOTE_KEYS), 'document-text-outline');
    return out;
  }, [selected]);

  const composition = useMemo(() => {
    if (flagDefs.length === 0) return [] as { label: string; value: number }[];
    return flagDefs
      .filter((d) => COMPOSITION_FLAGS.includes(d.key))
      .map((d) => ({ label: d.label, value: asNum(flagFacets[d.key]) }))
      .filter((r) => r.value > 0);
  }, [flagDefs, flagFacets]);

  const selectedPhone = selected ? phoneOf(selected) : '';
  const selectedStage = selected ? stageOf(selected).toLowerCase() : '';
  const selectedTouches = selected ? asNum(pick(selected, REMINDER_KEYS)) : 0;
  /** The stage rides the Pill below, so the subtitle carries identity instead. */
  const selectedSubtitle = useMemo(() => {
    if (!selected) return undefined;
    const name = nameOf(selected);
    const firm = firmOf(selected);
    return (firm && firm !== name ? firm : '')
      || pick(selected, CITY_KEYS)
      || pick(selected, CATEGORY_KEYS)
      || 'Recruitment prospect';
  }, [selected]);

  /* ---------- three genuinely different empty states ---------- */
  const empty = (
    <EmptyState
      icon={
        stage !== 'all' ? 'funnel-outline'
          : q.trim() ? 'search-outline'
            : health.degraded ? 'cloud-offline-outline' : 'person-add-outline'
      }
      title={
        stage !== 'all' ? `Nothing loaded is at ${stageLabel(stage)}`
          : q.trim() ? `No prospect matches "${q.trim()}"`
            : health.degraded ? 'The prospect pool did not load'
              : 'No prospects in the pool yet'
      }
      subtitle={
        stage !== 'all' ? 'Stage filtering runs over the rows loaded so far. Clear the stage, or load more of the pool first.'
          : q.trim() ? 'Search runs across the whole pool and matches any field on the record, including firm, city and notes.'
            : health.degraded ? 'The server did not answer, so this is not a confirmed empty pool. Check your connection and pull to refresh.'
              : 'Recruitment targets appear here once they are added to the pool.'
      }
      action={
        stage !== 'all' ? { label: 'Show every stage', onPress: () => changeStage('all') }
          : q.trim() ? { label: 'Clear search', onPress: () => { haptics.select(); setQ(''); } }
            : { label: 'Try again', onPress: refresh }
      }
    />
  );

  const listHeader = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      {kpis.length > 0 ? (
        <KpiStrip items={kpis} contentStyle={{ paddingHorizontal: spacing.lg }} />
      ) : null}
      <Txt size={font.cap} color={c.faint} numeric numberOfLines={1} style={{ paddingHorizontal: spacing.lg }}>
        {readout}
      </Txt>
    </View>
  );

  const listFooter = (
    <View>
      {shown.length > 0 ? (
        <View style={{
          backgroundColor: c.card, paddingVertical: spacing.md, alignItems: 'center',
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
        }}>
          {loadingMore ? (
            <Skeleton width={168} height={13} />
          ) : hasMore ? (
            <Button label="Load more prospects" variant="ghost" size="sm" onPress={loadMore} />
          ) : (
            <Txt size={font.cap} color={c.faint} numeric>
              All {num(rows.length)} loaded
            </Txt>
          )}
        </View>
      ) : null}

      {composition.length > 0 ? (
        <View style={{ padding: spacing.lg }}>
          <ListSection
            title="Pool composition"
            footer="Counts are for the whole prospect pool, not only the rows loaded above. A prospect can carry more than one classification."
          >
            {composition.map((r) => (
              <DataRow key={r.label} label={r.label} value={num(r.value)} numeric />
            ))}
          </ListSection>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen keyboard>
      <Header
        title="Prospects"
        subtitle="Recruitment pipeline"
        back
        right={universe > 0 ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Metric value={num(universe)} size={font.h3} />
            <Eyebrow>In the pool</Eyebrow>
          </View>
        ) : undefined}
      />

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }}>
        <SearchBar
          value={q}
          onChange={setQ}
          placeholder="Name, firm, city or number"
        />
        {stageOptions.length > 1 ? (
          <Chips options={stageOptions} value={stage} onChange={changeStage} />
        ) : null}
      </View>

      {loading ? (
        <RosterSkeleton />
      ) : (
        <FlatList<Prospect>
          data={shown}
          keyExtractor={(p, i) => `${idOf(p) || 'row'}_${i}`}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={c.primary}
              colors={[c.primary]}
              progressBackgroundColor={c.card}
            />
          }
          ListHeaderComponent={listHeader}
          ItemSeparatorComponent={RowSeparator}
          ListEmptyComponent={empty}
          ListFooterComponent={listFooter}
          renderItem={({ item, index }) => (
            <Appear index={index}>
              <ProspectRow p={item} onOpen={() => openProspect(item)} />
            </Appear>
          )}
        />
      )}

      {/* ---------- the record, and the three things that can be done to it ---------- */}
      <Sheet
        visible={!!selected}
        onClose={closeSheet}
        title={selected ? nameOf(selected) : 'Prospect'}
        subtitle={selectedSubtitle}
        footer={
          <Button
            full
            size="lg"
            icon="checkmark-done"
            label={acting === 'connect' ? 'Logging' : 'Log a connect'}
            loading={acting === 'connect'}
            disabled={!!acting}
            onPress={() => { void runAction('connect'); }}
          />
        }
      >
        <View style={{ gap: spacing.lg, paddingTop: spacing.xs }}>
          {/* The one place the stage is stated, so the token and the record never disagree. */}
          {selectedStage || selectedTouches > 0 ? (
            <Row style={{ gap: spacing.sm, flexWrap: 'wrap' }}>
              {selectedStage ? (
                <Pill label={stageLabel(selectedStage)} tone={stageTone(selectedStage)} icon="git-branch-outline" />
              ) : (
                <Pill label="No stage recorded" tone="neutral" icon="help-circle-outline" />
              )}
              {selectedTouches > 0 ? (
                <Pill
                  label={`${num(selectedTouches)} ${plural(selectedTouches, 'touch', 'touches')} logged`}
                  tone="neutral"
                  icon="repeat-outline"
                  numeric
                />
              ) : null}
            </Row>
          ) : null}

          {sheetError ? (
            <Banner
              tone="danger"
              title="Not saved"
              message={sheetError}
              onDismiss={() => setSheetError(null)}
            />
          ) : null}

          {selectedPhone ? (
            <Row>
              <Button
                label="Call"
                icon="call"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => { if (selected) { haptics.tap(); call(selectedPhone); } }}
              />
              <Button
                label="WhatsApp"
                icon="logo-whatsapp"
                variant="whatsapp"
                style={{ flex: 1 }}
                onPress={() => {
                  if (!selected) return;
                  haptics.tap();
                  whatsapp(selectedPhone, `Namaste ${nameOf(selected)}`);
                }}
              />
            </Row>
          ) : null}

          {facts.length > 0 ? (
            <ListSection title="On record">
              {facts.map((f) => (
                <DataRow
                  key={f.label}
                  label={f.label}
                  value={f.value}
                  icon={f.icon}
                  copyable={f.copyable}
                />
              ))}
            </ListSection>
          ) : (
            <EmptyState
              icon="document-outline"
              title="Nothing else on file"
              subtitle="This record carries no number, city or classification. Logging a connect still works and is written to the activity history."
            />
          )}

          <Field
            label="Note"
            value={note}
            onChange={setNote}
            placeholder="What was said, what was agreed, what happens next"
            multiline
            hint="Saved to the activity history against your name. Required for a note or a reply, optional on a connect."
          />

          <Row>
            <Button
              label={acting === 'note' ? 'Saving' : 'Save note'}
              variant="outline"
              icon="create-outline"
              style={{ flex: 1 }}
              loading={acting === 'note'}
              disabled={!!acting || !note.trim()}
              onPress={() => { void runAction('note'); }}
            />
            <Button
              label={acting === 'respond' ? 'Saving' : 'Record a reply'}
              variant="secondary"
              icon="chatbubble-ellipses-outline"
              style={{ flex: 1 }}
              loading={acting === 'respond'}
              disabled={!!acting || !note.trim()}
              onPress={() => { void runAction('respond'); }}
            />
          </Row>

          <Txt size={font.tiny} color={c.faint} style={{ lineHeight: 16 }}>
            A connect marks the prospect contacted, credits it to you, and moves a brand new
            prospect to Contacted. Moving further down the pipeline, and handing a prospect to
            someone else, are done from the web panel.
          </Txt>
        </View>
      </Sheet>
    </Screen>
  );
}

/* ---------- roster furniture ---------- */

function RowSeparator() {
  const c = useTheme();
  return (
    <View style={{ backgroundColor: c.card }}>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: SEP_INSET }} />
    </View>
  );
}
