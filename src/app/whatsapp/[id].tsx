import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, StyleSheet, TextInput, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, radius, spacing, type, useTheme } from '@/theme/theme';
import { Header, Row, Screen, Txt, noOutline } from '@/ui/base';
import { IconBtn } from '@/ui/controls';
import { Banner, EmptyState, Skeleton } from '@/ui/feedback';
import { Pill } from '@/ui/data';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import * as api from '@/data/api';
import type { WaMessage, WaThread } from '@/data/types';
import { daysUntil, fmtDate, fmtTime } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';

/* ------------------------------------------------------------------ *
 * One WhatsApp conversation.
 *
 * WHY THIS SCREEN IS `<Screen keyboard>` AND THE INBOX IS NOT. Keyboard avoidance is not
 * free: on a list screen it makes everything jump when an unrelated field focuses. Here
 * the composer IS the screen's purpose, and a send button hidden behind the keyboard is
 * the entire problem, so this is exactly the case the opt-in exists for.
 *
 * WHY THE GREEN IS RATIONED TOO. The brand gradient belongs to the clock-in ring and the
 * active tab; on this screen the second identity in play is WhatsApp's own, so
 * `c.whatsapp` is spent on the four things that are genuinely about WhatsApp — the
 * outgoing bubble, the send button, the composer's focus ring, and the button that hands
 * the conversation over to the real app (`c.whatsappSoft` under it). Everything else stays
 * on the app's own surfaces. Foreground on the green is `c.onPrimary`, never a hardcoded
 * white: in dark mode the token lifts to #3ddc84 and white text on it fails contrast.
 *
 * WHY A SENT MESSAGE GETS A SINGLE TICK AND NEVER A DELIVERY CLAIM. `api.sendWaMessage`
 * resolves the same way whether the gateway accepted the message or the request quietly
 * failed, so the only honest statement this screen can make is "this app handed it over".
 * The tick means exactly that. Nothing here claims delivery or a read receipt, because
 * nothing here can know either. For the same reason the send path fires `haptics.tap`
 * (the action was committed) and never `haptics.success`, which is reserved for a write
 * the server actually confirmed.
 *
 * WHAT `getWaThread` ACTUALLY DOES ON FAILURE. It resolves `undefined` (via the data
 * layer's `unavailable`, which reports the endpoint to `data/health`); it does not reject.
 * So an absent result is the failure signal, and `thread === null` after `loading` clears
 * is the state the error EmptyState renders. The try/catch remains only for a synchronous
 * throw, so the screen can never hang on its skeleton.
 * ------------------------------------------------------------------ */

/** A message this session sent. `sending` while the request is in flight. */
type Outgoing = { msg: WaMessage; state: 'sending' | 'sent' };

type ChatRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; key: string; msg: WaMessage; state?: 'sending' | 'sent' };

const MAX_BUBBLE = '82%';
/** Within this many px of the end still counts as "reading the latest". */
const STICK_SLACK = 80;

