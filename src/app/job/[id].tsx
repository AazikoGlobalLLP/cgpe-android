import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme, spacing, radius, shadow } from '@/theme/theme';
import { Button, Card, EmptyState, Grad, Header, Pill } from '@/ui/kit';
import { useJobs } from '@/store/jobs';

export default function JobMonitor() {
  const c = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJob } = useJobs();
  const job = getJob(String(id));

  if (!job) {
    return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="Job" back /><EmptyState icon="cloud-offline-outline" title="Job not found" subtitle="It may have finished and been cleared." /></View>;
  }

  const pct = job.total ? Math.min(1, job.processed / job.total) : (job.status === 'done' ? 1 : 0);
  const tone = job.status === 'failed' ? c.danger : job.status === 'done' ? c.success : c.primary;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={job.label} subtitle="Background job" back />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }}>

        <View style={{ borderRadius: radius.xl, overflow: 'hidden', ...shadow(c, 2) }}>
          <Grad colors={c.gradientHero} style={{ padding: spacing.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={job.status === 'running' ? 'sync' : job.status === 'done' ? 'checkmark-circle' : 'alert-circle'} size={22} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', flex: 1 }}>
                {job.status === 'running' ? 'Sending…' : job.status === 'done' ? 'Completed' : 'Failed'}
              </Text>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{Math.round(pct * 100)}%</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 14 }}>
              <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900' }}>{job.status === 'done' ? job.sent : job.processed}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 17, fontWeight: '700', marginBottom: 5 }}>/ {job.total}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 7 }}>messages</Text>
            </View>

            <View style={{ height: 9, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden', marginTop: 12 }}>
              <View style={{ height: '100%', width: `${pct * 100}%`, borderRadius: 5 }}>
                <Grad colors={c.gradientAccent} angle="horiz" style={{ flex: 1 }} />
              </View>
            </View>
          </Grad>
        </View>

        {job.message ? (
          <Card style={{ backgroundColor: job.status === 'failed' ? c.dangerSoft : c.successSoft, borderColor: tone + '40' }}>
            <Text style={{ color: job.status === 'failed' ? c.danger : c.success, fontSize: 13.5, fontWeight: '600' }}>{job.message}</Text>
          </Card>
        ) : null}

        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }}>Activity</Text>
            <Pill label={job.status === 'running' ? 'live' : 'finished'} tone={job.status === 'running' ? 'info' : 'success'} small />
          </View>
          <Card padded={false} style={{ padding: 4 }}>
            {job.log.slice().reverse().map((l, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderBottomWidth: i === job.log.length - 1 ? 0 : 1, borderBottomColor: c.hairline }}>
                <Ionicons
                  name={l.state === 'error' ? 'close-circle' : l.state === 'sent' ? 'paper-plane' : 'information-circle'}
                  size={15}
                  color={l.state === 'error' ? c.danger : l.state === 'sent' ? c.whatsapp : c.muted}
                />
                <Text style={{ color: c.text, fontSize: 13, flex: 1 }} numberOfLines={1}>{l.text}</Text>
              </View>
            ))}
          </Card>
        </View>

        <Button label={job.status === 'running' ? 'Continue working (runs in background)' : 'Done'} icon={job.status === 'running' ? 'arrow-back' : 'checkmark'} variant={job.status === 'running' ? 'outline' : 'primary'} full onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}
