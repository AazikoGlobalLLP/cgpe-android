import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import { IconBtn } from '@/ui/controls';
import { EmptyState, Skeleton } from '@/ui/feedback';
import { DataRow, ListSection, Pill } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import * as api from '@/data/api';
import type { AgentPin } from '@/data/api';
import type { TeamMember } from '@/data/team';
import { fmtTime } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';
import { clockKeyFor } from '@/lib/clockKey';
import { LeafletMap, type MapBreak } from '@/ui/LeafletMap';
import { useAuth } from '@/store/auth';
import { canSeeLiveLocation } from '@/store/roles';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * Where the field is, right now.
 *
 * THE LEGEND READS FROM THE PALETTE THE MAP DRAWS WITH. The pins are coloured by EVENT: clock-in
 * = `c.success` (green, Phase 51), break = `c.warning` (orange, Phase 66), clock-out = `c.danger`
 * (red). The legend names exactly those three. A legend that names a colour the map never renders
 * is worse than none.
 *
 * THE SCROLLVIEW YIELDS TO THE MAP. The map now pans and pinches like a native one, and a
 * map inside a vertical scroller is a fight over every upward drag: without this, dragging
 * north on the map scrolls the page instead. `LeafletMap` reports the finger through
 * `onInteracting` and the scroller stands down for the length of the gesture. Scrolling
 * the page still works everywhere outside the map, which is the whole rest of the screen.
 * ------------------------------------------------------------------ */

/** What today's clock-in record looks like in AsyncStorage. */
type Mine = {
  in: boolean; time?: string; place?: string; lat?: number; lng?: number;
  outTime?: string; outPlace?: string;
};

/**
 * One row shape for both sources. Live pins are the truth when they exist; the roster is
 * the fallback. Previously these two were merged through `as any[]`, which hid the fact
 * that the row read `m.city` off a TeamMember, a field TeamMember does not have.
 */
type Person = { id: string; name: string; where?: string; phone?: string; onDuty: boolean };

const fromPin = (p: AgentPin): Person => ({
  id: String(p.id), name: p.name, where: p.city, onDuty: p.onDuty,
});
const fromMember = (m: TeamMember): Person => ({
  id: m.id, name: m.name, where: m.branch || undefined, phone: m.phone || undefined, onDuty: m.clockedIn,
});

function readMine(raw: string | null): Mine | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Mine;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;   // a corrupt cache must not blank the whole screen
  }
}

