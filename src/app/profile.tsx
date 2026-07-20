import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Avatar, Button, Card, IconBtn, Pill, SectionHeader } from '@/ui/kit';
import { useAuth } from '@/store/auth';
import { call, email } from '@/lib/actions';

export default function Profile() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  if (!user) return null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ backgroundColor: c.primary, paddingTop: insets.top + 8, paddingBottom: 44, paddingHorizontal: spacing.lg, alignItems: 'center', borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}>
          <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginBottom: 8 }}>
            <IconBtn icon="chevron-back" onPress={() => router.back()} bg="rgba(255,255,255,0.18)" color="#fff" size={38} />
          </View>
          <Avatar name={user.name} size={88} color="rgba(255,255,255,0.22)" />
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 12 }}>{user.name}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13.5, marginTop: 3 }}>{user.designation}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="star" size={13} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12.5 }}>{user.tier} Club</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12.5 }}>{user.agentCode}</Text>
            </View>
          </View>
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          {/* Contact */}
          <View>
            <SectionHeader title="Contact" />
            <Card padded={false} style={{ padding: 4 }}>
              <Info icon="call" label="Mobile" value={user.phone} onPress={() => call(user.phone)} />
              <Info icon="mail" label="Email" value={user.email} onPress={() => email(user.email)} />
              <Info icon="business" label="Branch" value={user.branch} last />
            </Card>
          </View>

          {/* Snapshot */}
          <View>
            <SectionHeader title="This year" />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Snap label="Premium" value="₹1.2Cr" icon="cash" tint={c.success} />
              <Snap label="Policies" value="86" icon="documents" tint={c.primary} />
              <Snap label="Renewal %" value="94%" icon="refresh-circle" tint={c.accent} />
            </View>
          </View>

          <Button label="Edit profile" icon="create-outline" variant="outline" full onPress={() => {}} />
        </View>
      </ScrollView>
    </View>
  );
}

function Info({ icon, label, value, onPress, last }: { icon: any; label: string; value: string; onPress?: () => void; last?: boolean }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.hairline }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={17} color={c.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: c.faint, fontSize: 11 }}>{label}</Text>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: '600', marginTop: 1 }}>{value}</Text>
      </View>
      {onPress && <Ionicons name="open-outline" size={17} color={c.faint} />}
    </View>
  );
}

function Snap({ label, value, icon, tint }: { label: string; value: string; icon: any; tint: string }) {
  const c = useTheme();
  return (
    <Card style={{ flex: 1, padding: spacing.md, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={18} color={tint} />
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', marginTop: 8 }}>{value}</Text>
      <Text style={{ color: c.muted, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </Card>
  );
}
