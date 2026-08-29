/**
 * Capability probe for the heavy voice-mode graphics libs. Skia and expo-blur are native modules that
 * are NOT present in Expo Go and NOT usable on web (Skia needs CanvasKit there). Rather than statically
 * importing them (which would throw at module scope / boot — the react-native-compressor class of bug),
 * every caller asks here first, and the actual Skia/blur components are loaded lazily ONLY after this
 * says they are available. Mirrors the lazy-require pattern in `lib/voiceAudio.ts` / `videoTranscode.ts`.
 *
 * The result is cached — the `require` runs at most once per module.
 */
import { Platform } from 'react-native';

let skia: boolean | null = null;
let blur: boolean | null = null;
let lottie: boolean | null = null;

/** Is `@shopify/react-native-skia` linked and usable on this runtime? (false on web / Expo Go.) */
export function hasSkia(): boolean {
  if (skia != null) return skia;
  if (Platform.OS === 'web') { skia = false; return false; }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy probe; must not eval at boot
    require('@shopify/react-native-skia');
    skia = true;
  } catch {
    skia = false;
  }
  return skia;
}

/** Is `lottie-react-native` linked and usable on this runtime? (false on web.) */
export function hasLottie(): boolean {
  if (lottie != null) return lottie;
  if (Platform.OS === 'web') { lottie = false; return false; }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy probe; must not eval at boot
    require('lottie-react-native');
    lottie = true;
  } catch {
    lottie = false;
  }
  return lottie;
}

/** Is `expo-blur` linked and usable on this runtime? (false on web.) */
export function hasBlur(): boolean {
  if (blur != null) return blur;
  if (Platform.OS === 'web') { blur = false; return false; }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy probe; must not eval at boot
    require('expo-blur');
    blur = true;
  } catch {
    blur = false;
  }
  return blur;
}
