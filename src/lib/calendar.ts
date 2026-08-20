/**
 * Native phone-calendar auto-sync (Phase 73, Option B — auto-add assigned tasks/reminders).
 *
 * Thin, device-only wire between `expo-calendar` and the app. Every honest DECISION (which items
 * belong on the calendar, the idempotent create/update/delete plan, the all-day span) is delegated
 * to the pure, unit-tested `lib/calendarSync.ts`; this file only performs the native side effects
 * that can't run under Vitest — the same split as `push.ts`/`pushRouting.ts` and `tracker.ts`.
 *
 * SILENT + BEST-EFFORT. The sync is invisible: a denied permission, an offline fetch, or a
 * calendar-API error just means "no sync this time," never a banner or a crash. Events land in a
 * dedicated **"CGPE Connect"** calendar so the user can hide or remove the whole thing in one place.
 * Permission is requested LAZILY — only when there is actually something to add — so a member with
 * no dated tasks is never prompted. Web is a no-op throughout.
 */
import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';

import { storage } from '@/lib/storage';
import * as api from '@/data/api';
import { buildSyncItems, planSync, fingerprint, allDayRange, type SyncMap } from '@/lib/calendarSync';

const isWeb = Platform.OS === 'web';
const CALENDAR_TITLE = 'CGPE Connect';
const CAL_ID_KEY = 'cal.id';       // the dedicated calendar's device id
const CAL_MAP_KEY = 'cal.map';     // JSON SyncMap: item key → { eventId, fp }
const CAL_ASKED_KEY = 'cal.asked'; // '1' once we've prompted for permission (so we don't nag)

const MIN_SYNC_GAP_MS = 15 * 60 * 1000; // throttle foreground syncs
let lastSyncAt = 0;
let syncing = false; // guard against overlapping passes

async function ensurePermission(): Promise<boolean> {
  try {
    let perm = await Calendar.getCalendarPermissions();
    if (perm.granted) return true;
    const asked = await storage.get(CAL_ASKED_KEY).catch(() => null);
    // Ask at most once: if the user declines, we never nag again — auto-sync simply stays off.
    if (perm.canAskAgain && !asked) {
      await storage.set(CAL_ASKED_KEY, '1').catch(() => {});
      perm = await Calendar.requestCalendarPermissions();
    }
    return !!perm.granted;
  } catch {
    return false;
  }
}

/** Find-or-create the dedicated "CGPE Connect" calendar; returns the calendar object or null. */
async function getCalendar(): Promise<Calendar.ExpoCalendar | null> {
  try {
    const cals = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
    const saved = await storage.get(CAL_ID_KEY).catch(() => null);
    if (saved) {
      const hit = cals.find((c) => c.id === saved && c.allowsModifications);
      if (hit) return hit;
    }
    const existing = cals.find((c) => c.title === CALENDAR_TITLE && c.allowsModifications);
    if (existing) {
      await storage.set(CAL_ID_KEY, existing.id).catch(() => {});
      return existing;
    }
    const created = await Calendar.createCalendar({
      title: CALENDAR_TITLE,
      color: '#155DFB',
      entityType: Calendar.EntityTypes.EVENT,
      name: CALENDAR_TITLE,
      ownerAccount: 'personal',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
      // Android needs a source; a local account keeps it on-device and removable.
      source: { isLocalAccount: true, name: CALENDAR_TITLE, type: '' },
    });
    if (created?.id) await storage.set(CAL_ID_KEY, created.id).catch(() => {});
    return created ?? null;
  } catch {
    return null;
  }
}

async function readMap(): Promise<SyncMap> {
  try {
    const raw = await storage.get(CAL_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as SyncMap) : {};
  } catch {
    return {};
  }
}

/**
 * One full reconciliation pass: mirror this user's dated, open tasks + reminders into the dedicated
 * calendar, creating/updating/deleting exactly what changed. Silent and best-effort throughout.
 */
export async function syncCalendar(): Promise<void> {
  if (isWeb || syncing) return;
  syncing = true;
  try {
    // Build the desired set FIRST (network only, no calendar permission needed). If there is nothing
    // to mirror and nothing was ever mirrored, return WITHOUT prompting for calendar access — a
    // member with no dated work is never asked for a permission they don't need yet.
    const [tasks, reminders] = await Promise.all([api.getTasks(true), api.getReminders()]);
    const desired = buildSyncItems(tasks, reminders);
    const map = await readMap();
    const plan = planSync(desired, map);
    if (!plan.create.length && !plan.update.length && !plan.remove.length) return;

    if (!(await ensurePermission())) return;
    const cal = await getCalendar();
    if (!cal) return;

    const next: SyncMap = { ...map };

    for (const item of plan.create) {
      const range = allDayRange(item.startISO);
      if (!range) continue;
      try {
        const ev = await cal.createEvent({
          title: item.title, startDate: range.start, endDate: range.end, allDay: true, notes: item.notes,
        });
        if (ev?.id) next[item.key] = { eventId: ev.id, fp: fingerprint(item) };
      } catch {
        /* leave unmapped → retried next sync */
      }
    }

    for (const { item, eventId } of plan.update) {
      const range = allDayRange(item.startISO);
      if (!range) continue;
      const detail = { title: item.title, startDate: range.start, endDate: range.end, allDay: true, notes: item.notes };
      try {
        const ev = await Calendar.ExpoCalendarEvent.get(eventId);
        await ev.update(detail);
        next[item.key] = { eventId, fp: fingerprint(item) };
      } catch {
        // The user deleted the event out from under us → recreate it so the calendar stays truthful.
        try {
          const ev = await cal.createEvent(detail);
          if (ev?.id) next[item.key] = { eventId: ev.id, fp: fingerprint(item) };
        } catch {
          /* leave the stale entry; next sync retries */
        }
      }
    }

    for (const { key, eventId } of plan.remove) {
      try {
        const ev = await Calendar.ExpoCalendarEvent.get(eventId);
        await ev.delete();
      } catch {
        /* already gone — fine */
      }
      delete next[key];
    }

    await storage.set(CAL_MAP_KEY, JSON.stringify(next)).catch(() => {});
  } catch {
    /* a calendar failure is never surfaced */
  } finally {
    syncing = false;
  }
}

/** Throttled entry point: force on sign-in, throttle repeated foreground syncs. */
export async function maybeSyncCalendar(force = false): Promise<void> {
  if (isWeb) return;
  const now = Date.now();
  if (!force && now - lastSyncAt < MIN_SYNC_GAP_MS) return;
  lastSyncAt = now;
  await syncCalendar();
}

/**
 * Remove this user's mirrored events on sign-out, so a shared handset never leaves one person's
 * tasks in the next person's calendar. Best-effort. A no-op when nothing was ever mirrored (empty
 * map ⇒ no permission prompt, no native calls) — safe to call on a signed-out boot.
 */
export async function clearCalendarSync(): Promise<void> {
  if (isWeb) return;
  const map = await readMap();
  const keys = Object.keys(map);
  lastSyncAt = 0;
  if (!keys.length) {
    await storage.remove(CAL_MAP_KEY).catch(() => {});
    return;
  }
  for (const key of keys) {
    try {
      const ev = await Calendar.ExpoCalendarEvent.get(map[key].eventId);
      await ev.delete();
    } catch {
      /* already gone */
    }
  }
  await storage.remove(CAL_MAP_KEY).catch(() => {});
}
