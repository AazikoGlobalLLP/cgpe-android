/**
 * The voice character — the single seam every renderer plugs into. It chooses, at runtime, the richest
 * character the build can actually show, and always has a safe fallback:
 *   Skia glossy orb (if `hasSkia()` + not reduced-motion) → `OrbStatic` gradient orb (always works).
 * The Skia orb is behind BOTH the capability probe AND `React.lazy` + an error boundary, so it never
 * evaluates at boot / on web / in Expo Go, and any load/render failure silently falls back to OrbStatic.
 * (Unit 4 inserts a Lottie mascot ahead of Skia when a male/female asset is present.)
 * The prop contract never changes, so swapping renderers touches nothing else.
 */
import React, { Suspense } from 'react';
import { useReducedMotion, type SharedValue } from 'react-native-reanimated';
import { OrbStatic } from '@/ui/voice/OrbStatic';
import { tierGlow, type Persona, type VoiceCharacterState } from '@/ui/voice/voiceVisual';
import { hasSkia } from '@/lib/voiceGraphics';
import type { Tier } from '@/store/roles';

const OrbSkiaLazy = React.lazy(() => import('@/ui/voice/OrbSkia'));

/** Falls back to the given node if the lazy Skia orb throws on load or render. */
class OrbBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

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
  const staticOrb = (
    <OrbStatic persona={persona} state={state} level={level} glow={glow} size={size} muted={muted} reduced={reduced} />
  );

  // Reduced-motion or a non-Skia build → the static orb (no continuous GPU cost).
  if (reduced || !hasSkia()) return staticOrb;

  return (
    <OrbBoundary fallback={staticOrb}>
      <Suspense fallback={staticOrb}>
        <OrbSkiaLazy persona={persona} state={state} level={level} glow={glow} size={size} muted={muted} />
      </Suspense>
    </OrbBoundary>
  );
}
