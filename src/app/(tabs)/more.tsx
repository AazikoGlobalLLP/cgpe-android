import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Row, Screen } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Button } from '@/ui/controls';
import { Skeleton, useToast } from '@/ui/feedback';
import { ActionTile, DataRow, ListSection, Pill } from '@/ui/data';
import type { Tone } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { Sheet } from '@/ui/sheet';
import { Appear } from '@/ui/motion';
import { useConfirm } from '@/ui/Confirm';
import { haptics } from '@/lib/haptics';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { arrangeMoreSections, useAppUi } from '@/store/appUi';
import { capabilitiesOf, canViewAs, TIER_THEME } from '@/store/roles';
import type { Tier } from '@/store/roles';
import { APP } from '@/constants/config';
import * as api from '@/data/api';

/* ------------------------------------------------------------------ *
 * More — the app's directory.
 *
 * WHY THIS IS A GROUPED LIST AND NOT A GRID OF CARDS. Twenty-odd destinations laid out as
 * twenty floating cards is twenty objects the eye has to acquire separately. Grouped
 * `ListSection` rows sit on one continuous surface with hairlines between them, so the
 * page is read as six short lists rather than as a wall. The colour budget is spent at
 * the top instead, on four `ActionTile`s for the things reached every single day.
 *
 * GROUPING IS BY THE QUESTION BEING ASKED, not by which backend serves it:
 *   Admin        who is doing what, and what is it adding up to
 *   Book         who the clients are and how they cluster
 *   Day to day   what is on me today
 *   Board        what the firm said, and what I told myself
 *   Reference    what is the answer to this product question
 *   Account      who am I to this app
 * Phase 9's nine new surfaces slot into that scheme rather than being appended as a
 * "New" pile, which is how a directory turns back into a wall.
 *
 * ROLE GATING IS UNCHANGED. `capabilitiesOf(user, viewAs)` still decides whether the
 * admin/master group renders at all, `caps.tier === 'master'` still gates Movement paths,
 * and the "view as" entry still requires the user's REAL capabilities (`realCaps`) so a
 * previewing admin cannot use the preview to climb back up. Campaigns stays inside the
 * admin group exactly as before; only its destination changed, from the premium screen it
 * was standing in for to the real `/campaigns` route.
 *
 * THE ONLY LIVE FIGURE ON THIS SCREEN IS THE OPEN-TICKET COUNT, and it is stated only
 * when it is greater than zero. A failed fetch resolves to an empty page, so rendering
 * "0 open" would be claiming a fact the app does not have. Below one, the row falls back
 * to its static hint and says nothing about counts at all.
 * ------------------------------------------------------------------ */

type Entry = {
  icon: IconName;
  label: string;
  /** Right-hand hint. Short by construction: this column is scanned, not read. */
  value: string;
  href?: Href;
  onPress?: () => void;
  right?: React.ReactNode;
  tone?: Tone;
  copyable?: boolean;
  numeric?: boolean;
  /** `nav.hidden` module key (`ui_rbac_config.json`). Undefined = account chrome, never hidden. */
  navKey?: string;
};

const TIER_TONE: Record<Tier, Tone> = { master: 'warning', admin: 'primary', team: 'accent' };
const TIER_RANK: Record<Tier, number> = { team: 0, admin: 1, master: 2 };

const VIEW_OPTIONS: { tier: Tier; label: string; hint: string; icon: IconName }[] = [
  { tier: 'master', label: 'Master', hint: 'Full oversight', icon: 'shield-checkmark' },
  { tier: 'admin', label: 'Admin', hint: 'Runs a team', icon: 'people-circle' },
  { tier: 'team', label: 'Team member', hint: 'Own work only', icon: 'person' },
];

/* ------------------------------------------------------------------ *
 * The CONTENT-MODULE catalogue (Phase 26).
 *
 * Since Phase 26 the grouping, titles and order of the middle of this screen come from the server's
 * `nav.more_sections` document, not a hard-coded list (closing Phase 10 D-3). This map is the OTHER
 * half of that: it owns each module's icon / label / right-hand hint / route, keyed by the same module
 * key the server's `nav.more_sections` and `nav.hidden` speak. `arrangeMoreSections` decides the
 * arrangement; this decides the presentation. Keep it in step with `DEFAULT_UI.nav.more_sections` in
 * `appUi.tsx` — a key in one but not the other is a menu bug (a catalogue module the default never
 * groups falls to the trailing "More" catch-all; a default key with no catalogue entry is dropped).
 *
 * Declaration order is the fallback order for any module a config leaves unplaced. Two values are
 * DYNAMIC and overridden at render — `profile` shows the user's name, `tickets` shows the live open
 * count — so their `value` here is only the static fallback.
 *
 * NOT here on purpose: the admin oversight modules (team/agent-map/agent-track/analytics/campaigns/
 * notify) and the personal local features (viewing-as/my-earnings/payroll). Those render in fixed,
 * role-gated sections and must not be reorderable by a department document (PHASE-26 D-2/D-3).
 */
