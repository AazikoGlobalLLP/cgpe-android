import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useTheme, radius, shadow } from '@/theme/theme';
import { useJobs } from '@/store/jobs';

/** Floating indicator for a background job — tap to monitor. Hidden on the monitor screen. */
export function JobPill() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { activeJob } = useJobs();

  if (!activeJob || (pathname && pathname.startsWith('/job/'))) return null;
  const pct = activeJob.total ? Math.min(1, activeJob.processed / activeJob.total) : 0;

  return (
    <Pressable
      onPress={() => router.push(`/job/${activeJob.id}`)}
      style={({ pressed }) => [{
        position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 86,
        borderRadius: radius.pill, backgroundColor: c.scheme === 'dark' ? '#1b2540' : '#12141d',
        paddingVertical: 11, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10,
        opacity: pressed ? 0.9 : 1, ...shadow(c, 2),
      }]}>
      <ActivityIndicator size="small" color="#7cc242" />
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
          {activeJob.label} · {activeJob.processed}/{activeJob.total}
        </Text>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 5, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${pct * 100}%`, backgroundColor: '#7cc242', borderRadius: 2 }} />
        </View>
      </View>
      <Text style={{ color: '#9fb0cc', fontSize: 11.5, fontWeight: '700' }}>Monitor</Text>
      <Ionicons name="chevron-forward" size={15} color="#9fb0cc" />
    </Pressable>
  );
}
