import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Row, Screen, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Button, Field, IconBtn } from '@/ui/controls';
import { Banner, EmptyState, Skeleton, SkeletonText, useToast } from '@/ui/feedback';
import { DataRow, ListSection, Pill } from '@/ui/data';
import type { Tone } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { Sheet } from '@/ui/sheet';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/store/auth';
import { useAppUi } from '@/store/appUi';
import * as api from '@/data/api';
import { fmtDate, fmtTime, timeAgo } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';

/* ------------------------------------------------------------------ *
 * One request, and the one decision that matters: who is doing it.
 *
 * THE SCREEN IS BUILT AROUND CLAIMING. A ticket with no owner is work nobody has agreed to
 * do, and every hour it sits there is an hour a customer is waiting on silence. So the
 * unclaimed state is stated plainly, and the primary control in the thumb arc is "I'll
 * handle this" — one tap, no form, no picker.
 *
 * THE CLAIM IS NEVER PAINTED OPTIMISTICALLY. `updateTicket` returns null when the server
 * refused the write (403 out of scope, a dead session, an outage). Showing the claimed
 * state anyway would tell an advisor they own a request they do not own, and the customer
 * would wait for a call that nobody was ever going to make. On null the screen keeps the
 * unclaimed state and says why, inline.
 *
 * REASON AND TASK ARE DIFFERENT FACTS. `reason` is what the AI understood the customer to
 * be asking; `task` is what the firm has to do about it. They are frequently not the same
 * sentence, and collapsing them loses the half that tells you what to actually do next.
 *
 * WIRE-SHAPE TOLERANCE: the deployed backend returns `status_timeline` / `created_at`
 * while the typed model exposes `timeline` / `createdAt`. Both are read, in that order, so
 * the activity trail survives either build rather than silently rendering empty.
 * ------------------------------------------------------------------ */

type TrailEntry = { action: string; at: string | null; actor: string | null };

type TicketWire = api.Ticket & {
  kind?: string | null;
  source_label?: string | null;
  original_command?: string | null;
  linked?: { type: string | null; id: string | null } | null;
  notes?: string[];
  language?: string | null;
  status_timeline?: { status?: string | null; at?: string | null; actor?: string | null }[];
  created_at?: string | null;
  updated_at?: string | null;
};

const TYPE_META: Record<string, { icon: IconName; tone: Tone }> = {
  claim: { icon: 'shield-checkmark-outline', tone: 'danger' },
  lead: { icon: 'flag-outline', tone: 'accent' },
  investment: { icon: 'trending-up-outline', tone: 'primary' },
  policy_review: { icon: 'document-text-outline', tone: 'info' },
  renewal: { icon: 'refresh-outline', tone: 'warning' },
  maturity: { icon: 'cash-outline', tone: 'success' },
  service: { icon: 'construct-outline', tone: 'neutral' },
  call: { icon: 'call-outline', tone: 'primary' },
  complaint: { icon: 'alert-circle-outline', tone: 'danger' },
  other: { icon: 'file-tray-outline', tone: 'neutral' },
};
const FALLBACK_TYPE = { icon: 'file-tray-outline' as IconName, tone: 'neutral' as Tone };
const typeMeta = (k?: string) => TYPE_META[String(k ?? '').toLowerCase()] ?? FALLBACK_TYPE;

const STATUS_TONE: Record<string, Tone> = {
  new: 'info', new_inquiry: 'info', open: 'info',
  assigned: 'primary', in_progress: 'primary', working: 'primary',
  awaiting_customer: 'warning', awaiting_docs: 'warning', pending: 'warning', on_hold: 'warning',
  resolved: 'success', done: 'success', completed: 'success',
  closed: 'neutral', cancelled: 'neutral', canceled: 'neutral',
  lost: 'danger', rejected: 'danger',
};
const statusTone = (s?: string): Tone => STATUS_TONE[String(s ?? '').toLowerCase()] ?? 'neutral';

const priorityTone = (p?: string): Tone => {
  switch (String(p ?? '').toUpperCase()) {
    case 'P1': return 'danger';
    case 'P2': return 'warning';
    case 'P3': return 'primary';
    default: return 'neutral';
  }
};

