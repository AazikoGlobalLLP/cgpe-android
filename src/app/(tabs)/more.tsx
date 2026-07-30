import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '@/theme/theme';
import { Avatar, Card, Header, Pill } from '@/ui/kit';
import { useConfirm } from '@/ui/Confirm';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { capabilitiesOf, TIER_THEME } from '@/store/roles';
import { APP } from '@/constants/config';
import * as api from '@/data/api';

type Ion = React.ComponentProps<typeof Ionicons>['name'];
type Item = { icon: Ion; label: string; sub?: string; href?: string; tint?: string; onPress?: () => void };

export default function More() {
  const c = useTheme();
  const router = useRouter();
  const { user, logout, viewAs, setViewAs } = useAuth();
  const { confirm, choose, toast } = useConfirm();
  const t = useT();

  const pickView = async () => {
    const picked = await choose<'master' | 'admin' | 'team'>('Preview another side', [
      { label: 'Master (Shivam) — full oversight', value: 'master', icon: 'shield-checkmark' },
      { label: 'Admin — runs a team', value: 'admin', icon: 'people-circle' },
      { label: 'Team member — does the work', value: 'team', icon: 'person' },
    ]);
    if (picked) { setViewAs(picked); toast(`Now viewing the ${picked} side`); }
  };

  const doLogout = async () => {
    const ok = await confirm({ title: t('signout.title'), message: t('signout.msg'), confirmText: t('common.signOut'), destructive: true, icon: 'log-out-outline' });
    if (ok) { await logout(); router.replace('/(auth)/login'); }
  };

  const caps = capabilitiesOf(user, viewAs);
  const realCaps = capabilitiesOf(user);
  const isAdmin = caps.manageTeam;

  const groups: { title: string; items: Item[] }[] = [
    ...(isAdmin ? [{
      title: caps.tier === 'master' ? 'Master control' : 'Admin',
      items: [
        { icon: 'people-circle' as const, label: caps.overseeAdmins ? 'All teams & admins' : 'Team members', sub: 'Roster, activity & performance', href: '/team', tint: c.primary },
        { icon: 'map' as const, label: 'Agent locations', sub: 'Live clock-in / clock-out points', href: '/agent-map', tint: c.info },
        ...(caps.tier === 'master' ? [{ icon: 'navigate' as const, label: 'Movement paths', sub: 'Replay any agent’s field route', href: '/agent-track', tint: '#6b62f5' }] : []),
        { icon: 'stats-chart' as const, label: 'Portfolio analytics', sub: 'Org-wide premium & renewals', href: '/analytics', tint: c.gold },
        { icon: 'paper-plane' as const, label: 'Campaigns', sub: 'Bulk renewal & birthday sends', href: '/premium', tint: c.warning },
      ],
    }] : []),
    {
      title: 'Business',
      items: [
        { icon: 'funnel', label: 'Leads & pipeline', sub: 'Prospects, stages, conversions', href: '/(tabs)/leads', tint: c.primary },
        { icon: 'gift', label: 'Premium & greetings', sub: 'One-tap renewal & birthday sends', href: '/premium', tint: c.gold },
        { icon: 'notifications', label: 'Reminders & follow-ups', sub: 'Birthdays, renewals, maturity', href: '/reminders', tint: c.accent },
        { icon: 'time', label: 'My attendance', sub: 'GPS clock-in history', href: '/attendance', tint: c.info },
        { icon: 'calendar', label: 'Calendar', sub: 'Meetings & events', href: '/calendar', tint: c.primary },
        { icon: 'logo-whatsapp', label: 'WhatsApp Hub', sub: 'Client conversations', href: '/whatsapp', tint: c.whatsapp },
      ],
    },
    {
      title: 'Tools',
      items: [
        { icon: 'calculator', label: 'LIC plans', sub: 'Product library & benefit estimator', href: '/lic-plans', tint: c.info },
        { icon: 'search', label: 'Global search', sub: 'Find clients, leads, claims, tasks', href: '/search', tint: c.primary },
      ],
    },
    {
      title: 'Account',
      items: [
        ...(realCaps.manageTeam ? [{ icon: 'swap-horizontal' as const, label: 'View as…', sub: `Currently: ${caps.label}${viewAs ? ' (preview)' : ''}`, tint: c.gold, onPress: pickView }] : []),
        { icon: 'person-circle', label: 'My profile', href: '/profile' },
        { icon: 'settings', label: 'Settings', sub: 'Notifications, security, theme', href: '/settings' },
        { icon: 'shield-checkmark', label: 'Account & privacy', sub: 'Data & account deletion', href: '/account' },
      ],
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="More" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }} showsVerticalScrollIndicator={false}>

        <Card onPress={() => router.push('/profile')} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar name={user?.name ?? 'A'} size={54} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 17 }}>{user?.name}</Text>
            <Text style={{ color: c.muted, fontSize: 12.5, marginTop: 2 }}>{user?.designation}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
              <View style={{ backgroundColor: TIER_THEME[caps.tier].accent + '22', borderWidth: 1, borderColor: TIER_THEME[caps.tier].accent + '55', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 }}>
                <Text style={{ color: TIER_THEME[caps.tier].accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{TIER_THEME[caps.tier].badge}</Text>
              </View>
              {!!user?.agentCode && <Pill label={user.agentCode} tone="neutral" small />}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.faint} />
        </Card>

        {groups.map((g) => (
          <View key={g.title} style={{ gap: 8 }}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginLeft: 4 }}>{g.title}</Text>
            <Card padded={false}>
              {g.items.map((it, i) => (
                <Pressable key={it.label} onPress={() => (it.href ? router.push(it.href as any) : it.onPress?.())}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', padding: 14, opacity: pressed ? 0.7 : 1, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.hairline }]}>
                  <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: (it.tint ?? c.muted) + '20', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={it.icon} size={19} color={it.tint ?? c.muted} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: c.text, fontWeight: '600', fontSize: 14.5 }}>{it.label}</Text>
                    {it.sub ? <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }}>{it.sub}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.faint} />
                </Pressable>
              ))}
            </Card>
          </View>
        ))}

        <Pressable onPress={doLogout} style={({ pressed }) => [{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          backgroundColor: c.dangerSoft, borderRadius: radius.md, height: 50, opacity: pressed ? 0.8 : 1,
        }]}>
          <Ionicons name="log-out-outline" size={20} color={c.danger} />
          <Text style={{ color: c.danger, fontWeight: '700', fontSize: 15 }}>{t('common.signOut')}</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: api.isRealSession() ? c.success : c.warning }} />
          <Text style={{ color: c.faint, fontSize: 11.5 }}>CGPE Connect · v{APP.version} · {api.isRealSession() ? 'Live data' : 'Sample data'}</Text>
        </View>
      </ScrollView>
    </View>
  );
}
