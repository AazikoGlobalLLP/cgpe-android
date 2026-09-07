import { resolveCopy, textCopy, renderText, type CopyText } from '@/i18n/copy';
import { policyFrequencyLabel } from '@/i18n/display';
import React, { useCallback, useMemo, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import { Button, IconBtn } from '@/ui/controls';
import { Banner, EmptyState, Skeleton, SkeletonText } from '@/ui/feedback';
import { DataRow, KpiStrip, ListSection, Pill } from '@/ui/data';
import type { KpiItem, Tone } from '@/ui/data';
import { Avatar } from '@/ui/identity';
import { Sheet } from '@/ui/sheet';
import { Appear } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';
import * as api from '@/data/api';
import type { Client, Policy } from '@/data/types';
import { SEG_META } from '@/data/labels';
import { useT } from '@/i18n';
import { daysUntil, fmtDate, inr, inrShort } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';
import { renewalMessage } from '@/lib/messages';
import { useAuth } from '@/store/auth';
import { canViewOwnClients } from '@/store/roles';
import { RestrictedNotice } from '@/ui/RestrictedNotice';

/** The translator, as `dueToken` needs it: that helper is module scope and cannot call a hook. */
type TFn = ReturnType<typeof useT>;

/* ------------------------------------------------------------------ *
 * Client 360 — everything the book knows about one person.
 *
 * The two actions an advisor repeats all day (call, WhatsApp) plus the one that earns
 * money (the premium reminder) live in a pinned bar at the bottom, inside the thumb arc,
 * so they never scroll away. The scroll body is pure reference: figures first, then the
 * grouped detail a caller reads out or copies.
 *
 * ADAPTER NOTE: the client book is one row per POLICY, so `policies` is usually a single
 * entry. The screen still maps the array, because a merged household record legitimately
 * carries several.
 * ------------------------------------------------------------------ */

/** `fmtDate` returns an em dash for an unparseable date, and the UI does not use those. */
function dateOr(iso?: string): string | null {
  if (!iso) return null;
  const s = fmtDate(iso);
  return !s || s === '—' ? null : s;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthYear(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const POLICY_STATUS: Record<Policy['status'], { labelKey: string; tone: Tone }> = {
  in_force: { labelKey: 'client.policyInForce', tone: 'success' },
  lapsed: { labelKey: 'client.policyLapsed', tone: 'danger' },
  matured: { labelKey: 'client.policyMatured', tone: 'info' },
  paid_up: { labelKey: 'client.policyPaidUp', tone: 'warning' },
};

/** Days-to-FUP, rendered as a status token. Returns null when there is no usable date. */
function dueToken(iso: string | undefined, t: TFn): { label: string; tone: Tone } | null {
  if (!iso) return null;
  const d = daysUntil(iso);
  if (!Number.isFinite(d)) return null;
  if (d < 0) return { label: t('common.daysLate', { n: Math.abs(d) }), tone: 'danger' };
  if (d === 0) return { label: t('common.dueToday'), tone: 'danger' };
  if (d <= 30) return { label: t('common.inDays', { n: d }), tone: 'warning' };
  return { label: t('common.inDays', { n: d }), tone: 'neutral' };
}

type ReportSummary = {
  total_policies?: number;
  life_cover?: number;
  annual_premium?: number;
  members?: number;
};
type ReportPayload = {
  ok?: boolean;
  familyHead?: string | null;
  summary?: ReportSummary;
  viewUrl?: string | null;
  pdfUrl?: string | null;
};

/**
 * Point 9 (owner decision, 2026-08-24): the client book is master/admin-only — this closes the
 * deep-link vector (a team user opening a client by id, e.g. from a task or a saved link). Thin
 * wrapper so the real screen's hooks are untouched (no conditional-hooks hazard).
 */
export default function ClientDetail() {
  const t = useT();
  const { user, viewAs, ready } = useAuth();
  if (ready && !canViewOwnClients(user, viewAs)) {
    return (
      <RestrictedNotice
        title={t('task.clientLabel')}
        heading={t('client.adminOnlyTitle')}
        subtitle={t('client.adminOnlyBody')}
      />
    );
  }
  return <ClientDetailScreen />;
}

function ClientDetailScreen() {
  const c = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const health = useDataHealth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [reporting, setReporting] = useState(false);
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [failure, setFailure] = useState<CopyText | null>(null);

  const load = useCallback(async () => {
    const cl = await api.getClient(String(id));
    setClient(cl ?? null);
    setLoading(false);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const retry = useCallback(() => { setLoading(true); load(); }, [load]);

  const doReport = useCallback(async () => {
    if (!client || reporting) return;
    haptics.tap();
    setFailure(null);
    setReporting(true);
    const r = await api.generateReport(client.name);
    setReporting(false);
    if (r.ok) {
      setReport(r);
      setReportOpen(true);
      haptics.success();
      return;
    }
    haptics.error();
    // Name the actual cause: a server that has reports switched off is a different sentence — and a
    // different fix (an admin sets it up) — from a service that is momentarily unavailable.
    setFailure(
      r.reason === 'not_configured'
        ? textCopy('client.reportNotConfigured')
        : r.reason === 'no_data'
          ? textCopy('client.reportNoClient')
          : r.reason === 'timeout'
            ? textCopy('client.reportSlow')
            : textCopy('client.reportUnanswered'),
    );
  }, [client, reporting]);

  const sendReminder = useCallback(() => {
    if (!client?.phone) return;
    haptics.tap();
    const p = client.policies[0];
    whatsapp(client.phone, renewalMessage({
      name: client.name, premium: p?.premium, sumAssured: p?.sumAssured, policyNo: p?.number,
      mode: p?.frequency, dueDate: p?.nextRenewal, since: Number(client.since) || undefined,
    }));
  }, [client]);

  const kpis: KpiItem[] = useMemo(() => {
    if (!client) return [];
    const p = client.policies[0];
    const out: KpiItem[] = [
      { label: t('client.annualPremium'), value: inrShort(client.totalPremium), icon: 'cash-outline', tone: 'success' },
      // `policies` only ever holds the ONE document this screen fetched, so its length is
      // always 1 and says nothing about the person. `No of Policies` on the merged book is
      // their real holding — prefer it, and fall back to what we fetched when it is absent.
      { label: t('client.policies'), value: String(client.policyCount ?? client.policies.length), icon: 'documents-outline', tone: 'primary' },
    ];
    // A matured policy has run its full term — no premium is due, so don't raise a "days late" alarm on it.
    const due = p && p.status !== 'matured' ? dueToken(p.nextRenewal, t) : null;
    if (due) out.push({ label: t('act.premiumDue'), value: due.label, icon: 'time-outline', tone: due.tone });
    const mat = monthYear(p?.maturityDate);
    if (mat) out.push({ label: t('client.maturity'), value: mat, icon: 'flag-outline', tone: 'accent' });
    return out;
  }, [client, t]);

  if (loading) return <DetailSkeleton />;

  if (!client) {
    return (
      <Screen>
        <Header title={t('client.detailTitle')} back />
        <EmptyState
          icon={health.degraded ? 'cloud-offline-outline' : 'person-circle-outline'}
          title={health.degraded ? t('client.detailFailed') : t('client.notFound')}
          subtitle={health.degraded
            ? t('client.unconfirmedBody')
            : t('client.recordGoneBody')}
          action={{ label: t('common.tryAgain'), onPress: retry }}
        />
      </Screen>
    );
  }

  const meta = [client.city, client.since && client.since !== '—' ? t('client.sinceLabel', { since: client.since }) : null]
    .filter(Boolean).join(' · ');
  const segments = client.segment.map((s) => SEG_META[s]).filter(Boolean);
  const dob = dateOr(client.dob);
  const marriage = dateOr(client.marriageDate);

  return (
    <Screen>
      <Header title={t('client.detailTitle')} back subtitle={resolveCopy(t, client.name, client.nameCopy)} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {failure ? (
          <Banner
            tone="danger"
            title={t('client.reportFailedTitle')}
            message={renderText(t, failure)}
            action={{ label: t('common.tryAgain'), onPress: doReport }}
            onDismiss={() => setFailure(null)}
          />
        ) : null}

        {!client.phone ? (
          <Banner
            tone="warning"
            title={t('client.noMobile')}
            message={t('client.mobileRequiredBody')}
          />
        ) : null}

        {/* Identity + the one headline figure. Cover is what an insurance record is FOR,
            so it gets the display Metric and the screen's single Eyebrow. */}
        <Appear index={0}>
          <Card>
            <Row>
              <Avatar name={resolveCopy(t, client.name, client.nameCopy)} size={58} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt size={19} weight="800" numberOfLines={2}>{resolveCopy(t, client.name, client.nameCopy)}</Txt>
                {meta ? <Txt size={font.sub} color={c.muted} numberOfLines={1}>{meta}</Txt> : null}
              </View>
            </Row>

            {segments.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md }}>
                {segments.map((m, i) => (
                  <Pill key={`${m.labelKey}_${i}`} label={t(m.labelKey)} tone={m.tone} icon={m.icon} small />
                ))}
              </View>
            ) : null}

            <View style={{
              marginTop: spacing.lg, paddingTop: spacing.md,
              borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline,
            }}>
              <Eyebrow>{t('client.totalCoverLabel')}</Eyebrow>
              <Metric value={inrShort(client.totalCover)} size={font.display} style={{ marginTop: 2 }} />
            </View>
          </Card>
        </Appear>

        {/* Bleeds to both edges so the strip reads as scrollable. */}
        <Appear index={1} style={{ marginHorizontal: -spacing.lg }}>
          <KpiStrip items={kpis} contentStyle={{ paddingHorizontal: spacing.lg }} />
        </Appear>

        <Appear index={2}>
          <ListSection title={t('filter.contact')}>
            {client.phone ? <DataRow label={t('common.mobile')} value={client.phone} icon="call-outline" numeric copyable /> : null}
            {client.email ? <DataRow label={t('profile.emailLabel')} value={client.email} icon="mail-outline" copyable /> : null}
            {client.city ? <DataRow label={t('leads.cityLabel')} value={client.city} icon="location-outline" /> : null}
            {client.family ? <DataRow label={t('client.familyLabel')} value={client.family} icon="people-outline" /> : null}
            {dob ? <DataRow label={t('client.dobLabel')} value={dob} icon="gift-outline" /> : null}
            {/* `Sex` is backend DATA, rendered exactly as sent — translating a stored value is
                the no-sweep rule in CLAUDE.md, and it would break any filter keyed on it. */}
            {client.gender ? <DataRow label={t('client.genderLabel')} value={client.gender} icon="person-outline" /> : null}
            {/* The WEDDING anniversary (`Marriage Date`). Named in full so it cannot be read as
                the policy anniversary, which is the commencement date on the policy card below. */}
            {marriage ? <DataRow label={t('client.anniversaryLabel')} value={marriage} icon="heart-outline" /> : null}
          </ListSection>
        </Appear>

        {client.policies.map((p, i) => (
          <Appear key={p.id} index={3 + i}>
            <PolicySection p={p} index={i} count={client.policies.length} />
          </Appear>
        ))}

        <Appear index={3 + client.policies.length}>
          <Button
            label={reporting ? t('report.generating') : t('report.generate')}
            icon="document-text-outline"
            variant="outline"
            full
            loading={reporting}
            onPress={doReport}
          />
        </Appear>
      </ScrollView>

      {/* Pinned action bar — the repeated actions stay in the thumb arc at all times. */}
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
          disabled={!client.phone}
          onPress={() => { haptics.tap(); call(client.phone); }}
          accessibilityLabel={t('common.a11yCall', { name: resolveCopy(t, client.name, client.nameCopy) })}
        />
        <IconBtn
          icon="logo-whatsapp"
          size={48}
          bg={c.whatsappSoft}
          color={c.whatsapp}
          disabled={!client.phone}
          onPress={() => { haptics.tap(); whatsapp(client.phone, `Namaste ${client.name}`); }}
          accessibilityLabel={t('common.a11yWhatsapp', { name: resolveCopy(t, client.name, client.nameCopy) })}
        />
        <Button
          label={t('premium.sendReminder')}
          icon="paper-plane"
          full
          disabled={!client.phone}
          onPress={sendReminder}
          style={{ flex: 1 }}
        />
      </View>

      <ReportSheet
        visible={reportOpen}
        report={report}
        onClose={() => setReportOpen(false)}
      />
    </Screen>
  );
}

/* ================================================================== *
 * Policy group
 * ================================================================== */

function PolicySection({ p, index, count }: { p: Policy; index: number; count: number }) {
  const t = useT();
  const status = POLICY_STATUS[p.status] ?? POLICY_STATUS.in_force;
  const matured = p.status === 'matured';
  // A matured policy has no next premium — suppress the due date + "days late" pill entirely.
  const due = matured ? null : dueToken(p.nextRenewal, t);
  const hasNumber = !!p.number && p.number !== '—';
  const started = dateOr(p.startDate);
  const matures = dateOr(p.maturityDate);
  const nextDue = dateOr(p.nextRenewal);

  return (
    <ListSection
      title={count > 1 ? t('client.policyIndex', { index: index + 1, count: count }) : t('notice.policyLabel')}
      footer={hasNumber ? undefined : t('client.noPolicyMatchBody')}
    >
      <DataRow label={t('task.statusLabel')} value="" right={<Pill label={t(status.labelKey)} tone={status.tone} small dot />} />
      <DataRow label={t('client.planLabel')} value={resolveCopy(t, p.plan, p.planCopy)} />
      {hasNumber ? <DataRow label={t('claim.policyNumberLabel')} value={p.number} numeric copyable /> : null}
      {p.sumAssured > 0 ? <DataRow label={t('client.sumAssuredLabel')} value={inr(p.sumAssured)} numeric /> : null}
      {p.premium > 0 ? <DataRow label={t('client.premiumLabel')} value={inr(p.premium)} numeric /> : null}
      {p.frequency ? <DataRow label={t('client.modeLabel')} value={policyFrequencyLabel(t, p.frequency)} /> : null}
      {started ? <DataRow label={t('client.commencedLabel')} value={started} numeric /> : null}
      {matures ? <DataRow label={t('client.maturity')} value={matures} numeric /> : null}
      {nextDue && !matured ? (
        <DataRow
          label={t('client.nextPremiumLabel')}
          value={nextDue}
          numeric
          right={due ? <Pill label={due.label} tone={due.tone} small numeric /> : undefined}
        />
      ) : null}
    </ListSection>
  );
}

/* ================================================================== *
 * Report
 * ================================================================== */

function ReportSheet({ visible, report, onClose }: {
  visible: boolean; report: ReportPayload | null; onClose: () => void;
}) {
  const c = useTheme();
  const t = useT();
  const s = report?.summary ?? {};

  const rows: { label: string; value: string }[] = [];
  if (s.total_policies != null) rows.push({ label: t('report.totalPolicies'), value: String(s.total_policies) });
  if (s.life_cover != null) rows.push({ label: t('report.lifeCover'), value: inr(s.life_cover) });
  if (s.annual_premium != null) rows.push({ label: t('client.annualPremium'), value: inr(s.annual_premium) });
  if (s.members != null) rows.push({ label: t('report.familyMembers'), value: String(s.members) });

  const share = () => {
    if (!report) return;
    haptics.tap();
    const lines = [`${report.familyHead ?? 'Client'}, CGPE client report`];
    if (s.life_cover != null) lines.push(`Total life cover: ${inr(s.life_cover)}`);
    if (s.annual_premium != null) lines.push(`Annual premium: ${inr(s.annual_premium)}`);
    if (s.total_policies != null) lines.push(`Policies: ${s.total_policies}`);
    const url = report.viewUrl || report.pdfUrl;
    if (url) lines.push(url);
    Share.share({ message: lines.join('\n'), ...(url ? { url } : {}) }).catch(() => {});
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('report.title')}
      subtitle={report?.familyHead ?? undefined}
      footer={<Button label={t('client.shareReport')} icon="share-social" full onPress={share} />}
    >
      <View style={{ gap: spacing.lg, paddingTop: spacing.xs }}>
        {rows.length > 0 ? (
          <ListSection title={t('client.summaryLabel')}>
            {rows.map((r) => <DataRow key={r.label} label={r.label} value={r.value} numeric />)}
          </ListSection>
        ) : (
          <Txt size={font.sub} color={c.muted}>
            {t('client.noReportSummary')}</Txt>
        )}

        {report?.viewUrl ? (
          <Button
            label={t('client.viewFullReport')}
            icon="open-outline"
            full
            onPress={() => { haptics.tap(); Linking.openURL(report.viewUrl as string).catch(() => {}); }}
          />
        ) : null}
        {report?.pdfUrl ? (
          <Button
            label={t('client.downloadPdf')}
            icon="download-outline"
            variant="outline"
            full
            onPress={() => { haptics.tap(); Linking.openURL(report.pdfUrl as string).catch(() => {}); }}
          />
        ) : null}
        {!report?.viewUrl && !report?.pdfUrl ? (
          <Txt size={font.cap} color={c.faint} style={{ textAlign: 'center' }}>
            {t('client.noHostedLink')}</Txt>
        ) : null}
      </View>
    </Sheet>
  );
}

/* ================================================================== *
 * Loading — the shape of the screen that is coming
 * ================================================================== */

function DetailSkeleton() {
  const t = useT();
  const c = useTheme();
  return (
    <Screen>
      <Header title={t('client.detailTitle')} back />
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card>
          <Row>
            <Skeleton width={58} height={58} radius={58 / 2.6} />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Skeleton width="68%" height={16} />
              <Skeleton width="44%" height={12} />
            </View>
          </Row>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.md }}>
            <Skeleton width={88} height={20} radius={radius.pill} />
            <Skeleton width={72} height={20} radius={radius.pill} />
          </View>
          <View style={{
            marginTop: spacing.lg, paddingTop: spacing.md, gap: spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline,
          }}>
            <Skeleton width={78} height={10} />
            <Skeleton width={150} height={28} />
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} width={118} height={58} radius={radius.md} />)}
        </View>

        <Card>
          <SkeletonText lines={4} lineHeight={13} gap={spacing.xl} />
        </Card>
      </View>
    </Screen>
  );
}
