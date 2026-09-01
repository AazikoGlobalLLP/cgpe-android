/**
 * The master switch for the whole voice feature.
 *
 * 🔴 OFF since 2026-09-01, and this is a deliberate product decision, not a workaround.
 *
 * THREE FACTS, TOGETHER:
 *
 *  1. **It crashes the app.** Two builds (`372cd790` vc2, `577a4ec5` vc3) exit to "CGPE Connect keeps
 *     stopping" when the mic is pressed. Two rounds of containment — switching off the Skia orb and
 *     the blur backend (`lib/voiceGraphics.ts`), then wrapping both components in a
 *     `FeatureBoundary` — did NOT stop it.
 *  2. **It cannot work even when it does not crash.** `/api/voice/ask` is deployed but answers
 *     `503 not_configured`: `voiceConfig()` needs `ready = stt && brain`, and OPS has not set
 *     `SARVAM_API_KEY` or `N8N_VOICE_BRAIN_URL` (the backend's own env handover parks both under
 *     "Group 2 — can wait; the owner is arranging these"). So today the button's BEST possible
 *     outcome is a polite "voice is not switched on for this server yet".
 *  3. **It cannot be diagnosed from here.** A native abort leaves nothing in JS to inspect, and there
 *     is no device access and no crash reporting in the build. Every remaining hypothesis would cost
 *     one APK to test, on 21 handsets that need a working app more than they need this.
 *
 * A feature that cannot work, crashes the app, and cannot be diagnosed does not belong on the
 * screen. With this `false`, `VoiceLauncher` renders nothing (no mic button exists to press) and
 * `VoiceModeInner` — and therefore `expo-audio`'s `useAudioRecorder`, Reanimated's voice surfaces and
 * every other voice import — is never mounted at all. The crash is not contained; the code path
 * ceases to exist. That is the only guarantee available without a handset.
 *
 * ⚠️ NOTHING ELSE IN THE APP IS AFFECTED. The voice modules stay in the tree, tested and ready.
 *
 * TO TURN IT BACK ON, both must be true:
 *   (a) OPS has set `SARVAM_API_KEY` + `N8N_VOICE_BRAIN_URL` and restarted `:3001` — otherwise you
 *       are shipping a button that apologises; and
 *   (b) someone can open voice mode on a REAL handset before it reaches the team. `tsc`, `npm test`,
 *       `eslint` and `expo export -p web` were all green on both crashing builds. They cannot see
 *       this class of fault and never will.
 */
export const VOICE_ENABLED = false;
