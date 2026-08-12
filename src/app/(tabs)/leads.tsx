import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Eyebrow, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import { Button, Chips, Fab, Field, SearchBar } from '@/ui/controls';
import { Banner, EmptyState, Meter, Skeleton, useToast } from '@/ui/feedback';
import { DataRow, ListSection, Pill } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { Sheet } from '@/ui/sheet';
import { SwipeRow } from '@/ui/swipe';
import type { SwipeAction } from '@/ui/swipe';
import { Appear, useCountUp } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import { useData } from '@/hooks/useData';
import * as api from '@/data/api';
import type { Lead, LeadStage } from '@/data/types';
import { STAGE_META } from '@/data/labels';
import { inr, inrShort, timeAgo } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * The lead pipeline.
 *
 * A pipeline is not a list of people, it is a list of people AT A POSITION. So the screen
 * is built around one question: what is open, and what has stalled where? The stage chips
 * carry live counts, the meter says how much of the open book has actually been spoken to,
 * and every reversible step can be taken with a thumb.
 *
 * WHY THE ROW SURFACE IS ONE SHEET, not a stack of cards. A card per lead turns 200 leads
 * into 200 floating objects and the eye re-acquires the left edge on every row. Rows here
 * sit on one continuous `c.card` surface separated by hairlines — ListSection's shape,
 * rebuilt on a FlatList because this list must stay virtualised.
 *
 * WHY A ROW IS A PersonRow AND NOT A DataRow. A DataRow is label/value, and a lead is not a
 * value: it is a person, a position and an amount read together. PersonRow carries the
 * avatar the eye recognises before it reads the name, which is what makes a roster
 * scannable at arm's length. DataRow does the label/value work it is good at inside the
 * sheets, where the pipeline breakdown genuinely is a column of figures.
 *
 * WHY A STAGE CHANGE IS CHECKED AGAINST THE SERVER'S REPLY. `api.setLeadStage` resolves to the
 * lead as the server holds it after the update, or to `null` when nothing landed. A write that
 * cannot be confirmed is rolled back on screen and reported, rather than left looking saved.
 * Until Phase 4 this took a second request, because the write resolved `void` either way.
 *
 * WHY "WON" IS NOT A ONE-SWIPE MOVE. Every other step in the funnel is reversible with a
 * second swipe; closing a lead is the one that leaves the open book and takes money out of
 * the forecast. It goes through a confirmation sheet for exactly the reason the detail
 * screen routes it through the stage picker: nobody wants to close a sale with a stray
 * thumb while walking.
 * ------------------------------------------------------------------ */

type StageFilter = 'all' | LeadStage;

/** A screen-specific failure worth keeping on screen. The app-wide HealthBanner covers outages. */
type Notice = { title: string; message: string };

/** The server's own enum order (`contracts/enums.md:212`), which is also the funnel order. */
const STAGE_ORDER: LeadStage[] = ['new_lead', 'meeting_scheduled', 'docs_shared', 'policy_issued', 'lost'];

/** One step forward through the funnel. Closed stages are terminal. */
const NEXT_STAGE: Partial<Record<LeadStage, LeadStage>> = {
  new_lead: 'meeting_scheduled',
  meeting_scheduled: 'docs_shared',
  docs_shared: 'policy_issued',
};

const isOpen = (s: LeadStage) => s !== 'policy_issued' && s !== 'lost';

/** Avatar (44) + its 12pt gap + the row's 16pt gutter. */
const SEP_INSET = spacing.lg + 44 + spacing.md;

/**
 * Commit a stage. Resolves to the server's own copy of the lead — the document `PUT` returns
 * after the update — or null when the change could not be confirmed.
 */
async function commitStage(id: string, stage: LeadStage): Promise<Lead | null> {
  const saved = await api.setLeadStage(id, stage);
  return saved && saved.stage === stage ? saved : null;
}

