/**
 * Server-driven UI configuration.
 *
 * The web Admin Panel writes one document per role into `app_role_preferences`; the app
 * reads its own role's resolved document from `GET /api/rbac/app-ui` and renders its
 * dashboard, navigation and feature gates from it. The full contract, including every
 * widget key and the per-role defaults, lives in `ANDROID/ui_rbac_config.json`.
 *
 * THREE RULES FROM THE CONTRACT ARE LOAD-BEARING HERE:
 *
 *  1. FAIL OPEN. `api.getAppUiConfig()` resolves null on any failure. Null means fall back
 *     to `DEFAULT_UI`, which shows everything. A layout-config outage must never be able to
 *     hide a field agent's own work from them.
 *  2. A MISSING KEY INHERITS, it never means "hidden". When the server DID answer, an
 *     omitted feature inherits the schema default (`SCHEMA_FEATURE_DEFAULTS`), not the
 *     wide-open fallback: the server has already deep-merged role defaults in, so
 *     `can_send_campaign` being absent from a sales config genuinely means "not for sales".
 *     Only a total outage opens everything.
 *  3. PRESENTATION ONLY. Every one of these gates is re-checked by the API. A client that
 *     ignores them gets a 403, which is why erring open here is safe.
 *
 * Array order is render order. `widgets` is never sorted.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/data/api';
import type { AppUiConfig, UiWidget } from '@/data/api';
import { useAuth } from '@/store/auth';

export type { AppUiConfig, UiWidget } from '@/data/api';

/* --------------------------------------------------------------- vocabulary */

/** Every dashboard widget key in the contract, in schema order. */
export const WIDGET_KEYS = [
  'my_tasks', 'prospects', 'leads_pipeline', 'personal_notes',
  'claim_requests', 'issue_logs', 'tickets', 'kpi_strip',
  'quick_actions', 'day_spine', 'follow_ups', 'notice_board',
  'campaigns', 'segments', 'families', 'knowledge_base',
  'commissions', 'analytics', 'attendance', 'team_roster',
] as const;
export type WidgetKey = (typeof WIDGET_KEYS)[number];

