import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/store/auth';
import { useTheme, radius } from '@/theme/theme';
import { Grad, Loader } from '@/ui/kit';
import { useT } from '@/i18n';

type Ion = React.ComponentProps<typeof Ionicons>['name'];

const TAB_META: Record<string, { label: string; icon: Ion; active: Ion }> = {
  home: { label: 'Today', icon: 'home-outline', active: 'home' },
  tasks: { label: 'Tasks', icon: 'checkbox-outline', active: 'checkbox' },
  clients: { label: 'Clients', icon: 'people-outline', active: 'people' },
  claims: { label: 'Claims', icon: 'shield-outline', active: 'shield' },
  more: { label: 'More', icon: 'ellipsis-horizontal', active: 'ellipsis-horizontal' },
};
const ORDER = ['home', 'tasks', 'clients', 'claims', 'more'];

function TabBar({ state, navigation }: any) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.bgElevated, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: 10, paddingBottom: insets.bottom + 8, paddingHorizontal: 8 }}>
      {state.routes
        .filter((r: any) => TAB_META[r.name])
        .sort((a: any, b: any) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name))
        .map((route: any) => {
          const i = state.routes.findIndex((r: any) => r.key === route.key);
          const focused = state.index === i;
          const meta = TAB_META[route.name];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          const a11y = { accessibilityRole: 'tab' as const, accessibilityLabel: `tab-${route.name}`, accessibilityState: { selected: focused }, testID: `tab-${route.name}` };
          if (focused) {
            return (
              <Pressable key={route.key} onPress={onPress} {...a11y} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ borderRadius: radius.pill, overflow: 'hidden' }}>
                  <Grad colors={c.gradientBrand} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9 }}>
                    <Ionicons name={meta.active} size={19} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12.5 }}>{t('tab.' + route.name)}</Text>
                  </Grad>
                </View>
              </Pressable>
            );
          }
          return (
            <Pressable key={route.key} onPress={onPress} {...a11y} style={{ flex: 1, alignItems: 'center', paddingVertical: 9 }}>
              <Ionicons name={meta.icon} size={22} color={c.faint} />
            </Pressable>
          );
        })}
    </View>
  );
}

export default function TabsLayout() {
  const { user, ready } = useAuth();
  if (!ready) return <Loader />;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="clients" />
      <Tabs.Screen name="claims" />
      <Tabs.Screen name="more" />
      {/* Registered but hidden from the bar — reachable from More */}
      <Tabs.Screen name="leads" />
    </Tabs>
  );
}