export default function Leads() {
  const c = useTheme();
  const router = useRouter();
  const toast = useToast();
  const health = useDataHealth();
  const { data, loading, refreshing, refresh } = useData(api.getLeads);

  // Mirrored into local state so an optimistic stage change can be applied and rolled back.
  // A refresh replaces the whole array, so the server always has the last word.
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<StageFilter>('all');
  const [q, setQ] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [pipeOpen, setPipeOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // The close-out confirmation keeps its subject AFTER the sheet is told to close, because
  // Sheet plays its exit animation before it unmounts. Nulling the lead on close would
  // blank the sheet's own copy mid-slide.
  const [wonTarget, setWonTarget] = useState<Lead | null>(null);
  const [wonOpen, setWonOpen] = useState(false);

  /**
   * Guards every setState that follows an await. A stage commit is a network round trip; the
   * tab can be swapped, or the app backgrounded, long before it resolves.
   * Set true on mount as well as cleared on unmount, so a remount never inherits `false`.
   */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => { if (data) setLeads(data); }, [data]);

  /* ---------- derived pipeline shape ---------- */
  const byStage = useMemo(() => {
    const m: Record<LeadStage, { count: number; value: number }> = {
      new_lead: { count: 0, value: 0 },
      meeting_scheduled: { count: 0, value: 0 },
      docs_shared: { count: 0, value: 0 },
      policy_issued: { count: 0, value: 0 },
      lost: { count: 0, value: 0 },
    };
    leads.forEach((l) => {
      const b = m[l.stage];
      if (!b) return;
      b.count += 1;
      b.value += Number.isFinite(l.potential) ? l.potential : 0;
    });
    return m;
  }, [leads]);

  const openCount = leads.reduce((n, l) => (isOpen(l.stage) ? n + 1 : n), 0);
  const engagedCount = leads.reduce((n, l) => (isOpen(l.stage) && l.stage !== 'new_lead' ? n + 1 : n), 0);
  const openValue = leads.reduce((s, l) => (isOpen(l.stage) && Number.isFinite(l.potential) ? s + l.potential : s), 0);
  const wonCount = byStage.policy_issued.count;
  const closedCount = wonCount + byStage.lost.count;

  // The change is the information here: closing a lead moves money out of the open book.
  const openValueDisplay = useCountUp(openValue);

  // Counts are withheld until the fetch lands: a row of zeroes reads as data, and there is
  // no data yet.
  const options = useMemo(() => ([
    { key: 'all' as StageFilter, label: 'All', count: loading ? undefined : leads.length },
    ...STAGE_ORDER.map((s) => ({
      key: s as StageFilter,
      label: STAGE_META[s].label,
      count: loading ? undefined : byStage[s].count,
    })),
  ]), [loading, leads.length, byStage]);

  const query = q.trim().toLowerCase();
  const shown = useMemo(() => leads.filter((l) => {
    if (filter !== 'all' && l.stage !== filter) return false;
    if (!query) return true;
    return l.name.toLowerCase().includes(query)
      || (l.interest || '').toLowerCase().includes(query)
      || (l.city || '').toLowerCase().includes(query)
      || (l.phone || '').includes(query);
  }), [leads, filter, query]);

  /* ---------- stage advance ---------- */
  const advance = useCallback(async (lead: Lead) => {
    const next = NEXT_STAGE[lead.stage];
    if (!next || busyId) return;
    const from = lead.stage;

    haptics.tap();
    setNotice(null);
    setBusyId(lead.id);
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage: next } : l)));

    const confirmed = await commitStage(lead.id, next);
    // A round trip has gone by. If the screen is gone there is nobody to report to,
    // and setting state here is the classic unmounted-screen leak.
    if (!alive.current) return;
    setBusyId(null);

    if (confirmed) {
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? confirmed : l)));
      haptics.success();
      toast(`${lead.name} moved to ${STAGE_META[next].label}`, 'success');
      return;
    }

    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage: from } : l)));
    haptics.error();
    setNotice({
      title: 'That move was not saved',
      message: `${lead.name} could not be moved to ${STAGE_META[next].label}. The server did not confirm the change, so the lead is still at ${STAGE_META[from].label}.`,
    });
  }, [busyId, toast]);

  /** Reversible steps go straight through; closing out asks first. */
  const requestAdvance = useCallback((lead: Lead) => {
    if (NEXT_STAGE[lead.stage] === 'policy_issued') {
      setWonTarget(lead);
      setWonOpen(true);
      return;
    }
    void advance(lead);
  }, [advance]);

  const confirmWon = useCallback(() => {
    setWonOpen(false);
    if (wonTarget) void advance(wonTarget);
  }, [advance, wonTarget]);

  const onAdded = useCallback((lead: Lead, confirmed: boolean, reason?: api.WriteFailure) => {
    refresh();
    if (confirmed) {
      haptics.success();
      toast(`${lead.name} added to your pipeline`, 'success');
      return;
    }
    haptics.warn();
    // The two failures need opposite copy, which is why the reason is passed up. A dropped
    // connection means "we are holding it, try again"; a refusal means "this lead does not
    // exist and nothing is holding it" — telling that user to pull to refresh would send them
    // looking for a record that was never created and can never be.
    const held = reason === 'network' || reason === 'server';
    setNotice(held ? {
      title: 'That lead is not on the server yet',
      message: `${lead.name} was captured on this device, but the server did not confirm it. Pull to refresh and check before adding this lead again.`,
    } : {
      title: 'That lead was not added',
      message: reason === 'forbidden'
        ? `The server refused to create ${lead.name}: this account does not have access to Leads. Nothing was saved, on this device or on the server.`
        : `The server has nowhere to create ${lead.name} — it answered that the leads endpoint is not there. Nothing was saved, on this device or on the server.`,
    });
  }, [refresh, toast]);

  const pickStage = useCallback((s: StageFilter) => {
    haptics.select();
    setFilter(s);
  }, []);

  /* ---------- empty ----------
   * Four genuinely different outcomes, and they must not look alike. "No match for this
   * search" and "nothing here yet" ask the user for opposite things, and an outage asks for
   * something different again. The ORDER matters: an empty book is reported as an empty
   * book even while a stage chip is active, because "nothing at Docs shared right now"
   * implies there is something at the other stages. */
  const emptyKind = query ? 'search'
    : leads.length === 0 && health.degraded ? 'outage'
      : leads.length === 0 ? 'none'
        : filter !== 'all' ? 'filter'
          : 'none';

  const empty = (
    <EmptyState
      icon={
        emptyKind === 'search' ? 'search-outline'
          : emptyKind === 'filter' ? 'funnel-outline'
            : emptyKind === 'outage' ? 'cloud-offline-outline'
              : 'people-outline'
      }
      title={
        emptyKind === 'search' ? `No lead matches "${q.trim()}"`
          : emptyKind === 'filter' ? `Nothing at ${filter === 'all' ? 'this stage' : STAGE_META[filter].label} right now`
            : emptyKind === 'outage' ? 'Your pipeline could not load'
              : 'No leads in your pipeline yet'
      }
      subtitle={
        emptyKind === 'search' ? 'Search runs over name, interest, city and mobile number.'
          : emptyKind === 'filter' ? 'Every other stage is still there. Switch the filter to see the rest of the pipeline.'
            : emptyKind === 'outage' ? 'The server did not answer, so nothing here is confirmed. Check your connection and pull to refresh.'
              : 'Add the first one and it will sit at the New stage until you move it forward.'
      }
      action={
        emptyKind === 'search' ? { label: 'Clear search', onPress: () => setQ('') }
          : emptyKind === 'filter' ? { label: 'Show all stages', onPress: () => pickStage('all') }
            : emptyKind === 'outage' ? { label: 'Try again', onPress: refresh }
              : { label: 'Add a lead', onPress: () => setAddOpen(true) }
      }
    />
  );

  return (
    <Screen>
      <Header
        title="Leads"
        subtitle={loading ? 'Loading your pipeline' : `${leads.length} leads, ${openCount} still open`}
        right={!loading && openValue > 0 ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Metric value={inrShort(openValueDisplay)} size={font.h3} />
            <Eyebrow>Open pipeline</Eyebrow>
          </View>
        ) : undefined}
      />

      <View style={{ paddingBottom: spacing.md, gap: spacing.md }}>
        <View style={{ paddingHorizontal: spacing.lg }}>
          {/* Not debounced, deliberately: this filters an array already in memory (the
              endpoint returns the whole pipeline in one call), so a timer would only add
              latency to a keystroke that costs nothing. */}
          <SearchBar value={q} onChange={setQ} placeholder="Name, interest, city or mobile" />
        </View>

        {/* Bleeds to both edges so the strip reads as scrollable. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        >
          <Chips
            options={options}
            value={filter}
            onChange={pickStage}
            style={{ flexWrap: 'nowrap' }}
          />
        </ScrollView>

        {!loading && openCount > 0 ? (
          <Row style={{ paddingHorizontal: spacing.lg }}>
            <Meter
              // PHASE 4: was "Past first contact". The server's enum has no "contacted" step —
              // the first move out of New is a booked meeting — so the old label described a
              // milestone the pipeline can no longer record, and read as an accusation on any
              // day of calls that produced no meetings.
              label="Meeting booked or further"
              value={engagedCount / openCount}
              valueLabel={`${engagedCount} of ${openCount}`}
              tone={engagedCount === 0 ? 'warning' : 'primary'}
              style={{ flex: 1 }}
            />
            <Button
              label="By stage"
              variant="ghost"
              size="sm"
              iconRight="chevron-forward"
              onPress={() => setPipeOpen(true)}
            />
          </Row>
        ) : null}

        {notice ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Banner
              tone="warning"
              title={notice.title}
              message={notice.message}
              onDismiss={() => setNotice(null)}
              action={{ label: 'Refresh', onPress: () => { setNotice(null); refresh(); } }}
            />
          </View>
        ) : null}
      </View>

      {loading ? (
        <PipelineSkeleton />
      ) : (
        <FlatList<Lead>
          data={shown}
          // Keyed on identity alone. Folding the index into the key remounts every row
          // below a filter change, which throws away each SwipeRow's open state and
          // replays the entrance animation on rows that never moved.
          keyExtractor={(l) => l.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 108 }}
          extraData={busyId}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={c.primary}
              colors={[c.primary]}
              progressBackgroundColor={c.card}
            />
          }
          ListHeaderComponent={shown.length > 0 ? <Hairline top /> : null}
          ItemSeparatorComponent={RowSeparator}
          ListEmptyComponent={empty}
          ListFooterComponent={shown.length > 0 ? <ListFooter count={shown.length} /> : null}
          renderItem={({ item, index }) => (
            <Appear index={index}>
              <LeadRow
                lead={item}
                busy={busyId === item.id}
                onOpen={() => router.push(`/lead/${item.id}`)}
                onAdvance={() => requestAdvance(item)}
              />
            </Appear>
          )}
        />
      )}

      <Fab icon="add" label="Add lead" onPress={() => setAddOpen(true)} />

      <PipelineSheet
        visible={pipeOpen}
        onClose={() => setPipeOpen(false)}
        byStage={byStage}
        openCount={openCount}
        openValue={openValue}
        wonCount={wonCount}
        closedCount={closedCount}
        onPickStage={(s) => { pickStage(s); setPipeOpen(false); }}
      />

      <CloseOutSheet
        visible={wonOpen}
        lead={wonTarget}
        onClose={() => setWonOpen(false)}
        onConfirm={confirmWon}
      />

      <AddLeadSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={onAdded}
      />
    </Screen>
  );
}

/* ================================================================== *
 * Row
 * ================================================================== */

function LeadRow({ lead, busy, onOpen, onAdvance }: {
  lead: Lead; busy: boolean; onOpen: () => void; onAdvance: () => void;
}) {
  const c = useTheme();
  const t = useT();
  const st = STAGE_META[lead.stage];
  const next = NEXT_STAGE[lead.stage];

  const fact = lead.interest || lead.city || lead.phone || 'No interest recorded';
  const subtitle = lead.lastActivity ? `${fact} · ${timeAgo(lead.lastActivity)}` : fact;
  const subtitleIcon = lead.interest ? 'pricetag-outline' : lead.city ? 'location-outline' : 'call-outline';

  // Two actions maximum, and SwipeRow ignores anything past that. Ranked by what the thumb
  // most likely meant: move it on, then reach the person.
  const actions: SwipeAction[] = [];
  if (next) {
    actions.push({
      icon: next === 'policy_issued' ? 'trophy' : 'arrow-forward',
      // "Close as won" rather than "Mark won": this one opens a confirmation, and a label
      // promising an immediate write would misdescribe what the swipe does.
      label: next === 'policy_issued' ? 'Close as won' : `To ${STAGE_META[next].label}`,
      tone: next === 'policy_issued' ? 'success' : 'primary',
      onPress: onAdvance,
    });
  }
  if (lead.phone) {
    actions.push({
      icon: 'logo-whatsapp',
      label: t('common.whatsapp'),
      tone: 'whatsapp',
      onPress: () => { haptics.tap(); whatsapp(lead.phone, `Namaste ${lead.name}`); },
    });
  }
  if (actions.length < 2 && lead.phone) {
    actions.unshift({
      icon: 'call',
      label: t('common.call'),
      tone: 'primary',
      onPress: () => { haptics.tap(); call(lead.phone); },
    });
  }

  return (
    <SwipeRow actions={actions} onPress={onOpen} disabled={busy} radius={0} surface={c.card}>
      <PersonRow
        name={lead.name}
        subtitle={subtitle}
        subtitleIcon={subtitleIcon}
        subtitleNumeric
        badge={lead.priority === 'hot' ? { tone: 'danger', icon: 'flame' } : undefined}
        style={{
          marginHorizontal: 0, paddingHorizontal: spacing.lg, borderRadius: 0,
          opacity: busy ? 0.55 : 1,
        }}
        right={
          <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: 118 }}>
            {lead.potential > 0 ? <Metric value={inrShort(lead.potential)} size={font.sub} /> : null}
            <Pill label={st.label} tone={st.tone} small />
          </View>
        }
      />
    </SwipeRow>
  );
}

