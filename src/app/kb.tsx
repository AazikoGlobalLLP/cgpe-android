import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Eyebrow, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import { Button, Chips, SearchBar } from '@/ui/controls';
import { Banner, EmptyState, Skeleton, SkeletonText } from '@/ui/feedback';
import { DataRow, ListSection, Pill } from '@/ui/data';
import { Sheet } from '@/ui/sheet';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';

import * as api from '@/data/api';
import type { KbArticle } from '@/data/api';
import { fmtDate } from '@/lib/format';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * Knowledge Base — the field reference.
 *
 * THE USE CASE SETS EVERY DECISION HERE. This screen is opened mid-conversation, phone in
 * one hand, customer opposite. The advisor has been asked something they are not sure of
 * ("is a pre-existing condition covered in year two?") and needs the answer in seconds,
 * read off the screen, correctly. So:
 *
 *   · LEGIBILITY BEATS DENSITY. Article titles run to two lines rather than truncating at
 *     one. The reading view uses a 24pt leading and a capped measure. Nothing here is
 *     compressed to fit more rows on screen; a reference you have to squint at gets
 *     paraphrased from memory instead, which is how wrong answers reach customers.
 *   · SEARCH IS THE PRIMARY NAVIGATION and stays pinned; the facets scroll with the list.
 *     It is debounced so a typed phrase is one request, not eight.
 *   · THE ARTICLE BODY IS NEVER REWRITTEN. Paragraphs and bullet lines are laid out, and
 *     that is all. No summarising, no truncation with a "read more", no reflowing that
 *     could change what a clause says.
 *
 * The reading sheet fetches the full article by id. The list response already carried the
 * same document, so a failed fetch falls back to it rather than showing an empty sheet;
 * that is the same data from the same source, never a substitute.
 * ------------------------------------------------------------------ */

const PAGE = 24;
const DEBOUNCE_MS = 400;
const ALL = 'all';

/* ---------- untrusted-field helpers ---------- */
const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const asStrArr = (v: unknown): string[] =>
  (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : []);

type ArticleView = {
  key: string;
  /** Human reference, e.g. HLTH-0017. Falls back to the Mongo id. */
  ref: string;
  title: string;
  topic: string;
  domain: string;
  category: string;
  content: string;
  tags: string[];
  examples: string[];
  source: string;
  applicability: string;
  reviewed: string;
};

function toArticle(raw: KbArticle, i: number): ArticleView {
  const o = raw as Record<string, unknown>;
  const ref = asStr(o.id) || asStr(o._id);
  return {
    key: ref || `article-${i}`,
    ref,
    title: asStr(o.title) || asStr(o.topic),
    topic: asStr(o.topic),
    domain: asStr(o.domain),
    category: asStr(o.category),
    content: typeof o.content === 'string' ? o.content : '',
    tags: asStrArr(o.tags),
    examples: asStrArr(o.query_examples),
    source: asStr(o.source),
    applicability: asStr(o.applicability),
    reviewed: asStr(o.last_reviewed),
  };
}

/* ---------- body layout ----------
 * Blocks, not markdown. The source is plain text with blank lines between paragraphs and
 * the occasional dash or numbered list. Lines inside one paragraph keep their own newlines
 * so an author's structure is preserved exactly; only the spacing between blocks is ours. */
type Block = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] };

const BULLET = /^(?:[-*•]|\d+[.)])\s+(.*)$/;

function parseBlocks(text: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  let bullets: string[] = [];

  const flushPara = () => {
    if (para.length) { out.push({ kind: 'p', text: para.join('\n') }); para = []; }
  };
  const flushList = () => {
    if (bullets.length) { out.push({ kind: 'ul', items: bullets.slice() }); bullets = []; }
  };

  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) { flushList(); flushPara(); continue; }
    const m = line.match(BULLET);
    if (m) { flushPara(); bullets.push(m[1].trim()); continue; }
    flushList(); para.push(line);
  }
  flushList();
  flushPara();
  return out;
}

/* ================================================================== *
 * Screen
 * ================================================================== */

