import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Row, Screen, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Button, IconBtn } from '@/ui/controls';
import { Banner, EmptyState, Skeleton, SkeletonText } from '@/ui/feedback';
import { DataRow, KpiStrip, ListSection, Pill } from '@/ui/data';
import type { KpiItem } from '@/ui/data';
import { Avatar } from '@/ui/identity';
import { Spine, SpineRow } from '@/ui/spine';
import { Sheet } from '@/ui/sheet';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import * as api from '@/data/api';
import type { LastLocationResult } from '@/data/api';
import type { TeamMember } from '@/data/team';
import { inrShort, timeAgo } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';
import { useAuth } from '@/store/auth';
import { canSeeLiveLocation, capabilitiesOf } from '@/store/roles';
import { RestrictedNotice } from '@/ui/RestrictedNotice';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * One team member.
 *
 * Same skeleton as Client 360, deliberately: identity card, a strip of figures, grouped
 * reference detail, and the two actions a leader actually performs (call, WhatsApp)
 * pinned in the thumb arc so they survive a scroll.
 *
 * The previous version painted a full-bleed azure hero with hard-coded #fff text. That
 * lost the brand in dark mode and spent the loudest surface in the app on a job title.
 * ------------------------------------------------------------------ */

export default function TeamMemberDetail() {
  const c = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, viewAs, ready } = useAuth();
  // Coordinates are master-only across the contract (Phase 66); the button is REAL-super_admin gated.
  const canSeeLive = canSeeLiveLocation(user);

  const [m, setM] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveRes, setLiveRes] = useState<LastLocationResult | 'loading' | null>(null);

  /**
   * The mounted flag, not a per-effect one: `load` is fired both by the focus effect and
   * by the retry button, so the cancellation guard has to belong to the SCREEN rather
   * than to one effect run. Nothing here setStates after the screen is gone.
   */
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const load = useCallback(async () => {
    const r = await api.getTeamMember(String(id));
    if (!live.current) return;
    setM(r ?? null);
    setLoading(false);
  }, [id]);

  // Refetched on focus so a leader coming back from the map sees current duty state.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const retry = useCallback(() => { setLoading(true); load(); }, [load]);

  // Master "Live location": fetch this member's last-known point on demand, show it in a Sheet.
  const openLive = useCallback(async () => {
    haptics.tap();
    setLiveRes('loading');
    setLiveOpen(true);
    const r = await api.getLastLocation(String(id));
    if (!live.current) return;
    setLiveRes(r);
  }, [id]);

  const kpis: KpiItem[] = useMemo(() => {
    if (!m) return [];
    const s = m.stats;
    const out: KpiItem[] = [];
    if (s.premiumMtd > 0) out.push({ label: t('team.premiumMtd'), value: inrShort(s.premiumMtd), icon: 'cash-outline', tone: 'success' });
    if (s.clients > 0) out.push({ label: t('tab.clients'), value: String(s.clients), icon: 'people-outline', tone: 'primary' });
    if (s.policiesMtd > 0) out.push({ label: t('team.doneMtd'), value: String(s.policiesMtd), icon: 'documents-outline', tone: 'accent' });
    if (s.renewalPct > 0) out.push({ label: t('team.completion'), value: `${s.renewalPct}%`, icon: 'refresh-outline', tone: 'info' });
    if (s.leads > 0) out.push({ label: t('team.openWork'), value: String(s.leads), icon: 'flame-outline', tone: 'warning' });
    if (s.openClaims > 0) out.push({ label: t('home.openClaims'), value: String(s.openClaims), icon: 'shield-half-outline', tone: 'danger' });
    return out;
  }, [m, t]);

  // Round-4 loophole hunt (2026-08-25): this screen shows a colleague's premium (MTD) / clients /
  // claims figures and recent activity — team-management data. Gate it in-screen (defence-in-depth
  // for a deep-link), matching /team and the hardened Home roster affordance. Wait for `ready` so a
  // real manager is not flashed the refusal during session restore. The live-location card keeps its
  // own tighter master-only gate below.
  if (ready && !capabilitiesOf(user, viewAs).manageTeam) {
    return (
      <RestrictedNotice
        title="Member"
        heading="Member view is for managers"
        subtitle="A team member's figures and activity are visible to team leads and admins."
      />
    );
  }

  if (loading) return <MemberSkeleton />;

  if (!m) {
    return (
      <Screen>
        <Header title="Team member" back />
        <EmptyState
          icon={health.degraded ? 'cloud-offline-outline' : 'person-circle-outline'}
          title={health.degraded ? 'This profile could not load' : 'Member not found'}
          subtitle={health.degraded
            ? 'The server did not answer, so nothing here is confirmed. Check your connection and try again.'
            : 'This person is no longer on a roster you can see. They may have been moved or removed.'}
          action={{ label: t('common.tryAgain'), onPress: retry }}
        />
      </Screen>
    );
  }

  const role = m.role.replace(/_/g, ' ');
  const meta = [role, m.branch].filter(Boolean).join(' · ');
  const hasPhone = !!m.phone;

  return (
    <Screen>
      <Header title="Team member" subtitle={m.name} back />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {!hasPhone ? (
          <Banner
            tone="warning"
            title="No mobile number on this profile"
            message="Calls and WhatsApp both need a number on the staff record."
          />
        ) : null}

        <Appear index={0}>
          <Card>
            <Row>
              <Avatar
                name={m.name}
                size={58}
                badge={{ tone: m.clockedIn ? 'success' : m.online ? 'primary' : 'neutral' }}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt size={19} weight="800" numberOfLines={2}>{m.name}</Txt>
                {meta ? <Txt size={font.sub} color={c.muted} numberOfLines={1}>{meta}</Txt> : null}
              </View>
            </Row>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md }}>
              {m.clockedIn ? <Pill label={t('common.onDuty')} tone="success" small dot /> : null}
              {!m.clockedIn && m.online ? <Pill label="Signed in" tone="info" small dot /> : null}
              {m.tier ? <Pill label={`${m.tier} club`} tone="accent" small icon="star" /> : null}
              {m.agentCode ? <Pill label={m.agentCode} tone="neutral" small numeric /> : null}
            </View>
          </Card>
        </Appear>

        {canSeeLive ? (
          <Appear index={1}>
            <Card>
              <Row style={{ alignItems: 'center', gap: spacing.md }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Eyebrow>Live location</Eyebrow>
                  <Txt size={font.sub} color={c.muted} numberOfLines={2} style={{ marginTop: 2 }}>
                    {(m.name.split(' ')[0] || 'This member')}&apos;s last-known position — on or off duty.
                  </Txt>
                </View>
                <Button label="Show" icon="location" size="sm" onPress={openLive} />
              </Row>
            </Card>
          </Appear>
        ) : null}

        {kpis.length > 0 ? (
          <Appear index={1} style={{ marginHorizontal: -spacing.lg }}>
            <KpiStrip items={kpis} contentStyle={{ paddingHorizontal: spacing.lg }} />
          </Appear>
        ) : (
          <Appear index={1}>
            <Card>
              <Txt size={font.sub} color={c.muted}>
                No performance figures have come back for this member yet.
              </Txt>
            </Card>
          </Appear>
        )}

        <Appear index={2}>
          <ListSection title="Contact">
            {hasPhone ? <DataRow label={t('common.mobile')} value={m.phone} icon="call-outline" numeric copyable /> : null}
            {m.email ? <DataRow label="Email" value={m.email} icon="mail-outline" copyable /> : null}
            {m.branch ? <DataRow label="Branch" value={m.branch} icon="business-outline" /> : null}
            <DataRow label="Role" value={role} icon="ribbon-outline" />
            <DataRow label="Last active" value={timeAgo(m.lastActive)} icon="time-outline" />
          </ListSection>
        </Appear>

        <Appear index={3}>
          {/* The screen's single Eyebrow. ListSection draws its own label, so this is the
              one group that needs the treatment applied by hand. */}
          <Eyebrow style={{ marginLeft: spacing.xs, marginBottom: spacing.sm }}>Recent activity</Eyebrow>
          {m.activity.length === 0 ? (
            <Card>
              <EmptyState
                icon="pulse-outline"
                title="No recorded activity"
                subtitle="Task and field activity shows here once this member starts working from the app."
              />
            </Card>
          ) : (
            <Spine>
              {m.activity.map((a, i) => (
                <SpineRow
                  key={a.id}
                  index={i}
                  last={i === m.activity.length - 1}
                  time={timeAgo(a.at)}
                  title={a.text}
                  tone="primary"
                  icon={(a.icon as IconName) || 'ellipse-outline'}
                />
              ))}
            </Spine>
          )}
        </Appear>
      </ScrollView>

      {/* Pinned: the two things a leader does from this screen. */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.md,
        backgroundColor: c.bgElevated,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
      }}>
        <IconBtn
          icon="call"
          size={48}
          bg={c.primarySoft}
          color={c.primary}
          disabled={!hasPhone}
          onPress={() => { haptics.tap(); call(m.phone); }}
          accessibilityLabel={t('common.a11yCall', { name: m.name })}
        />
        <Button
          label={t('common.whatsapp')}
          icon="logo-whatsapp"
          variant="whatsapp"
          full
          disabled={!hasPhone}
          onPress={() => { haptics.tap(); whatsapp(m.phone); }}
          style={{ flex: 1 }}
        />
      </View>

      {/* Master-only: the member's last-known location, on a single-pin map (Phase 66). */}
      <Sheet visible={liveOpen} onClose={() => setLiveOpen(false)} title="Live location" subtitle={m.name} scroll={false}>
        <LiveLocationBody res={liveRes} name={m.name} />
      </Sheet>
    </Screen>
  );
}

