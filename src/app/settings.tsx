import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { font, radius, spacing, useTheme } from '@/theme/theme';
import { Card, Header, Screen, Txt } from '@/ui/base';
import { Banner, Skeleton, useToast } from '@/ui/feedback';
import type { FeedbackTone } from '@/ui/feedback';
import { DataRow, ListSection } from '@/ui/data';
import { Appear } from '@/ui/motion';
import { useConfirm } from '@/ui/Confirm';
import { CacheCleaner } from '@/ui/CacheCleaner';
import { describeCacheClear } from '@/lib/appCache';
import type { CacheClearResult } from '@/lib/appCache';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/store/auth';
import { LANGS, useI18n } from '@/i18n';
import type { Lang } from '@/i18n';
import { testConnection } from '@/data/api';
import { APP, REQUEST_TIMEOUT } from '@/constants/config';
import { versionLine } from '@/lib/buildInfo';

/* ------------------------------------------------------------------ *
 * Settings — grouped rows, real switches, honest failures.
 *
 * EVERY TOGGLE ON THIS SCREEN NOW PERSISTS. "WhatsApp alerts" used to be a `useState`
 * with nowhere to go: it moved under the thumb and forgot on the next mount. A switch
 * that does not remember is worse than no switch, because it teaches the user that the
 * settings screen is decorative.
 *
 * REFUSALS ARE SHOWN, NOT SWALLOWED. Enabling biometric unlock can fail for two very
 * different reasons — nothing enrolled on the handset, or the prompt was not satisfied —
 * and each one needs a different action from the user. A toast disappears before either
 * can be acted on, so a refusal raises an inline `Banner` and a `haptics.warn`, and the
 * switch springs back to its true state rather than lying about what the OS accepted.
 *
 * LANGUAGE IS A LIST, AND STILL NOT A MODAL PICKER. It was a segmented control while
 * there were three options; five do not fit. Segments divide the width equally, so on a
 * 320pt handset "Roman Gujarati" would be truncated into something the user has to guess
 * at, and truncation is fatal here because the choice is between names that START THE
 * SAME: Hindi and Hinglish, Gujarati and Roman Gujarati. Rows give every option its full
 * English name, its native name and a tick, all visible without opening anything.
 *
 * THE TWO GROUPS ARE THE POINT. An advisor who reads Gujarati fluently and an advisor who
 * only reads the Roman alphabet want different things from the same regional language,
 * and a flat list of five reads as five unrelated languages. The captions plus one line
 * of helper copy under the romanized group are what stop "Hindi" and "Hinglish" being
 * chosen by coin toss.
 *
 * NOTHING LANDS ON A SCREEN THAT HAS GONE. The biometric toggle awaits a native OS modal
 * that can stay open for as long as the user leaves it open, and the back gesture still
 * works underneath it. `live` is checked after every await, in the handlers as well as in
 * the effect, so a refusal cannot try to move a switch on an unmounted screen.
 * ------------------------------------------------------------------ */

const PUSH_KEY = 'cgpe.push';
const WA_KEY = 'cgpe.waAlerts';

type Notice = { tone: FeedbackTone; title: string; message: string };

/**
 * A romanized option is a regional language written in the English alphabet, and its code
 * carries the '-en' suffix ('hi-en', 'gu-en'). Splitting on the suffix rather than on a
 * hard-coded pair of codes means a sixth language lands in the right group on its own, and
 * that plain 'en' stays where it belongs (it does not end in '-en').
 *
 * Computed once at module scope: LANGS is a constant, so re-filtering it on every keystroke
 * of a re-render would be work for nothing. An empty group renders nothing at all, because
 * ListSection drops itself when it has no children.
 */
const isRomanized = (code: Lang) => code.endsWith('-en');
const SCRIPT_LANGS = LANGS.filter((l) => !isRomanized(l.code));
const ROMAN_LANGS = LANGS.filter((l) => isRomanized(l.code));

