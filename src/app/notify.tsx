/**
 * Compose and dispatch a team notification. Admin and Master only.
 *
 * WHY THIS SCREEN EXISTS. `POST /api/notifications` hard-codes `user_id: req.user.id`, so
 * before this pass the only person an admin could notify was themselves. Alerting the team
 * meant opening WhatsApp and typing the same message repeatedly. This screen plus the new
 * `POST /api/notifications/dispatch` endpoint closes that gap.
 *
 * THE AUDIENCE IS RESOLVED SERVER-SIDE. The picker below sends `user_ids`, but the backend
 * intersects them with ACTIVE staff before writing a single row. That matters: it means a
 * stale roster on the handset cannot mint notification rows against deactivated accounts,
 * and the count reported back is what was actually created rather than what was requested.
 *
 * SEND IS DELIBERATELY GATED BEHIND A CONFIRM. This writes to every person's feed at once and
 * there is no unsend. A stray thumb on a 44pt button should not be able to alert the whole
 * firm, so the confirm states the exact audience size before it commits.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Header, KeyboardScroll, Row, Screen, Txt } from '@/ui/base';
import { Button, Field, SearchBar, Segmented } from '@/ui/controls';
import { Banner, EmptyState, SkeletonCard, useToast } from '@/ui/feedback';
import { ListSection, Pill } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { Sheet } from '@/ui/sheet';
import { Appear } from '@/ui/motion';
import { spacing, useTheme } from '@/theme/theme';
import { useAuth } from '@/store/auth';
import { capabilitiesOf } from '@/store/roles';
import { useAppUi } from '@/store/appUi';
import { haptics } from '@/lib/haptics';
import * as api from '@/data/api';
import { useT, type TKey } from '@/i18n';

type Audience = 'all' | 'selected';
type Priority = 'low' | 'medium' | 'high';
type Member = { id: string; name: string; role: string };

// Phase 84 (2026-08-29): these tables hold i18n KEYS, resolved to the active language inside the
// component (docs/i18n §6c). Normal/Urgent deliberately do NOT reuse the task priority.medium /
// priority.high words — the copy request flags them as different terms in Hindi/Gujarati.
const AUDIENCE_OPTIONS: { key: Audience; labelKey: TKey }[] = [
  { key: 'all', labelKey: 'notify.audAll' },
  { key: 'selected', labelKey: 'notify.audChoose' },
];

const PRIORITY_OPTIONS: { key: Priority; labelKey: TKey }[] = [
  { key: 'low', labelKey: 'notify.prioLow' },
  { key: 'medium', labelKey: 'notify.prioNormal' },
  { key: 'high', labelKey: 'notify.prioUrgent' },
];

const TITLE_MAX = 120;
const MESSAGE_MAX = 1000;

export default function NotifyScreen() {
  const c = useTheme();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const { user, viewAs } = useAuth();
  const caps = capabilitiesOf(user, viewAs);
  const { can, ready: uiReady } = useAppUi();

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [priority, setPriority] = useState<Priority>('medium');

  // Built here (not at module scope) so the labels can be translated; `t` in the deps relabels
  // them on a language switch.
  const priorityOptions = useMemo(
    () => PRIORITY_OPTIONS.map((o) => ({ key: o.key, label: t(o.labelKey) })),
    [t],
  );
  const audienceOptions = useMemo(
    () => AUDIENCE_OPTIONS.map((o) => ({ key: o.key, label: t(o.labelKey) })),
    [t],
  );

  const [roster, setRoster] = useState<Member[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Record<string, true>>({});

  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [titleErr, setTitleErr] = useState('');
  const [messageErr, setMessageErr] = useState('');

  // Roster loads lazily: a team member never opens this screen, and the whole-team path
  // does not need the list at all.
  const loadRoster = useCallback(async () => {
    if (roster) return;
    const rows = await api.getTrackableMembers().catch(() => [] as Member[]);
    if (!alive.current) return;
    setRoster(rows);
  }, [roster]);

  const selectedIds = useMemo(() => Object.keys(selected), [selected]);

  const filtered = useMemo(() => {
    if (!roster) return [];
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((m) => m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q));
  }, [roster, query]);

  const validate = () => {
    let ok = true;
    if (!title.trim()) { setTitleErr('Give the notification a title.'); ok = false; } else setTitleErr('');
    if (!message.trim()) { setMessageErr('Write the message body.'); ok = false; } else setMessageErr('');
    if (audience === 'selected' && selectedIds.length === 0) {
      setFailure('Choose at least one person, or switch to the whole team.');
      ok = false;
    }
    if (!ok) haptics.warn();
    return ok;
  };

  const send = useCallback(async () => {
    setFailure(null);
    setSending(true);
    try {
      const res = await api.dispatchNotification({
        title: title.trim(),
        message: message.trim(),
        priority,
        audience,
        user_ids: selectedIds,
      });
      if (!alive.current) return;
      setSending(false);
      if (!res.ok) {
        haptics.error();
        setFailure(res.message);
        return;
      }
      haptics.success();
      toast(res.message, 'success');
      router.back();
    } catch {
      if (!alive.current) return;
      setSending(false);
      haptics.error();
      setFailure('Could not send the notification. Please try again.');
    }
  }, [title, message, priority, audience, selectedIds, toast, router]);

  const confirmAndSend = () => {
    if (!validate()) return;
    haptics.tap();
    const who = audience === 'all'
      ? 'everyone on the team'
      : `${selectedIds.length} ${selectedIds.length === 1 ? 'person' : 'people'}`;
    setFailure(null);
    setPendingConfirm(who);
  };

  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);

  /* Team members must not see this screen at all. The backend enforces the same rule with
     `authorize('admin','leader')`, so this is a courtesy, not the security boundary. */
  // Band 2 #8 (2026-08-25): `caps.manageTeam` is the tier gate (admin/master) that protects team
  // today; the RBAC `can_dispatch_notification` flag is ANDed so a seeded config can additionally
  // deny an admin. It denies ONLY on an explicit `false` and only once the config has settled
  // (uiReady), so an app-UI outage never wrongly locks an entitled admin out of dispatch.
  if (!caps.manageTeam || (uiReady && can('can_dispatch_notification') === false)) {
    return (
      <Screen>
        <Header title="Notify team" back />
        <EmptyState
          icon="lock-closed-outline"
          title="Admins only"
          subtitle="Sending notifications to the team is limited to admin and master accounts."
        />
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <Header title="Notify team" subtitle="Send an alert to your people" back />

      <KeyboardScroll contentStyle={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        {failure ? (
          <Banner tone="danger" title="Not sent" message={failure} onDismiss={() => setFailure(null)} />
        ) : null}

        <Appear>
          <Field
            label="Title"
            value={title}
            onChange={(v) => { setTitle(v); if (titleErr) setTitleErr(''); }}
            placeholder="Branch meeting moved to 4 PM"
            icon="megaphone-outline"
            maxLength={TITLE_MAX}
            error={titleErr || undefined}
            hint={`${title.length} of ${TITLE_MAX} characters`}
          />
        </Appear>

        <Appear index={1}>
          <Field
            label="Message"
            value={message}
            onChange={(v) => { setMessage(v); if (messageErr) setMessageErr(''); }}
            placeholder="Write what the team needs to know."
            icon="chatbox-ellipses-outline"
            multiline
            maxLength={MESSAGE_MAX}
            error={messageErr || undefined}
            hint={`${message.length} of ${MESSAGE_MAX} characters`}
          />
        </Appear>

        <Appear index={2}>
          <View style={{ gap: 8 }}>
            <Txt weight="700" size={13.5} color={c.muted}>Priority</Txt>
            <Segmented
              options={priorityOptions}
              value={priority}
              onChange={(v) => { haptics.select(); setPriority(v); }}
              full
            />
            {priority === 'high' ? (
              <Txt size={12} color={c.muted}>Urgent notifications are highlighted in red in the feed.</Txt>
            ) : null}
          </View>
        </Appear>

        <Appear index={3}>
          <View style={{ gap: 8 }}>
            <Txt weight="700" size={13.5} color={c.muted}>Send to</Txt>
            <Segmented
              options={audienceOptions}
              value={audience}
              onChange={(v) => {
                haptics.select();
                setAudience(v);
                setFailure(null);
                if (v === 'selected') void loadRoster();
              }}
              full
            />
          </View>
        </Appear>

        {audience === 'selected' ? (
          <Appear index={4}>
            <ListSection title={`Recipients (${selectedIds.length})`}>
              {selectedIds.length === 0 ? (
                <View style={{ paddingVertical: spacing.md }}>
                  <Txt size={13} color={c.muted}>Nobody chosen yet.</Txt>
                </View>
              ) : (
                <Row style={{ flexWrap: 'wrap', gap: 6, paddingVertical: spacing.sm }}>
                  {selectedIds.slice(0, 12).map((id) => {
                    const m = roster?.find((r) => r.id === id);
                    return <Pill key={id} label={m?.name || 'Member'} tone="primary" small />;
                  })}
                  {selectedIds.length > 12 ? (
                    <Pill label={`+${selectedIds.length - 12} more`} tone="neutral" small />
                  ) : null}
                </Row>
              )}
              <Button
                label={selectedIds.length ? 'Change recipients' : 'Choose recipients'}
                icon="people-outline"
                variant="secondary"
                onPress={() => { haptics.tap(); void loadRoster(); setPicking(true); }}
                full
              />
            </ListSection>
          </Appear>
        ) : null}

        <Appear index={5}>
          <Button
            label={sending ? 'Sending' : 'Send notification'}
            icon="paper-plane"
            onPress={confirmAndSend}
            loading={sending}
            size="lg"
            full
          />
        </Appear>
      </KeyboardScroll>

      {/* ---- recipient picker ---- */}
      <Sheet visible={picking} onClose={() => setPicking(false)} title="Choose recipients">
        <View style={{ gap: spacing.md }}>
          <SearchBar value={query} onChange={setQuery} placeholder="Search by name or role" />

          {roster === null ? (
            <View style={{ gap: spacing.sm }}>
              <SkeletonCard rows={2} />
              <SkeletonCard rows={2} />
            </View>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={query ? 'search-outline' : 'people-outline'}
              title={query ? `No match for "${query}"` : 'No team members loaded'}
              subtitle={query
                ? 'Try a different name or role.'
                : 'The roster could not be loaded from the server. Pull back and try again.'}
            />
          ) : (
            <View>
              {filtered.map((m, i) => {
                const on = !!selected[m.id];
                return (
                  <Appear key={m.id} index={i}>
                    <PersonRow
                      name={m.name}
                      subtitle={m.role.replace('_', ' ')}
                      onPress={() => {
                        haptics.select();
                        setSelected((prev) => {
                          const next = { ...prev };
                          if (next[m.id]) delete next[m.id];
                          else next[m.id] = true;
                          return next;
                        });
                      }}
                      right={
                        <Pill
                          label={on ? t('common.added') : t('common.add')}
                          tone={on ? 'success' : 'neutral'}
                          small
                          icon={on ? 'checkmark' : undefined}
                        />
                      }
                    />
                  </Appear>
                );
              })}
            </View>
          )}

          <Row style={{ gap: spacing.sm }}>
            <Button
              label={t('common.clear')}
              variant="ghost"
              onPress={() => { haptics.tap(); setSelected({}); }}
              style={{ flex: 1 }}
            />
            <Button
              label={`Done (${selectedIds.length})`}
              onPress={() => { haptics.tap(); setPicking(false); }}
              style={{ flex: 2 }}
            />
          </Row>
        </View>
      </Sheet>

      {/* ---- send confirmation ---- */}
      <Sheet visible={!!pendingConfirm} onClose={() => setPendingConfirm(null)} title="Send this notification?">
        <View style={{ gap: spacing.lg }}>
          <Txt size={14} color={c.muted}>
            This goes to {pendingConfirm} straight away. There is no way to unsend it.
          </Txt>
          <ListSection title="Preview">
            <View style={{ gap: 4, paddingVertical: spacing.sm }}>
              <Row style={{ gap: 8 }}>
                <Txt weight="800" size={15} style={{ flex: 1 }}>{title.trim() || 'Untitled'}</Txt>
                {priority === 'high' ? <Pill label={t('notify.prioUrgent')} tone="danger" small /> : null}
              </Row>
              <Txt size={13.5} color={c.muted}>{message.trim()}</Txt>
            </View>
          </ListSection>
          <Row style={{ gap: spacing.sm }}>
            <Button
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => { haptics.tap(); setPendingConfirm(null); }}
              style={{ flex: 1 }}
            />
            <Button
              label="Send now"
              icon="paper-plane"
              onPress={() => { setPendingConfirm(null); void send(); }}
              style={{ flex: 2 }}
            />
          </Row>
        </View>
      </Sheet>
    </Screen>
  );
}
