/**
 * Native phone-calendar auto-sync (Phase 73, Option B — auto-add assigned tasks/reminders).
 *
 * Thin, device-only wire between `expo-calendar` and the app. Every honest DECISION (which items
 * belong on the calendar, the idempotent create/update/delete plan, the all-day span) is delegated
 * to the pure, unit-tested `lib/calendarSync.ts`; this file only performs the native side effects
 * that need native mocks under Vitest — the same split as `push.ts`/`pushRouting.ts` and `tracker.ts`.
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
import { getHealth } from '@/data/health';
import type { TFn } from '@/i18n';
import { buildSyncItems, planSync, fingerprint, allDayRange, type SyncItem, type SyncMap } from '@/lib/calendarSync';

const isWeb = Platform.OS === 'web';
const CALENDAR_TITLE = 'CGPE Connect';
const CAL_ID_KEY = 'cal.id';       // the dedicated calendar's device id
const CAL_OWNER_KEY = 'cal.owner'; // initiating account id; never infer it from a later session
const CAL_MAP_KEY = 'cal.map';     // JSON SyncMap: item key → { eventId, fp }
const CAL_ASKED_KEY = 'cal.asked'; // '1' once we've prompted for permission (so we don't nag)

const MIN_SYNC_GAP_MS = 15 * 60 * 1000; // throttle foreground syncs
let lastSyncAt = 0;

async function ensurePermission(request: SyncRequest): Promise<boolean> {
  try {
    let perm = await Calendar.getCalendarPermissions();
    if (!isCurrent(request)) return false;
    if (perm.granted) return true;
    const asked = await storage.get(CAL_ASKED_KEY).catch(() => null);
    if (!isCurrent(request)) return false;
    // Ask at most once: if the user declines, we never nag again — auto-sync simply stays off.
    if (perm.canAskAgain && !asked) {
      await storage.set(CAL_ASKED_KEY, '1').catch(() => {});
      if (!isCurrent(request)) return false;
      perm = await Calendar.requestCalendarPermissions();
    }
    return !!perm.granted;
  } catch {
    return false;
  }
}

/** Find-or-create the dedicated "CGPE Connect" calendar; returns the calendar object or null. */
async function getCalendar(request: SyncRequest): Promise<Calendar.ExpoCalendar | null> {
  try {
    const cals = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
    const saved = await storage.get(CAL_ID_KEY).catch(() => null);
    if (!isCurrent(request)) return null;
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

type SyncRequest = { ownerId: string | null; tr?: TFn; generation: number };
type MirrorState = { ownerId: string | null; map: SyncMap };

// One queue owns native event/map mutations. Language requests coalesce without changing owner
// generation; account transitions invalidate an in-flight pass immediately, before the next await.
let currentOwner: string | null | undefined;
let ownerGeneration = 0;
let clearPending = false;
let pending: SyncRequest | null = null;
let worker: Promise<void> | null = null;
let mirror: MirrorState | null = null;

function isCurrent(request: SyncRequest): boolean {
  return request.ownerId === currentOwner && request.generation === ownerGeneration;
}

async function readMirror(): Promise<MirrorState> {
  if (mirror) return mirror;
  const [ownerId, raw] = await Promise.all([storage.get(CAL_OWNER_KEY), storage.get(CAL_MAP_KEY)]);
  const map: SyncMap = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed)) {
        if (!value || typeof value !== 'object') continue;
        const entry = value as Partial<SyncMap[string]>;
        if (typeof entry.eventId === 'string' && typeof entry.fp === 'string') {
          map[key] = { eventId: entry.eventId, fp: entry.fp };
        }
      }
    }
  } catch { /* unusable legacy map */ }
  mirror = { ownerId, map };
  return mirror;
}

// storage deliberately swallows write errors. Read back before relying on a persisted checkpoint.
async function saveMap(state: MirrorState): Promise<boolean> {
  const raw = JSON.stringify(state.map);
  await storage.set(CAL_MAP_KEY, raw);
  return (await storage.get(CAL_MAP_KEY)) === raw;
}

