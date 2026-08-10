import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import { Button, IconBtn } from '@/ui/controls';
import { Banner, EmptyState, Meter, Skeleton, SkeletonText, useToast } from '@/ui/feedback';
import { DataRow, ListSection, Pill } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { Sheet } from '@/ui/sheet';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import * as api from '@/data/api';
import type { Lead, LeadNote, LeadStage } from '@/data/types';
import { PRIORITY_TONE, STAGE_META } from '@/data/labels';
import { fmtDate, inr, inrShort, timeAgo } from '@/lib/format';
import { call, sms, whatsapp } from '@/lib/actions';

/* ------------------------------------------------------------------ *
 * One lead, and the single decision that matters about it: where it sits.
 *
 * STAGE PROGRESSION IS THE PRIMARY ACTION, so it owns the pinned bar in the thumb arc and
 * never scrolls away. The one-tap button only ever moves the lead ONE step, and only while
 * that step is reversible; closing a lead (won or lost) always goes through the picker
 * sheet, because "Won" is the one change nobody wants to make with a stray thumb.
 *
 * A STAGE CHANGE IS READ BACK BEFORE IT IS BELIEVED. `api.setLeadStage` resolves the same
 * way whether the server accepted the write or quietly fell back to the in-memory buffer,
 * so the record is fetched again and compared. An unconfirmed change is rolled back on
 * screen and reported inline, rather than left looking saved.
 *
 * EVERY ASYNC PATH HERE IS CANCELLABLE. The load runs on focus (so it re-runs each time the
 * screen comes back) and the commit is two sequential round trips. Both can outlive the
 * screen: the focus effect cancels via its own cleanup, and the commit checks a mount flag
 * before it touches state.
 * ------------------------------------------------------------------ */

/** The funnel, in order. `closed_lost` sits outside it: it is an exit, not a step. */
const FLOW: LeadStage[] = ['new', 'contacted', 'meeting', 'proposal', 'closed_won'];

const NEXT_STAGE: Partial<Record<LeadStage, LeadStage>> = {
  new: 'contacted',
  contacted: 'meeting',
  meeting: 'proposal',
  proposal: 'closed_won',
};

const PRIORITY_LABEL: Record<Lead['priority'], string> = {
  hot: 'Hot lead',
  warm: 'Warm lead',
  cold: 'Cold lead',
};

/** `fmtDate` returns an em dash for an unparseable date, and the UI does not show those. */
function dateOr(iso?: string): string | null {
  if (!iso) return null;
  const s = fmtDate(iso);
  return !s || s === '—' ? null : s;
}

/**
 * Commit a stage and confirm it by reading the record back. Resolves to the server's own
 * copy of the lead, or null when the change could not be confirmed.
 */
async function commitStage(id: string, stage: LeadStage): Promise<Lead | null> {
  await api.setLeadStage(id, stage);
  const fresh = await api.getLead(id);
  return fresh && fresh.stage === stage ? fresh : null;
}

