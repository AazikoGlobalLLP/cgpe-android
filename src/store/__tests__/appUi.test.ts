/**
 * PHASE 2 — `normalizeUiConfig` pinned.
 *
 * appUi.tsx's own docstring calls this "the whole risk surface of this module": it is the only
 * thing standing between an untrusted, possibly half-written Admin Panel document and the
 * dashboard a field agent sees. A blank dashboard is a worse outcome than a wrong one, so almost
 * everything here is a degradation rule.
 *
 * IMPORTING THIS MODULE NEEDS FOUR ALIAS STUBS (react-native, async-storage,
 * expo-local-authentication, expo-secure-store) — but NOT ONE STUBBED BYTE SITS BETWEEN THESE
 * TESTS AND THE FUNCTION. normalizeUiConfig calls only isRec, normalizeWidget, normalizeSections,
 * normalizeTheme, strList, HERO_MODES, DEFAULT_UI and SCHEMA_FEATURE_DEFAULTS, every one of them
 * defined in appUi.tsx itself. The stubs exist purely because appUi.tsx:25 and :27 are VALUE
 * imports (`import * as api`, `import { useAuth }`) that only AppUiProvider uses. See
 * docs/spec/PHASE-2.md rows 2 and 4.
 *
 * TREAT EVERY RETURNED CONFIG AS READ-ONLY. normalizeUiConfig hands back DEFAULT_UI's own arrays
 * by reference (appUi.tsx:257, :263, :264) and nothing is frozen, so mutating one would poison
 * DEFAULT_UI for every later case in this file.
 */
import { describe, expect, it } from 'vitest';
import { arrangeMoreSections, DEFAULT_UI, departmentFallbackUi, normalizeUiConfig, OPS_TEAM_UI, resolveTabs, SALES_TEAM_UI } from '@/store/appUi';
import type { AppUiConfig } from '@/store/appUi';

/** A hidden-predicate over a fixed set — the shape more.tsx passes from useAppUi().isHidden. */
const hides = (...keys: string[]) => (k: string) => keys.includes(k);

/** Minimal config builder — resolveTabs only ever reads config.nav. */
function withNav(tabs: string[], hidden: string[] = []): AppUiConfig {
  return { ...DEFAULT_UI, nav: { ...DEFAULT_UI.nav, tabs, hidden } };
}

/**
 * The schema's own per-feature defaults (appUi.tsx:67-83), restated here by hand.
 * That duplication is deliberate: this is the tripwire for the hand-maintained mirror of
 * ui_rbac_config.json that CLAUDE.md warns "drifts silently".
 *
 * Note how little this resembles DEFAULT_UI.features, where all 14 booleans are true.
 */
