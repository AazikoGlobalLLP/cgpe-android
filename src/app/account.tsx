import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Row, Screen, Txt } from '@/ui/base';
import { Button } from '@/ui/controls';
import { Banner, EmptyState, Skeleton, useToast } from '@/ui/feedback';
import { DataRow, ListSection } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { Appear } from '@/ui/motion';
import { useConfirm } from '@/ui/Confirm';
import { haptics } from '@/lib/haptics';
import * as api from '@/data/api';
import { useAuth } from '@/store/auth';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * Account and privacy. Deletion is a REQUEST FOR REVIEW, not erasure. The September 7
 * contract leaves fulfillment to a separate owner policy; even a 202 keeps this session,
 * biometric binding and offline drafts intact. Never reconnect the old deletion cleanup.
 * ------------------------------------------------------------------ */

const PRIVACY_URL = 'https://cgpe.in/privacy';

function DeletionRequestPanel() {
  const c = useTheme();
  const t = useT();
  const { confirm } = useConfirm();
  const [request, setRequest] = useState<api.AccountDeletionRequest | null>(null);
  const [reading, setReading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const live = useRef(true);
  const busy = useRef(false);
  const readingRef = useRef(false);
  const readId = useRef(0);

  const refresh = useCallback(async () => {
    if (busy.current || readingRef.current) return;
    readingRef.current = true;
    const id = ++readId.current;
    setReading(true);
    setFailure(null);
    const res = await api.getAccountDeletionRequest();
    if (!live.current || id !== readId.current) return;
    readingRef.current = false;
    setReading(false);
    if (res.ok) setRequest(res.request);
    else setFailure(res.reason === 'unsupported'
      ? t('account.deletionUnavailable')
      : res.reason === 'forbidden'
        ? t('account.deletionReadForbidden')
        : t('account.deletionRefreshFailed'));
  }, [t]);

  useEffect(() => {
    live.current = true;
    void refresh();
    return () => { live.current = false; readingRef.current = false; ++readId.current; };
  }, [refresh]);

  const submit = async () => {
    // Guard the dialog too: state alone does not close the double-tap window before a render.
    if (busy.current || readingRef.current || reading || request || failure) return;
    busy.current = true;
    setSubmitting(true);
    try {
      const accepted = await confirm({
        title: t('account.deletionConfirmTitle'),
        message: t('account.deletionConfirmBody'),
        confirmText: t('account.deletionSubmit'),
        cancelText: t('common.cancel'),
        icon: 'document-text-outline',
      });
      if (!accepted || !live.current) return;
      ++readId.current; // An older status read must never overwrite the accepted submission.
      const res = await api.requestAccountDeletion();
      if (!live.current) return;
      if (res.ok) {
        setRequest(res.request);
        haptics.success();
      } else {
        haptics.error();
        setFailure(res.reason === 'unsupported'
          ? t('account.deletionUnavailable')
          : res.reason === 'forbidden'
            ? t('account.deletionSubmitForbidden')
            : t('account.deletionSubmitFailed'));
      }
    } finally {
      busy.current = false;
      if (live.current) setSubmitting(false);
    }
  };

  const statusLabel = request?.status === 'pending' ? t('account.deletionPending')
    : request?.status === 'under_review' ? t('claimStatus.review') : t('account.deletionRejected');

  return (
    <View style={{ gap: spacing.sm }}>
      <Eyebrow style={{ marginLeft: spacing.xs }}>{t('account.deletionEyebrow')}</Eyebrow>
      <Card>
        <Txt size={font.h3} weight="800">{t('account.deletionTitle')}</Txt>
        <Txt size={font.sub} color={c.muted} style={{ marginTop: spacing.sm, lineHeight: 20 }}>
          {t('account.deletionDescription')}
        </Txt>
        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          {reading ? <Skeleton height={48} radius={radius.md} /> : null}
          {!reading && failure ? <Banner tone="warning" title={t('account.deletionStatusUnconfirmed')} message={failure} /> : null}
          {!reading && request ? (
            <Banner
              tone={request.status === 'rejected' ? 'warning' : 'info'}
              title={failure ? t('account.deletionLastKnown', { statusLabel }) : statusLabel}
              message={request.reviewNotes || (request.status === 'rejected'
                ? t('account.deletionRejectedBody')
                : t('account.deletionRecordedBody'))}
            />
          ) : null}
          {!reading && !request && !failure ? (
            <Button label={t('account.deletionAction')} icon="document-text-outline" full onPress={() => void submit()} loading={submitting} />
          ) : null}
          <Button label={t('common.refresh')} variant="outline" icon="refresh-outline" full
            onPress={() => void refresh()} disabled={reading || submitting} />
        </View>
      </Card>
    </View>
  );
}

export default function Account() {
  const c = useTheme();
  const t = useT();
  const router = useRouter();
  const { user, ready } = useAuth();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);

  /**
   * An export response may arrive after navigation away; do not update an unmounted screen.
   */
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const openPrivacy = () => {
    Linking.openURL(PRIVACY_URL).catch(() => {
      toast(t('account.privacyOpenFailed'), 'warning');
    });
  };

  const exportData = async () => {
    // Ref-guard, not the `exporting` state: a double-tap must not fire two export requests before the
    // first render disables the row (the recorder-race lesson).
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    haptics.tap();
    try {
      const res = await api.exportAccountData();
      if (!live.current) return;
      if (res.ok) {
        // The server returns a short-lived SIGNED link (no auth header) — open it in the system
        // browser, which downloads the workbook. The app never handles the bytes.
        toast(t('account.exportReady'), 'success');
        Linking.openURL(res.downloadUrl).catch(() => toast(t('account.exportOpenFailed'), 'warning'));
      } else if (res.reason === 'not_available') {
        // The endpoint is not deployed on this server yet — honest, not a transient error.
        toast(t('account.exportUnavailable'), 'info');
      } else {
        toast(t('account.exportFailed'), 'warning');
      }
    } finally {
      if (live.current) setExporting(false);
      exportingRef.current = false;
    }
  };

  if (!ready) {
    return (
      <Screen>
        <Header title={t('more.accountTitle')} back />
        <View style={{ padding: spacing.lg, gap: spacing.xl }}>
          <Card>
            <Row>
              <Skeleton width={52} height={52} radius={20} />
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Skeleton width="56%" height={14} />
                <Skeleton width="70%" height={11} />
              </View>
            </Row>
          </Card>
          <Skeleton height={64} radius={radius.md} />
          <Card padded={false}>
            <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
              {[0, 1].map((i) => (
                <View key={i}>
                  {i > 0 ? (
                    <View style={{
                      height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: spacing.lg,
                    }} />
                  ) : null}
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48,
                    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
                  }}>
                    <Skeleton width={16} height={16} radius={5} />
                    <Skeleton width="42%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen>
        <Header title={t('more.accountTitle')} back />
        <EmptyState
          icon="shield-outline"
          title={t('account.signedOut')}
          subtitle={t('account.signedOutBody')}
          action={{ label: t('common.goToSignIn'), onPress: () => router.replace('/(auth)/login') }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t('more.accountTitle')} back />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Appear>
          <Card>
            <PersonRow
              name={user.name}
              subtitle={user.email}
              photo={user.photo}
              size={52}
            />
          </Card>
        </Appear>

        {/* Not wrapped in Appear: Banner already plays its own entrance, and stacking the
            two reads as a stutter rather than as one arrival. */}
        <Banner
          tone="success"
          title={t('account.dataProtected')}
          message={t('account.dataProtectionBody')}
        />

        <ListSection title={t('account.yourData')} footer={t('account.exportDescription')}>
          <Appear index={0}>
            <DataRow
              icon="download-outline"
              label={t('account.export')}
              value={exporting ? t('account.preparing') : ''}
              onPress={exportData}
            />
          </Appear>
          <Appear index={1}>
            <DataRow
              icon="document-text-outline"
              label={t('account.privacy')}
              value="cgpe.in"
              onPress={openPrivacy}
            />
          </Appear>
        </ListSection>

        {/* A new identity remounts the panel; late status replies cannot bleed between users. */}
        <DeletionRequestPanel key={user.id} />
      </ScrollView>
    </Screen>
  );
}
