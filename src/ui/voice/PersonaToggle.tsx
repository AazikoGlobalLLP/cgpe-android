/**
 * The male/female character toggle for voice mode — a compact glassy segmented pill. Swaps the
 * character (orb hue now; Lottie mascot when the assets land) live; the choice is persisted by
 * `VoiceModeContext`.
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from '@/ui/base';
import { useTheme } from '@/theme/theme';
import { haptics } from '@/lib/haptics';
import type { Persona } from '@/ui/voice/voiceVisual';

export function PersonaToggle({
  persona, onChange, femaleLabel, maleLabel,
}: {
  persona: Persona;
  onChange: (p: Persona) => void;
  femaleLabel: string;
  maleLabel: string;
}) {
  const c = useTheme();

  const opt = (p: Persona, icon: 'female' | 'male', label: string) => {
    const on = persona === p;
    return (
      <Pressable
        onPress={() => { if (!on) { haptics.select(); onChange(p); } }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: on }}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999,
          backgroundColor: on ? c.primary : 'transparent',
        }}
      >
        <Ionicons name={icon} size={14} color={on ? c.onPrimary : c.muted} />
        <Txt size={c.font.cap} weight="600" color={on ? c.onPrimary : c.muted}>{label}</Txt>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        flexDirection: 'row', padding: 3, borderRadius: 999,
        backgroundColor: c.glass, borderWidth: 1, borderColor: c.glassBorder,
      }}
    >
      {opt('female', 'female', femaleLabel)}
      {opt('male', 'male', maleLabel)}
    </View>
  );
}
