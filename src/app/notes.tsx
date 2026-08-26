import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Eyebrow, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Button, Chips, Field, SearchBar } from '@/ui/controls';
import { Banner, EmptyState, Skeleton, useToast } from '@/ui/feedback';
import { Pill } from '@/ui/data';
import type { Tone } from '@/ui/data';
import { SwipeRow } from '@/ui/swipe';
import type { SwipeAction } from '@/ui/swipe';
import { Appear, useCountUp } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { usePendingWrites, useDropNotice, PendingBadge } from '@/ui/pending';
import { setDropNotice } from '@/data/pendingWrites';
import { useConfirm } from '@/ui/Confirm';
import { haptics } from '@/lib/haptics';
import { timeAgo } from '@/lib/format';
import { useT } from '@/i18n';
import { getHealth } from '@/data/health';
import * as api from '@/data/api';
import type { BoardNote, NotesPage } from '@/data/api';

/* ------------------------------------------------------------------ *
 * Notes — the private board. NOT the Notice Board.
 *
 * These two screens are one route apart and must never be mistaken for each other.
 * The Notice Board is the firm talking to you: read-only, grouped, formal. This is you
 * talking to yourself: a stack of jottings you can write, pin and throw away.
 *
 * MOST OF THIS BOARD IS DICTATED, NOT TYPED. Notes arrive as WhatsApp voice memos that
 * n8n transcribes, usually from Gujarati. Two consequences drive the design:
 *
 *   1. THE SOURCE IS PART OF THE RECORD. A voice note carries a mic glyph and a "Voice
 *      note" token, because "did I say this or type it?" is the first thing you ask when
 *      a line reads oddly.
 *   2. THE TRANSCRIPTION CAN BE WRONG. Where `transcript` differs from `text`, the row
 *      offers the original dictation. Hiding it would mean trusting a machine translation
 *      of a note whose whole purpose is to be trusted later.
 *
 * OWNERSHIP IS BY PHONE, NOT BY USER ID. The backend matches notes on the last ten digits
 * of the signed-in person's profile number and fails closed when there is none, returning
 * an empty board with `owner.phoneLast10` blank. An account with no number therefore has
 * no board AT ALL, which is a completely different fact from "you have not written
 * anything yet" and is said plainly instead. Writes would be refused in that state too, so
 * the composer is withheld rather than offered and then rejected.
 * ------------------------------------------------------------------ */

const PAGE = 25;

type CatMeta = { label: string; tone: Tone; icon: IconName };

const CATEGORY: Record<string, CatMeta> = {
  task: { label: 'Task', tone: 'primary', icon: 'checkbox-outline' },
  reminder: { label: 'Reminder', tone: 'warning', icon: 'alarm-outline' },
  note: { label: 'Note', tone: 'neutral', icon: 'document-text-outline' },
  idea: { label: 'Idea', tone: 'accent', icon: 'bulb-outline' },
  'follow-up': { label: 'Follow up', tone: 'info', icon: 'repeat-outline' },
};

/**
 * Order the composer offers. Matches the categories the backend accepts.
 * Typed as `string[]` deliberately: `as const` would infer `Chips<'note' | 'task' | ...>`
 * and then reject the plain `string` the draft state holds.
 */
const COMPOSE_CATS: string[] = ['note', 'task', 'reminder', 'follow-up', 'idea'];

function catMeta(key: string): CatMeta {
  return CATEGORY[key] ?? { label: key || 'Note', tone: 'neutral', icon: 'document-text-outline' };
}

const EMPTY_FACETS: NotesPage['facets'] = { categories: [], tags: [], statuses: [] };

/** Server order: pinned first, then most recently touched. Reapplied after local edits. */
function noteTime(n: BoardNote): number {
  const t = Date.parse(n.updatedAt || n.createdAt || '');
  return Number.isFinite(t) ? t : 0;
}
function sortNotes(rows: BoardNote[]): BoardNote[] {
  return rows.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || noteTime(b) - noteTime(a));
}