export default function LeadDetail() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const health = useDataHealth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * Mount flag for the commit path, which is not owned by an effect and so has no cleanup
   * of its own. Set true on mount as well as cleared on unmount, so a remount never
   * inherits `false` and silently stops updating.
   */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  /**
   * `isCancelled` lets the caller decide what "still wanted" means. The focus effect passes
   * its own flag so a fetch fired on the way in cannot land after the screen has blurred
   * and been re-focused; the retry button passes nothing and relies on the mount flag.
   */
  const load = useCallback(async (isCancelled?: () => boolean) => {
    const l = await api.getLead(String(id));
    if (!alive.current || isCancelled?.()) return;
    setLead(l ?? null);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => { cancelled = true; };
  }, [load]));

  const retry = useCallback(() => { setLoading(true); void load(); }, [load]);

  const move = useCallback(async (stage: LeadStage) => {
    if (!lead || saving || stage === lead.stage) return;
    const from = lead.stage;

    haptics.tap();
    setNotice(null);
    setSaving(true);
    setLead({ ...lead, stage });                 // optimistic

    const confirmed = await commitStage(lead.id, stage);
    // A write plus a read-back. The user can have hit back twice by now.
    if (!alive.current) return;
    setSaving(false);

    if (confirmed) {
      setLead(confirmed);
      haptics.success();
      toast(`Moved to ${STAGE_META[stage].label}`, 'success');
      return;
    }

    setLead((cur) => (cur ? { ...cur, stage: from } : cur));
    haptics.error();
    setNotice(`The server did not confirm the move to ${STAGE_META[stage].label}, so this lead is still at ${STAGE_META[from].label}. Nothing was saved.`);
  }, [lead, saving, toast]);

  const openPicker = useCallback(() => { setPickerOpen(true); }, []);

  if (loading) return <LeadSkeleton />;

  if (!lead) {
    return (
      <Screen>
        <Header title="Lead" back />
        <EmptyState
          icon={health.degraded ? 'cloud-offline-outline' : 'person-circle-outline'}
          title={health.degraded ? 'This lead could not load' : 'Lead not found'}
          subtitle={health.degraded
            ? 'The server did not answer, so nothing here is confirmed. Check your connection and try again.'
            : 'This lead is no longer in the pipeline you can see. It may have been reassigned or removed.'}
          action={{ label: 'Try again', onPress: retry }}
        />
      </Screen>
    );
  }

  const st = STAGE_META[lead.stage];
  const next = NEXT_STAGE[lead.stage];
  const step = FLOW.indexOf(lead.stage);
  const lost = lead.stage === 'closed_lost';
  const won = lead.stage === 'closed_won';

  // adaptLead always produces an array, but this screen also renders the locally buffered
  // record written when a POST could not reach the server, so it stays defensive.
  const notes: LeadNote[] = lead.notes ?? [];

  const meta = [lead.city, lead.source].filter(Boolean).join(' · ');
  const added = dateOr(lead.createdAt);
  const dueDate = dateOr(lead.nextActionDate);

  // One tap moves one step, and only while that step is reversible. Closing out always
  // goes through the picker.
  const oneTap = next && next !== 'closed_won' ? next : null;
  const primaryLabel = saving ? 'Saving'
    : oneTap ? `Move to ${STAGE_META[oneTap].label}`
      : next === 'closed_won' ? 'Close this lead'
        : 'Change stage';

  return (
    <Screen>
      <Header
        title="Lead"
        back
        subtitle={lead.name}
        right={
          <IconBtn
            icon="options-outline"
            size={40}
            bg={c.cardAlt}
            color={c.muted}
            disabled={saving}
            onPress={openPicker}
            accessibilityLabel="Choose a different stage"
          />
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {notice ? (
          <Banner
            tone="danger"
            title="Stage was not changed"
            message={notice}
            action={{ label: 'Try again', onPress: openPicker }}
            onDismiss={() => setNotice(null)}
          />
        ) : null}

        {!lead.phone ? (
          <Banner
            tone="warning"
            title="No mobile number on this lead"
            message="Calls, WhatsApp and SMS all need a number on the record before they can be used."
          />
        ) : null}

        {/* Who this is, what they are worth, and where they sit. One card, because these
            three facts are read together in a single glance. */}
        <Appear index={0}>
          <Card>
            <PersonRow
              name={lead.name}
              subtitle={meta || 'No city or source recorded'}
              size={58}
              badge={lead.priority === 'hot' ? { tone: 'danger', icon: 'flame' } : undefined}
            />

            <Row style={{ gap: 6, marginTop: spacing.md, flexWrap: 'wrap' }}>
              <Pill label={st.label} tone={st.tone} dot />
              <Pill
                label={PRIORITY_LABEL[lead.priority]}
                tone={PRIORITY_TONE[lead.priority]}
                icon={lead.priority === 'hot' ? 'flame' : undefined}
              />
            </Row>

            <View style={{
              marginTop: spacing.lg, paddingTop: spacing.md,
              borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline,
            }}>
              {lead.potential > 0 ? (
                <>
                  <Eyebrow>Premium potential</Eyebrow>
                  <Metric value={inrShort(lead.potential)} size={font.display} style={{ marginTop: 2 }} />
                </>
              ) : (
                <Txt size={font.sub} color={c.muted}>
                  No premium potential recorded on this lead yet.
                </Txt>
              )}

              <Meter
                label={lost ? 'Closed as lost' : won ? 'Closed as won' : 'Pipeline progress'}
                value={lost ? 0 : step >= 0 ? (step + 1) / FLOW.length : 0}
                valueLabel={lost ? 'Not proceeding' : step >= 0 ? `${step + 1} of ${FLOW.length}` : st.label}
                tone={lost ? 'danger' : won ? 'success' : 'primary'}
                style={{ marginTop: spacing.lg }}
              />
              {!lost && !won && next ? (
                <Txt size={font.cap} color={c.faint} style={{ marginTop: spacing.sm }}>
                  {`Next step: ${STAGE_META[next].label}.`}
                </Txt>
              ) : null}
            </View>
          </Card>
        </Appear>

        <Appear index={1}>
          <ListSection title="Lead detail">
            <DataRow label="Interested in" value={lead.interest || 'Not recorded'} icon="pricetag-outline" />
            {lead.potential > 0 ? (
              <DataRow label="Premium potential" value={inr(lead.potential)} icon="cash-outline" numeric />
            ) : null}
            {lead.phone ? (
              <DataRow
                label="Mobile"
                value={lead.phone}
                icon="call-outline"
                numeric
                copyable
                // SMS lives next to the number it uses. The pinned bar is reserved for the
                // two actions an advisor repeats all day plus the stage move.
                right={
                  <IconBtn
                    icon="chatbubble-outline"
                    size={32}
                    bg={c.cardAlt}
                    color={c.muted}
                    onPress={() => { haptics.tap(); sms(lead.phone); }}
                    accessibilityLabel={`Send an SMS to ${lead.name}`}
                  />
                }
              />
            ) : null}
            {lead.city ? <DataRow label="City" value={lead.city} icon="location-outline" /> : null}
            {lead.source ? <DataRow label="Source" value={lead.source} icon="git-network-outline" /> : null}
          </ListSection>
        </Appear>

        <Appear index={2}>
          <ListSection
            title="Timeline"
            footer="Times come from the lead record itself, so they move whenever the record does."
          >
            {added ? <DataRow label="Added" value={added} icon="calendar-outline" numeric /> : null}
            {lead.lastActivity ? (
              <DataRow label="Last activity" value={timeAgo(lead.lastActivity)} icon="time-outline" numeric />
            ) : null}
            {lead.nextAction ? (
              <DataRow label="Next action" value={lead.nextAction} icon="flag-outline" />
            ) : null}
            {dueDate ? <DataRow label="Action due" value={dueDate} icon="alarm-outline" numeric /> : null}
          </ListSection>
        </Appear>

        <Appear index={3}>
          <ListSection title={notes.length > 0 ? `Notes (${notes.length})` : 'Notes'}>
            {notes.length > 0
              ? notes.map((n) => <NoteRow key={n.id} text={n.text} at={n.at} />)
              : (
                <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.lg }}>
                  <Txt size={font.sub} color={c.muted} style={{ lineHeight: 20 }}>
                    No notes on this lead yet. Anything written against it on the panel shows up here.
                  </Txt>
                </View>
              )}
          </ListSection>
        </Appear>
      </ScrollView>

      {/* Pinned: the two contact actions, then the stage move. Never scrolls away. */}
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
          disabled={!lead.phone}
          onPress={() => { haptics.tap(); call(lead.phone); }}
          accessibilityLabel={`Call ${lead.name}`}
        />
        <IconBtn
          icon="logo-whatsapp"
          size={48}
          bg={c.whatsappSoft}
          color={c.whatsapp}
          disabled={!lead.phone}
          onPress={() => { haptics.tap(); whatsapp(lead.phone, `Namaste ${lead.name}`); }}
          accessibilityLabel={`Open WhatsApp chat with ${lead.name}`}
        />
        <Button
          label={primaryLabel}
          icon={oneTap ? 'arrow-forward' : 'flag'}
          full
          loading={saving}
          onPress={() => { if (oneTap) void move(oneTap); else openPicker(); }}
          style={{ flex: 1 }}
        />
      </View>

      <StageSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        current={lead.stage}
        recommended={next}
        onPick={(s) => { setPickerOpen(false); void move(s); }}
      />
    </Screen>
  );
}

