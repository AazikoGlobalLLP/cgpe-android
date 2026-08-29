/**
 * The voice intent registry — the ONE place a voice-reachable verb is declared, and the curated
 * allow-list that is itself a security feature (§7). n8n proposes an `intentId`; the app looks it up
 * HERE and refuses anything it does not know, so a new internal `api.ts` helper can never silently
 * become voice-reachable, and n8n cannot name a verb the app has not sanctioned.
 *
 * This file is PURE and native-free by construction — it declares metadata only (kind, gate,
 * offline tier, and for a write the string TAG of the api.ts function). `dispatch.ts` resolves a
 * write tag to the real function, so the registry never imports `api.ts`.
 *
 * v1 scope (conservative, per the build plan):
 *  - READS execute directly (the orchestrator fetches and speaks the answer).
 *  - `clock.in` / `clock.out` are **navigate** intents, NOT writes — they open the home clock control
 *    so the existing geofence + mandatory-reason + early-clock-out sheets run. A spoken clock-in must
 *    never bypass a compliance prompt that reports to super_admin.
 *  - The three additive creates (`note.add` / `task.add` / `lead.add`) are declared as writes, but
 *    their EXECUTION is feature-flagged OFF in `dispatch.ts` for the first APK (a mis-wired write is a
 *    real mutation no gate can catch, and there is no device to verify on until the EAS quota resets).
 *  - Everything in `NOT_VOICE_EXPOSED` is absent from the table on purpose.
 */
import type { VoiceIntent } from '@/voice/types';

/** Every intent, keyed by its stable id. Ids are never renamed once shipped. */
export const VOICE_INTENTS: Record<string, VoiceIntent> = {
  // ---- READS: the caller's OWN data, no entity needed. `self` = any signed-in user. ----
  'tasks.today.count':   { id: 'tasks.today.count',   kind: 'read', gate: { kind: 'self' }, requiredArgs: [], needsEntity: false, offline: 'cache' },
  'tasks.today.list':    { id: 'tasks.today.list',    kind: 'read', gate: { kind: 'self' }, requiredArgs: [], needsEntity: false, offline: 'cache' },
  'tasks.overdue':       { id: 'tasks.overdue',       kind: 'read', gate: { kind: 'self' }, requiredArgs: [], needsEntity: false, offline: 'cache' },
  'clock.status':        { id: 'clock.status',        kind: 'read', gate: { kind: 'self' }, requiredArgs: [], needsEntity: false, offline: 'refuse' },
  'attendance.summary':  { id: 'attendance.summary',  kind: 'read', gate: { kind: 'self' }, requiredArgs: [], needsEntity: false, offline: 'refuse' },
  'commission.summary':  { id: 'commission.summary',  kind: 'read', gate: { kind: 'self' }, requiredArgs: [], needsEntity: false, offline: 'refuse' },
  'earnings.my':         { id: 'earnings.my',         kind: 'read', gate: { kind: 'self' }, requiredArgs: [], needsEntity: false, offline: 'refuse' },
  'reminders.today':     { id: 'reminders.today',     kind: 'read', gate: { kind: 'self' }, requiredArgs: [], needsEntity: false, offline: 'cache' },
  'notifications.unread':{ id: 'notifications.unread',kind: 'read', gate: { kind: 'self' }, requiredArgs: [], needsEntity: false, offline: 'cache' },
  'leads.pipeline':      { id: 'leads.pipeline',      kind: 'read', gate: { kind: 'self' }, requiredArgs: [], needsEntity: false, offline: 'cache' },
  'claims.pending':      { id: 'claims.pending',      kind: 'read', gate: { kind: 'self' }, requiredArgs: [], needsEntity: false, offline: 'refuse' },

  // ---- READS naming a person. The gate is coarse; the real scope is enforced at entity resolution
  //      (search is already role-scoped, so a team member's lookup never surfaces the client book). ----
  'person.phone':        { id: 'person.phone',        kind: 'read', gate: { kind: 'self' },                 requiredArgs: ['name'], needsEntity: true, offline: 'refuse' },
  // A client DETAIL is book PII → the strict client-book gate, not `self`.
  'client.detail':       { id: 'client.detail',       kind: 'read', gate: { kind: 'clientBook', scope: 'own' }, requiredArgs: ['name'], needsEntity: true, offline: 'refuse' },

  // ---- CLOCK: navigate, never a write (open the home control so the compliance sheets run). ----
  'clock.in':            { id: 'clock.in',            kind: 'navigate', gate: { kind: 'self', flag: 'can_clock_in' }, requiredArgs: [], needsEntity: false, offline: 'refuse', route: '/(tabs)/home' },
  'clock.out':           { id: 'clock.out',           kind: 'navigate', gate: { kind: 'self', flag: 'can_clock_in' }, requiredArgs: [], needsEntity: false, offline: 'refuse', route: '/(tabs)/home' },

  // ---- WRITES: the three additive/queueable creates. EXECUTION is feature-flagged OFF in v1. ----
  //      task.add is open to every member for their OWN task (owner decision), gated on can_create_task
  //      via the flag (which can only NARROW when a future config sets it false).
  'note.add':            { id: 'note.add',            kind: 'write', gate: { kind: 'self' },                          requiredArgs: ['text'],  needsEntity: false, offline: 'queue', write: 'addNote' },
  'task.add':            { id: 'task.add',            kind: 'write', gate: { kind: 'self', flag: 'can_create_task' }, requiredArgs: ['title'], needsEntity: false, offline: 'queue', write: 'addTask' },
  'lead.add':            { id: 'lead.add',            kind: 'write', gate: { kind: 'self' },                          requiredArgs: ['name'],  needsEntity: false, offline: 'queue', write: 'addLead' },
};

/**
 * Ids that must NEVER be voice-reachable, recorded so the exclusion is deliberate and reviewable, not
 * an oversight. A test asserts none of these appear as a registry key.
 *  - `clockIn` / `clockOut` (direct): must go through the home flow (see `clock.in`/`clock.out` above).
 *  - `sendWaMessage`: the send endpoint has no scope check — any token could message any number.
 *  - `dispatchNotification`: admin broadcast; not a spoken action.
 *  - `deleteNote` / `deleteAccount`: destructive; never voice-triggered.
 *  - `setLocationConsent`: a consent decision must be an explicit tap, never spoken.
 *  - `generateReport`: kicks off slow n8n work; belongs to the JobPill flow, not a voice write.
 */
export const NOT_VOICE_EXPOSED: readonly string[] = [
  'clockIn', 'clockOut', 'sendWaMessage', 'dispatchNotification',
  'deleteNote', 'deleteAccount', 'setLocationConsent', 'generateReport',
];

/** Look up an intent by id. `undefined` for an id the registry does not know (⇒ an `unknown` outcome). */
export function getVoiceIntent(id: string | null | undefined): VoiceIntent | undefined {
  return id ? VOICE_INTENTS[id] : undefined;
}

/** Is this a sanctioned voice intent id? */
export function isKnownIntent(id: string | null | undefined): boolean {
  return !!id && Object.prototype.hasOwnProperty.call(VOICE_INTENTS, id);
}