export default function Settings() {
  const c = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { lang, setLang, t } = useI18n();
  const { biometricEnabled, biometricAvailable, setBiometric } = useAuth();

  const [bio, setBio] = useState(biometricEnabled);
  const [push, setPush] = useState(true);
  const [waAlerts, setWaAlerts] = useState(true);
  const [prefsReady, setPrefsReady] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  /** PHASE 55 — the last connectivity-test verdict shown inline on the row; '' before the first run. */
  const [connMsg, setConnMsg] = useState('');
  const [testing, setTesting] = useState(false);
  /** PHASE 77 — true only while the throwaway WebView that clears the tile cache is mounted. */
  const [clearing, setClearing] = useState(false);

  /** False once this screen is gone. Read after every await, not just inside effects. */
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  useEffect(() => { setBio(biometricEnabled); }, [biometricEnabled]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [p, w] = await Promise.all([
          AsyncStorage.getItem(PUSH_KEY),
          AsyncStorage.getItem(WA_KEY),
        ]);
        if (!alive) return;
        if (p != null) setPush(p === '1');
        if (w != null) setWaAlerts(w === '1');
      } catch {
        // No stored preference reachable: the defaults above stand, both switches on.
      } finally {
        if (alive) setPrefsReady(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const toggleBio = async (v: boolean) => {
    if (v && !biometricAvailable) {
      haptics.warn();
      setNotice({
        tone: 'warning',
        title: 'No fingerprint or face unlock on this device',
        message: 'Enrol one in your phone settings, then turn this on again.',
      });
      return;
    }
    setNotice(null);
    // The OS prompt is a modal the user can leave sitting there, and the back gesture
    // still works behind it, so this await can outlive the screen.
    const ok = await setBiometric(v);
    if (!live.current) return;
    setBio(ok ? v : false);
    if (ok) {
      haptics.success();
      toast(v ? 'Biometric unlock enabled' : 'Biometric unlock disabled', 'success');
      return;
    }
    haptics.warn();
    setNotice({
      tone: 'warning',
      title: 'Biometric unlock was not enabled',
      message: 'The device did not confirm your identity, so the setting was left off.',
    });
  };

  /** Both notification switches write the same way, so they share one committer. */
  const persistToggle = async (
    key: string,
    v: boolean,
    apply: (next: boolean) => void,
    name: string,
  ) => {
    haptics.tap();
    apply(v);
    try {
      await AsyncStorage.setItem(key, v ? '1' : '0');
    } catch {
      if (!live.current) return;
      haptics.error();
      apply(!v);
      setNotice({
        tone: 'danger',
        title: `${name} could not be saved`,
        message: 'The switch was put back to where it was. Try again in a moment.',
      });
    }
  };

  /**
   * Takes the whole option rather than the code so the confirmation can NAME the language.
   * "Language updated" is useless on a screen where the labels around the toast have just
   * changed script: the one thing the user needs told is which of five they landed on. The
   * confirmation stays in English on purpose, because the reader may have mis-tapped into a
   * script they cannot read and this line is their way back.
   */
  const changeLang = (opt: { code: Lang; label: string }) => {
    if (opt.code === lang) return;   // already selected: no haptic, no toast, no noise
    haptics.select();
    setLang(opt.code);
    toast(`Language changed to ${opt.label}`, 'success');
  };

  /**
   * PHASE 55 — the "app vs WiFi" self-test. Pings the unauthenticated /health directly and turns the
   * result into a plain-language verdict the owner can act on in the field: reachable-but-a-screen-is-
   * empty points at the data/sign-in, a timeout points at a very slow link, a throw points at the WiFi
   * itself (with the definitive browser check to confirm). Honest either way — it never says "fine"
   * unless the server actually answered.
   */
  const runConnectionTest = async () => {
    if (testing) return;
    haptics.tap();
    setTesting(true);
    setConnMsg('Testing…');
    setNotice(null);
    const r = await testConnection();
    if (!live.current) return;
    setTesting(false);
    if (r.ok) {
      haptics.success();
      setConnMsg(`Reached in ${r.ms} ms`);
      setNotice({
        tone: 'success',
        title: 'Connected to the CGPE server',
        message: `It answered in ${r.ms} ms on this network. If a screen still shows no data, the problem is the data itself or your sign-in — not the connection.`,
      });
      return;
    }
    haptics.warn();
    const detail =
      r.kind === 'timeout'
        ? {
            value: 'Too slow',
            title: 'The server did not answer in time',
            message: `No reply within ${Math.round(REQUEST_TIMEOUT / 1000)} seconds on this network. The connection is very slow — try mobile data or a different WiFi.`,
          }
        : r.kind === 'server'
        ? {
            value: `Error ${r.status ?? ''}`.trim(),
            title: 'The server answered with an error',
            message: `The server is reachable but returned ${r.status ?? 'an error'}. That is a server problem, not your network — please report it.`,
          }
        : {
            value: 'No connection',
            title: 'Cannot reach the CGPE server',
            message:
              'This network cannot reach cgpe.in. Open https://cgpe.in/internal/api/health in this phone’s browser on the same WiFi — if that also fails, it is the WiFi (captive portal or firewall), not the app.',
          };
    setConnMsg(detail.value);
    setNotice({ tone: 'danger', title: detail.title, message: detail.message });
  };

  /**
   * PHASE 77 — "the app installs at 63 MB and becomes 125 MB". Three things grow; see
   * `lib/appCache.ts` for which and for whom. The one that affects every user is the copy each
   * picker leaves in the cache directory for every document and photo ever attached, which
   * nothing has ever deleted. Map tiles matter too but only for master/admin, who are the only
   * roles that can open a map at all.
   *
   * The confirm is not ceremony: clearing costs the user their offline map imagery, on a network
   * already known to be fragile. That trade is stated before it is made, not discovered later at
   * the roadside. It deliberately does NOT promise an amount of space — nothing underneath can
   * measure one, and the phone's own Storage screen can.
   */
  const clearCaches = async () => {
    if (clearing) return;
    haptics.tap();
    const go = await confirm({
      title: t('storage.confirmTitle'),
      message: t('storage.confirmBody'),
      confirmText: t('storage.clearCta'),
      cancelText: t('common.cancel'),
      icon: 'trash-outline',
    });
    if (!go || !live.current) return;
    setNotice(null);
    setClearing(true);
  };

  const onCacheCleared = (r: CacheClearResult) => {
    setClearing(false);
    if (!live.current) return;
    // `describeCacheClear` hands back an i18n KEY, not a sentence, so the outcome copy is
    // translated like everything else on this screen rather than being English-only.
    const said = describeCacheClear(r);
    if (said.tone === 'success') haptics.success();
    else haptics.warn();
    toast(t(said.messageKey), said.tone === 'success' ? 'success' : 'info');
  };

  const themeValue = c.scheme === 'dark' ? 'Dark, follows system' : 'Light, follows system';

  return (
    <Screen>
      <Header title={t('settings.title')} back />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {notice ? (
          <Banner
            tone={notice.tone}
            title={notice.title}
            message={notice.message}
            onDismiss={() => setNotice(null)}
          />
        ) : null}

        {!prefsReady ? (
          <>
            <GroupSkeleton rows={2} />
            <GroupSkeleton rows={2} />
            <GroupSkeleton rows={1} />
            <GroupSkeleton rows={SCRIPT_LANGS.length} trailing="check" />
            <GroupSkeleton rows={ROMAN_LANGS.length} trailing="check" />
            <GroupSkeleton rows={1} />
            <GroupSkeleton rows={4} />
          </>
        ) : (
          <>
            <ListSection
              title="Security"
              footer="Biometric unlock asks for your fingerprint or face every time the app comes back to the foreground."
            >
              <Appear index={0}>
                <DataRow
                  icon="finger-print"
                  label="Biometric unlock"
                  value=""
                  right={
                    <Switch
                      value={bio}
                      onValueChange={toggleBio}
                      accessibilityLabel="Biometric unlock"
                      trackColor={{ true: c.primary, false: c.border }}
                      thumbColor="#ffffff"
                    />
                  }
                />
              </Appear>
              <Appear index={1}>
                <DataRow
                  icon="key"
                  label="Change password"
                  value=""
                  onPress={() => toast('Password changes are handled in the web panel for now.', 'info')}
                />
              </Appear>
            </ListSection>

            <ListSection
              title="Notifications"
              footer="Push covers reminders, claims and lead alerts. WhatsApp alerts cover new Hub messages."
            >
              <Appear index={0}>
                <DataRow
                  icon="notifications"
                  label="Push notifications"
                  value=""
                  right={
                    <Switch
                      value={push}
                      onValueChange={(v) => persistToggle(PUSH_KEY, v, setPush, 'Push notifications')}
                      accessibilityLabel="Push notifications"
                      trackColor={{ true: c.primary, false: c.border }}
                      thumbColor="#ffffff"
                    />
                  }
                />
              </Appear>
              <Appear index={1}>
                <DataRow
                  icon="logo-whatsapp"
                  label="WhatsApp alerts"
                  value=""
                  right={
                    <Switch
                      value={waAlerts}
                      onValueChange={(v) => persistToggle(WA_KEY, v, setWaAlerts, 'WhatsApp alerts')}
                      accessibilityLabel="WhatsApp alerts"
                      trackColor={{ true: c.whatsapp, false: c.border }}
                      thumbColor="#ffffff"
                    />
                  }
                />
              </Appear>
            </ListSection>

            <ListSection title="Appearance">
              <Appear index={0}>
                <DataRow icon="contrast" label="Theme" value={themeValue} />
              </Appear>
            </ListSection>

            {/* Two captioned groups under one heading. The heading is an h3 rather than a
                third eyebrow: stacking "APP LANGUAGE" directly above "SCRIPT LANGUAGES"
                would put two identical caption styles back to back and flatten the very
                hierarchy the grouping exists to create. */}
            <View style={{ gap: spacing.md }}>
              <View style={{ marginHorizontal: spacing.xs, gap: 3 }}>
                <Txt size={font.h3} weight="800" style={{ letterSpacing: -0.2 }}>
                  {t('settings.language')}
                </Txt>
                <Txt size={font.tiny} color={c.faint}>
                  Changes the app labels straight away. Client records stay in the language they were entered in.
                </Txt>
              </View>

              <ListSection title="Script languages">
                {SCRIPT_LANGS.map((l, i) => (
                  <Appear key={l.code} index={i}>
                    <LangRow
                      label={l.label}
                      native={l.native}
                      active={l.code === lang}
                      onPress={() => changeLang(l)}
                    />
                  </Appear>
                ))}
              </ListSection>

              <ListSection
                title="Romanized"
                footer="The same regional languages written in the English alphabet, for anyone who reads Roman script faster."
              >
                {ROMAN_LANGS.map((l, i) => (
                  <Appear key={l.code} index={i}>
                    <LangRow
                      label={l.label}
                      native={l.native}
                      active={l.code === lang}
                      onPress={() => changeLang(l)}
                    />
                  </Appear>
                ))}
              </ListSection>
            </View>

            {/* PHASE 55 — an on-device "app vs WiFi" check for the "doesn't work on my network"
                complaint. It pings the server and gives a plain verdict, so the owner can tell a
                real app fault from a network that just can't reach cgpe.in. */}
            <ListSection
              title="Connection"
              footer="Checks whether this phone can reach the CGPE server right now. Use it when a screen won’t load, to tell an app problem from a WiFi problem."
            >
              <Appear index={0}>
                <DataRow
                  icon="pulse"
                  label={testing ? 'Testing connection…' : 'Test connection'}
                  value={connMsg}
                  onPress={runConnectionTest}
                />
              </Appear>
            </ListSection>

            {/* PHASE 77 — the owner's "app grows to 125 MB". Deliberately says what it frees and
                what it cannot: the install size is not a cache and no in-app button can shrink it.
                No megabyte figure is shown because nothing underneath reports one, and a guessed
                number would be exactly the fabrication convention 4 exists to stop. */}
            {/* The install-size sentence is a SEPARATE key, not folded into `storage.description`:
                the owner supplied the description first and the caveat afterwards, and keeping them
                apart means either can be reworded without invalidating the other's translations. */}
            <ListSection
              title={t('storage.title')}
              footer={`${t('storage.description')} ${t('storage.installNote')}`}
            >
              <Appear index={0}>
                <DataRow
                  icon="trash-outline"
                  label={clearing ? t('storage.clearing') : t('storage.clear')}
                  value=""
                  onPress={clearCaches}
                />
              </Appear>
            </ListSection>

            {/* The old "About" row was labelled About and went to Account and privacy,
                which is two different things wearing one label. The destination is kept,
                because it is the only route to the deletion flow from here, and the row
                now says where it goes. The version moved to its own read-only row. */}
            <ListSection
              title="Support and about"
              footer={`${APP.name} for ${APP.org}. ${APP.since}.`}
            >
              <Appear index={0}>
                <DataRow
                  icon="help-circle"
                  label="Help and FAQ"
                  value=""
                  onPress={() => toast('Help articles are on the web panel for now.', 'info')}
                />
              </Appear>
              <Appear index={1}>
                <DataRow
                  icon="star"
                  label="Rate CGPE Connect"
                  value=""
                  onPress={() => toast('CGPE Connect is not on the Play Store yet. Ratings open once it is listed.', 'info')}
                />
              </Appear>
              <Appear index={2}>
                <DataRow
                  icon="shield-checkmark"
                  label="Account and privacy"
                  value="Data and deletion"
                  onPress={() => router.push('/account')}
                />
              </Appear>
              <Appear index={3}>
                <DataRow icon="cube-outline" label="Version" value={versionLine()} numeric />
              </Appear>
            </ListSection>
          </>
        )}
      </ScrollView>

      {/* Mounted only for the moment it takes to clear, then unmounted again — see CacheCleaner
          for why a live WebView is required at all and why keeping one around would be costly. */}
      {clearing ? <CacheCleaner onDone={onCacheCleared} /> : null}
    </Screen>
  );
}

/* ------------------------------------------------------------------ *
 * LangRow — one language option.
 *
 * NOT a DataRow. DataRow is built for "setting: value", so it renders the label muted and
 * the value bold on the right; a picker inverts that, because the language name IS the
 * thing being chosen and must be the loudest text in the row. The row keeps DataRow's
 * geometry (the same horizontal padding, the same press TINT rather than a scale, which is
 * what stops a full-width row detaching from the card edge it sits inside) so the two kinds
 * of row still read as one list.
 *
 * The tick sits in a reserved fixed-width column. Rendering it only when active and
 * collapsing the space otherwise would let every label breathe out by 20pt the moment the
 * selection moved, which turns a tap into a visible twitch of the whole group.
 *
 * `native` is skipped when it merely repeats the label, so English does not render as
 * "English / English" and a romanized option whose native form IS its label stays a single
 * clean line. Nothing here assumes a fixed set of five.
 * ------------------------------------------------------------------ */

/** Clears 44pt on its own, and clears it twice over once a native name is on the second line. */
const LANG_ROW_MIN_H = 52;
const TICK_COL = 20;

function LangRow({ label, native, active, onPress }: {
  label: string;
  native: string;
  active: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  const showNative = !!native && native.trim() !== label.trim();

  return (
    <Pressable
      onPress={onPress}
      // radio, not button: TalkBack then announces the selected state as part of the role,
      // so a blind user knows which of the five is live without hunting for the tick.
      accessibilityRole="radio"
      accessibilityState={{ checked: active, selected: active }}
      accessibilityLabel={showNative ? `${label}, ${native}` : label}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        minHeight: LANG_ROW_MIN_H, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        backgroundColor: pressed ? c.cardAlt : 'transparent',
      })}
    >
      <View style={{ flex: 1 }}>
        <Txt
          size={font.body}
          weight={active ? '700' : '500'}
          color={active ? c.primary : c.text}
          numberOfLines={1}
        >
          {label}
        </Txt>
        {showNative ? (
          <Txt size={font.cap} color={c.muted} numberOfLines={1} style={{ marginTop: 2 }}>
            {native}
          </Txt>
        ) : null}
      </View>

      <View style={{ width: TICK_COL, alignItems: 'center' }}>
        {active ? <Ionicons name="checkmark" size={19} color={c.primary} /> : null}
      </View>
    </Pressable>
  );
}

/* Holds the grouped-list shape while the stored preferences load, so a switch never
 * paints in the wrong position and then flips under the user's eye. `trailing` matches the
 * placeholder to the control the group actually holds: a pill where a switch will land, a
 * small square where a tick will. A switch-shaped ghost above a list of languages promises
 * the wrong control. A group with no rows draws nothing rather than an empty card. */
function GroupSkeleton({ rows, trailing = 'switch' }: {
  rows: number;
  trailing?: 'switch' | 'check';
}) {
  const c = useTheme();
  if (rows < 1) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Skeleton width={78} height={10} style={{ marginLeft: spacing.xs }} />
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
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                minHeight: trailing === 'check' ? LANG_ROW_MIN_H : 48,
                paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
              }}>
                {/* Language rows carry no leading glyph, so drawing one here would promise
                    a row shape that never arrives. */}
                {trailing === 'check' ? null : <Skeleton width={16} height={16} radius={5} />}
                <Skeleton width={trailing === 'check' ? '38%' : '46%'} height={12} />
                <View style={{ flex: 1 }} />
                {trailing === 'check'
                  ? <Skeleton width={18} height={18} radius={6} />
                  : <Skeleton width={44} height={20} radius={radius.pill} />}
              </View>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}
