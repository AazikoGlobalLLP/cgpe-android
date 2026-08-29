/**
 * The core voice types shared across the module. Kept native-free and dependency-light so the whole
 * decision layer (gate, resolve, session, registry) stays inside the Vitest graph without a stub.
 */
import type { Gate } from '@/voice/gate';
import type { VoiceRoute } from '@/voice/routes';

/** What a voice verb does. Writes ALWAYS require a confirm tap; reads execute directly (§7). */
export type IntentKind = 'read' | 'write' | 'navigate';

/**
 * The api.ts write functions a voice WRITE intent may dispatch to. Deliberately tiny — only the three
 * additive/queueable creates whose one-attempt + idempotency-key + offline-queue substrate is already
 * built and tested. A name here is a string TAG the registry stays native-free with; `dispatch.ts`
 * resolves it to the real function (so the registry never imports `api.ts`). Clock-in/out are NOT
 * here — they are `navigate` intents that open the home clock control so the geofence + reason sheets
 * run; a spoken clock-in must never bypass a compliance prompt.
 */
export type WriteApiFn = 'addNote' | 'addTask' | 'addLead';

/**
 * The NLU's ONLY output. The model picks the verb and its args; it never composes the answer, never
 * sees client data, never touches an endpoint (architecture §7 — "the model picks the verb, the app
 * writes the sentence"). `intentId` is a stable id from the registry; an id not in the registry is an
 * `unknown` outcome, never a guess.
 */
export type NluResult = {
  intentId: string;
  args: Record<string, unknown>;
  /** 0..1. Below `VOICE.CONFIDENCE_MIN` the app will not act. */
  confidence: number;
};

/**
 * Summary of resolving a named entity (a person/client) against the REAL book on the phone — never
 * free-formed by the model (§5 #5). The orchestrator computes this via `searchScore`; the resolver
 * only reads the count so its decision stays pure and testable.
 */
export type EntityResolution = {
  /** Does this intent need an entity resolved at all? A count of tasks needs none; "Ramesh ka number" does. */
  required: boolean;
  /** Candidate matches for the named entity: 0 (not found), 1 (resolved), or 2+ (disambiguate). */
  matchCount: number;
};

/**
 * The FIVE outcomes of the architecture's ambiguity table — Resolved / Disambiguate / Slot-fill /
 * Low confidence / Unknown — plus the two the write sequence adds (Forbidden at step 2, and Not-found
 * as the natural 0-match partner of Disambiguate's 2+ and Resolved's 1). "There is no sixth, and no
 * best guess" (§7): every path a command can take ends on exactly one of these tags.
 */
export type VoiceOutcome =
  /** No tool, or an intent id the registry does not know → honest refusal + fall back to search. */
  | { kind: 'unknown' }
  /** conf < threshold → show the transcript, "aapne yeh kaha?", offer edit + nearest intents. */
  | { kind: 'lowConfidence' }
  /** The gate refused → speak the refusal, stop, render nothing. */
  | { kind: 'forbidden' }
  /** A required arg is missing → ONE targeted question, then re-open the mic. */
  | { kind: 'slotFill'; slot: string }
  /** The named entity matched 2+ people → a visual choose sheet (names are tapped, never re-spoken). */
  | { kind: 'disambiguate' }
  /** The named entity matched nobody → "couldn't find them", fall back to search. */
  | { kind: 'notFound' }
  /** Known intent, gate ok, slots filled, one match (or none needed), confidence ≥ T → execute. */
  | { kind: 'resolved' };

/** The typed result of executing a write, mirroring the app's honest failure vocabulary (§7). */
export type VoiceRunOutcome =
  | 'saved'
  | 'queued'
  | 'forbidden'
  | 'invalid'
  | 'unsupported'
  | 'timeout'
  | 'network'
  | 'server';

/**
 * How a read/write behaves with no network (§7 offline — four tiers). `cache` reads stale-with-a-
 * timestamp; `queue` writes into the existing offline queue (note/task/lead ONLY); `refuse` fails
 * honestly (never queue a clock-in); `local` is on-device navigation that needs no network at all.
 */
export type OfflineTier = 'cache' | 'queue' | 'refuse' | 'local';

/**
 * A single voice verb — the ONLY place a voice-reachable action is declared (`registry.ts`). Curating
 * this allow-list is a feature: it is what stops a new internal `api.ts` helper from silently becoming
 * voice-reachable. Shape per architecture §7; the fields are filled in as the registry is built.
 */
export type VoiceIntent = {
  /** Stable, never renamed once shipped (e.g. `tasks.today.count`). */
  id: string;
  kind: IntentKind;
  gate: Gate;
  /** Required arg names, used for slot-fill; [] for a no-arg verb. */
  requiredArgs: readonly string[];
  /** Does resolving this verb need a named entity (person/client)? */
  needsEntity: boolean;
  offline: OfflineTier;
  /** For kind 'navigate': the route to open (must be in the `routes.ts` allow-list). */
  route?: VoiceRoute;
  /** For kind 'write': which api.ts create dispatch will call (v1: execution feature-flagged OFF). */
  write?: WriteApiFn;
};
