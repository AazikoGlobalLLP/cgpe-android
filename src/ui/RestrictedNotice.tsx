import React from 'react';
import { View } from 'react-native';
import { spacing } from '@/theme/theme';
import { Header, Screen } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { EmptyState } from '@/ui/feedback';

/**
 * A role-restricted screen — the `payroll.tsx` early-return pattern, factored out so every
 * surface gated to master/admin (the client book and its sub-views, Point 9, 2026-08-24) shows
 * ONE consistent "you don't have access here" panel instead of an empty list or a raw redirect.
 *
 * This is UX + defence-in-depth. The SECURITY AUTHORITY is the server endpoint (e.g. the role
 * gate on `GET /clients`, filed for the owner to relay); this panel only stops the app from
 * inviting a team member into a screen they may not use.
 */
export function RestrictedNotice({
  title,
  heading,
  subtitle,
  icon = 'lock-closed-outline',
  back = true,
}: {
  title: string;
  heading: string;
  subtitle: string;
  icon?: IconName;
  back?: boolean;
}) {
  return (
    <Screen>
      <Header title={title} back={back} />
      <View style={{ padding: spacing.lg }}>
        <EmptyState icon={icon} title={heading} subtitle={subtitle} />
      </View>
    </Screen>
  );
}
