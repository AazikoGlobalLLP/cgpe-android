import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { shadow, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Grad, Metric, Row, Screen, SectionHeader, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Button, Field, IconBtn } from '@/ui/controls';
import { Banner, EmptyState, ProgressBar, Skeleton, SkeletonCard } from '@/ui/feedback';
import type { FeedbackTone } from '@/ui/feedback';
import { Sheet } from '@/ui/sheet';
import { useConfirm } from '@/ui/Confirm';
import { ActionTile, KpiStrip, ListSection, Pill } from '@/ui/data';
import type { KpiItem, Tone } from '@/ui/data';
import { Avatar, PersonRow } from '@/ui/identity';
import { Spine, SpineRow } from '@/ui/spine';
import type { SpineTone } from '@/ui/spine';
import { Appear, useCountUp } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';

import { useAuth } from '@/store/auth';
import { DEFAULT_UI, useAppUi } from '@/store/appUi';
import { useT } from '@/i18n';
import * as api from '@/data/api';
import { getHealth } from '@/data/health';
import type { AppNotification, Claim, Lead, Reminder } from '@/data/types';
import { CATEGORY_ICON, Task, dueBucket as bucket, taskProgress, todayProgress } from '@/data/tasks';
import { CLAIM_STATUS, REMINDER_ICON, STAGE_META } from '@/data/labels';
import { fmtDay, fmtTime, inrShort, timeAgo } from '@/lib/format';
import { whatsapp } from '@/lib/actions';
import { capabilitiesOf } from '@/store/roles';
import { AdminDashboard, MasterDashboard } from '@/screens/dashboards';
import { ensureBackgroundPermission, startTracking, stopTracking } from '@/lib/tracker';
import type { TeamMember } from '@/data/team';

/* ------------------------------------------------------------------ *
 * Today — the front door, now RENDERED FROM THE ROLE CONFIG.
 *
 * The hero answers the two questions an advisor opens the app with: am I on the clock,
 * and how much of today is left. Those two facts share one card because they are one
 * thought, and the ring carries the app's single rationed use of the brand gradient (the
 * other is the active tab indicator). Clocking in is the most physical moment in the
 * product, so it is the only place `haptics.heavy` is spent.
 *
 * WHAT CHANGED. Everything below the hero used to be a hard-coded stack that keyed off
 * `caps.tier`. It is now driven by `useAppUi()`: `config.dashboard.hero` picks the hero
 * shape, and `widgets` is an ORDERED list whose order IS render order. Sales sees tasks,
 * prospects, leads and notes; Operations sees tasks, claims, notes and issues; neither is
 * spelled out here, because the role never is. The screen only knows widget keys.
 *
 * THE PRODUCT RULE THIS SCREEN MUST NOT BREAK: hiding a widget removes it from the
 * DASHBOARD, never from the app. Every route this file can reach is also reachable from
 * the More tab, no navigation target is deleted, and no data call is deleted — the
 * conditional fetches below only decide WHEN a call is worth making, so an Operations user
 * never pays for a prospects fetch they will not see.
 *
 * FAIL OPEN, ALWAYS. A layout config is presentation; authorisation lives in the API. If
 * the config never resolves (`ready` stuck false) a timeout releases the screen onto the
 * built-in layout, and any widget list that resolves EMPTY falls back to the built-in set.
 * A dashboard that renders nothing because a preferences document was malformed would be
 * indistinguishable from a broken app.
 *
 * NOTHING HERE IS INVENTED. A failed fetch resolves empty and raises the app-wide
 * HealthBanner, so every empty surface on this screen has to say WHICH kind of empty it
 * is: "no work today" and "we could not reach the server" demand opposite reactions and
 * must never look alike. `useDataHealth()` is what splits them.
 *
 * CANCELLATION. Every async path on this screen (first load, pull-to-refresh, the clock
 * toggle, the optimistic task tick, the config timeout) can outlive the frame that started
 * it. A single `mounted` ref plus a monotonic `loadSeq` gate every setState that follows an
 * await, so a backgrounded screen or a superseded refresh can never write into a dead tree
 * or clobber newer data.
 * ------------------------------------------------------------------ */

const RING = 116;
const RING_STROKE = 7;

/**
 * How long the screen waits for the layout config before giving up and rendering the
 * built-in layout. This is the fail-open clause with teeth: without it, a store that never
 * flips `ready` would leave a field agent staring at a skeleton with no way to their work.
 */
const CONFIG_WAIT_MS = 3500;

/** Fetch ceiling per widget. Widgets slice to their own `max_items` at render, so changing
 *  a role's max never invalidates a fetch. */
const FETCH_LIMIT = 25;

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

// `bucket` (dueBucket) and `todayProgress` are imported from @/data/tasks so Home and the Tasks
// tab share one definition of "which day is this due" and "today's progress" — see that module.

function isToday(iso: string | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  return startOfDay(d).getTime() === startOfDay(new Date()).getTime();
}

/** 24-hour clock for the spine gutter. The gutter is 48pt wide; "2:30 PM" does not fit. */
function hhmm(d: string): string {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

/**
 * `lib/format` renders an unparseable date as an em dash, and this app's UI copy carries
 * none. A blank gutter is also the more honest reading: the node is still on the spine,
 * we simply do not know when it lands.
 */
function dayLabel(d: string): string {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : fmtDay(dt);
}

function clockedInLine(iso: string | undefined, fallback: string): string {
  if (!iso) return fallback;
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? fallback : `Clocked in ${fmtTime(dt)}`;
}

/**
 * Capture a GPS fix (with accuracy and a reverse-geocoded place name). Returns null when
 * the user denies location: attendance is confirmed by geofence, so a clock event without
 * a fix is not something this screen may fabricate.
 *
 * Module scope on purpose — it closes over nothing, which keeps `toggleClock` stable.
 */
async function getFix(): Promise<{ lat: number; lng: number; accuracy?: number; city: string } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    let place = 'On field';
    try {
      const g = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      place = g[0]?.city || g[0]?.district || g[0]?.region || 'On field';
    } catch { place = 'Location captured'; }
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? undefined, city: place };
  } catch { return null; }
}

type ClockState = { in: boolean; time?: string; place?: string; onBreak?: boolean };

/** PHASE 52 — the break "minimum done" gate: 8h30m since clock-in, in ms. 8.5h is the payroll
 *  office-hours figure (`services/payrollEngine.js`), not an invented number. */
const MIN_SHIFT_MS = 8.5 * 60 * 60 * 1000;

/* ================================================================== *
 * Reading the role config
 *
 * Everything the store hands over is treated as UNTRUSTED SHAPE. It originates in a Mongo
 * document an admin edits through a web form, travels through a deep-merge on the server,
 * and lands here. A missing key must inherit, a malformed entry must be skipped, and
 * neither may throw — the alternative is a red screen on the app's landing route because
 * somebody typed a widget name wrong in the panel.
 * ================================================================== */

type HeroMode = 'clock_and_tasks' | 'tasks_only' | 'clock_only' | 'none';
const HERO_MODES: readonly string[] = ['clock_and_tasks', 'tasks_only', 'clock_only', 'none'];

type DashWidget = {
  key: string;
  /** `title_override` from the config, when the admin renamed the section for this role. */
  title?: string;
  /** `max_items`, clamped to the schema's 1..50. */
  max: number;
  /** Mandatory widgets cannot be hidden. This encodes the Sales/Operations product mandate. */
  mandatory: boolean;
};

const DEFAULT_MAX = 5;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Normalise the ordered widget list.
 *
 * Accepts either the documented `{ key, visible, max_items, ... }` objects or a bare array
 * of key strings, because the store is written by another hand and both are reasonable
 * shapes for it to expose. Duplicates are dropped (first wins, so order stays stable) and
 * an entry with no usable key is skipped rather than rendered as a blank section.
 *
 * A `mandatory` widget survives `visible: false`. The schema says the Admin Panel must not
 * offer that switch at all; honouring it here as well means a hand-edited document cannot
 * take a salesperson's own leads off their dashboard.
 */
function normalizeWidgets(raw: unknown): DashWidget[] {
  if (!Array.isArray(raw)) return [];
  const out: DashWidget[] = [];
  const seen = new Set<string>();

  for (const entry of raw as unknown[]) {
    let key = '';
    let visible = true;
    let title: string | undefined;
    let max = DEFAULT_MAX;
    let mandatory = false;

    if (typeof entry === 'string') {
      key = entry.trim();
    } else if (isRecord(entry)) {
      key = typeof entry.key === 'string' ? entry.key.trim() : '';
      visible = entry.visible !== false;
      const override = entry.title_override;
      if (typeof override === 'string' && override.trim()) title = override.trim();
      const items = entry.max_items;
      if (typeof items === 'number' && Number.isFinite(items)) {
        max = Math.max(1, Math.min(50, Math.floor(items)));
      }
      mandatory = entry.mandatory === true;
    }

    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (!visible && !mandatory) continue;
    out.push({ key, title, max, mandatory });
  }
  return out;
}

/** Dig the widget array out of a config-shaped object, wherever the store keeps it. */
function readWidgetSource(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw;
  if (isRecord(raw)) {
    const dash = raw.dashboard;
    if (isRecord(dash) && Array.isArray(dash.widgets)) return dash.widgets;
    if (Array.isArray(raw.widgets)) return raw.widgets;
  }
  return null;
}

function readHero(raw: unknown): HeroMode {
  const dash = isRecord(raw) ? raw.dashboard : undefined;
  const hero = isRecord(dash) ? dash.hero : undefined;
  return typeof hero === 'string' && HERO_MODES.includes(hero) ? (hero as HeroMode) : 'clock_and_tasks';
}

/**
 * The layout this screen shipped with, and the last line of defence.
 *
 * Reached only when both the live config AND `DEFAULT_UI` resolve to nothing. It is
 * deliberately the pre-config behaviour, so a total config failure looks like the app
 * always did rather than like a bug.
 */
const BUILT_IN_WIDGETS: DashWidget[] = [
  { key: 'kpi_strip', max: 4, mandatory: false },
  { key: 'quick_actions', max: 6, mandatory: false },
  { key: 'my_tasks', max: 4, mandatory: true },
  { key: 'follow_ups', max: 3, mandatory: false },
];

/**
 * Widgets with no bespoke renderer on this screen still get a real destination.
 *
 * This is the "no feature may be removed" rule made concrete: an admin can put any module
 * from the schema's enum on a role's dashboard, and the worst case is a compact card that
 * opens the full screen. Anything NOT in this map and not handled below renders nothing at
 * all, which is the honest outcome for a key this build does not understand — the module
 * remains in the More tab either way.
 */
const LINK_WIDGETS: Record<string, { icon: IconName; title: string; subtitle: string; href: Href }> = {
  notice_board: { icon: 'megaphone', title: 'Notice board', subtitle: 'Announcements from the firm', href: '/notice-board' },
  campaigns: { icon: 'paper-plane', title: 'Campaigns', subtitle: 'Bulk WhatsApp sends to your book', href: '/campaigns' },
  segments: { icon: 'pie-chart', title: 'Smart segments', subtitle: 'Slice the client book by need', href: '/segments' },
  families: { icon: 'home', title: 'Families', subtitle: 'Households and their total cover', href: '/families' },
  knowledge_base: { icon: 'library', title: 'Knowledge base', subtitle: 'The advisor field guide', href: '/kb' },
  commissions: { icon: 'cash', title: 'Commissions', subtitle: 'What you have earned so far', href: '/commissions' },
  attendance: { icon: 'time', title: 'My attendance', subtitle: 'Your GPS clock log, day by day', href: '/attendance' },
};