/* ---------- list furniture ---------- */

function Hairline({ top }: { top?: boolean }) {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: top ? c.border : c.hairline }} />;
}

function RowSeparator() {
  const c = useTheme();
  return (
    <View style={{ backgroundColor: c.card }}>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: SEP_INSET }} />
    </View>
  );
}

function ListFooter({ count }: { count: number }) {
  const c = useTheme();
  return (
    <View style={{
      backgroundColor: c.card, paddingVertical: spacing.md, alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    }}>
      <Txt size={font.cap} color={c.faint} numeric>
        {count === 1 ? '1 lead' : `${count} leads`}. Swipe a row to move it on.
      </Txt>
    </View>
  );
}

/* ================================================================== *
 * Pipeline breakdown
 * ================================================================== */

function PipelineSheet({
  visible, onClose, byStage, openCount, openValue, wonCount, closedCount, onPickStage,
}: {
  visible: boolean;
  onClose: () => void;
  byStage: Record<LeadStage, { count: number; value: number }>;
  openCount: number;
  openValue: number;
  wonCount: number;
  closedCount: number;
  onPickStage: (s: StageFilter) => void;
}) {
  const c = useTheme();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Pipeline by stage"
      subtitle={openCount > 0
        ? `${openCount} open, ${inrShort(openValue)} in play`
        : 'Nothing open right now'}
    >
      <View style={{ gap: spacing.xl, paddingTop: spacing.xs }}>
        {closedCount > 0 ? (
          <Meter
            label="Policy issued, out of every lead you have closed"
            value={wonCount / closedCount}
            valueLabel={`${wonCount} of ${closedCount}`}
            tone="success"
          />
        ) : (
          <Txt size={font.sub} color={c.muted}>
            No lead has been closed yet, so there is no win rate to show.
          </Txt>
        )}

        <ListSection title="Stages" footer="Tap a stage to filter the list behind this sheet.">
          {STAGE_ORDER.map((s) => {
            const b = byStage[s];
            const meta = STAGE_META[s];
            return (
              <DataRow
                key={s}
                label={meta.label}
                value={b.count === 0 ? 'None' : b.value > 0 ? inrShort(b.value) : `${b.count}`}
                onPress={() => onPickStage(s)}
                right={b.count > 0 ? <Pill label={String(b.count)} tone={meta.tone} small numeric /> : undefined}
              />
            );
          })}
        </ListSection>
      </View>
    </Sheet>
  );
}