/* ================================================================== *
 * Live location — the member's last-known point + an honest freshness label
 * ================================================================== */

function LiveLocationBody({ res, name }: { res: LastLocationResult | 'loading' | null; name: string }) {
  const c = useTheme();
  const t = useT();

  if (res === null || res === 'loading') {
    return (
      <View style={{ padding: spacing.lg }}>
        <Skeleton width="100%" height={280} radius={radius.lg} />
      </View>
    );
  }

  if (res.status === 'ok') {
    const loc = res.loc;
    // NOT drawn on the in-app map: LeafletMap's pin is a clock-in/out concept (always a green
    // "Clocked in at …" marker), which would misstate an off-duty member's last-known point, and it
    // drops a (0,0) no-fix while the labels still assert a position. Show an honest readout instead —
    // real duty state, freshness, accuracy, and copyable coordinates the master opens in their own
    // maps app. (A neutral single-pin in-app map is a separate follow-up needing a LeafletMap change.)
    const duty = loc.isClockedIn
      ? { label: t('common.onDuty'), tone: 'success' as const }
      : loc.offDuty ? { label: t('common.offDuty'), tone: 'neutral' as const }
        : { label: 'Last shift', tone: 'neutral' as const };
    return (
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ gap: 4 }}>
          <Eyebrow>Last known position</Eyebrow>
          <Txt size={font.h2} weight="800">{loc.at ? timeAgo(loc.at) : 'Time not recorded'}</Txt>
        </View>
        <Row style={{ gap: spacing.sm, flexWrap: 'wrap' }}>
          <Pill label={duty.label} tone={duty.tone} small dot={loc.isClockedIn} />
            {loc.accuracy != null ? <Pill label={`±${Math.round(loc.accuracy)} m`} tone="neutral" small numeric /> : null}
        </Row>
        <ListSection>
          <DataRow label="Coordinates" value={`${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`} icon="location-outline" numeric copyable />
        </ListSection>
        <Txt size={font.tiny} color={c.faint} numberOfLines={3}>
          The most recent position {name.split(' ')[0] || 'this member'}&apos;s device reported — not a live ping. Copy the coordinates to open them in a maps app. Off-duty location needs their consent and background permission.
        </Txt>
      </View>
    );
  }

  if (res.status === 'none') {
    return (
      <View style={{ padding: spacing.lg }}>
        <EmptyState
          icon="location-outline"
          title="No recent location"
          subtitle={`${name} hasn't shared a location recently. Off-duty location needs their consent and background permission.`}
        />
      </View>
    );
  }

  // res.status === 'error'
  return (
    <View style={{ padding: spacing.lg }}>
      <EmptyState
        icon="cloud-offline-outline"
        title="Couldn't load location"
        subtitle="We couldn't reach the location service, so nothing here is confirmed. Close this and try again."
      />
    </View>
  );
}

