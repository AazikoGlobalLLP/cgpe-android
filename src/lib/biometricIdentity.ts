import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Hardware-bound biometric identity resolution.
 *
 * THE BUG THIS SOLVES. The app-lock used to ask the OS one question: "is a valid fingerprint
 * present?". That is a liveness check, not an identity check. It tells you a human the device
 * trusts is holding the phone. It tells you nothing about WHICH account that human owns, so
 * the unlock path had to fall back on "whoever was signed in last", read from a plaintext
 * cache. Person X signs into person Y's account, deletes the app, reinstalls, unlocks with
 * their own finger, and lands in Y's client book.
 *
 * THE FIX. The identity is not inferred at unlock time; it is *bound* at sign-in time. The
 * (userId, token) pair that the server actually authenticated is sealed into a keystore entry
 * that only a biometric unlock can open. `resolveBoundIdentity` is the single door: it either
 * returns the exact pair that was sealed, or it returns null. There is no third answer and no
 * plaintext fallback, so a biometric unlock can never synthesise a user out of stale state.
 *
 * TWO INDEPENDENT LOCKS, BECAUSE ONE IS NOT ENOUGH.
 *
 *   1. The keystore entry (`requireAuthentication: true`). Per the SDK 57 typings this maps to
 *      `setUserAuthenticationRequired(true)` on Android and the `biometryCurrentSet` access
 *      control on iOS. Both are invalidated by the OS when the biometric enrolment set changes.
 *      A newly added fingerprint therefore makes the read FAIL rather than hand back the wrong
 *      identity, which is exactly the fail-closed behaviour we want.
 *
 *   2. An install-scoped marker (see INSTALL SCOPE below). Lock 1 alone does not close the
 *      brief's scenario on iOS, and pretending otherwise would be dishonest. See the notes on
 *      `resolveBoundIdentity` for the precise reasoning.
 *
 * WHAT THIS MODULE HONESTLY CANNOT DO. No OS API tells us which *finger* matched, so if two
 * people are both enrolled on one handset, the OS considers them the same principal and so
 * must we. This module guarantees that an unlock resolves to the account that was genuinely
 * authenticated on this install, never to a leftover one. It cannot adjudicate between two
 * humans that the device itself refuses to distinguish. The residual risk is written up in the
 * delivery notes rather than papered over here.
 *
 * No React, no UI, no throwing: every path returns a value the caller can branch on.
 */

/** The sealed pair. Both halves come back together or not at all. */
export type BoundIdentity = {
  userId: string;
  token: string;
};

/**
 * Why the last `resolveBoundIdentity` produced no identity. Purely diagnostic, so the caller
 * can word its message correctly ("try again" vs "please sign in"). The security decision is
 * always carried by the `null` return, never by this value.
 */
export type ResolveOutcome =
  | 'ok'            // an identity was returned
  | 'unsupported'   // no hardware-backed store on this platform (web)
  | 'none'          // nothing was ever bound on this install
  | 'reinstalled'   // a binding survived an uninstall; it is not ours, so it was destroyed
  | 'invalidated'   // enrolment changed or the key is gone; binding destroyed
  | 'corrupt'       // the record did not validate; binding destroyed
  | 'cancelled'     // the user dismissed the prompt; binding left intact
  | 'unavailable'   // the check could not be run right now; binding left intact
  | 'timeout';      // no answer in time; binding left intact

/**
 * Dedicated keychain service. MUST NOT be shared with `lib/storage.ts`.
 *
 * The SDK 57 typings are explicit: `requireAuthentication` "would not work in tandem with the
 * `keychainService` value used for the other non-authenticated operations", because the
 * authenticated entry needs a freshly generated key of its own. Sharing a service with the
 * ordinary token cache would silently degrade the guarantee this whole module rests on.
 *
 * It also contains the blast radius. When Android drops an invalidated key it sweeps the other
 * entries stored under that same service, since it can no longer decrypt them. That sweep skips
 * entries which do not require authentication, so the plain session token in `lib/storage.ts`
 * was never actually at risk; but keeping our own service means the sweep can only ever touch
 * this one record, which is the outcome we want to be certain of rather than reason about.
 */
