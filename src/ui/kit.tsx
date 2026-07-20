import React from 'react';
import {
  ActivityIndicator, Platform, Pressable, StyleProp, StyleSheet, Text, TextInput,
  TextStyle, View, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { font, radius, shadow, spacing, useTheme, Palette } from '@/theme/theme';
import { colorFromString, initials as toInitials } from '@/lib/format';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* ---------- Gradient helper ---------- */
export function Grad({ colors, style, children, angle = 'diag' }: {
  colors: readonly [string, string, ...string[]]; style?: StyleProp<ViewStyle>; children?: React.ReactNode; angle?: 'diag' | 'vert' | 'horiz';
}) {
  const se = angle === 'vert' ? { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } }
    : angle === 'horiz' ? { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }
    : { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
  return <LinearGradient colors={colors as any} {...se} style={style}>{children}</LinearGradient>;
}

/* ---------- Screen ---------- */
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return <View style={[{ flex: 1, backgroundColor: c.bg }, style]}>{children}</View>;
}

/* ---------- Header ---------- */
export function Header({ title, subtitle, back, right }: {
  title: string; subtitle?: string; back?: boolean; right?: React.ReactNode;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{
      paddingTop: insets.top + 10, paddingBottom: 14, paddingHorizontal: spacing.lg,
      backgroundColor: c.bg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    }}>
      {back && (
        <Pressable onPress={() => router.back()} hitSlop={10}
          style={({ pressed }) => [{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', marginRight: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: font.h2, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={{ color: c.muted, fontSize: font.sub, marginTop: 1 }} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/* ---------- Card ---------- */
export function Card({ children, style, onPress, padded = true }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean;
}) {
  const c = useTheme();
  const base: ViewStyle = {
    backgroundColor: c.card, borderRadius: radius.lg, padding: padded ? spacing.lg : 0,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, ...shadow(c, 1),
  };
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }, style]}>{children}</Pressable>;
  return <View style={[base, style]}>{children}</View>;
}

/* ---------- Glass card (translucent, for over gradients) ---------- */
export function GlassCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg }, style]}>{children}</View>;
}

/* ---------- Button ---------- */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'whatsapp' | 'outline';
export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, style, size = 'md', full }: {
  label: string; onPress?: () => void; variant?: BtnVariant; icon?: IconName; loading?: boolean;
  disabled?: boolean; style?: StyleProp<ViewStyle>; size?: 'sm' | 'md' | 'lg'; full?: boolean;
}) {
  const c = useTheme();
  const h = size === 'lg' ? 54 : size === 'sm' ? 38 : 48;
  const fs = size === 'sm' ? 13.5 : 15;
  const px = size === 'sm' ? 14 : 18;

  const content = (fg: string) => loading
    ? <ActivityIndicator color={fg} size="small" />
    : <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={fg} />}
        <Text style={{ color: fg, fontWeight: '700', fontSize: fs, letterSpacing: 0.2 }}>{label}</Text>
      </View>;

  const wrap: ViewStyle = { height: h, borderRadius: radius.md, alignSelf: full ? 'stretch' : 'auto', overflow: 'hidden' };

  if (variant === 'primary') {
    return (
      <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [wrap, { opacity: disabled ? 0.5 : pressed ? 0.9 : 1, ...shadow(c, 1) }, style]}>
        <Grad colors={c.gradientBrand} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: px }}>{content('#fff')}</Grad>
      </Pressable>
    );
  }

  const map: Record<Exclude<BtnVariant, 'primary'>, { bg: string; fg: string; border?: string }> = {
    secondary: { bg: c.primarySoft, fg: c.primary },
    ghost: { bg: 'transparent', fg: c.primary },
    danger: { bg: c.danger, fg: '#fff' },
    whatsapp: { bg: c.whatsapp, fg: '#fff' },
    outline: { bg: c.card, fg: c.text, border: c.border },
  };
  const s = map[variant as Exclude<BtnVariant, 'primary'>];
  return (
    <Pressable onPress={onPress} disabled={disabled || loading}
      style={({ pressed }) => [wrap, { backgroundColor: s.bg, borderWidth: s.border ? 1 : 0, borderColor: s.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: px, opacity: disabled ? 0.5 : pressed ? 0.88 : 1 }, style]}>
      {content(s.fg)}
    </Pressable>
  );
}

