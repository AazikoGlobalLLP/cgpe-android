import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { font, spacing, useTheme } from '@/theme/theme';
import { Card, Header, Screen, Txt } from '@/ui/base';
import { Button } from '@/ui/controls';
import { Banner } from '@/ui/feedback';
import { Appear } from '@/ui/motion';
import { haptics } from '@/lib/haptics';
import { useT } from '@/i18n';
import { setLocationConsent } from '@/data/api';

/* ------------------------------------------------------------------ *
 * PHASE 41a-ii — the 24/7 location consent notice.
 *
 * "Bata ke, puch ke" (PHASE-41 §0/§1): the notice is transparent, informed and MANDATORY.
 * Every string is owner-supplied human copy in all 5 languages (docs/i18n/PHASE-41-CONSENT-COPY.md);
 * nothing is fabricated and nothing is machine-translated. The screen never claims consent it did
 * not record — only a real 200 from `setLocationConsent` (Phase 43) lets the user proceed.
 *
 * There is deliberately NO back affordance and NO skip: declining shows an honest "you cannot
 * continue" state, not a way around the gate. Agreeing is the only path forward.
 *
 * NOT YET AUTO-GATED. This is the screen + the write. Reading `me.location_consent` off
 * GET /rbac/config to DECIDE when to show it (and starting the ambient recorder on grant) is the
 * next, device-checked slice — the app does not read the `me` block yet.
 * ------------------------------------------------------------------ */

/**
 * The consent-notice version stamped on the write, so a materially changed notice can force
 * re-consent later (backend `location_consent.version`). Tracks the owner's copy version
 * (translation-v.01, 2026-08-14) — bump it only when the notice text materially changes.
 */
const CONSENT_NOTICE_VERSION = 'v.01';

/** The five informational lines of the notice, in reading order. Each is a self-describing
 *  human string ("What is shared: …", "Why: …") — no icon or label is synthesised on top. */
const NOTICE_KEYS = [
  'consent.collect',
  'consent.why',
  'consent.who',
  'consent.retention',
  'consent.transparent',
] as const;

export default function Consent() {
  const c = useTheme();
  const router = useRouter();
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [failure, setFailure] = useState(false);

  // The write is an await that can outlive this screen; a late result must not set state on it.
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const onAgree = async () => {
    setFailure(false);
    setSaving(true);
    const r = await setLocationConsent(true, CONSENT_NOTICE_VERSION);
    if (!live.current) return;
    if (r.status === 'ok') {
      haptics.success();
      // Proceed into the app. When this screen becomes a boot gate, the gate redirects here and
      // this replace lands the now-consented user on Home with no way back to the pre-consent state.
      router.replace('/(tabs)/home');
      return;
    }
    // Not recorded — never pretend it was. The user stays on the notice and can retry.
    setSaving(false);
    haptics.error();
    setFailure(true);
  };

  const onDecline = () => {
    haptics.warn();
    setDeclined(true);
  };

  if (declined) {
    return (
      <Screen>
        <Header title={t('consent.title')} />
        <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.xl }}>
          <Appear>
            <Card style={{ borderColor: c.danger + '40', gap: spacing.md }}>
              <Txt size={font.h3} weight="800" color={c.danger}>{t('consent.declineTitle')}</Txt>
              <Txt size={font.sub} color={c.muted} style={{ lineHeight: 21 }}>{t('consent.declineBody')}</Txt>
            </Card>
          </Appear>
          <Button label={t('consent.declineBack')} variant="primary" full onPress={() => setDeclined(false)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t('consent.title')} />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 24, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {failure ? (
          <Banner
            tone="danger"
            title={t('consent.title')}
            message={t('consent.declineBody')}
            action={{ label: t('consent.agreeButton'), onPress: () => void onAgree() }}
            onDismiss={() => setFailure(false)}
          />
        ) : null}

        <Appear>
          <Txt size={font.body} color={c.text} style={{ lineHeight: 22 }}>{t('consent.intro')}</Txt>
        </Appear>

        <Appear index={1}>
          <Card style={{ gap: spacing.md }}>
            {NOTICE_KEYS.map((k) => (
              <Txt key={k} size={font.sub} color={c.text} style={{ lineHeight: 21 }}>{t(k)}</Txt>
            ))}
          </Card>
        </Appear>

        <Appear index={2}>
          <Txt size={font.sub} weight="700" color={c.text} style={{ lineHeight: 21 }}>{t('consent.mandatory')}</Txt>
        </Appear>

        <Appear index={3}>
          <Txt size={font.cap} color={c.muted} style={{ lineHeight: 19 }}>{t('consent.withdraw')}</Txt>
        </Appear>
      </ScrollView>

      {/* Actions pinned below the scroll so Agree/Decline are always reachable. */}
      <View style={{ padding: spacing.lg, paddingTop: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: c.hairline }}>
        <Button label={t('consent.agreeButton')} variant="primary" full loading={saving} onPress={onAgree} />
        <Button label={t('consent.declineButton')} variant="ghost" full disabled={saving} onPress={onDecline} />
      </View>
    </Screen>
  );
}
