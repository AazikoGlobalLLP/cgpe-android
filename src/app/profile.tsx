import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { radius, spacing, useTheme } from '@/theme/theme';
import { Card, Header, Row, Screen } from '@/ui/base';
import { IconBtn } from '@/ui/controls';
import { EmptyState, Skeleton } from '@/ui/feedback';
import { DataRow, ListSection, Pill } from '@/ui/data';
import { PersonRow } from '@/ui/identity';
import { Appear } from '@/ui/motion';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/store/auth';
import { call, email } from '@/lib/actions';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ *
 * My profile — who the app thinks you are.
 *
 * THE AZURE HERO BAND IS GONE. A full-bleed coloured header with white text on it is the
 * house style of every template CRM, and it forced a second set of colours (white-on-
 * primary pills, a white-on-primary back button) that exist nowhere else in the app. The
 * identity now sits in a normal `Card` on the normal surface: `PersonRow` for the avatar
 * and name, `Pill`s for the facts that are badges rather than fields.
 *
 * THE DETAIL ROWS ARE COPYABLE. An agent code, a branch phone and a work email are things
 * people retype into other apps by hand, one digit wrong. `DataRow`'s copy affordance is
 * the entire reason this screen is worth opening twice.
 *
 * NO FIGURES ARE INVENTED HERE. There is no premium total, no policy count and no rank on
 * this screen, because `useAuth().user` does not carry them and a profile is exactly the
 * kind of page where a plausible-looking fabricated number would go unquestioned.
 * ------------------------------------------------------------------ */

export default function Profile() {
  const t = useT();
  const router = useRouter();
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <Screen>
        <Header title="My profile" back />
        <View style={{ padding: spacing.lg, gap: spacing.xl }}>
          <Card>
            <Row>
              <Skeleton width={64} height={64} radius={25} />
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Skeleton width="62%" height={15} />
                <Skeleton width="44%" height={12} />
              </View>
            </Row>
            <Row style={{ marginTop: spacing.lg }}>
              <Skeleton width={92} height={22} radius={radius.pill} />
              <Skeleton width={72} height={22} radius={radius.pill} />
            </Row>
          </Card>
          <DetailSkeleton rows={3} />
          <DetailSkeleton rows={3} />
        </View>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen>
        <Header title="My profile" back />
        <EmptyState
          icon="person-circle-outline"
          title="You are signed out"
          subtitle="Sign in again to see your agent code, branch and contact details."
          action={{ label: t('common.goToSignIn'), onPress: () => router.replace('/(auth)/login') }}
        />
      </Screen>
    );
  }

  const hasPhone = !!user.phone;
  const hasEmail = !!user.email;

  const dial = () => { haptics.tap(); call(user.phone); };
  const compose = () => { haptics.tap(); email(user.email); };

  return (
    <Screen>
      <Header
        title="My profile"
        back
        right={
          <IconBtn
            icon="settings-outline"
            onPress={() => router.push('/settings')}
            accessibilityLabel={t('consent.blockedAction')}
          />
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Appear>
          <Card>
            <PersonRow
              name={user.name}
              subtitle={user.designation}
              photo={user.photo}
              size={64}
            />
            <Row style={{ marginTop: spacing.md, flexWrap: 'wrap', gap: spacing.sm }}>
              <Pill label={`${user.tier} Club`} tone="warning" icon="star" small />
              {user.agentCode ? <Pill label={user.agentCode} tone="neutral" icon="id-card" small numeric /> : null}
              {user.branch ? <Pill label={user.branch} tone="info" icon="business" small /> : null}
            </Row>
          </Card>
        </Appear>

        <ListSection
          title="Contact"
          footer="Tap a row to open your dialler or mail app. Tap the copy icon to put the value on the clipboard."
        >
          <Appear index={0}>
            <DataRow
              icon="call-outline"
              label={t('common.mobile')}
              value={hasPhone ? user.phone : 'Not on file'}
              tone={hasPhone ? 'neutral' : 'warning'}
              copyable={hasPhone}
              onPress={hasPhone ? dial : undefined}
            />
          </Appear>
          <Appear index={1}>
            <DataRow
              icon="mail-outline"
              label="Email"
              value={hasEmail ? user.email : 'Not on file'}
              tone={hasEmail ? 'neutral' : 'warning'}
              copyable={hasEmail}
              onPress={hasEmail ? compose : undefined}
            />
          </Appear>
          <Appear index={2}>
            <DataRow icon="business-outline" label="Branch" value={user.branch || 'Not on file'} />
          </Appear>
        </ListSection>

        <ListSection
          title="Role"
          footer="Access level is set by your administrator. Ask them if something here looks wrong."
        >
          <Appear index={0}>
            <DataRow
              icon="shield-checkmark-outline"
              label="Access level"
              value={user.role.replace(/_/g, ' ')}
            />
          </Appear>
          {user.department ? (
            <Appear index={1}>
              <DataRow icon="briefcase-outline" label="Department" value={user.department} />
            </Appear>
          ) : null}
          {user.agentCode ? (
            <Appear index={2}>
              <DataRow icon="id-card-outline" label="Agent code" value={user.agentCode} copyable numeric />
            </Appear>
          ) : null}
          <Appear index={3}>
            <DataRow icon="ribbon-outline" label="Club tier" value={user.tier} />
          </Appear>
        </ListSection>
      </ScrollView>
    </Screen>
  );
}

/* Mirrors ListSection's geometry so the page does not resettle when the session lands. */
function DetailSkeleton({ rows }: { rows: number }) {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Skeleton width={64} height={10} style={{ marginLeft: spacing.xs }} />
      <Card padded={false}>
        <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
          {Array.from({ length: rows }, (_, i) => (
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
                <Skeleton width="34%" height={12} />
                <View style={{ flex: 1 }} />
                <Skeleton width="38%" height={12} />
              </View>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}
