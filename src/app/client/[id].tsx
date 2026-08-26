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

const POLICY_STATUS: Record<Policy['status'], { label: string; tone: Tone }> = {
  in_force: { label: 'In force', tone: 'success' },
  lapsed: { label: 'Lapsed', tone: 'danger' },
  matured: { label: 'Matured', tone: 'info' },
  paid_up: { label: 'Paid up', tone: 'warning' },
};

/** Days-to-FUP, rendered as a status token. Returns null when there is no usable date. */
function dueToken(iso?: string): { label: string; tone: Tone } | null {
  if (!iso) return null;
  const d = daysUntil(iso);
  if (!Number.isFinite(d)) return null;
  if (d < 0) return { label: `${Math.abs(d)} days late`, tone: 'danger' };
  if (d === 0) return { label: 'Due today', tone: 'danger' };
  if (d <= 30) return { label: `In ${d} days`, tone: 'warning' };
  return { label: `In ${d} days`, tone: 'neutral' };
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
  const { user, viewAs, ready } = useAuth();
  if (ready && !canViewOwnClients(user, viewAs)) {
    return (
      <RestrictedNotice
        title="Client"
        heading="Client details are master and admin only"
        subtitle="Individual client records are available to administrators and the master account. Ask an administrator if you need this client's details."
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
  const [failure, setFailure] = useState<string | null>(null);

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
        ? 'Report generation is not set up on the server yet. Ask your admin to enable it, then try again.'
        : r.reason === 'no_data'
          ? 'No report could be built for this client. Check the name and try again.'
          : r.reason === 'timeout'
            ? 'The report is taking longer than usual to build. Please try again in a moment.'
            : 'The report service did not answer, so nothing was generated. No figures are shown.',
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
      { label: 'Annual premium', value: inrShort(client.totalPremium), icon: 'cash-outline', tone: 'success' },
      { label: 'Policies', value: String(client.policies.length), icon: 'documents-outline', tone: 'primary' },
    ];
    // A matured policy has run its full term — no premium is due, so don't raise a "days late" alarm on it.
    const due = p && p.status !== 'matured' ? dueToken(p.nextRenewal) : null;
    if (due) out.push({ label: 'Premium due', value: due.label, icon: 'time-outline', tone: due.tone });
    const mat = monthYear(p?.maturityDate);
    if (mat) out.push({ label: 'Maturity', value: mat, icon: 'flag-outline', tone: 'accent' });
    return out;
  }, [client]);

  if (loading) return <DetailSkeleton />;

  if (!client) {
    return (
      <Screen>
        <Header title="Client 360" back />
        <EmptyState
          icon={health.degraded ? 'cloud-offline-outline' : 'person-circle-outline'}
          title={health.degraded ? 'This client could not load' : 'Client not found'}
          subtitle={health.degraded
            ? 'The server did not answer, so nothing here is confirmed. Check your connection and try again.'
            : 'This record is no longer in the book you can see. It may have been reassigned or removed.'}
          action={{ label: 'Try again', onPress: retry }}
        />
      </Screen>
    );
  }

  const meta = [client.city, client.since && client.since !== '—' ? `Client since ${client.since}` : null]
    .filter(Boolean).join(' · ');
  const segments = client.segment.map((s) => SEG_META[s]).filter(Boolean);
  const dob = dateOr(client.dob);

  return (
    <Screen>
      <Header title="Client 360" back subtitle={client.name} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {failure ? (
          <Banner
            tone="danger"
            title="Report was not generated"
            message={failure}
            action={{ label: 'Try again', onPress: doReport }}
            onDismiss={() => setFailure(null)}
          />
        ) : null}

        {!client.phone ? (
          <Banner
            tone="warning"
            title="No mobile number on this record"
            message="Calls, WhatsApp and premium reminders all need a number on the client record."
          />
        ) : null}

        {/* Identity + the one headline figure. Cover is what an insurance record is FOR,
            so it gets the display Metric and the screen's single Eyebrow. */}
        <Appear index={0}>
          <Card>
            <Row>
              <Avatar name={client.name} size={58} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt size={19} weight="800" numberOfLines={2}>{client.name}</Txt>
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
              <Eyebrow>Total cover</Eyebrow>
              <Metric value={inrShort(client.totalCover)} size={font.display} style={{ marginTop: 2 }} />
            </View>
          </Card>
        </Appear>

        {/* Bleeds to both edges so the strip reads as scrollable. */}
        <Appear index={1} style={{ marginHorizontal: -spacing.lg }}>
          <KpiStrip items={kpis} contentStyle={{ paddingHorizontal: spacing.lg }} />
        </Appear>

        <Appear index={2}>
          <ListSection title="Contact">
            {client.phone ? <DataRow label="Mobile" value={client.phone} icon="call-outline" numeric copyable /> : null}
            {client.email ? <DataRow label="Email" value={client.email} icon="mail-outline" copyable /> : null}
            {client.city ? <DataRow label="City" value={client.city} icon="location-outline" /> : null}
            {client.family ? <DataRow label="Family" value={client.family} icon="people-outline" /> : null}
            {dob ? <DataRow label="Date of birth" value={dob} icon="gift-outline" /> : null}
          </ListSection>
        </Appear>

        {client.policies.map((p, i) => (
          <Appear key={p.id} index={3 + i}>
            <PolicySection p={p} index={i} count={client.policies.length} />
          </Appear>
        ))}

        <Appear index={3 + client.policies.length}>
          <Button
            label={reporting ? 'Generating report' : 'Generate client report'}
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
          accessibilityLabel={`Call ${client.name}`}
        />
        <IconBtn
          icon="logo-whatsapp"
          size={48}
          bg={c.whatsappSoft}
          color={c.whatsapp}
          disabled={!client.phone}
          onPress={() => { haptics.tap(); whatsapp(client.phone, `Namaste ${client.name}`); }}
          accessibilityLabel={`Open WhatsApp chat with ${client.name}`}
        />
        <Button
          label="Send reminder"
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
  const status = POLICY_STATUS[p.status] ?? POLICY_STATUS.in_force;
  const matured = p.status === 'matured';
  // A matured policy has no next premium — suppress the due date + "days late" pill entirely.
  const due = matured ? null : dueToken(p.nextRenewal);
  const hasNumber = !!p.number && p.number !== '—';
  const started = dateOr(p.startDate);
  const matures = dateOr(p.maturityDate);
  const nextDue = dateOr(p.nextRenewal);

  return (
    <ListSection
      title={count > 1 ? `Policy ${index + 1} of ${count}` : 'Policy'}
      footer={hasNumber ? undefined : 'This record carries no policy number, so it cannot be matched to LIC yet.'}
    >
      <DataRow label="Status" value="" right={<Pill label={status.label} tone={status.tone} small dot />} />
      <DataRow label="Plan" value={p.plan} />
      {hasNumber ? <DataRow label="Policy number" value={p.number} numeric copyable /> : null}
      {p.sumAssured > 0 ? <DataRow label="Sum assured" value={inr(p.sumAssured)} numeric /> : null}
      {p.premium > 0 ? <DataRow label="Premium" value={inr(p.premium)} numeric /> : null}
      {p.frequency ? <DataRow label="Mode" value={p.frequency} /> : null}
      {started ? <DataRow label="Commenced" value={started} numeric /> : null}
      {matures ? <DataRow label="Maturity" value={matures} numeric /> : null}
      {nextDue && !matured ? (
        <DataRow
          label="Next premium"
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
  const s = report?.summary ?? {};

  const rows: { label: string; value: string }[] = [];
  if (s.total_policies != null) rows.push({ label: 'Total policies', value: String(s.total_policies) });
  if (s.life_cover != null) rows.push({ label: 'Total life cover', value: inr(s.life_cover) });
  if (s.annual_premium != null) rows.push({ label: 'Annual premium', value: inr(s.annual_premium) });
  if (s.members != null) rows.push({ label: 'Family members', value: String(s.members) });

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
      title="Client report"
      subtitle={report?.familyHead ?? undefined}
      footer={<Button label="Share report" icon="share-social" full onPress={share} />}
    >
      <View style={{ gap: spacing.lg, paddingTop: spacing.xs }}>
        {rows.length > 0 ? (
          <ListSection title="Summary">
            {rows.map((r) => <DataRow key={r.label} label={r.label} value={r.value} numeric />)}
          </ListSection>
        ) : (
          <Txt size={font.sub} color={c.muted}>
            The report was generated but returned no summary figures.
          </Txt>
        )}

        {report?.viewUrl ? (
          <Button
            label="View full report"
            icon="open-outline"
            full
            onPress={() => { haptics.tap(); Linking.openURL(report.viewUrl as string).catch(() => {}); }}
          />
        ) : null}
        {report?.pdfUrl ? (
          <Button
            label="Download PDF"
            icon="download-outline"
            variant="outline"
            full
            onPress={() => { haptics.tap(); Linking.openURL(report.pdfUrl as string).catch(() => {}); }}
          />
        ) : null}
        {!report?.viewUrl && !report?.pdfUrl ? (
          <Txt size={font.cap} color={c.faint} style={{ textAlign: 'center' }}>
            No hosted link came back with this report, so only the figures above are available.
          </Txt>
        ) : null}
      </View>
    </Sheet>
  );
}

/* ================================================================== *
 * Loading — the shape of the screen that is coming
 * ================================================================== */

function DetailSkeleton() {
  const c = useTheme();
  return (
    <Screen>
      <Header title="Client 360" back />
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