const KEYCHAIN_SERVICE = 'cgpe.biometric.identity.v1';

/** Keys must match SecureStore's `/^[\w.-]+$/` validator, which these do. */
const BINDING_KEY = 'cgpe.bio.identity.v1';
const INSTALL_KEY = 'cgpe.bio.install.v1';

/** Bump to orphan every previously written record if the shape ever changes. */
const RECORD_VERSION = 1;

/**
 * A biometric prompt can sit on screen indefinitely if the user walks away. Without a bound
 * the AppLock overlay would await forever with no way to offer "sign in instead".
 */
const PROMPT_TIMEOUT_MS = 60_000;

const isWeb = Platform.OS === 'web';

/**
 * Lazily required, mirroring `lib/storage.ts`. On web this package resolves to a stub whose
 * default export is `{}`, so every call throws rather than returning a sane value. Not loading
 * it at all on web keeps that stub out of the bundle and off every code path below.
 */
let Secure: typeof import('expo-secure-store') | null = null;
if (!isWeb) {
  try {
    Secure = require('expo-secure-store');
  } catch {
    Secure = null;
  }
}

/** The persisted record. `install` is what ties the binding to one installation. */
type BindingRecord = {
  v: number;
  userId: string;
  token: string;
  install: string;
  boundAt: number;
};

let lastOutcome: ResolveOutcome = 'none';

/** In-flight resolve, so two callers never stack two biometric prompts. */
let inFlight: Promise<BoundIdentity | null> | null = null;

/**
 * Options for the authenticated entry.
 *
 * `keychainAccessible` and `accessGroup` are iOS-only fields; passing the former is not a
 * platform branch that no-ops on Android, it is a field Android ignores because the Android
 * Keystore is already non-exportable and device-bound by construction. Choosing
 * `WHEN_UNLOCKED_THIS_DEVICE_ONLY` makes the iOS item match that: never restored onto a
 * different handset from an encrypted backup, and unreadable while the screen is locked.
 */
function authOptions(prompt: string): import('expo-secure-store').SecureStoreOptions {
  return {
    keychainService: KEYCHAIN_SERVICE,
    requireAuthentication: true,
    authenticationPrompt: prompt,
    keychainAccessible: Secure?.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };
}

type Settled<T> =
  | { status: 'ok'; value: T }
  | { status: 'error'; error: unknown }
  | { status: 'timeout' };

/**
 * Run `work` with a deadline, always clearing the timer.
 *
 * `Promise.race` attaches handlers to both inputs, so a rejection arriving after the timeout
 * has already won is still considered handled and cannot surface as an unhandled rejection.
 */