function isMissingEvent(error: unknown): boolean {
  // SDK 57 next API: EventNotFoundException -> ERR_EVENT_NOT_FOUND on Android and iOS.
  return !!error && typeof error === 'object'
    && 'code' in error && error.code === 'ERR_EVENT_NOT_FOUND';
}

async function deleteEvent(eventId: string): Promise<boolean> {
  try {
    const event = await Calendar.ExpoCalendarEvent.get(eventId);
    await event.delete();
    return true;
  } catch (error) {
    // Permission/transient failures must retain the tracked id for a later cleanup attempt.
    return isMissingEvent(error);
  }
}

/** Only called by the queue. Cleanup may finish after invalidation: no newer owner runs yet. */
async function clearMirror(state: MirrorState): Promise<boolean> {
  for (const [key, entry] of Object.entries(state.map)) {
    if (await deleteEvent(entry.eventId)) delete state.map[key];
  }
  if (Object.keys(state.map).length) {
    await saveMap(state);
    return false;
  }
  // Remove the map before its owner. A partially completed clear remains attributable on restart.
  await storage.remove(CAL_MAP_KEY);
  if ((await storage.get(CAL_MAP_KEY)) !== null) return false;
  await storage.remove(CAL_OWNER_KEY);
  if ((await storage.get(CAL_OWNER_KEY)) !== null) return false;
  state.ownerId = null;
  return true;
}

async function runSync(request: SyncRequest): Promise<void> {
  if (!isCurrent(request)) return;
  const state = await readMirror();
  if (!isCurrent(request)) return;

  // Unknown legacy ownership is never silently adopted by the next account on a shared handset.
  if (request.ownerId === null || clearPending || state.ownerId !== request.ownerId) {
    const cleared = await clearMirror(state);
    if (!isCurrent(request) || !cleared) return;
    clearPending = false;
  }
  if (request.ownerId === null) return;

  // Establish ownership before creating events, even when the source is currently empty/offline.
  await storage.set(CAL_OWNER_KEY, request.ownerId);
  const savedOwner = await storage.get(CAL_OWNER_KEY);
  if (!isCurrent(request) || savedOwner !== request.ownerId) return;
  state.ownerId = request.ownerId;

  try {
    const [tasks, reminders] = await Promise.all([api.getTasks(true), api.getReminders()]);
    if (!isCurrent(request)) return;
    const desired = buildSyncItems(tasks, reminders, request.tr);
    const plan = planSync(desired, state.map);
    // API outage reads can resolve empty. Never treat that empty result as completed/deleted work.
    const sourceDown = getHealth().failures.some((key) => key === '/tasks' || key === '/reminders');
    const removes = sourceDown ? [] : plan.remove;
    if (!plan.create.length && !plan.update.length && !removes.length) return;

    if (!(await ensurePermission(request)) || !isCurrent(request)) return;
    const cal = await getCalendar(request);
    if (!cal || !isCurrent(request)) return;

    const create = async (item: SyncItem): Promise<boolean> => {
      if (!isCurrent(request)) return false;
      const range = allDayRange(item.startISO);
      if (!range) return true;
      try {
        const event = await cal.createEvent({
          title: item.title, startDate: range.start, endDate: range.end,
          allDay: true, notes: item.notes,
        });
        if (!event?.id) return true;
        // Record the id immediately, including one returned after sign-out. The finally cleanup
        // owns this old-account journal and removes partially created events before the next pass.
        state.map[item.key] = { eventId: event.id, fp: fingerprint(item) };
        if (!isCurrent(request)) return false;
        if (await saveMap(state)) return isCurrent(request);
        // Do not knowingly leave an uncheckpointed new event. Keep failed rollback ids in memory.
        if (await deleteEvent(event.id)) delete state.map[item.key];
        await saveMap(state);
        return false;
      } catch {
        return isCurrent(request); // leave unmapped; a later pass can retry
      }
    };

    for (const item of plan.create) {
      if (!(await create(item))) return;
    }

    for (const { item, eventId } of plan.update) {
      if (!isCurrent(request)) return;
      const range = allDayRange(item.startISO);
      if (!range) continue;
      let event: Calendar.ExpoCalendarEvent;
      try {
        event = await Calendar.ExpoCalendarEvent.get(eventId);
      } catch (error) {
        if (!isCurrent(request)) return;
        // Recreate only a known missing event; a notes-only update failure must not duplicate it.
        if (isMissingEvent(error) && !(await create(item))) return;
        continue;
      }
      if (!isCurrent(request)) return;
      try {
        await event.update({
          title: item.title, startDate: range.start, endDate: range.end,
          allDay: true, notes: item.notes,
        });
        if (!isCurrent(request)) return;
        state.map[item.key] = { eventId, fp: fingerprint(item) };
        if (!(await saveMap(state)) || !isCurrent(request)) return;
      } catch {
        /* keep the original id/fingerprint so a later pass retries the update */
      }
    }

    for (const { key, eventId } of removes) {
      if (!isCurrent(request)) return;
      // Check after lookup and before delete; an old request must not begin another native mutation.
      try {
        const event = await Calendar.ExpoCalendarEvent.get(eventId);
        if (!isCurrent(request)) return;
        await event.delete();
      } catch (error) {
        if (!isCurrent(request)) return;
        if (!isMissingEvent(error)) continue;
      }
      delete state.map[key];
      if (!isCurrent(request)) return;
      if (!(await saveMap(state)) || !isCurrent(request)) return;
    }
  } finally {
    // A same-owner language request leaves generation unchanged and keeps all native event IDs.
    // Account changes/sign-out always clean the entire old journal, including partial creations.
    if (!isCurrent(request)) await clearMirror(state);
  }
}

