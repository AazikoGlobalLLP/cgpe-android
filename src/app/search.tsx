import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Header, Row, Screen, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Button, SearchBar } from '@/ui/controls';
import { Banner, EmptyState, Skeleton } from '@/ui/feedback';
import { DataRow, ListSection, Pill } from '@/ui/data';
import type { Tone } from '@/ui/data';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import { useAuth } from '@/store/auth';
import { canViewOwnClients } from '@/store/roles';

import * as api from '@/data/api';
import { getHealth } from '@/data/health';
import type { Claim, Client, Lead } from '@/data/types';
import type { Task } from '@/data/tasks';
import { TASK_STATUS, taskSearchFields } from '@/data/tasks';
import { CLAIM_STATUS, STAGE_META } from '@/data/labels';
import { inrShort } from '@/lib/format';
import {
  buildQuery, rank, GROUP_CAP, W_ID, W_SECOND, W_TEXT,
  type Field, type Hit, type Ranked,
} from '@/lib/searchScore';

/* ------------------------------------------------------------------ *
 * Global search — one box over five record types.
 *
 * WHY THIS DOES NOT CALL `api.search()`. That helper covers four collections, matches on a
 * bare `String.includes`, and drops tickets entirely. An agent looking for "8891" (the last
 * four digits of a mobile) or "CLM-2024" gets nothing from a substring test against a name.
 * So the collections are queried here, concurrently, and matched by the scorer below.
 *
 * CONCURRENCY AND PARTIAL FAILURE. Clients and tickets are searched SERVER-side (the client
 * book is ~9,000 rows and can never be pulled to the handset); leads, claims and tasks are
 * pulled once and matched locally. All of it runs under one Promise.all, and every branch
 * carries its own `.catch`, so a collection that times out degrades to an empty group rather
 * than taking the whole search down with it. `data/health` still records the failure, which
 * is what raises the outage banner.
 *
 * THE LOCAL COLLECTIONS ARE CACHED AS A PROMISE, NOT AS A VALUE. Re-pulling 500 leads plus
 * 500 claims plus the whole task overview on every debounced keystroke is the obvious way to
 * write this and it is unusable on field data. Caching the in-flight promise also means two
 * keystrokes that land inside one round trip share a single request instead of racing.
 *
 * THREE EMPTY STATES, THREE DIFFERENT SHAPES. "You have not typed anything", "nothing matched
 * what you typed" and "the server did not answer" are three different pieces of news, and
 * three centred icon-in-a-box panels differing only by wording read as the same shrug from
 * across a desk. So: the resting state is a left-aligned teaching layout with recent searches;
 * the no-match state is a bare centred panel naming the query; the outage state leads with a
 * Banner carrying a retry. They cannot be confused for one another.
 *
 * THE DEBOUNCE OWNS ONE TIMER, IN A REF. Cleared before each retype and on unmount, and a
 * monotonic request id orphans any response a newer keystroke has already superseded.
 * ------------------------------------------------------------------ */

/** Long enough that a fast typist fires one request, short enough to feel live. */
const DEBOUNCE_MS = 300;
const TICKET_FETCH = 40;
const RECENT_MAX = 6;
/** How long a pulled copy of leads/claims/tasks may back a search before it is re-pulled. */
const BULK_TTL_MS = 90_000;

/* ================================================================== *
 * The scorer is now shared with the Tasks tab — `@/lib/searchScore` (pure, unit-tested).
 * `buildQuery`/`tierFor`/`bestHit`/`rank` and the tier/weight constants live there; only the
 * per-domain field lists stay here (they know the shape of a Client/Lead/Claim/Ticket).
 * ================================================================== */

/* ---------- the identifying fields of each record type ---------- */

const clientFields = (cl: Client): Field[] => {
  const p = cl.policies[0];
  const policyNo = p && p.number && p.number !== '-' ? p.number : '';
  return [
    { key: 'name', value: cl.name, weight: W_ID },
    { key: 'mobile', value: cl.phone, weight: W_ID },
    { key: 'policy', value: policyNo, weight: W_ID },
    { key: 'email', value: cl.email || '', weight: W_SECOND },
    { key: 'family', value: cl.family || '', weight: W_SECOND },
    { key: 'city', value: cl.city, weight: W_TEXT },
    { key: 'plan', value: p?.plan || '', weight: W_TEXT },
  ];
};