/* ---------- loose-document helpers ----------
 * `prospects` has no schema on the backend (routes/prospects.js reads a raw collection),
 * so every field is resolved through a candidate key list. Anything that does not resolve
 * is not rendered: a blank row is a lie about the record, a missing one is the truth. */
const PROSPECT_NAME_KEYS = ['name', 'full_name', 'contact_person', 'contactPerson', 'firm', 'company', 'business_name'];
const PROSPECT_SUB_KEYS = ['firm', 'company', 'city', 'location', 'phone', 'mobile', 'contactNo', 'whatsapp'];

function pickStr(o: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

const OPEN_CLAIM = (cl: Claim) => cl.status !== 'settled' && cl.status !== 'rejected';

function ticketTone(tk: api.Ticket): Tone {
  if (tk.zone === 'red' || tk.priority === 'P1') return 'danger';
  if (tk.zone === 'amber' || tk.priority === 'P2') return 'warning';
  return 'neutral';
}

/** A ticket nobody owns, flagged red, or raised as P1. That is what an issue log is for. */
function needsAttention(tk: api.Ticket): boolean {
  return !tk.is_closed && (tk.zone === 'red' || tk.priority === 'P1' || !tk.owner);
}

/* ---------- ClockRing ----------
 * A real ring built from two circles: a filled disc clipped round, with a surface-coloured
 * disc punched out of the middle. react-native-svg is not installed and does not need to be.
 * Gradient when on duty, neutral track when off — the state IS the decoration. */
function ClockRing({ on, elapsed }: { on: boolean; elapsed?: string }) {
  const c = useTheme();
  const inner = RING - RING_STROKE * 2;
  return (
    // Keyed on the state so the entrance replays the moment the clock flips.
    <Appear key={on ? 'on' : 'off'} distance={0}>
      <View
        accessible
        accessibilityLabel={on ? (elapsed ? `On duty, ${elapsed}` : 'On duty') : 'Off duty'}
        style={{
          width: RING, height: RING, borderRadius: RING / 2, overflow: 'hidden',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {on
          ? <Grad colors={c.gradientBrand} style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: c.track }]} />}

        <View style={{
          width: inner, height: inner, borderRadius: inner / 2, backgroundColor: c.card,
          alignItems: 'center', justifyContent: 'center', gap: 3,
        }}>
          {on ? (
            elapsed ? (
              <>
                <Metric value={elapsed} size={19} />
                <Txt size={11} weight="600" color={c.muted}>on duty</Txt>
              </>
            ) : (
              <>
                <Ionicons name="time-outline" size={26} color={c.accent} />
                <Txt size={11} weight="600" color={c.muted}>On duty</Txt>
              </>
            )
          ) : (
            <>
              <Ionicons name="location-outline" size={26} color={c.faint} />
              <Txt size={11} weight="600" color={c.faint}>Off duty</Txt>
            </>
          )}
        </View>
      </View>
    </Appear>
  );
}

/* ---------- section furniture ---------- */

function WidgetShell({ title, action, onAction, children }: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  const { spacing } = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xxl }}>
      <SectionHeader title={title} action={action} onAction={onAction} />
      {children}
    </View>
  );
}

/**
 * Compact empty state. `EmptyState` sizes for a whole screen; a dashboard stacks four or
 * five of these, and the full-height version turns a quiet day into a page of nothing.
 * The style prop lands after the base, so the vertical padding is genuinely overridden.
 */
function SmallEmpty({ icon, title, subtitle, action }: {
  icon: IconName;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}) {
  const { spacing } = useTheme();
  return (
    <Card>
      <EmptyState
        icon={icon}
        title={title}
        subtitle={subtitle}
        action={action}
        style={{ paddingVertical: spacing.xl }}
      />
    </Card>
  );
}

/** Card-shaped destination for a widget this screen does not draw in detail. */
function LinkCard({ icon, title, subtitle, onPress }: {
  icon: IconName; title: string; subtitle: string; onPress: () => void;
}) {
  const c = useTheme();
  const { radius, spacing, font } = c;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={({ pressed }) => [{
        backgroundColor: c.card, borderRadius: radius.lg, padding: spacing.lg,
        borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
        flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44,
        opacity: pressed ? 0.9 : 1,
        ...shadow(c, 1),
      }]}
    >
      <View style={{
        width: 38, height: 38, borderRadius: 13, backgroundColor: c.primarySoft,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={19} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt size={font.body} weight="700" numberOfLines={1}>{title}</Txt>
        <Txt size={font.cap} color={c.muted} numberOfLines={2} style={{ marginTop: 2 }}>{subtitle}</Txt>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.faint} />
    </Pressable>
  );
}

/* ---------- First-load skeleton ----------
 * Shaped like the configured screen, not like a generic one: the hero matches the hero
 * mode and there is one placeholder per widget in the widget's own shape. The layout does
 * not move when the data lands. */
function HomeSkeleton({ hero, widgets }: { hero: HeroMode; widgets: DashWidget[] }) {
  const c = useTheme();
  const { spacing, radius } = c;
  const hairline = {
    height: StyleSheet.hairlineWidth, backgroundColor: c.hairline,
    marginVertical: spacing.lg, marginHorizontal: -spacing.lg,
  };
  const showRing = hero === 'clock_and_tasks' || hero === 'clock_only';
  const showClockRow = hero === 'clock_and_tasks' || hero === 'clock_only';

  return (
    <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.lg }}>
      {hero !== 'none' ? (
        <Card>
          <Row style={{ gap: spacing.lg }}>
            {showRing ? <Skeleton width={RING} height={RING} radius={RING / 2} /> : null}
            <View style={{ flex: 1, gap: 10 }}>
              <Skeleton width="40%" height={10} />
              <Skeleton width="58%" height={28} />
              <Skeleton width="72%" height={11} />
              <Skeleton width="100%" height={8} radius={4} />
            </View>
          </Row>
          {showClockRow ? (
            <>
              <View style={hairline} />
              <Row>
                <View style={{ flex: 1, gap: 8 }}>
                  <Skeleton width="52%" height={13} />
                  <Skeleton width="68%" height={11} />
                </View>
                <Skeleton width={118} height={48} radius={radius.md} />
              </Row>
            </>
          ) : null}
        </Card>
      ) : null}

      {widgets.map((w) => {
        if (w.key === 'kpi_strip') {
          return (
            <Row key={w.key} style={{ gap: spacing.sm }}>
              {[0, 1, 2].map((i) => <Skeleton key={i} width={108} height={58} radius={radius.md} />)}
            </Row>
          );
        }
        if (w.key === 'quick_actions') {
          return (
            <Row key={w.key} style={{ gap: 14 }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ alignItems: 'center', gap: spacing.sm }}>
                  <Skeleton width={58} height={58} radius={radius.lg} />
                  <Skeleton width={44} height={9} />
                </View>
              ))}
            </Row>
          );
        }
        return <SkeletonCard key={w.key} rows={w.key === 'my_tasks' || w.key === 'day_spine' ? 1 : 0} />;
      })}
    </View>
  );
}