/* ================================================================== *
 * Close out — the one stage move that asks first
 * ================================================================== */

function CloseOutSheet({ visible, lead, onClose, onConfirm }: {
  visible: boolean;
  /** Held past `visible` going false, so the exit animation still has copy to render. */
  lead: Lead | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const c = useTheme();
  if (!lead) return null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Close this lead as won?"
      // "swiped straight back" was never true — a swipe only ever moves a lead FORWARD one step
      // (NEXT_STAGE has no reverse), and the stage picker on the detail screen is the only way
      // back. Telling someone a move is reversible by swipe sends them to swipe again, which
      // advances it further.
      subtitle={`${lead.name} leaves the open pipeline. Any stage can still be set again from the lead's own screen.`}
      footer={
        <Row>
          <Button label="Not yet" variant="outline" style={{ flex: 1 }} onPress={onClose} />
          <Button label="Close as won" icon="trophy" style={{ flex: 1.4 }} onPress={onConfirm} />
        </Row>
      }
    >
      <View style={{ gap: spacing.md, paddingTop: spacing.xs }}>
        <ListSection title="What moves">
          <DataRow label="Lead" value={lead.name} icon="person-outline" />
          <DataRow label="From" value={STAGE_META[lead.stage].label} icon="flag-outline" />
          <DataRow label="To" value={STAGE_META.policy_issued.label} tone="success" icon="trophy-outline" />
          {lead.potential > 0 ? (
            <DataRow label="Premium potential" value={inr(lead.potential)} icon="cash-outline" numeric />
          ) : null}
        </ListSection>

        <Txt size={font.cap} color={c.faint} style={{ textAlign: 'center' }}>
          The change is only confirmed once the server sends the updated lead back.
        </Txt>
      </View>
    </Sheet>
  );
}

