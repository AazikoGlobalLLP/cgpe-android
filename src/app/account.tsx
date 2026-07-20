import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Button, Card, Header } from '@/ui/kit';
import { useConfirm } from '@/ui/Confirm';
import { useAuth } from '@/store/auth';

export default function Account() {
  const c = useTheme();
  const router = useRouter();
  const { user, deleteAccount } = useAuth();
  const { confirm, toast } = useConfirm();
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    const first = await confirm({
      title: 'Delete your account?',
      message: 'This permanently deletes your CGPE Connect account and all associated personal data (profile, leads, client notes). This cannot be undone.',
      confirmText: 'Continue', destructive: true, icon: 'trash',
    });
    if (!first) return;
    const second = await confirm({
      title: 'Are you absolutely sure?',
      message: 'Your data will be erased. This action is irreversible.',
      confirmText: 'Yes, delete everything', cancelText: 'Keep my account', destructive: true,
    });
    if (second) runDelete();
  };

  const runDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      router.replace('/(auth)/login');
    } catch {
      setDeleting(false);
      toast('Could not delete the account. Please try again.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Account & privacy" back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }}>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.successSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="shield-checkmark" size={22} color={c.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>Your data is protected</Text>
            <Text style={{ color: c.muted, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>Encrypted in transit. We follow India's DPDP Act for personal &amp; policy data.</Text>
          </View>
        </Card>

        <View style={{ gap: 8 }}>
          <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginLeft: 4 }}>Your data</Text>
          <Card padded={false}>
            <Row icon="download" tint={c.primary} label="Export my data" sub="Download a copy of your information" onPress={() => toast('A data export will be emailed to you.')} />
            <Row icon="document-text" tint={c.info} label="Privacy policy" onPress={() => Linking.openURL('https://cgpe.in/privacy').catch(() => toast('Opens your hosted privacy policy.'))} last />
          </Card>
        </View>

        {/* Deletion — store requirement */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginLeft: 4 }}>Danger zone</Text>
          <Card style={{ borderColor: c.danger + '40' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="trash" size={18} color={c.danger} />
              <Text style={{ color: c.danger, fontWeight: '800', fontSize: 15 }}>Delete account</Text>
            </View>
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
              Permanently delete your account and all associated personal data. You can also request deletion at{' '}
              <Text style={{ color: c.primary, fontWeight: '700' }}>cgpe.in/delete-account</Text>. This action is irreversible.
            </Text>
            <Button label="Delete my account" icon="trash-outline" variant="danger" full onPress={confirmDelete} loading={deleting} style={{ marginTop: 14 }} />
          </Card>
        </View>

        <Text style={{ color: c.faint, fontSize: 11, textAlign: 'center' }}>
          Signed in as {user?.email}
        </Text>
      </ScrollView>
    </View>
  );
}

function Row({ icon, tint, label, sub, onPress, last }: { icon: any; tint: string; label: string; sub?: string; onPress: () => void; last?: boolean }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', padding: 14, opacity: pressed ? 0.7 : 1, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.hairline }]}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tint + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: c.text, fontWeight: '600', fontSize: 14.5 }}>{label}</Text>
        {sub ? <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.faint} />
    </Pressable>
  );
}