/** Every capability toggle in the contract. */
export const FEATURE_KEYS = [
  'can_clock_in', 'can_create_task', 'can_assign_task_to_others', 'can_create_claim',
  'can_advance_claim_status', 'can_claim_ticket', 'can_send_campaign',
  'can_dispatch_notification', 'can_view_team_roster', 'can_view_agent_map',
  'can_view_movement_paths', 'can_view_org_analytics', 'can_export_data',
  'can_edit_client',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

/**
 * WIRING STATUS as of Band 2 #8 (2026-08-25). A `can(...)` gate only bites where the app actually
 * has a control to gate. Recorded here so the un-wired flags don't read as "forgotten":
 *
 *  WIRED — consumed via `can(...)`:
 *   • can_clock_in              → home clock-in hero
 *   • can_create_task           → home / tasks / task-new create (AND caps.assignTasks)
 *   • can_assign_task_to_others → task/[id] transfer            (AND caps.assignTasks)
 *   • can_send_campaign         → campaigns send                (AND caps.runCampaigns)
 *   • can_dispatch_notification → notify screen guard           (AND caps.manageTeam)
 *   • can_create_claim          → claims "New claim" Fab + empty-state  (flag-only, default true)
 *   • can_claim_ticket          → tickets/[id] "I'll take this"          (flag-only, default true)
 *   • can_view_team_roster      → home roster
 *   • can_view_org_analytics    → home analytics
 *
 *  NOT wired ON PURPOSE — already gated TIGHTER by an owner-locked rule:
 *   • can_view_agent_map / can_view_movement_paths → master-only via `canSeeLiveLocation` (roles.ts).
 *     The JSON grants these to admin, but Phase 40 locked live location to the real super_admin.
 *     ANDing a fail-open flag can only NARROW, never widen, so wiring it would merely add a way to
 *     hide the map from master too. Left as-is (owner decision A, 2026-08-25).
 *
 *  NO APP AFFORDANCE YET — nothing to gate (owner decision B, 2026-08-25):
 *   • can_advance_claim_status → the app has no claim status-advance control (no endpoint exists).
 *   • can_export_data          → no admin/bulk export; account.tsx's OWN-data DPDP export is a
 *                                privacy right and deliberately NOT behind this admin flag.
 *   • can_edit_client          → no client-edit control (no `updateClient` in api.ts).
 */

/** Collections global search may be pointed at. */
export const SEARCH_SCOPES = ['clients', 'leads', 'claims', 'tasks', 'tickets', 'prospects', 'families', 'kb'] as const;

export type HeroMode = 'clock_and_tasks' | 'tasks_only' | 'clock_only' | 'none';
const HERO_MODES: readonly HeroMode[] = ['clock_and_tasks', 'tasks_only', 'clock_only', 'none'];

const DEFAULT_MAX_ITEMS = 5;   // schema default
const MAX_MAX_ITEMS = 50;      // schema maximum

/**
 * The schema's own per-feature defaults, used when the SERVER ANSWERED but left a key out.
 * These mirror `properties.features.*.default` in `ui_rbac_config.json` exactly. Keep them
 * in step with that file: they are what an unconfigured role actually gets.
 */
const SCHEMA_FEATURE_DEFAULTS: Record<string, boolean | string[]> = {
  can_clock_in: true,
  can_create_task: true,
  can_assign_task_to_others: false,
  can_create_claim: true,
  can_advance_claim_status: false,
  can_claim_ticket: true,
  can_send_campaign: false,
  can_dispatch_notification: false,
  can_view_team_roster: false,
  can_view_agent_map: false,
  can_view_movement_paths: false,
  can_view_org_analytics: false,
  can_export_data: false,
  can_edit_client: false,
  global_search_scopes: ['clients', 'leads', 'claims', 'tasks'],
};

/* ------------------------------------------------------------- the fallback */

/**
 * Built-in layout used when there is no server config at all.
 *
 * Everything is visible and every capability is on. This is the "config outage" shape, and
 * it is deliberately maximal: the app can survive showing a control that later 403s, it
 * cannot survive hiding a field agent's own tasks. The widget order follows the product
 * mandate (tasks, prospects, leads, notes first, then the operations pair), and the four
 * More-tab groups are the union of the sales and operations defaults so every module stays
 * reachable.
 *
 * Treat this object as READ-ONLY. It is shared by every consumer of the hook.
 */
export const DEFAULT_UI: AppUiConfig = {
  role_key: 'default',
  label: 'Full access (offline default)',
  dashboard: {
    hero: 'clock_and_tasks',
    widgets: [
      { key: 'my_tasks', visible: true, title_override: null, max_items: 6, mandatory: true },
      { key: 'prospects', visible: true, title_override: null, max_items: 5, mandatory: true },
      { key: 'leads_pipeline', visible: true, title_override: null, max_items: 5, mandatory: true },
      { key: 'personal_notes', visible: true, title_override: null, max_items: 4, mandatory: true },
      { key: 'claim_requests', visible: true, title_override: null, max_items: 8, mandatory: true },
      { key: 'issue_logs', visible: true, title_override: null, max_items: 6, mandatory: true },
      { key: 'tickets', visible: true, title_override: null, max_items: 6, mandatory: false },
      { key: 'kpi_strip', visible: true, title_override: null, max_items: 6, mandatory: false },
      { key: 'quick_actions', visible: true, title_override: null, max_items: 6, mandatory: false },
      { key: 'day_spine', visible: true, title_override: null, max_items: 6, mandatory: false },
      { key: 'follow_ups', visible: true, title_override: null, max_items: 5, mandatory: false },
      { key: 'notice_board', visible: true, title_override: null, max_items: 4, mandatory: false },
      { key: 'campaigns', visible: true, title_override: null, max_items: 4, mandatory: false },
      { key: 'segments', visible: true, title_override: null, max_items: 4, mandatory: false },
      { key: 'families', visible: true, title_override: null, max_items: 4, mandatory: false },
      { key: 'knowledge_base', visible: true, title_override: null, max_items: 4, mandatory: false },
      { key: 'commissions', visible: true, title_override: null, max_items: 4, mandatory: false },
      { key: 'analytics', visible: true, title_override: null, max_items: 4, mandatory: false },
      { key: 'attendance', visible: true, title_override: null, max_items: 4, mandatory: false },
      { key: 'team_roster', visible: true, title_override: null, max_items: 5, mandatory: false },
    ],
  },
  nav: {
    tabs: ['home', 'tasks', 'clients', 'claims', 'more'],
    // Since Phase 26 this array is actually RENDERED (see arrangeMoreSections + more.tsx), not just
    // a placeholder: it is the resolved layout for a config outage AND for every role whose document
    // omits more_sections (admin/master samples do, and any unseeded department). So it must be a
    // deliberate default that names EVERY content module in MORE_CATALOGUE — otherwise an unnamed
    // module would land in the trailing catch-all rather than a chosen group. Keep it in step with
    // more.tsx's catalogue: a module in one but not the other is a menu bug.
    more_sections: [
      { title: 'The book', items: ['clients', 'leads', 'segments', 'families', 'premium', 'prospects', 'lic-plans'] },
      { title: 'Day to day', items: ['tickets', 'claims', 'reminders', 'calendar', 'attendance', 'whatsapp', 'commissions'] },
      { title: 'Board', items: ['notice-board', 'notes'] },
      { title: 'Reference', items: ['kb', 'search', 'contests'] },
      { title: 'You', items: ['profile', 'settings', 'account'] },
    ],
    hidden: [],
  },
  features: {
    can_clock_in: true,
    can_create_task: true,
    can_assign_task_to_others: true,
    can_create_claim: true,
    can_advance_claim_status: true,
    can_claim_ticket: true,
    can_send_campaign: true,
    can_dispatch_notification: true,
    can_view_team_roster: true,
    can_view_agent_map: true,
    can_view_movement_paths: true,
    can_view_org_analytics: true,
    can_export_data: true,
    can_edit_client: true,
    global_search_scopes: [...SEARCH_SCOPES],
  },
};

/* ------------------------------------------------------------ normalisation */

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/** Strings only, blanks dropped, order preserved, duplicates removed. */
function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    if (typeof raw !== 'string') continue;
    const s = raw.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function normalizeWidget(input: unknown): UiWidget | null {
  if (!isRec(input)) return null;
  const key = typeof input.key === 'string' ? input.key.trim() : '';
  if (!key) return null;
  const max = Number(input.max_items);
  const title = typeof input.title_override === 'string' ? input.title_override.trim() : '';
  return {
    key,
    // Absent visibility reads as visible. Only an explicit false hides a widget.
    visible: input.visible !== false,
    title_override: title || null,
    max_items: Number.isFinite(max) ? Math.min(MAX_MAX_ITEMS, Math.max(1, Math.round(max))) : DEFAULT_MAX_ITEMS,
    mandatory: input.mandatory === true,
  };
}

function normalizeSections(input: unknown): AppUiConfig['nav']['more_sections'] {
  if (!Array.isArray(input)) return undefined;
  const out: { title: string; items: string[] }[] = [];
  for (const raw of input) {
    if (!isRec(raw)) continue;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const items = strList(raw.items);
    if (!title || items.length === 0) continue;
    out.push({ title, items });
  }
  return out.length ? out : undefined;
}

/**
 * Turn whatever the endpoint actually returned into a usable config, or null to say
 * "use DEFAULT_UI".
 *
 * Exported because it is the whole risk surface of this module: the server response is
 * untrusted JSON, and a half-written Admin Panel document must degrade to a working
 * dashboard rather than a blank one.
 */
export function normalizeUiConfig(input: unknown): AppUiConfig | null {
  if (!isRec(input)) return null;

  const dash = isRec(input.dashboard) ? input.dashboard : null;
  const nav = isRec(input.nav) ? input.nav : null;

  // Widgets, in array order, deduplicated by key so a double-saved document cannot
  // produce two identical dashboard cards.
  const widgets: UiWidget[] = [];
  const seen = new Set<string>();
  if (dash && Array.isArray(dash.widgets)) {
    for (const raw of dash.widgets) {
      const w = normalizeWidget(raw);
      if (!w || seen.has(w.key)) continue;
      seen.add(w.key);
      widgets.push(w);
    }
  }

  const hero = typeof dash?.hero === 'string' && (HERO_MODES as readonly string[]).includes(dash.hero)
    ? (dash.hero as HeroMode)
    : DEFAULT_UI.dashboard.hero;

  // Features: schema defaults first, then whatever the server actually said. An omitted
  // key inherits the schema default; it is never read as "hidden".
  const features: Record<string, boolean | string[]> = { ...SCHEMA_FEATURE_DEFAULTS };
  if (isRec(input.features)) {
    for (const [k, v] of Object.entries(input.features)) {
      if (typeof v === 'boolean') features[k] = v;
      else if (Array.isArray(v)) features[k] = strList(v);
    }
  }

  const tabs = strList(nav?.tabs);

  return {
    role_key: typeof input.role_key === 'string' && input.role_key.trim() ? input.role_key.trim() : DEFAULT_UI.role_key,
    label: typeof input.label === 'string' && input.label.trim() ? input.label.trim() : undefined,
    dashboard: {
      hero,
      // An empty widget list is the "role never configured" state from `global_defaults`,
      // not a deliberate blank dashboard: the Admin Panel cannot even produce one, because
      // mandatory widgets keep their switch on. Falling back here is the difference between
      // an unconfigured role seeing their work and seeing nothing.
      widgets: widgets.length ? widgets : DEFAULT_UI.dashboard.widgets,
    },
    nav: {
      // Not truncated to five on purpose. The schema caps tabs at five and the nav layer
      // decides what spills into More; silently dropping entries here would make them
      // vanish from both places.
      tabs: tabs.length ? tabs : DEFAULT_UI.nav.tabs,
      more_sections: normalizeSections(nav?.more_sections) ?? DEFAULT_UI.nav.more_sections,
      hidden: strList(nav?.hidden),
    },
    features,
    theme: normalizeTheme(input.theme),
  };
}

function normalizeTheme(input: unknown): AppUiConfig['theme'] {
  if (!isRec(input)) return undefined;
  const accent = typeof input.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.accent) ? input.accent : undefined;
  const badge = typeof input.badge_label === 'string' && input.badge_label.trim()
    ? input.badge_label.trim().slice(0, 12)
    : undefined;
  const density = input.density === 'compact' || input.density === 'comfortable' ? input.density : undefined;
  if (!accent && !badge && !density) return undefined;
  return { accent, badge_label: badge, density };
}

