import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { storage } from '@/lib/storage';
import * as api from '@/data/api';
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

  useEffect(() => {
    (async () => {
      try {
        let has = false;
        if (!isWeb) {
          const hw = await LocalAuthentication.hasHardwareAsync().catch(() => false);
          const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
          has = !!hw && !!enrolled;
        }
        setBiometricAvailable(has);
        const [token, savedUser, bio] = await Promise.all([
          storage.get(TOKEN_KEY),
          storage.get(USER_KEY),
          storage.get(BIO_KEY),
        ]);
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
        setReady(true);
      }
    })();
  }, []);

  const persist = async (u: User, token: string) => {
    api.setAuthToken(token);
    api.setCurrentUser(u.id, u.name);
    await storage.set(TOKEN_KEY, token);
    await storage.set(USER_KEY, JSON.stringify(u));
    setUser(u);
  };

  const clear = async () => {
    api.setAuthToken(null);
    await storage.remove(TOKEN_KEY);
    await storage.remove(USER_KEY);
    setUser(null);
  };

  const value: AuthState = {
    user,
    ready,
    restoredSession,
    biometricEnabled,
    biometricAvailable,
    viewAs,
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
      await api.deleteAccount();
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
      return true;
    },
    async authenticateBiometric() {
      if (isWeb) return true;
      try {
        const has = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!has || !enrolled) return true; // no hardware -> don't block
        const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock CGPE Connect' });
        return res.success;
      } catch {
        return true;
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