export default function AgentMap() {
  const c = useTheme();
  const t = useT();
  const router = useRouter();
  const health = useDataHealth();
  const insets = useSafeAreaInsets();
  const { user, ready } = useAuth();
  // Live agent locations are Master-only (Phase 40). Real-role gate, never the folded tier —
  // a non-master must never reach the location fetch, and a stale-role deep-link degrades to
  // an honest refusal rather than a blank map.
  const isMaster = canSeeLiveLocation(user);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [pins, setPins] = useState<AgentPin[]>([]);
  const [breaks, setBreaks] = useState<api.MemberBreaks[]>([]);
  const [mine, setMine] = useState<Mine | null>(null);
  const [loading, setLoading] = useState(true);
  /** True while a finger is working the map. Freezes this screen's scroller, nothing else. */
  const [mapBusy, setMapBusy] = useState(false);

  /**
   * The mounted flag, not a per-effect one: `load` is fired both by the focus effect and
   * by the refresh button, so the cancellation guard belongs to the SCREEN. Three
   * requests are in flight at once here and none of them may land after a pop.
   */
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const load = useCallback(async () => {
    if (!isMaster) { setLoading(false); return; }   // never fetch member locations as a non-master
    const [tm, pn, saved, brk] = await Promise.all([
      api.getTeam(),
      api.getAgentLocations(),
      AsyncStorage.getItem(clockKeyFor(user?.id)).catch(() => null),   // per-user key (lib/clockKey)
      // PHASE 66: break points for the orange pins. A non-master 403 comes back quietly empty.
      api.getBreakLocations().catch(() => [] as api.MemberBreaks[]),
    ]);
    if (!live.current) return;
    setTeam(tm);
    setPins(pn);
    setBreaks(brk);
    setMine(readMine(saved));
    setLoading(false);
  }, [isMaster, user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const retry = useCallback(() => { setLoading(true); load(); }, [load]);

  const { onDuty, off, roster, tracked } = useMemo(() => {
    // B5 (owner: "show ALL members + all locations"). The roster LIST is the FULL staff universe
    // from getTeam()/mergeRoster — every member, on duty or not. Previously the list was built from
    // `pins` whenever a single pin existed, and `pins` = liveOnDutyPins = only members who are
    // clocked in AND have a finite GPS coordinate. So one such member hid the entire rest of the
    // team ("1 on duty, 1 tracked"). Now the list always comes from `team`; the MAP still plots only
    // `pins` (a location a member never shared cannot be plotted — honest). `tracked` stays the count
    // of map-locatable pins, so the empty state can still say "nobody is being tracked yet" truthfully.
    // Fall back to pins only when the roster is empty (an outage), so a master still sees the locatable.
    const people = team.length > 0 ? team.map(fromMember) : pins.map(fromPin);
    return {
      onDuty: people.filter((p) => p.onDuty),
      off: people.filter((p) => !p.onDuty),
      roster: people,
      tracked: pins.length,
    };
  }, [team, pins]);

  // PHASE 66: flatten the per-member break lists into the flat point array LeafletMap draws, carrying
  // each point's member name onto its popup.
  const breakPoints = useMemo<MapBreak[]>(
    () => breaks.flatMap((m) => m.breaks.map((b) => ({ ...b, name: m.name }))),
    [breaks],
  );

  const open = useCallback((id: string) => router.push(`/team/${id}`), [router]);

  // Gate before the skeleton so a non-master never sees a loading map for a map it cannot fetch.
  // Waits for `ready` so a signed-in master is not flashed the refusal during session restore.
  if (ready && !isMaster) {
    return (
      <Screen>
        <Header title="Agent locations" back />
        <EmptyState
          icon="lock-closed-outline"
          title="Master access only"
          subtitle="Live agent locations are visible to the master admin. Ask them if you need to know where the field is."
        />
      </Screen>
    );
  }

  if (loading) return <MapSkeleton />;

  return (
    <Screen>
      <Header
        title="Agent locations"
        subtitle={`${onDuty.length} on duty · ${roster.length} in team · ${tracked} on map`}
        back
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!mapBusy}
      >
        <Appear index={0}>
          <Card>
            <Row>
              <View style={{
                width: 10, height: 10, borderRadius: 5,
                backgroundColor: onDuty.length > 0 ? c.success : c.faint,
              }} />
              <Eyebrow style={{ flex: 1 }}>Live field status</Eyebrow>
            </Row>
            <Metric value={String(onDuty.length)} size={font.display} style={{ marginTop: spacing.sm }} />
            <Txt size={font.sub} color={c.muted} style={{ marginTop: 2 }}>
              {onDuty.length === 1 ? 'agent is clocked in right now' : 'agents are clocked in right now'}
            </Txt>
          </Card>
        </Appear>

        <Appear index={1}>
          <LeafletMap pins={pins} breaks={breakPoints} height={330} onInteracting={setMapBusy} />
          <Row style={{ justifyContent: 'center', gap: spacing.lg, marginTop: spacing.md, flexWrap: 'wrap' }}>
            <Legend color={c.success} label="Clock-in" />
            <Legend color={c.warning} label={t('break.start')} />
            <Legend color={c.danger} label="Clock-out" />
          </Row>
          {/* Said once, here, rather than as a badge on the map: the map is small and its
              own chrome should stay out of the way of the pins. */}
          <Txt size={font.cap} color={c.faint} style={{ textAlign: 'center', marginTop: spacing.sm, lineHeight: 17 }}>
            Drag to pan, pinch to zoom. Tap a pin for the name and time, or a numbered badge
            to open the agents standing on the same spot.
          </Txt>
        </Appear>

        <Appear index={2}>
          <Card onPress={() => router.push('/agent-track')} padded={false}>
            <Row style={{ padding: 14 }}>
              <View style={{
                width: 40, height: 40, borderRadius: 12, backgroundColor: c.primarySoft,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="navigate" size={19} color={c.primary} />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Txt size={font.body} weight="700" numberOfLines={1}>Movement paths</Txt>
                <Txt size={font.cap} color={c.muted} numberOfLines={1}>Replay where each agent went, by date</Txt>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.faint} />
            </Row>
          </Card>
        </Appear>

        {mine?.in ? (
          <Appear index={3}>
            <ListSection title="My check-in" footer={mine.outTime ? undefined : 'Still on duty. Clock out from the Today tab.'}>
              <DataRow
                label={t('home.clockedIn')}
                value={mine.time ? fmtTime(mine.time) : 'Time not recorded'}
                icon="log-in-outline"
                tone="success"
                right={mine.place ? <Pill label={mine.place} tone="neutral" small /> : undefined}
              />
              {mine.outTime ? (
                <DataRow
                  label="Clocked out"
                  value={fmtTime(mine.outTime)}
                  icon="log-out-outline"
                  tone="danger"
                  right={mine.outPlace ? <Pill label={mine.outPlace} tone="neutral" small /> : undefined}
                />
              ) : null}
            </ListSection>
          </Appear>
        ) : null}

        <Appear index={4}>
          {/* ListSection takes any child, so the empty case keeps the group's heading and
              its card instead of dropping to a bare paragraph. */}
          <ListSection title={`On duty (${onDuty.length})`}>
            {onDuty.length === 0 ? (
              <EmptyState
                icon={health.degraded ? 'cloud-offline-outline' : tracked === 0 ? 'map-outline' : 'location-outline'}
                title={health.degraded ? 'Field status could not load'
                  : tracked === 0 ? 'Nobody is being tracked yet'
                    : 'Nobody is on duty'}
                subtitle={health.degraded
                  ? 'The server did not answer, so an empty map here is unconfirmed rather than quiet. Check your connection and try again.'
                  : tracked === 0
                    ? 'Pins appear once your team clocks in from the app with location on.'
                    : 'Everyone tracked today has clocked out. Pins return as soon as someone clocks back in.'}
                action={{ label: t('common.refresh'), onPress: retry }}
              />
            ) : onDuty.map((p, i) => (
              <Appear key={p.id} index={i}>
                <FieldRow p={p} onOpen={() => open(p.id)} />
              </Appear>
            ))}
          </ListSection>
        </Appear>

        {off.length > 0 ? (
          <Appear index={5}>
            <ListSection title={`Off duty (${off.length})`}>
              {/* B5: show the WHOLE team, not a truncated 12 — the owner explicitly wants every member. */}
              {off.map((p, i) => (
                <Appear key={p.id} index={i}>
                  <PersonRow
                    name={p.name}
                    subtitle={p.where}
                    subtitleIcon={p.where ? 'business-outline' : undefined}
                    size={36}
                    onPress={() => open(p.id)}
                    style={{ marginHorizontal: 0, paddingHorizontal: spacing.lg, borderRadius: 0 }}
                    right={<Pill label="Off" tone="neutral" small />}
                  />
                </Appear>
              ))}
            </ListSection>
          </Appear>
        ) : null}

        <Txt size={font.cap} color={c.faint} style={{ textAlign: 'center', lineHeight: 17 }}>
          Shows clock-in and clock-out points only. No travel history is recorded here.
        </Txt>
      </ScrollView>
    </Screen>
  );
}

/* ================================================================== *
 * Rows
 * ================================================================== */

function FieldRow({ p, onOpen }: { p: Person; onOpen: () => void }) {
  const c = useTheme();
  const t = useT();
  return (
    <PersonRow
      name={p.name}
      subtitle={p.where || 'On field'}
      subtitleIcon="location"
      onPress={onOpen}
      badge={{ tone: 'success' }}
      style={{ marginHorizontal: 0, paddingHorizontal: spacing.lg, borderRadius: 0 }}
      right={p.phone ? (
        <Row style={{ gap: spacing.xs }}>
          <IconBtn
            icon="call"
            size={38}
            bg={c.primarySoft}
            color={c.primary}
            onPress={() => { haptics.tap(); call(p.phone as string); }}
            accessibilityLabel={t('common.a11yCall', { name: p.name })}
          />
          <IconBtn
            icon="logo-whatsapp"
            size={38}
            bg={c.whatsappSoft}
            color={c.whatsapp}
            onPress={() => { haptics.tap(); whatsapp(p.phone as string); }}
            accessibilityLabel={t('common.a11yWhatsapp', { name: p.name })}
          />
        </Row>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={c.faint} />
      )}
    />
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const c = useTheme();
  return (
    <Row style={{ gap: 6 }}>
      <View style={{
        width: 10, height: 10, borderRadius: 5, backgroundColor: color,
        borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
      }} />
      <Txt size={font.cap} color={c.muted}>{label}</Txt>
    </Row>
  );
}

/* ================================================================== *
 * Loading — headline, map slab, roster rows
 * ================================================================== */

function MapSkeleton() {
  const c = useTheme();
  return (
    <Screen>
      <Header title="Agent locations" back />
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card>
          <Skeleton width={120} height={10} />
          <Skeleton width={68} height={30} style={{ marginTop: spacing.md }} />
          <Skeleton width="58%" height={12} style={{ marginTop: spacing.sm }} />
        </Card>

        <Skeleton width="100%" height={330} radius={radius.lg} />

        <Card padded={false}>
          <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
            {[0, 1, 2].map((i) => (
              <View key={i}>
                {i > 0 ? (
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: spacing.lg }} />
                ) : null}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, minHeight: 60,
                }}>
                  <Skeleton width={44} height={44} radius={44 / 2.6} />
                  <View style={{ flex: 1, gap: spacing.sm }}>
                    <Skeleton width="52%" height={13} />
                    <Skeleton width="34%" height={11} />
                  </View>
                  <Skeleton width={38} height={38} radius={38 / 2.6} />
                </View>
              </View>
            ))}
          </View>
        </Card>
      </View>
    </Screen>
  );
}
