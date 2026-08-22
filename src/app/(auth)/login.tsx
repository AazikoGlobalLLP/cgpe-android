import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { font, radius, shadow, spacing, useTheme } from '@/theme/theme';
import { Eyebrow, Grad, Screen, Txt } from '@/ui/base';
import { Button, Field, Segmented } from '@/ui/controls';
import { Banner, useToast } from '@/ui/feedback';
import { Appear } from '@/ui/motion';
import { haptics } from '@/lib/haptics';

import { useAuth } from '@/store/auth';
import * as api from '@/data/api';
import { APP } from '@/constants/config';

/* ------------------------------------------------------------------ *
 * Sign in — the security boundary.
 *
 * THERE IS NO OFFLINE PATH ANY MORE. `api.login` / `api.verifyOtp` throw `NetworkError`
 * when the backend cannot be reached, and nothing here mints a local session to paper
 * over it. That distinction is the whole point of this screen's error handling: the two
 * failures demand opposite reactions from the user, so they must never look alike.
 *
 *   NetworkError  -> "we could not ask the server"   the credentials may be perfect.
 *                    Neutral `offline` Banner + Retry. Re-typing the password is useless.
 *   refused       -> "the server said no"            the credentials are wrong.
 *                    `danger` Banner. Retrying the same thing will fail again.
 *
 * Per-FIELD problems (an empty box, a short phone number) never reach a Banner: they sit
 * under their own input via `Field`'s `error`, because the fix is in that box.
 *
 * `expiredNotice` explains why someone who was signed in a second ago is suddenly here.
 * Without it a revoked token reads as the app logging you out at random. It clears the
 * moment the user starts typing, since by then it has been read and is only noise.
 *
 * The hero gradient is `gradientHero` (the deep azure ground), NOT the brand ramp. The
 * brand gradient stays rationed to the clock-in ring and the active tab indicator; the
 * sign-in button is solid azure like every other primary in the app.
 *
 * CANCELLATION. Three submit paths await the network and then write state. Each one is
 * fenced by the `alive` ref so a screen torn down mid-request cannot be resurrected by a
 * late `setLoading(false)`. The single deliberate exception is the SUCCESS path: once the
 * server has issued a session, the navigation is a global side effect and must happen
 * whether or not this particular view survived the round trip.
 * ------------------------------------------------------------------ */

type Mode = 'password' | 'otp';

/**
 * A submit that failed. `network` never reached the server; `timeout` reached it but got no reply
 * in time (a slow/stalled round-trip, NOT a down connection — so it must not say "check your
 * connection"); `refused` was rejected by the server.
 */
type Failure = { kind: 'network' | 'timeout' | 'refused'; message: string };

const MODES: { key: Mode; label: string }[] = [
  { key: 'password', label: 'Password' },
  { key: 'otp', label: 'OTP' },
];

/** Ink on the fixed dark hero. These are not palette tokens because the ground behind them
 *  is the same deep azure in both schemes, so a scheme-aware colour would be wrong here. */
const ON_HERO = '#ffffff';
const ON_HERO_SUB = 'rgba(255,255,255,0.75)';
const ON_HERO_FAINT = 'rgba(255,255,255,0.55)';

/** Split "could not reach the server" from "the server is slow" from "the server refused us". */
function describe(e: unknown, fallback: string): Failure {
  if (e instanceof api.NetworkError) return { kind: e.kind, message: e.message };
  const message = (e as { message?: string } | null)?.message;
  return { kind: 'refused', message: message || fallback };
}

