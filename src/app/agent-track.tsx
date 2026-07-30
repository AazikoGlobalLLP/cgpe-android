import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radius, shadow } from '@/theme/theme';
import { Avatar, Card, EmptyState, Grad, Header, SearchBar } from '@/ui/kit';
import { LeafletMap } from '@/ui/LeafletMap';
import { useAuth } from '@/store/auth';
import { capabilitiesOf } from '@/store/roles';
import * as api from '@/data/api';
import type { TrackSession, TrackPoint } from '@/data/api';
import { fmtTime } from '@/lib/format';

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function fmtDur(a?: string, b?: string | null) {
  if (!a) return '—';
  const end = b ? new Date(b).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - new Date(a).getTime()) / 60000));
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function AgentTrack() {
  const c = useTheme();
  const { user } = useAuth();
  const isMaster = capabilitiesOf(user).tier === 'master';

  const [members, setMembers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<{ id: string; name: string } | null>(null);
  const [sessions, setSessions] = useState<TrackSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [active, setActive] = useState<TrackSession | null>(null);
  const [path, setPath] = useState<TrackPoint[]>([]);
  const [loadingPath, setLoadingPath] = useState(false);

  useEffect(() => { if (isMaster) api.getTrackableMembers().then(setMembers).catch(() => setMembers([])); }, [isMaster]);

  const loadSessions = useCallback(async (m: { id: string; name: string }) => {
    setSel(m); setActive(null); setPath([]); setLoadingSessions(true);
    const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 14);
    const rows = await api.getTrackSessions(m.id, ymd(from), ymd(to));
    setSessions(rows); setLoadingSessions(false);
  }, []);

  const openSession = useCallback(async (s: TrackSession) => {
    setActive(s); setLoadingPath(true);
    const t = await api.getTrack(s.session_id);
    setPath(t?.points || []); setLoadingPath(false);
  }, []);

  if (!isMaster) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Movement paths" back />
        <Card style={{ margin: spacing.lg }}><EmptyState icon="lock-closed" title="Master only" subtitle="Field-route history is visible to the master admin only." /></Card>
      </View>
    );
  }

  const filtered = q.trim() ? members.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase())) : members;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Movement paths" subtitle={sel ? sel.name : 'Pick a team member'} back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }} showsVerticalScrollIndicator={false}>

        {/* Member picker */}
        {!sel && (
          <>
            <SearchBar value={q} onChange={setQ} placeholder="Search team member" />
            <View style={{ gap: 8 }}>
              {filtered.slice(0, 40).map((m) => (
                <Card key={m.id} onPress={() => loadSessions(m)} padded={false} style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
                  <Avatar name={m.name} size={40} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 14.5 }}>{m.name}</Text>
                    <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }}>{String(m.role).replace('_', ' ')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.faint} />
                </Card>
              ))}
              {!filtered.length && <Text style={{ color: c.faint, fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>No team members found.</Text>}
            </View>
          </>
        )}

        {sel && (
          <>
            <Pressable onPress={() => { setSel(null); setSessions([]); setActive(null); setPath([]); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="arrow-back" size={16} color={c.primary} />
              <Text style={{ color: c.primary, fontWeight: '700', fontSize: 13 }}>All members</Text>
            </Pressable>

            {/* Map with the selected session's path */}
            {active && (
              <>
                <LeafletMap pins={[]} path={path} height={320} />
                {loadingPath ? <ActivityIndicator color={c.primary} /> : (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Stat c={c} label="Distance" value={`${((active.distance_m || 0) / 1000).toFixed(2)} km`} />
                    <Stat c={c} label="Points" value={String(active.point_count || path.length)} />
                    <Stat c={c} label="Duration" value={fmtDur(active.started_at, active.ended_at)} />
                  </View>
                )}
              </>
            )}

            {/* Session list */}
            <View>
              <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Tracked shifts (last 14 days)</Text>
              {loadingSessions ? <ActivityIndicator color={c.primary} /> : sessions.length === 0 ? (
                <Card><EmptyState icon="git-branch-outline" title="No routes yet" subtitle={`${sel.name} hasn't recorded a field route yet. Paths appear here after they clock in from the app.`} /></Card>
              ) : (
                <View style={{ gap: 10 }}>
                  {sessions.map((s) => {
                    const on = active?.session_id === s.session_id;
                    return (
                      <Card key={s.session_id} onPress={() => openSession(s)} padded={false} style={{ padding: 13, flexDirection: 'row', alignItems: 'center', borderWidth: on ? 1.5 : 0, borderColor: c.primary }}>
                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="navigate" size={18} color={c.primary} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{s.date}</Text>
                          <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }}>
                            {s.started_at ? fmtTime(s.started_at) : '—'} · {((s.distance_m || 0) / 1000).toFixed(1)} km · {s.point_count || 0} points
                          </Text>
                        </View>
                        {!s.ended_at && <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: c.successSoft }}><Text style={{ color: c.success, fontSize: 10.5, fontWeight: '800' }}>ON DUTY</Text></View>}
                      </Card>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ c, label, value }: any) {
  return (
    <Card style={{ flex: 1, padding: spacing.md }}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '900' }} numberOfLines={1}>{value}</Text>
      <Text style={{ color: c.muted, fontSize: 11, marginTop: 2, fontWeight: '700' }}>{label}</Text>
    </Card>
  );
}
