/**
 * Web stub for the Lottie mascot. `lottie-react-native`'s web renderer needs `@lottiefiles/dotlottie-react`,
 * which the app does not ship, and voice mode never runs on web anyway. Metro resolves THIS file on web,
 * so the native `VoiceMascot.tsx` (and `lottie-react-native`) never enter the web bundle. Native builds
 * ignore this file entirely.
 */
import type { VoiceCharacterState } from '@/ui/voice/voiceVisual';

export function VoiceMascot(_props: { source: unknown; state: VoiceCharacterState; size?: number }) {
  return null;
}

export default VoiceMascot;
