import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { storage } from '@/lib/storage';
import * as api from '@/data/api';
import { EXPIRY_MESSAGE, ExpiryReason, onSessionExpired, resetSessionGuard } from '@/lib/session';
import { resetHealth } from '@/data/health';
// One-directional: i18n imports nothing from this store, so there is no require cycle.
// Language is persisted per user (`cgpe.lang.<userId>`), and the provider only re-reads which
// user is signed in when it is told to. Without these calls a user switch inside one app run
// would keep showing the previous person's language until the app was next foregrounded.
import { refreshI18nUser } from '@/i18n';
// Hardware-bound biometric identity. A biometric unlock must resolve to the account that was
// genuinely authenticated ON THIS INSTALL, never to whoever happens to be cached.
import { clearBoundIdentity, saveBoundIdentity } from '@/lib/biometricIdentity';
import type { User } from '@/data/types';
import type { Tier } from '@/store/roles';

const TOKEN_KEY = 'cgpe.token';
const USER_KEY = 'cgpe.user';
const BIO_KEY = 'cgpe.biometric';
const isWeb = Platform.OS === 'web';

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
      setUser(null);
      setViewAsState(null);
      resetHealth();
      void storage.remove(TOKEN_KEY);
      void storage.remove(USER_KEY);
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

  const persist = async (u: User, token: string) => {
    api.setAuthToken(token);
    api.setCurrentUser(u.id, u.name);
    resetSessionGuard();   // re-arm expiry detection for the new session
    resetHealth();         // a previous outage must not colour a fresh sign-in
    setExpiredNotice(null);
    await storage.set(TOKEN_KEY, token);
    await storage.set(USER_KEY, JSON.stringify(u));
    setUser(u);
    refreshI18nUser();   // adopt this account's saved language
    /* Re-bind the biometric record on EVERY successful sign-in, so the sealed
     * (user id + token) pair always matches the live session. Binding only at the moment the
     * toggle is switched on would leave a stale token sealed after the next password login,
     * and a quick-unlock would then restore a session the server has already expired. */
    if (biometricEnabled && !isWeb) {
      await saveBoundIdentity(u.id, token).catch(() => false);
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
   * Scoped deliberately: only `clock.*` and `track.*` are dropped. Language choice and the
   * biometric preference are device settings and correctly survive a user switch.
   */
  const purgeUserScopedCaches = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const doomed = keys.filter((k) => k.startsWith('clock.') || k.startsWith('track.'));
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
     * enumerate-keys API, so these have to be named explicitly. */
    await Promise.all([
      storage.remove('track.state'),
      storage.remove('track.sessionId'),   // legacy key from the foreground-watch tracker
    ]).catch(() => {});
  };

  const clear = async () => {
    api.setAuthToken(null);
    api.setCurrentUser(null, null);
    resetHealth();
    await purgeUserScopedCaches();
    await storage.remove(TOKEN_KEY);
    await storage.remove(USER_KEY);
    setUser(null);
    setViewAsState(null);   // never carry a "view as" impersonation across sessions
    refreshI18nUser();      // drop back to the device default for the next person
    // Destroy the sealed identity. Leaving it would let the next person on this handset
    // biometric-unlock straight back into the account that just signed out.
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
      const { user: u, token } = await api.login(id, pw);
      setRestoredSession(false); // fresh login — don't immediately app-lock
      await persist(u, token);
    },
    async loginOtp(phone, code) {
      const res = await api.verifyOtp(phone, code);
      if (!res) return false;
      setRestoredSession(false);
      await persist(res.user, res.token);
      return true;
    },
    async logout() {
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
      /* Bind or destroy the hardware-sealed identity alongside the preference. Flipping the
       * toggle without this leaves the two out of step: quick-unlock ON with nothing sealed
       * (so unlock resolves to nobody), or OFF with a live sealed record still on the device. */
      if (!isWeb) {
        if (on) {
          const tok = await storage.get(TOKEN_KEY);
          if (user && tok) {
            const bound = await saveBoundIdentity(user.id, tok).catch(() => false);
            // Could not seal it: do not claim quick-unlock is on when it is not.
            if (!bound) { await storage.set(BIO_KEY, '0'); setBiometricEnabled(false); return false; }
          }
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
