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
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import * as api from '@/data/api';
import type { TeamMember } from '@/data/team';
import { inrShort, timeAgo } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';

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
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [m, setM] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

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

  const kpis: KpiItem[] = useMemo(() => {
    if (!m) return [];
    const s = m.stats;
    const out: KpiItem[] = [];
    if (s.premiumMtd > 0) out.push({ label: 'Premium (MTD)', value: inrShort(s.premiumMtd), icon: 'cash-outline', tone: 'success' });
    if (s.clients > 0) out.push({ label: 'Clients', value: String(s.clients), icon: 'people-outline', tone: 'primary' });
    if (s.policiesMtd > 0) out.push({ label: 'Done (MTD)', value: String(s.policiesMtd), icon: 'documents-outline', tone: 'accent' });
    if (s.renewalPct > 0) out.push({ label: 'Completion', value: `${s.renewalPct}%`, icon: 'refresh-outline', tone: 'info' });
    if (s.leads > 0) out.push({ label: 'Open work', value: String(s.leads), icon: 'flame-outline', tone: 'warning' });
    if (s.openClaims > 0) out.push({ label: 'Open claims', value: String(s.openClaims), icon: 'shield-half-outline', tone: 'danger' });
    return out;
  }, [m]);

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
          action={{ label: 'Try again', onPress: retry }}
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
              {m.clockedIn ? <Pill label="On duty" tone="success" small dot /> : null}
              {!m.clockedIn && m.online ? <Pill label="Signed in" tone="info" small dot /> : null}
              {m.tier ? <Pill label={`${m.tier} club`} tone="accent" small icon="star" /> : null}
              {m.agentCode ? <Pill label={m.agentCode} tone="neutral" small numeric /> : null}
            </View>
          </Card>
        </Appear>

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
            {hasPhone ? <DataRow label="Mobile" value={m.phone} icon="call-outline" numeric copyable /> : null}
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
          accessibilityLabel={`Call ${m.name}`}
        />
        <Button
          label="WhatsApp"
          icon="logo-whatsapp"
          variant="whatsapp"
          full
          disabled={!hasPhone}
          onPress={() => { haptics.tap(); whatsapp(m.phone); }}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
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