/* ---------- IconBtn ---------- */
export function IconBtn({ icon, onPress, color, bg, size = 40 }: {
  icon: IconName; onPress?: () => void; color?: string; bg?: string; size?: number;
}) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2.6, alignItems: 'center', justifyContent: 'center', backgroundColor: bg ?? c.cardAlt, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={size * 0.5} color={color ?? c.text} />
    </Pressable>
  );
}

/* ---------- Pill ---------- */
type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';
export function Pill({ label, tone = 'neutral', icon, small }: { label: string; tone?: Tone; icon?: IconName; small?: boolean }) {
  const c = useTheme();
  const map: Record<Tone, { bg: string; fg: string }> = {
    primary: { bg: c.primarySoft, fg: c.primary },
    success: { bg: c.successSoft, fg: c.success },
    warning: { bg: c.warningSoft, fg: c.warning },
    danger: { bg: c.dangerSoft, fg: c.danger },
    info: { bg: c.infoSoft, fg: c.info },
    accent: { bg: c.accentSoft, fg: c.accent },
    neutral: { bg: c.cardAlt, fg: c.muted },
  };
  const s = map[tone] ?? map.neutral;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: s.bg, paddingHorizontal: small ? 8 : 11, paddingVertical: small ? 3 : 5, borderRadius: radius.pill }}>
      {icon && <Ionicons name={icon} size={small ? 10 : 12} color={s.fg} />}
      <Text style={{ color: s.fg, fontSize: small ? 10.5 : 11.5, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ name, size = 44, color, ring }: { name: string; size?: number; color?: string; ring?: boolean }) {
  const c = useTheme();
  const bg = color ?? colorFromString(name, c.avatarPalette);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.6, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: ring ? 2 : 0, borderColor: c.bgElevated }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.36 }}>{toInitials(name)}</Text>
    </View>
  );
}

/* ---------- AvatarStack ---------- */
export function AvatarStack({ names, size = 34, max = 4 }: { names: string[]; size?: number; max?: number }) {
  const c = useTheme();
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((n, i) => (
        <View key={n + i} style={{ marginLeft: i === 0 ? 0 : -size * 0.34 }}>
          <Avatar name={n} size={size} ring />
        </View>
      ))}
      {extra > 0 && (
        <View style={{ marginLeft: -size * 0.34, width: size, height: size, borderRadius: size / 2.6, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bgElevated }}>
          <Text style={{ color: c.muted, fontWeight: '800', fontSize: size * 0.3 }}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

/* ---------- StatCard ---------- */
export function StatCard({ label, value, icon, tone = 'primary', sub, onPress, style }: {
  label: string; value: string; icon: IconName; tone?: Tone; sub?: string; onPress?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const map: any = { primary: c.primary, success: c.success, warning: c.warning, danger: c.danger, info: c.info, accent: c.accent, neutral: c.muted };
  const col = map[tone];
  return (
    <Card onPress={onPress} style={[{ flex: 1, padding: spacing.md }, style]}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: col + '1f', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Ionicons name={icon} size={18} color={col} />
      </View>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 }} numberOfLines={1}>{value}</Text>
      <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{label}</Text>
      {sub ? <Text style={{ color: col, fontSize: 11, fontWeight: '700', marginTop: 3 }}>{sub}</Text> : null}
    </Card>
  );
}

/* ---------- ActionTile (pastel quick action) ---------- */
export function ActionTile({ icon, label, tileIndex = 0, onPress, tint }: {
  icon: IconName; label: string; tileIndex?: number; onPress?: () => void; tint?: string;
}) {
  const c = useTheme();
  const tile = c.tiles[tileIndex % c.tiles.length];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1, width: 68 }]}>
      <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: tile.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={25} color={tint ?? tile.fg} />
      </View>
      <Text style={{ color: c.muted, fontSize: 11.5, fontWeight: '600', textAlign: 'center' }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/* ---------- SectionHeader ---------- */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 }}>
      <Text style={{ color: c.text, fontSize: font.h3, fontWeight: '800', letterSpacing: -0.2 }}>{title}</Text>
      {action ? <Pressable onPress={onAction} hitSlop={8}><Text style={{ color: c.primary, fontWeight: '700', fontSize: 13.5 }}>{action}</Text></Pressable> : null}
    </View>
  );
}