/* ================================================================== *
 * Loading — the shape of the screen that is coming
 * ================================================================== */

function MemberSkeleton() {
  const c = useTheme();
  return (
    <Screen>
      <Header title="Team member" back />
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card>
          <Row>
            <Skeleton width={58} height={58} radius={58 / 2.6} />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Skeleton width="62%" height={16} />
              <Skeleton width="46%" height={12} />
            </View>
          </Row>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.md }}>
            <Skeleton width={78} height={20} radius={radius.pill} />
            <Skeleton width={94} height={20} radius={radius.pill} />
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} width={118} height={58} radius={radius.md} />)}
        </View>

        <Card>
          <SkeletonText lines={4} lineHeight={13} gap={spacing.xl} />
        </Card>

        <View style={{ gap: spacing.md }}>
          <Skeleton width={110} height={10} />
          <View style={{ gap: spacing.lg }}>
            {[0, 1].map((i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.md }}>
                <Skeleton width={38} height={10} style={{ marginTop: 2 }} />
                <View style={{
                  width: 9, height: 9, borderRadius: 4.5, marginTop: 3,
                  borderWidth: 2, borderColor: c.spine, backgroundColor: c.card,
                }} />
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <Skeleton width="70%" height={13} />
                  <Skeleton width="40%" height={11} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Screen>
  );
}
