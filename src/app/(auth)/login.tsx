import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/auth';
import { useConfirm } from '@/ui/Confirm';
import * as api from '@/data/api';
import { useTheme, spacing, radius, shadow } from '@/theme/theme';
import { Button, Field, Grad } from '@/ui/kit';
import { APP } from '@/constants/config';

type Mode = 'password' | 'otp';

export default function Login() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { toast } = useConfirm();
  const { login, loginOtp, biometricEnabled, biometricAvailable, authenticateBiometric } = useAuth();

  const [mode, setMode] = useState<Mode>('password');
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cardMax = Math.min(width - 32, 440);

  const doPassword = async () => {
    setError('');
    if (!id.trim()) { setError('Enter your email or mobile number.'); return; }
    if (!pw) { setError('Enter your password.'); return; }
    setLoading(true);
    try {
      if (biometricEnabled && biometricAvailable) {
        const ok = await authenticateBiometric();
        if (!ok) { setLoading(false); return; }
      }
      await login(id, pw);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e?.message || 'Could not sign in. Please try again.'); setLoading(false);
    }
  };

  const doSendOtp = async () => {
    setError('');
    if (phone.replace(/\D/g, '').length < 10) { setError('Enter a valid mobile number.'); return; }
    setLoading(true);
    const res = await api.sendOtp(phone);
    setLoading(false);
    if (res.ok) { setOtpSent(true); toast(res.message); }
    else setError('Could not send OTP. Try again.');
  };

  const doVerifyOtp = async () => {
    setError(''); setLoading(true);
    const ok = await loginOtp(phone, otp);
    setLoading(false);
    if (ok) router.replace('/(tabs)/home');
    else setError('Invalid or expired OTP. Please try again.');
  };

  const useBio = biometricEnabled && biometricAvailable;

  return (
    <View style={{ flex: 1, backgroundColor: c.gradientHero[2] }}>
      <Grad colors={c.gradientHero} angle="vert" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '62%' }} />
      <View style={{ position: 'absolute', top: -60, right: -40, width: 240, height: 240, borderRadius: 120, backgroundColor: c.primary, opacity: 0.35 }} />
      <View style={{ position: 'absolute', top: 120, left: -70, width: 200, height: 200, borderRadius: 100, backgroundColor: '#8b5cf6', opacity: 0.22 }} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: insets.top + 26 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: cardMax, paddingHorizontal: 4 }}>
            {/* Brand */}
            <View style={{ alignItems: 'center', marginBottom: 22 }}>
              <View style={{ width: 74, height: 74, borderRadius: 22, overflow: 'hidden', ...shadow(c, 2) }}>
                <Grad colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.08)']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 22 }}>
                  <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -1 }}>CG</Text>
                </Grad>
              </View>
              <Text style={{ color: '#fff', fontSize: 27, fontWeight: '900', letterSpacing: -0.6, marginTop: 14 }}>{APP.name}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13.5, marginTop: 4 }}>{APP.tagline}</Text>
            </View>

            {/* Card */}
            <View style={{ backgroundColor: c.card, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md, ...shadow(c, 2) }}>
              <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>Sign in</Text>

              {/* Mode toggle */}
              <View style={{ flexDirection: 'row', backgroundColor: c.cardAlt, borderRadius: radius.md, padding: 4 }}>
                {(['password', 'otp'] as Mode[]).map((m) => {
                  const active = mode === m;
                  return (
                    <Pressable key={m} onPress={() => { setMode(m); setError(''); }} style={{ flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.card : 'transparent', ...(active ? shadow(c, 1) : {}) }}>
                      <Text style={{ color: active ? c.primary : c.muted, fontWeight: '700', fontSize: 13.5 }}>{m === 'password' ? 'Password' : 'OTP'}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {mode === 'password' ? (
                <>
                  <Field label="Email or mobile number" value={id} onChange={setId} placeholder="you@cgpe.in or 98250 …" keyboardType="email-address" />
                  <Field label="Password" value={pw} onChange={setPw} placeholder="••••••••" secure />
                  {error ? <ErrorRow c={c} error={error} /> : null}
                  <Button label={useBio ? 'Unlock & sign in' : 'Sign in'} icon={useBio ? 'finger-print' : 'arrow-forward'} onPress={doPassword} loading={loading} size="lg" full style={{ marginTop: 2 }} />
                </>
              ) : (
                <>
                  <Field label="Mobile number" value={phone} onChange={(v) => { setPhone(v); setOtpSent(false); }} placeholder="+91 98250 …" keyboardType="phone-pad" />
                  {otpSent ? (
                    <>
                      <Field label="Enter OTP" value={otp} onChange={setOtp} placeholder="6-digit code" keyboardType="numeric" />
                      {error ? <ErrorRow c={c} error={error} /> : null}
                      <Button label="Verify & sign in" icon="checkmark-circle" onPress={doVerifyOtp} loading={loading} size="lg" full style={{ marginTop: 2 }} />
                      <Pressable onPress={doSendOtp} hitSlop={8} style={{ alignSelf: 'center' }}><Text style={{ color: c.primary, fontWeight: '700', fontSize: 13 }}>Resend OTP</Text></Pressable>
                    </>
                  ) : (
                    <>
                      {error ? <ErrorRow c={c} error={error} /> : null}
                      <Button label="Send OTP" icon="paper-plane" onPress={doSendOtp} loading={loading} size="lg" full style={{ marginTop: 2 }} />
                    </>
                  )}
                </>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.cardAlt, borderRadius: 12, padding: 12, marginTop: 2 }}>
                <Ionicons name="lock-closed" size={15} color={c.muted} />
                <Text style={{ color: c.muted, fontSize: 12, flex: 1, lineHeight: 16 }}>
                  Sign in with your CGPE account. Next time you can unlock with fingerprint / Face ID.
                </Text>
              </View>
            </View>

            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11.5, textAlign: 'center', marginTop: 18 }}>{APP.org} · {APP.since} · v{APP.version}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function ErrorRow({ c, error }: { c: any; error: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: c.dangerSoft, borderRadius: 10, padding: 10 }}>
      <Ionicons name="alert-circle" size={16} color={c.danger} />
      <Text style={{ color: c.danger, fontSize: 12.5, flex: 1 }}>{error}</Text>
    </View>
  );
}
