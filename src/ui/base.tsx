import React from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextStyle,
  View, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  shadow, tnum, type, useTheme, Weight,
} from '@/theme/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* ------------------------------------------------------------------ *
 * Grad — the only place LinearGradient should be reached for directly.
 *
 * Gradient discipline: the brand gradient is the signature and is rationed to the
 * clock-in state ring and the active tab indicator. Everything else uses solid colour.
 * ------------------------------------------------------------------ */
export function Grad({ colors, style, children, angle = 'diag' }: {
  colors: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  angle?: 'diag' | 'vert' | 'horiz';
}) {
  const se = angle === 'vert' ? { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } }
    : angle === 'horiz' ? { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }
    : { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
  return <LinearGradient colors={colors as any} {...se} style={style}>{children}</LinearGradient>;
}

/* ------------------------------------------------------------------ *
 * Screen — the root container for every route.
 *
 * KEYBOARD AVOIDANCE IS OPT-IN, NOT AUTOMATIC. Wrapping every screen in a
 * KeyboardAvoidingView is the reflex, and it is wrong: on a list screen it makes the whole
 * list jump when an unrelated search field focuses. Pass `keyboard` only on screens whose
 * primary job is data entry (task-new, claim-new, login, chat composer). Those are the
 * screens where the submit button being hidden behind the keyboard is the whole problem.
 *
 * The platform split is deliberate. iOS needs `padding` because the keyboard overlays the
 * view; Android's windowSoftInputMode already resizes, and applying `padding` there
 * double-counts the inset and leaves a dead gap above the keyboard.
 * ------------------------------------------------------------------ */
export function Screen({ children, style, keyboard = false }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Enable on data-entry screens so the focused field and its submit stay visible. */
  keyboard?: boolean;
}) {
  const c = useTheme();
  const base: ViewStyle = { flex: 1, backgroundColor: c.bg };
  if (!keyboard) return <View style={[base, style]}>{children}</View>;
  return (
    <KeyboardAvoidingView
      style={[base, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ *
 * KeyboardScroll — the fix for "the keyboard covers what I am typing".
 *
 * `Screen keyboard` shrinks the CONTAINER when the keyboard opens, which is necessary but
 * not sufficient: if the focused input sits below the fold of a scrollable form, shrinking
 * the container just clips it further. The content has to scroll too, and it has to scroll
 * by exactly the keyboard's height.
 *
 * `automaticallyAdjustKeyboardInsets` is the right primitive for that. It is native
 * ScrollView behaviour (iOS 14+, and RN's Android implementation follows the resized window),
 * so the scroll offset tracks the keyboard frame precisely, including the interactive-dismiss
 * drag. Doing it manually with Keyboard.addListener plus scrollTo is what produces the
 * familiar one-frame jump and the overshoot on rotation.
 *
 * `keyboardShouldPersistTaps="handled"` matters as much as the inset: without it, the first
 * tap on a button while the keyboard is open is swallowed to dismiss the keyboard, so the
 * user has to tap Submit twice and the app feels broken.
 *
 * `keyboardDismissMode` differs by platform on purpose: iOS users expect to drag the keyboard
 * away interactively, Android users expect it to dismiss on scroll.
 *
 * Pair with `<Screen keyboard>` as the parent. The bottom padding keeps the last field clear
 * of the home indicator and the gesture bar once the keyboard closes again.
 * ------------------------------------------------------------------ */
export function KeyboardScroll({ children, style, contentStyle, bottomPad = 32 }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Extra space under the last field so a submit button is never flush to the edge. */
  bottomPad?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[{ paddingBottom: insets.bottom + bottomPad }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

/* ---------- Header ---------- */
export function Header({ title, subtitle, back, right }: {
  title: string; subtitle?: string; back?: boolean; right?: React.ReactNode;
}) {
  const c = useTheme();
  const { spacing, font } = c;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  /**
   * THE BLANK-SCREEN-ON-BACK FIX.
   *
   * This used to be a bare `router.back()`. `back()` pops the navigation stack, and when
   * there is nothing to pop it does NOTHING: the current screen has already begun tearing
   * down visually, so the user is left staring at an empty frame with no way out except
   * killing the app.
   *
   * There is nothing to pop more often than it looks. It happens on a cold start straight
   * onto a route (a deep link, a notification tap, or the router restoring the last route),
   * and it happens whenever a screen is reached as the FIRST entry of a freshly reset stack.
   * Team members hit it on Profile because their tab set and landing route differ from an
   * admin's, so the push that an admin makes from Home is, for them, sometimes the stack root.
   *
   * `canGoBack()` asks the navigator whether a pop is actually possible. When it is not, we
   * navigate to the app's home surface instead, which is always a valid destination. Fixing
   * it here fixes every screen that renders `<Header back />`, not just Profile.
   */
  const goBack = React.useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  }, [router]);

  return (
    <View style={{
      paddingTop: insets.top + 10, paddingBottom: 14, paddingHorizontal: spacing.lg,
      backgroundColor: c.bg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    }}>
      {back && (
        <Pressable onPress={goBack} hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', marginRight: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, ...type('800', font.h2), letterSpacing: -0.4 }} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={{ color: c.muted, ...type('400', font.sub), marginTop: 1 }} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/* ---------- SectionHeader ---------- */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const c = useTheme();
  const { font } = c;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 }}>
      <Text style={{ color: c.text, ...type('800', font.h3), letterSpacing: -0.2 }}>{title}</Text>
      {action ? <Pressable onPress={onAction} hitSlop={8}><Text style={{ color: c.primary, ...type('700', 13.5) }}>{action}</Text></Pressable> : null}
    </View>
  );
}

/* ---------- Card ---------- */
export function Card({ children, style, onPress, padded = true }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean;
}) {
  const c = useTheme();
  const { radius, spacing } = c;
  const base: ViewStyle = {
    backgroundColor: c.card, borderRadius: radius.lg, padding: padded ? spacing.lg : 0,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, ...shadow(c, 1),
  };
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }, style]}>{children}</Pressable>;
  return <View style={[base, style]}>{children}</View>;
}

/* ---------- GlassCard (translucent, for over gradients) ---------- */
export function GlassCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { radius, spacing } = useTheme();
  return <View style={[{ backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg }, style]}>{children}</View>;
}

