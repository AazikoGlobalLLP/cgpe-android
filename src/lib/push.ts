/**
 * Native push orchestration (Phase 72, Tier B — team-targeted real push).
 *
 * This is the thin, device-only wire between `expo-notifications` and the app. Every honest
 * DECISION it makes is delegated to the pure, unit-tested `lib/pushRouting.ts` (`routeForPush`,
 * `shouldReRegister`); this file only performs the native side effects (permission, channel,
 * token, listeners) that cannot run under Vitest — the same split as `tracker.ts` vs
 * `watchdog.ts`/`staleBuffer.ts`.
 *
 * EVERYTHING HERE IS BEST-EFFORT AND SILENT. Push is additive: a denied permission, an offline
 * token fetch, or a not-yet-deployed `/push/register` must never raise the health banner, block
 * sign-in, or crash a screen. Failures are swallowed and simply mean "no push yet."
 *
 * WEB IS A NO-OP. Notifications here are Android/iOS only; on web (the e2e harness) every entry
 * point returns early so the build stays importable and no native call runs.
 *
 * FCM PREREQUISITE (owner/infra). `getExpoPushTokenAsync` only succeeds once the EAS project has
 * FCM V1 credentials configured (a Firebase project for `com.cgpe.connect`). Until then the token
 * fetch throws and we quietly hold no token — the app degrades honestly rather than breaking.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import { storage } from '@/lib/storage';
import { registerPushToken } from '@/data/api';
import { routeForPush, shouldReRegister, type PushRoute } from '@/lib/pushRouting';
import { SENT_TOKEN_KEY } from '@/lib/pushToken';

const isWeb = Platform.OS === 'web';

/** The one Android channel. Matches `defaultChannel` in the app.json expo-notifications plugin. */
const CHANNEL_ID = 'default';

let handlerConfigured = false;
let coldStartHandled = false;

/**
 * Foreground presentation. Without a handler, a notification that arrives while the app is open is
 * swallowed by the OS; this keeps the banner + sound so an on-screen user still sees a new task.
 * Idempotent and safe to call on every mount.
 */
export function configurePushHandler(): void {
  if (isWeb || handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Android 8+ requires a channel to exist BEFORE permission is requested. Best-effort. */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'General',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#155DFB',
    });
  } catch {
    // A channel failure just means default OS behaviour — never fatal.
  }
}

/**
 * Acquire this device's Expo push token, requesting notification permission if needed. Returns the
 * token string, or null on any refusal/failure (permission denied, no FCM credentials yet, offline).
 * Never throws.
 */
async function acquireToken(): Promise<string | null> {
  if (isWeb) return null;
  try {
    await ensureAndroidChannel();

    let settings = await Notifications.getPermissionsAsync();
    if (!settings.granted && settings.canAskAgain) {
      settings = await Notifications.requestPermissionsAsync();
    }
    if (!settings.granted) return null;

    // Attribute the token to this EAS project. Defaults to the same value, but the docs recommend
    // passing it explicitly, and it is right here in the config.
    const projectId =
      (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;

    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return typeof data === 'string' && data ? data : null;
  } catch {
    // Offline / no FCM credentials / sensor busy — hold no token, try again next sign-in.
    return null;
  }
}

/**
 * Register (or refresh) this device with the backend so a team push can reach it. Called on
 * sign-in. Only POSTs when the token actually changed since we last told the server, so a normal
 * reopen is a no-op. Entirely silent.
 */
export async function syncPushRegistration(): Promise<void> {
  if (isWeb) return;
  const token = await acquireToken();
  if (!token) return;

  const prev = await storage.get(SENT_TOKEN_KEY).catch(() => null);
  if (!shouldReRegister(prev, token)) return;

  const ok = await registerPushToken(token, Platform.OS);
  // Persist only what the server accepted, so a failed POST is retried next time rather than
  // being remembered as "already sent."
  if (ok) await storage.set(SENT_TOKEN_KEY, token).catch(() => {});
}

/**
 * Wire up notification taps → navigation. Handles both a tap while running (the live listener) and
 * a tap that cold-started the app from a killed state (`getLastNotificationResponse`, read once).
 * `navigate` is the caller's router push; the destination is decided purely by `routeForPush`.
 * Returns an unsubscribe.
 */
export function subscribeToPushTaps(navigate: (route: PushRoute) => void): () => void {
  if (isWeb) return () => {};

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    navigate(routeForPush(response.notification.request.content.data));
  });

  // Opened from a killed state by tapping a push: route once, then clear so a later remount does
  // not re-navigate off a stale response.
  if (!coldStartHandled) {
    coldStartHandled = true;
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      navigate(routeForPush(last.notification.request.content.data));
      Notifications.clearLastNotificationResponse();
    }
  }

  return () => sub.remove();
}