/* ================================================================== *
 * Add lead
 * ================================================================== */

function AddLeadSheet({ visible, onClose, onAdded }: {
  visible: boolean;
  onClose: () => void;
  onAdded: (lead: Lead, confirmed: boolean, reason?: api.WriteFailure) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [interest, setInterest] = useState('');
  const [potential, setPotential] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The server's own refusal sentence (HTTP 400). Kept apart from `error`, which belongs to
   *  the one check this sheet makes for itself, so neither is shown under the wrong field. */
  const [refused, setRefused] = useState<string | null>(null);

  // Same contract as the screen: the POST outlives a thumb on the tab bar, and this component
  // is unmounted along with the tab.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const reset = () => {
    setName(''); setPhone(''); setInterest(''); setPotential(''); setCity('');
    setError(null); setRefused(null);
  };

  const close = () => { if (!saving) { reset(); onClose(); } };

  const save = async () => {
    if (saving) return;
    if (!name.trim()) {
      haptics.warn();
      setError('A name is the one thing a lead cannot be without.');
      return;
    }
    haptics.tap();
    setError(null);
    setRefused(null);
    setSaving(true);

    // `priority` is not passed any more. It was a hardcoded 'warm' this sheet never asked the
    // user for, the server has no such field, and the value it derives priority from
    // (`probability`) has its own default. Sending it was inventing data.
    const result = await api.addLead({
      name: name.trim(),
      phone: phone.trim(),
      interest: interest.trim(),
      city: city.trim(),
      potential: Number(potential.replace(/[^\d]/g, '')) || 0,
    });
    if (!alive.current) return;
    setSaving(false);

    if (!result.ok) {
      // A refusal keeps the sheet open with the server's own sentence under the form. The lead
      // does not exist and re-typing is the only way forward, so closing the sheet — or holding
      // the record locally as if it were captured — would both be lies. `phone` is the usual
      // cause: it is required and validated server-side.
      if (result.reason === 'invalid') {
        haptics.warn();
        setRefused(result.message);
        return;
      }
      reset();
      onClose();
      onAdded(result.lead, false, result.reason);
      return;
    }

    reset();
    onClose();
    onAdded(result.lead, true);
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="New lead"
      subtitle="It starts at the New stage. You can move it on straight away."
      footer={
        <Button
          label={saving ? 'Saving' : 'Add lead'}
          icon="checkmark"
          size="lg"
          full
          loading={saving}
          onPress={save}
        />
      }
    >
      <View style={{ gap: spacing.md, paddingTop: spacing.xs }}>
        {refused ? (
          <Banner
            tone="danger"
            title="The server did not accept this lead"
            message={refused}
            onDismiss={() => setRefused(null)}
          />
        ) : null}
        <Field
          label="Name"
          value={name}
          onChange={(v) => { setName(v); if (error) setError(null); if (refused) setRefused(null); }}
          placeholder="Who is this lead?"
          error={error ?? undefined}
        />
        <Field
          label="Mobile number"
          value={phone}
          onChange={(v) => { setPhone(v); if (refused) setRefused(null); }}
          placeholder="10 digit mobile"
          keyboardType="phone-pad"
          icon="call-outline"
          hint="Needed for the call and WhatsApp actions on the row — and the server requires it."
        />
        <Field
          label="Interested in"
          value={interest}
          onChange={setInterest}
          placeholder="Plan or need"
          icon="pricetag-outline"
        />
        <Field
          label="Premium potential"
          value={potential}
          onChange={setPotential}
          placeholder="Annual premium in rupees"
          keyboardType="numeric"
          icon="cash-outline"
        />
        <Field
          label="City"
          value={city}
          onChange={setCity}
          placeholder="Where are they based?"
          icon="location-outline"
        />
      </View>
    </Sheet>
  );
}

/* ================================================================== *
 * Loading — shaped like the rows it replaces, not a centred spinner
 * ================================================================== */

function SkeletonRow() {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, minHeight: 64,
    }}>
      <Skeleton width={44} height={44} radius={44 / 2.6} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Skeleton width="54%" height={13} />
        <Skeleton width="40%" height={11} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Skeleton width={50} height={13} />
        <Skeleton width={64} height={18} radius={radius.pill} />
      </View>
    </View>
  );
}

function PipelineSkeleton() {
  const c = useTheme();
  return (
    <View style={{ backgroundColor: c.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
      {Array.from({ length: 7 }, (_, i) => (
        <View key={i}>
          {i > 0 ? (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: SEP_INSET }} />
          ) : null}
          <SkeletonRow />
        </View>
      ))}
    </View>
  );
}
