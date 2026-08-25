import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { storage } from '@/lib/storage';
import * as api from '@/data/api';
import { EXPIRY_MESSAGE, ExpiryReason, onSessionExpired, resetSessionGuard } from '@/lib/session';
import { resetHealth } from '@/data/health';
import { resetFreshness } from '@/data/freshness';   // Phase 57a — clear stale-cache marks on sign-out
// One-directional: i18n imports nothing from this store, so there is no require cycle.
// Language is persisted per user (`cgpe.lang.<userId>`), and the provider only re-reads which
// user is signed in when it is told to. Without these calls a user switch inside one app run
// would keep showing the previous person's language until the app was next foregrounded.
import { refreshI18nUser } from '@/i18n';
// Hardware-bound biometric identity. A biometric unlock must resolve to the account that was
// genuinely authenticated ON THIS INSTALL, never to whoever happens to be cached. Phase 48 wires
// the READ half (`resolveBoundIdentity`) to restore a session from the sealed 30-day refresh
// credential after a silent token expiry — fingerprint only, no id/OTP.
import {
  clearBoundIdentity,
  getLastResolveOutcome,
  isBiometricPoolIntact,
  resolveBoundIdentity,
  saveBoundIdentity,
} from '@/lib/biometricIdentity';
import { clearPushRegistration } from '@/lib/pushToken';
import type { User } from '@/data/types';
import type { Tier } from '@/store/roles';

const TOKEN_KEY = 'cgpe.token';
const USER_KEY = 'cgpe.user';
const BIO_KEY = 'cgpe.biometric';
// The 30-day refresh credential (backend Phase 58), kept in SecureStore like the access token.
// It is the plaintext copy used ONLY to revoke server-side on an explicit logout; the biometric
// RESTORE path reads its own copy from the biometric-gated keystore binding, not from here.
const REFRESH_KEY = 'cgpe.refresh';
const isWeb = Platform.OS === 'web';

/** Result of a biometric-only restore attempt, for the login screen to word its response. */
export type BiometricRestoreResult = 'ok' | 'declined' | 'error' | 'unavailable';