export default function Login() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();

  const {
    login, loginOtp, biometricEnabled, biometricAvailable, authenticateBiometric,
    canBiometricRestore, restoreBiometricSession,
    expiredNotice, clearExpiredNotice,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('password');
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  /** Phase 48: whether to offer fingerprint-only restore, and whether one is in flight. */
  const [canRestore, setCanRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const [idErr, setIdErr] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [phoneErr, setPhoneErr] = useState('');
  const [otpErr, setOtpErr] = useState('');
  const [failure, setFailure] = useState<Failure | null>(null);

  const cardMax = Math.min(width - 32, 440);
  const useBio = biometricEnabled && biometricAvailable;

  /** Unmount fence for every awaited submit below. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  /** Phase 48: offer fingerprint-only restore only when this device holds a sealed refresh
   *  credential from a prior login and the biometric pool is intact. Cheap; never prompts. */
  useEffect(() => {
    let on = true;
    (async () => {
      const ok = await canBiometricRestore().catch(() => false);
      if (on) setCanRestore(ok);
    })();
    return () => { on = false; };
  }, [canBiometricRestore]);

  /** Typing means the notices have been read. Clearing them here keeps the card from
   *  accumulating stale explanations above a form the user is actively correcting. */
  const touch = useCallback(() => {
    if (expiredNotice) clearExpiredNotice();
    setFailure(null);
  }, [expiredNotice, clearExpiredNotice]);

  const doPassword = useCallback(async () => {
    setFailure(null);
    const nextId = id.trim() ? '' : 'Enter your email or mobile number.';
    const nextPw = pw ? '' : 'Enter your password.';
    setIdErr(nextId);
    setPwErr(nextPw);
    if (nextId || nextPw) { haptics.warn(); return; }

    haptics.tap();
    setLoading(true);
    try {
      if (useBio) {
        const ok = await authenticateBiometric();
        if (!alive.current) return;
        if (!ok) {
          setLoading(false);
          haptics.warn();
          setFailure({ kind: 'refused', message: 'Unlock was not confirmed on this device. Try again.' });
          return;
        }
      }
      await login(id.trim(), pw);
    } catch (e) {
      if (!alive.current) return;
      haptics.error();
      setFailure(describe(e, 'Those details were not accepted. Check them and try again.'));
      setLoading(false);
      return;
    }
    // Session issued. Navigation sits OUTSIDE the try on purpose: a router failure must
    // never be reported as a credential rejection, and it is a global side effect, so it
    // is not fenced by `alive` the way the state writes above are.
    haptics.success();
    router.replace('/(tabs)/home');
  }, [id, pw, useBio, authenticateBiometric, login, router]);

  const doSendOtp = useCallback(async () => {
    setFailure(null);
    // Accept EITHER an email or a 10-digit mobile, matching the web panel's `email_or_phone`.
    // The backend picks its delivery channel off the presence of '@', so accepting both is
    // what gives a user a working route to a code when one channel is down.
    const raw = phone.trim();
    const looksEmail = raw.includes('@');
    const digits = raw.replace(/\D/g, '');
    if (!looksEmail && digits.length < 10) {
      setPhoneErr('Enter your work email, or a 10 digit mobile number.');
      haptics.warn();
      return;
    }
    if (looksEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      setPhoneErr('That email address does not look right.');
      haptics.warn();
      return;
    }
    setPhoneErr('');

    haptics.tap();
    setLoading(true);
    try {
      const res = await api.sendOtp(phone);
      if (!alive.current) return;
      setLoading(false);
      if (res.ok) {
        // A fresh code invalidates the old one, so the box must not keep offering it.
        setOtp('');
        setOtpErr('');
        setOtpSent(true);
        haptics.success();
        toast(res.message, 'success');
        return;
      }
      // `ok: false` means the server declined to send. Advancing to code entry here would
      // strand the user waiting for a message that is never coming.
      haptics.error();
      setFailure({ kind: 'refused', message: res.message });
    } catch (e) {
      if (!alive.current) return;
      setLoading(false);
      haptics.error();
      setFailure(describe(e, 'Could not send the code. Please try again.'));
    }
  }, [phone, toast]);

  const doVerifyOtp = useCallback(async () => {
    setFailure(null);
    if (otp.trim().length < 4) {
      setOtpErr('Enter the code from your WhatsApp message.');
      haptics.warn();
      return;
    }
    setOtpErr('');

    haptics.tap();
    setLoading(true);
    let ok = false;
    try {
      ok = await loginOtp(phone, otp.trim());
    } catch (e) {
      if (!alive.current) return;
      setLoading(false);
      haptics.error();
      setFailure(describe(e, 'That code could not be checked. Please try again.'));
      return;
    }
    if (!ok) {
      if (!alive.current) return;
      setLoading(false);
      haptics.error();
      setFailure({
        kind: 'refused',
        message: 'That code was not accepted. It may have expired, so request a new one.',
      });
      return;
    }
    // Session issued. Outside the try for the same reason as the password path above.
    haptics.success();
    router.replace('/(tabs)/home');
  }, [otp, phone, loginOtp, router]);

  /** Phase 48: fingerprint-only restore. One biometric prompt → exchange the sealed refresh
   *  credential for a fresh session, no id/password/OTP. Every non-'ok' path routes to manual
   *  sign-in with honest wording; a session is never fabricated. */
  const onBiometricRestore = useCallback(async () => {
    if (restoring) return;
    setFailure(null);
    if (expiredNotice) clearExpiredNotice();
    haptics.tap();
    setRestoring(true);
    const res = await restoreBiometricSession();
    if (!alive.current) return;
    if (res === 'ok') {
      // Session restored. Navigation is a global side effect, like the password path below.
      haptics.success();
      router.replace('/(tabs)/home');
      return;
    }
    setRestoring(false);
    if (res === 'declined') {
      // The sealed credential is dead (revoked on logout, or past its 30-day window). It has been
      // destroyed; drop the affordance and ask for a real sign-in.
      setCanRestore(false);
      haptics.warn();
      setFailure({
        kind: 'refused',
        message: 'Quick unlock is no longer available. Please sign in with your password or OTP.',
      });
      return;
    }
    if (res === 'unavailable') {
      // Nothing to restore on this device — drop the affordance and let them sign in normally.
      setCanRestore(false);
      return;
    }
    // 'error' — could not reach the server, or a transient prompt failure. Keep the affordance.
    haptics.error();
    setFailure({
      kind: 'network',
      message: 'Could not unlock right now. Check your connection and try again.',
    });
  }, [restoring, expiredNotice, clearExpiredNotice, restoreBiometricSession, router]);

  /** Retry re-runs whatever the user was actually doing, so the Banner's action is never
   *  a dead end that just dismisses itself. */
  const retry = mode === 'password' ? doPassword : otpSent ? doVerifyOtp : doSendOtp;

  const pickMode = (m: Mode) => {
    if (m === mode) return;
    haptics.select();
    setMode(m);
    setFailure(null);
    setIdErr(''); setPwErr(''); setPhoneErr(''); setOtpErr('');
  };

  const failureBanner = failure ? (
    failure.kind !== 'refused' ? (
      <Banner
        tone="offline"
        // A timeout means the server WAS reached but is slow — a clock, not a struck-out cloud,
        // and copy that never tells the user to "check your connection" (theirs is up).
        icon={failure.kind === 'timeout' ? 'time-outline' : 'cloud-offline'}
        title={
          failure.kind === 'timeout' ? 'The server is taking too long'
            : mode === 'password' ? 'Your details were not sent'
              : otpSent ? 'Your code was not checked'
                : 'The code request was not sent'
        }
        message={failure.message}
        action={{ label: 'Try again', onPress: retry }}
        onDismiss={() => setFailure(null)}
      />
    ) : (
      <Banner
        tone="danger"
        title={
          mode === 'password' ? 'Sign in refused'
            : otpSent ? 'Code not accepted'
              : 'Code not sent'
        }
        message={failure.message}
        onDismiss={() => setFailure(null)}
      />
    )
  ) : null;

  return (
    <Screen keyboard style={{ backgroundColor: c.gradientHero[2] }}>
      <Grad
        colors={c.gradientHero}
        angle="vert"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '62%' }}
      />
      <View pointerEvents="none" style={{
        position: 'absolute', top: -60, right: -40, width: 240, height: 240,
        borderRadius: 120, backgroundColor: c.primary, opacity: 0.35,
      }} />
      {/* Teal blob against the azure one above it: the two ends of the brand gradient,
          used as ground rather than as a fill on a control. */}
      <View pointerEvents="none" style={{
        position: 'absolute', top: 120, left: -70, width: 200, height: 200,
        borderRadius: 100, backgroundColor: c.accent, opacity: 0.22,
      }} />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1, alignItems: 'center', justifyContent: 'center',
          paddingTop: insets.top + 26, paddingBottom: insets.bottom + 26,
        }}
      >
        <View style={{ width: cardMax, paddingHorizontal: 4 }}>
          <Appear distance={14}>
            <View style={{ alignItems: 'center', marginBottom: 22 }}>
              <View style={{ width: 74, height: 74, borderRadius: 22, overflow: 'hidden', ...shadow(c, 2) }}>
                <Grad
                  colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.08)']}
                  style={{
                    flex: 1, alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 22,
                  }}
                >
                  <Txt size={26} weight="900" color={ON_HERO} style={{ letterSpacing: -1 }}>CG</Txt>
                </Grad>
              </View>
              <Txt size={27} weight="900" color={ON_HERO} style={{ letterSpacing: -0.6, marginTop: 14 }}>
                {APP.name}
              </Txt>
              <Txt size={font.sub} color={ON_HERO_SUB} style={{ marginTop: 4 }}>{APP.tagline}</Txt>
            </View>
          </Appear>

          <Appear index={1} distance={14}>
            <View style={{
              backgroundColor: c.card, borderRadius: radius.xl, padding: spacing.xl,
              gap: spacing.md, ...shadow(c, 2),
            }}>
              <View style={{ gap: 2 }}>
                <Eyebrow>Secure sign in</Eyebrow>
                <Txt size={20} weight="800" style={{ letterSpacing: -0.3 }}>Welcome back</Txt>
              </View>

              {expiredNotice ? (
                <Banner
                  tone="info"
                  title="Your session ended"
                  message={expiredNotice}
                  onDismiss={clearExpiredNotice}
                />
              ) : null}

              {canRestore ? (
                <>
                  <Button
                    label="Unlock with fingerprint"
                    icon="finger-print"
                    onPress={onBiometricRestore}
                    loading={restoring}
                    size="lg"
                    full
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
                    <Txt size={font.cap} color={c.muted}>or sign in</Txt>
                    <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
                  </View>
                </>
              ) : null}

              <Segmented options={MODES} value={mode} onChange={pickMode} full />

              {mode === 'password' ? (
                <>
                  <Field
                    label="Email or mobile number"
                    value={id}
                    onChange={(v) => { setId(v); if (idErr) setIdErr(''); touch(); }}
                    placeholder="you@cgpe.in or 98250 ..."
                    keyboardType="email-address"
                    icon="person-outline"
                    error={idErr || undefined}
                  />
                  <Field
                    label="Password"
                    value={pw}
                    onChange={(v) => { setPw(v); if (pwErr) setPwErr(''); touch(); }}
                    placeholder="Your CGPE password"
                    secure
                    icon="lock-closed-outline"
                    error={pwErr || undefined}
                  />
                  {failureBanner}
                  <Button
                    label={useBio ? 'Unlock and sign in' : 'Sign in'}
                    icon={useBio ? 'finger-print' : 'arrow-forward'}
                    onPress={doPassword}
                    loading={loading}
                    size="lg"
                    full
                    style={{ marginTop: 2 }}
                  />
                </>
              ) : (
                <>
                  {/* Email OR mobile, exactly like the web panel's `email_or_phone`.
                      Restricting this to a phone was what broke OTP on mobile: the backend
                      routes an identifier containing '@' to the EMAIL channel and everything
                      else to the WhatsApp channel, so a phone-only field forced every code
                      through the n8n WhatsApp webhook. Where that webhook is unconfigured,
                      mobile OTP could never succeed while web OTP (via email) worked fine. */}
                  <Field
                    label="Email or mobile number"
                    value={phone}
                    onChange={(v) => {
                      setPhone(v);
                      setOtpSent(false);
                      if (phoneErr) setPhoneErr('');
                      touch();
                    }}
                    placeholder="you@cgpe.in  or  98250 00000"
                    keyboardType={phone.includes('@') ? 'email-address' : 'default'}
                    autoCapitalize="none"
                    icon="at-outline"
                    error={phoneErr || undefined}
                    hint="Email gets the code by mail. A mobile number gets it on WhatsApp."
                  />

                  {otpSent ? (
                    <>
                      <Field
                        label="Enter code"
                        value={otp}
                        onChange={(v) => { setOtp(v); if (otpErr) setOtpErr(''); touch(); }}
                        placeholder="6 digit code"
                        keyboardType="numeric"
                        icon="keypad-outline"
                        error={otpErr || undefined}
                      />
                      {failureBanner}
                      <Button
                        label="Verify and sign in"
                        icon="checkmark-circle"
                        onPress={doVerifyOtp}
                        loading={loading}
                        size="lg"
                        full
                        style={{ marginTop: 2 }}
                      />
                      <Button
                        label="Send a new code"
                        icon="refresh"
                        variant="ghost"
                        onPress={doSendOtp}
                        disabled={loading}
                        full
                      />
                    </>
                  ) : (
                    <>
                      {failureBanner}
                      <Button
                        label="Send code"
                        icon="paper-plane"
                        onPress={doSendOtp}
                        loading={loading}
                        size="lg"
                        full
                        style={{ marginTop: 2 }}
                      />
                    </>
                  )}
                </>
              )}

              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                backgroundColor: c.cardAlt, borderRadius: radius.md, padding: spacing.md, marginTop: 2,
              }}>
                <Ionicons name="lock-closed" size={15} color={c.muted} />
                <Txt size={font.cap} color={c.muted} style={{ flex: 1, lineHeight: 17 }}>
                  Sign in with your CGPE account. Next time you can unlock with fingerprint or Face ID.
                </Txt>
              </View>
            </View>
          </Appear>

          <Appear index={2} distance={14}>
            <Txt size={11.5} color={ON_HERO_FAINT} style={{ textAlign: 'center', marginTop: 18 }}>
              {APP.org} · {APP.since} · v{APP.version}
            </Txt>
          </Appear>
        </View>
      </ScrollView>
    </Screen>
  );
}
