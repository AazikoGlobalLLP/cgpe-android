import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Metric, Row, Screen, SectionHeader, Txt } from '@/ui/base';
import { Button, IconBtn } from '@/ui/controls';
import { Banner, EmptyState, Meter, Skeleton, SkeletonText, useToast } from '@/ui/feedback';
import type { FeedbackTone } from '@/ui/feedback';
import { DataRow, ListSection, Pill } from '@/ui/data';
import { Spine, SpineRow } from '@/ui/spine';
import { Appear, useCountUp } from '@/ui/motion';
import { useDataHealth } from '@/ui/health-banner';
import { haptics } from '@/lib/haptics';

import * as api from '@/data/api';
import type { Claim, ClaimStatus } from '@/data/types';
import { CLAIM_STATUS } from '@/data/labels';
import { fmtDate, fmtDay, fmtTime, inr } from '@/lib/format';
import { call, whatsapp } from '@/lib/actions';

/* ------------------------------------------------------------------ *
 * Claim detail — the screen a claim is actually WORKED on.
 *
 * A claim stalls for exactly one reason: a document nobody chased. So the checklist is the
 * subject of this screen and everything else is context, which drives three decisions:
 *
 *   1. COMPLETENESS IS A MEASUREMENT, NOT A FEELING. The Meter above the checklist reads
 *      "4/6" against a filled track, and the received count counts up when a document is
 *      ticked, because that change IS the information the advisor came for.
 *   2. THE HISTORY IS A SPINE, NOT A BULLETED LIST. A claim is a sequence in time; the
 *      date gutter, the rule and the node each carry that, which a stack of rows does not.
 *   3. FACTS ARE GROUPED AND COPYABLE. Policy number, reference and mobile are typed out
 *      by hand into insurer portals all day, so they sit in one hairline-separated group
 *      with a copy button rather than as decoration in a paragraph.
 *
 * WHAT THIS SCREEN WILL NOT DO IS INVENT. If a document upload does not reach the server,
 * the checklist is not ticked and a Banner says why. If the claim itself cannot be loaded,
 * the screen says "could not load" rather than showing a blank record that reads as real.
 *
 * TWO THINGS ARE HONESTLY MARKED AS NOT SAVED, because the register has no endpoint for
 * either and pretending otherwise is the worst failure this app can have:
 *
 *   · THE CHECKLIST IS LOCAL. `api.toggleClaimDoc` writes to the in-process record buffer,
 *     never to the server, so ticking a document is a working note on this handset and the
 *     group footer says exactly that. It therefore gets `haptics.select` (moving between
 *     states), never `haptics.success`, which this design system reserves for a write the
 *     server confirmed.
 *   · THE STATUS CANNOT BE ADVANCED. There is no claim-status endpoint in `data/api`, so
 *     the control is rendered DISABLED with the reason under it rather than mutating local
 *     state and printing "Moved to under review" over a change nobody outside this phone
 *     will ever see. A fake confirmation is worse than a missing feature: the advisor stops
 *     chasing the claims desk because the app told them it was done.
 * ------------------------------------------------------------------ */

const FLOW: ClaimStatus[] = ['intake', 'docs_pending', 'under_review', 'submitted', 'settled'];

/** Dates off the register can be empty strings; format helpers render a dash for those. */
function safeDate(v: string, fallback: string): string {
  const d = new Date(v);
  return v && !Number.isNaN(d.getTime()) ? fmtDate(d) : fallback;
}
function safeDay(v: string, fallback: string): string {
  const d = new Date(v);
  return v && !Number.isNaN(d.getTime()) ? fmtDay(d) : fallback;
}
function safeTime(v: string): string {
  const d = new Date(v);
  return v && !Number.isNaN(d.getTime()) ? fmtTime(d) : '';
}

/* ---------- loading ----------
 * Shaped like the real screen so nothing jumps when the claim lands. */
function DetailSkeleton() {
  const c = useTheme();
  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 10 }}>
            <Skeleton width="34%" height={10} />
            <Skeleton width="56%" height={30} />
            <Skeleton width="72%" height={11} />
          </View>
          <Skeleton width={78} height={24} radius={radius.pill} />
        </Row>
        <Row style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <Skeleton width="48%" height={48} radius={radius.md} />
          <Skeleton width="48%" height={48} radius={radius.md} />
        </Row>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Skeleton width="30%" height={10} />
        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            {[0, 1, 2, 3].map((i) => (
              <Row key={i}>
                <Skeleton width="32%" height={12} />
                <View style={{ flex: 1 }} />
                <Skeleton width="42%" height={12} />
              </Row>
            ))}
          </View>
        </Card>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Skeleton width="26%" height={10} />
        <Card padded={false}>
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <Skeleton width="100%" height={10} radius={5} />
            {[0, 1, 2].map((i) => (
              <Row key={i} style={{ gap: spacing.md }}>
                <Skeleton width={24} height={24} radius={12} />
                <Skeleton width="54%" height={12} />
                <View style={{ flex: 1 }} />
                <Skeleton width={62} height={18} radius={radius.pill} />
              </Row>
            ))}
          </View>
        </Card>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Skeleton width="22%" height={13} />
        <Card><SkeletonText lines={3} lineHeight={11} /></Card>
      </View>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline }} />
    </View>
  );
}

