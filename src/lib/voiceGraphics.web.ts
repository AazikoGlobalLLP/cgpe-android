/**
 * Web stub for the graphics capability probes. Voice mode is native-only (the overlay returns null on
 * web), and the heavy graphics libs either need extra web peers (lottie → @lottiefiles/dotlottie-react)
 * or are pointless on web. Metro resolves THIS file on web, so a `require('lottie-react-native')` / Skia
 * / blur never enters the web bundle. Native builds use `voiceGraphics.ts`.
 */
export function hasSkia(): boolean { return false; }
export function hasBlur(): boolean { return false; }
export function hasLottie(): boolean { return false; }
