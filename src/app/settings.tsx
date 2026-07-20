import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, spacing } from '@/theme/theme';
import { Card, Header } from '@/ui/kit';
import { useConfirm } from '@/ui/Confirm';
import { useAuth } from '@/store/auth';
import { useI18n, useT, LANGS, Lang } from '@/i18n';

type Ion = React.ComponentProps<typeof Ionicons>['name'];

export default function Settings() {
  const c = useTheme();
  const router = useRouter();
  const t = useT();
  const { lang, setLang } = useI18n();
  const { choose, toast } = useConfirm();
  const { biometricEnabled, biometricAvailable, setBiometric } = useAuth();
  const [bio, setBio] = useState(biometricEnabled);
  const [push, setPush] = useState(true);
  const [waAlerts, setWaAlerts] = useState(true);

  useEffect(() => { setBio(biometricEnabled); }, [biometricEnabled]);
  useEffect(() => { AsyncStorage.getItem('cgpe.push').then((p) => { if (p != null) setPush(p === '1'); }); }, []);

  const toggleBio = async (v: boolean) => {
    if (!biometricAvailable && v) { toast('No fingerprint / face unlock set up on this device.'); return; }
    const ok = await setBiometric(v);
    setBio(ok ? v : false);
    if (ok) toast(v ? 'Biometric unlock enabled' : 'Biometric unlock disabled');
  };
  const togglePush = async (v: boolean) => { setPush(v); await AsyncStorage.setItem('cgpe.push', v ? '1' : '0'); };

  const pickLang = async () => {
    const picked = await choose<Lang>(t('settings.language'), LANGS.map((l) => ({ label: l.native, value: l.code, icon: 'language' })));
    if (picked) { setLang(picked); toast('Language updated'); }
  };
  const currentLang = LANGS.find((l) => l.code === lang)?.native || 'English';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t('settings.title')} back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }}>

        <Group title="Security">
          <ToggleRow icon="finger-print" tint={c.primary} label="Biometric unlock" sub="Face / fingerprint to open the app" value={bio} onChange={toggleBio} />
          <LinkRow icon="key" tint={c.warning} label="Change password" onPress={() => toast('Password change opens in the full app.')} />
        </Group>

        <Group title="Notifications">
          <ToggleRow icon="notifications" tint={c.accent} label="Push notifications" sub="Reminders, claims & lead alerts" value={push} onChange={togglePush} />
          <ToggleRow icon="logo-whatsapp" tint={c.whatsapp} label="WhatsApp alerts" sub="New Hub messages" value={waAlerts} onChange={setWaAlerts} />
        </Group>

        <Group title="Appearance">
          <InfoRow icon="contrast" tint={c.info} label="Theme" value="Follows system" />
          <LinkRow icon="language" tint={c.primary} label={t('settings.language')} value={currentLang} onPress={pickLang} />
        </Group>

        <Group title="Support">
          <LinkRow icon="help-circle" tint={c.muted} label="Help & FAQ" onPress={() => toast('Support content opens in the full app.')} />
          <LinkRow icon="star" tint={c.accent} label="Rate CGPE Connect" onPress={() => toast('Thanks! This opens the store review prompt on a device.')} />
          <LinkRow icon="information-circle" tint={c.muted} label="About" value="v1.0.0" onPress={() => router.push('/account')} />
        </Group>
      </ScrollView>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginLeft: 4 }}>{title}</Text>
      <Card padded={false}>{children}</Card>
    </View>
  );
}
function Base({ icon, tint, label, sub, right, onPress }: { icon: Ion; tint: string; label: string; sub?: string; right?: React.ReactNode; onPress?: () => void }) {
  const c = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tint + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: c.text, fontWeight: '600', fontSize: 14.5 }}>{label}</Text>
        {sub ? <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>{body}</Pressable> : body;
}
function ToggleRow(p: { icon: Ion; tint: string; label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useTheme();
  return <Base icon={p.icon} tint={p.tint} label={p.label} sub={p.sub} right={<Switch value={p.value} onValueChange={p.onChange} trackColor={{ true: c.primary, false: c.border }} thumbColor="#fff" />} />;
}
function LinkRow(p: { icon: Ion; tint: string; label: string; value?: string; onPress: () => void }) {
  const c = useTheme();
  return <Base icon={p.icon} tint={p.tint} label={p.label} onPress={p.onPress} right={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{p.value ? <Text style={{ color: c.muted, fontSize: 13 }}>{p.value}</Text> : null}<Ionicons name="chevron-forward" size={18} color={c.faint} /></View>} />;
}
function InfoRow(p: { icon: Ion; tint: string; label: string; value: string }) {
  const c = useTheme();
  return <Base icon={p.icon} tint={p.tint} label={p.label} right={<Text style={{ color: c.muted, fontSize: 13 }}>{p.value}</Text>} />;
}
