import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Header, Row, Screen, Txt } from '@/ui/base';
import { Button, SearchBar } from '@/ui/controls';
import { EmptyState, Skeleton } from '@/ui/feedback';
import { KpiStrip, ListSection, Pill } from '@/ui/data';
import type { KpiItem } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import { LeafletMap } from '@/ui/LeafletMap';
import { useAuth } from '@/store/auth';
import { canSeeLiveLocation } from '@/store/roles';
import * as api from '@/data/api';
import type { TrackPoint, TrackSession } from '@/data/api';
import { fmtTime } from '@/lib/format';

/* ------------------------------------------------------------------ *
 * Movement replay, master only.
 *
 * This screen is the reason `LeafletMap` draws a trajectory rather than a scatter of dots:
 * the question a manager actually asks is "where was she between nine and eleven", and a
 * cloud of pins cannot answer it. The map gets the ordered path and the member's NAME, so
 * every tooltip on the route says who it belongs to and at what time.
 *
 * The WebView is deliberately NOT unmounted while a path loads. Tearing down and rebuilding
 * a Leaflet instance on every session tap costs more than it tells you, so the map stays
 * mounted and takes `loading` instead, which draws the skeleton over the live instance.
 * `path` IS cleared on tap though: leaving the previous shift's route on screen while the
 * next one downloads is the one thing worse than a blank map.
 *
 * The scroller stands down while a finger is on the map (`onInteracting`). Without it the
 * ScrollView wins every vertical drag and the map can only be panned sideways.
 * ------------------------------------------------------------------ */

type Member = { id: string; name: string; role: string };

const ymd = (d: Date) => d.toISOString().slice(0, 10);

function fmtDur(a?: string, b?: string | null): string {
  if (!a) return 'Unknown';
  const started = new Date(a).getTime();
  if (Number.isNaN(started)) return 'Unknown';
  const end = b ? new Date(b).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - started) / 60000));
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const km = (m?: number) => `${((m || 0) / 1000).toFixed(2)} km`;

