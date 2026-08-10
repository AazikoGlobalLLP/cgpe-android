import React, { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { font, radius, spacing, tnum, type, useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/theme';
import { colorFromString, initials as toInitials } from '@/lib/format';
import type { IconName } from './base';

/* ------------------------------------------------------------------ *
 * identity — who a row is about.
 *
 * Three components, one idea: a person is recognised by shape and colour before the
 * name is read. Every avatar in the app therefore derives its fill deterministically
 * from the name (`colorFromString` over `c.avatarPalette`), so the same client is the
 * same colour on the roster, in the chat header, and on the claim they filed. A random
 * or role-based colour would throw that recognition away.
 *
 * TWO METRICS ARE FROZEN, NOT DERIVED:
 *   - the squircle radius `size / 2.6`
 *   - the initials cut at `size * 0.36`
 * 39 screens and the SkeletonCard placeholder are laid out against them. They are
 * literals here on purpose; do not "clean them up" into the radius scale.
 *
 * INITIALS INK IS `c.onPrimary`, NOT WHITE. In light mode onPrimary *is* #ffffff, so
 * nothing changes. In dark mode the avatar palette lifts to bright tints (#f9b83e,
 * #2ee6ce) where white text fails contrast outright, and onPrimary is the deep ink
 * #04121f. One token, legible in both schemes.
 * ------------------------------------------------------------------ */

/** Corner badge tones. `neutral` is for counts/roles; the rest are states. */
export type BadgeTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'whatsapp' | 'neutral';

/** A dot by default; pass `icon` when the state needs naming (verified, muted, alert). */
export type AvatarBadge = { tone?: BadgeTone; icon?: IconName };

function badgeColor(c: Palette, tone: BadgeTone): string {
  switch (tone) {
    case 'primary': return c.primary;
    case 'accent': return c.accent;
    case 'warning': return c.warning;
    case 'danger': return c.danger;
    case 'whatsapp': return c.whatsapp;
    case 'neutral': return c.faint;
    default: return c.success;
  }
}

/* ---------- Avatar ---------- */
export function Avatar({ name, size = 44, color, ring, photo, badge, style }: {
  name: string;
  size?: number;
  color?: string;
  ring?: boolean;
  /** Optional remote photo (`User.photo`). Falls back to initials if it fails to load. */
  photo?: string;
  /** Corner status marker. Overhangs the avatar box by 1pt, as corner badges must. */
  badge?: AvatarBadge;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  // A dead photo URL must degrade to initials, not to an empty coloured square.
  const [broken, setBroken] = useState(false);
  // Reset when the URL changes. Without this, one 404 latches `broken` for the lifetime of
  // the component INSTANCE — and list rows are recycled, so filtering or paginating a roster
  // hands this same instance a new `photo` and every later person in that slot silently
  // renders initials until the screen remounts.
  useEffect(() => { setBroken(false); }, [photo]);
  const bg = color ?? colorFromString(name, c.avatarPalette);
  const r = size / 2.6;

  const face = (
    <View style={[{
      width: size, height: size, borderRadius: r, backgroundColor: bg,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: ring ? 2 : 0, borderColor: c.bgElevated,
      overflow: 'hidden',
    }, badge ? null : style]}>
      {photo && !broken ? (
        <Image
          source={{ uri: photo }}
          onError={() => setBroken(true)}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <Text numberOfLines={1} style={{ color: c.onPrimary, ...type('800', size * 0.36) }}>
          {toInitials(name)}
        </Text>
      )}
    </View>
  );

  // No badge, no wrapper: the 39 existing call sites keep the exact same single-View tree.
  if (!badge) return face;

  const d = Math.max(12, Math.round(size * 0.3));
  const col = badgeColor(c, badge.tone ?? 'success');
  return (
    <View style={[{ width: size, height: size }, style]}>
      {face}
      <View style={{
        position: 'absolute', right: -1, bottom: -1,
        width: d, height: d, borderRadius: d / 2, backgroundColor: col,
        alignItems: 'center', justifyContent: 'center',
        // Ring in the surface colour so the badge reads as punched out of the avatar
        // rather than floating on top of it.
        borderWidth: 2, borderColor: c.bgElevated,
      }}>
        {badge.icon ? <Ionicons name={badge.icon} size={Math.round(d * 0.58)} color={c.onPrimary} /> : null}
      </View>
    </View>
  );
}

/* ---------- AvatarStack ----------
 * Overlap is 34% of the avatar, which leaves each face ~66% visible — enough to read a
 * colour and an initial. The ring is what separates them, so `ring` is not optional here. */
export function AvatarStack({ names, size = 34, max = 4, style }: {
  names: string[]; size?: number; max?: number; style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  const lap = -size * 0.34;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      {shown.map((n, i) => (
        <View key={n + i} style={{ marginLeft: i === 0 ? 0 : lap }}>
          <Avatar name={n} size={size} ring />
        </View>
      ))}
      {extra > 0 && (
        <View style={{
          marginLeft: lap, width: size, height: size, borderRadius: size / 2.6,
          backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center',
          borderWidth: 2, borderColor: c.bgElevated,
        }}>
          {/* Tabular: "+12" next to "+9" must not shift the stack's right edge. */}
          <Text style={{ color: c.muted, ...type('800', size * 0.3), ...tnum }}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * PersonRow — the unit every roster, team list and client list is built from.
 *
 * Avatar, name, one line of supporting fact, and a trailing slot. The trailing slot is a
 * `right` node rather than a fixed set of props because what matters there changes by
 * screen: a Pill on a team roster, a Metric on a premium ledger, an IconBtn on a call
 * list. `chevron` is the one shorthand, because "this row navigates" is the most common
 * case and should not cost the caller an Ionicons import.
 *
 * The row is 44pt+ tall at every avatar size, and the pressed state is a real surface
 * change (`c.cardAlt`) rather than an opacity dip — list rows are scanned at arm's length
 * on a bright screen, where 0.7 opacity is invisible.
 * ------------------------------------------------------------------ */
export function PersonRow({
  name, subtitle, right, onPress, size = 44, badge,
  photo, avatarColor, subtitleIcon, subtitleNumeric, chevron, onLongPress, style,
}: {
  name: string;
  subtitle?: string;
  /** Trailing slot — Pill, Metric, IconBtn, timestamp. Wins over `chevron`. */
  right?: React.ReactNode;
  onPress?: () => void;
  size?: number;
  badge?: AvatarBadge;
  photo?: string;
  /** Override the name-derived fill (e.g. tone a row by stage). */
  avatarColor?: string;
  /** Small glyph before the subtitle — a phone for a number, a pin for a city. */
  subtitleIcon?: IconName;
  /** Tabular figures for phone/policy numbers and amounts, so a column aligns. */
  subtitleNumeric?: boolean;
  chevron?: boolean;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const interactive = !!onPress || !!onLongPress;

  const subStyle: StyleProp<TextStyle> = [
    { color: c.muted, ...type('500', font.sub), flexShrink: 1 },
    subtitleNumeric ? tnum : null,
  ];

  const inner = (
    <>
      <Avatar name={name} size={size} color={avatarColor} photo={photo} badge={badge} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: c.text, ...type('700', font.body) }}>{name}</Text>
        {subtitle ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {subtitleIcon ? <Ionicons name={subtitleIcon} size={12} color={c.faint} /> : null}
            <Text numberOfLines={1} style={subStyle}>{subtitle}</Text>
          </View>
        ) : null}
      </View>
      {right ?? (chevron ? <Ionicons name="chevron-forward" size={18} color={c.faint} /> : null)}
    </>
  );

  const base: ViewStyle = {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.sm + 2,
    // Negative margin against the padding: the pressed tint bleeds a little past the text
    // box so it reads as a row, while the avatar stays optically flush with the card's
    // own padding instead of being indented by the highlight's inset.
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
    borderRadius: radius.md,
  };

  if (!interactive) return <View style={[base, style]}>{inner}</View>;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${name}, ${subtitle}` : name}
      style={({ pressed }) => [base, pressed && { backgroundColor: c.cardAlt }, style]}
    >
      {inner}
    </Pressable>
  );
}