/** Facet counts after a local write, so the chips do not lag a note behind the list. */
function bumpFacet(rows: { label: string; value: number }[], label: string, by: number) {
  const hit = rows.some((r) => r.label === label);
  const next = hit
    ? rows.map((r) => (r.label === label ? { ...r, value: Math.max(0, r.value + by) } : r))
    : by > 0 ? [...rows, { label, value: by }] : rows;
  return next.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
}

export default function Notes() {
  const c = useTheme();
  const tr = useT(); // `t` is used as a setState accumulator below; translator is `tr`
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const health = useDataHealth();
  const { confirm } = useConfirm();

  const [items, setItems] = useState<BoardNote[]>([]);
  const [facets, setFacets] = useState<NotesPage['facets']>(EMPTY_FACETS);
  const [owner, setOwner] = useState<NotesPage['owner']>({ name: '', phoneLast10: '' });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /** Latched at the moment the fetch resolved, so "outage" cannot be confused with
   *  "no board" once another screen's request clears the global health flag. */
  const [loadFailed, setLoadFailed] = useState(false);

  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftCat, setDraftCat] = useState<string>('note');
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  // PHASE 57b — offline write queue. The pending note drafts (created offline, awaiting sync) and a
  // one-time "couldn't save" notice both come from the write-queue bus, so they survive an app kill
  // and update the moment a background flush lands.
  const pendingRaw = usePendingWrites('note');
  const dropNotice = useDropNotice();

  /** Leak guards: nothing lands on this screen once it is gone, and no superseded
   *  request may overwrite a newer one. */
  const live = useRef(true);
  const reqId = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);
  /** Distinguishes a keystroke (debounce) from a chip tap (fire straight away). */
  const prevQ = useRef('');

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      if (searchTimer.current) { clearTimeout(searchTimer.current); searchTimer.current = null; }
    };
  }, []);

  const load = useCallback(async (
    p: number, search: string, category: string, mode: 'replace' | 'append' | 'refresh',
  ) => {
    const my = ++reqId.current;
    if (mode === 'replace') setLoading(true);
    else if (mode === 'append') setLoadingMore(true);
    else setRefreshing(true);

    const res = await api.getNotes({ search: search || undefined, category, page: p, limit: PAGE });
    // `getNotes` resolves to the same empty shell whether the board is genuinely empty or
    // the request failed, so the failure is read straight after the await while it is still
    // the newest thing health knows about.
    const failed = getHealth().failures.includes('/notice-board');

    if (!live.current || my !== reqId.current) return;

    setItems((prev) => (mode === 'append' ? sortNotes([...prev, ...res.data]) : sortNotes(res.data)));
    setFacets(res.facets);
    setOwner(res.owner);
    setTotal(res.total);
    setTotalPages(res.totalPages);
    setPage(p);
    setLoadFailed(failed);
    setLoading(false); setLoadingMore(false); setRefreshing(false);
  }, []);

  useEffect(() => { load(1, '', 'all', 'replace'); }, [load]);

  // Search and category both re-query the server, but only TYPING is debounced: a chip is a
  // single deliberate tap and making it wait 400ms reads as a laggy control, while a query
  // fires a search per keystroke if it does not wait. The first pass is skipped so the mount
  // fetch above is not run twice. The timer lives in a ref and is cleared before each
  // retype and again on unmount.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; prevQ.current = q; return; }
    const typed = prevQ.current !== q;
    prevQ.current = q;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { load(1, q.trim(), cat, 'replace'); }, typed ? 400 : 0);
    return () => { if (searchTimer.current) { clearTimeout(searchTimer.current); searchTimer.current = null; } };
  }, [q, cat, load]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || refreshing) return;
    if (page >= totalPages) return;
    load(page + 1, q.trim(), cat, 'append');
  }, [loading, loadingMore, refreshing, page, totalPages, load, q, cat]);

  /* ---------- writes ---------- */

  const saveNote = useCallback(async () => {
    const text = draft.trim();
    if (!text) { haptics.warn(); return; }
    haptics.tap();
    setSaving(true);
    setWriteError(null);

    const res = await api.addNote(text, draftCat, []);
    if (!live.current) return;
    setSaving(false);

    // PHASE 57b: the server ANSWERED and refused it — nothing saved, nothing queued.
    if (res.status === 'failed') {
      haptics.error();
      setWriteError('That note was not saved. The server refused the write, so nothing has been added to your board.');
      return;
    }

    // PHASE 57b: the network was down, so the additive draft is queued to sync later. This is NOT a
    // success — the pending row renders from the write-queue bus, so no manual insert is needed.
    if (res.status === 'queued') {
      haptics.tap();   // a neutral acknowledgement, never the success buzz — it isn't on the server yet
      setDraft('');
      setComposing(false);
      toast("Saved on this device — it'll sync when you're back online.", 'offline');
      return;
    }

    // res.status === 'saved' — the server accepted it.
    const created = res.note;
    haptics.success();
    setDraft('');
    setComposing(false);
    setFacets((f) => ({
      ...f,
      categories: bumpFacet(f.categories, created.category, 1),
      statuses: bumpFacet(f.statuses, created.status || 'active', 1),
    }));

    // Only shown if it belongs in the current view. Filing it under a filter it does not
    // match would make it vanish, which reads as a failed save.
    const inView = cat === 'all' || created.category === cat;
    if (inView && !q.trim()) {
      setItems((prev) => sortNotes([created, ...prev.filter((n) => n.id !== created.id)]));
      setTotal((t) => t + 1);
      toast('Note saved to your board.', 'success');
    } else {
      toast(`Note saved under ${catMeta(created.category).label}.`, 'success');
    }
  }, [draft, draftCat, cat, q, toast]);

  const togglePin = useCallback(async (note: BoardNote) => {
    // No tap here: SwipeRow already buzzes when the action panel snaps open, so a second
    // impact on the same gesture is the buzzy, toy-like feel the haptics budget forbids.
    setWriteError(null);
    const updated = await api.updateNote(note.id, { pinned: !note.pinned });
    if (!live.current) return;
    if (!updated) {
      haptics.error();
      setWriteError('That note could not be changed. The server refused the write, so it is unchanged on your board.');
      return;
    }
    haptics.success();
    setItems((prev) => sortNotes(prev.map((n) => (n.id === updated.id ? updated : n))));
    toast(updated.pinned ? 'Note pinned to the top.' : 'Note unpinned.', 'success');
  }, [toast]);

  const removeNote = useCallback(async (note: BoardNote) => {
    const ok = await confirm({
      title: 'Delete this note?',
      message: 'It leaves your board for good. Nobody else can see it, and it cannot be brought back.',
      confirmText: tr('common.delete'),
      cancelText: 'Keep it',
      destructive: true,
      icon: 'trash-outline',
    });
    if (!ok || !live.current) return;

    haptics.tap();
    setWriteError(null);
    const done = await api.deleteNote(note.id);
    if (!live.current) return;

    if (!done) {
      haptics.error();
      setWriteError('That note was not deleted. The server refused the write, so it is still on your board.');
      return;
    }
    haptics.success();
    setItems((prev) => prev.filter((n) => n.id !== note.id));
    setTotal((t) => Math.max(0, t - 1));
    setFacets((f) => ({
      ...f,
      categories: bumpFacet(f.categories, note.category, -1),
      statuses: bumpFacet(f.statuses, note.status || 'active', -1),
    }));
    toast('Note deleted.', 'success');
  }, [confirm, toast, tr]);

  const toggleReveal = useCallback((id: string) => {
    haptics.select();
    setRevealed((r) => ({ ...r, [id]: !r[id] }));
  }, []);

  /* ---------- derived ---------- */

  const boardCount = useMemo(
    () => facets.statuses.find((s) => s.label === 'active')?.value ?? total,
    [facets.statuses, total],
  );
  // The board size is one of the few figures on this screen that CHANGES from the user's
  // own action, which is exactly what a count-up is for.
  const boardDisplay = useCountUp(boardCount);

  /** The latch, ORed with the live reactive signal for THIS endpoint only, so a later
   *  background failure updates the copy without a global flag ever misattributing
   *  another screen's outage to this board. */
  const outage = loadFailed || health.failures.includes('/notice-board');

  // PHASE 57b: offline drafts render on TOP of the board, but only when unfiltered — a filter/search
  // could hide a draft whose category doesn't match, which reads as a lost note. Temp ids never
  // collide with server ids, so no dedup is needed beyond guarding a (theoretical) repeat.
  const pendingNotes = useMemo(() => pendingRaw.map(api.noteDraftToBoardNote).reverse(), [pendingRaw]);
  const showPending = cat === 'all' && !q.trim();
  const listData = useMemo(() => {
    if (!showPending || pendingNotes.length === 0) return items;
    const pendingIds = new Set(pendingNotes.map((n) => n.id));
    return [...pendingNotes, ...items.filter((n) => !pendingIds.has(n.id))];
  }, [showPending, pendingNotes, items]);

  // When the queue SHRINKS, a flush synced or dropped a draft: pull the server copy so a synced note
  // swaps its temp id for the real one (a dropped draft simply disappears with the bus update).
  const prevPending = useRef(pendingRaw.length);
  useEffect(() => {
    if (pendingRaw.length < prevPending.current && !loading) {
      void load(1, q.trim(), cat, 'refresh');
    }
    prevPending.current = pendingRaw.length;
  }, [pendingRaw.length, loading, load, q, cat]);

  const chips = useMemo(() => ([
    { key: 'all', label: tr('common.all') },
    ...facets.categories.map((f) => ({ key: f.label, label: catMeta(f.label).label, count: f.value })),
  ]), [facets.categories, tr]);

  const searching = q.trim().length > 0;
  const filterActive = searching || cat !== 'all';
  const noBoard = !outage && !loading && owner.phoneLast10 === '';
  const showControls = !noBoard && !(outage && items.length === 0);
  // Withheld until the board has resolved. Mounting it earlier would let an account with
  // no phone start a draft that is then unmounted (and lost) the moment the empty board
  // comes back.
  // PHASE 57b: no longer withheld on an OUTAGE — an offline write is now QUEUED (not refused), so
  // the composer must stay available so a member can jot a note while the server is unreachable.
  // (`noBoard` is false during an outage anyway, since it requires a resolved `!outage` read.)
  const showComposer = !loading && !noBoard;

  const clearFilters = useCallback(() => {
    haptics.select();
    setQ('');
    setCat('all');
  }, []);

  const empty = noBoard ? (
    <EmptyState
      icon="call-outline"
      title="Your board needs your mobile number"
      subtitle="Notes are matched to the WhatsApp number they were dictated from, so your profile has to carry that number before a board can exist. Nothing is missing, there is simply no board yet."
      action={{ label: 'Open my profile', onPress: () => router.push('/profile') }}
    />
  ) : outage ? (
    <EmptyState
      icon="cloud-offline-outline"
      title="Your notes could not load"
      subtitle="The server did not answer, so this is not an empty board, it is an unanswered request. Check your connection and try again."
      action={{ label: tr('common.tryAgain'), onPress: () => load(1, q.trim(), cat, 'replace') }}
    />
  ) : searching ? (
    <EmptyState
      icon="search-outline"
      title={`No note matches "${q.trim()}"`}
      subtitle="Search looks through the note text, the original dictation and the tags."
      action={{ label: tr('common.clearSearch'), onPress: () => { haptics.select(); setQ(''); } }}
    />
  ) : cat !== 'all' ? (
    <EmptyState
      icon="funnel-outline"
      title={`Nothing filed under ${catMeta(cat).label}`}
      subtitle="Other categories on your board still have notes in them."
      action={{ label: 'Show all notes', onPress: clearFilters }}
    />
  ) : (
    <EmptyState
      icon="journal-outline"
      title="Nothing on your board yet"
      subtitle="Jot something below, or send a voice note to the CGPE WhatsApp number and it lands here transcribed."
      action={{ label: 'Jot a note', onPress: () => setComposing(true) }}
    />
  );

  return (
    <Screen keyboard>
      <Header
        title="Notes"
        subtitle="Private to you"
        back
        right={boardCount > 0 ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Metric value={String(boardDisplay)} size={font.h3} />
            <Eyebrow>On your board</Eyebrow>
          </View>
        ) : undefined}
      />

      {writeError ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          <Banner
            tone="danger"
            title="That change did not save"
            message={writeError}
            onDismiss={() => setWriteError(null)}
          />
        </View>
      ) : null}

      {/* PHASE 57b: a one-time notice when the server refused an offline draft on flush (a 4xx).
          The draft is already removed from the queue — this just makes the removal honest. */}
      {dropNotice ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          <Banner
            tone="warning"
            title="Some offline notes were not saved"
            message={dropNotice}
            onDismiss={() => setDropNotice(null)}
          />
        </View>
      ) : null}

      {showControls ? (
        <View style={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          gap: spacing.md,
          /* WHY THIS BLOCK IS ALLOWED TO SHRINK.
           *
           * The column here is Header, this block, the list, the composer. The list is the
           * only part that gives way when the keyboard opens, and on a tall handset that is
           * enough. On a 640pt Android (still common in the field) the IME takes ~280pt and
           * the three FIXED blocks want ~430pt of the ~390pt left, so the list hits zero and
           * the overflow lands on the LAST child: the composer's Save button, behind the
           * keyboard, on the one screen whose whole job is writing.
           *
           * flexShrink hands that deficit to the filters instead, which are the one thing on
           * screen that nobody is reading while they are dictating a note. It is inert
           * whenever the column fits, because flex shrink only engages once free space is
           * gone, so nothing moves on a normal phone. overflow is pinned rather than left to
           * the platform default, which is 'visible' on iOS and clipped on Android: the same
           * squeeze has to look the same on both. */
          flexShrink: 1,
          overflow: 'hidden',
        }}>
          <SearchBar
            value={q}
            onChange={setQ}
            placeholder="Search your notes and dictations"
          />
          {chips.length > 1 ? (
            <Chips
              options={chips}
              value={cat}
              onChange={(v) => { haptics.select(); setCat(v); }}
            />
          ) : null}
          {filterActive ? (
            <Row style={{ gap: spacing.sm }}>
              <Txt size={font.cap} color={c.faint} numeric numberOfLines={1} style={{ flex: 1 }}>
                {total === 1 ? '1 note matches' : `${total} notes match`}
              </Txt>
              <Button label={tr('common.clear')} variant="ghost" size="sm" onPress={clearFilters} />
            </Row>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <BoardSkeleton />
      ) : (
        <FlatList<BoardNote>
          data={listData}
          keyExtractor={(n) => n.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(1, q.trim(), cat, 'refresh')}
              tintColor={c.primary}
              colors={[c.primary]}
              progressBackgroundColor={c.card}
            />
          }
          ListHeaderComponent={listData.length > 0 ? <Hairline top /> : null}
          ItemSeparatorComponent={NoteSeparator}
          ListEmptyComponent={empty}
          ListFooterComponent={
            <BoardFooter
              count={listData.length}
              loadingMore={loadingMore}
              hasMore={page < totalPages}
              onLoadMore={loadMore}
            />
          }
          renderItem={({ item, index }) => (
            <Appear index={index}>
              <NoteCard
                note={item}
                revealed={!!revealed[item.id]}
                onToggleReveal={() => toggleReveal(item.id)}
                onPin={() => togglePin(item)}
                onDelete={() => removeNote(item)}
              />
            </Appear>
          )}
        />
      )}

      {showComposer ? (
        <Composer
          open={composing}
          draft={draft}
          category={draftCat}
          saving={saving}
          bottomInset={insets.bottom}
          onOpen={() => setComposing(true)}
          onCancel={() => { setComposing(false); setDraft(''); }}
          onChange={setDraft}
          onCategory={(v) => { haptics.select(); setDraftCat(v); }}
          onSave={saveNote}
        />
      ) : null}
    </Screen>
  );
}