/* ================================================================== *
 * Notes
 * ================================================================== */

function NoteRow({ text, at }: { text: string; at: string }) {
  const c = useTheme();
  const when = at ? timeAgo(at) : null;
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 5 }}>
      <Txt size={font.sub} style={{ lineHeight: 20 }}>{text}</Txt>
      {when ? <Txt size={font.tiny} color={c.faint} numeric>{when}</Txt> : null}
    </View>
  );
}

/* ================================================================== *
 * Stage picker
 * ================================================================== */

function StageSheet({ visible, onClose, current, recommended, onPick }: {
  visible: boolean;
  onClose: () => void;
  current: LeadStage;
  recommended?: LeadStage;
  onPick: (s: LeadStage) => void;
}) {
  const c = useTheme();
  const at = FLOW.indexOf(current);

  const pick = (s: LeadStage) => {
    if (s === current) return;
    haptics.select();
    onPick(s);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Move this lead"
      subtitle={`Currently at ${STAGE_META[current].label}`}
    >
      <View style={{ gap: spacing.lg, paddingTop: spacing.xs }}>
        <ListSection title="Pipeline">
          {FLOW.map((s, i) => {
            const isCurrent = s === current;
            const done = at >= 0 && i < at;
            return (
              <DataRow
                key={s}
                label={`Step ${i + 1}`}
                value={STAGE_META[s].label}
                onPress={isCurrent ? undefined : () => pick(s)}
                right={
                  isCurrent ? <Pill label="Current" tone="primary" small dot />
                    : s === recommended ? <Pill label="Next" tone="accent" small />
                      : done ? <Pill label="Passed" tone="neutral" small />
                        : undefined
                }
              />
            );
          })}
        </ListSection>

        <ListSection
          title="Close out"
          footer="A closed lead stays in the pipeline list under its own stage, so nothing is lost."
        >
          <DataRow
            label="Not proceeding"
            value={STAGE_META.closed_lost.label}
            tone="danger"
            onPress={current === 'closed_lost' ? undefined : () => pick('closed_lost')}
            right={current === 'closed_lost' ? <Pill label="Current" tone="danger" small dot /> : undefined}
          />
        </ListSection>

        <Txt size={font.cap} color={c.faint} style={{ textAlign: 'center' }}>
          The change is saved and then read back, so it is only confirmed once the server has it.
        </Txt>
      </View>
    </Sheet>
  );
}

/* ================================================================== *
 * Loading — the shape of the screen that is coming
 * ================================================================== */

function LeadSkeleton() {
  const c = useTheme();
  return (
    <Screen>
      <Header title="Lead" back />
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
            <Skeleton width={82} height={22} radius={radius.pill} />
            <Skeleton width={94} height={22} radius={radius.pill} />
          </View>
          <View style={{
            marginTop: spacing.lg, paddingTop: spacing.md, gap: spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline,
          }}>
            <Skeleton width={110} height={10} />
            <Skeleton width={162} height={28} />
            <Skeleton width="100%" height={10} radius={radius.pill} />
          </View>
        </Card>

        <Card>
          <SkeletonText lines={4} lineHeight={13} gap={spacing.xl} />
        </Card>

        <Card>
          <SkeletonText lines={3} lineHeight={13} gap={spacing.xl} />
        </Card>
      </View>
    </Screen>
  );
}