export default function Kb() {
  const c = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();

  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState(ALL);
  const [category, setCategory] = useState(ALL);

  const [rows, setRows] = useState<ArticleView[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [domains, setDomains] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [open, setOpen] = useState<ArticleView | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  /* ---------- debounced search ---------- */
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      setQuery(q.trim());
    }, DEBOUNCE_MS);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = null;
    };
  }, [q]);

  /* ---------- fetch ---------- */
  const run = useCallback(async (p: number, mode: 'replace' | 'append' | 'refresh') => {
    const my = ++reqId.current;
    if (mode === 'replace') setLoading(true);
    else if (mode === 'append') setLoadingMore(true);
    else setRefreshing(true);

    const res = await api.getKbArticles({
      search: query || undefined,
      domain,
      category,
      page: p,
      limit: PAGE,
    });
    if (!mounted.current || my !== reqId.current) return;

    const next = (Array.isArray(res.data) ? res.data : []).map(toArticle);
    setRows((prev) => (mode === 'append' ? [...prev, ...next] : next));
    setTotal(res.total ?? next.length);
    setPages(Math.max(1, res.pages ?? 1));
    setDomains(Array.isArray(res.facets?.domains) ? res.facets.domains : []);
    setCategories(Array.isArray(res.facets?.categories) ? res.facets.categories : []);
    setPage(p);
    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
  }, [query, domain, category]);

  useEffect(() => { void run(1, 'replace'); }, [run]);

  const hasMore = page < pages;
  const loadMore = useCallback(() => {
    if (loading || loadingMore || refreshing || !hasMore) return;
    void run(page + 1, 'append');
  }, [loading, loadingMore, refreshing, hasMore, page, run]);

  /* ---------- facets ---------- */
  const domainOptions = useMemo(
    () => [{ key: ALL, label: t('kb.allDomains') }, ...domains.map((d) => ({ key: d, label: d }))],
    [domains, t],
  );
  const categoryOptions = useMemo(
    () => [{ key: ALL, label: t('kb.allTopics') }, ...categories.map((k) => ({ key: k, label: k }))],
    [categories, t],
  );

  const pickDomain = useCallback((next: string) => {
    if (next === domain) return;
    haptics.select();
    setDomain(next);
  }, [domain]);

  const pickCategory = useCallback((next: string) => {
    if (next === category) return;
    haptics.select();
    setCategory(next);
  }, [category]);

  const clearFacets = useCallback(() => {
    haptics.select();
    setDomain(ALL);
    setCategory(ALL);
  }, []);

  const facetsActive = domain !== ALL || category !== ALL;

  /* ---------- grouping ----------
   * Grouped by domain while browsing everything, by category once a domain is picked. A
   * flat wall of eighty titles is unreadable; two levels is enough structure to scan. */
  const sections = useMemo(() => {
    const keyOf = (a: ArticleView) => domain === ALL ? a.domain : a.category;
    const map = new Map<string, ArticleView[]>();
    rows.forEach((a) => {
      const k = keyOf(a);
      const list = map.get(k);
      if (list) list.push(a);
      else map.set(k, [a]);
    });
    return Array.from(map.entries()).map(([key, items]) => ({
      key, items, title: key || t(domain === ALL ? 'plans.other' : 'kb.general'),
    }));
  }, [rows, domain, t]);

  const readout = loading
    ? t('kb.loading')
    : total === 0
      ? t('kb.nothingToRead')
      : t(hasMore ? (total === 1 ? 'kb.articleCountLoaded' : 'kb.articlesCountLoaded') : (total === 1 ? 'kb.articleCount' : 'kb.articlesCount'), { count: total.toLocaleString('en-IN'), loaded: rows.length });

  return (
    <Screen>
      <Header
        title={t('more.kbTitle')}
        subtitle={t('kb.subtitle')}
        back
        right={total > 0 ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Metric value={total.toLocaleString('en-IN')} size={font.h3} />
            <Eyebrow>{t('kb.articles')}</Eyebrow>
          </View>
        ) : undefined}
      />

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }}>
        <SearchBar
          value={q}
          onChange={setQ}
          placeholder={t('kb.searchPlaceholder')}
        />
        {domainOptions.length > 2 ? (
          <Chips options={domainOptions} value={domain} onChange={pickDomain} />
        ) : null}
        <Row style={{ gap: spacing.sm }}>
          <Txt size={font.cap} color={c.faint} numeric numberOfLines={1} style={{ flex: 1 }}>{readout}</Txt>
          {facetsActive ? (
            <Button label={t('common.clear')} variant="ghost" size="sm" onPress={clearFacets} />
          ) : null}
        </Row>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 48,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => run(1, 'refresh')}
            tintColor={c.primary}
            colors={[c.primary]}
            progressBackgroundColor={c.card}
          />
        }
      >
        {loading ? (
          <KbSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={query ? 'search-outline'
              : facetsActive ? 'funnel-outline'
                : health.degraded ? 'cloud-offline-outline' : 'library-outline'}
            title={
              query ? t('kb.noQueryMatch', { query: query })
                : facetsActive ? t('kb.noFacetArticles')
                  : health.degraded ? t('kb.loadFailed')
                    : t('kb.empty')
            }
            subtitle={
              query ? t('kb.searchHelp')
                : facetsActive ? t('kb.facetHelp')
                  : health.degraded ? t('book.unconfirmed')
                    : t('kb.emptyHelp')
            }
            action={
              query ? { label: t('common.clearSearch'), onPress: () => setQ('') }
                : facetsActive ? { label: t('kb.showEverything'), onPress: clearFacets }
                  : { label: t('common.tryAgain'), onPress: () => { haptics.tap(); void run(1, 'refresh'); } }
            }
          />
        ) : (
          <>
            {categoryOptions.length > 2 ? (
              <Appear index={0}>
                <Chips options={categoryOptions} value={category} onChange={pickCategory} />
              </Appear>
            ) : null}

            {sections.map((s, si) => {
              const offset = sections.slice(0, si).reduce((n, x) => n + x.items.length, 0);
              return (
                <ListSection key={s.key} title={`${s.title} (${s.items.length})`}>
                  {s.items.map((a, i) => (
                    <Appear key={a.key} index={offset + i}>
                      <ArticleRow article={a} onOpen={() => setOpen(a)} />
                    </Appear>
                  ))}
                </ListSection>
              );
            })}

            <View style={{ alignItems: 'center', paddingTop: spacing.xs }}>
              {loadingMore ? (
                <SkeletonText lines={2} lineHeight={11} style={{ width: '100%' }} />
              ) : hasMore ? (
                <Button label={t('kb.loadMore')} variant="ghost" size="sm" onPress={loadMore} />
              ) : (
                <Txt size={font.cap} color={c.faint} numeric>
                  {t('book.allShown', { count: total.toLocaleString('en-IN') })}
                </Txt>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <ReaderSheet article={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

/* ================================================================== *
 * Row
 *
 * Two lines for the title, one for where it is filed. A reference row that ellipsises its
 * title makes you open three articles to find one.
 * ================================================================== */

function ArticleRow({ article, onOpen }: { article: ArticleView; onOpen: () => void }) {
  const t = useT();
  const c = useTheme();
  const filed = article.topic || article.category;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={filed ? `${article.title || t('kb.untitled')}, ${filed}` : article.title || t('kb.untitled')}
      style={({ pressed }) => [{ backgroundColor: pressed ? c.cardAlt : 'transparent' }]}
    >
      <View style={{
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        minHeight: 56, gap: 6,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <Txt size={font.body} weight="700" numberOfLines={2} style={{ flex: 1, lineHeight: 20 }}>
            {article.title || t('kb.untitled')}
          </Txt>
          <Ionicons name="chevron-forward" size={16} color={c.faint} style={{ marginTop: 2 }} />
        </View>
        {filed || article.ref ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {filed ? (
              <Txt size={font.cap} color={c.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{filed}</Txt>
            ) : null}
            {article.ref ? (
              <Txt size={font.tiny} color={c.faint} numeric numberOfLines={1}>{article.ref}</Txt>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/* ================================================================== *
 * Reading view
 * ================================================================== */

/** Comfortable measure. Below a tablet width this is simply "the whole sheet". */
const MEASURE = 620;
const READ_SIZE = 15.5;
const READ_LEADING = 24;

function ReaderSheet({ article, onClose }: { article: ArticleView | null; onClose: () => void }) {
  const c = useTheme();
  const t = useT();
  const id = article?.ref ?? null;

  /**
   * One state, stamped with the id it belongs to. Two separate booleans would let the
   * PREVIOUS article's body and its failure banner survive into the next one for a frame,
   * which on a reference screen means reading the wrong clause out loud.
   */
  const [load, setLoad] = useState<{ id: string; status: 'busy' | 'done' | 'failed'; data: ArticleView | null } | null>(null);
  /** Bumped by Retry so the effect re-runs for the same id. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoad({ id, status: 'busy', data: null });
    (async () => {
      const a = await api.getKbArticle(id);
      if (!alive) return;
      setLoad(a
        ? { id, status: 'done', data: toArticle(a, 0) }
        : { id, status: 'failed', data: null });
    })();
    return () => { alive = false; };
  }, [id, attempt]);

  const current = load && load.id === id ? load : null;
  const failed = current?.status === 'failed';
  const busy = current?.status === 'busy';

  const shown = current?.data ?? article;
  const body = shown?.content ?? '';
  const blocks = useMemo(() => (body ? parseBlocks(body) : []), [body]);
  const showSkeleton = busy && blocks.length === 0;

  const filed = [shown?.domain, shown?.category].filter(Boolean).join(' · ');

  return (
    <Sheet
      visible={!!article}
      onClose={onClose}
      title={shown ? shown.title || t('kb.untitled') : ''}
      subtitle={filed || undefined}
      height={640}
    >
      <View style={{ gap: spacing.xl, paddingTop: spacing.xs, maxWidth: MEASURE, width: '100%', alignSelf: 'center' }}>
        {failed ? (
          <Banner
            tone="offline"
            title={blocks.length > 0 ? t('kb.refreshFailed') : t('kb.openFailed')}
            message={blocks.length > 0
              ? t('kb.cachedArticle')
              : t('kb.signalRetry')}
            action={{ label: t('common.tryAgain'), onPress: () => { haptics.tap(); setAttempt((n) => n + 1); } }}
          />
        ) : null}

        {showSkeleton ? (
          <ReaderSkeleton />
        ) : blocks.length > 0 ? (
          <View style={{ gap: spacing.lg }}>
            {blocks.map((b, i) => (
              b.kind === 'p' ? (
                <Txt key={i} size={READ_SIZE} style={{ lineHeight: READ_LEADING }}>{b.text}</Txt>
              ) : (
                <View key={i} style={{ gap: spacing.sm }}>
                  {b.items.map((it, j) => (
                    <View key={j} style={{ flexDirection: 'row', gap: spacing.md }}>
                      <View style={{
                        width: 5, height: 5, borderRadius: 3, backgroundColor: c.primary,
                        marginTop: READ_LEADING / 2 - 2,
                      }} />
                      <Txt size={READ_SIZE} style={{ flex: 1, lineHeight: READ_LEADING }}>{it}</Txt>
                    </View>
                  ))}
                </View>
              )
            ))}
          </View>
        ) : !failed ? (
          <Txt size={font.sub} color={c.muted} style={{ lineHeight: 21 }}>
            {t('kb.noBody')}</Txt>
        ) : null}

        {shown && shown.examples.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Txt size={font.cap} weight="700" color={c.muted}>{t('kb.questions')}</Txt>
            {shown.examples.map((e, i) => (
              <Txt key={i} size={font.sub} color={c.muted} style={{ lineHeight: 21 }}>{`"${e}"`}</Txt>
            ))}
          </View>
        ) : null}

        {shown && shown.tags.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {/* `tag`, not `t`: this component binds the translator as `t` (i18n batch 2), and a
                map item named `t` would shadow it for anyone wiring copy in here later. */}
            {shown.tags.map((tag) => <Pill key={tag} label={tag} tone="primary" small />)}
          </View>
        ) : null}

        {shown ? (
          <ListSection
            title={t('kb.provenance')}
            footer={shown.reviewed ? undefined : t('kb.noReviewDate')}
          >
            {shown.topic ? <DataRow label={t('kb.topic')} value={shown.topic} icon="bookmark-outline" /> : null}
            {shown.domain ? <DataRow label={t('kb.domain')} value={shown.domain} icon="albums-outline" /> : null}
            {shown.category ? <DataRow label={t('task.category')} value={shown.category} icon="pricetag-outline" /> : null}
            {shown.applicability ? <DataRow label={t('kb.appliesTo')} value={shown.applicability} icon="people-outline" /> : null}
            {shown.source ? <DataRow label={t('kb.source')} value={shown.source} icon="link-outline" /> : null}
            {shown.reviewed ? (
              <DataRow label={t('kb.lastReviewed')} value={fmtDate(shown.reviewed)} icon="calendar-outline" numeric />
            ) : null}
            {shown.ref ? (
              <DataRow label={t('more.groupReference')} value={shown.ref} icon="barcode-outline" numeric copyable />
            ) : null}
          </ListSection>
        ) : null}
      </View>
    </Sheet>
  );
}

/* ================================================================== *
 * Loading — chips over grouped article rows
 * ================================================================== */

function KbSkeleton() {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.md, paddingTop: spacing.xs }}>
      <Row style={{ gap: spacing.sm }}>
        {[84, 72, 96].map((w, i) => <Skeleton key={i} width={w} height={36} radius={radius.pill} />)}
      </Row>
      <Skeleton width={104} height={10} style={{ marginLeft: spacing.xs, marginTop: spacing.xs }} />
      <View style={{
        backgroundColor: c.card, borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
      }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i}>
            {i > 0 ? (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: spacing.lg }} />
            ) : null}
            <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 8, minHeight: 56 }}>
              <Skeleton width={i % 2 === 0 ? '86%' : '68%'} height={13} />
              <Skeleton width="34%" height={10} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function ReaderSkeleton() {
  return (
    <View style={{ gap: spacing.lg }}>
      <SkeletonText lines={4} lineHeight={12} gap={10} />
      <SkeletonText lines={3} lineHeight={12} gap={10} />
      <SkeletonText lines={2} lineHeight={12} gap={10} />
    </View>
  );
}