const MORE_CATALOGUE: Record<string, { icon: IconName; label: string; value: string; href: Href }> = {
  leads:          { icon: 'funnel',          label: 'Leads and pipeline',       value: 'Stages',            href: '/(tabs)/leads' },
  clients:        { icon: 'people',           label: 'Clients',                  value: 'Directory',         href: '/(tabs)/clients' },
  segments:       { icon: 'pie-chart',        label: 'Segments',                 value: 'Smart lists',       href: '/segments' },
  families:       { icon: 'home',             label: 'Families',                 value: 'Households',         href: '/families' },
  premium:        { icon: 'gift',             label: 'Premium and greetings',    value: 'Renewals',          href: '/premium' },
  prospects:      { icon: 'person-add',       label: 'Prospects',                value: 'Recruitment',       href: '/prospects' },
  'lic-plans':    { icon: 'calculator',       label: 'LIC plans',                value: 'Products',          href: '/lic-plans' },
  claims:         { icon: 'document-text',    label: 'Claims',                   value: 'Register',          href: '/(tabs)/claims' },
  tickets:        { icon: 'ticket',           label: 'Tickets',                  value: 'Requests',          href: '/tickets' },
  reminders:      { icon: 'notifications',    label: 'Reminders and follow-ups', value: 'Due dates',         href: '/reminders' },
  calendar:       { icon: 'calendar',         label: 'Calendar',                 value: 'Meetings',          href: '/calendar' },
  attendance:     { icon: 'time',             label: 'My attendance',            value: 'GPS log',           href: '/attendance' },
  whatsapp:       { icon: 'logo-whatsapp',    label: 'WhatsApp Hub',             value: 'Chats',             href: '/whatsapp' },
  commissions:    { icon: 'cash',             label: 'Commissions',              value: 'Earnings',          href: '/commissions' },
  'notice-board': { icon: 'megaphone',        label: 'Notice Board',             value: 'From the firm',     href: '/notice-board' },
  notes:          { icon: 'journal',          label: 'Notes',                    value: 'Private',           href: '/notes' },
  kb:             { icon: 'library',          label: 'Knowledge Base',           value: 'Field guide',       href: '/kb' },
  search:         { icon: 'search',           label: 'Global search',            value: 'Everything',        href: '/search' },
  contests:       { icon: 'trophy',           label: 'Contests',                 value: 'Leaderboards',      href: '/contests' },
  profile:        { icon: 'person-circle',    label: 'My profile',               value: '',                  href: '/profile' },
  settings:       { icon: 'settings',         label: 'Settings',                 value: 'Security, language', href: '/settings' },
  account:        { icon: 'shield-checkmark', label: 'Account and privacy',      value: 'Data and deletion', href: '/account' },
};
/** Catalogue keys in declaration order — the module universe `arrangeMoreSections` may place. */
const MORE_KEYS = Object.keys(MORE_CATALOGUE);

