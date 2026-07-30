import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { AuthProvider, useAuth } from '@/store/auth';
import { I18nProvider } from '@/i18n';
import { ConfirmProvider } from '@/ui/Confirm';
import { Splash } from '@/ui/Splash';
import { AppLock } from '@/ui/AppLock';
import { JobsProvider } from '@/store/jobs';
import { JobPill } from '@/ui/JobPill';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNav() {
  const c = useTheme();
  const { ready } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  // Hand off from the native splash to our animated one immediately.
  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);

  return (
    <>
      <StatusBar style={c.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
          animation: 'slide_from_right',
        }}
      />
      <JobPill />
      <AppLock />
      {(!ready || !splashDone) && <Splash onDone={() => setSplashDone(true)} />}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <JobsProvider>
                <ConfirmProvider>
                  <RootNav />
                </ConfirmProvider>
              </JobsProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