/* ---------------------------------------------------------------- selectors */

/** Visible widgets, IN ARRAY ORDER. Array order is render order, so this never sorts. */
function visibleWidgetsOf(config: AppUiConfig): UiWidget[] {
  return config.dashboard.widgets.filter((w) => w.visible !== false);
}

/**
 * Bottom-tab routes this build can physically render, in the order `_layout.tsx` registers
 * them as `<Tabs.Screen>`. `ui_rbac_config.json`'s `nav.tabs` enum also allows `prospects` and
 * `tickets` — those live outside the `(tabs)` route group today, so a config naming them still
 * reaches the user, just through the More tab rather than the bar (same as `leads` did before
 * this phase). Moving them into the tab group is a bigger, separate change.
 */
const KNOWN_TAB_ROUTES = ['home', 'tasks', 'clients', 'leads', 'claims'] as const;

/**
 * Ordered, de-duplicated bottom-tab routes for this config: `nav.tabs` filtered to routes this
 * build can render and with `nav.hidden` removed, falling back to `DEFAULT_UI`'s order if
 * nothing survives. `more` is always appended last, regardless of `nav.tabs`/`nav.hidden` —
 * it is the only way back to a module that lost its tab slot (and the only way to sign out),
 * so hiding it would strand the session. Every sample config in the contract already lists it
 * last, so this changes nothing for a well-formed document.
 */