/* ---------- Chips ---------- */
export function Chips<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void;
}) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)}
            style={{ paddingHorizontal: 14, height: 36, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: active ? c.primary : c.card, borderWidth: 1, borderColor: active ? c.primary : c.border }}>
            <Text style={{ color: active ? c.onPrimary : c.muted, fontWeight: '700', fontSize: 13 }}>{o.label}</Text>
            {o.count != null && (
              <View style={{ backgroundColor: active ? 'rgba(255,255,255,0.25)' : c.cardAlt, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                <Text style={{ color: active ? '#fff' : c.muted, fontSize: 11, fontWeight: '800' }}>{o.count}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- SearchBar ---------- */
export function SearchBar({ value, onChange, placeholder, autoFocus, onSubmit }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; onSubmit?: () => void;
}) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.card, borderRadius: radius.md, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: c.border }}>
      <Ionicons name="search" size={18} color={c.faint} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.faint} autoFocus={autoFocus} onSubmitEditing={onSubmit} returnKeyType="search" style={{ flex: 1, color: c.text, fontSize: 15, paddingVertical: 0, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) }} />
      {value.length > 0 && <Pressable onPress={() => onChange('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={c.faint} /></Pressable>}
    </View>
  );
}

/* ---------- Field ---------- */
export function Field({ label, value, onChange, placeholder, keyboardType, multiline, secure }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'email-address'; multiline?: boolean; secure?: boolean;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: c.muted, fontSize: 13, fontWeight: '700' }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.faint} keyboardType={keyboardType} multiline={multiline} secureTextEntry={secure}
        style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: 15, paddingVertical: multiline ? 12 : 0, height: multiline ? 92 : 50, color: c.text, fontSize: 15, textAlignVertical: multiline ? 'top' : 'center', ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) }} />
    </View>
  );
}

/* ---------- EmptyState ---------- */
export function EmptyState({ icon, title, subtitle }: { icon: IconName; title: string; subtitle?: string }) {
  const c = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 }}>
      <View style={{ width: 70, height: 70, borderRadius: 24, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={32} color={c.faint} />
      </View>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', marginTop: 4 }}>{title}</Text>
      {subtitle ? <Text style={{ color: c.muted, fontSize: 13.5, textAlign: 'center', maxWidth: 260 }}>{subtitle}</Text> : null}
    </View>
  );
}

/* ---------- Loader ---------- */
export function Loader() {
  const c = useTheme();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}><ActivityIndicator color={c.primary} size="large" /></View>;
}

/* ---------- ProgressBar ---------- */
export function ProgressBar({ value, tone }: { value: number; tone?: string }) {
  const c = useTheme();
  return (
    <View style={{ height: 9, borderRadius: 5, backgroundColor: c.cardAlt, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${Math.min(100, Math.max(0, value * 100))}%`, backgroundColor: tone ?? c.primary, borderRadius: 5 }} />
    </View>
  );
}

/* ---------- Fab (gradient) ---------- */
export function Fab({ icon, onPress, label }: { icon: IconName; onPress?: () => void; label?: string }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ position: 'absolute', right: 18, bottom: 22, borderRadius: 30, overflow: 'hidden', opacity: pressed ? 0.92 : 1, ...shadow(c, 2) }]}>
      <Grad colors={c.gradientBrand} style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: label ? 22 : 0, width: label ? undefined : 56, justifyContent: 'center', gap: 8 }}>
        <Ionicons name={icon} size={24} color="#fff" />
        {label ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{label}</Text> : null}
      </Grad>
    </Pressable>
  );
}

/* ---------- misc ---------- */
export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }, style]}>{children}</View>;
}

export function Txt({ children, size = font.body, weight = '400', color, style, numberOfLines }: {
  children: React.ReactNode; size?: number; weight?: TextStyle['fontWeight']; color?: string; style?: StyleProp<TextStyle>; numberOfLines?: number;
}) {
  const c = useTheme();
  return <Text numberOfLines={numberOfLines} style={[{ color: color ?? c.text, fontSize: size, fontWeight: weight }, style]}>{children}</Text>;
}
