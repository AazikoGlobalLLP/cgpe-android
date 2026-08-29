/**
 * The Lottie mascot renderer — plays the commissioned character for the active persona. Motion varies
 * per voice state via playback speed (listening/speaking faster, idle calmer); if the Lottie is authored
 * with state markers, those can drive segments later without changing this interface.
 *
 * ⚠️ Statically imports `lottie-react-native` (native, not in web/Expo-Go-without-lottie), so it is
 * reached ONLY behind the `hasLottie()` probe + `React.lazy` + error boundary in `VoiceCharacter`, and
 * only when a mascot asset actually exists — never a static import from the boot/route graph.
 */
import React from 'react';
import LottieView, { type AnimationObject } from 'lottie-react-native';
import type { VoiceCharacterState } from '@/ui/voice/voiceVisual';

export function VoiceMascot({ source, state, size = 230 }: { source: AnimationObject; state: VoiceCharacterState; size?: number }) {
  const speed = state === 'listening' ? 1.2 : state === 'speaking' ? 1.35 : state === 'thinking' ? 1.0 : 0.7;
  return <LottieView source={source} autoPlay loop speed={speed} style={{ width: size, height: size }} />;
}

export default VoiceMascot;
