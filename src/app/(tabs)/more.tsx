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
import { useAppUi } from '@/store/appUi';
import { capabilitiesOf, TIER_THEME } from '@/store/roles';
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
  const { isHidden } = useAppUi();

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

  const rawGroups: { title: string; items: Entry[] }[] = [
    ...(isAdmin ? [{
      title: caps.tier === 'master' ? 'Master control' : 'Admin',
      items: [
        {
          icon: 'people-circle' as IconName,
          label: caps.overseeAdmins ? 'All teams and admins' : 'Team members',
          value: 'Roster',
          href: '/team' as Href,
          navKey: 'team',
        },
        { icon: 'map' as IconName, label: 'Agent locations', value: 'Live', href: '/agent-map' as Href, navKey: 'agent-map' },
        ...(caps.tier === 'master'
          ? [{ icon: 'navigate' as IconName, label: 'Movement paths', value: 'Replay', href: '/agent-track' as Href, navKey: 'agent-track' }]
          : []),
        { icon: 'stats-chart' as IconName, label: 'Portfolio analytics', value: 'Org-wide', href: '/analytics' as Href, navKey: 'analytics' },
        // Payroll reads the admin-only salary endpoint (`authorize('admin')`), which 403s a
        // leader — but mobile's tier folds leader into "admin", so gate on the REAL role, not
        // `isAdmin`/caps. No navKey: it is a local feature, not part of the server nav schema.
        ...((user.role === 'admin' || user.role === 'super_admin')
          ? [{ icon: 'cash' as IconName, label: 'Payroll', value: 'Salary roster', href: '/payroll' as Href }]
          : []),
        { icon: 'paper-plane' as IconName, label: 'Campaigns', value: 'Bulk sends', href: '/campaigns' as Href, navKey: 'campaigns' },
        { icon: 'megaphone' as IconName, label: 'Notify team', value: 'Send alert', href: '/notify' as Href, navKey: 'notify' },
      ] as Entry[],
    }] : []),
    {
      title: 'The book',
      items: [
        { icon: 'funnel', label: 'Leads and pipeline', value: 'Stages', href: '/(tabs)/leads', navKey: 'leads' },
        { icon: 'pie-chart', label: 'Segments', value: 'Smart lists', href: '/segments', navKey: 'segments' },
        { icon: 'home', label: 'Families', value: 'Households', href: '/families', navKey: 'families' },
        { icon: 'gift', label: 'Premium and greetings', value: 'Renewals', href: '/premium', navKey: 'premium' },
        { icon: 'person-add', label: 'Prospects', value: 'Recruitment', href: '/prospects', navKey: 'prospects' },
      ],
    },
    {
      title: 'Day to day',
      items: [
        {
          icon: 'ticket',
          label: 'Tickets',
          // Silence rather than a fabricated zero when the count did not come back.
          value: openTickets > 0 ? `${openTickets} open` : 'Requests',
          tone: openTickets > 0 ? 'primary' : undefined,
          numeric: openTickets > 0,
          href: '/tickets',
          navKey: 'tickets',
        },
        { icon: 'notifications', label: 'Reminders and follow-ups', value: 'Due dates', href: '/reminders', navKey: 'reminders' },
        { icon: 'calendar', label: 'Calendar', value: 'Meetings', href: '/calendar', navKey: 'calendar' },
        { icon: 'time', label: 'My attendance', value: 'GPS log', href: '/attendance', navKey: 'attendance' },
        { icon: 'logo-whatsapp', label: 'WhatsApp Hub', value: 'Chats', href: '/whatsapp', navKey: 'whatsapp' },
      ],
    },
    {
      title: 'Board',
      items: [
        { icon: 'megaphone', label: 'Notice Board', value: 'From the firm', href: '/notice-board', navKey: 'notice-board' },
        { icon: 'journal', label: 'Notes', value: 'Private', href: '/notes', navKey: 'notes' },
      ],
    },
    {
      title: 'Reference',
      items: [
        { icon: 'library', label: 'Knowledge Base', value: 'Field guide', href: '/kb', navKey: 'kb' },
        { icon: 'calculator', label: 'LIC plans', value: 'Products', href: '/lic-plans', navKey: 'lic-plans' },
        { icon: 'search', label: 'Global search', value: 'Everything', href: '/search', navKey: 'search' },
      ],
    },
    {
      title: 'Account',
      items: [
        ...(realCaps.manageTeam ? [{
          icon: 'swap-horizontal' as IconName,
          label: 'Viewing as',
          value: caps.label,
          onPress: () => setViewSheet(true),
          right: viewAs ? <Pill label="Preview" tone="warning" small /> : undefined,
        }] : []),
        { icon: 'person-circle', label: 'My profile', value: user.name, href: '/profile', navKey: 'profile' },
        // Self-view salary (Phase 16). Backed by the self-scoped `GET /payroll/my-earnings`, which is
        // `protect`-only and forces `user_id` to the token — so EVERY signed-in member gets this row,
        // no role gate (unlike the admin Payroll roster above). No navKey: a local feature, not part
        // of the server nav schema. If the caller has no payroll profile, the screen says so.
        { icon: 'wallet' as IconName, label: 'My earnings', value: 'Salary and days', href: '/earnings' as Href },
        { icon: 'settings', label: 'Settings', value: 'Security, language', href: '/settings', navKey: 'settings' },
        { icon: 'shield-checkmark', label: 'Account and privacy', value: 'Data and deletion', href: '/account', navKey: 'account' },
      ],
    },
  ];
  const groups = rawGroups
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.navKey || !isHidden(it.navKey)) }))
    .filter((g) => g.items.length > 0);

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

        {groups.map((g) => (
          <ListSection key={g.title} title={g.title}>
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
