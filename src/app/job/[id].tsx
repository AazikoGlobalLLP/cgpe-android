import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, spacing, useTheme } from '@/theme/theme';
import { Card, Eyebrow, Header, Metric, Row, Screen, Txt } from '@/ui/base';
import type { IconName } from '@/ui/base';
import { Button } from '@/ui/controls';
import { Banner, EmptyState, Meter } from '@/ui/feedback';
import type { MeterTone } from '@/ui/feedback';
import { ListSection, Pill } from '@/ui/data';
import type { Tone } from '@/ui/data';
import { Appear, useCountUp } from '@/ui/motion';
import { haptics } from '@/lib/haptics';
import { useJobs } from '@/store/jobs';
import type { Job, JobLogLine } from '@/store/jobs';
import { fmtTime } from '@/lib/format';

/* ------------------------------------------------------------------ *
 * Watching a campaign send.
 *
 * The one thing that matters here is whether the number is still moving, so the count is
 * the only place `useCountUp` is used on this screen: the CHANGE is the information. The
 * bar underneath answers "how far through", and the log answers "what just happened".
 *
 * Progress is honest about what it is. The backend hands the whole audience to n8n in a
 * single call, so per-recipient acknowledgement does not exist; the footer under the
 * meter says so rather than implying a live per-message receipt.
 * ------------------------------------------------------------------ */

type StatusSpec = {
  label: string;
  icon: IconName;
  pill: Tone;
  meter: MeterTone;
};

const STATUS: Record<Job['status'], StatusSpec> = {
  running: { label: 'Sending', icon: 'sync-outline', pill: 'info', meter: 'primary' },
  done: { label: 'Completed', icon: 'checkmark-circle', pill: 'success', meter: 'success' },
  failed: { label: 'Failed', icon: 'alert-circle', pill: 'danger', meter: 'danger' },
};

const LOG_ICON: Record<JobLogLine['state'], IconName> = {
  sent: 'paper-plane',
  error: 'close-circle',
  info: 'information-circle',
};