export default function Home() {
  const c = useTheme();
  const { spacing, radius, font } = c;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, viewAs } = useAuth();
  const t = useT();
  const health = useDataHealth();

  /* ---------- the role's layout ---------- */
  const { config, ready, widgets: configWidgets, can } = useAppUi();

  const hour = new Date().getHours();
  const greet = hour < 12 ? t('greet.morning') : hour < 17 ? t('greet.afternoon') : t('greet.evening');
  // A tasteful time-of-day emoji, chosen once here and rendered as its own element in the header
  // (never folded into the translated `greet.*` string) so all five languages share it and no
  // Hindi/Gujarati word order is broken — the i18n trap PHASE-46 was flagged for.
  const greetEmoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌆';

  const caps = capabilitiesOf(user, viewAs);
  const isTeam = caps.tier === 'team';
  /**
   * Leadership data follows the REAL tier, not the "view as" preview, so previewing the
   * team surface does not tear down and refetch the org snapshot.
   */
  const realManagesTeam = capabilitiesOf(user).manageTeam;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [snapshot, setSnapshot] = useState<api.OrgSnapshot | null>(null);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [prospects, setProspects] = useState<api.Prospect[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [notes, setNotes] = useState<api.BoardNote[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [tickets, setTickets] = useState<api.Ticket[]>([]);
  const [clock, setClock] = useState<ClockState>({ in: false });
  const [clocking, setClocking] = useState(false);
  // PHASE 52 — break state. `breaking` guards the break calls the way `clocking` guards the
  // clock ones; `breakSheet`/`breakReason` drive the optional-reason prompt.
  const [breaking, setBreaking] = useState(false);
  const [breakSheet, setBreakSheet] = useState(false);
  const [breakReason, setBreakReason] = useState('');
  // PHASE 50: an out-of-range OR early clock-in/out is ALLOWED but must carry a reason (the server
  // enforces it and notifies a master). `clockReasonSheet`/`clockReason` drive the prompt;
  // `clockReasonCtx` remembers why it opened so the copy is honest (early vs away from office).
  const [clockReasonSheet, setClockReasonSheet] = useState(false);
  const [clockReason, setClockReason] = useState('');
  const [clockReasonCtx, setClockReasonCtx] = useState<{ early?: boolean; outOfRange?: boolean; message?: string } | null>(null);
  const { confirm } = useConfirm();
  // Lazy initialiser: Date.now() is impure, so it must not run in the render body on every
  // pass (react-hooks/purity). Passing the thunk defers it to mount; the value is identical.
  const [nowTick, setNowTick] = useState(() => Date.now());
  /** Screen-specific refusals and failures. The app-wide HealthBanner covers outages. */
  const [notice, setNotice] = useState<{ tone: FeedbackTone; title: string; message?: string } | null>(null);
  /** The fail-open escape hatch: true once we have waited long enough for the config. */
  const [configTimedOut, setConfigTimedOut] = useState(false);

  /* ---------- cancellation ----------
   * Set on mount as well as cleared on unmount: React re-runs mount effects on a remount
   * (and twice in dev StrictMode), and a ref initialised only at creation would latch
   * `false` for the rest of the second life. */
  const mounted = useRef(true);
  const loadSeq = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const storeReady = ready === true;

  // Give the layout config a bounded window to arrive. Cleared the moment it does, and on
  // unmount, so a backgrounded screen never fires this into a dead tree.
  useEffect(() => {
    if (storeReady) return;
    const id = setTimeout(() => { if (mounted.current) setConfigTimedOut(true); }, CONFIG_WAIT_MS);
    return () => clearTimeout(id);
  }, [storeReady]);

  const uiReady = storeReady || configTimedOut;

  /**
   * The ordered widget list. Three sources, in order of authority: the live config, the
   * store's own defaults, then this screen's built-ins. Normalising is cheap enough to run
   * every render, which keeps it correct when the store hands back a fresh array each time.
   */
  const fallbackWidgets = useMemo(() => {
    const fromStore = normalizeWidgets(readWidgetSource(DEFAULT_UI));
    return fromStore.length > 0 ? fromStore : BUILT_IN_WIDGETS;
  }, []);

  const widgets = useMemo(() => {
    const fromStore = normalizeWidgets(configWidgets);
    const fromConfig = normalizeWidgets(readWidgetSource(config));
    // The store filters on `visible` alone, so a hand-edited document that switches a
    // MANDATORY widget off would take it off the dashboard. The raw config still carries
    // it (in the same order), and `normalizeWidgets` keeps mandatory entries whatever
    // their visible flag says, so fall back to that list when one has gone missing.
    const storeKeys = new Set(fromStore.map((x) => x.key));
    const lostMandatory = fromConfig.some((x) => x.mandatory && !storeKeys.has(x.key));
    const live = fromStore.length === 0 || lostMandatory ? fromConfig : fromStore;
    return live.length > 0 ? live : fallbackWidgets;
  }, [configWidgets, config, fallbackWidgets]);

  const hero: HeroMode = readHero(config);

  /**
   * FEATURE GATES FAIL OPEN. Until the store has genuinely answered, every control is
   * available. A config that never resolves must not be able to take the clock-in button
   * away from someone standing in the office.
   */
  const canClockIn = storeReady ? can('can_clock_in') !== false : true;
  const canCreateTask = storeReady ? can('can_create_task') !== false : true;
  const canRoster = storeReady ? can('can_view_team_roster') !== false : true;
  const canOrgAnalytics = storeReady ? can('can_view_org_analytics') !== false : true;

  /**
   * WHAT THIS DASHBOARD ACTUALLY NEEDS.
   *
   * Keyed off a joined string rather than the widget array, so an unstable array identity
   * from the store cannot churn `load`'s identity and refetch on every render. This is the
   * "an Operations user never pays for a prospects fetch" rule.
   */
  const widgetKeys = widgets.map((w) => w.key).join(',');
  const need = useMemo(() => {
    const set = new Set(widgetKeys ? widgetKeys.split(',') : []);
    const has = (k: string) => set.has(k);
    return {
      reminders: has('kpi_strip') || has('follow_ups') || has('day_spine'),
      prospects: has('prospects'),
      leads: has('leads_pipeline'),
      notes: has('personal_notes'),
      claims: has('claim_requests'),
      tickets: has('tickets') || has('issue_logs'),
      // Admin and Master dashboards need the roster and the snapshot whatever the widgets
      // say. Otherwise these two ride on the config's own capability flags: both are org
      // reads, and a role that may not see them should not be billed a round trip for them.
      team: realManagesTeam || (has('team_roster') && canRoster),
      snapshot: realManagesTeam || (has('analytics') && canOrgAnalytics),
    };
  }, [widgetKeys, realManagesTeam, canRoster, canOrgAnalytics]);

  // Live "on duty" timer. One tick every 30s while clocked in, cleared the moment the
  // clock flips or the screen goes away.
  useEffect(() => {
    if (!clock.in) return;
    setNowTick(Date.now());
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, [clock.in, clock.time]);

  const elapsedSince = (since?: string) => {
    if (!since) return '';
    const at = new Date(since).getTime();
    if (isNaN(at)) return '';
    const mins = Math.max(0, Math.floor((nowTick - at) / 60000));
    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  /**
   * PER-USER clock cache key.
   *
   * This was `'clock.' + date` — scoped to the DEVICE, not the person. On a shared handset
   * two users collided on one key: whoever clocked in last owned the state, and the next
   * person to open the app saw someone else's running shift and could clock them out.
   *
   * The user id is now part of the key, and the SERVER is the source of truth (see the
   * `api.getClockState()` call in `load`). This cache only exists so the hero paints
   * instantly instead of flashing "Clock in" for one frame before the network answers.
   */
  const clockKey = `clock.${user?.id || 'anon'}.${new Date().toDateString()}`;

  const load = useCallback(async (isRefresh = false) => {
    const seq = ++loadSeq.current;
    /** True only while this call is still the newest AND the screen is still alive. */
    const current = () => mounted.current && seq === loadSeq.current;

    if (isRefresh) setRefreshing(true);
    try {
      const [tk, rm, nt, saved] = await Promise.all([
        api.getTasks(isTeam),
        need.reminders ? api.getReminders() : Promise.resolve<Reminder[]>([]),
        api.getNotifications(),
        AsyncStorage.getItem(clockKey),
      ]);
      if (!current()) return;

      setTasks(tk);
      setReminders(rm);
      setNotifs(nt);
      setUnread(nt.filter((n) => !n.read).length);
      if (saved) {
        // Paint the cached value immediately so the hero does not flash. The server
        // reconciles it below and wins any disagreement.
        try { setClock(JSON.parse(saved) as ClockState); } catch { /* stay off duty */ }
      }

      // AUTHORITATIVE per-user clock state. The DayLog is resolved from the JWT server-side,
      // so this reflects THIS user on ANY device, and it corrects a stale local cache left
      // behind by whoever used the handset before. A null result means the state could not be
      // read; we keep the cached value rather than wrongly showing "Clock in" on a blip.
      const serverClock = await api.getClockState();
      if (!current()) return;
      if (serverClock) {
        const next: ClockState = serverClock.isClockedIn
          ? { in: true, time: serverClock.since || new Date().toISOString(), place: 'On duty', onBreak: serverClock.isOnBreak }
          : { in: false };
        setClock(next);
        AsyncStorage.setItem(clockKey, JSON.stringify(next)).catch(() => {});
      }

      /* ---------- widget data ----------
       * One parallel batch, and every leg is conditional on a visible widget asking for it.
       * A leg that was not needed resolves null and is simply never written.
       *
       * THE WRITE IS GATED ON "DID WE ASK", NOT ON "DID SOMETHING COME BACK". Gating on the
       * value would mean a failed refresh silently kept the previous rows on screen, which
       * is this app's cardinal sin: stale figures presented as current. A failed fetch
       * already resolves empty and reports to `data/health`, so taking the answer verbatim
       * is what lets the widget below say "did not load" instead of showing yesterday. */
      const [pr, ld, nb, cls, tks, tm, snap] = await Promise.all([
        need.prospects ? api.getProspects({ limit: FETCH_LIMIT }) : Promise.resolve(null),
        need.leads ? api.getLeads() : Promise.resolve(null),
        need.notes ? api.getNotes({ limit: FETCH_LIMIT }) : Promise.resolve(null),
        need.claims ? api.getClaims() : Promise.resolve(null),
        need.tickets ? api.getTickets({ state: 'active', limit: FETCH_LIMIT }) : Promise.resolve(null),
        need.team ? api.getTeam() : Promise.resolve(null),
        need.snapshot ? api.getOrgSnapshot() : Promise.resolve(null),
      ]);
      if (!current()) return;

      if (need.prospects) setProspects(pr ? pr.data : []);
      if (need.leads) setLeads(ld ?? []);
      if (need.notes) setNotes(nb ? nb.data : []);
      if (need.claims) setClaims(cls ?? []);
      if (need.tickets) setTickets(tks ? tks.data : []);
      if (need.team) setTeam(tm ?? []);
      if (need.snapshot) setSnapshot(snap);
    } catch {
      // A throw here is an outage; the HealthBanner already reports it and the screen
      // falls through to its "could not load" empty states rather than to invented data.
    } finally {
      if (current()) { setRefreshing(false); setLoading(false); }
    }
  }, [isTeam, clockKey, need]);

  // Held until the layout is known, so a widget the role does not have is never fetched for.
  useEffect(() => { if (uiReady) load(); }, [uiReady, load]);

  /**
   * Keep the header bell honest across a visit to /notifications.
   *
   * That screen is a pushed route, so Home stays MOUNTED beneath it and the mount `load()`
   * above never re-runs on the way back — the unread dot would otherwise stay frozen at its
   * old count after the user marks items read there. Re-read just the feed on every RE-focus
   * (returning from that route, or switching back to this tab), not the whole dashboard. The
   * first focus is skipped because the mount `load()` already fetched the feed once, so this
   * never double-fetches on a cold open.
   *
   * An outage's empty result must NOT forge a "0 unread" bell (convention 4): if the refetch
   * came back empty because the network is down, keep the last known count and let the
   * HealthBanner carry the outage. `getHealth()` is read live AFTER the await because the
   * failing fetch is itself what would have raised the flag. A genuinely empty feed on a
   * healthy backend still clears the dot.
   */
  const bellPrimed = useRef(false);
  const refreshBell = useCallback(async () => {
    const nt = await api.getNotifications();
    if (!mounted.current) return;
    if (nt.length === 0 && getHealth().degraded) return;
    setNotifs(nt);
    setUnread(nt.filter((n) => !n.read).length);
  }, []);
  useFocusEffect(useCallback(() => {
    if (!bellPrimed.current) { bellPrimed.current = true; return; }
    void refreshBell();
  }, [refreshBell]));

  const toggleClock = useCallback(async (reasonText?: string) => {
    if (clocking) return;
    // `toggleClock` is bound straight to onPress, so a press event can arrive as the first arg —
    // only a real, non-empty string counts as a reason (PHASE 50 out-of-range / early re-send).
    const reason = typeof reasonText === 'string' && reasonText.trim() ? reasonText.trim() : undefined;
    setClocking(true);
    setNotice(null);
    haptics.tap();
    try {
      const fix = await getFix();
      if (!mounted.current) return;

      // Web and demo sessions have no GPS, so the flow stays testable there.
      const webDemo = Platform.OS === 'web' || !api.isRealSession();

      if (!fix && !webDemo) {
        haptics.warn();
        setNotice({
          tone: 'warning',
          title: 'Location needed',
          message: 'Turn on location to clock in or out. Attendance is confirmed by GPS at the office.',
        });
        return;
      }

      /* BACKGROUND PERMISSION GATES CLOCK-IN, AND ONLY CLOCK-IN.
       *
       * The shift record is only trustworthy if the route can actually be recorded for its
       * whole duration, and Android will not deliver background updates without the
       * "Allow all the time" grant. Letting someone clock in without it produces a shift with
       * a start, an end, and a silent gap in between, which is worse than refusing: it looks
       * like a complete record.
       *
       * Never gate clock-OUT on it. Someone who is already on duty must always be able to end
       * their shift, whatever they have since done in Settings. */
      if (!clock.in && !webDemo) {
        const perm = await ensureBackgroundPermission();
        if (!mounted.current) return;
        if (!perm.granted) {
          haptics.warn();
          setNotice({
            tone: 'warning',
            title: 'Background location needed',
            message: perm.reason
              || 'Set location access to "Allow all the time" so your field route is recorded for the whole shift, then clock in again.',
          });
          return;
        }
      }

      // Geofence check, so a clock-in refusal costs a round trip and not a rejected write.
      // The server re-validates either way.
      //
      // CLOCK-OUT IS NO LONGER FENCED. Agents finish the day at a client's home, and making
      // them return to the office to end a shift means clocking out the next morning instead,
      // so the record stops being true. The backend records the clock-out coordinates and
      // flags out-of-bounds rather than refusing the write.
      //
      // PHASE 17: the same check now also runs on the clock-out path, purely so a successful
      // clock-out can carry a warning naming the measured distance. It never gates the write —
      // `clockOutFence` is only read after `api.clockOut` has already succeeded, below.
      let clockOutFence: api.GeofenceCheck | null = null;
      if (fix && !webDemo) {
        const geo = await api.checkGeofence(fix.lat, fix.lng, fix.accuracy);
        if (!mounted.current) return;
        if (!clock.in) {
          if (!geo.allowed) {
            haptics.warn();
            setNotice({
              tone: 'warning',
              title: 'Too far to clock in',
              message: geo.message,
            });
            return;
          }
        } else {
          clockOutFence = geo;
        }
      }

      const coords = fix ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, city: fix.city } : {};

      if (clock.in) {
        // PHASE 52: if a break is running, END it first so its duration + location are recorded.
        // The backend's clock-out just nulls `activeBreakStart` (DayLog.clockOut), discarding the
        // in-progress break — so without this that break time would silently count as worked. Best
        // effort: a failed break-stop must never prevent ending the shift.
        if (clock.onBreak) {
          await api.stopBreak(coords).catch(() => {});
          if (!mounted.current) return;
        }
        const res = await api.clockOut(coords, reason);
        if (!mounted.current) return;
        if (res.blocked) {
          haptics.warn();
          setNotice({ tone: 'warning', title: 'Too far to clock out', message: res.message || 'You have to be at the office to clock out.' });
          return;
        }
        // PHASE 50: the server ALLOWS this clock-out but needs a reason (out-of-range or early) and
        // notifies a master. This is neither a refusal nor a network fault — collect the reason and
        // re-send. Without this branch it fell through to the false "server could not be reached".
        if (res.needsReason) {
          if (reason) {
            // A reason was already supplied but the server still refused it — say so honestly.
            haptics.warn();
            setNotice({ tone: 'warning', title: 'Reason needed to clock out', message: res.message || 'Please add a short reason to clock out here.' });
            return;
          }
          haptics.warn();
          setClockReasonCtx({ early: res.early, outOfRange: res.outOfRange, message: res.message });
          setClockReason('');
          setClockReasonSheet(true);
          return;
        }
        /* PHASE 1: the shift stays OPEN when the server did not close it. Previously any
         * failure resolved ok:true, so the device showed the shift ended while the server
         * still had it running — and the next clock-in silently overlapped it. */
        if (!res.ok && !webDemo) {
          haptics.error();
          setNotice({
            tone: 'danger',
            title: 'Attendance could not be recorded',
            message: 'The server could not be reached. Check your connection and try again.',
          });
          return;
        }
        await stopTracking().catch(() => {});
        if (!mounted.current) return;
        const next: ClockState = { in: false };
        setClock(next);
        // Persist fire-and-forget: a storage failure must not undo a write the server
        // has already accepted.
        AsyncStorage.setItem(clockKey, JSON.stringify(next)).catch(() => {});
        haptics.success();
        // PHASE 17: a warning beside a real success, never instead of one — the clock-out above
        // has already succeeded. States the measured distance, never a quoted radius, same
        // convention as the clock-in refusal (INBOX D5/D6).
        if (clockOutFence?.known && !clockOutFence.allowed && clockOutFence.distance_m != null) {
          setNotice({
            tone: 'warning',
            title: 'Clocked out away from the office',
            message: `You were ${api.distanceText(clockOutFence.distance_m)} from the office when you clocked out.`,
          });
        }
        return;
      }

      const res = await api.clockIn(coords, reason);
      if (!mounted.current) return;
      if (res.blocked) {
        haptics.warn();
        setNotice({ tone: 'warning', title: 'Too far to clock in', message: res.message || 'You have to be inside the office area to clock in.' });
        return;
      }
      // PHASE 50: server allows the clock-in but needs a reason (out-of-range — the client fence and
      // the server's per-member fence disagreed, or no fence was cached). Collect it and re-send;
      // never show the false network-outage notice for a 400 the server answered clearly.
      if (res.needsReason) {
        if (reason) {
          haptics.warn();
          setNotice({ tone: 'warning', title: 'Reason needed to clock in', message: res.message || 'Please add a short reason to clock in here.' });
          return;
        }
        haptics.warn();
        setClockReasonCtx({ outOfRange: res.outOfRange, message: res.message });
        setClockReason('');
        setClockReasonSheet(true);
        return;
      }

      /* PHASE 1: nothing below this line may run on a failed write, and the order matters.
       *
       * This check used to be absent entirely: `api.clockIn` swallowed timeouts into ok:true,
       * so a handset with no signal started tracking with `res.sessionId` undefined — attaching
       * the whole shift's GPS to no server session — wrote the local clock key, and fired the
       * app's one heavy haptic to confirm a shift the server never recorded. Attendance feeds
       * payroll, so the silent case is the expensive one. */
      if (!res.ok && !webDemo) {
        haptics.error();
        setNotice({
          tone: 'danger',
          title: 'Attendance could not be recorded',
          message: 'The server could not be reached. Check your connection and try again.',
        });
        return;
      }

      /* Route recording belongs to the SHIFT, not to this screen, so it deliberately
       * outlives the component. `stopTracking()` on clock-out is what ends it.
       *
       * PHASE 7: NO SESSION ID, NO ROUTE — AND THE PERSON IS TOLD. The server returns the id at
       * `data.sessionId` (`routes/timeTracker.js:431`), so this branch is a contract fault
       * rather than a normal outcome. Recording anyway is the worse option: every batch would
       * have to be attributed by the server from whichever token is on the handset, which is
       * how one person's route lands on another person's day, and after clock-out it just 400s.
       * The shift itself is unaffected — it is already recorded on the server — so this is a
       * warning beside a real success, not a failure. */
      if (res.sessionId) {
        startTracking(res.sessionId).catch(() => {});
      } else if (!webDemo) {
        setNotice({
          tone: 'warning',
          title: 'Shift started, route not recorded',
          message: 'Your clock-in was saved, but this phone could not start recording your field route. Tell your manager if the route matters today.',
        });
      }

      const next: ClockState = { in: true, time: new Date().toISOString(), place: fix?.city || 'On field' };
      setClock(next);
      AsyncStorage.setItem(clockKey, JSON.stringify(next)).catch(() => {});
      // The one heavy haptic in the app: the shift has actually started.
      haptics.heavy();
    } catch {
      if (!mounted.current) return;
      haptics.error();
      setNotice({
        tone: 'danger',
        title: 'Attendance could not be recorded',
        message: 'The server could not be reached. Check your connection and try again.',
      });
    } finally {
      if (mounted.current) setClocking(false);
    }
  }, [clocking, clock.in, clock.onBreak, clockKey]);

  // PHASE 50: the reason prompt re-runs the SAME clock action, this time carrying the typed reason,
  // so the success path (start/stop tracking, clock state, haptics) is reused untouched.
  const submitClockReason = useCallback(() => {
    const r = clockReason.trim();
    if (!r || clocking) return;
    setClockReasonSheet(false);
    void toggleClock(r);
  }, [clockReason, clocking, toggleClock]);

  /* ---------- PHASE 52: break ----------
   * Break start/stop hits the already-live endpoints (`api.startBreak`/`stopBreak`). Location is
   * best-effort — unlike clock-in, a break is not geofenced (the backend validates only against a
   * per-member break-fence that is null for everyone), so a missing fix never blocks it. */

  /** Press "Break": if they have already worked their 8h30m minimum, ask whether they'd rather
   *  clock out; otherwise go straight to the optional-reason sheet. */
  const pressBreak = useCallback(async () => {
    if (breaking || clocking) return;
    const since = clock.time ? Date.parse(clock.time) : NaN;
    const workedMs = Number.isFinite(since) ? Date.now() - since : 0;
    if (workedMs >= MIN_SHIFT_MS) {
      const go = await confirm({
        title: t('break.minDoneTitle'),
        message: t('break.minDoneBody'),
        confirmText: t('break.minDoneConfirm'),
        cancelText: t('common.cancel'),
        icon: 'cafe-outline',
      });
      if (!go) return;
    }
    setBreakReason('');
    setBreakSheet(true);
  }, [breaking, clocking, clock.time, confirm, t]);

  /** Start the break — from either the reason sheet's "Start break" (with the typed reason) or
   *  "Skip" (without). Honest write path: a 403 or a failed write leaves the user NOT on break. */
  const startBreakNow = useCallback(async (withReason: boolean) => {
    if (breaking) return;
    setBreaking(true);
    haptics.tap();
    try {
      const fix = await getFix();
      if (!mounted.current) return;
      const webDemo = Platform.OS === 'web' || !api.isRealSession();
      const coords = fix ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, city: fix.city } : {};
      const res = await api.startBreak(coords, withReason ? breakReason : undefined);
      if (!mounted.current) return;
      if (res.blocked) {
        haptics.warn();
        setBreakSheet(false);
        setNotice({ tone: 'warning', title: 'Could not start break', message: res.message || 'You have to be at the office to start a break.' });
        return;
      }
      if (!res.ok && !webDemo) {
        haptics.error();
        setBreakSheet(false);
        setNotice({ tone: 'danger', title: 'Break could not be recorded', message: res.message || 'The server could not be reached. Check your connection and try again.' });
        return;
      }
      const next: ClockState = { ...clock, onBreak: true };
      setClock(next);
      AsyncStorage.setItem(clockKey, JSON.stringify(next)).catch(() => {});
      setBreakSheet(false);
      setBreakReason('');
      haptics.success();
    } catch {
      if (!mounted.current) return;
      haptics.error();
      setBreakSheet(false);
      setNotice({ tone: 'danger', title: 'Break could not be recorded', message: 'The server could not be reached. Check your connection and try again.' });
    } finally {
      if (mounted.current) setBreaking(false);
    }
  }, [breaking, breakReason, clock, clockKey]);

  /** End an in-progress break. */
  const pressEndBreak = useCallback(async () => {
    if (breaking || clocking) return;
    setBreaking(true);
    haptics.tap();
    try {
      const fix = await getFix();
      if (!mounted.current) return;
      const webDemo = Platform.OS === 'web' || !api.isRealSession();
      const coords = fix ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, city: fix.city } : {};
      const res = await api.stopBreak(coords);
      if (!mounted.current) return;
      if (res.blocked) {
        haptics.warn();
        setNotice({ tone: 'warning', title: 'Could not end break', message: res.message || 'You have to be at the office to end a break.' });
        return;
      }
      if (!res.ok && !webDemo) {
        haptics.error();
        setNotice({ tone: 'danger', title: 'Could not end break', message: res.message || 'The server could not be reached. Check your connection and try again.' });
        return;
      }
      const next: ClockState = { ...clock, onBreak: false };
      setClock(next);
      AsyncStorage.setItem(clockKey, JSON.stringify(next)).catch(() => {});
      haptics.success();
    } catch {
      if (!mounted.current) return;
      haptics.error();
      setNotice({ tone: 'danger', title: 'Could not end break', message: 'The server could not be reached. Check your connection and try again.' });
    } finally {
      if (mounted.current) setBreaking(false);
    }
  }, [breaking, clocking, clock, clockKey]);

  const completeTask = useCallback(async (task: Task) => {
    // Optimistic: the row has to clear on the same frame as the tap. No haptic yet —
    // the buzz is reserved for the server confirming, so it means "saved", not "tapped".
    setTasks((prev) => prev.map((x) => (x.id === task.id
      ? { ...x, status: 'done' as const, completedAt: new Date().toISOString(), steps: x.steps.map((s) => ({ ...s, done: true })) }
      : x)));

    const res = await api.updateTaskStatus(task.id, 'done');
    if (!mounted.current) return;

    if (res.ok) { haptics.success(); return; }

    // The optimistic tick was a promise the server did not keep. Put THAT ROW back rather
    // than the whole list, so a refresh that landed in between is not clobbered.
    setTasks((prev) => prev.map((x) => (x.id === task.id ? task : x)));
    haptics.warn();
    setNotice({
      tone: 'warning',
      title: 'Task was not closed',
      message: res.forbidden
        ? 'This task is assigned to someone else, so it cannot be closed from here.'
        : 'The server did not accept the change. Try again in a moment.',
    });
  }, []);

  /* ---------- derived ---------- */
  const day = useMemo(() => {
    const open = tasks.filter((x) => x.status !== 'done');
    const overdue = open.filter((x) => bucket(x) === 'overdue');
    const dueToday = open.filter((x) => bucket(x) === 'today');
    const inProgress = open.filter((x) => x.status === 'in_progress');
    // Shared with the Tasks tab (`todayProgress`) so the two "today" counts can never drift, and
    // so a reopen or an undated task no longer makes the ratio jump. See @/data/tasks.
    const prog = todayProgress(tasks);
    return {
      overdue,
      dueToday,
      inProgress,
      todayTotal: prog.total,
      todayDone: prog.done,
      focus: [...overdue, ...dueToday],
    };
  }, [tasks]);

  const pendingReminders = useMemo(() => reminders.filter((r) => !r.done), [reminders]);

  /** The day in time order: what is due TODAY, tasks and calls interleaved. */
  const daySpine = useMemo(() => {
    type Node = {
      id: string; at: number; time: string; title: string; subtitle?: string;
      tone: SpineTone; icon: IconName; onPress: () => void;
    };
    const nodes: Node[] = [];
    for (const tk of day.dueToday) {
      nodes.push({
        id: `task-${tk.id}`,
        at: new Date(tk.dueDate).getTime() || 0,
        time: hhmm(tk.dueDate),
        title: tk.title,
        subtitle: tk.client || tk.assignedBy,
        tone: tk.status === 'in_progress' ? 'primary' : 'accent',
        icon: (CATEGORY_ICON[tk.category] || 'checkbox') as IconName,
        onPress: () => router.push(`/task/${tk.id}`),
      });
    }
    for (const r of pendingReminders) {
      if (!isToday(r.date)) continue;
      nodes.push({
        id: `rem-${r.id}`,
        at: new Date(r.date).getTime() || 0,
        time: hhmm(r.date),
        title: r.clientName || r.title,
        subtitle: r.subtitle,
        tone: 'warning',
        icon: (REMINDER_ICON[r.type] ?? 'notifications') as IconName,
        onPress: () => router.push('/reminders'),
      });
    }
    nodes.sort((a, b) => a.at - b.at);
    return nodes;
  }, [day.dueToday, pendingReminders, router]);

  const openClaims = useMemo(() => claims.filter(OPEN_CLAIM), [claims]);
  const activeTickets = useMemo(() => tickets.filter((tk) => !tk.is_closed), [tickets]);
  const issueTickets = useMemo(() => tickets.filter(needsAttention), [tickets]);

  const activeLeads = useMemo(
    () => leads
      .filter((l) => l.stage !== 'policy_issued' && l.stage !== 'lost')
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()),
    [leads],
  );
  const leadStages = useMemo(() => {
    // The open stages, in the server's enum order — `lost` and `policy_issued` are the exits.
    const keys = ['new_lead', 'meeting_scheduled', 'docs_shared'] as const;
    return keys
      .map((k) => ({ key: k, label: STAGE_META[k].label, tone: STAGE_META[k].tone as Tone, n: leads.filter((l) => l.stage === k).length }))
      .filter((s) => s.n > 0);
  }, [leads]);

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    }),
    [notes],
  );

  const pct = day.todayTotal ? day.todayDone / day.todayTotal : 0;
  /** The change IS the information: a task closing should be felt as the figure moving. Clamp to
   *  the instant total so a reopen that drops a task out of today's set never flashes "2 / 1". */
  const shownDone = Math.min(useCountUp(day.todayDone), day.todayTotal);

  /** Nothing came back AND the fetch layer reported an outage: not a confirmed empty day. */
  const unconfirmed = health.degraded && tasks.length === 0;
  /** Same test, per widget: an empty list under an outage is not a confirmed empty list. */
  const unsure = (n: number) => health.degraded && n === 0;

  const dutyFor = elapsedSince(clock.time);
  const dutyLine = clock.in
    ? [dutyFor ? `${dutyFor} on duty` : 'On duty', clock.place].filter((s): s is string => !!s).join(' · ')
    : t('home.gpsCheckin');

  /* ---------- hero shape ---------- */
  const heroRing = hero === 'clock_and_tasks' || hero === 'clock_only';
  const heroTasks = hero === 'clock_and_tasks' || hero === 'tasks_only';
  const heroClockRow = (hero === 'clock_and_tasks' || hero === 'clock_only') && canClockIn;
  const showHero = hero !== 'none' && (heroRing || heroTasks || heroClockRow);

  /* ---------- KPI strip ----------
   * Every chip is a real figure over data this screen actually fetched. The claims and
   * tickets chips only exist when their widget asked for that data, so the strip never
   * shows a zero that merely means "not loaded". */
  const kpis: KpiItem[] = useMemo(() => {
    const items: KpiItem[] = [
      { label: t('tasks.overdue'), value: String(day.overdue.length), tone: day.overdue.length ? 'danger' : 'neutral', icon: 'alert-circle', onPress: () => router.push('/(tabs)/tasks') },
      { label: t('tasks.inProgress'), value: String(day.inProgress.length), tone: 'info', icon: 'ellipsis-horizontal-circle', onPress: () => router.push('/(tabs)/tasks') },
      { label: 'Due today', value: String(day.dueToday.length), tone: 'warning', icon: 'today', onPress: () => router.push('/(tabs)/tasks') },
    ];
    if (need.reminders) {
      items.push({ label: 'Follow-ups', value: String(pendingReminders.length), tone: 'accent', icon: 'call', onPress: () => router.push('/reminders') });
    }
    if (need.claims) {
      items.push({ label: 'Open claims', value: String(openClaims.length), tone: 'primary', icon: 'shield-half', onPress: () => router.push('/(tabs)/claims') });
    }
    if (need.tickets) {
      items.push({ label: 'Open tickets', value: String(activeTickets.length), tone: 'info', icon: 'ticket', onPress: () => router.push('/tickets') });
    }
    if (need.leads) {
      items.push({ label: 'Active leads', value: String(activeLeads.length), tone: 'accent', icon: 'funnel', onPress: () => router.push('/(tabs)/leads') });
    }
    return items;
  }, [t, router, day.overdue.length, day.inProgress.length, day.dueToday.length, need, pendingReminders.length, openClaims.length, activeTickets.length, activeLeads.length]);

  /* ---------- quick actions ----------
   * Every tile is also a More-tab entry, so trimming this list to `max_items` re-prioritises
   * rather than removes. */
  type QuickAction = { key: string; icon: IconName; label: string; tint?: string; onPress: () => void };
  const quickActions: QuickAction[] = useMemo(() => {
    const list: QuickAction[] = [];
    // When the hero carries no clock, attendance would otherwise be two taps away through
    // More. It leads the strip instead, and the widget's cap is widened by one below so
    // nothing configured is displaced by this safety net.
    if (!heroClockRow && canClockIn) {
      list.push({ key: 'attendance', icon: 'time', label: 'Attendance', onPress: () => router.push('/attendance') });
    }
    if (canCreateTask) {
      list.push({ key: 'task-new', icon: 'add-circle', label: t('tasks.add'), onPress: () => router.push('/task-new') });
    }
    list.push(
      { key: 'premium', icon: 'gift', label: t('act.premiumDue'), onPress: () => router.push('/premium') },
      { key: 'whatsapp', icon: 'logo-whatsapp', label: t('act.whatsapp'), tint: c.whatsapp, onPress: () => router.push('/whatsapp') },
      { key: 'claims', icon: 'shield-half', label: t('tab.claims'), onPress: () => router.push('/(tabs)/claims') },
      { key: 'lic-plans', icon: 'calculator', label: t('act.licPlans'), onPress: () => router.push('/lic-plans') },
      { key: 'calendar', icon: 'calendar', label: t('act.calendar'), onPress: () => router.push('/calendar') },
    );
    return list;
  }, [t, router, c.whatsapp, heroClockRow, canClockIn, canCreateTask]);
  /** The attendance safety net rides on top of the configured cap, never inside it. */
  const quickActionBonus = !heroClockRow && canClockIn ? 1 : 0;

  const hairline = {
    height: StyleSheet.hairlineWidth, backgroundColor: c.hairline,
    marginVertical: spacing.lg, marginHorizontal: -spacing.lg,
  };

  /** Leadership figures are real or absent. All-zero org tiles are worse than no tiles. */
  const orgReady = !!snapshot || team.length > 0;

  const retry = useCallback(() => load(true), [load]);

  /* ================================================================== *
   * Widget rendering
   *
   * One switch, driven entirely by the key. No branch reads the user's role: the role
   * decided which keys are in the list and in what order, and that decision was made
   * server-side. Adding a role never touches this file.
   * ================================================================== */
  const renderWidget = (w: DashWidget): React.ReactNode => {
    switch (w.key) {
      /* ---------------------------------------------------------- KPI strip */
      case 'kpi_strip':
        return (
          <KpiStrip
            items={kpis.slice(0, w.max)}
            style={{ marginTop: spacing.lg }}
            contentStyle={{ paddingHorizontal: spacing.lg }}
          />
        );

      /* ------------------------------------------------------ Quick actions */
      case 'quick_actions':
        return (
          <View style={{ marginTop: spacing.xl }}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <SectionHeader title={w.title ?? t('home.quickActions')} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 14 }}
            >
              {quickActions.slice(0, w.max + quickActionBonus).map((a, i) => (
                <ActionTile
                  key={a.key}
                  icon={a.icon}
                  label={a.label}
                  tileIndex={i}
                  tint={a.tint}
                  onPress={a.onPress}
                />
              ))}
            </ScrollView>
          </View>
        );

      /* ----------------------------------------------------------- My tasks */
      case 'my_tasks': {
        const focus = day.focus.slice(0, w.max);
        return (
          <WidgetShell
            title={w.title ?? t('home.tasksToday')}
            action={t('home.viewAll')}
            onAction={() => router.push('/(tabs)/tasks')}
          >
            {focus.length === 0 ? (
              /* Three genuinely different empties: the fetch failed, the day is
                 cleared, or no work has ever been assigned. */
              unconfirmed ? (
                <SmallEmpty
                  icon="cloud-offline-outline"
                  title="Today's list did not load"
                  subtitle="The server could not be reached, so this is not a confirmed empty day. Pull down to refresh."
                  action={{ label: 'Try again', onPress: retry }}
                />
              ) : tasks.length === 0 ? (
                <SmallEmpty
                  icon="clipboard-outline"
                  title="No tasks assigned yet"
                  subtitle="Work assigned to you shows up here. Add your own to plan the day."
                  action={canCreateTask ? { label: t('tasks.add'), onPress: () => router.push('/task-new') } : undefined}
                />
              ) : (
                <SmallEmpty
                  icon="checkmark-done-circle-outline"
                  title={t('tasks.allClear')}
                  subtitle="Nothing is overdue and nothing else is due today."
                  action={canCreateTask ? { label: t('tasks.add'), onPress: () => router.push('/task-new') } : undefined}
                />
              )
            ) : (
              <Card>
                <Spine>
                  {focus.map((task, i) => {
                    const isOver = bucket(task) === 'overdue';
                    const who = task.client || task.assignedBy;
                    const stepsDone = task.steps.filter((s) => s.done).length;
                    return (
                      <SpineRow
                        key={task.id}
                        index={i}
                        last={i === focus.length - 1}
                        time={isOver ? dayLabel(task.dueDate) : hhmm(task.dueDate)}
                        title={task.title}
                        subtitle={isOver ? `Overdue · ${who}` : who}
                        tone={isOver ? 'danger' : task.status === 'in_progress' ? 'primary' : 'accent'}
                        icon={(CATEGORY_ICON[task.category] || 'checkbox') as IconName}
                        onPress={() => router.push(`/task/${task.id}`)}
                        right={
                          <IconBtn
                            icon="checkmark"
                            size={34}
                            bg={c.successSoft}
                            color={c.success}
                            accessibilityLabel={`Mark ${task.title} done`}
                            onPress={() => completeTask(task)}
                          />
                        }
                      >
                        {task.steps.length > 0 ? (
                          <Row style={{ gap: spacing.sm }}>
                            <ProgressBar
                              value={taskProgress(task)}
                              tone={isOver ? c.danger : c.primary}
                              height={5}
                              style={{ flex: 1 }}
                            />
                            <Txt size={11} weight="700" color={c.faint} numeric>
                              {stepsDone}/{task.steps.length}
                            </Txt>
                          </Row>
                        ) : undefined}
                      </SpineRow>
                    );
                  })}
                </Spine>
              </Card>
            )}
          </WidgetShell>
        );
      }

      /* ---------------------------------------------------------- Day spine */
      case 'day_spine': {
        const nodes = daySpine.slice(0, w.max);
        return (
          <WidgetShell
            title={w.title ?? 'The day, in order'}
            action={t('home.viewAll')}
            onAction={() => router.push('/calendar')}
          >
            {nodes.length === 0 ? (
              <SmallEmpty
                icon={unconfirmed ? 'cloud-offline-outline' : 'time-outline'}
                title={unconfirmed ? 'Today did not load' : 'Nothing is timed for today'}
                subtitle={unconfirmed
                  ? 'The server could not be reached, so this is not a confirmed empty day. Pull down to refresh.'
                  : 'Tasks and follow-ups dated today appear here in the order they fall due.'}
                action={unconfirmed ? { label: 'Try again', onPress: retry } : { label: 'Open calendar', onPress: () => router.push('/calendar') }}
              />
            ) : (
              <Card>
                <Spine>
                  {nodes.map((n, i) => (
                    <SpineRow
                      key={n.id}
                      index={i}
                      last={i === nodes.length - 1}
                      time={n.time}
                      title={n.title}
                      subtitle={n.subtitle}
                      tone={n.tone}
                      icon={n.icon}
                      onPress={n.onPress}
                    />
                  ))}
                </Spine>
              </Card>
            )}
          </WidgetShell>
        );
      }

      /* --------------------------------------------------------- Follow-ups */
      case 'follow_ups': {
        const rows = pendingReminders.slice(0, w.max);
        return (
          <WidgetShell
            title={w.title ?? t('home.followups')}
            action={t('common.seeAll')}
            onAction={() => router.push('/reminders')}
          >
            {rows.length === 0 ? (
              <SmallEmpty
                icon={unsure(pendingReminders.length) ? 'cloud-offline-outline' : 'call-outline'}
                title={unsure(pendingReminders.length) ? 'Follow-ups did not load' : 'No follow-up is pending'}
                subtitle={unsure(pendingReminders.length)
                  ? 'The server did not answer, so an empty list here is not confirmed. Pull down to refresh.'
                  : 'Birthdays, renewals and callbacks land here on the day they are due.'}
                action={unsure(pendingReminders.length)
                  ? { label: 'Try again', onPress: retry }
                  : { label: 'Open follow-ups', onPress: () => router.push('/reminders') }}
              />
            ) : (
              <ListSection>
                {rows.map((r, i) => (
                  <Appear key={r.id} index={i}>
                    <View style={{ paddingHorizontal: spacing.lg }}>
                      <PersonRow
                        name={r.clientName || r.title}
                        subtitle={r.subtitle}
                        subtitleIcon={(REMINDER_ICON[r.type] ?? 'notifications') as IconName}
                        onPress={() => router.push('/reminders')}
                        chevron
                        right={r.phone ? (
                          <IconBtn
                            icon="logo-whatsapp"
                            size={38}
                            bg={c.whatsappSoft}
                            color={c.whatsapp}
                            accessibilityLabel={`WhatsApp ${r.clientName || r.title}`}
                            onPress={() => { haptics.tap(); whatsapp(r.phone!, `Namaste ${r.clientName || ''}`); }}
                          />
                        ) : undefined}
                      />
                    </View>
                  </Appear>
                ))}
              </ListSection>
            )}
          </WidgetShell>
        );
      }

      /* ---------------------------------------------------------- Prospects */
      case 'prospects': {
        const rows = prospects.slice(0, w.max);
        return (
          <WidgetShell
            title={w.title ?? 'Prospects'}
            action={t('common.seeAll')}
            onAction={() => router.push('/prospects')}
          >
            {rows.length === 0 ? (
              <SmallEmpty
                icon={unsure(prospects.length) ? 'cloud-offline-outline' : 'person-add-outline'}
                title={unsure(prospects.length) ? 'Prospects did not load' : 'No prospect in the pool yet'}
                subtitle={unsure(prospects.length)
                  ? 'The server did not answer, so an empty pool here is not confirmed. Pull down to refresh.'
                  : 'People you are recruiting appear here as soon as they are added.'}
                action={unsure(prospects.length)
                  ? { label: 'Try again', onPress: retry }
                  : { label: 'Open prospects', onPress: () => router.push('/prospects') }}
              />
            ) : (
              <ListSection>
                {rows.map((p, i) => {
                  const rec = p as Record<string, unknown>;
                  const name = pickStr(rec, PROSPECT_NAME_KEYS) || 'Unnamed prospect';
                  const sub = pickStr(rec, PROSPECT_SUB_KEYS);
                  const stage = typeof p.stage === 'string' ? p.stage : '';
                  return (
                    <Appear key={String(p._id || p.id || i)} index={i}>
                      <View style={{ paddingHorizontal: spacing.lg }}>
                        <PersonRow
                          name={name}
                          subtitle={sub || undefined}
                          subtitleIcon={sub ? 'business-outline' : undefined}
                          onPress={() => router.push('/prospects')}
                          right={stage ? <Pill label={stage} tone="accent" small /> : undefined}
                          chevron={!stage}
                        />
                      </View>
                    </Appear>
                  );
                })}
              </ListSection>
            )}
          </WidgetShell>
        );
      }

      /* ----------------------------------------------------- Leads pipeline */
      case 'leads_pipeline': {
        const rows = activeLeads.slice(0, w.max);
        return (
          <WidgetShell
            title={w.title ?? 'Leads pipeline'}
            action={t('common.pipeline')}
            onAction={() => router.push('/(tabs)/leads')}
          >
            {rows.length === 0 ? (
              <SmallEmpty
                icon={unsure(leads.length) ? 'cloud-offline-outline' : 'funnel-outline'}
                title={unsure(leads.length) ? 'The pipeline did not load' : leads.length > 0 ? 'Every lead is closed' : 'No lead in the pipeline yet'}
                subtitle={unsure(leads.length)
                  ? 'The server did not answer, so an empty pipeline here is not confirmed. Pull down to refresh.'
                  : leads.length > 0
                    ? 'Nothing is open right now. Closed leads — policy issued, or lost — stay on the pipeline screen.'
                    : 'New enquiries land here and move along the stages as you work them.'}
                action={unsure(leads.length)
                  ? { label: 'Try again', onPress: retry }
                  : { label: 'Open pipeline', onPress: () => router.push('/(tabs)/leads') }}
              />
            ) : (
              <>
                {leadStages.length > 0 ? (
                  <Row style={{ gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md }}>
                    {leadStages.map((s) => (
                      <Pill key={s.key} label={`${s.label} ${s.n}`} tone={s.tone} numeric small />
                    ))}
                  </Row>
                ) : null}
                <ListSection>
                  {rows.map((l, i) => (
                    <Appear key={l.id} index={i}>
                      <View style={{ paddingHorizontal: spacing.lg }}>
                        <PersonRow
                          name={l.name}
                          subtitle={l.interest || l.city || l.source}
                          subtitleIcon="pricetag-outline"
                          onPress={() => router.push(`/lead/${l.id}`)}
                          right={
                            <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: 112 }}>
                              {l.potential > 0 ? <Metric value={inrShort(l.potential)} size={font.sub} /> : null}
                              <Pill label={STAGE_META[l.stage].label} tone={STAGE_META[l.stage].tone} small />
                            </View>
                          }
                        />
                      </View>
                    </Appear>
                  ))}
                </ListSection>
              </>
            )}
          </WidgetShell>
        );
      }

      /* ----------------------------------------------------- Personal notes */
      case 'personal_notes': {
        const rows = sortedNotes.slice(0, w.max);
        return (
          <WidgetShell
            title={w.title ?? 'Notes'}
            action={t('common.seeAll')}
            onAction={() => router.push('/notes')}
          >
            {rows.length === 0 ? (
              <SmallEmpty
                icon={unsure(notes.length) ? 'cloud-offline-outline' : 'journal-outline'}
                title={unsure(notes.length) ? 'Your notes did not load' : 'Nothing on your board yet'}
                subtitle={unsure(notes.length)
                  ? 'The server did not answer, so an empty board here is not confirmed. Pull down to refresh.'
                  : 'Your private board holds what you jot down here and what you dictate on WhatsApp. It is tied to your own number.'}
                action={{ label: unsure(notes.length) ? 'Try again' : 'Open notes', onPress: unsure(notes.length) ? retry : () => router.push('/notes') }}
              />
            ) : (
              <ListSection>
                {rows.map((n, i) => (
                  <Appear key={n.id} index={i}>
                    <Pressable
                      onPress={() => router.push('/notes')}
                      accessibilityRole="button"
                      accessibilityLabel={n.text || 'Note'}
                      style={({ pressed }) => [{
                        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
                        minHeight: 44, gap: 5,
                        backgroundColor: pressed ? c.cardAlt : 'transparent',
                      }]}
                    >
                      <Row style={{ gap: spacing.sm }}>
                        {n.pinned ? <Ionicons name="pin" size={13} color={c.gold} /> : null}
                        <Txt size={font.sub} weight="600" numberOfLines={2} style={{ flex: 1 }}>
                          {n.text || n.transcript || 'Voice note'}
                        </Txt>
                      </Row>
                      <Row style={{ gap: spacing.sm }}>
                        {n.category ? <Pill label={n.category} tone="neutral" small /> : null}
                        {n.sourceType === 'voice' ? <Pill label="Voice" tone="accent" icon="mic" small /> : null}
                        <Txt size={font.tiny} color={c.faint} numeric numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>
                          {n.createdAt ? timeAgo(n.createdAt) : ''}
                        </Txt>
                      </Row>
                    </Pressable>
                  </Appear>
                ))}
              </ListSection>
            )}
          </WidgetShell>
        );
      }

      /* ----------------------------------------------------- Claim requests */
      case 'claim_requests': {
        const rows = openClaims.slice(0, w.max);
        return (
          <WidgetShell
            title={w.title ?? 'Claim requests'}
            action={t('common.seeAll')}
            onAction={() => router.push('/(tabs)/claims')}
          >
            {rows.length === 0 ? (
              <SmallEmpty
                icon={unsure(claims.length) ? 'cloud-offline-outline' : 'shield-checkmark-outline'}
                title={unsure(claims.length) ? 'Claims did not load' : claims.length > 0 ? 'No claim is open' : 'No claim on the register yet'}
                subtitle={unsure(claims.length)
                  ? 'The server did not answer, so an empty register here is not confirmed. Pull down to refresh.'
                  : claims.length > 0
                    ? 'Everything on the register is settled or closed. The full history stays on the Claims screen.'
                    : 'Claims raised by your policyholders appear here from intake to settlement.'}
                action={unsure(claims.length)
                  ? { label: 'Try again', onPress: retry }
                  : { label: 'Open claims', onPress: () => router.push('/(tabs)/claims') }}
              />
            ) : (
              <ListSection>
                {rows.map((cl, i) => (
                  <Appear key={cl.id} index={i}>
                    <View style={{ paddingHorizontal: spacing.lg }}>
                      <PersonRow
                        name={cl.clientName}
                        subtitle={cl.ref ? `${cl.ref} · ${cl.type}` : cl.type}
                        subtitleIcon="document-text-outline"
                        subtitleNumeric
                        onPress={() => router.push(`/claim/${cl.id}`)}
                        right={
                          <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: 118 }}>
                            {cl.amount > 0 ? <Metric value={inrShort(cl.amount)} size={font.sub} /> : null}
                            <Pill label={CLAIM_STATUS[cl.status].label} tone={CLAIM_STATUS[cl.status].tone} small />
                          </View>
                        }
                      />
                    </View>
                  </Appear>
                ))}
              </ListSection>
            )}
          </WidgetShell>
        );
      }

      /* --------------------------------------------------------- Issue logs */
      case 'issue_logs': {
        const rows = issueTickets.slice(0, w.max);
        return (
          <WidgetShell
            title={w.title ?? 'Issue log'}
            action={t('common.seeAll')}
            onAction={() => router.push('/tickets')}
          >
            {rows.length === 0 ? (
              <SmallEmpty
                icon={unsure(tickets.length) ? 'cloud-offline-outline' : 'checkmark-done-circle-outline'}
                title={unsure(tickets.length) ? 'The issue log did not load' : 'Nothing needs attention'}
                subtitle={unsure(tickets.length)
                  ? 'The server did not answer, so an empty log here is not confirmed. Pull down to refresh.'
                  : 'This log lists open tickets that are unclaimed, flagged red, or raised as P1. None of them is right now.'}
                action={unsure(tickets.length)
                  ? { label: 'Try again', onPress: retry }
                  : { label: 'Open all tickets', onPress: () => router.push('/tickets') }}
              />
            ) : (
              <ListSection footer="Open tickets that are unclaimed, flagged red, or raised as P1.">
                {rows.map((tk, i) => (
                  <Appear key={tk.id} index={i}>
                    <View style={{ paddingHorizontal: spacing.lg }}>
                      <PersonRow
                        name={tk.client?.name || tk.ticket_ref || 'Ticket'}
                        subtitle={tk.task || tk.reason || tk.type_label}
                        subtitleIcon="alert-circle-outline"
                        onPress={() => router.push(`/tickets/${tk.id}`)}
                        right={
                          <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: 118 }}>
                            <Pill label={tk.owner ? tk.status_label : 'Unclaimed'} tone={ticketTone(tk)} small />
                            {tk.priority ? <Txt size={font.tiny} color={c.faint} numeric>{tk.priority}</Txt> : null}
                          </View>
                        }
                      />
                    </View>
                  </Appear>
                ))}
              </ListSection>
            )}
          </WidgetShell>
        );
      }

      /* ------------------------------------------------------------ Tickets */
      case 'tickets': {
        const rows = activeTickets.slice(0, w.max);
        return (
          <WidgetShell
            title={w.title ?? 'Tickets'}
            action={t('common.seeAll')}
            onAction={() => router.push('/tickets')}
          >
            {rows.length === 0 ? (
              <SmallEmpty
                icon={unsure(tickets.length) ? 'cloud-offline-outline' : 'ticket-outline'}
                title={unsure(tickets.length) ? 'Tickets did not load' : tickets.length > 0 ? 'Every ticket is closed' : 'No ticket in the inbox'}
                subtitle={unsure(tickets.length)
                  ? 'The server did not answer, so an empty inbox here is not confirmed. Pull down to refresh.'
                  : tickets.length > 0
                    ? 'Nothing is open right now. Closed tickets stay on the Tickets screen.'
                    : 'Requests raised by policyholders land here as tickets you can claim and work.'}
                action={unsure(tickets.length)
                  ? { label: 'Try again', onPress: retry }
                  : { label: 'Open tickets', onPress: () => router.push('/tickets') }}
              />
            ) : (
              <ListSection>
                {rows.map((tk, i) => (
                  <Appear key={tk.id} index={i}>
                    <View style={{ paddingHorizontal: spacing.lg }}>
                      <PersonRow
                        name={tk.client?.name || tk.ticket_ref || 'Ticket'}
                        subtitle={tk.type_label || tk.reason}
                        subtitleIcon="chatbubble-ellipses-outline"
                        onPress={() => router.push(`/tickets/${tk.id}`)}
                        right={<Pill label={tk.status_label} tone={ticketTone(tk)} small />}
                      />
                    </View>
                  </Appear>
                ))}
              </ListSection>
            )}
          </WidgetShell>
        );
      }

      /* -------------------------------------------------------- Team roster */
      case 'team_roster': {
        const rows = team.slice(0, w.max);
        const onDuty = team.filter((m) => m.clockedIn).length;
        return (
          <WidgetShell
            title={w.title ?? 'Team'}
            action={t('common.seeAll')}
            onAction={() => router.push('/team')}
          >
            {rows.length === 0 ? (
              <SmallEmpty
                icon={unsure(team.length) ? 'cloud-offline-outline' : 'people-outline'}
                title={unsure(team.length) ? 'The roster did not load' : 'No one on your roster yet'}
                subtitle={unsure(team.length)
                  ? 'The server did not answer, so an empty roster here is not confirmed. Pull down to refresh.'
                  : 'People reporting to you appear here with their live task counts.'}
                action={unsure(team.length)
                  ? { label: 'Try again', onPress: retry }
                  : { label: 'Open team', onPress: () => router.push('/team') }}
              />
            ) : (
              <ListSection footer={`${onDuty} of ${team.length} on duty right now.`}>
                {rows.map((m, i) => (
                  <Appear key={m.id} index={i}>
                    <View style={{ paddingHorizontal: spacing.lg }}>
                      <PersonRow
                        name={m.name}
                        subtitle={m.branch || m.role}
                        subtitleIcon="briefcase-outline"
                        badge={m.clockedIn ? { tone: 'success' } : undefined}
                        onPress={() => router.push(`/team/${m.id}`)}
                        right={
                          <Pill
                            label={m.clockedIn ? 'On duty' : 'Off duty'}
                            tone={m.clockedIn ? 'success' : 'neutral'}
                            dot
                            small
                          />
                        }
                      />
                    </View>
                  </Appear>
                ))}
              </ListSection>
            )}
          </WidgetShell>
        );
      }

      /* ---------------------------------------------------------- Analytics */
      case 'analytics':
        return (
          <WidgetShell
            title={w.title ?? 'Portfolio analytics'}
            action={t('common.seeAll')}
            onAction={() => router.push('/analytics')}
          >
            {snapshot ? (
              <ListSection footer="Organisation-wide totals. Open analytics for the full breakdown.">
                <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md }}>
                  <Row style={{ gap: spacing.lg }}>
                    <View style={{ flex: 1 }}>
                      <Eyebrow>Clients</Eyebrow>
                      <Metric value={snapshot.total_clients.toLocaleString('en-IN')} size={font.h2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Eyebrow>Leads</Eyebrow>
                      <Metric value={snapshot.leads.toLocaleString('en-IN')} size={font.h2} />
                    </View>
                  </Row>
                  <Row style={{ gap: spacing.lg }}>
                    <View style={{ flex: 1 }}>
                      <Eyebrow>Claims open</Eyebrow>
                      <Metric value={String(snapshot.claims.under_process)} size={font.h2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Eyebrow>Tickets</Eyebrow>
                      <Metric value={String(snapshot.tickets)} size={font.h2} />
                    </View>
                  </Row>
                </View>
              </ListSection>
            ) : health.degraded ? (
              <SmallEmpty
                icon="cloud-offline-outline"
                title="Analytics did not load"
                subtitle="The server did not answer, so no total here would be confirmed. Pull down to refresh."
                action={{ label: 'Try again', onPress: retry }}
              />
            ) : (
              <LinkCard
                icon="stats-chart"
                title="Portfolio analytics"
                subtitle="Book value, cover bands and trends across the organisation"
                onPress={() => router.push('/analytics')}
              />
            )}
          </WidgetShell>
        );

      /* ------------------------------------------------- everything else */
      default: {
        const link = LINK_WIDGETS[w.key];
        if (!link) return null;
        return (
          <WidgetShell title={w.title ?? link.title}>
            <LinkCard
              icon={link.icon}
              title={link.title}
              subtitle={link.subtitle}
              onPress={() => router.push(link.href)}
            />
          </WidgetShell>
        );
      }
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={c.primary}
            colors={[c.primary]}
            progressBackgroundColor={c.card}
          />
        }
        showsVerticalScrollIndicator={false}
      >

        {/* Top bar */}
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Txt size={font.sub} color={c.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{greet},</Txt>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Txt size={font.sub} numberOfLines={1}>{greetEmoji}</Txt>
              </View>
              {/* Department identity badge — server-driven `theme.badge_label` (≤12 chars), shown only
                  when the role's config carries one. Its colours are the brand `primary` family, so a
                  department accent (if set) tints the badge to match the rest of its layout; azure
                  otherwise. Absent badge_label draws nothing. */}
              {config.theme?.badge_label ? (
                <View style={{
                  paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill,
                  backgroundColor: c.primarySoft,
                  borderWidth: StyleSheet.hairlineWidth, borderColor: c.primary,
                }}>
                  <Txt size={9.5} weight="800" color={c.primaryDark} numberOfLines={1}
                    style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    {config.theme.badge_label}
                  </Txt>
                </View>
              ) : null}
            </View>
            <Txt size={21} weight="900" numberOfLines={1} style={{ letterSpacing: -0.4, marginTop: 1 }}>
              {user?.name?.split(' ')[0] ?? 'Team'}
            </Txt>
          </View>

          {/* GLOBAL SEARCH, in the main header.
              This is the app's one universal entry point: it queries clients, leads, claims,
              tasks and tickets at once and matches on partial names, phone suffixes, emails
              and reference ids, so a claim can be found by the client's name without knowing
              the claim id. It sits beside the bell because the header is the only chrome
              present on every dashboard variant, whatever the role config renders below. */}
          <Pressable
            onPress={() => { haptics.tap(); router.push('/search'); }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Search everything"
            style={({ pressed }) => [{
              width: 44, height: 44, borderRadius: 15, backgroundColor: c.card,
              alignItems: 'center', justifyContent: 'center', marginRight: 8,
              borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
              opacity: pressed ? 0.7 : 1,
            }]}
          >
            <Ionicons name="search-outline" size={21} color={c.text} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            style={({ pressed }) => [{
              width: 44, height: 44, borderRadius: 15, backgroundColor: c.card,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
              opacity: pressed ? 0.7 : 1,
            }]}
          >
            <Ionicons name="notifications-outline" size={21} color={c.text} />
            {unread > 0 ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute', top: 7, right: 8, minWidth: 17, height: 17, paddingHorizontal: 3,
                  borderRadius: radius.pill, backgroundColor: c.danger,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2, borderColor: c.card,
                }}
              >
                <Txt size={9.5} weight="800" color={c.onPrimary} numeric>{unread > 99 ? '99+' : String(unread)}</Txt>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => router.push('/profile')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <Avatar name={user?.name ?? 'A'} size={44} photo={user?.photo} />
          </Pressable>
        </View>

        {loading || !uiReady ? <HomeSkeleton hero={hero} widgets={widgets} /> : (
          <>
            {/* HERO — on the clock, and how much of today is left.
                Its shape is `config.dashboard.hero`; the clock behaviour underneath is
                untouched, so a role that keeps the ring keeps the geofence and the haptics
                exactly as they have always been. */}
            {showHero ? (
              <Appear>
                <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
                  <Card>
                    <Row style={{ gap: spacing.lg }}>
                      {heroRing ? <ClockRing on={clock.in} elapsed={dutyFor} /> : null}

                      {heroTasks ? (
                        day.todayTotal > 0 ? (
                          <View
                            style={{ flex: 1 }}
                            accessible
                            accessibilityLabel={`Today, ${day.todayDone} of ${day.todayTotal} tasks done`}
                          >
                            <Eyebrow>{t('common.today')}</Eyebrow>
                            <Row style={{ alignItems: 'flex-end', gap: 6, marginTop: 3 }}>
                              <Metric value={String(shownDone)} size={font.display} />
                              <Txt size={font.h3} weight="700" color={c.muted} numeric style={{ marginBottom: 5 }}>
                                / {day.todayTotal}
                              </Txt>
                            </Row>
                            <Txt size={font.sub} color={c.muted} numberOfLines={1}>tasks done today</Txt>
                            <ProgressBar
                              value={pct}
                              tone={pct >= 1 ? c.success : c.primary}
                              height={8}
                              style={{ marginTop: 12 }}
                            />
                          </View>
                        ) : (
                          <View style={{ flex: 1 }}>
                            <Eyebrow>{t('common.today')}</Eyebrow>
                            <Txt size={font.h3} weight="800" style={{ marginTop: 4 }} numberOfLines={2}>
                              {unconfirmed ? 'Not confirmed' : 'Nothing scheduled'}
                            </Txt>
                            <Txt size={font.sub} color={c.muted} style={{ marginTop: 3 }} numberOfLines={3}>
                              {unconfirmed
                                ? 'The server did not answer, so this is not a confirmed empty day. Pull down to refresh.'
                                : 'No task is due today.'}
                            </Txt>
                          </View>
                        )
                      ) : (
                        /* clock_only: the ring carries the state, this side carries the words. */
                        <View style={{ flex: 1 }}>
                          <Eyebrow>Attendance</Eyebrow>
                          <Txt size={font.h3} weight="800" style={{ marginTop: 4 }} numberOfLines={2}>
                            {clock.in ? clockedInLine(clock.time, t('home.clockedIn')) : t('home.markAttendance')}
                          </Txt>
                          <Txt size={font.sub} color={clock.in ? c.success : c.muted} style={{ marginTop: 3 }} numberOfLines={2}>
                            {dutyLine}
                          </Txt>
                        </View>
                      )}
                    </Row>

                    {heroClockRow ? (
                      <>
                        <View style={hairline} />
                        <Row>
                          <View style={{ flex: 1 }}>
                            <Txt size={font.body} weight="700" numberOfLines={1}>
                              {clock.in
                                ? clockedInLine(clock.time, t('home.clockedIn'))
                                : t('home.markAttendance')}
                            </Txt>
                            <Txt
                              size={font.sub}
                              weight={clock.in ? '600' : '400'}
                              color={clock.in ? c.success : c.muted}
                              numberOfLines={1}
                              style={{ marginTop: 2 }}
                            >
                              {dutyLine}
                            </Txt>
                          </View>
                          {!clock.in ? (
                            <Button
                              label={t('home.clockIn')}
                              icon="location"
                              variant="primary"
                              loading={clocking}
                              onPress={toggleClock}
                            />
                          ) : null}
                        </Row>
                        {/* PHASE 52: once on the clock, Break + Clock out sit side by side. */}
                        {clock.in ? (
                          <Row style={{ gap: spacing.sm, marginTop: spacing.md }}>
                            <Button
                              label={clock.onBreak ? t('break.end') : t('break.start')}
                              icon={clock.onBreak ? 'play' : 'cafe-outline'}
                              variant={clock.onBreak ? 'primary' : 'outline'}
                              loading={breaking}
                              disabled={clocking}
                              onPress={clock.onBreak ? pressEndBreak : pressBreak}
                              style={{ flex: 1 }}
                            />
                            <Button
                              label={t('home.clockOut')}
                              icon="log-out-outline"
                              variant="outline"
                              loading={clocking}
                              disabled={breaking}
                              onPress={toggleClock}
                              style={{ flex: 1 }}
                            />
                          </Row>
                        ) : null}
                      </>
                    ) : null}
                  </Card>
                </View>
              </Appear>
            ) : null}

            {notice ? (
              <View style={{ paddingHorizontal: spacing.lg, marginTop: showHero ? spacing.md : spacing.lg }}>
                <Banner
                  tone={notice.tone}
                  title={notice.title}
                  message={notice.message}
                  onDismiss={() => setNotice(null)}
                />
              </View>
            ) : null}

            {/* THE DASHBOARD, IN THE ROLE'S OWN ORDER. */}
            {widgets.map((w, i) => {
              const node = renderWidget(w);
              if (!node) return null;
              return <Appear key={w.key} index={i}>{node}</Appear>;
            })}

            {/* ADMIN / MASTER — org figures keep their own dashboard surface, below the
                configured widgets so that the role's stated order is what leads the screen. */}
            {!isTeam && (
              <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xxl }}>
                <SectionHeader
                  title={caps.tier === 'master' ? 'Organisation' : 'Your branch'}
                  action={t('common.seeAll')}
                  onAction={() => router.push('/team')}
                />
                {orgReady ? (
                  caps.tier === 'master'
                    ? <MasterDashboard team={team} tasks={tasks} snapshot={snapshot} notifications={notifs} />
                    : <AdminDashboard team={team} tasks={tasks} snapshot={snapshot} />
                ) : (
                  <Card>
                    {health.degraded ? (
                      <EmptyState
                        icon="cloud-offline-outline"
                        title="Organisation figures did not load"
                        subtitle="The server did not answer, so no org total here would be confirmed. Pull down to refresh."
                        action={{ label: 'Try again', onPress: retry }}
                      />
                    ) : (
                      <EmptyState
                        icon="business-outline"
                        title="No organisation figures yet"
                        subtitle="Team and org totals appear here once records are linked to this account."
                        action={{ label: 'Open team', onPress: () => router.push('/team') }}
                      />
                    )}
                  </Card>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* PHASE 52: the optional break-reason prompt. Both actions start the break — Skip sends no
          reason, Start break sends the typed one. Sent additively; stored server-side once the
          `[api]` Break-A ask ships. */}
      <Sheet
        visible={breakSheet}
        onClose={() => { if (!breaking) setBreakSheet(false); }}
        title={t('break.reasonTitle')}
        footer={
          <Row style={{ gap: spacing.sm }}>
            <Button
              label={t('break.reasonSkip')}
              variant="outline"
              disabled={breaking}
              onPress={() => startBreakNow(false)}
              style={{ flex: 1 }}
            />
            <Button
              label={t('break.reasonStart')}
              variant="primary"
              loading={breaking}
              onPress={() => startBreakNow(true)}
              style={{ flex: 1 }}
            />
          </Row>
        }
      >
        <Field
          label={t('break.reasonPlaceholder')}
          value={breakReason}
          onChange={setBreakReason}
          multiline
          maxLength={500}
          autoFocus
        />
      </Sheet>

      {/* PHASE 50: out-of-range / early clock actions are ALLOWED but must carry a reason (server-
          enforced; a master is notified). This collects it and re-sends the SAME action. Localised
          in all 5 languages via `clock.reason*` (owner human copy, 2026-08-20). The server's own
          `message` still wins when present; the `clock.reasonEarly`/`clock.reasonAway` copy is the
          fallback. Buttons reuse `common.cancel` / `home.clockIn` / `home.clockOut`. */}
      <Sheet
        visible={clockReasonSheet}
        onClose={() => { if (!clocking) setClockReasonSheet(false); }}
        title={clock.in ? t('clock.reasonTitleOut') : t('clock.reasonTitleIn')}
        footer={
          <Row style={{ gap: spacing.sm }}>
            <Button
              label={t('common.cancel')}
              variant="outline"
              disabled={clocking}
              onPress={() => { if (!clocking) setClockReasonSheet(false); }}
              style={{ flex: 1 }}
            />
            <Button
              label={clock.in ? t('home.clockOut') : t('home.clockIn')}
              variant="primary"
              loading={clocking}
              disabled={!clockReason.trim()}
              onPress={submitClockReason}
              style={{ flex: 1 }}
            />
          </Row>
        }
      >
        <Field
          label={
            clockReasonCtx?.message
            || (clockReasonCtx?.early
              ? t('clock.reasonEarly')
              : t('clock.reasonAway'))
          }
          value={clockReason}
          onChange={setClockReason}
          multiline
          maxLength={500}
          autoFocus
        />
      </Sheet>
    </Screen>
  );
}