export default function AgentTrack() {
  const c = useTheme();
  const health = useDataHealth();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  // Master (real super_admin) only — the shared location gate, never the folded tier (Phase 40).
  const isMaster = canSeeLiveLocation(user);

  const [members, setMembers] = useState<Member[]>([]);
  // Seeded from the capability, so a non-master never renders a roster skeleton for a
  // roster it is not allowed to fetch (and the effect never has to setState to correct it).
  const [loadingMembers, setLoadingMembers] = useState(isMaster);
  const [membersAttempt, setMembersAttempt] = useState(0);
  const [q, setQ] = useState('');

  const [sel, setSel] = useState<Member | null>(null);
  const [sessions, setSessions] = useState<TrackSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const [active, setActive] = useState<TrackSession | null>(null);
  const [path, setPath] = useState<TrackPoint[]>([]);
  const [loadingPath, setLoadingPath] = useState(false);
  /** True while a finger is working the map. Freezes this screen's scroller, nothing else. */
  const [mapBusy, setMapBusy] = useState(false);

  /** Every fetch below is user-triggered and can outlive the screen, so both the mount
   *  flag and a request cursor are checked before any setState lands. */
  const live = useRef(true);
  const sessionReq = useRef(0);
  const pathReq = useRef(0);
  useEffect(() => () => { live.current = false; }, []);

  useEffect(() => {
    if (!isMaster) return;
    let alive = true;
    (async () => {
      const rows = await api.getTrackableMembers().catch(() => [] as Member[]);
      if (!alive) return;
      setMembers(rows);
      setLoadingMembers(false);
    })();
    return () => { alive = false; };
  }, [isMaster, membersAttempt]);

  const retryMembers = useCallback(() => {
    setLoadingMembers(true);
    setMembersAttempt((n) => n + 1);
  }, []);

  const loadSessions = useCallback(async (m: Member) => {
    const my = ++sessionReq.current;
    setSel(m); setActive(null); setPath([]); setSessions([]); setLoadingSessions(true);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 14);
    const rows = await api.getTrackSessions(m.id, ymd(from), ymd(to));
    if (!live.current || my !== sessionReq.current) return;
    setSessions(rows);
    setLoadingSessions(false);
  }, []);

  const openSession = useCallback(async (s: TrackSession) => {
    const my = ++pathReq.current;
    haptics.select();
    // Clear the old path with the same commit that selects the new shift. Without this the
    // map keeps drawing the PREVIOUS shift's route under the new shift's heading until the
    // fetch returns, which is a route attributed to the wrong day.
    setActive(s); setPath([]); setLoadingPath(true);
    const t = await api.getTrack(s.session_id);
    if (!live.current || my !== pathReq.current) return;
    setPath(t?.points ?? []);
    setLoadingPath(false);
  }, []);

  const clearMember = useCallback(() => {
    // Invalidate anything in flight so a late response cannot repopulate the picker view.
    sessionReq.current += 1;
    pathReq.current += 1;
    setSel(null); setSessions([]); setActive(null); setPath([]);
    setLoadingSessions(false); setLoadingPath(false);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return members;
    return members.filter((m) => m.name.toLowerCase().includes(s) || m.role.toLowerCase().includes(s));
  }, [members, q]);

  const stats: KpiItem[] = useMemo(() => {
    if (!active) return [];
    return [
      { label: 'Distance', value: km(active.distance_m), icon: 'navigate-outline', tone: 'primary' },
      { label: 'Points', value: String(active.point_count || path.length), icon: 'ellipse-outline', tone: 'accent' },
      { label: 'Duration', value: fmtDur(active.started_at, active.ended_at), icon: 'time-outline', tone: 'info' },
    ];
  }, [active, path.length]);

  if (!isMaster) {
    return (
      <Screen>
        <Header title="Movement paths" back />
        <EmptyState
          icon="lock-closed-outline"
          title="Master access only"
          subtitle="Field-route history is visible to the master admin. Ask them if you need a route checked."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="Movement paths"
        subtitle={sel ? sel.name : 'Pick a team member'}
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
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!mapBusy}
      >
        {!sel ? (
          <>
            <SearchBar value={q} onChange={setQ} placeholder="Search team member" />

            {loadingMembers ? <RosterSkeleton /> : filtered.length === 0 ? (
              <Card>
                <EmptyState
                  icon={q.trim() ? 'search-outline' : health.degraded ? 'cloud-offline-outline' : 'people-outline'}
                  title={q.trim() ? `No member matches "${q.trim()}"`
                    : health.degraded ? 'The roster could not load'
                      : 'No trackable members'}
                  subtitle={q.trim() ? 'Search runs over the names and roles on the roster loaded here.'
                    : health.degraded
                      ? 'The server did not answer, so this is unconfirmed rather than empty. Check your connection and try again.'
                      : 'Only staff with a user account can be tracked. Add one in the admin panel first.'}
                  action={q.trim()
                    ? { label: 'Clear search', onPress: () => { haptics.select(); setQ(''); } }
                    : { label: 'Try again', onPress: retryMembers }}
                />
              </Card>
            ) : (
              <ListSection footer={q.trim() ? `${filtered.length} of ${members.length} shown` : undefined}>
                {filtered.slice(0, 40).map((m, i) => (
                  <Appear key={m.id} index={i}>
                    <PersonRow
                      name={m.name}
                      subtitle={String(m.role).replace(/_/g, ' ')}
                      chevron
                      onPress={() => loadSessions(m)}
                      style={{ marginHorizontal: 0, paddingHorizontal: spacing.lg, borderRadius: 0 }}
                    />
                  </Appear>
                ))}
              </ListSection>
            )}
          </>
        ) : (
          <>
            <Button
              label="All members"
              icon="arrow-back"
              variant="ghost"
              size="sm"
              style={{ alignSelf: 'flex-start' }}
              onPress={clearMember}
            />

            {active ? (
              <Appear index={0}>
                {/* A shift with nothing in it gets ONE honest explanation, not an empty map
                    box with a caption under it saying the same thing twice. */}
                {!loadingPath && path.length === 0 ? (
                  <Card padded={false}>
                    <EmptyState
                      icon="git-branch-outline"
                      title="No points recorded for this shift"
                      subtitle="The shift was opened but no location fixes came back for it. That normally means location was switched off, or the app never ran in the background that day."
                    />
                  </Card>
                ) : (
                  <>
                    <LeafletMap
                      pins={[]}
                      path={path}
                      pathName={sel.name}
                      loading={loadingPath}
                      height={320}
                      onInteracting={setMapBusy}
                    />
                    <Txt size={font.cap} color={c.faint} style={{ textAlign: 'center', marginTop: spacing.sm, lineHeight: 17 }}>
                      Drag to pan, pinch to zoom. The line runs from A to B, faint at the
                      start of the shift and solid at the newest point. Tap anywhere on it
                      for the time.
                    </Txt>
                  </>
                )}
                {loadingPath ? (
                  <Row style={{ gap: spacing.sm, marginTop: spacing.md }}>
                    {[0, 1, 2].map((i) => <Skeleton key={i} width={112} height={58} radius={radius.md} />)}
                  </Row>
                ) : (
                  <View style={{ marginHorizontal: -spacing.lg, marginTop: spacing.md }}>
                    <KpiStrip items={stats} contentStyle={{ paddingHorizontal: spacing.lg }} />
                  </View>
                )}
              </Appear>
            ) : null}

            {loadingSessions ? <SessionsSkeleton /> : sessions.length === 0 ? (
              <ListSection title="Tracked shifts (last 14 days)">
                <EmptyState
                  icon={health.degraded ? 'cloud-offline-outline' : 'git-branch-outline'}
                  title={health.degraded ? 'Shifts could not load' : 'No routes recorded yet'}
                  subtitle={health.degraded
                    ? 'The server did not answer, so this is unconfirmed rather than empty. Check your connection and try again.'
                    : `${sel.name} has not recorded a field route in the last 14 days. Paths appear here after they clock in from the app.`}
                  action={{ label: 'Try again', onPress: () => loadSessions(sel) }}
                />
              </ListSection>
            ) : (
              <ListSection title="Tracked shifts (last 14 days)">
                {sessions.map((s, i) => (
                  <Appear key={s.session_id} index={i}>
                    <SessionRow
                      s={s}
                      selected={active?.session_id === s.session_id}
                      onPress={() => openSession(s)}
                    />
                  </Appear>
                ))}
              </ListSection>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/* ================================================================== *
 * Session row
 * ================================================================== */

function SessionRow({ s, selected, onPress }: {
  s: TrackSession; selected: boolean; onPress: () => void;
}) {
  const c = useTheme();
  const running = !s.ended_at;
  const detail = [
    s.started_at ? fmtTime(s.started_at) : null,
    km(s.distance_m),
    `${s.point_count || 0} points`,
  ].filter(Boolean).join(' · ');

  // A plain Pressable, not a Card: this row already lives inside ListSection's card, and
  // a nested card would draw a second border and a second shadow inside the first.
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Shift ${s.date}, ${detail}`}
      style={({ pressed }) => [{
        backgroundColor: pressed ? c.cardAlt : selected ? c.primarySoft : 'transparent',
      }]}
    >
      <Row style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 48 }}>
        <View style={{
          width: 38, height: 38, borderRadius: 12,
          backgroundColor: selected ? c.card : c.cardAlt,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="navigate" size={17} color={selected ? c.primary : c.muted} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={font.body} weight="700" numeric numberOfLines={1}>{s.date}</Txt>
          <Txt size={font.cap} color={c.muted} numeric numberOfLines={1}>{detail}</Txt>
        </View>
        {running ? <Pill label="On duty" tone="success" small dot /> : null}
        <Ionicons
          name={selected ? 'checkmark-circle' : 'chevron-forward'}
          size={16}
          color={selected ? c.primary : c.faint}
        />
      </Row>
    </Pressable>
  );
}

/* ================================================================== *
 * Loading
 * ================================================================== */

function RosterSkeleton() {
  const c = useTheme();
  return (
    <Card padded={false}>
      <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
        {[0, 1, 2, 3, 4].map((i) => (
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
                <Skeleton width="54%" height={13} />
                <Skeleton width="30%" height={11} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

function SessionsSkeleton() {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Skeleton width={190} height={10} style={{ marginLeft: spacing.xs }} />
      <Card padded={false}>
        <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
          {[0, 1, 2].map((i) => (
            <View key={i}>
              {i > 0 ? (
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: spacing.lg }} />
              ) : null}
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 62,
              }}>
                <Skeleton width={38} height={38} radius={12} />
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <Skeleton width="42%" height={13} />
                  <Skeleton width="66%" height={11} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}