const leadFields = (l: Lead): Field[] => [
  { key: 'name', value: l.name, weight: W_ID },
  { key: 'mobile', value: l.phone, weight: W_ID },
  { key: 'interest', value: l.interest, weight: W_SECOND },
  { key: 'city', value: l.city, weight: W_TEXT },
  { key: 'source', value: l.source, weight: W_TEXT },
  { key: 'note', value: l.notes[0]?.text || '', weight: W_TEXT },
  { key: 'next action', value: l.nextAction || '', weight: W_TEXT },
];

const claimFields = (cl: Claim): Field[] => [
  { key: 'reference', value: cl.ref, weight: W_ID },
  { key: 'name', value: cl.clientName, weight: W_ID },
  { key: 'mobile', value: cl.clientPhone, weight: W_ID },
  { key: 'policy', value: cl.policyNumber, weight: W_ID },
  { key: 'insurer', value: cl.insurer, weight: W_TEXT },
  { key: 'type', value: cl.type, weight: W_TEXT },
  { key: 'note', value: cl.aiSummary || '', weight: W_TEXT },
];

// `taskSearchFields` is imported from `@/data/tasks` — the single definition the Tasks-tab
// local search shares, so the two search surfaces score a task identically.

const ticketFields = (t: api.Ticket): Field[] => [
  { key: 'reference', value: t.ticket_ref || '', weight: W_ID },
  { key: 'name', value: t.client?.name || '', weight: W_ID },
  { key: 'mobile', value: t.client?.phone || '', weight: W_ID },
  { key: 'policy', value: t.policy_no || '', weight: W_ID },
  { key: 'task', value: t.task || '', weight: W_SECOND },
  { key: 'reason', value: t.reason || '', weight: W_SECOND },
  { key: 'request', value: t.request_text || '', weight: W_TEXT },
  { key: 'type', value: t.type_label || '', weight: W_TEXT },
  { key: 'owner', value: t.owner?.name || '', weight: W_TEXT },
  { key: 'category', value: t.category || '', weight: W_TEXT },
];

/* ================================================================== *
 * Fetching
 * ================================================================== */

type Bulk = { leads: Lead[]; claims: Claim[]; tasks: Task[] };
const EMPTY_BULK: Bulk = { leads: [], claims: [], tasks: [] };

type Results = {
  clients: Ranked<Client>[];
  leads: Ranked<Lead>[];
  claims: Ranked<Claim>[];
  tickets: Ranked<api.Ticket>[];
  tasks: Ranked<Task>[];
};

const NOTHING: Results = { clients: [], leads: [], claims: [], tickets: [], tasks: [] };

/** Shared empty history, so "no recents" keeps a stable identity across renders. */
const NO_RECENT: string[] = [];

/* ================================================================== *
 * Presentation
 * ================================================================== */

type ResultRow = {
  id: string;
  icon: IconName;
  label: string;
  value: string;
  pill?: { label: string; tone: Tone };
  onPress: () => void;
};

type ResultGroup = {
  key: string;
  title: string;
  /** Canonical order, used only to break a tie between two equally strong groups. */
  order: number;
  top: number;
  rows: ResultRow[];
};

/** Category glyphs for task rows. Unlisted categories fall back to the generic checkbox. */
const TASK_ICON: Record<string, IconName> = {
  Claim: 'shield-half-outline',
  Renewal: 'refresh-circle-outline',
  Documentation: 'document-text-outline',
  'Follow-up': 'call-outline',
  Meeting: 'people-outline',
  Training: 'school-outline',
  Onboarding: 'person-add-outline',
  Collection: 'cash-outline',
};

