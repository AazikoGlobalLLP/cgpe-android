/**
 * Web stub for the graphics capability probes. Voice mode is native-only (the overlay returns null on
 * web), and the heavy graphics libs either need extra web peers (lottie → @lottiefiles/dotlottie-react)
 * or are pointless on web. Metro resolves THIS file on web, so a `require('lottie-react-native')` / Skia
 * / blur never enters the web bundle. Native builds use `voiceGraphics.ts`.
 */

/**
 * Mirrors the native module's export so a web bundle that imports the switch still resolves. Web has
 * never had these renderers, so the value is `false` here for its own reason and does NOT track the
 * native flag — re-enabling on device must not silently pull Skia or Lottie into the web bundle and
 * break `expo export -p web`, which is this project's boot-safety gate.
 */
export const VOICE_HEAVY_GRAPHICS_ENABLED = false;

export function hasSkia(): boolean { return false; }
export function hasBlur(): boolean { return false; }
export function hasLottie(): boolean { return false; }