async function settle<T>(work: () => Promise<T>, ms: number): Promise<Settled<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<Settled<T>>((resolve) => {
      timer = setTimeout(() => resolve({ status: 'timeout' }), ms);
    });
    const run = work().then(
      (value): Settled<T> => ({ status: 'ok', value }),
      (error: unknown): Settled<T> => ({ status: 'error', error }),
    );
    return await Promise.race([run, deadline]);
  } catch (error: unknown) {
    return { status: 'error', error };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * "We could not run the check" versus "the sealed key is dead".
 *
 * THIS DISTINCTION IS LOAD-BEARING, AND IT IS NOT ABOUT THE RETURN VALUE. Every branch below
 * still returns `null`, so the caller always routes to manual login and no identity ever leaks.
 * What it decides is whether to *destroy* the binding, and destroying it wrongly has real costs:
 *
 *   - Tapping Cancel once would silently disable quick-unlock forever, with no explanation and
 *     no way back except a full sign-in.
 *   - `ERROR_LOCKOUT` fires after a handful of failed scans, so anyone who picked up the phone
 *     could strip the owner's quick-unlock just by pressing a wrong finger five times.
 *   - "Cannot display biometric prompt when the app is not in the foreground" is thrown on a
 *     backgrounding race, which AppLock provokes by design every time it arms on an AppState
 *     change. That is the single most likely error this module will ever see, and it says
 *     nothing whatsoever about the key.
 *
 * Leaving a record in place is safe: it is biometric-gated and install-scoped, so it can never
 * produce a user on its own. Destroying one is not free. So we destroy only on a positive
 * signal of invalidation and preserve on anything transient or ambiguous.
 *
 * The patterns are taken from the strings the native modules actually raise, not invented.
 */
function readErrorKind(error: unknown): 'cancelled' | 'unavailable' | 'invalidated' {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  // "User canceled the authentication" covers both the system cancel and the negative button.
  if (/cancel|dismiss|negative.?button|user.?fallback/i.test(message)) return 'cancelled';

  // Sensor busy, locked out, timed out, or no window to draw the prompt in. All recoverable.
  if (
    /lockout|timeout|timed.?out|already in progress|not in the foreground|unable to process|vendor|hardware unavailable|no space/i.test(
      message,
    )
  ) {
    return 'unavailable';
  }

  // Everything else (decrypt failures, permanently invalidated keys, enrolment removed) is
  // treated as a dead binding.
  return 'invalidated';
}

/** Non-secret, non-guessable-enough correlator. See `readInstallId` for why that is adequate. */
function newInstallId(): string {
  let out = Date.now().toString(36);
  for (let i = 0; i < 4; i += 1) out += Math.random().toString(36).slice(2, 10);
  return out.slice(0, 48);
}

/**
 * The install marker, held in AsyncStorage rather than the keychain, deliberately.
 *
 * INSTALL SCOPE, AND WHY IT IS THE PART THAT ACTUALLY FIXES THE BRIEF. On Android the shipped
 * backup rules exclude the SecureStore preferences from both cloud backup and device transfer,
 * and the keystore alias dies with the app, so an uninstall really is a clean slate. iOS is the
 * opposite and always has been: Keychain items outlive app deletion. So on iOS the biometric
 * enrolment lock alone does NOT close "delete the app, reinstall, unlock" — the enrolment set
 * never changed, so the sealed entry is still perfectly readable and would hand back the old
 * account. That is precisely the reported bug, and lock 1 does not stop it.
 *
 * AsyncStorage lives in the app sandbox, which iOS DOES erase on uninstall. So a surviving
 * keychain record paired with a missing (or non-matching) marker is a positive signal that this
 * is a fresh install reading someone else's leftovers. We destroy it and demand a real login.
 *
 * The marker is not a secret and is not treated as one. It is a same-install correlator. It is
 * never trusted on its own: the value it is compared against lives *inside* the encrypted,
 * biometric-gated record, so forging the AsyncStorage half alone proves nothing and unlocks
 * nothing. (`expo-crypto` is not a dependency of this app and this phase adds none, so this is
 * not a CSPRNG. It does not need to be, for the job it actually does.)
 */
type InstallRead =
  | { status: 'ok'; id: string }
  | { status: 'absent' }   // storage answered, and there is genuinely no marker
  | { status: 'error' };   // storage did not answer, so we know nothing

/**
 * "Absent" and "unreadable" must not be conflated.
 *
 * A genuine absence is the reinstall signal and is grounds for destroying a surviving record.
 * A thrown read is not: AsyncStorage failing transiently would otherwise look identical to a
 * reinstall and would wipe a perfectly good binding on a device that had merely hiccupped.
 * Collapsing both into `null` would have made a storage blip indistinguishable from an attack.
 */
async function readInstallId(): Promise<InstallRead> {
  try {
    const raw = await AsyncStorage.getItem(INSTALL_KEY);
    if (typeof raw === 'string' && raw.length > 0) return { status: 'ok', id: raw };
    return { status: 'absent' };
  } catch {
    return { status: 'error' };
  }
}

async function ensureInstallId(): Promise<string | null> {
  const existing = await readInstallId();
  if (existing.status === 'ok') return existing.id;
  // A failed read is not a licence to mint a second marker over the top of an existing one, so
  // only a confirmed absence creates.
  if (existing.status === 'error') return null;
  const created = newInstallId();
  try {
    await AsyncStorage.setItem(INSTALL_KEY, created);
    return created;
  } catch {
    // Cannot scope the binding to this install, so refuse to create one at all rather than
    // write a record we could never safely validate later.
    return null;
  }
}

/** Structural validation. Anything unexpected is treated as hostile, not coerced. */
function parseRecord(raw: string): BindingRecord | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const r = data as Partial<Record<keyof BindingRecord, unknown>>;
  if (r.v !== RECORD_VERSION) return null;
  if (typeof r.userId !== 'string' || r.userId.length === 0) return null;
  if (typeof r.token !== 'string' || r.token.length === 0) return null;
  if (typeof r.install !== 'string' || r.install.length === 0) return null;
  return {
    v: RECORD_VERSION,
    userId: r.userId,
    token: r.token,
    install: r.install,
    boundAt: typeof r.boundAt === 'number' ? r.boundAt : 0,
  };
}