export default function JobMonitor() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJob } = useJobs();
  const job = getJob(String(id));

  const status = job?.status;
  const prevStatus = useRef<Job['status'] | undefined>(status);

  // A role refusal is terminal-but-not-a-success. Mirrored into a ref so the transition haptic
  // below can read it without widening its dependency list (which is keyed on `status` alone).
  const needsRole = !!job?.needsRole;
  const needsRoleRef = useRef(needsRole);
  needsRoleRef.current = needsRole;

  /**
   * The one haptic on this screen, and it fires on a real outcome rather than on arrival:
   * the send landed, was refused for this role, or failed. No timers, no subscriptions, so
   * there is nothing to tear down.
   */
  useEffect(() => {
    if (status && prevStatus.current === 'running' && status !== 'running') {
      if (needsRoleRef.current) haptics.warn();
      else if (status === 'done') haptics.success();
      else haptics.error();
    }
    prevStatus.current = status;
  }, [status]);

  const log = useMemo(() => (job ? job.log.slice().reverse() : []), [job]);

  // A refusal delivered nothing, so its progress is 0 — never `job.sent || job.processed`,
  // which (sent 0, processed = total) would otherwise read as the whole audience.
  const processed = job ? (job.needsRole ? 0 : (job.status === 'done' ? job.sent || job.processed : job.processed)) : 0;
  const shown = useCountUp(processed);

  if (!job) {
    return (
      <Screen>
        <Header title="Job" back />
        <EmptyState
          icon="hourglass-outline"
          title="This job is no longer running"
          subtitle="Background jobs are kept only while the app is open. It has finished and been cleared."
          action={{ label: 'Go back', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  // A role refusal is `status:'done'` (a real terminal answer) but must NOT wear the green
  // "Completed / 100%" success dress — it delivered nothing. It gets its own warning spec.
  const refused = !!job.needsRole;
  const spec: StatusSpec = refused
    ? { label: 'Not sent', icon: 'lock-closed', pill: 'warning', meter: 'warning' }
    : STATUS[job.status];
  const pct = refused ? 0 : (job.total > 0 ? Math.min(1, processed / job.total) : job.status === 'done' ? 1 : 0);
  const running = job.status === 'running';

  return (
    <Screen>
      <Header title={job.label} subtitle="Background job" back />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Appear index={0}>
          <Card>
            <Row>
              <Ionicons name={spec.icon} size={20} color={running ? c.primary : refused ? c.warning : job.status === 'done' ? c.success : c.danger} />
              <Eyebrow style={{ flex: 1 }}>{spec.label}</Eyebrow>
              <Pill label={running ? 'Live' : 'Finished'} tone={spec.pill} small dot />
            </Row>

            <Row style={{ alignItems: 'flex-end', gap: 6, marginTop: spacing.md }}>
              <Metric value={shown.toLocaleString('en-IN')} size={font.display} />
              <Txt size={17} weight="700" color={c.muted} numeric style={{ marginBottom: 4 }}>
                / {job.total.toLocaleString('en-IN')}
              </Txt>
              <Txt size={font.sub} color={c.faint} style={{ marginBottom: 5 }}>messages</Txt>
            </Row>

            <View style={{
              marginTop: spacing.lg, paddingTop: spacing.md,
              borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline,
            }}>
              <Meter
                value={pct}
                label={running ? 'Dispatching' : 'Dispatched'}
                tone={spec.meter}
                valueLabel={`${Math.round(pct * 100)}%`}
              />
              <Txt size={font.tiny} color={c.faint} style={{ marginTop: spacing.sm, lineHeight: 15 }}>
                The audience is handed to the sender in one call, so this tracks dispatch progress, not per-message delivery.
              </Txt>
            </View>
          </Card>
        </Appear>

        {job.message ? (
          <Appear index={1}>
            <Banner
              tone={refused ? 'warning' : job.status === 'failed' ? 'danger' : 'success'}
              title={refused ? 'Bulk send not allowed for your role' : job.status === 'failed' ? 'The send did not complete' : 'Send finished'}
              message={job.message}
            />
          </Appear>
        ) : null}

        <Appear index={2}>
          {log.length === 0 ? (
            <ListSection title="Activity">
              <EmptyState
                icon="reader-outline"
                title="Nothing logged yet"
                subtitle="Each step of the send is written here as it happens."
              />
            </ListSection>
          ) : (
            <ListSection
              title="Activity"
              footer={running ? 'Newest first. The list keeps the last 40 steps.' : undefined}
            >
              {log.map((l, i) => <LogRow key={`${l.at}_${i}`} l={l} />)}
            </ListSection>
          )}
        </Appear>
      </ScrollView>

      <View style={{
        paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.md,
        backgroundColor: c.bgElevated,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
      }}>
        <Button
          label={running ? 'Keep working, this runs in the background' : 'Done'}
          icon={running ? 'arrow-back' : 'checkmark'}
          variant={running ? 'outline' : 'primary'}
          full
          onPress={() => { haptics.tap(); router.back(); }}
        />
      </View>
    </Screen>
  );
}

/* ================================================================== *
 * Log row
 *
 * ListSection takes any child, so the log keeps the grouped-card treatment without
 * forcing a sentence into DataRow's right-aligned value slot.
 * ================================================================== */

function LogRow({ l }: { l: JobLogLine }) {
  const c = useTheme();
  const tint = l.state === 'error' ? c.danger : l.state === 'sent' ? c.whatsapp : c.faint;
  return (
    <Row style={{
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 44, gap: spacing.sm + 2,
    }}>
      <Ionicons name={LOG_ICON[l.state]} size={15} color={tint} />
      <Txt size={font.sub} numberOfLines={2} style={{ flex: 1 }}>{l.text}</Txt>
      <Txt size={font.tiny} color={c.faint} numeric numberOfLines={1}>{fmtTime(new Date(l.at))}</Txt>
    </Row>
  );
}