const SCHEMA_DEFAULT_FEATURES = {
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

describe('normalizeUiConfig — what it refuses', () => {
  it('returns null for null and undefined', () => {
    // This is the ONLY null return in the function, and it is what the caller turns into the
    // fail-open DEFAULT_UI at appUi.tsx:419 — normalizeUiConfig never substitutes it itself.
    expect(normalizeUiConfig(null)).toBeNull();
    expect(normalizeUiConfig(undefined)).toBeNull();
  });

  it('returns null for primitives', () => {
    expect(normalizeUiConfig('a half-written admin document')).toBeNull();
    expect(normalizeUiConfig(42)).toBeNull();
    expect(normalizeUiConfig(0)).toBeNull();
    expect(normalizeUiConfig(false)).toBeNull();
  });

  it('returns null for an ARRAY at the top level', () => {
    // isRec explicitly excludes arrays — an array IS typeof 'object', so without that clause a
    // server returning the collection instead of the document would produce a garbage config.
    expect(normalizeUiConfig([])).toBeNull();
    expect(normalizeUiConfig([{ role_key: 'ops' }])).toBeNull();
  });
});

describe('normalizeUiConfig — the empty document', () => {
  it('does NOT return null for {} — it returns the tightest possible config', () => {
    // THE SHARPEST EDGE IN THE FILE. {} is a Rec, so it yields a full config built on
    // SCHEMA_FEATURE_DEFAULTS, where 10 of 14 flags are FALSE. Meanwhile the provider's
    // `usingFallback` (appUi.tsx:427) is `served === null`, so it reports FALSE — the user is
    // on the tightest config while the app believes the server configured them deliberately.
    // Anyone assuming "empty document = full access" writes the wrong assertion; this exists
    // to stop that.
    expect(normalizeUiConfig({})).toEqual({
      role_key: 'default',
      label: undefined,
      dashboard: { hero: 'clock_and_tasks', widgets: DEFAULT_UI.dashboard.widgets },
      nav: {
        tabs: DEFAULT_UI.nav.tabs,
        more_sections: DEFAULT_UI.nav.more_sections,
        hidden: [],
      },
      features: SCHEMA_DEFAULT_FEATURES,
      theme: undefined,
    });
  });

  it('hands back DEFAULT_UI\'s own arrays BY REFERENCE, except nav.hidden', () => {
    // Nothing in appUi.tsx is Object.freeze'd, so a consumer that mutates a returned config
    // corrupts the module-wide fallback for every other consumer. `hidden` is the one field
    // never aliased: it always comes back fresh from strList.
    const r = normalizeUiConfig({})!;
    expect(r.dashboard.widgets).toBe(DEFAULT_UI.dashboard.widgets);
    expect(r.nav.tabs).toBe(DEFAULT_UI.nav.tabs);
    expect(r.nav.more_sections).toBe(DEFAULT_UI.nav.more_sections);
    expect(r.nav.hidden).not.toBe(DEFAULT_UI.nav.hidden);
  });
});

describe('normalizeUiConfig — widgets', () => {
  it('collapses duplicate keys to the FIRST occurrence, after trimming', () => {
    // The dedupe key is the TRIMMED key, so a whitespace variant is caught too, and the first
    // entry's max_items wins. A Set-based rewrite could easily invert this.
    const r = normalizeUiConfig({
      dashboard: { widgets: [{ key: 'my_tasks', max_items: 9 }, { key: ' my_tasks ', max_items: 2 }] },
    })!;
    expect(r.dashboard.widgets).toEqual([
      { key: 'my_tasks', visible: true, title_override: null, max_items: 9, mandatory: false },
    ]);
  });

  it('coerces and clamps max_items, with null landing on 1 rather than the default', () => {
    // Number(null) === 0, which IS finite, so null takes the clamp path -> Math.max(1, 0) = 1.
    // undefined -> NaN -> not finite -> the schema default 5. A fractional value is ROUNDED,
    // not rejected, even though the schema says integer.
    const r = normalizeUiConfig({
      dashboard: {
        widgets: [
          { key: 'a', max_items: null }, { key: 'b', max_items: undefined },
          { key: 'c', max_items: '7' }, { key: 'd', max_items: 3.7 },
          { key: 'e', max_items: -3 }, { key: 'f', max_items: 999 },
          { key: 'g', max_items: Infinity },
        ],
      },
    })!;
    expect(r.dashboard.widgets.map((w) => w.max_items)).toEqual([1, 5, 7, 4, 1, 50, 5]);
  });

  it('reads visible as fail-OPEN and mandatory as fail-CLOSED', () => {
    // Deliberately asymmetric polarity: only the boolean literal `false` hides a widget (the
    // STRING 'false' still shows it), and only the boolean literal `true` marks one mandatory.
    const r = normalizeUiConfig({
      dashboard: {
        widgets: [
          { key: 'h', visible: 'false', mandatory: 'true', title_override: '  ' },
          { key: 'i', visible: false, mandatory: true, title_override: 42 },
          { key: 'j', title_override: '  Hi  ' },
        ],
      },
    })!;
    expect(r.dashboard.widgets).toEqual([
      { key: 'h', visible: true, title_override: null, max_items: 5, mandatory: false },
      { key: 'i', visible: false, title_override: null, max_items: 5, mandatory: true },
      { key: 'j', visible: true, title_override: 'Hi', max_items: 5, mandatory: false },
    ]);
  });

  it('skips unusable entries, and falls back to DEFAULT_UI when none survive', () => {
    // An empty widget list is the "role never configured" state from global_defaults, not a
    // deliberately blank dashboard — the Admin Panel cannot even produce one, because mandatory
    // widgets keep their switch on (appUi.tsx:252-256).
    const fromJunk = normalizeUiConfig({ dashboard: { widgets: [null, 3, {}, { key: '   ' }] } })!;
    expect(fromJunk.dashboard.widgets).toBe(DEFAULT_UI.dashboard.widgets);
    expect(normalizeUiConfig({ dashboard: { widgets: [] } })!.dashboard.widgets)
      .toBe(DEFAULT_UI.dashboard.widgets);
    expect(normalizeUiConfig({ dashboard: { widgets: {} } })!.dashboard.widgets)
      .toBe(DEFAULT_UI.dashboard.widgets);
  });

  it('preserves array order, because array order IS render order', () => {
    const r = normalizeUiConfig({
      dashboard: { widgets: [{ key: 'analytics' }, { key: 'my_tasks' }, { key: 'tickets' }] },
    })!;
    expect(r.dashboard.widgets.map((w) => w.key)).toEqual(['analytics', 'my_tasks', 'tickets']);
  });
});

describe('normalizeUiConfig — hero and dashboard degradation', () => {
  it('accepts the four valid hero modes and rejects anything else', () => {
    // The ONE place in the normaliser that enforces an enum.
    for (const hero of ['clock_and_tasks', 'tasks_only', 'clock_only', 'none']) {
      expect(normalizeUiConfig({ dashboard: { hero } })!.dashboard.hero).toBe(hero);
    }
    expect(normalizeUiConfig({ dashboard: { hero: 'nope' } })!.dashboard.hero).toBe('clock_and_tasks');
    expect(normalizeUiConfig({ dashboard: { hero: 42 } })!.dashboard.hero).toBe('clock_and_tasks');
  });

  it('degrades a wrong-typed dashboard without throwing', () => {
    const expected = { hero: 'clock_and_tasks', widgets: DEFAULT_UI.dashboard.widgets };
    expect(normalizeUiConfig({ dashboard: 'oops' })!.dashboard).toEqual(expected);
    expect(normalizeUiConfig({ dashboard: null })!.dashboard).toEqual(expected);
    expect(normalizeUiConfig({ dashboard: [] })!.dashboard).toEqual(expected);
  });
});

describe('normalizeUiConfig — features', () => {
  it('leaves the schema defaults untouched when features is not an object', () => {
    expect(normalizeUiConfig({ features: [] })!.features).toEqual(SCHEMA_DEFAULT_FEATURES);
    expect(normalizeUiConfig({ features: 'yes' })!.features).toEqual(SCHEMA_DEFAULT_FEATURES);
  });

  it('applies booleans and cleans array values', () => {
    const r = normalizeUiConfig({
      features: { can_export_data: true, can_clock_in: false, global_search_scopes: ['clients', 'clients', ' kb ', ''] },
    })!;
    expect(r.features.can_export_data).toBe(true);
    expect(r.features.can_clock_in).toBe(false);
    expect(r.features.global_search_scopes).toEqual(['clients', 'kb']);
  });
});

describe('normalizeUiConfig — nav', () => {
  it('falls back to DEFAULT_UI tabs and sections when nav is missing, with a fresh hidden', () => {
    const r = normalizeUiConfig({ role_key: 'ops' })!;
    expect(r.nav.tabs).toEqual(['home', 'tasks', 'search', 'claims', 'more']);
    expect(r.nav.more_sections).toBe(DEFAULT_UI.nav.more_sections);
    expect(r.nav.hidden).toEqual([]);
  });

  it('trims, drops blanks and non-strings, and dedupes keeping the first', () => {
    // The trim happens BEFORE the dedupe key is computed, so '  home  ' and 'home' collapse;
    // the number 5 is skipped rather than stringified. One input, every branch of strList.
    const r = normalizeUiConfig({
      nav: { tabs: ['  home  ', 'home', '', '   ', 'tasks', 5], hidden: ['x', 'x', ''] },
    })!;
    expect(r.nav.tabs).toEqual(['home', 'tasks']);
    expect(r.nav.hidden).toEqual(['x']);
  });

  it('drops title-less and item-less more_sections but does NOT dedupe titles', () => {
    // Unlike widgets, two sections with the same title both survive.
    const r = normalizeUiConfig({
      nav: {
        more_sections: [
          { title: '  A  ', items: ['x', 'x', ''] },
          { title: 'B', items: [] },
          { title: '', items: ['y'] },
          { title: 'A', items: ['z'] },
        ],
      },
    })!;
    expect(r.nav.more_sections).toEqual([{ title: 'A', items: ['x'] }, { title: 'A', items: ['z'] }]);
  });

  it('cannot express a deliberately empty More menu', () => {
    // normalizeSections returns undefined when nothing survived, and `?? DEFAULT_UI...` then
    // substitutes the full default. An admin who empties the menu gets the default back.
    expect(normalizeUiConfig({ nav: { more_sections: [] } })!.nav.more_sections)
      .toBe(DEFAULT_UI.nav.more_sections);
  });

  it('falls back to "default" for a blank role_key, but to undefined for a blank label', () => {
    // Note the ASYMMETRY: label does NOT fall back to DEFAULT_UI.label — that string is only
    // ever reachable via DEFAULT_UI itself.
    const blank = normalizeUiConfig({ role_key: '   ', label: '   ' })!;
    expect(blank.role_key).toBe('default');
    expect(blank.label).toBeUndefined();
    expect(normalizeUiConfig({ role_key: 123 })!.role_key).toBe('default');
    expect(normalizeUiConfig({ role_key: '  ops  ', label: '  Ops  ' })!.role_key).toBe('ops');
    expect(normalizeUiConfig({ role_key: 'ops', label: '  Ops  ' })!.label).toBe('Ops');
  });
});

describe('normalizeUiConfig — theme', () => {
  it('requires a 6-digit hex accent', () => {
    expect(normalizeUiConfig({ theme: { accent: '#ff8800' } })!.theme)
      .toEqual({ accent: '#ff8800', badge_label: undefined, density: undefined });
    // '#FFF' is rejected, and with nothing else valid the whole theme collapses to undefined.
    expect(normalizeUiConfig({ theme: { accent: '#FFF' } })!.theme).toBeUndefined();
    expect(normalizeUiConfig({ theme: { accent: 'ff8800' } })!.theme).toBeUndefined();
  });

  it('trims badge_label FIRST and only then slices to 12 characters', () => {
    // So surrounding whitespace does not eat into the budget. 'Operations T' is twelve
    // characters including the space.
    expect(normalizeUiConfig({ theme: { badge_label: '  Operations Team  ' } })!.theme)
      .toEqual({ accent: undefined, badge_label: 'Operations T', density: undefined });
  });

  it('returns all three theme keys, present-but-undefined', () => {
    // toEqual ignores undefined-valued keys, so the `in` check is what actually pins this —
    // and it is the sort of thing that quietly breaks a JSON round-trip.
    const theme = normalizeUiConfig({ theme: { density: 'compact' } })!.theme!;
    expect(theme.density).toBe('compact');
    expect('accent' in theme).toBe(true);
    expect('badge_label' in theme).toBe(true);
  });

  it('returns undefined for a missing or unusable theme', () => {
    expect(normalizeUiConfig({})!.theme).toBeUndefined();
    expect(normalizeUiConfig({ theme: null })!.theme).toBeUndefined();
    expect(normalizeUiConfig({ theme: 'dark' })!.theme).toBeUndefined();
    expect(normalizeUiConfig({ theme: {} })!.theme).toBeUndefined();
  });
});

describe('resolveTabs — PHASE 10, the nav layer that decides what makes the bar', () => {
  it('reproduces the current hard-coded order for the default config', () => {
    expect(resolveTabs(DEFAULT_UI)).toEqual(['home', 'tasks', 'search', 'claims', 'more']);
  });

  it('follows nav.tabs order, and lets leads take a bar slot', () => {
    expect(resolveTabs(withNav(['home', 'tasks', 'leads', 'clients', 'more'])))
      .toEqual(['home', 'tasks', 'leads', 'clients', 'more']);
  });

  it('drops entries nav.hidden names, without leaving a gap', () => {
    expect(resolveTabs(withNav(['home', 'tasks', 'clients', 'claims', 'more'], ['clients'])))
      .toEqual(['home', 'tasks', 'claims', 'more']);
  });

  it('drops tab keys this build cannot physically render (prospects, tickets), and unknown junk', () => {
    // Valid per ui_rbac_config.json's nav.tabs enum, but neither route lives in the (tabs)
    // group today — see appUi.tsx's KNOWN_TAB_ROUTES comment.
    expect(resolveTabs(withNav(['home', 'prospects', 'tickets', 'tasks', 'made_up', 'more'])))
      .toEqual(['home', 'tasks', 'more']);
  });

  it('dedupes, keeping the first occurrence', () => {
    expect(resolveTabs(withNav(['home', 'tasks', 'home', 'more'])))
      .toEqual(['home', 'tasks', 'more']);
  });

  it('always appends more last, even when nav.tabs omits it or puts it first', () => {
    expect(resolveTabs(withNav(['home', 'tasks']))).toEqual(['home', 'tasks', 'more']);
    expect(resolveTabs(withNav(['more', 'home', 'tasks']))).toEqual(['home', 'tasks', 'more']);
  });

  it('cannot be used to hide more — it is the only way back to a demoted module, and to sign out', () => {
    expect(resolveTabs(withNav(['home', 'tasks'], ['more']))).toEqual(['home', 'tasks', 'more']);
  });

  it('falls back to the DEFAULT_UI order, filtered the same way, when nothing in nav.tabs survives', () => {
    // All junk -> falls back to DEFAULT_UI.nav.tabs, which itself gets hidden filtered too.
    expect(resolveTabs(withNav(['prospects', 'made_up'], ['claims'])))
      .toEqual(['home', 'tasks', 'search', 'more']);
  });
});

describe('arrangeMoreSections — PHASE 26, the More-tab grouping driven by nav.more_sections', () => {
  it('renders config groups in order, then a trailing catch-all for unplaced known modules', () => {
    // The config names the grouping/order; every known module it does NOT place still appears, in the
    // trailing "More" group, because omission must never hide (ui_rbac_config.json:18).
    expect(arrangeMoreSections([{ title: 'G1', items: ['a', 'b'] }], ['a', 'b', 'c', 'd'], hides()))
      .toEqual([{ title: 'G1', keys: ['a', 'b'] }, { title: 'More', keys: ['c', 'd'] }]);
  });

  it('preserves config order WITHIN a group', () => {
    expect(arrangeMoreSections([{ title: 'G', items: ['c', 'a', 'b'] }], ['a', 'b', 'c'], hides()))
      .toEqual([{ title: 'G', keys: ['c', 'a', 'b'] }]);
  });

  it('dedupes across AND within groups, keeping the first placement', () => {
    // A module listed in two groups (or twice in one) renders once, where it was first named — the
    // same first-wins rule as resolveTabs, so the menu can never show a duplicate row.
    expect(arrangeMoreSections(
      [{ title: 'G1', items: ['a', 'a', 'b'] }, { title: 'G2', items: ['b', 'c'] }],
      ['a', 'b', 'c'], hides(),
    )).toEqual([{ title: 'G1', keys: ['a', 'b'] }, { title: 'G2', keys: ['c'] }]);
  });

  it('drops keys that are not in the catalogue (unknown/typo module keys)', () => {
    // `known` is more.tsx's MORE_CATALOGUE keys; a config naming a module this build cannot render
    // (or a typo) is silently dropped, never rendered as a dead row.
    expect(arrangeMoreSections([{ title: 'G', items: ['a', 'zzz', 'b'] }], ['a', 'b'], hides()))
      .toEqual([{ title: 'G', keys: ['a', 'b'] }]);
  });

  it('removes a hidden module from its named group AND from the catch-all', () => {
    // nav.hidden is the ONE control that makes a module unreachable — it must bite everywhere.
    expect(arrangeMoreSections([{ title: 'G', items: ['a', 'b'] }], ['a', 'b', 'c', 'd'], hides('b', 'd')))
      .toEqual([{ title: 'G', keys: ['a'] }, { title: 'More', keys: ['c'] }]);
  });

  it('drops a group that ends up empty (all its items unknown or hidden)', () => {
    expect(arrangeMoreSections(
      [{ title: 'Empty', items: ['zzz'] }, { title: 'G', items: ['a', 'b'] }],
      ['a', 'b'], hides(),
    )).toEqual([{ title: 'G', keys: ['a', 'b'] }]);
    // Every module hidden -> the group empties AND the catch-all is empty -> nothing renders.
    expect(arrangeMoreSections([{ title: 'G', items: ['a'] }], ['a'], hides('a'))).toEqual([]);
  });

  it('omits the catch-all entirely when the config places every known module', () => {
    expect(arrangeMoreSections([{ title: 'G', items: ['a', 'b'] }], ['a', 'b'], hides()))
      .toEqual([{ title: 'G', keys: ['a', 'b'] }]);
  });

  it('orders the catch-all by the catalogue (`known`) order, not the config order', () => {
    // Leftovers follow MORE_CATALOGUE's declaration order — a stable, intentional fallback ordering.
    expect(arrangeMoreSections([{ title: 'G', items: ['c'] }], ['a', 'b', 'c'], hides()))
      .toEqual([{ title: 'G', keys: ['c'] }, { title: 'More', keys: ['a', 'b'] }]);
  });

  it('is fail-open for an undefined or empty section list: everything falls to the catch-all', () => {
    // config.nav.more_sections is always filled at runtime, but the type admits undefined; a missing
    // menu must degrade to "everything reachable", never to a blank More tab.
    expect(arrangeMoreSections(undefined, ['a', 'b'], hides())).toEqual([{ title: 'More', keys: ['a', 'b'] }]);
    expect(arrangeMoreSections([], ['a', 'b'], hides())).toEqual([{ title: 'More', keys: ['a', 'b'] }]);
  });

  it('honours a custom leftover title', () => {
    expect(arrangeMoreSections([], ['a'], hides(), 'Everything else'))
      .toEqual([{ title: 'Everything else', keys: ['a'] }]);
  });

  it('DEFAULT_UI.nav.more_sections is internally consistent: every listed module placed once, no catch-all', () => {
    // The default grouping is now RENDERED (it is the layout for admin/master/any unseeded role), so it
    // must name every module exactly once with no duplicates. Arranged against its own flattened key
    // set, it must reproduce itself — a duplicate key would collapse under dedupe and fail this.
    const keys = DEFAULT_UI.nav.more_sections!.flatMap((s) => s.items);
    const arranged = arrangeMoreSections(DEFAULT_UI.nav.more_sections, keys, hides());
    expect(arranged.map((g) => g.title)).toEqual(DEFAULT_UI.nav.more_sections!.map((s) => s.title));
    expect(arranged.flatMap((g) => g.keys)).toEqual(keys);
  });
});

describe('pinned known bugs — these must be updated deliberately when fixed', () => {
  it('lets an UNKNOWN widget key through, though the schema says drop it', () => {
    // normalizeWidget never consults WIDGET_KEYS. WIDGET_KEYS is exported and has zero runtime
    // consumers, so ui_rbac_config.json's "unknown keys dropped" rule is not enforced on mobile.
    const r = normalizeUiConfig({ dashboard: { widgets: [{ key: 'made_up_widget' }] } })!;
    expect(r.dashboard.widgets).toEqual([
      { key: 'made_up_widget', visible: true, title_override: null, max_items: 5, mandatory: false },
    ]);
  });

  it('IGNORES a wrong-typed feature flag but KEEPS an unknown one', () => {
    // Three contract gaps in one assertion. A server trying to disable a flag with 0 or 'no'
    // silently fails to — the key keeps its schema default of true. Meanwhile bogus_flag is
    // kept verbatim, despite the schema's additionalProperties:false.
    const r = normalizeUiConfig({
      features: { can_clock_in: 'yes', can_create_task: 0, bogus_flag: true },
    })!;
    expect(r.features.can_clock_in).toBe(true);
    expect(r.features.can_create_task).toBe(true);
    expect(r.features.bogus_flag).toBe(true);
  });

  it('does not truncate nav.tabs to five, and does not enum-check them', () => {
    // The non-truncation is DELIBERATE and explained at appUi.tsx:260-262 (the nav layer
    // decides what spills into More). normalizeUiConfig still does no enum-check or cap here —
    // as of PHASE 10 that filtering happens one layer up, in resolveTabs (see the describe
    // block above), which is what (tabs)/_layout.tsx actually renders from.
    const r = normalizeUiConfig({ nav: { tabs: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] } })!;
    expect(r.nav.tabs).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('silently discards more_sections.collapsed_by_default', () => {
    // The key exists in the schema and was added to the AppUiConfig type at src/data/api.ts
    // with a comment claiming the drop was fixed — the TYPE was fixed, normalizeSections was not.
    const r = normalizeUiConfig({
      nav: { more_sections: [{ title: 'A', items: ['x'], collapsed_by_default: true }] },
    })!;
    expect(r.nav.more_sections).toEqual([{ title: 'A', items: ['x'] }]);
  });

  it('applies no default for theme.density, and compares it case-sensitively', () => {
    // ui_rbac_config.json gives density a default of 'comfortable'; normalizeTheme applies no
    // default at all, so an absent or mis-cased density stays undefined.
    expect(normalizeUiConfig({ theme: { density: 'COMPACT' } })!.theme).toBeUndefined();
    expect(normalizeUiConfig({ theme: { accent: '#ff8800' } })!.theme!.density).toBeUndefined();
  });
});

/* ================================================================== *
 * OWNER'S DEPARTMENT LAYOUTS (2026-08-27)
 *
 * The owner named exactly two departments and said "baki kuch bhi nahi" about the rest of each
 * one's menu. These pin the three ways that instruction could be got wrong: narrowing somebody
 * it was not about, narrowing a department it did not name, and taking away the two screens a
 * user cannot recover from losing (Settings holds the language switch).
 * ================================================================== */

describe('departmentFallbackUi — the owner-specified department layouts', () => {
  const ops = { role: 'advisor', department: 'Operations' };
  const sales = { role: 'advisor', department: 'SALES - RENEWALS & LIC' };

  it('narrows an OPERATIONS team member to claims, reminders, tickets and attendance', () => {
    const ui = departmentFallbackUi(ops);
    expect(ui).toBe(OPS_TEAM_UI);
    expect(ui.nav.tabs).toEqual(['home', 'tasks', 'claims', 'more']);
    // The owner's Home list: their tasks, and claims. Nothing else may be on.
    const on = ui.dashboard.widgets.filter((w) => w.visible).map((w) => w.key);
    expect(on).toEqual(['my_tasks', 'claim_requests', 'follow_ups']);
    // Sales surfaces are gone from navigation entirely, not merely off the dashboard.
    expect(ui.nav.hidden).toContain('leads');
    expect(ui.nav.hidden).toContain('prospects');
    expect(ui.nav.hidden).toContain('clients');
  });

  it('narrows a SALES team member to leads and prospects, five each on Home', () => {
    const ui = departmentFallbackUi(sales);
    expect(ui).toBe(SALES_TEAM_UI);
    expect(ui.nav.tabs).toEqual(['home', 'tasks', 'leads', 'more']);
    const on = ui.dashboard.widgets.filter((w) => w.visible);
    expect(on.map((w) => w.key)).toEqual(['my_tasks', 'leads_pipeline', 'prospects']);
    // "home tab me yeh dono 5-5 ke batch mein" — five each, verbatim.
    expect(on.find((w) => w.key === 'leads_pipeline')!.max_items).toBe(5);
    expect(on.find((w) => w.key === 'prospects')!.max_items).toBe(5);
    expect(ui.nav.hidden).toContain('claims');
  });

  it('NEVER narrows an admin, a leader or a master, whatever their department', () => {
    expect(departmentFallbackUi({ role: 'admin', department: 'Operations' })).toBe(DEFAULT_UI);
    expect(departmentFallbackUi({ role: 'leader', department: 'SALES' })).toBe(DEFAULT_UI);
    expect(departmentFallbackUi({ role: 'super_admin', department: 'Operations' })).toBe(DEFAULT_UI);
  });

  it('NEVER narrows a department the owner did not describe — including the four unmapped ones', () => {
    // canonicalizeDepartment returns null for these live values (roles.ts records the data gap).
    for (const department of ['GENERAL INSURANCE', 'BANKING & COLLECTION', 'DRIVER', 'IT', 'HEALTH INSURANCE', '', null]) {
      expect(departmentFallbackUi({ role: 'advisor', department })).toBe(DEFAULT_UI);
    }
    expect(departmentFallbackUi(null)).toBe(DEFAULT_UI);
  });

  it('keeps Settings, profile and account reachable in BOTH layouts', () => {
    // Settings is where the language switch lives. Hiding it would strand a user in a script they
    // cannot read with no way back, which is not what "nothing else" can be allowed to mean.
    for (const ui of [OPS_TEAM_UI, SALES_TEAM_UI]) {
      for (const k of ['profile', 'settings', 'account']) {
        expect(ui.nav.hidden).not.toContain(k);
        expect(ui.nav.more_sections!.some((g) => g.items.includes(k))).toBe(true);
      }
    }
  });

  it('emits every hidden widget explicitly rather than by omission', () => {
    // normalizeUiConfig falls back to the WHOLE DEFAULT_UI widget list when the array is empty,
    // so an "everything off" layout expressed by omission would silently re-open the dashboard.
    expect(OPS_TEAM_UI.dashboard.widgets.length).toBe(DEFAULT_UI.dashboard.widgets.length);
    expect(SALES_TEAM_UI.dashboard.widgets.length).toBe(DEFAULT_UI.dashboard.widgets.length);
  });

  it('leaves task CREATION on and assign-to-others off, per the same-day owner decision', () => {
    for (const ui of [OPS_TEAM_UI, SALES_TEAM_UI]) {
      expect(ui.features.can_create_task).toBe(true);
      expect(ui.features.can_assign_task_to_others).toBe(false);
      expect(ui.features.can_clock_in).toBe(true);
    }
  });
});