/**
 * True when this device can hold a hardware-backed, biometric-gated binding right now.
 *
 * "Pool" means the OS enrolment set that the sealed key is tied to. If it is empty or the
 * hardware is unusable, no binding can be created or opened, and the caller should not offer a
 * biometric unlock at all. Reported as a plain boolean because every failure mode here has the
 * same consequence: use manual login.
 */
export async function isBiometricPoolIntact(): Promise<boolean> {
  if (isWeb || !Secure) return false;
  try {
    if (!(await Secure.isAvailableAsync())) return false;
    // The authoritative answer to "can a value be saved with requireAuthentication enabled".
    // It accounts for the enrolled method being strong enough, which a bare hasHardware +
    // isEnrolled pair does not.
    //
    // The `await` is deliberate on a value the typings call a plain boolean. The SDK 57 docs
    // describe this function as async while the shipped `.d.ts`, the JS wrapper and the Kotlin
    // (registered as `Function`, not `AsyncFunction`) all agree it is synchronous. Awaiting is
    // correct under either reading: it passes a boolean straight through and unwraps a promise
    // if one ever appears. Comparing the raw value would silently report "no biometrics" on
    // every device the day that changed.
    return (await Secure.canUseBiometricAuthentication()) === true;
  } catch {
    return false;
  }
}

/**
 * Seal (userId, token) behind the biometric gate. Call this on every successful sign-in.
 *
 * Returns false rather than throwing on any refusal, so the caller can simply leave
 * quick-unlock switched off and carry on with a normal session.
 */
export async function saveBoundIdentity(userId: string, token: string): Promise<boolean> {
  if (isWeb || !Secure) return false;
  if (typeof userId !== 'string' || userId.length === 0) return false;
  if (typeof token !== 'string' || token.length === 0) return false;
  if (!(await isBiometricPoolIntact())) return false;

  const install = await ensureInstallId();
  if (!install) return false;

  const record: BindingRecord = {
    v: RECORD_VERSION,
    userId,
    token,
    install,
    boundAt: Date.now(),
  };

  // Always write into a fresh slot.
  //
  // WHY THE DELETE IS NOT REDUNDANT. The SDK documents a real platform asymmetry: with
  // `requireAuthentication` on, iOS prompts when *updating* an existing value but not when
  // creating one, while Android prompts for every operation. Deleting first makes the write a
  // create on both platforms, so re-binding costs the same single prompt either way instead of
  // an extra one on iOS only. It also guarantees that a failed write cannot leave the previous
  // account's record in place, which would be the one genuinely dangerous outcome here.
  //
  // What it does NOT do, despite being an easy thing to assume: it does not force a newly
  // generated Android keystore key. The native delete only clears the shared-prefs row and
  // leaves the alias alone, so the next write reuses the existing key. That is fine, because
  // that key is already gated by `requireAuthentication` under our own service and is still
  // invalidated by enrolment changes. The claim is just not one this delete earns.
  await clearBoundIdentity();

  const written = await settle(
    () =>
      Secure!.setItemAsync(
        BINDING_KEY,
        JSON.stringify(record),
        authOptions('Confirm it is you to enable quick unlock'),
      ),
    PROMPT_TIMEOUT_MS,
  );

  if (written.status !== 'ok') {
    // Never leave a half-written binding behind.
    await clearBoundIdentity();
    return false;
  }
  return true;
}

/**
 * The ONLY way a biometric unlock may produce a user.
 *
 * Returns the exact pair sealed at sign-in, so the caller signs in as precisely that person and
 * never as "whoever was here last". Any doubt at all resolves to null.
 */