type AuthState = {
  user: User | null;
  ready: boolean;
  restoredSession: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  viewAs: Tier | null;
  /**
   * Set when the server ended the session under us (revoked or expired token). The login
   * screen reads it to explain why the user is suddenly back at sign-in, instead of
   * appearing to have logged them out at random.
   */
  expiredNotice: string | null;
  clearExpiredNotice: () => void;
  setViewAs: (t: Tier | null) => void;
  login: (id: string, pw: string) => Promise<void>;
  loginOtp: (phone: string, code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  setBiometric: (on: boolean) => Promise<boolean>;
  authenticateBiometric: () => Promise<boolean>;
  /**
   * Whether this device can offer a fingerprint-only restore right now — a sealed refresh
   * credential from a prior login exists, the biometric pool is intact, and quick-unlock is on.
   * Cheap and never prompts; the login screen calls it to decide whether to show the affordance.
   */
  canBiometricRestore: () => Promise<boolean>;
  /**
   * Phase 48: restore the sealed session with fingerprint/face only, no id/password/OTP. Opens
   * the biometric-gated binding, exchanges its refresh credential for a fresh access token, and
   * starts the session. Never fabricates a session — every non-'ok' path routes to manual login.
   */
  restoreBiometricSession: () => Promise<BiometricRestoreResult>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [restoredSession, setRestoredSession] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [viewAs, setViewAsState] = useState<Tier | null>(null);
  const [expiredNotice, setExpiredNotice] = useState<string | null>(null);

  /**
   * The server is the authority on whether our token is still good. `data/api` reports a
   * 401 through `lib/session`, and this is where that becomes a logout. Without it a
   * revoked token left the user browsing empty screens, still "signed in", with no way to
   * recover short of force-quitting the app.
   */
  useEffect(() => {
    const off = onSessionExpired((reason: ExpiryReason) => {
      setExpiredNotice(EXPIRY_MESSAGE[reason]);
      api.setAuthToken(null);
      // Mirror clear()'s teardown, not a partial one. Nulling the current user drops the outgoing
      // user's id/name (used as ownership/assignedBy defaults) and their reactive write-queue; and
      // resetApiState() wipes the in-memory record buffer + the client/claim/WhatsApp PII caches so
      // the NEXT person on a shared handset cannot read them through a cache-first getter or a
      // read-outage fallback (loophole hunt round 4, 2026-08-25). The AsyncStorage/SecureStore + push
      // teardown below is the round-3 half; these two are the in-memory half the same audit missed.
      api.setCurrentUser(null, null);
      api.resetApiState();
      setUser(null);
      setViewAsState(null);
      resetHealth();
      resetFreshness();
      void storage.remove(TOKEN_KEY);
      void storage.remove(USER_KEY);
      // A silent 401 expiry must tear down the OUTGOING user's per-user artifacts the SAME way an
      // explicit logout does — NOT just null the token. Otherwise the still-running recorder's shift
      // sid (in track.state) and the device push-token binding (push.sentToken) survive into the NEXT
      // user who signs in on this shared handset: their GPS then uploads onto the previous user's shift
      // and they receive the previous user's pushes. persist()'s different-user guard cannot cover this
      // because USER_KEY is already removed above, so its priorId reads null and the purge is skipped.
      // Same partial-teardown class the 2026-08-21 audit fixed for track.*; push + the expiry path were
      // the gaps (loophole audit round 3, 2026-08-25).
      void purgeUserScopedCaches();
      void clearPushRegistration();
    });
    return off;
  }, []);

  useEffect(() => {
    // Cancellation guard. In practice AuthProvider mounts once for the process lifetime, so
    // this cannot leak in production; it is here because an unguarded setState-after-await is
    // the exact pattern every screen in the app is held to, and the root provider should not
    // be the one place that is exempt. It also makes React StrictMode's double-mount silent.
    let alive = true;
    (async () => {
      try {
        let has = false;
        if (!isWeb) {
          const hw = await LocalAuthentication.hasHardwareAsync().catch(() => false);
          const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
          has = !!hw && !!enrolled;
        }
        if (!alive) return;
        setBiometricAvailable(has);
        const [token, savedUser, bio] = await Promise.all([
          storage.get(TOKEN_KEY),
          storage.get(USER_KEY),
          storage.get(BIO_KEY),
        ]);
        if (!alive) return;
        // Default the quick-unlock ON when the device supports it and the user
        // hasn't explicitly turned it off — so "log in once, then biometric" is the
        // out-of-box behaviour.
        setBiometricEnabled(bio === '1' || (bio == null && has));
        if (token && savedUser) {
          api.setAuthToken(token);
          // Re-arm expiry detection for the RESTORED session, exactly as persist() does for a fresh
          // login. Without this, a JS runtime that survived an OEM background-kill with the expiry
          // latch still set (from a prior headless 401) would restore the session but never fire the
          // real 401 — trapping the user in a silently-dead session full of false-empty "no tasks /
          // no clients" screens until they force-quit (audit 2026-08-21, #6).
          resetSessionGuard();
          const pu = JSON.parse(savedUser);
          api.setCurrentUser(pu.id, pu.name);
          setUser(pu);
          setRestoredSession(true);
        }
      } catch {
        // fresh start
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const persist = async (u: User, token: string, refreshToken?: string) => {
    /* SHARED-HANDSET GUARD (audit 2026-08-21, #5).
     *
     * A 401 expiry does a PARTIAL teardown (onSessionExpired nulls the token but does NOT purge
     * per-user caches or stop the recorder), so the outgoing user's live tracker session id
     * (`track.state`) survives. If a DIFFERENT user then signs in here, the still-running recorder
     * would post the NEW user's GPS onto the PREVIOUS user's shift (the backend keys the batch by
     * session_id with no ownership check) — corrupting attendance and re-opening a sealed shift.
     *
     * So when the account signing in differs from the one still stored, purge the outgoing user's
     * per-user caches (drops `track.state`/sid, clock.*, cache.*, and the 24/7 keys) BEFORE the new
     * token is written — ordering it first means a location batch racing this handover still sees
     * the dead token and self-heals as 'signed-out' rather than uploading under the new token. A
     * SAME-user re-auth (biometric restore after a silent expiry, priorId === u.id) skips the purge,
     * so an in-progress shift recorder + its sid survive untouched. clear() is deliberately NOT used
     * here — it would destroy the biometric binding + REFRESH_KEY that a biometric restore needs. */
    try {
      const priorRaw = await storage.get(USER_KEY);
      const priorId = priorRaw ? (JSON.parse(priorRaw)?.id ?? null) : null;
      if (priorId && priorId !== u.id) {
        await purgeUserScopedCaches();
        api.resetApiState();   // and the in-memory buffer/PII caches, before the new token is written (round 4)
      }
    } catch { /* a malformed stored user must never block a fresh sign-in */ }
    api.setAuthToken(token);
    api.setCurrentUser(u.id, u.name);
    resetSessionGuard();   // re-arm expiry detection for the new session
    resetHealth();         // a previous outage must not colour a fresh sign-in
    setExpiredNotice(null);
    await storage.set(TOKEN_KEY, token);
    await storage.set(USER_KEY, JSON.stringify(u));
    // Keep the plaintext refresh credential only to revoke it server-side on an explicit logout.
    // A fresh auth supersedes any prior session, so a missing one clears the stale copy.
    if (refreshToken) await storage.set(REFRESH_KEY, refreshToken);
    else await storage.remove(REFRESH_KEY);
    setUser(u);
    refreshI18nUser();   // adopt this account's saved language
    /* Re-seal the biometric record on EVERY successful auth (login OR biometric restore), so the
     * sealed credential always matches the live one. Phase 48: what is sealed is the 30-day
     * REFRESH token, not the 24h access token — the access token dies before the "return 2 days
     * later" scenario, and the refresh credential ROTATES on each restore, so a stale seal would
     * fail closed next time. Seal only when we actually have one (a login without a refresh token
     * leaves any prior binding untouched — it may still be valid server-side). */
    if (biometricEnabled && !isWeb && refreshToken) {
      await saveBoundIdentity(u.id, refreshToken).catch(() => false);
    }
  };

  /**
   * Purge every per-user cache on sign-out.
   *
   * SHARED-DEVICE CORRECTNESS. The clock/attendance cache is written under
   * `clock.<userId>.<date>` in AsyncStorage. Leaving those rows behind is not a privacy
   * leak (they are namespaced, so user Y can never read user X's entry) but it does leave
   * unbounded stale rows on a handset that many staff share across many days. More
   * importantly the field-route tracker holds a live session id that belongs to the OUTGOING
   * user's shift; if it survived the logout, the next person's session could inherit it.
   *
   * Scoped deliberately: only `clock.*`, `track.*` and `cache.*` (the Phase-57a read cache) are
   * dropped. Language choice and the biometric preference are device settings and correctly
   * survive a user switch.
   */
  const purgeUserScopedCaches = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      // Phase 57a: `cache.*` is the offline read cache (per-user list copies). Purging it on
      // sign-out removes the outgoing user's cached rows — including any client-book data — so it
      // can never be read by the next person on a shared handset. The keys are namespaced per
      // user, so this also cannot leave another account's cache stranded.
      const doomed = keys.filter((k) => k.startsWith('clock.') || k.startsWith('track.') || k.startsWith('cache.'));
      if (doomed.length) await AsyncStorage.multiRemove(doomed);
    } catch {
      // A cache purge must never block sign-out.
    }
    /* THE TRACKER'S KEYS ARE NOT IN AsyncStorage.
     *
     * `@/lib/storage` writes to expo-secure-store on native and only falls back to
     * AsyncStorage on web, so the sweep above never actually removed `track.state`. The
     * outgoing user's live session id and their buffered, unsent GPS points therefore
     * survived sign-out, and the next person on a shared handset could have had those
     * coordinates uploaded under the previous user's session. SecureStore has no
     * enumerate-keys API, so these have to be named explicitly.
     *
     * The 24/7 (off-duty) tracker keys live here too and were MISSED (audit 2026-08-21, #4):
     * `track.ambient` is the consent/arm flag. If it survives sign-out, the next user reads as
     * already-consented, so on a foreground where THEIR OS background permission is not "always"
     * `syncConsentWithPermission` fires a FALSE consent-WITHDRAWAL POST under their id (notifying
     * every super-admin), and a separately-consented next user's recorder silently auto-resumes
     * from the previous user's flag. Dropping `track.ambient` makes `ambientArmed()` read false,
     * so that path returns early and the next stray OS batch tears the leftover service down
     * cleanly via ingest's unattributable branch. `track.notif`/`track.motion` carry the previous
     * user's language/motion state. (`track.batteryOptAsked` is install-scoped — it correctly
     * survives a user switch, so it is deliberately NOT removed.) */
    await Promise.all([
      storage.remove('track.state'),
      storage.remove('track.sessionId'),   // legacy key from the foreground-watch tracker
      storage.remove('track.ambient'),     // 24/7 consent/arm flag — must NEVER carry to the next user
      storage.remove('track.notif'),       // outgoing user's resolved notification strings/language
      storage.remove('track.motion'),      // outgoing user's motion-classifier state
    ]).catch(() => {});
  };

  const clear = async () => {
    api.setAuthToken(null);
    api.setCurrentUser(null, null);
    api.resetApiState();   // wipe the in-memory record buffer + client/claim/WhatsApp PII caches (round 4)
    resetHealth();
    resetFreshness();   // Phase 57a — no stale-cache chip may survive into the next session
    await purgeUserScopedCaches();
    await storage.remove(TOKEN_KEY);
    await storage.remove(USER_KEY);
    await storage.remove(REFRESH_KEY);   // the plaintext refresh copy dies with the session
    setUser(null);
    setViewAsState(null);   // never carry a "view as" impersonation across sessions
    refreshI18nUser();      // drop back to the device default for the next person
    // Destroy the sealed identity. Leaving it would let the next person on this handset
    // biometric-unlock straight back into the account that just signed out. This is what makes
    // "an explicit logout forces a full login" true locally (Phase 48 D-2); the server-side
    // revoke in `logout()` enforces the same on the wire.
    await clearBoundIdentity().catch(() => {});
  };

  const value: AuthState = {
    user,
    ready,
    restoredSession,
    biometricEnabled,
    biometricAvailable,
    viewAs,
    expiredNotice,
    clearExpiredNotice: () => setExpiredNotice(null),
    setViewAs: (t: Tier | null) => setViewAsState(t),
    async login(id, pw) {
      const { user: u, token, refreshToken } = await api.login(id, pw);
      setRestoredSession(false); // fresh login — don't immediately app-lock
      await persist(u, token, refreshToken);
    },
    async loginOtp(phone, code) {
      const res = await api.verifyOtp(phone, code);
      if (!res) return false;
      setRestoredSession(false);
      await persist(res.user, res.token, res.refreshToken);
      return true;
    },
    async logout() {
      // Revoke the biometric refresh credential server-side FIRST, while the access token is still
      // valid so `protect` passes — so a deliberate sign-out can never be undone by a biometric
      // restore, even if the sealed credential leaked (Phase 48 D-2). Best-effort; `clear()` drops
      // the local binding regardless.
      if (!isWeb) {
        const rt = await storage.get(REFRESH_KEY);
        if (rt) await api.serverLogout(rt);
        // Stop team pushes (Phase 72) reaching this handset once signed out. Must run BEFORE
        // clear() nulls the auth token, since the unregister call is itself authenticated.
        // Best-effort — a failure never blocks sign-out.
        await clearPushRegistration();
      }
      await clear();
    },
    async deleteAccount() {
      const res = await api.deleteAccount();
      if (!res.ok) {
        /* PHASE 1: the session is deliberately KEPT.
         *
         * This used to clear the keychain and sign the user out regardless, because
         * `api.deleteAccount` could not fail. The account still exists on the server, so
         * signing them out is precisely the lie that made the failure invisible — it looks
         * exactly like a successful deletion. Throwing reaches the already-written failure
         * branch in `app/account.tsx`. */
        throw Object.assign(new Error('Account deletion was not confirmed'), { reason: res.reason });
      }
      await clear();
      await storage.remove(BIO_KEY);
      setBiometricEnabled(false);
    },
    async setBiometric(on) {
      if (isWeb) return false;
      if (on) {
        const has = await LocalAuthentication.hasHardwareAsync().catch(() => false);
        const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
        if (!has || !enrolled) return false;
        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Enable biometric unlock for CGPE Connect',
        }).catch(() => ({ success: false }));
        if (!res.success) return false;
      }
      await storage.set(BIO_KEY, on ? '1' : '0');
      setBiometricEnabled(on);
      /* Seal or destroy the hardware-bound RESTORE credential alongside the preference (Phase 48).
       * What is sealed is the 30-day refresh token (if this session has one), NOT the access
       * token. App-lock on foreground only needs a live fingerprint (`authenticateBiometric`), so
       * a session with no refresh credential still enables the lock — biometric restore simply
       * waits for the next login that carries one. */
      if (!isWeb) {
        if (on) {
          const rt = await storage.get(REFRESH_KEY);
          if (user && rt) await saveBoundIdentity(user.id, rt).catch(() => false);
        } else {
          await clearBoundIdentity().catch(() => {});
        }
      }
      return true;
    },
    /**
     * App-lock gate. FAILS CLOSED.
     *
     * This previously ended in `catch { return true }`, which meant any thrown error
     * unlocked the app. That is not a theoretical path: `authenticateAsync` throws when the
     * sensor is hardware-locked after repeated failed attempts, so the reward for failing
     * biometric enough times was to be let straight in. The whole point of the lock is that
     * a found or borrowed handset cannot open someone's client book, and an exception is
     * exactly when you want the door shut.
     *
     * The one deliberate open path is a device with no biometric hardware AND no enrolled
     * passcode. There the OS offers no way to prove identity at all, so refusing would
     * permanently brick the account on that handset with no recovery. `setBiometric` only
     * ever arms the lock on a device that had enrollment at the time, so this is rare.
     */
    async authenticateBiometric() {
      if (isWeb) return true;
      try {
        const has = await LocalAuthentication.hasHardwareAsync().catch(() => false);
        const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
        if (!has || !enrolled) {
          // Try the device passcode before giving up on proving identity.
          const fallback = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Unlock CGPE Connect',
            disableDeviceFallback: false,
          }).catch(() => null);
          // Only open when the OS genuinely offers no credential to check against.
          return fallback ? !!fallback.success : true;
        }
        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock CGPE Connect',
          disableDeviceFallback: false,
        });
        return !!res.success;
      } catch {
        return false; // fail closed
      }
    },
    async canBiometricRestore() {
      if (isWeb) return false;
      if (!biometricEnabled) return false;
      // A sealed refresh credential from a prior login exists (REFRESH_KEY is written beside the
      // seal, survives a silent expiry, and is removed on logout / a declined restore) AND the
      // biometric pool is usable. Both cheap; neither prompts.
      const [rt, intact] = await Promise.all([storage.get(REFRESH_KEY), isBiometricPoolIntact()]);
      return !!rt && intact;
    },
    async restoreBiometricSession() {
      if (isWeb) return 'unavailable';
      // Open the biometric-gated binding. This is the ONE prompt; it returns the sealed
      // (userId, refreshToken) or null. A null carries no identity — never a fallback.
      const bound = await resolveBoundIdentity();
      if (!bound) {
        const outcome = getLastResolveOutcome();
        // Transient (user cancelled, prompt timed out, sensor busy) → let them tap again.
        if (outcome === 'cancelled' || outcome === 'timeout' || outcome === 'unavailable') return 'error';
        // No usable binding (none/reinstalled/invalidated/corrupt/unsupported) → manual sign-in.
        return 'unavailable';
      }
      const res = await api.refreshBiometricSession(bound.refreshToken);
      if (res.status === 'ok') {
        // Just authenticated with biometric — do NOT app-lock on top of it (restoredSession=false).
        setRestoredSession(false);
        await persist(res.user, res.token, res.refreshToken);
        return 'ok';
      }
      if (res.status === 'declined') {
        // The sealed credential is dead server-side (revoked on logout, or past its 30-day window,
        // or reuse-tripped). Destroy the local binding + plaintext copy so we stop offering an
        // unlock that cannot work, and demand a real login.
        await clearBoundIdentity().catch(() => {});
        await storage.remove(REFRESH_KEY);
        return 'declined';
      }
      return 'error'; // network / 5xx — keep the binding, offer Retry
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
