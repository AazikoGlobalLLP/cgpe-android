/**
 * The voice character — the single seam every renderer plugs into. Unit 1 renders the native-free
 * gradient orb (`OrbStatic`). Unit 3 makes this choose, at runtime and behind a capability probe:
 *   Lottie mascot (if a male/female asset is present) → Skia glossy orb → OrbStatic (fallback).
 * The prop contract never changes, so the swap touches nothing else.
 */
import React from 'react';
import { useReducedMotion, type SharedValue } from 'react-native-reanimated';
import { OrbStatic } from '@/ui/voice/OrbStatic';
import { tierGlow, type Persona, type VoiceCharacterState } from '@/ui/voice/voiceVisual';
import type { Tier } from '@/store/roles';

export function VoiceCharacter({
  persona, state, level, tier, size, muted,
}: {
  persona: Persona;
  state: VoiceCharacterState;
  level: SharedValue<number>;
  tier: Tier;
  size?: number;
  muted?: boolean;
}) {
  const reduced = useReducedMotion();
  const glow = tierGlow(tier);
  return <OrbStatic persona={persona} state={state} level={level} glow={glow} size={size} muted={muted} reduced={reduced} />;
}