function stamp(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

/** Empty string when the timestamp is unusable — better nothing than a placeholder glyph. */
function timeLabel(iso: string): string {
  return Number.isNaN(stamp(iso)) ? '' : fmtTime(iso);
}

function dayKey(iso: string): string {
  const t = stamp(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const t = stamp(iso);
  if (Number.isNaN(t)) return '';
  const diff = daysUntil(new Date(t));
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  return fmtDate(new Date(t));
}

/**
 * Messages plus day dividers, in one flat array the list can virtualise.
 *
 * Row keys are the message id, and the running index is appended ONLY when an id repeats.
 * Keying every row on its index instead would remount, and therefore re-animate, every
 * bubble below any insertion — including the routine one where a pending local message is
 * replaced by the server's echo of it.
 */
function buildRows(messages: WaMessage[], states: Map<string, 'sending' | 'sent'>): ChatRow[] {
  const rows: ChatRow[] = [];
  const seen = new Set<string>();
  let lastDay = '';
  messages.forEach((m, i) => {
    const key = dayKey(m.at);
    if (key && key !== lastDay) {
      lastDay = key;
      rows.push({ kind: 'day', key: `day-${key}`, label: dayLabel(m.at) });
    }
    const rowKey = seen.has(m.id) ? `${m.id}-${i}` : m.id;
    seen.add(m.id);
    rows.push({ kind: 'msg', key: rowKey, msg: m, state: states.get(m.id) });
  });
  return rows;
}

export default function Chat() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [thread, setThread] = useState<WaThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);

  const listRef = useRef<FlatList<ChatRow>>(null);

  /** Guards every setState that follows an await: this screen can be popped mid-request. */
  const alive = useRef(true);
  /** Monotonic request id, so a slow refocus cannot overwrite a newer load's result. */
  const reqId = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    const my = ++reqId.current;
    try {
      const t = await api.getWaThread(String(id));
      if (!alive.current || my !== reqId.current) return;
      // A failed refocus must not wipe a conversation that is already on screen: the
      // app-wide HealthBanner reports the outage, and the history stays readable.
      if (t) setThread(t);
    } catch {
      // Defensive only; see the module note. Swallowed so the screen never hangs.
    } finally {
      if (alive.current && my === reqId.current) setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const retry = useCallback(() => { setLoading(true); load(); }, [load]);

  /* ---------- what the list shows ----------
   * The server's copy, plus anything this session sent that has not yet come back in it.
   * Reconciliation is by text, COUNTED rather than set-matched: sending "ok" twice must
   * leave two lines on screen once the server has echoed only the first one back. */
  const messages = useMemo<WaMessage[]>(() => {
    const base = thread?.messages ?? [];
    if (outbox.length === 0) return base;

    const echoed = new Map<string, number>();
    base.forEach((m) => {
      if (!m.fromMe) return;
      const k = m.text.trim();
      echoed.set(k, (echoed.get(k) ?? 0) + 1);
    });

    const pending: WaMessage[] = [];
    outbox.forEach((o) => {
      const k = o.msg.text.trim();
      const n = echoed.get(k) ?? 0;
      if (n > 0) { echoed.set(k, n - 1); return; }   // the server already has this one
      pending.push(o.msg);
    });

    return pending.length > 0 ? [...base, ...pending] : base;
  }, [thread, outbox]);

  const rows = useMemo(() => {
    const states = new Map<string, 'sending' | 'sent'>();
    outbox.forEach((o) => states.set(o.msg.id, o.state));
    return buildRows(messages, states);
  }, [messages, outbox]);

  /* ---------- staying on the newest message ----------
   * Pinned only while the user is already reading the bottom. Yanking someone back down
   * mid-scroll because a layout pass fired is how a chat loses their place in history. */
  const atBottom = useRef(true);
  const rowCount = rows.length;

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    atBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < STICK_SLACK;
  }, []);

  const stickToEnd = useCallback(() => {
    if (rowCount === 0 || !atBottom.current) return;
    listRef.current?.scrollToEnd({ animated: false });
  }, [rowCount]);

  const body = text.trim();
  const canSend = body.length > 0 && !!thread;

  const onChangeText = useCallback((v: string) => {
    setText(v);
    // The banner reported the LAST attempt. Once the user starts rewriting, it is stale.
    setSendError((prev) => (prev ? null : prev));
  }, []);

  const send = useCallback(async () => {
    if (!thread) return;
    const outgoing = text.trim();
    if (!outgoing) return;

    haptics.tap();
    const local: WaMessage = {
      id: `local-${Date.now()}`,
      fromMe: true,
      text: outgoing,
      at: new Date().toISOString(),
    };
    // Sending is an explicit request to see your own message, so re-pin to the bottom
    // even if the user had scrolled up into history to write it.
    atBottom.current = true;
    setOutbox((prev) => [...prev, { msg: local, state: 'sending' }]);
    setText('');
    setSendError(null);

    try {
      await api.sendWaMessage(thread.id, outgoing);
      if (!alive.current) return;
      setOutbox((prev) => prev.map((o) => (o.msg.id === local.id ? { ...o, state: 'sent' } : o)));
    } catch {
      if (!alive.current) return;
      // The words go back in the box. A message that vanished under the thumb is worse
      // than one that was never sent. Only if the box is still empty, though: the send was
      // async and the user may already have started typing the next message into it.
      setOutbox((prev) => prev.filter((o) => o.msg.id !== local.id));
      setText((cur) => (cur.trim() ? cur : outgoing));
      haptics.error();
      setSendError('That message did not go out. Your text is back in the box, so you can try again.');
    }
  }, [thread, text]);

  /* ---------- header ---------- */
  const phone = thread?.phone ?? '';
  const subtitle = thread
    ? [phone, thread.tag].filter(Boolean).join(' · ') || 'WhatsApp conversation'
    : loading ? 'Opening the conversation' : 'Conversation unavailable';

  const headerActions = phone ? (
    <Row style={{ gap: spacing.sm }}>
      <IconBtn
        icon="call"
        size={38}
        onPress={() => { haptics.tap(); call(phone); }}
        accessibilityLabel={`Call ${thread?.name ?? 'this contact'}`}
      />
      <IconBtn
        icon="logo-whatsapp"
        size={38}
        bg={c.whatsappSoft}
        color={c.whatsapp}
        onPress={() => { haptics.tap(); whatsapp(phone); }}
        accessibilityLabel="Open this chat in WhatsApp"
      />
    </Row>
  ) : undefined;

  return (
    <Screen keyboard>
      <Header title={thread?.name || 'Chat'} subtitle={subtitle} back right={headerActions} />

      {loading ? (
        <ChatSkeleton />
      ) : !thread ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="cloud-offline-outline"
            title="This conversation could not be opened"
            subtitle={health.degraded
              ? 'The server did not answer, so no message history is confirmed. Check your connection and try again.'
              : 'The chat history did not come back from the server. Try again in a moment.'}
            action={{ label: 'Try again', onPress: retry }}
          />
        </View>
      ) : (
        <FlatList<ChatRow>
          ref={listRef}
          data={rows}
          keyExtractor={(r) => r.key}
          style={{ flex: 1 }}
          contentContainerStyle={[
            { padding: spacing.lg, paddingBottom: spacing.md, gap: 6, flexGrow: 1 },
            // An empty conversation has nothing to anchor to the bottom, so the empty
            // state centres instead of hanging under the header.
            rows.length === 0 ? { justifyContent: 'center' } : null,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          removeClippedSubviews={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          // Content grows when a message arrives or is sent; layout changes when the
          // keyboard opens and shortens the list. Both must re-pin the newest message.
          onContentSizeChange={stickToEnd}
          onLayout={stickToEnd}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title="No messages in this chat yet"
              subtitle="Anything you send from here goes out over WhatsApp to this number."
              action={phone ? { label: 'Open in WhatsApp', onPress: () => { haptics.tap(); whatsapp(phone); } } : undefined}
            />
          }
          renderItem={({ item, index }) => (
            <Appear index={index} distance={6}>
              {item.kind === 'day'
                ? <DayDivider label={item.label} />
                : <Bubble msg={item.msg} state={item.state} />}
            </Appear>
          )}
        />
      )}

      {!loading && thread ? (
        <View>
          {sendError ? (
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
              <Banner
                tone="danger"
                title="Message not sent"
                message={sendError}
                onDismiss={() => setSendError(null)}
              />
            </View>
          ) : null}

          <View style={{
            flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
            backgroundColor: c.bgElevated,
          }}>
            <View style={{
              flex: 1, minHeight: 46, maxHeight: 124, justifyContent: 'center',
              backgroundColor: c.card, borderRadius: radius.xl,
              // An Android text field gets no focus affordance for free, so the composer
              // grows a ring the way SearchBar and Field do. Green rather than azure
              // because on this screen the message is going out over WhatsApp.
              borderWidth: 1, borderColor: composerFocused ? c.whatsapp : c.border,
              paddingHorizontal: spacing.lg,
              paddingVertical: Platform.OS === 'ios' ? 12 : 6,
            }}>
              <TextInput
                value={text}
                onChangeText={onChangeText}
                onFocus={() => setComposerFocused(true)}
                onBlur={() => setComposerFocused(false)}
                placeholder="Type a message"
                placeholderTextColor={c.faint}
                multiline
                accessibilityLabel="Message"
                style={[{ color: c.text, ...type('500', font.body), lineHeight: 20, paddingVertical: 0 }, noOutline]}
              />
            </View>

            <IconBtn
              icon="send"
              size={46}
              bg={canSend ? c.whatsapp : c.cardAlt}
              color={canSend ? c.onPrimary : c.faint}
              disabled={!canSend}
              onPress={send}
              accessibilityLabel="Send message"
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

/* ================================================================== *
 * Bubbles
 * ================================================================== */

function DayDivider({ label }: { label: string }) {
  if (!label) return null;
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
      <Pill label={label} tone="neutral" small numeric />
    </View>
  );
}

function Bubble({ msg, state }: { msg: WaMessage; state?: 'sending' | 'sent' }) {
  const c = useTheme();
  const mine = msg.fromMe;
  const when = timeLabel(msg.at);
  const ink = mine ? c.onPrimary : c.text;
  const meta = mine ? c.onPrimary : c.faint;

  // Read as one utterance. Without grouping, a screen reader announces the text, the clock
  // and the tick as three unrelated nodes with no idea who said any of it.
  const spoken = [
    mine ? 'You said' : 'They said',
    msg.text,
    when,
    state === 'sending' ? 'sending' : state === 'sent' ? 'sent from this app' : '',
  ].filter(Boolean).join(', ');

  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: MAX_BUBBLE }}>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={spoken}
        style={{
          backgroundColor: mine ? c.whatsapp : c.card,
          borderRadius: radius.lg,
          borderBottomRightRadius: mine ? 5 : radius.lg,
          borderBottomLeftRadius: mine ? radius.lg : 5,
          paddingHorizontal: 13,
          paddingVertical: 9,
          borderWidth: mine ? 0 : StyleSheet.hairlineWidth,
          borderColor: c.border,
        }}
      >
        <Txt size={14.5} color={ink} style={{ lineHeight: 20 }}>
          {msg.text}
        </Txt>

        {when || state ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            alignSelf: 'flex-end', marginTop: 4,
          }}>
            {when ? (
              <Txt size={font.tiny} color={meta} numeric style={mine ? { opacity: 0.78 } : null}>
                {when}
              </Txt>
            ) : null}
            {state ? (
              // The tick means "this app handed the message over", not "delivered".
              <Ionicons
                name={state === 'sending' ? 'time-outline' : 'checkmark'}
                size={12}
                color={meta}
                style={mine ? { opacity: 0.78 } : null}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ================================================================== *
 * Loading — shaped like a conversation, not a centred spinner
 * ================================================================== */

/** Widths that read as speech: a chat is not a column of equal blocks. */
const SHAPES: { mine: boolean; w: number; h: number }[] = [
  { mine: false, w: 176, h: 42 },
  { mine: true, w: 132, h: 38 },
  { mine: false, w: 224, h: 58 },
  { mine: true, w: 196, h: 42 },
  { mine: false, w: 148, h: 38 },
  { mine: true, w: 240, h: 58 },
];

function ChatSkeleton() {
  return (
    <View style={{ flex: 1, padding: spacing.lg, gap: 10 }}>
      <View style={{ alignItems: 'center', paddingBottom: spacing.xs }}>
        <Skeleton width={78} height={20} radius={radius.pill} />
      </View>
      {SHAPES.map((s, i) => (
        <View key={i} style={{ alignSelf: s.mine ? 'flex-end' : 'flex-start' }}>
          <Skeleton width={s.w} height={s.h} radius={radius.lg} />
        </View>
      ))}
    </View>
  );
}