export async function resolveBoundIdentity(): Promise<BoundIdentity | null> {
  // Collapse concurrent calls. AppLock arms on cold start and again on foreground, and those
  // can overlap; without this the user gets two stacked biometric prompts.
  if (inFlight) return inFlight;
  const run = resolveOnce();
  inFlight = run;
  try {
    return await run;
  } finally {
    inFlight = null;
  }
}

async function resolveOnce(): Promise<BoundIdentity | null> {
  if (isWeb || !Secure) {
    lastOutcome = 'unsupported';
    return null;
  }

  // Check install scope BEFORE prompting. It is a cheap local read, and on a fresh install it
  // lets us destroy a leftover keychain record without making the user authenticate first for
  // an answer we already know we are going to throw away.
  const install = await readInstallId();

  if (install.status === 'error') {
    // We cannot tell whether this install owns the record, so we neither trust it nor destroy
    // it. Refusing is the only safe move; the user signs in manually and rebinds.
    lastOutcome = 'unavailable';
    return null;
  }

  if (install.status === 'absent') {
    // No marker, so nothing this install ever bound. On Android the keystore entry died with
    // the uninstall anyway; on iOS a record can still be sitting in the keychain from a
    // previous installation, and that is exactly the one we must never open. Destroy it
    // unread. Reported as 'none' rather than 'reinstalled' because we deliberately did not
    // prompt, so we genuinely do not know whether a leftover was there.
    lastOutcome = 'none';
    await clearBoundIdentity();
    return null;
  }

  const read = await settle(
    () => Secure!.getItemAsync(BINDING_KEY, authOptions('Unlock CGPE Connect')),
    PROMPT_TIMEOUT_MS,
  );

  if (read.status === 'timeout') {
    // We never got an answer, which is not evidence the key is dead. Report nothing, keep the
    // binding, let the user try again or sign in manually.
    lastOutcome = 'timeout';
    return null;
  }

  if (read.status === 'error') {
    const kind = readErrorKind(read.error);
    lastOutcome = kind;
    // Only a positive invalidation signal destroys the record. See `readErrorKind`.
    if (kind === 'invalidated') await clearBoundIdentity();
    return null;
  }

  // A null here is the documented result for BOTH "nothing stored" and "the key was
  // invalidated because the enrolment set changed". The platform does not separate them, and
  // for our purposes they are the same event: there is no trustworthy binding. Destroy the
  // slot and route to manual login.
  if (read.value === null) {
    lastOutcome = 'invalidated';
    await clearBoundIdentity();
    return null;
  }

  const record = parseRecord(read.value);
  if (!record) {
    lastOutcome = 'corrupt';
    await clearBoundIdentity();
    return null;
  }

  // The decisive check for the reported bug. A record whose install marker is not this
  // install's is a survivor of a previous installation, so it names an account this install
  // never authenticated. It is destroyed unread.
  if (record.install !== install.id) {
    lastOutcome = 'reinstalled';
    await clearBoundIdentity();
    return null;
  }

  lastOutcome = 'ok';
  return { userId: record.userId, token: record.token };
}

/**
 * Destroy the binding. Call on sign-out, on account deletion, and whenever quick-unlock is
 * turned off. Never throws and never reports failure, because every caller's next step is the
 * same regardless and a failed cleanup must not block a sign-out.
 */
export async function clearBoundIdentity(): Promise<void> {
  if (isWeb || !Secure) return;
  try {
    await Secure.deleteItemAsync(BINDING_KEY, {
      keychainService: KEYCHAIN_SERVICE,
      requireAuthentication: true,
    });
  } catch {
    // Deleting an authenticated entry can be refused on some devices. Retry against the bare
    // service so a stale row is not left readable just because the gated delete was unhappy.
    try {
      await Secure.deleteItemAsync(BINDING_KEY, { keychainService: KEYCHAIN_SERVICE });
    } catch {
      // Nothing further is available. The record stays sealed and install-scoped, so it still
      // cannot resolve to a user on a future install.
    }
  }
}

/**
 * Why the last resolve returned nothing. Diagnostic only: never branch security on this, only
 * the wording of a message. Reads are cheap and synchronous so a render path can call it.
 */
export function getLastResolveOutcome(): ResolveOutcome {
  return lastOutcome;
}