function startWorker(): Promise<void> {
  if (worker) return worker;
  worker = Promise.resolve().then(async () => {
    while (pending) {
      const request = pending;
      pending = null;
      try { await runSync(request); } catch { /* silent best-effort; queue remains usable */ }
    }
  }).finally(() => {
    worker = null;
    // Cover a request queued in the microtask gap between the drain and this finalizer.
    if (pending) return startWorker();
  });
  return worker;
}

function enqueue(ownerId: string | null, force: boolean, tr?: TFn): Promise<void> {
  if (isWeb) return Promise.resolve();
  const ownerChanged = currentOwner !== ownerId;
  if (ownerChanged) {
    if (currentOwner !== undefined) clearPending = true;
    currentOwner = ownerId;
    ownerGeneration += 1;
    lastSyncAt = 0;
  }
  // Explicit clear stays sticky even if a subsequent sync coalesces it away before the worker runs.
  if (ownerId === null) clearPending = true;
  const now = Date.now();
  if (ownerId !== null && !force && !ownerChanged && now - lastSyncAt < MIN_SYNC_GAP_MS) {
    return worker ?? Promise.resolve();
  }
  if (ownerId !== null) lastSyncAt = now;
  pending = { ownerId, tr, generation: ownerGeneration };
  return startWorker();
}

/** Owner and translator are captured at the UI boundary; neither is imported from React here. */
export function syncCalendar(ownerId: string, tr?: TFn): Promise<void> {
  if (!ownerId) return Promise.resolve();
  return enqueue(ownerId, true, tr);
}

/** Force on sign-in/language change; throttle ordinary foreground reconciliation for that owner. */
export function maybeSyncCalendar(ownerId: string, force = false, tr?: TFn): Promise<void> {
  if (!ownerId) return Promise.resolve();
  return enqueue(ownerId, force, tr);
}

/** Serializes with sync; invalidates any old in-flight request immediately and never prompts. */
export function clearCalendarSync(): Promise<void> {
  return enqueue(null, true);
}