export function resolveTabs(config: AppUiConfig): string[] {
  const known = new Set<string>(KNOWN_TAB_ROUTES);
  const hidden = new Set(config.nav.hidden);
  const pick = (list: readonly string[]) => {
    const out: string[] = [];
    for (const key of list) {
      if (!known.has(key) || hidden.has(key) || out.includes(key)) continue;
      out.push(key);
    }
    return out;
  };
  const out = pick(config.nav.tabs);
  if (!out.length) out.push(...pick(DEFAULT_UI.nav.tabs));
  out.push('more');
  return out;
}

/**
 * Arrange the More tab's CONTENT modules into ordered, titled groups from `nav.more_sections`.
 *
 * The config document names the grouping, titles and order; this turns that into concrete groups the
 * screen renders. `known` is the set of module keys this build can render as a More row (more.tsx's
 * `MORE_CATALOGUE` keys) — the admin oversight modules and the personal local-feature rows are NOT in
 * it, because they render in fixed sections (see PHASE-26 D-2/D-3), so a config that names them here
 * has no effect.
 *
 * Three rules, mirroring `resolveTabs`:
 *  1. A group's items are filtered to keys that are KNOWN, NOT hidden, and NOT already placed by an
 *     earlier group — first placement wins, so a double-listed module renders once. Empty groups drop.
 *  2. HARD PRODUCT RULE (`ui_rbac_config.json:18`): omitting a module from `more_sections` must never
 *     make it unreachable — only `nav.hidden` does that. So every known, non-hidden module the config
 *     did not place is appended in ONE trailing `leftoverTitle` group. A minimal or half-written
 *     document re-prioritises the menu; it can never empty it.
 *  3. `nav.hidden` removes a module from EVERY group, including the catch-all — that is the one control
 *     that makes a module vanish.
 *
 * Pure over strings (no React, no catalogue data), so it is unit-tested directly. Leftover order
 * follows `known`'s order, which is the catalogue's declaration order.
 */