export default function ClaimDetail() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const health = useDataHealth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ tone: FeedbackTone; title: string; message: string } | null>(null);
  /** Bumped to re-run the focus effect after a retry. */
  const [nonce, setNonce] = useState(0);

  /* The camera and the upload both outlive a back-press, so the handlers below check this
   * before they touch state. The FETCH uses its own per-run flag instead: the focus effect
   * can re-run while the screen is still mounted, and a shared ref would leave the second
   * run permanently disarmed. */
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      const cl = await api.getClaim(String(id));
      if (!alive) return;
      setClaim(cl ?? null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id, nonce]));

  const retry = useCallback(() => { setLoading(true); setNonce((k) => k + 1); }, []);

  // Hooks run before the early returns, so the checklist figures are computed from a
  // possibly-null claim and the count-up keeps its history across a reload.
  const docs = claim?.docs ?? [];
  const total = docs.length;
  const received = docs.filter((d) => d.received).length;
  // The one count-up here: ticking a document is the whole job, and the number moving is
  // the confirmation. A figure that only ever appears static teaches nobody anything.
  const shownReceived = useCountUp(received);

  /* ---------- the checklist (local) ---------- */

  const toggleDoc = async (docId: string) => {
    if (!claim) return;
    // `select`, not `tap` or `success`: this moves a marker on a working list, it does not
    // commit anything the server will ever see. The success haptic is reserved for a
    // confirmed write and using it here would be a tactile lie.
    haptics.select();
    const next = claim.docs.map((d) => (d.id === docId ? { ...d, received: !d.received } : d));
    setClaim({ ...claim, docs: next });
    await api.toggleClaimDoc(claim.id, docId);
  };

  /* ---------- the upload (a real write, to /upload) ---------- */

  const capture = async () => {
    if (!claim) return;
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (!mounted.current) return;

    let result: ImagePicker.ImagePickerResult;
    if (cam.granted) {
      result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    } else {
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!mounted.current) return;
      if (!lib.granted) {
        haptics.warn();
        setNotice({
          tone: 'warning',
          title: 'Camera and photos are blocked',
          message: 'Allow camera or photo access in your device settings to attach a document to this claim.',
        });
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
    }
    if (!mounted.current) return;
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];

    setUploading(true);
    const up = await api.uploadFile(
      asset.uri,
      asset.fileName || `claim-${claim.ref || claim.id}-${total + 1}.jpg`,
      asset.mimeType || 'image/jpeg',
    );
    // The upload can outlive a back-press; the file still lands on the server, but this
    // screen must not touch state once it is gone.
    if (!mounted.current) return;
    setUploading(false);

    if (!up) {
      // A failed write is screen-specific, so it raises an inline Banner rather than
      // leaving a tick the server never accepted.
      haptics.error();
      setNotice({
        tone: 'danger',
        title: 'The document did not upload',
        message: 'It never reached the server, so the checklist has not been changed. Check your connection and try again.',
      });
      return;
    }

    // `demo://` is what the API layer returns when there is no real session, i.e. nothing
    // left this handset. That must never be reported as an upload.
    if (up.url.startsWith('demo://')) {
      haptics.warn();
      setNotice({
        tone: 'warning',
        title: 'The document was not sent',
        message: 'This session is not signed in to the register, so the file stayed on the handset. Sign in again and retry.',
      });
      return;
    }

    // The file is on the server. The register has no endpoint that links a file to a claim,
    // so the ONLY thing recorded here is the local checklist tick, and the group footer and
    // the caption under this button both say so. No timeline entry is fabricated: the
    // register did not log this, and inventing an entry signed with the user's name would
    // put a record on screen that no system anywhere is holding.
    const firstPending = claim.docs.find((d) => !d.received);
    if (firstPending) {
      setClaim({
        ...claim,
        docs: claim.docs.map((d) => (d.id === firstPending.id ? { ...d, received: true } : d)),
      });
      await api.toggleClaimDoc(claim.id, firstPending.id);
      if (!mounted.current) return;
    }

    setNotice(null);
    haptics.success();
    toast(firstPending
      ? `Uploaded. ${firstPending.name} ticked on your checklist.`
      : 'Document uploaded to the server.', 'success');
  };

  /* ---------- states ---------- */

  if (loading) {
    return (
      <Screen>
        <Header title="Claim" back />
        <DetailSkeleton />
      </Screen>
    );
  }

  if (!claim) {
    return (
      <Screen>
        <Header title="Claim" back />
        <Card style={{ margin: spacing.lg }}>
          {health.degraded ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="This claim did not load"
              subtitle="The server could not be reached, so we cannot confirm whether this claim still exists."
              action={{ label: 'Try again', onPress: retry }}
            />
          ) : (
            <EmptyState
              icon="alert-circle-outline"
              title="Claim not found"
              subtitle="It may have been closed, merged, or moved to another advisor's register."
              action={{ label: 'Back to claims', onPress: () => router.back() }}
            />
          )}
        </Card>
      </Screen>
    );
  }

  const st = CLAIM_STATUS[claim.status] ?? CLAIM_STATUS.intake;
  const pct = total > 0 ? received / total : 0;
  const complete = total > 0 && received === total;
  const stage = FLOW.indexOf(claim.status);
  const nextStatus = stage >= 0 && stage < FLOW.length - 1 ? FLOW[stage + 1] : null;
  const opened = safeDate(claim.openedAt, 'Date not recorded');
  const timeline = claim.timeline;
  const phone = claim.clientPhone;
  const docsMessage = `Namaste, regarding your ${claim.type} claim${claim.ref ? ` ${claim.ref}` : ''}, we need a few documents to proceed.`;

  return (
    <Screen>
      <Header
        title={claim.clientName}
        subtitle={`${claim.type} claim${claim.ref ? ` · ${claim.ref}` : ''}`}
        back
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* WHAT IS AT STAKE. */}
        <Appear>
          <Card>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Eyebrow>Claim amount</Eyebrow>
                {claim.amount > 0 ? (
                  <Metric value={inr(claim.amount)} size={font.display} style={{ marginTop: 3 }} />
                ) : (
                  <Txt size={font.h3} weight="800" style={{ marginTop: 5 }} numberOfLines={1}>
                    Amount not recorded
                  </Txt>
                )}
                <Txt size={font.sub} color={c.muted} numeric numberOfLines={2} style={{ marginTop: 4 }}>
                  {`Opened ${opened} · ${claim.ageDays} day${claim.ageDays === 1 ? '' : 's'} in progress`}
                </Txt>
              </View>
              <Pill label={st.label} tone={st.tone} />
            </Row>

            {!phone ? (
              <Txt size={font.cap} color={c.faint} numberOfLines={2} style={{ marginTop: spacing.md }}>
                No mobile number is on file for this claimant, so they cannot be reached from here.
              </Txt>
            ) : null}
          </Card>
        </Appear>

        {notice ? (
          <Banner
            tone={notice.tone}
            title={notice.title}
            message={notice.message}
            onDismiss={() => setNotice(null)}
          />
        ) : null}

        {claim.aiSummary ? (
          <Appear index={1}>
            <Card style={{ backgroundColor: c.primarySoft, borderColor: c.primary + '40' }}>
              <Row style={{ gap: spacing.sm, marginBottom: 6 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={c.primary} />
                <Txt size={13} weight="800" color={c.primary} numberOfLines={1}>Latest update</Txt>
              </Row>
              <Txt size={13.5} color={c.text} style={{ lineHeight: 20 }}>{claim.aiSummary}</Txt>
            </Card>
          </Appear>
        ) : null}

        {/* THE FACTS, grouped and copyable. */}
        <Appear index={2}>
          <ListSection title="Claim record" footer="Copy a reference straight into the insurer portal instead of retyping it.">
            <DataRow
              icon="pricetag-outline"
              label="Reference"
              value={claim.ref || 'Not issued'}
              copyable={!!claim.ref}
            />
            <DataRow
              icon="document-text-outline"
              label="Policy number"
              value={claim.policyNumber || 'Not recorded'}
              numeric={!!claim.policyNumber}
              copyable={!!claim.policyNumber}
            />
            <DataRow icon="business-outline" label="Insurer or TPA" value={claim.insurer || 'Not recorded'} />
            <DataRow icon="calendar-outline" label="Opened" value={opened} />
            {claim.clientPhone ? (
              <DataRow icon="call-outline" label="Claimant mobile" value={claim.clientPhone} numeric copyable />
            ) : null}
          </ListSection>
        </Appear>

        {/* THE WORK. */}
        <Appear index={3}>
          <View style={{ gap: spacing.md }}>
            {total > 0 ? (
              <ListSection
                title="Documents"
                footer="This checklist is a working note on your handset. Ticking a document does not update the register."
              >
                <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md }}>
                  <Meter
                    value={pct}
                    label="Checklist complete"
                    valueLabel={`${shownReceived}/${total}`}
                    tone={complete ? 'success' : pct === 0 ? 'warning' : 'primary'}
                  />
                </View>
                {docs.map((d, i) => (
                  <Appear key={d.id} index={i} distance={6}>
                    <Pressable
                      onPress={() => toggleDoc(d.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: d.received }}
                      accessibilityLabel={`${d.name}, ${d.received ? 'received' : 'still pending'}`}
                      style={({ pressed }) => [{
                        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                        minHeight: 52, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
                        backgroundColor: pressed ? c.cardAlt : 'transparent',
                      }]}
                    >
                      <Ionicons
                        name={d.received ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={d.received ? c.success : c.faint}
                      />
                      <Txt
                        size={14.5}
                        weight={d.received ? '400' : '600'}
                        color={d.received ? c.muted : c.text}
                        numberOfLines={2}
                        style={{ flex: 1, textDecorationLine: d.received ? 'line-through' : 'none' }}
                      >
                        {d.name}
                      </Txt>
                      <Pill
                        label={d.received ? 'Received' : 'Pending'}
                        tone={d.received ? 'success' : 'warning'}
                        small
                      />
                    </Pressable>
                  </Appear>
                ))}
              </ListSection>
            ) : (
              <Card padded={false}>
                <EmptyState
                  icon="document-attach-outline"
                  title="No checklist on this claim"
                  subtitle="The register did not list any required documents for this claim, so there is nothing to tick off yet."
                />
              </Card>
            )}

            <Button
              label={uploading ? 'Uploading' : 'Capture or upload a document'}
              icon="camera"
              variant="outline"
              full
              loading={uploading}
              onPress={capture}
            />
            <Txt size={font.cap} color={c.faint} numberOfLines={3} style={{ textAlign: 'center', lineHeight: 17 }}>
              Files go to the CGPE server. The register cannot link a file to a claim yet, so quote the reference when you tell the claims desk.
            </Txt>
          </View>
        </Appear>

        {/* THE STAGE, and why it cannot be moved from here.
            There is no status endpoint in data/api, so this control is DISABLED and says
            why. The previous build advanced the status in local state and toasted "Moved
            to under review", which read as saved, survived nothing, and would stop an
            advisor chasing the claims desk for a change that never happened. */}
        {nextStatus ? (
          <Appear index={4}>
            <View style={{ gap: spacing.sm }}>
              <Button
                label={`Move to ${CLAIM_STATUS[nextStatus].label.toLowerCase()}`}
                icon="lock-closed"
                size="lg"
                full
                disabled
              />
              <Txt size={font.cap} color={c.faint} numberOfLines={3} style={{ textAlign: 'center', lineHeight: 17 }}>
                Claim stage is set in the register. This app can read it, but it cannot save a change yet, so ask the claims desk to move it.
              </Txt>
            </View>
          </Appear>
        ) : null}

        {/* THE HISTORY. */}
        <Appear index={5}>
          <View>
            <SectionHeader title="Timeline" />
            <Card>
              {timeline.length > 0 ? (
                <Spine>
                  {timeline.map((t, i) => {
                    const time = safeTime(t.at);
                    const detail = [time, t.by].filter(Boolean).join(' · ');
                    return (
                      <SpineRow
                        key={t.id}
                        index={i}
                        last={i === timeline.length - 1}
                        time={safeDay(t.at, 'n/a')}
                        title={t.label}
                        subtitle={detail || undefined}
                        tone={i === timeline.length - 1 ? 'primary' : 'neutral'}
                      />
                    );
                  })}
                </Spine>
              ) : (
                <EmptyState
                  icon="time-outline"
                  title="No history recorded"
                  subtitle="The register has not logged any movement on this claim yet."
                />
              )}
            </Card>
          </View>
        </Appear>
      </ScrollView>

      {/* The two things this screen can genuinely DO, permanently in thumb reach. Chasing
          a document is the whole job of a claim, and both actions leave the app, so they
          are the honest primary actions here. */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.md,
        backgroundColor: c.bgElevated,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: c.border,
      }}>
        <IconBtn
          icon="call"
          size={48}
          bg={c.primarySoft}
          color={c.primary}
          disabled={!phone}
          onPress={() => { haptics.tap(); call(phone); }}
          accessibilityLabel={`Call ${claim.clientName}`}
        />
        <Button
          label="Request documents"
          icon="logo-whatsapp"
          variant="whatsapp"
          full
          disabled={!phone}
          onPress={() => { haptics.tap(); whatsapp(phone, docsMessage); }}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}
