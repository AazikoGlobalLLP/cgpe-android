import React, { useEffect, useRef, useState } from 'react';
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
import { useAuth } from '@/store/auth';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * Account and privacy — including the deletion path the app stores require.
 *
 * THE TWO-STEP CONFIRM IS DELIBERATE AND IS PRESERVED EXACTLY. The first dialog states
 * what is destroyed; the second one makes you say it again in different words. Account
 * deletion is the only irreversible action in this app, and a single tap-through
 * confirmation is not a real gate.
 *
 * A REFUSED DELETE RAISES A BANNER, NOT A TOAST. If the server does not confirm the
 * deletion, the user needs to know their account still exists and that nothing was half
 * done. A toast that vanishes in three seconds is the wrong carrier for that: it can be
 * missed entirely, and the user is left unsure whether their data is gone.
 *
 * HAPTICS: `warn` before the destructive confirm opens, `success` only once the server
 * has actually accepted the deletion, `error` when it refuses. Nothing on plain reads.
 * ------------------------------------------------------------------ */

const PRIVACY_URL = 'https://cgpe.in/privacy';

export default function Account() {
  const c = useTheme();
  const t = useT();
  const router = useRouter();
  const { user, ready, deleteAccount } = useAuth();
  const { confirm } = useConfirm();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * False once this screen is gone. Both confirms and the delete request are awaits that
   * can outlive it: the modal is dismissible and the back gesture works behind it, so a
   * refusal must not try to raise a banner on a screen that is no longer there.
   */
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const confirmDelete = async () => {
    // The pause before an irreversible dialog is the point of this one.
    haptics.warn();
    const first = await confirm({
      title: 'Delete your account?',
      message: 'This permanently deletes your CGPE Connect account and all associated personal data (profile, leads, client notes). This cannot be undone.',
      confirmText: t('common.continue'),
      destructive: true,
      icon: 'trash',
    });
    if (!first) return;

    const second = await confirm({
      title: 'Are you absolutely sure?',
      message: 'Your data will be erased. This action is irreversible.',
      confirmText: 'Yes, delete everything',
      cancelText: 'Keep my account',
      destructive: true,
    });
    if (second && live.current) await runDelete();
  };

  const runDelete = async () => {
    setFailure(null);
    setDeleting(true);
    try {
      await deleteAccount();
      haptics.success();
      router.replace('/(auth)/login');
    } catch (e) {
      if (!live.current) return;
      setDeleting(false);
      haptics.error();
      /* `unsupported` means the route is not there — today that is every call, because the
       * backend declares no DELETE on /auth/me. Telling that user to check their connection
       * would send them round a loop that cannot succeed, so the retry sentence is dropped.
       * Both strings are the existing copy; nothing new is invented here. */
      const reason = (e as { reason?: string } | null)?.reason;
      setFailure(
        reason === 'unsupported'
          ? 'The server did not confirm the deletion, so your account is unchanged.'
          : 'The server did not confirm the deletion, so your account is unchanged. Check your connection and try again.',
      );
    }
  };

  const openPrivacy = () => {
    Linking.openURL(PRIVACY_URL).catch(() => {
      toast('Could not open the browser. The policy is at cgpe.in/privacy.', 'warning');
    });
  };

  const exportData = () => {
    haptics.tap();
    // There is no in-app data-export endpoint — nothing was ever sent, so a 'success' toast claiming
    // "will be emailed to you" was a false assertion on a privacy screen. Say plainly it is not yet
    // available in the app and point to the privacy policy, which describes how to request a copy.
    toast('Getting a copy of your data is not available in the app yet — the privacy policy explains how to request it.', 'info');
  };

  if (!ready) {
    return (
      <Screen>
        <Header title="Account and privacy" back />
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
        <Header title="Account and privacy" back />
        <EmptyState
          icon="shield-outline"
          title="You are signed out"
          subtitle="Sign in to export your data or to delete your account. You can also request deletion at cgpe.in/delete-account."
          action={{ label: t('common.goToSignIn'), onPress: () => router.replace('/(auth)/login') }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Account and privacy" back />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {failure ? (
          <Banner
            tone="danger"
            title="Your account was not deleted"
            message={failure}
            // Re-runs the full two-step confirm. A one-tap retry on a banner would be a
            // back door around the gate the rest of this screen exists to build.
            action={{ label: t('common.tryAgain'), onPress: () => void confirmDelete() }}
            onDismiss={() => setFailure(null)}
          />
        ) : null}

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
          title="Your data is protected"
          message="Encrypted in transit. We follow India's DPDP Act for personal and policy data."
        />

        <ListSection title="Your data" footer="An export is sent to the address on your account.">
          <Appear index={0}>
            <DataRow
              icon="download-outline"
              label="Export my data"
              value=""
              onPress={exportData}
            />
          </Appear>
          <Appear index={1}>
            <DataRow
              icon="document-text-outline"
              label="Privacy policy"
              value="cgpe.in"
              onPress={openPrivacy}
            />
          </Appear>
        </ListSection>

        {/* The single Eyebrow on this screen, and it is spent on the one block that must
            not be mistaken for another settings group. */}
        <View style={{ gap: spacing.sm }}>
          <Eyebrow color={c.danger} style={{ marginLeft: spacing.xs }}>Danger zone</Eyebrow>
          <Card style={{ borderColor: c.danger + '40' }}>
            <Txt size={font.h3} weight="800" color={c.danger}>Delete account</Txt>
            <Txt size={font.sub} color={c.muted} style={{ marginTop: spacing.sm, lineHeight: 20 }}>
              Permanently delete your account and all associated personal data. You can also request
              deletion at{' '}
              <Txt size={font.sub} weight="700" color={c.primary}>cgpe.in/delete-account</Txt>. This
              action is irreversible.
            </Txt>
            <Button
              label="Delete my account"
              icon="trash-outline"
              variant="danger"
              full
              onPress={confirmDelete}
              loading={deleting}
              style={{ marginTop: spacing.lg }}
            />
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}