export function arrangeMoreSections(
  sections: readonly { title: string; items: readonly string[] }[] | undefined,
  known: readonly string[],
  isHidden: (moduleKey: string) => boolean,
  leftoverTitle = 'More',
): { title: string; keys: string[] }[] {
  const knownSet = new Set(known);
  const placed = new Set<string>();
  const out: { title: string; keys: string[] }[] = [];
  // `undefined`/empty sections is fail-open, not a blank menu: with nothing placed, every known,
  // non-hidden module falls to the trailing catch-all below (the hard product rule, defensively).
  for (const section of sections ?? []) {
    const keys: string[] = [];
    for (const key of section.items) {
      if (!knownSet.has(key) || isHidden(key) || placed.has(key)) continue;
      placed.add(key);
      keys.push(key);
    }
    if (keys.length) out.push({ title: section.title, keys });
  }
  const leftover = known.filter((k) => !isHidden(k) && !placed.has(k));
  if (leftover.length) out.push({ title: leftoverTitle, keys: leftover });
  return out;
}

/** Is this module removed from navigation entirely for this role? */
function isModuleHidden(config: AppUiConfig, moduleKey: string): boolean {
  return config.nav.hidden.includes(moduleKey);
}

/**
 * Does this widget belong on the dashboard?
 *
 * Not the same question as "may this user reach this module". A widget that is absent or
 * switched off is still reachable from the More tab; only `nav.hidden` removes a module.
 */
function isWidgetVisibleIn(config: AppUiConfig, widgetKey: string): boolean {
  const w = config.dashboard.widgets.find((x) => x.key === widgetKey);
  return !!w && w.visible !== false;
}

/**
 * Read a capability toggle.
 *
 * A list-valued feature (`global_search_scopes`) answers true when it is non-empty. A key
 * the contract does not define at all answers false, since that is a typo in the caller
 * rather than a permission question.
 */
function canIn(config: AppUiConfig, featureKey: string): boolean {
  const v = config.features?.[featureKey];
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.length > 0;
  const d = SCHEMA_FEATURE_DEFAULTS[featureKey];
  if (typeof d === 'boolean') return d;
  if (Array.isArray(d)) return d.length > 0;
  return false;
}

/** The collections this role's global search may query. Falls back to the schema default. */
export function searchScopes(config: AppUiConfig): string[] {
  const v = config.features?.global_search_scopes;
  if (Array.isArray(v) && v.length) return v;
  const d = SCHEMA_FEATURE_DEFAULTS.global_search_scopes;
  return Array.isArray(d) ? [...d] : [];
}

/* ----------------------------------------------------------------- provider */

