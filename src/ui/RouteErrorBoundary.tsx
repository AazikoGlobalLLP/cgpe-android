import { Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';

import { type as textType } from '@/theme/theme';
import { describeCrash } from '@/lib/crashReport';

/* ------------------------------------------------------------------ *
 * RouteErrorBoundary — the last thing standing when a screen throws.
 *
 * Exported as `ErrorBoundary` from `src/app/_layout.tsx`, which is what arms it. Verified
 * against the installed expo-router build (2026-08-27): `useScreens.js:141-158` `fromImport`
 * wraps a route in `Try` ONLY if that route module exports `ErrorBoundary`, and
 * `global-state/useStore.js:55` resolves the ROOT route node through the same
 * `getQualifiedRouteComponent`, so an export on the root layout wraps the entire app.
 * `Try.getDerivedStateFromError` also force-hides the splash, so this really is what appears
 * rather than a frozen splash.
 *
 * ⚠️ THIS FILE MAY NOT USE ANY OF THE APP'S CONTEXTS, AND THAT IS THE WHOLE DESIGN CONSTRAINT.
 * The boundary wraps the root layout's own component, so it renders OUTSIDE everything that
 * layout mounts — `ThemeProvider`, `AppUiProvider`, `AuthProvider`, `I18nProvider`, the toast
 * and confirm hosts. None of their hooks can be relied on here: at best they fall back to a
 * default (see the colour note below), at worst they throw — and a boundary that crashes while
 * rendering leaves a blank screen again, the exact failure it exists to replace. So:
 * react-native primitives only, literal colours, and copy in English.
 *
 * The colours are read off `theme/theme.tsx`'s own `light`/`dark` palettes rather than invented,
 * so this screen still looks like the app; they are copied as literals rather than imported
 * because `useTheme()` here would silently hand back the LIGHT palette. That is the subtle trap:
 * `ThemeContext` is created with `light` as its DEFAULT (`theme.tsx:271`), so the hook does not
 * throw outside its provider — it just returns the wrong scheme, and a dark-mode user gets a
 * white flash instead of a crash screen. `useColorScheme` comes from react-native itself and
 * needs no provider, so it is the one that can be trusted here.
 *
 * `type()` IS safe and is used: it is a pure weight→fontFamily map with no hook and no context
 * (`theme.tsx:240`), and bare `fontWeight` does not render on Android because the Geist weights
 * are separate families. If the crash happened before `useFonts` resolved, the family is simply
 * missing and RN falls back to the system face — degraded, still legible.
 *
 * NOT WIRED FOR TRANSLATION ON PURPOSE. No keys exist for this copy, and `t()` falls back to
 * the key — so a crash screen would read "crash.title" to a Gujarati user, which is worse than
 * English. The four strings are listed in `docs/i18n/COPY-REQUEST-2026-08-26.md`; wire them when
 * human copy arrives. (`t()` is unavailable here anyway — see the constraint above.)
 *
 * ⚠️ THE BUTTON LABEL COMES FROM `describeCrash`, NOT FROM A LITERAL HERE. It says "Reload the
 * app" because that is what `Try.retry()` actually does — it re-mounts the ROOT and navigation
 * falls back to its initial route. It is NOT a retry of the screen that failed. The reasoning
 * is written at `CrashReport.retryLabel`; read it before changing the wording.
 * ------------------------------------------------------------------ */

// Copied verbatim from `theme/theme.tsx` `light` (:108-124) and `dark` (:162-178). `action` is
// each scheme's own `primary`, so the button matches the rest of the app rather than inventing
// a colour. Keep them in step by hand if the palette moves — a mismatch here is cosmetic, but a
// wrong `text`/`bg` pair on a crash screen is unreadable.
const LIGHT = { bg: '#f7f9fc', card: '#ffffff', text: '#171d26', muted: '#738296', border: '#e5e8eb', action: '#3182ed' };
const DARK = { bg: '#070c14', card: '#0f1724', text: '#e9eff7', muted: '#8fa0b6', border: '#1e2a3c', action: '#5ba3f5' };

export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? DARK : LIGHT;
  const { title, message, retryLabel, detail } = describeCrash(error);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 }}
        // The detail can be long on a small phone, so the whole card scrolls rather than
        // clipping the one piece of information a bug report needs.
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: c.border,
            padding: 20,
            gap: 12,
          }}
        >
          <Text style={{ color: c.text, ...textType('700', 20) }}>{title}</Text>
          <Text style={{ color: c.muted, lineHeight: 21, ...textType('400', 14) }}>{message}</Text>

          {detail ? (
            <View style={{ backgroundColor: c.bg, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12 }}>
              <Text style={{ color: c.muted, letterSpacing: 0.8, marginBottom: 4, ...textType('600', 11) }}>
                WHAT WENT WRONG
              </Text>
              {/* Selectable so the advisor can copy it into a message instead of retyping it. */}
              <Text selectable style={{ color: c.text, lineHeight: 18, ...textType('400', 12) }}>{detail}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => { void retry(); }}
            accessibilityRole="button"
            accessibilityLabel={retryLabel}
            style={({ pressed }) => ({
              backgroundColor: c.action,
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: '#ffffff', ...textType('700', 15) }}>{retryLabel}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