/** Free text (a note, a dictated request) has no business running to four lines in a row. */
function clip(s: string, n = 54): string {
  const t = s.trim().replace(/\s+/g, ' ');
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

/**
 * What the row shows on the right.
 *
 * When the hit landed somewhere OTHER than the record's name, that field is shown instead of
 * the default, because it is the answer to "why is this in my results?". Searching four
 * digits and getting back a list of names with no numbers on it is the single most annoying
 * thing a search screen can do.
 */
function detailFor(hit: Hit | null, fallback: string): string {
  if (hit && hit.field.key !== 'name') return clip(hit.field.value);
  return fallback;
}

function ticketTone(t: api.Ticket): Tone {
  if (t.is_closed) return 'neutral';
  const zone = String(t.zone || '').toLowerCase();
  if (zone === 'red') return 'danger';
  if (zone === 'amber') return 'warning';
  if (zone === 'green') return 'success';
  return 'info';
}

export default function Search() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const { user, viewAs } = useAuth();
  // Point 9 (owner decision, 2026-08-24): the client book is master/admin-only, so a team-tier
  // user's search never queries or shows clients (search fetches clients independently of the
  // hidden Clients tab — this closes that leak). Other collections are their own scope.
  // A sales-department advisor may search the client book too, but the server scopes it to their
  // OWN clients (P90/D-117); master/admin/leader get the full book. Whole-book search groups
  // (segments/families) are not part of this — those stay master/admin only.
  const canClients = canViewOwnClients(user, viewAs);

  const [q, setQ] = useState('');
  const [res, setRes] = useState<Results>(NOTHING);
  const [searching, setSearching] = useState(false);
  /** The query the rows on screen belong to, so a count never describes a stale list. */
  const [ran, setRan] = useState('');
  /**
   * Did the search THAT PRODUCED THE ROWS ON SCREEN lose a collection?
   *
   * `useDataHealth().degraded` is app-wide and sticky until something succeeds, so an
   * unrelated screen's failure minutes ago would turn a genuine "nothing matched" into
   * "check your connection" and send the user chasing a network problem they do not have.
   * This flag is derived per run from the health clock, so it describes this query only.
   */
  const [runFailed, setRunFailed] = useState(false);
  /**
   * Recent searches, TAGGED WITH THE ACCOUNT THEY BELONG TO.
   *
   * Storing the owner alongside the list, and comparing it during render, is what makes the
   * shared-handset case airtight: when the signed-in user changes, the previous person's
   * search terms stop rendering on the very first frame. Clearing them from an effect instead
   * would paint them once before the effect ran.
   */
  const [recentStore, setRecentStore] = useState<{ key: string | null; list: string[] }>(
    { key: null, list: [] },
  );

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Monotonic request id. Anything but the newest response is dropped on arrival. */
  const reqId = useRef(0);
  const alive = useRef(true);
  /** The last trimmed term we scheduled, so a trailing space cannot restart the search. */
  const lastScheduled = useRef('');
  const bulkRef = useRef<{ at: number; promise: Promise<Bulk> } | null>(null);
  /** Mirror of `recentStore`, so a writer never has to read state it may not have seen yet. */
  const recentRef = useRef<{ key: string | null; list: string[] }>({ key: null, list: [] });

  const stopTimer = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);

  // Set on mount as well as cleared on unmount: a remount reuses the same ref, and a ref that
  // is only ever flipped to false would leave the second mount unable to store results.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    };
  }, []);

  /* ---------------- recent searches, scoped to the signed-in user ---------------- */

  /**
   * These handsets are shared between staff, so a device-wide history would hand the next
   * person the previous person's client names. The key carries the user id, and an account
   * whose id will not survive sanitising simply gets no history rather than a shared one.
   * SecureStore only accepts alphanumerics, dot, dash and underscore in a key.
   */
  const recentKey = useMemo(() => {
    const id = String(user?.id ?? '').replace(/[^A-Za-z0-9._-]/g, '');
    return id ? `cgpe.search.recent.${id}` : null;
  }, [user?.id]);

  /** Only ever the CURRENT account's terms. A key mismatch reads as no history at all. */
  const recent = recentKey && recentStore.key === recentKey ? recentStore.list : NO_RECENT;

  const commitRecent = useCallback((key: string, list: string[]) => {
    recentRef.current = { key, list };
    setRecentStore(recentRef.current);
  }, []);

  useEffect(() => {
    if (!recentKey) return;
    let cancelled = false;
    void (async () => {
      const raw = await storage.get(recentKey);
      if (cancelled || !alive.current) return;
      let list: string[] = [];
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            list = parsed
              .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
              .slice(0, RECENT_MAX);
          }
        } catch {
          // A corrupt entry is not worth surfacing; it just means no history this session.
        }
      }
      commitRecent(recentKey, list);
    })();
    return () => { cancelled = true; };
  }, [recentKey, commitRecent]);

  const rememberSearch = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean || !recentKey) return;
    const prev = recentRef.current.key === recentKey ? recentRef.current.list : NO_RECENT;
    const next = [clean, ...prev.filter((x) => x.toLowerCase() !== clean.toLowerCase())]
      .slice(0, RECENT_MAX);
    commitRecent(recentKey, next);
    void storage.set(recentKey, JSON.stringify(next));
  }, [recentKey, commitRecent]);

  const clearRecent = useCallback(() => {
    haptics.tap();
    if (!recentKey) return;
    commitRecent(recentKey, []);
    void storage.remove(recentKey);
  }, [recentKey, commitRecent]);

  /* ---------------- fetching ---------------- */

  /**
   * Leads, claims and tasks in one shot, cached as a PROMISE so concurrent keystrokes share
   * a single round trip. Each branch catches its own failure, so the combined promise cannot
   * reject and a cached rejection can never poison later searches.
   */
  const loadBulk = useCallback((fresh = false): Promise<Bulk> => {
    const cached = bulkRef.current;
    if (!fresh && cached && Date.now() - cached.at < BULK_TTL_MS) return cached.promise;
    const promise = Promise.all([
      api.getLeads().catch(() => [] as Lead[]),
      api.getClaims().catch(() => [] as Claim[]),
      api.getTasks(false).catch(() => [] as Task[]),
    ])
      .then(([leads, claims, tasks]) => ({ leads, claims, tasks }))
      .catch(() => EMPTY_BULK);
    bulkRef.current = { at: Date.now(), promise };
    return promise;
  }, []);

  const runSearch = useCallback((term: string, fresh = false) => {
    const my = ++reqId.current;
    setSearching(true);
    void (async () => {
      const query = buildQuery(term);
      // Phone and policy lookups reach the backend as bare digits: the book stores mobiles
      // without the country code or the spacing a person types.
      const serverTerm = query.numeric ? query.digits : term;
      // `health.at` is stamped by every reported failure. Snapshotting it here and comparing
      // afterwards is what tells us whether THIS search lost a collection, rather than
      // whether the app has failed at any point since launch.
      const healthMark = getHealth().at;

      const [clientItems, ticketItems, bulk] = await Promise.all([
        // Point 9: a user without client-book access never fetches clients (the search box is
        // otherwise an open door to the whole book, independent of the hidden Clients tab).
        canClients
          ? api.getClientsPage(1, serverTerm).then((p) => p.items).catch(() => [] as Client[])
          : Promise.resolve([] as Client[]),
        api.getTickets({ search: serverTerm, limit: TICKET_FETCH }).then((p) => p.data).catch(() => [] as api.Ticket[]),
        loadBulk(fresh),
      ]);

      if (!alive.current || my !== reqId.current) return;

      const next: Results = {
        clients: rank(clientItems, query, clientFields, true),
        leads: rank(bulk.leads, query, leadFields),
        claims: rank(bulk.claims, query, claimFields),
        tickets: rank(ticketItems, query, ticketFields, true),
        tasks: rank(bulk.tasks, query, taskSearchFields),
      };
      setRes(next);
      setRan(term);
      // The at-delta tells us if THIS run stamped a NEW failure — but the leads/claims/tasks bulk is
      // served from a 90s cache, so a bulk that FAILED on an earlier query and is still down re-serves
      // its empty result WITHOUT re-stamping `at`, and the delta misses it → a real outage would render
      // as "found nothing". The health failures list is sticky until that endpoint itself succeeds, so
      // also fail the run when a bulk collection is currently known-down (loophole audit round 3).
      const bulkDown = getHealth().failures.some((k) => k === '/leads' || k === '/claims' || k === '/tasks');
      setRunFailed(getHealth().at !== healthMark || bulkDown);
      setSearching(false);

      const found = next.clients.length + next.leads.length + next.claims.length
        + next.tickets.length + next.tasks.length;
      // Only a term that actually found something is worth offering back. Remembering typos
      // turns the resting screen into a list of the user's mistakes.
      if (found > 0) rememberSearch(term);
    })();
  }, [loadBulk, rememberSearch, canClients]);

  const term = q.trim();

  /**
   * Typing is an event, so everything it implies happens here rather than in an effect: the
   * timer is cleared before the next one is armed, the pending flag goes up on the same tick
   * as the keystroke, and emptying the box resets the screen immediately.
   */
  const onQuery = useCallback((next: string) => {
    setQ(next);
    const nextTerm = next.trim();
    // A keystroke that leaves the TRIMMED term unchanged (a trailing space) must not restart
    // anything, or it would orphan the request already in flight for the same term.
    if (nextTerm === lastScheduled.current) return;
    lastScheduled.current = nextTerm;
    stopTimer();
    reqId.current += 1;                 // orphan whatever is still in flight
    if (!nextTerm) {
      setRes(NOTHING);
      setRan('');
      setRunFailed(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      runSearch(nextTerm);
    }, DEBOUNCE_MS);
  }, [runSearch, stopTimer]);

  /** Submit, or a tap on a remembered term: skip the debounce entirely. */
  const submitNow = useCallback((next: string) => {
    const clean = next.trim();
    setQ(next);
    lastScheduled.current = clean;
    stopTimer();
    if (!clean) {
      reqId.current += 1;
      setRes(NOTHING);
      setRan('');
      setRunFailed(false);
      setSearching(false);
      return;
    }
    runSearch(clean);
  }, [runSearch, stopTimer]);

  const retry = useCallback(() => {
    haptics.tap();
    stopTimer();
    if (term) runSearch(term, true);
  }, [term, runSearch, stopTimer]);

  /* ---------------- rows ---------------- */

  const groups = useMemo<ResultGroup[]>(() => {
    const out: ResultGroup[] = [];

    if (res.clients.length > 0) {
      out.push({
        key: 'clients',
        title: `Clients (${res.clients.length})`,
        order: 0,
        top: res.clients[0].score,
        rows: res.clients.map(({ item, hit }, i) => ({
          id: `client-${item.id}-${i}`,
          icon: 'person-outline',
          label: item.name || 'Unnamed client',
          value: detailFor(
            hit,
            item.totalCover > 0 ? `${inrShort(item.totalCover)} cover` : (item.phone || item.city || 'On your book'),
          ),
          onPress: () => router.push({ pathname: '/client/[id]', params: { id: item.id } }),
        })),
      });
    }

    if (res.leads.length > 0) {
      out.push({
        key: 'leads',
        title: `Leads (${res.leads.length})`,
        order: 1,
        top: res.leads[0].score,
        rows: res.leads.map(({ item, hit }, i) => {
          const st = STAGE_META[item.stage] ?? STAGE_META.new_lead;
          return {
            id: `lead-${item.id}-${i}`,
            icon: 'person-add-outline',
            label: item.name || 'Unnamed lead',
            value: detailFor(hit, item.interest || item.source || item.city || ''),
            pill: { label: st.label, tone: st.tone as Tone },
            onPress: () => router.push({ pathname: '/lead/[id]', params: { id: item.id } }),
          };
        }),
      });
    }

    if (res.claims.length > 0) {
      out.push({
        key: 'claims',
        title: `Claims (${res.claims.length})`,
        order: 2,
        top: res.claims[0].score,
        rows: res.claims.map(({ item, hit }, i) => {
          const st = CLAIM_STATUS[item.status] ?? CLAIM_STATUS.intake;
          return {
            id: `claim-${item.id}-${i}`,
            icon: 'shield-half-outline',
            label: item.clientName || item.ref || 'Claim',
            value: detailFor(hit, item.ref || (item.amount > 0 ? inrShort(item.amount) : '')),
            pill: { label: st.label, tone: st.tone as Tone },
            onPress: () => router.push({ pathname: '/claim/[id]', params: { id: item.id } }),
          };
        }),
      });
    }

    if (res.tickets.length > 0) {
      out.push({
        key: 'tickets',
        title: `Tickets (${res.tickets.length})`,
        order: 3,
        top: res.tickets[0].score,
        rows: res.tickets.map(({ item, hit }, i) => ({
          id: `ticket-${item.id}-${i}`,
          icon: 'ticket-outline',
          label: item.client?.name || item.ticket_ref || 'Ticket',
          value: detailFor(hit, item.ticket_ref || item.type_label || ''),
          pill: { label: item.status_label || (item.is_closed ? 'Closed' : 'Open'), tone: ticketTone(item) },
          onPress: () => router.push({ pathname: '/tickets/[id]', params: { id: item.id } }),
        })),
      });
    }

    if (res.tasks.length > 0) {
      out.push({
        key: 'tasks',
        title: `Tasks (${res.tasks.length})`,
        order: 4,
        top: res.tasks[0].score,
        rows: res.tasks.map(({ item, hit }, i) => {
          const st = TASK_STATUS[item.status] ?? TASK_STATUS.todo;
          return {
            id: `task-${item.id}-${i}`,
            icon: TASK_ICON[item.category] ?? 'checkbox-outline',
            label: item.title || 'Task',
            value: detailFor(hit, item.client || item.category || ''),
            pill: { label: st.label, tone: st.tone as Tone },
            onPress: () => router.push({ pathname: '/task/[id]', params: { id: item.id } }),
          };
        }),
      });
    }

    // Strongest group first, so a claim reference puts Claims at the top and a surname puts
    // Clients there. Equal strength falls back to the canonical order.
    out.sort((a, b) => (b.top - a.top) || (a.order - b.order));
    return out;
  }, [res, router]);

  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const blank = total === 0;
  const capped = groups.some((g) => g.rows.length >= GROUP_CAP);
  /**
   * Prefer the per-run verdict. The app-wide signal is only consulted before this screen has
   * completed a search of its own, where it is the only evidence available.
   */
  const outage = ran ? runFailed : health.degraded;

  const subtitle = !term
    ? (canClients ? 'Clients, leads, claims, tickets and tasks' : 'Leads, claims, tickets and tasks')
    : searching
      ? 'Looking through your book'
      : `${total} result${total === 1 ? '' : 's'} for "${ran || term}"`;

  return (
    <Screen>
      <Header title="Search" subtitle={subtitle} back />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.md }}>
        <SearchBar
          value={q}
          onChange={onQuery}
          onSubmit={() => submitNow(q)}
          placeholder="Name, mobile, email or reference"
          autoFocus
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 48,
          gap: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {!term ? (
          /* (a) Nothing typed yet. A teaching layout, left aligned, with the user's own
                 history first. Deliberately not an EmptyState, so it can never be mistaken
                 for the two panels below. */
          <Resting recent={recent} onPick={submitNow} onClearRecent={clearRecent} canClients={canClients} />
        ) : searching && blank ? (
          <SearchSkeleton />
        ) : blank && outage ? (
          /* (c) The search did not complete. This is NOT a miss, and it must not look like
                 one, so it leads with a banner that carries the way out. */
          <View style={{ gap: spacing.lg }}>
            <Banner
              tone="offline"
              title="Search could not reach every collection"
              message="At least one request did not get an answer, so this is not a confirmed miss."
              action={{ label: 'Search again', onPress: retry }}
            />
            <EmptyState
              icon="cloud-offline-outline"
              title="Nothing confirmed"
              subtitle={`The server went quiet while looking for "${term}". A matching record may well exist. Check your connection, then run it again.`}
            />
          </View>
        ) : blank ? (
          /* (b) The search ran and genuinely found nothing. */
          <EmptyState
            icon="file-tray-outline"
            title={`No match for "${ran || term}"`}
            subtitle={`Nothing in your ${canClients ? 'clients, ' : ''}leads, claims, tickets or tasks carries that. Try a shorter piece of the name, or the last four digits of a mobile number.`}
            action={{ label: 'Clear search', onPress: () => submitNow('') }}
          />
        ) : (
          <>
            {outage ? (
              <Banner
                tone="offline"
                title="These results may be incomplete"
                message="At least one collection did not answer, so a record matching your search could be missing from this list."
                action={{ label: 'Run it again', onPress: retry }}
              />
            ) : null}

            {groups.map((g, gi) => {
              // One continuous stagger across the groups, so the page resolves top to bottom
              // rather than five blocks racing each other.
              const offset = groups.slice(0, gi).reduce((n, x) => n + x.rows.length, 0);
              return (
                <ListSection key={g.key} title={g.title}>
                  {g.rows.map((r, i) => (
                    <Appear key={r.id} index={offset + i}>
                      <DataRow
                        icon={r.icon}
                        label={r.label}
                        value={r.value}
                        onPress={r.onPress}
                        right={r.pill ? <Pill label={r.pill.label} tone={r.pill.tone} small /> : undefined}
                      />
                    </Appear>
                  ))}
                </ListSection>
              );
            })}

            {capped ? (
              <Txt size={font.tiny} color={c.faint} numberOfLines={2} style={{ marginTop: -spacing.sm }}>
                {`Showing the ${GROUP_CAP} closest matches in each group. Add a few more characters to narrow it.`}
              </Txt>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/* ================================================================== *
 * (a) Resting state — a composition, not an EmptyState
 * ================================================================== */

function Resting({ recent, onPick, onClearRecent, canClients }: {
  recent: string[];
  onPick: (term: string) => void;
  onClearRecent: () => void;
  canClients: boolean;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.lg }}>
      <Appear index={0}>
        <View style={{ gap: 6, paddingTop: spacing.sm }}>
          <Txt size={19} weight="800">Start typing to search</Txt>
          <Txt size={font.sub} color={c.muted} style={{ lineHeight: 20 }}>
            Part of a name works. So does part of a mobile number, a fragment of an email, or a
            claim or ticket reference.
          </Txt>
        </View>
      </Appear>

      {recent.length > 0 ? (
        <Appear index={1}>
          <ListSection title={`Recent searches (${recent.length})`}>
            {recent.map((r) => (
              <DataRow key={r} icon="time-outline" label={r} value="" onPress={() => { haptics.select(); onPick(r); }} />
            ))}
          </ListSection>
          <Row style={{ marginTop: spacing.sm, justifyContent: 'flex-end' }}>
            <Button label="Clear recent searches" variant="ghost" size="sm" onPress={onClearRecent} />
          </Row>
        </Appear>
      ) : null}

      <Appear index={recent.length > 0 ? 2 : 1}>
        <ListSection
          title="Where it looks"
          footer={canClients
            ? 'Clients and tickets are matched on the server, so the whole book is searched, not only what this device has loaded. Four digits or more will match a mobile number by its last digits.'
            : 'Tickets are matched on the server. Four digits or more will match a mobile number by its last digits.'}
        >
          {canClients ? <DataRow icon="person-outline" label="Clients" value="Name, mobile, policy, email" /> : null}
          <DataRow icon="person-add-outline" label="Leads" value="Name, mobile, interest" />
          <DataRow icon="shield-half-outline" label="Claims" value="Reference, name, policy" />
          <DataRow icon="ticket-outline" label="Tickets" value="Reference, name, request" />
          <DataRow icon="checkbox-outline" label="Tasks" value="Title, client, details" />
        </ListSection>
      </Appear>
    </View>
  );
}

/* ================================================================== *
 * Loading — shaped like two result groups, not a centred spinner
 * ================================================================== */

function SearchSkeleton() {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.xl }}>
      {[0, 1].map((g) => (
        <View key={g} style={{ gap: spacing.sm }}>
          <Skeleton width={92} height={10} style={{ marginLeft: spacing.xs }} />
          <View style={{
            backgroundColor: c.card,
            borderRadius: radius.lg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: c.border,
          }}>
            {[0, 1, 2].map((i) => (
              <Row key={i} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 48 }}>
                <Skeleton width={16} height={16} radius={4} />
                <Skeleton width="38%" height={12} />
                <View style={{ flex: 1 }} />
                <Skeleton width={54} height={13} />
              </Row>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