export type AppUiState = {
  /** Never null. The built-in `DEFAULT_UI` stands in while there is no server config. */
  config: AppUiConfig;
  /**
   * False until the session is restored and this user's own config has settled. Gate
   * skeletons on it; `config` is already safe to read (it holds the fallback meanwhile).
   */
  ready: boolean;
  refresh: () => Promise<void>;
  isVisible: (widgetKey: string) => boolean;
  /** Visible dashboard widgets in array order. Array order is render order. */
  widgets: UiWidget[];
  can: (featureKey: string) => boolean;
  /** True while the built-in fallback is standing in for a server config. */
  usingFallback: boolean;
  /** Ordered bottom-tab routes, see `resolveTabs`. Always ends with `more`. */
  tabs: string[];
  /** Is this module (a tab, or a More-tab entry) removed from navigation entirely? */
  isHidden: (moduleKey: string) => boolean;
};

/**
 * The context default is a working fail-open state, not an empty object. A screen rendered
 * outside the provider gets the full menu instead of a crash on `can(...)`.
 */
const FALLBACK_STATE: AppUiState = {
  config: DEFAULT_UI,
  ready: true,
  refresh: async () => {},
  isVisible: (k) => isWidgetVisibleIn(DEFAULT_UI, k),
  widgets: visibleWidgetsOf(DEFAULT_UI),
  can: (k) => canIn(DEFAULT_UI, k),
  usingFallback: true,
  tabs: resolveTabs(DEFAULT_UI),
  isHidden: (k) => isModuleHidden(DEFAULT_UI, k),
};

const AppUiContext = createContext<AppUiState>(FALLBACK_STATE);

export function AppUiProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  // `useAuth()` hands back an empty object if this provider is ever mounted outside
  // AuthProvider, so read defensively: a mis-ordered provider tree must degrade to the
  // fallback config rather than sit on ready:false forever.
  const userId = auth?.user?.id ?? null;
  const authReady = auth?.ready ?? true;

  /**
   * The resolved config, tagged with the user it belongs to.
   *
   * Tagging is what lets `ready` and the active config be DERIVED instead of reset from
   * inside an effect. The moment the signed-in user changes, this row stops matching, so
   * the outgoing user's layout stops being served immediately, with no cascading render
   * and no window where one person's dashboard shows to the next person on a shared handset.
   */
  const [last, setLast] = useState<{ user: string; config: AppUiConfig | null } | null>(null);

  const alive = useRef(true);
  const run = useRef(0);

  // Declared before the fetch effect on purpose: effects mount in declaration order and
  // clean up in the same order, so on a StrictMode remount `alive` is back to true before
  // the fetch below runs.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;   // signed out, nothing to resolve
    const id = ++run.current;
    // Guards both unmount and a superseded request: switching users mid-flight must not
    // let the previous user's layout land on the new user's session.
    const mine = () => alive.current && run.current === id;

    let next: AppUiConfig | null = null;
    try {
      next = normalizeUiConfig(await api.getAppUiConfig());
    } catch {
      // getAppUiConfig already swallows failures and resolves null; this is belt and
      // braces so a surprise throw can never wedge the app on a blank layout.
      next = null;
    }
    if (!mine()) return;
    setLast({ user: userId, config: next });
  }, [userId]);

  useEffect(() => {
    if (!authReady) return;   // wait for the restored session, or the call goes out unauthenticated
    void load();
  }, [authReady, load]);

  const served = last && last.user === userId ? last.config : null;
  // Signed out resolves instantly (there is no role to look up); signed in waits for this
  // user's own answer. Both wait for auth, so a cold start with a saved session cannot
  // flash the wide-open fallback before the real layout arrives.
  const ready = authReady && (userId === null || (last !== null && last.user === userId));
  const config = served ?? DEFAULT_UI;
  const widgets = useMemo(() => visibleWidgetsOf(config), [config]);
  const tabs = useMemo(() => resolveTabs(config), [config]);

  const value = useMemo<AppUiState>(() => ({
    config,
    ready,
    refresh: load,
    widgets,
    usingFallback: served === null,
    isVisible: (widgetKey: string) => isWidgetVisibleIn(config, widgetKey),
    can: (featureKey: string) => canIn(config, featureKey),
    tabs,
    isHidden: (moduleKey: string) => isModuleHidden(config, moduleKey),
  }), [config, served, ready, widgets, tabs, load]);
  // `served`/`ready` are derived, so this memo re-runs exactly when one of them changes.

  return <AppUiContext.Provider value={value}>{children}</AppUiContext.Provider>;
}

export function useAppUi(): AppUiState {
  return useContext(AppUiContext);
}