/* ================================================================== *
 * A note
 * ================================================================== */

function NoteCard({ note, revealed, onToggleReveal, onPin, onDelete }: {
  note: BoardNote;
  revealed: boolean;
  onToggleReveal: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const c = useTheme();
  const tr = useT();
  const meta = catMeta(note.category);
  const isVoice = note.sourceType === 'voice';

  const text = (note.text || '').trim();
  const transcript = (note.transcript || '').trim();
  const body = text || transcript;
  const hasOriginal = !!transcript && transcript !== text;
  const when = note.updatedAt || note.createdAt;

  // Rows are clamped so the board stays scannable, so a long note needs a way out of the
  // clamp. One disclosure serves both jobs: it opens the full text AND the dictation it
  // came from, because on this board those are usually the same question.
  const long = body.length > 220;
  const expandable = hasOriginal || long;
  const discloseLabel = hasOriginal
    ? (revealed ? 'Hide original dictation' : 'Show original dictation')
    : (revealed ? 'Show less' : 'Show more');

  // PHASE 57b: a pending (offline-queued) draft isn't on the server yet, so pin/delete — both server
  // writes — don't apply. No swipe actions until it syncs.
  const actions: SwipeAction[] = note.pending ? [] : [
    {
      icon: note.pinned ? 'pin-outline' : 'pin',
      label: note.pinned ? 'Unpin' : 'Pin',
      tone: 'primary',
      onPress: onPin,
    },
    { icon: 'trash', label: tr('common.delete'), tone: 'danger', onPress: onDelete },
  ];

  return (
    <SwipeRow
      actions={actions}
      radius={0}
      surface={c.card}
      onPress={expandable ? onToggleReveal : undefined}
    >
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 }}>
        {note.pinned ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: c.primary }}
          />
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <View style={{
            width: 34, height: 34, borderRadius: 11,
            backgroundColor: isVoice ? c.accentSoft : c.cardAlt,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={isVoice ? 'mic' : 'create-outline'} size={17} color={isVoice ? c.accent : c.faint} />
          </View>

          <View style={{ flex: 1, gap: spacing.sm }}>
            {body ? (
              <Txt
                size={font.body}
                weight="500"
                numberOfLines={revealed ? undefined : 8}
                style={{ lineHeight: 21 }}
              >
                {body}
              </Txt>
            ) : (
              <Txt size={font.sub} color={c.faint}>No text was saved with this note.</Txt>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              {note.pending ? <PendingBadge /> : null}
              <Pill label={meta.label} tone={meta.tone} icon={meta.icon} small />
              {isVoice ? <Pill label="Voice note" tone="accent" icon="mic" small /> : null}
              {note.pinned ? <Pill label="Pinned" tone="primary" icon="pin" small /> : null}
              {note.tags.slice(0, 3).map((t, i) => (
                <Pill key={`${t}-${i}`} label={t} tone="neutral" small />
              ))}
              {when ? (
                <Txt size={font.tiny} color={c.faint} numeric>{timeAgo(when)}</Txt>
              ) : null}
            </View>

            {expandable ? (
              <Pressable
                onPress={onToggleReveal}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={discloseLabel}
                accessibilityState={{ expanded: revealed }}
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  alignSelf: 'flex-start', minHeight: 32, opacity: pressed ? 0.6 : 1,
                }]}
              >
                <Ionicons name={revealed ? 'chevron-up' : 'chevron-down'} size={14} color={c.primary} />
                <Txt size={font.cap} weight="700" color={c.primary}>{discloseLabel}</Txt>
              </Pressable>
            ) : null}

            {hasOriginal && revealed ? (
              <View style={{
                backgroundColor: c.cardAlt, borderRadius: radius.md,
                padding: spacing.md, gap: 4,
                borderLeftWidth: 3, borderLeftColor: c.accent,
              }}>
                <Txt size={font.tiny} weight="700" color={c.faint}>
                  As dictated on WhatsApp
                </Txt>
                <Txt size={font.sub} style={{ lineHeight: 20 }}>{transcript}</Txt>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </SwipeRow>
  );
}

/* ================================================================== *
 * Composer — inline, pinned, inside the thumb arc
 * ================================================================== */

function Composer({
  open, draft, category, saving, bottomInset, onOpen, onCancel, onChange, onCategory, onSave,
}: {
  open: boolean;
  draft: string;
  category: string;
  saving: boolean;
  bottomInset: number;
  onOpen: () => void;
  onCancel: () => void;
  onChange: (v: string) => void;
  onCategory: (v: string) => void;
  onSave: () => void;
}) {
  const c = useTheme();
  const tr = useT();

  return (
    <View style={{
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: bottomInset + spacing.md,
      gap: spacing.md,
      backgroundColor: c.bgElevated,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    }}>
      {open ? (
        <>
          <Field
            label="New note"
            value={draft}
            onChange={onChange}
            placeholder="What do you need to remember?"
            multiline
            autoFocus
            maxLength={2000}
          />
          <Chips
            options={COMPOSE_CATS.map((k) => ({ key: k, label: catMeta(k).label }))}
            value={category}
            onChange={onCategory}
          />
          <Row>
            <Button label={tr('common.cancel')} variant="ghost" onPress={onCancel} />
            <Button
              label="Save note"
              icon="checkmark"
              onPress={onSave}
              loading={saving}
              disabled={!draft.trim()}
              full
              style={{ flex: 1 }}
            />
          </Row>
        </>
      ) : (
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel="Jot a note"
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', gap: spacing.md,
            height: 50, paddingHorizontal: 15, borderRadius: radius.md,
            backgroundColor: pressed ? c.cardAlt : c.card,
            borderWidth: 1, borderColor: c.border,
          }]}
        >
          <Ionicons name="create-outline" size={19} color={c.primary} />
          <Txt size={font.body} weight="500" color={c.faint} numberOfLines={1} style={{ flex: 1 }}>
            Jot a note
          </Txt>
          <Ionicons name="chevron-up" size={18} color={c.faint} />
        </Pressable>
      )}
    </View>
  );
}