/* ---------- Row ---------- */
export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { spacing } = useTheme();
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }, style]}>{children}</View>;
}

/* ------------------------------------------------------------------ *
 * Txt — the text primitive.
 *
 * `weight` is narrowed to the six loaded Geist cuts. It is NOT `TextStyle['fontWeight']`
 * any more: that type admits 'bold' / 100 / 200 / etc., none of which have a bundled
 * face, and on Android an unbundled weight silently renders as regular.
 * ------------------------------------------------------------------ */
export function Txt({ children, size: sizeProp, weight = '400', color, style, numberOfLines, numeric }: {
  children: React.ReactNode;
  size?: number;
  weight?: Weight;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** Tabular figures — use for money, counts, dates so columns align. */
  numeric?: boolean;
}) {
  const c = useTheme();
  // Font never scales with density (font ×1.0), but the default is still READ off the theme
  // scale rather than copied, so the static import can be dropped from this module.
  const size = sizeProp ?? c.font.body;
  return (
    <Text numberOfLines={numberOfLines}
      style={[{ color: color ?? c.text, ...type(weight, size) }, numeric && tnum, style]}>
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ *
 * Metric — a number that reads as data.
 *
 * Tabular figures plus negative tracking at scale. This is the treatment that carries
 * the panel's `.tnum` data-console feel onto mobile; use it for every headline figure.
 * ------------------------------------------------------------------ */
export function Metric({ value, size: sizeProp, color, style, numberOfLines = 1, fit = true }: {
  value: string; size?: number; color?: string; style?: StyleProp<TextStyle>; numberOfLines?: number;
  /**
   * Shrink to fit rather than wrap or clip. On by default because this component exists to
   * render FIGURES, and a figure that breaks across two lines is misreadable in a way that a
   * slightly smaller figure is not. Turn it off only for a Metric rendering a non-numeric
   * string that is allowed to truncate.
   */
  fit?: boolean;
}) {
  const c = useTheme();
  const size = sizeProp ?? c.font.metric;
  return (
    <Text
      numberOfLines={numberOfLines}
      // adjustsFontSizeToFit only has meaning on a single line; RN warns otherwise.
      adjustsFontSizeToFit={fit && numberOfLines === 1}
      minimumFontScale={0.75}
      style={[{
        color: color ?? c.text, ...type('900', size), ...tnum,
        letterSpacing: size >= 24 ? -0.8 : -0.3,
      }, style]}
    >
      {value}
    </Text>
  );
}

/* ---------- Eyebrow (tracked uppercase label) ---------- */
export function Eyebrow({ children, color, style }: {
  children: React.ReactNode; color?: string; style?: StyleProp<TextStyle>;
}) {
  const c = useTheme();
  return (
    <Text style={[{ color: color ?? c.faint, ...type('600', 11), letterSpacing: 0.8, textTransform: 'uppercase' }, style]}>
      {children}
    </Text>
  );
}

/** Shared web-only reset so TextInputs don't render a focus ring on react-native-web. */
export const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null;
