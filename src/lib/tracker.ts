/**
 * Field-route tracking. While a team member is clocked in, we record their GPS path
 * and stream it to the backend so the master can replay where they went.
 *
 * IMPLEMENTATION NOTE: this uses a FOREGROUND location watch (expo-location
 * `watchPositionAsync`) — NOT a background foreground-service. The earlier
 * background service crashed on device (Android force-stops a mis-provisioned
 * foreground service, which a JS try/catch cannot prevent). A foreground watch is
 * rock-solid: it records the route while the app is open and simply pauses when the
 * app is backgrounded/killed — no native service, no crash, no scary permission.
 */
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { storage } from './storage';
import * as api from '@/data/api';

const isNative = Platform.OS !== 'web';
const SESSION_KEY = 'track.sessionId';

let sub: Location.LocationSubscription | null = null;
let buffer: any[] = [];
let flushTimer: any = null;
let sessionId: string | undefined;

async function flush() {
  if (!buffer.length) return;
  const pts = buffer.splice(0, buffer.length);
  try { await api.postTrackPoints(pts, sessionId); } catch { /* best-effort */ }
}

/** Begin recording the field route for a clocked-in session. */
export async function startTracking(sid?: string): Promise<void> {
  if (!isNative) return;
  try {
    let fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return;

    sessionId = sid;
    if (sid) { try { await storage.set(SESSION_KEY, sid); } catch {} }
    api.startTrack(sid).catch(() => {});

    if (sub) return; // already watching
    sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 60000, distanceInterval: 30 },
      (loc) => {
        if (!loc?.coords) return;
        buffer.push({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          at: new Date(loc.timestamp || Date.now()).toISOString(),
          accuracy: loc.coords.accuracy ?? undefined,
          speed: loc.coords.speed ?? undefined,
          heading: loc.coords.heading ?? undefined,
        });
        if (buffer.length >= 5) flush();
      }
    );
    if (!flushTimer) flushTimer = setInterval(() => { flush(); }, 120000);
  } catch { /* tracking is best-effort; never block clock-in */ }
}

/** Stop recording and seal the session's path. */
export async function stopTracking(): Promise<void> {
  if (!isNative) return;
  try {
    if (sub) { try { sub.remove(); } catch {} sub = null; }
    if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
    await flush();
    api.stopTrack(sessionId).catch(() => {});
    try { await storage.remove(SESSION_KEY); } catch {}
    sessionId = undefined;
  } catch { /* ignore */ }
}

/** True if the field-route watch is currently running. */
export function isTracking(): boolean {
  return !!sub;
}