const zoneTone = (z?: string): Tone | null => {
  switch (String(z ?? '').toLowerCase()) {
    case 'red': return 'danger';
    case 'amber': return 'warning';
    case 'green': return 'success';
    default: return null;
  }
};

const titleCase = (s: string) =>
  s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

/** Audit lines arrive as machine phrases ("state new -> in_progress"). Make them readable. */
const sentence = (s: string) => {
  const t = s.replace(/_/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
};

/**
 * The lifecycle the admin panel writes. The ticket's own current state is always offered
 * too, even when the bot invented one outside this list, so the sheet can never mislabel
 * where the request actually is.
 */
const STATE_OPTIONS = ['new', 'in_progress', 'awaiting_customer', 'resolved', 'closed'];

const STATE_HINT: Record<string, string> = {
  new: 'Nobody has started on it',
  in_progress: 'Being worked on right now',
  awaiting_customer: 'Waiting on the customer for something',
  resolved: 'Done, pending a final close',
  closed: 'Finished. It leaves the active inbox',
};

function trailOf(t: api.Ticket): TrailEntry[] {
  const w = t as TicketWire;
  // An empty `timeline` is not the same as a missing one: `??` alone would stop at [] and
  // never look at the wire field the deployed backend actually sends.
  const raw: { status?: string | null; at?: string | null; actor?: string | null }[] =
    (t.timeline && t.timeline.length > 0 ? t.timeline : w.status_timeline) ?? [];
  return raw
    .map((e) => ({ action: String(e?.status ?? ''), at: e?.at ?? null, actor: e?.actor ?? null }))
    .filter((e) => e.action.length > 0);
}
const createdAtOf = (t: api.Ticket): string | null => (t as TicketWire).created_at ?? t.createdAt ?? null;
const updatedAtOf = (t: api.Ticket): string | null => (t as TicketWire).updated_at ?? t.updatedAt ?? null;

/** `fmtDate` yields a dash for an unparseable value, and the UI never shows those. */
function stamp(iso: string | null): string | null {
  if (!iso) return null;
  const d = fmtDate(iso);
  if (!d || d === '—') return null;
  return `${d}, ${fmtTime(iso)}`;
}

export default function TicketDetail() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const toast = useToast();
  const { user } = useAuth();
  const { can, ready: uiReady } = useAppUi();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [ticket, setTicket] = useState<api.Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const [stateOpen, setStateOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');

  /** Guards every setState that follows an await on a write. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Reads are cancelled on blur AND on unmount: a slow response must never repaint a screen
  // the user has already left. `isLive` is the focus flag; `alive` is the mount flag, so the
  // manual retry (which has no focus scope of its own) is still guarded.
  const fetchInto = useCallback(async (isLive: () => boolean) => {
    const t = await api.getTicket(String(id));
    if (!isLive() || !alive.current) return;
    setTicket(t ?? null);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => {
    let running = true;
    void fetchInto(() => running);
    return () => { running = false; };
  }, [fetchInto]));

  const retry = useCallback(() => {
    setLoading(true);
    setFailure(null);
    void fetchInto(() => true);
  }, [fetchInto]);

  const me = user?.name?.trim() ?? '';
  const owner = ticket?.owner?.name?.trim() ?? '';
  const ownedByMe = !!owner && !!me && owner.toLowerCase() === me.toLowerCase();
  const ownedByOther = !!owner && !ownedByMe;
  // Band 2 #8 (2026-08-25): claiming a ticket is a team-allowed action (schema default true) — no
  // tier gate; the RBAC `can_claim_ticket` flag gates it alone, failing OPEN (missing/loading =
  // allowed) so every tier keeps it today and a future config can withdraw it per role.
  const canClaim = !!ticket && !owner && !ticket.is_closed
    && (uiReady ? can('can_claim_ticket') !== false : true);

  /* ---------- writes ---------- */

  const applyResult = useCallback((updated: api.Ticket | null, refusal: string, done: string) => {
    if (!alive.current) return false;
    if (!updated) {
      haptics.error();
      setFailure(refusal);
      return false;
    }
    setTicket(updated);
    setFailure(null);
    haptics.success();
    toast(done, 'success');
    return true;
  }, [toast]);

  const claim = useCallback(async () => {
    if (!ticket || busy) return;
    if (!me) {
      haptics.warn();
      setFailure('Your profile has no name on it, so the request cannot be assigned to you. Add a name in your profile and try again.');
      return;
    }
    haptics.tap();
    setFailure(null);
    setBusy(true);
    const updated = await api.updateTicket(ticket.id, { assignedTo: me });
    if (!alive.current) return;
    setBusy(false);
    applyResult(
      updated,
      'The server did not accept the assignment, so this request is still unclaimed. Nothing was changed.',
      'You are handling this request',
    );
  }, [ticket, busy, me, applyResult]);

  const advance = useCallback(async (next: string) => {
    if (!ticket || busy) return;
    setStateOpen(false);
    if (next === ticket.status) return;
    haptics.tap();
    setFailure(null);
    setBusy(true);
    const updated = await api.updateTicket(ticket.id, { state: next });
    if (!alive.current) return;
    setBusy(false);
    applyResult(
      updated,
      'The server did not accept the status change, so the request is still where it was.',
      `Status set to ${titleCase(next)}`,
    );
  }, [ticket, busy, applyResult]);

  const addNote = useCallback(async () => {
    const text = note.trim();
    if (!ticket || busy || !text) return;
    haptics.tap();
    setFailure(null);
    setBusy(true);
    const updated = await api.updateTicket(ticket.id, { note: text });
    if (!alive.current) return;
    setBusy(false);
    const ok = applyResult(
      updated,
      'The note was not saved. Nothing has been added to this request.',
      'Note added',
    );
    if (!alive.current) return;
    setNoteOpen(false);
    if (ok) setNote('');
  }, [note, ticket, busy, applyResult]);

  /* ---------- derived ---------- */

  const trail = useMemo(() => (ticket ? trailOf(ticket) : []), [ticket]);
  const notes = useMemo(() => {
    const raw = (ticket as TicketWire | null)?.notes;
    return Array.isArray(raw) ? raw.filter((n) => !!n && String(n).trim().length > 0) : [];
  }, [ticket]);

  if (loading) return <TicketSkeleton />;

  if (!ticket) {
    return (
      <Screen>
        <Header title="Request" back />
        <EmptyState
          icon={health.degraded ? 'cloud-offline-outline' : 'file-tray-outline'}
          title={health.degraded ? 'This request could not load' : 'Request not found'}
          subtitle={health.degraded
            ? 'The server did not answer, so nothing here is confirmed. Check your connection and try again.'
            : 'This ticket is not in the inbox you can see. It may have been closed, reassigned or removed.'}
          action={{ label: 'Try again', onPress: retry }}
        />
      </Screen>
    );
  }

  const w = ticket as TicketWire;
  const t = typeMeta(ticket.type);
  const zone = zoneTone(ticket.zone);
  const phone = ticket.client?.phone ?? '';
  const name = ticket.client?.name || 'Customer';
  const reason = ticket.reason || ticket.request_text || '';
  const task = ticket.task || '';
  const created = stamp(createdAtOf(ticket));
  const updated = stamp(updatedAtOf(ticket));
  const createdAge = createdAtOf(ticket);
  const original = w.original_command && w.original_command !== reason ? w.original_command : null;
  const source = w.source_label || (ticket.source ? titleCase(ticket.source) : null);
  const raisedBy = [source, ticket.channel ? titleCase(ticket.channel) : null].filter(Boolean).join(' · ');

  const stateChoices = STATE_OPTIONS.includes(ticket.status)
    ? STATE_OPTIONS
    : [ticket.status, ...STATE_OPTIONS];

  return (
    <Screen>
      <Header
        title={ticket.ticket_ref || 'Request'}
        subtitle={`${ticket.type_label || titleCase(ticket.type)}${createdAge ? ` · raised ${timeAgo(createdAge)}` : ''}`}
        back
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {failure ? (
          <Banner
            tone="danger"
            title="That change was not saved"
            message={failure}
            onDismiss={() => setFailure(null)}
          />
        ) : null}

        {/* Who it is about. The status token rides here so the first glance answers
            "whose request, and where is it". */}
        <Appear index={0}>
          <Card>
            <PersonRow
              name={name}
              subtitle={phone || 'No number on this request'}
              subtitleIcon={phone ? 'call-outline' : 'alert-circle-outline'}
              subtitleNumeric
              right={<Pill label={ticket.status_label || titleCase(ticket.status)} tone={statusTone(ticket.status)} small />}
            />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md }}>
              <Pill label={ticket.type_label || titleCase(ticket.type)} tone={t.tone} icon={t.icon} small />
              {ticket.priority ? (
                <Pill label={String(ticket.priority).toUpperCase()} tone={priorityTone(ticket.priority)} icon="flag" small />
              ) : null}
              {zone ? <Pill label={`${titleCase(String(ticket.zone))} zone`} tone={zone} small dot /> : null}
              {ticket.is_closed ? <Pill label="Closed" tone="neutral" icon="lock-closed" small /> : null}
            </View>

            {/* Ownership, stated in words. This is the fact the whole screen turns on. */}
            <View style={{
              marginTop: spacing.lg, paddingTop: spacing.md,
              borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline,
              flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            }}>
              <Ionicons
                name={owner ? 'person-circle' : 'help-circle-outline'}
                size={18}
                color={ownedByMe ? c.success : owner ? c.primary : c.warning}
              />
              <Txt size={font.sub} weight="700" color={ownedByMe ? c.success : owner ? c.text : c.warning} numberOfLines={2} style={{ flex: 1 }}>
                {ownedByMe ? 'You are handling this'
                  : owner ? `${owner} is handling this`
                    : 'Nobody is handling this yet'}
              </Txt>
              {ticket.owner?.team ? (
                <Txt size={font.tiny} color={c.faint} numberOfLines={1}>{titleCase(ticket.owner.team)}</Txt>
              ) : null}
            </View>
          </Card>
        </Appear>

        {/* WHY, then WHAT. The screen's single Eyebrow sits here because this is the
            paragraph the advisor actually reads. */}
        <Appear index={1}>
          <Card>
            <Eyebrow color={c.primary}>Why this was raised</Eyebrow>
            <Txt size={16} weight="700" style={{ marginTop: 5, lineHeight: 23 }}>
              {reason || 'No description was captured for this request.'}
            </Txt>

            {task && task !== reason ? (
              <View style={{
                marginTop: spacing.md, paddingTop: spacing.md,
                borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline, gap: 3,
              }}>
                <Txt size={font.cap} weight="700" color={c.muted}>What needs doing</Txt>
                <Txt size={font.sub} style={{ lineHeight: 21 }}>{task}</Txt>
              </View>
            ) : null}

            {original ? (
              <View style={{
                marginTop: spacing.md, paddingTop: spacing.md,
                borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline, gap: 3,
              }}>
                <Txt size={font.cap} weight="700" color={c.muted}>{"In the customer's words"}</Txt>
                <Txt size={font.sub} color={c.muted} style={{ lineHeight: 21 }}>{`"${original}"`}</Txt>
              </View>
            ) : null}
          </Card>
        </Appear>

        <Appear index={2}>
          <ListSection title="Request">
            <DataRow
              label="Status"
              value=""
              icon="ellipse-outline"
              right={<Pill label={ticket.status_label || titleCase(ticket.status)} tone={statusTone(ticket.status)} small />}
            />
            {ticket.policy_no ? (
              <DataRow label="Policy number" value={ticket.policy_no} icon="document-text-outline" numeric copyable />
            ) : null}
            {phone ? <DataRow label="Mobile" value={phone} icon="call-outline" numeric copyable /> : null}
            {raisedBy ? <DataRow label="Raised by" value={raisedBy} icon="megaphone-outline" /> : null}
            {ticket.category ? <DataRow label="Category" value={titleCase(ticket.category)} icon="pricetag-outline" /> : null}
            {w.linked?.id ? (
              <DataRow label={`Linked ${titleCase(w.linked.type || 'record')}`} value={String(w.linked.id)} icon="link-outline" copyable />
            ) : null}
            {w.language ? <DataRow label="Language" value={titleCase(w.language)} icon="language-outline" /> : null}
            {created ? <DataRow label="Raised" value={created} icon="time-outline" numeric /> : null}
            {updated && updated !== created ? (
              <DataRow label="Last update" value={updated} icon="refresh-outline" numeric />
            ) : null}
          </ListSection>
        </Appear>

        <Appear index={3}>
          <ListSection title="Ownership">
            <DataRow
              label="Owner"
              value={owner || 'Unclaimed'}
              icon="person-outline"
              tone={owner ? 'neutral' : 'warning'}
            />
            {ticket.owner?.team ? <DataRow label="Team" value={titleCase(ticket.owner.team)} icon="people-outline" /> : null}
            {ticket.owner?.status ? (
              <DataRow label="Assignment" value={titleCase(ticket.owner.status)} icon="checkmark-circle-outline" />
            ) : null}
          </ListSection>
        </Appear>

        <Appear index={4}>
          <Row style={{ gap: spacing.md }}>
            <Button
              label="Update status"
              icon="swap-vertical-outline"
              variant="outline"
              disabled={busy}
              onPress={() => setStateOpen(true)}
              style={{ flex: 1 }}
            />
            {ownedByOther ? (
              <Button
                label="Take it over"
                icon="hand-left-outline"
                variant="ghost"
                disabled={busy}
                onPress={claim}
                style={{ flex: 1 }}
              />
            ) : null}
          </Row>
        </Appear>

        {notes.length > 0 ? (
          <Appear index={5}>
            <ListSection title="Notes" footer="Notes are visible to everyone who can see this request.">
              {notes.map((n, i) => (
                <View key={`${i}_${String(n).slice(0, 12)}`} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
                  <Txt size={font.sub} style={{ lineHeight: 21 }}>{String(n)}</Txt>
                </View>
              ))}
            </ListSection>
          </Appear>
        ) : null}

        <Appear index={6}>
          {trail.length > 0 ? (
            <ListSection title="Activity" footer="Newest first. Every status change, assignment and note is recorded here.">
              {trail.map((e, i) => (
                <TrailRow key={`${i}_${e.at ?? 'na'}`} entry={e} first={i === 0} />
              ))}
            </ListSection>
          ) : (
            <ListSection title="Activity">
              <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.lg }}>
                <Txt size={font.sub} color={c.muted}>
                  Nothing has happened on this request since it was raised.
                </Txt>
              </View>
            </ListSection>
          )}
        </Appear>
      </ScrollView>

      {/* Pinned bar — the claim never scrolls away, and it sits inside the thumb arc. */}
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
          disabled={!phone}
          onPress={() => { haptics.tap(); call(phone); }}
          accessibilityLabel={`Call ${name}`}
        />
        <IconBtn
          icon="logo-whatsapp"
          size={48}
          bg={c.whatsappSoft}
          color={c.whatsapp}
          disabled={!phone}
          onPress={() => { haptics.tap(); whatsapp(phone, `Namaste ${name}`); }}
          accessibilityLabel={`Open WhatsApp chat with ${name}`}
        />
        {canClaim ? (
          <Button
            label="I'll handle this"
            icon="hand-left"
            full
            loading={busy}
            disabled={busy}
            onPress={claim}
            style={{ flex: 1 }}
          />
        ) : (
          <Button
            label="Add a note"
            icon="create-outline"
            full
            disabled={busy}
            onPress={() => setNoteOpen(true)}
            style={{ flex: 1 }}
          />
        )}
      </View>

      <Sheet
        visible={stateOpen}
        onClose={() => setStateOpen(false)}
        title="Update status"
        subtitle={`Currently ${ticket.status_label || titleCase(ticket.status)}`}
      >
        <View style={{ paddingTop: spacing.xs }}>
          {stateChoices.map((s, i) => (
            <StateOption
              key={s}
              value={s}
              current={s === ticket.status}
              first={i === 0}
              onPress={() => advance(s)}
            />
          ))}
        </View>
      </Sheet>

      <Sheet
        visible={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Add a note"
        subtitle={ticket.ticket_ref ?? undefined}
        footer={
          <Button
            label="Save note"
            icon="checkmark"
            full
            loading={busy}
            disabled={busy || note.trim().length === 0}
            onPress={addNote}
          />
        }
      >
        <View style={{ paddingTop: spacing.xs }}>
          <Field
            label="Note"
            value={note}
            onChange={setNote}
            placeholder="What happened, or what you agreed with the customer"
            multiline
            maxLength={500}
            hint="This is added to the activity trail with your name against it."
          />
        </View>
      </Sheet>
    </Screen>
  );
}