/* ================================================================== *
 * Sheet furniture
 * ================================================================== */

/** Source chip (34) + its 12pt gap + the row's 16pt gutter. */
const SEP_INSET = spacing.lg + 34 + spacing.md;

function Hairline({ top }: { top?: boolean }) {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: top ? c.border : c.hairline }} />;
}

function NoteSeparator() {
  const c = useTheme();
  return (
    <View style={{ backgroundColor: c.card }}>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: SEP_INSET }} />
    </View>
  );
}

function BoardFooter({ count, loadingMore, hasMore, onLoadMore }: {
  count: number; loadingMore: boolean; hasMore: boolean; onLoadMore: () => void;
}) {
  const c = useTheme();
  if (count === 0) return null;

  if (loadingMore) {
    return (
      <View style={{ backgroundColor: c.card }}>
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: SEP_INSET }} />
        <SkeletonNote />
        <Hairline />
      </View>
    );
  }

  return (
    <View style={{
      backgroundColor: c.card, paddingVertical: spacing.md, alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    }}>
      {hasMore ? (
        <Button label="Load older notes" variant="ghost" size="sm" onPress={onLoadMore} />
      ) : (
        <Txt size={font.cap} color={c.faint} numeric>
          {count === 1 ? '1 note shown' : `All ${count} notes shown`}
        </Txt>
      )}
    </View>
  );
}

/* ================================================================== *
 * Loading — the shape of a note, not a spinner
 * ================================================================== */

function SkeletonNote({ lines = 2 }: { lines?: number }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2,
    }}>
      <Skeleton width={34} height={34} radius={11} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Skeleton width="94%" height={13} />
        {lines > 1 ? <Skeleton width="72%" height={13} /> : null}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
          <Skeleton width={62} height={18} radius={radius.pill} />
          <Skeleton width={44} height={18} radius={radius.pill} />
        </View>
      </View>
    </View>
  );
}

function BoardSkeleton() {
  const c = useTheme();
  return (
    <View style={{
      flex: 1, backgroundColor: c.card,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
    }}>
      {[3, 2, 1, 2, 3, 1].map((lines, i) => (
        <View key={i}>
          {i > 0 ? (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: SEP_INSET }} />
          ) : null}
          <SkeletonNote lines={lines} />
        </View>
      ))}
    </View>
  );
}
