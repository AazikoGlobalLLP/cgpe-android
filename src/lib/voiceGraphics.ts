/**
 * Capability probe for the heavy voice-mode graphics libs. Skia and expo-blur are native modules that
 * are NOT present in Expo Go and NOT usable on web (Skia needs CanvasKit there). Rather than statically
 * importing them (which would throw at module scope / boot — the react-native-compressor class of bug),
 * every caller asks here first, and the actual Skia/blur components are loaded lazily ONLY after this
 * says they are available. Mirrors the lazy-require pattern in `lib/voiceAudio.ts` / `videoTranscode.ts`.
 *
 * The result is cached — the `require` runs at most once per module.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 2026-09-01 — THE DECORATIVE NATIVE RENDERERS ARE OFF, AND THE PROBE IS NOT WHAT PROTECTS YOU.
 *
 * On the first APK that ever carried voice (`372cd790`, versionCode 2), tapping the mic button
 * crashed the app to "CGPE Connect keeps stopping" on EVERY device tried. Two facts narrow it, and
 * both were deduced from this tree rather than guessed:
 *
 *   • It is NOT `expo-audio`. `VoiceMode` calls `useVoiceTurn` — and therefore `useAudioRecorder` —
 *     at line 48, BEFORE its `if (!isOpen) return null` at line 71. The recorder is constructed on
 *     every app boot, and boot is fine. Only RENDERING is new when the button is tapped.
 *   • It is NOT Lottie. `mascotFor()` returns `null` unconditionally (no mascot art is bundled), so
 *     `VoiceMascot` never mounts.
 *
 * That leaves exactly the two things that first RENDER on tap: Skia's `<Canvas>` (`OrbSkia`) and
 * `expo-blur`'s `BlurView` (`GlassCards`, which asked for the Android-only `dimezisBlurView` backend).
 *
 * ⚠️ **A `try/catch` around a `require` cannot save you from either.** These fail — when they fail —
 * by aborting the PROCESS in native code, not by throwing a JS error. That is also why
 * `VoiceCharacter`'s `OrbBoundary` (a React error boundary) and `React.lazy` are no protection: both
 * only catch JS. The probe below proves a module is INSTALLED. It cannot prove it RENDERS.
 * `tsc`, `npm test`, `eslint` and `expo export -p web` were all green on the crashing build, and the
 * web build stubs both libraries, so nothing in the gate chain could ever have caught this.
 *
 * NEITHER LIBRARY ADDS FUNCTION — they are decoration. `OrbStatic` (a gradient orb on
 * `expo-linear-gradient`, which the whole app already uses) and the simulated-frost fallback are
 * the documented always-works path and look deliberate, not degraded. So both are switched off here
 * rather than one being guessed at, and voice mode is reduced to surfaces already proven on a
 * device: React Native, Reanimated, `expo-linear-gradient` and `expo-audio`.
 *
 * TO RE-ENABLE: flip this to `true` and device-QA **one library at a time** — open voice mode on a
 * real handset and confirm it survives. Do not flip it as part of an unrelated change, and do not
 * take a green `npm test` as evidence.
 */
import { Platform } from 'react-native';

/**
 * Master switch for the OPTIONAL decorative renderers (Skia orb, blur glass, Lottie mascot).
 * `expo-audio` is NOT gated by this: it is load-bearing (there is no voice without a microphone) and
 * is already proven at boot.
 *
 * ⚠️ ENABLED 2026-09-03 by explicit OWNER instruction ("UI hume chaiye, device test baad mein") — the
 * worklet crash that these were suspected of (and switched off for) was found and fixed elsewhere
 * (the `OrbStatic` clamp01 directive), so they are no longer the prime suspect. But they have STILL
 * NOT been proven on a handset, and a native abort in Skia/blur is NOT caught by the error boundary
 * (it kills the process). So the next build MUST be device-QA'd before any wide rollout, one library
 * at a time (open voice mode, confirm it survives). The web build is unaffected: `voiceGraphics.web.ts`
 * stubs these to false so `expo export -p web` never loads them. A green `npm test` is NOT evidence.
 */
export const VOICE_HEAVY_GRAPHICS_ENABLED = true;

let skia: boolean | null = null;
let blur: boolean | null = null;
let lottie: boolean | null = null;

/** Is `@shopify/react-native-skia` linked and usable on this runtime? (false on web / Expo Go.) */
export function hasSkia(): boolean {
  if (skia != null) return skia;
  if (!VOICE_HEAVY_GRAPHICS_ENABLED) { skia = false; return false; }   // see header — off until device-QA'd
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
  if (!VOICE_HEAVY_GRAPHICS_ENABLED) { lottie = false; return false; }  // see header — off until device-QA'd
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
  if (!VOICE_HEAVY_GRAPHICS_ENABLED) { blur = false; return false; }    // see header — off until device-QA'd
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
