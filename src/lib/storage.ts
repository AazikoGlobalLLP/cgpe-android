import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cross-platform persistent storage.
 * - Native (Expo Go / device): expo-secure-store (Keychain / Keystore) for real security.
 * - Web (browser preview): AsyncStorage (localStorage) — SecureStore has no web
 *   implementation and throws `setValueWithKeyAsync is not a function`, which was
 *   crashing the login screen in the browser.
 */
const isWeb = Platform.OS === 'web';

// Lazily loaded so the web bundle never touches the native SecureStore module.
let Secure: typeof import('expo-secure-store') | null = null;
if (!isWeb) {
  try {
    Secure = require('expo-secure-store');
  } catch {
    Secure = null;
  }
}

export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (isWeb || !Secure) return await AsyncStorage.getItem(key);
      return await Secure.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (isWeb || !Secure) return await AsyncStorage.setItem(key, value);
      return await Secure.setItemAsync(key, value);
    } catch {
      // ignore write failures (private mode etc.)
    }
  },
  async remove(key: string): Promise<void> {
    try {
      if (isWeb || !Secure) return await AsyncStorage.removeItem(key);
      return await Secure.deleteItemAsync(key);
    } catch {
      // ignore
    }
  },
};