export default function More() {
  const c = useTheme();
  const router = useRouter();
  const { user, ready, logout, viewAs, setViewAs } = useAuth();
  const { confirm } = useConfirm();
  const toast = useToast();
  const t = useT();
  const [viewSheet, setViewSheet] = useState(false);
  const [openTickets, setOpenTickets] = useState(0);

  const caps = capabilitiesOf(user, viewAs);
  const realCaps = capabilitiesOf(user);
  const isAdmin = caps.manageTeam;
  const liveSession = api.isRealSession();
  const { isHidden, config } = useAppUi();

  /* One live count, cancellable. `limit: 1` because only the meta block is wanted; the
     ticket rows themselves belong to /tickets, not to a directory page. */
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const page = await api.getTickets({ state: 'active', limit: 1 });
      if (!alive) return;
      const n = page.meta.stateCounts.active;
      setOpenTickets(Number.isFinite(n) ? n : 0);
    })();
    return () => { alive = false; };
  }, [userId]);

  const applyView = (tier: Tier | null) => {
    // Moving between discrete options: a selection tick, not a commit thud.
    haptics.select();
    setViewAs(tier);
    setViewSheet(false);
    const picked = VIEW_OPTIONS.find((o) => o.tier === tier);
    toast(picked ? `Now previewing the ${picked.label} side` : 'Back to your own view', 'info');
  };

  const doLogout = async () => {
    haptics.warn();
    const ok = await confirm({
      title: t('signout.title'),
      message: t('signout.msg'),
      confirmText: t('common.signOut'),
      destructive: true,
      icon: 'log-out-outline',
    });
    if (!ok) return;
    await logout();
    router.replace('/(auth)/login');
  };

  /* The tab layout already redirects when there is no session, so this branch is short
     lived. It still has to hold the real shape: a bare spinner here would make the whole
     page jump the moment the restored session lands. */
  if (!ready || !user) {
    return (
      <Screen>
        <Header title="More" />
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48, gap: spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          <Card>
            <Row>
              <Skeleton width={52} height={52} radius={20} />
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Skeleton width="58%" height={14} />
                <Skeleton width="38%" height={11} />
              </View>
            </Row>
          </Card>
          <GroupSkeleton rows={5} />
          <GroupSkeleton rows={5} />
          <GroupSkeleton rows={5} />
          <GroupSkeleton rows={3} />
        </ScrollView>
      </Screen>
    );
  }

  /* Admin oversight — FIXED and role-gated, NOT config-driven (PHASE-26 D-2). Admin/master configs
     carry no more_sections, and these safety-sensitive tools must not be reorderable-away by a
     department document; a leader is folded into "admin" by tierOf, so Payroll (an admin-only
     endpoint that 403s a leader) still gates on the REAL role. `nav.hidden` still filters each row. */
  const adminGroup: { title: string; items: Entry[] } | null = isAdmin ? {
    title: caps.tier === 'master' ? 'Master control' : 'Admin',
    items: ([
      // The dedicated monitoring hub (Phase 39) — master-only, the owner's "main side". It gathers
      // location / performance / salary + the roster in one place. Fixed and master-gated (real
      // super_admin), like the location + performance tiles below; the SCREEN re-gates on the real
      // role, this tile is only the affordance. No navKey — it is not a server nav module (like
      // Payroll), so it is never reorderable-away or in nav.hidden.
      ...(caps.tier === 'master'
        ? [{ icon: 'eye' as IconName, label: 'Monitor', value: 'Team oversight', href: '/monitor' as Href }]
        : []),
      {
        icon: 'people-circle' as IconName,
        label: caps.overseeAdmins ? 'All teams and admins' : 'Team members',
        value: 'Roster',
        href: '/team' as Href,
        navKey: 'team',
      },
      // Live location (map + movement replay) is Master-only (Phase 40) — the screens gate on the
      // real super_admin role, so these tiles follow the same rule and stay off the Admin/leader menu.
      ...(caps.tier === 'master'
        ? [
            { icon: 'map' as IconName, label: 'Agent locations', value: 'Live', href: '/agent-map' as Href, navKey: 'agent-map' },
            { icon: 'navigate' as IconName, label: 'Movement paths', value: 'Replay', href: '/agent-track' as Href, navKey: 'agent-track' },
            // Team performance (Phase 45) — the whole roster's scores, master-only. The SCREEN
            // gates on the real super_admin role, so this tile follows the same rule.
            { icon: 'ribbon' as IconName, label: 'Team performance', value: 'Scores', href: '/performance?view=team' as Href, navKey: 'performance' },
          ]
        : []),
      { icon: 'stats-chart' as IconName, label: 'Portfolio analytics', value: 'Org-wide', href: '/analytics' as Href, navKey: 'analytics' },
      ...((user.role === 'admin' || user.role === 'super_admin')
        ? [{ icon: 'cash' as IconName, label: 'Payroll', value: 'Salary roster', href: '/payroll' as Href }]
        : []),
      { icon: 'paper-plane' as IconName, label: 'Campaigns', value: 'Bulk sends', href: '/campaigns' as Href, navKey: 'campaigns' },
      { icon: 'megaphone' as IconName, label: 'Notify team', value: 'Send alert', href: '/notify' as Href, navKey: 'notify' },
    ] as Entry[]).filter((it) => !it.navKey || !isHidden(it.navKey)),
  } : null;

  /* The content modules — grouping, titles and ORDER now come from the server's nav.more_sections
     (PHASE-26, closing Phase 10 D-3). `arrangeMoreSections` filters each group to catalogue modules
     that are not in nav.hidden, dedupes across groups, and appends a trailing "More" group for any
     module the config did not place, so nothing is ever stranded (ui_rbac_config.json:18). Each key
     maps through MORE_CATALOGUE; `profile` and `tickets` get their dynamic value here. */
  const moduleGroups: { title: string; items: Entry[] }[] = arrangeMoreSections(
    config.nav.more_sections,
    MORE_KEYS,
    isHidden,
  ).map((g) => ({
    title: g.title,
    items: g.keys.flatMap((key): Entry[] => {
      const cat = MORE_CATALOGUE[key];
      if (!cat) return [];   // key came from MORE_KEYS, so always defined; guarded for safety
      if (key === 'profile') return [{ ...cat, value: user.name, navKey: key }];
      if (key === 'tickets') {
        // Silence rather than a fabricated zero when the count did not come back.
        return [{
          ...cat,
          value: openTickets > 0 ? `${openTickets} open` : cat.value,
          tone: openTickets > 0 ? ('primary' as Tone) : undefined,
          numeric: openTickets > 0,
          navKey: key,
        }];
      }
      return [{ ...cat, navKey: key }];
    }),
  }));

  /* Personal local features — FIXED (PHASE-26 D-3). Not server nav modules (no navKey, not in the
     catalogue, never in nav.hidden), so each keeps its OWN gate. `My earnings` is self-scoped and
     shown to every member (Phase 16); `Viewing as` is Master-only (Phase 47, owner-locked
     2026-08-15) via `canViewAs` — the REAL `super_admin` role, never the folded tier/caps, so no
     admin or leader sees it. Payroll stays in the admin group above. */
  const personalItems: Entry[] = [
    ...(canViewAs(user) ? [{
      icon: 'swap-horizontal' as IconName,
      label: 'Viewing as',
      value: caps.label,
      onPress: () => setViewSheet(true),
      right: viewAs ? <Pill label="Preview" tone="warning" small /> : undefined,
    }] : []),
    { icon: 'wallet' as IconName, label: 'My earnings', value: 'Salary and days', href: '/earnings' as Href },
    // My performance (Phase 45) — the member's OWN completed-tasks score. Self-scoped by the
    // server (`?scope=own`), so it carries no gate and is shown to every member, like My earnings.
    { icon: 'ribbon' as IconName, label: 'My performance', value: 'Task score', href: '/performance' as Href },
  ];

  /* One ordered list of everything grouped: fixed admin first, then the config-driven content
     groups, then the fixed personal group. Keyed by index because two config groups may share a
     title (normalizeSections does not dedupe titles). */
  const groups: { title: string; items: Entry[] }[] = [
    ...(adminGroup ? [adminGroup] : []),
    ...moduleGroups,
    ...(personalItems.length ? [{ title: 'Personal', items: personalItems }] : []),
  ];

  // Fixed tileIndex per module (it selects the tile's colour), so hiding one tile does not
  // shift the colour of the ones next to it.
  const quickActions = ([
    { icon: 'search', label: 'Search', href: '/search', navKey: 'search', tileIndex: 0 },
    { icon: 'notifications', label: 'Reminders', href: '/reminders', navKey: 'reminders', tileIndex: 1 },
    { icon: 'ticket', label: 'Tickets', href: '/tickets', navKey: 'tickets', tileIndex: 2 },
    { icon: 'logo-whatsapp', label: 'WhatsApp', href: '/whatsapp', navKey: 'whatsapp', tileIndex: 3 },
  ] as { icon: IconName; label: string; href: Href; navKey: string; tileIndex: number }[])
    .filter((qa) => !isHidden(qa.navKey));

  const about: Entry[] = [
    { icon: 'cube-outline', label: 'Version', value: APP.version, numeric: true },
    {
      icon: liveSession ? 'cloud-done-outline' : 'cloud-offline-outline',
      label: 'Data',
      value: liveSession ? 'Live' : 'Not verified',
      tone: liveSession ? 'success' : 'warning',
    },
    { icon: 'mail-outline', label: 'Signed in as', value: user.email, copyable: true },
  ];

  const renderRow = (it: Entry, i: number) => {
    const href = it.href;
    return (
      <Appear key={`${it.label}-${i}`} index={i}>
        <DataRow
          icon={it.icon}
          label={it.label}
          value={it.value}
          tone={it.tone}
          right={it.right}
          copyable={it.copyable}
          numeric={it.numeric}
          // Plain navigation gets no haptic. The budget is spent on writes and refusals.
          onPress={href ? () => router.push(href) : it.onPress}
        />
      </Appear>
    );
  };

  return (
    <Screen>
      <Header title="More" subtitle={`${caps.label} access`} />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity. One tap to the full profile; the tier badge is the only place the
            role is stated in the app's own vocabulary rather than the server's. */}
        <Appear>
          <Card onPress={() => router.push('/profile')}>
            <PersonRow
              name={user.name}
              subtitle={user.designation}
              photo={user.photo}
              size={52}
              chevron
            />
            <Row style={{ marginTop: spacing.md, flexWrap: 'wrap', gap: spacing.sm }}>
              <Pill label={TIER_THEME[caps.tier].badge} tone={TIER_TONE[caps.tier]} small />
              {user.agentCode ? <Pill label={user.agentCode} tone="neutral" small numeric /> : null}
              {viewAs ? <Pill label="Preview mode" tone="warning" icon="eye" small /> : null}
            </Row>
          </Card>
        </Appear>

        {/* The four destinations opened every day, in colour, above the fold. A tile is
            dropped rather than disabled when its module is in nav.hidden — a shortcut to a
            "removed" module would make that setting dishonest. */}
        {quickActions.length ? (
          <View style={{ gap: spacing.md }}>
            <Eyebrow style={{ marginLeft: spacing.xs }}>Quick actions</Eyebrow>
            <Row style={{ justifyContent: 'space-between' }}>
              {quickActions.map((qa, i) => (
                <Appear key={qa.navKey} index={i}>
                  <ActionTile
                    icon={qa.icon}
                    label={qa.label}
                    tileIndex={qa.tileIndex}
                    badge={qa.navKey === 'tickets' ? openTickets : undefined}
                    onPress={() => router.push(qa.href)}
                  />
                </Appear>
              ))}
            </Row>
          </View>
        ) : null}

        {groups.map((g, gi) => (
          <ListSection key={`${g.title}-${gi}`} title={g.title}>
            {g.items.map(renderRow)}
          </ListSection>
        ))}

        <ListSection title="About" footer={`${APP.name} for ${APP.org}. ${APP.since}.`}>
          {about.map(renderRow)}
        </ListSection>

        <Button
          label={t('common.signOut')}
          icon="log-out-outline"
          variant="danger"
          full
          onPress={doLogout}
        />
      </ScrollView>

      <Sheet
        visible={viewSheet}
        onClose={() => setViewSheet(false)}
        title="Preview another side"
        subtitle="Changes what this app shows you. It does not change anyone's permissions."
      >
        <ListSection footer="A preview only affects your own screen, and it ends when you switch back.">
          {VIEW_OPTIONS
            .filter((o) => TIER_RANK[o.tier] <= TIER_RANK[realCaps.tier])
            .map((o, i) => (
              <Appear key={o.tier} index={i}>
                <DataRow
                  icon={o.icon}
                  label={o.label}
                  value={o.hint}
                  onPress={() => applyView(o.tier)}
                  right={caps.tier === o.tier
                    ? <Pill label="Current" tone={TIER_TONE[o.tier]} small />
                    : undefined}
                />
              </Appear>
            ))}
          {viewAs ? (
            <Appear index={3}>
              <DataRow
                icon="arrow-undo"
                label="My own view"
                value="Stop previewing"
                tone="primary"
                onPress={() => applyView(null)}
              />
            </Appear>
          ) : null}
        </ListSection>
      </Sheet>
    </Screen>
  );
}

/* Holds the grouped-list shape while the session restores, so nothing reflows when the
 * real rows arrive. Mirrors ListSection's own geometry deliberately. */
function GroupSkeleton({ rows }: { rows: number }) {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Skeleton width={86} height={10} style={{ marginLeft: spacing.xs }} />
      <Card padded={false}>
        <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
          {Array.from({ length: rows }, (_, i) => (
            <View key={i}>
              {i > 0 ? (
                <View style={{
                  height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: spacing.lg,
                }} />
              ) : null}
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48,
                paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
              }}>
                <Skeleton width={16} height={16} radius={5} />
                <Skeleton width="44%" height={12} />
                <View style={{ flex: 1 }} />
                <Skeleton width={52} height={12} />
              </View>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}