/* ================================================================== *
 * Sheet option
 * ================================================================== */

function StateOption({ value, current, first, onPress }: {
  value: string; current: boolean; first: boolean; onPress: () => void;
}) {
  const c = useTheme();
  const tone = statusTone(value);
  const hint = STATE_HINT[value];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={titleCase(value)}
      accessibilityState={{ selected: current }}
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        minHeight: 56, paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
        marginHorizontal: -spacing.sm, borderRadius: radius.md,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.hairline,
        backgroundColor: pressed ? c.cardAlt : 'transparent',
      }]}
    >
      <Pill label={titleCase(value)} tone={tone} small dot />
      <View style={{ flex: 1 }}>
        {hint ? <Txt size={font.cap} color={c.muted} numberOfLines={1}>{hint}</Txt> : null}
      </View>
      <Ionicons
        name={current ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={current ? c.primary : c.faint}
      />
    </Pressable>
  );
}

/* ================================================================== *
 * Activity trail
 * ================================================================== */

function TrailRow({ entry, first }: { entry: TrailEntry; first: boolean }) {
  const c = useTheme();
  const when = entry.at ? timeAgo(entry.at) : null;
  const meta = [entry.actor, when].filter(Boolean).join(' · ');
  return (
    <View style={{
      flexDirection: 'row', gap: spacing.md, minHeight: 48,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    }}>
      {/* The newest entry is the live one; the rest is history and reads as structure. */}
      <View style={{ width: 10, alignItems: 'center', paddingTop: 4 }}>
        <View style={{
          width: 9, height: 9, borderRadius: 4.5,
          backgroundColor: first ? c.primary : c.card,
          borderWidth: 2, borderColor: first ? c.primary : c.spine,
        }} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={font.sub} weight="600" numberOfLines={4} style={{ lineHeight: 20 }}>
          {sentence(entry.action)}
        </Txt>
        {meta ? <Txt size={font.tiny} color={c.faint} numeric numberOfLines={1}>{meta}</Txt> : null}
      </View>
    </View>
  );
}

/* ================================================================== *
 * Loading — the shape of the screen that is coming
 * ================================================================== */

function TicketSkeleton() {
  const c = useTheme();
  return (
    <Screen>
      <Header title="Request" back />
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card>
          <Row>
            <Skeleton width={44} height={44} radius={44 / 2.6} />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Skeleton width="62%" height={14} />
              <Skeleton width="40%" height={11} />
            </View>
            <Skeleton width={64} height={20} radius={radius.pill} />
          </Row>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.md }}>
            <Skeleton width={86} height={20} radius={radius.pill} />
            <Skeleton width={46} height={20} radius={radius.pill} />
            <Skeleton width={78} height={20} radius={radius.pill} />
          </View>
          <View style={{
            marginTop: spacing.lg, paddingTop: spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline,
          }}>
            <Skeleton width="56%" height={13} />
          </View>
        </Card>

        <Card>
          <Skeleton width={128} height={10} />
          <View style={{ marginTop: spacing.md }}>
            <SkeletonText lines={3} lineHeight={14} />
          </View>
        </Card>

        <Card>
          <SkeletonText lines={4} lineHeight={12} gap={spacing.xl} />
        </Card>
      </View>
    </Screen>
  );
}
