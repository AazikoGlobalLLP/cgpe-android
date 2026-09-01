/**
 * The master switch for the whole voice feature.
 *
 * ✅ BACK ON since 2026-09-01, because the crash finally has a NAMED CAUSE rather than a suspect.
 *
 * ── THE HISTORY, BECAUSE IT IS THE ARGUMENT FOR NOT TOUCHING THIS CASUALLY ────────────────────
 * Two builds exited to "CGPE Connect keeps stopping" the moment the mic was pressed —
 * `372cd790` (vc2) and `577a4ec5` (vc3). Two rounds of containment failed: switching off the Skia
 * orb and the blur backend, then wrapping both components in a `FeatureBoundary`. Voice was then
 * switched off outright (vc4) rather than guessing a third time.
 *
 * ── THE ACTUAL BUG ───────────────────────────────────────────────────────────────────────────
 * `OrbStatic`'s `clamp01` was missing its `'worklet'` directive while being called from a
 * `useDerivedValue` body, which runs on the **UI thread**. Reanimated cannot call a plain JS
 * function from there — it raises "Tried to synchronously call a non-worklet function on the UI
 * thread", and in a release build (no LogBox) that is FATAL: the process exits, which to a user is
 * indistinguishable from a native crash. **No React error boundary can catch it**, which is exactly
 * why the `FeatureBoundary` added in between changed nothing.
 *
 * The evidence is an asymmetry, not a hunch: the IDENTICAL helper in the sibling `OrbSkia.tsx:27`
 * has always carried `'worklet'`, and `VoiceWaveform`'s `Bar` sidesteps it by inlining its clamp by
 * hand. Only this one copy was left plain — and it is the ONLY such call site in the entire app
 * (`'worklet'` appears exactly once in `src/`, and every other animated style is self-contained).
 * It also explains BOTH builds: `OrbStatic` renders as the Skia orb's `Suspense`/boundary fallback
 * *and* as the sole character once Skia is off, so vc2 and vc3 both reached it.
 *
 * ── WHAT IS STILL TRUE, AND MUST STAY TRUE ───────────────────────────────────────────────────
 *  • **Skia, blur and Lottie stay OFF** (`lib/voiceGraphics.ts`). They were never proven on a
 *    handset, they are pure decoration, and the fixed `OrbStatic` is the character. Turning them
 *    back on is a separate decision that needs its own device test.
 *  • **Voice still cannot ANSWER until OPS sets `SARVAM_API_KEY` + `N8N_VOICE_BRAIN_URL` and
 *    restarts `:3001`.** `/api/voice/ask` is deployed and answers `503 not_configured` today
 *    (`voiceConfig()` needs `ready = stt && brain`). Until then the honest outcome is
 *    "Voice is not switched on for this server yet" — no crash, no retry offered.
 *  • **NOTHING in the gate chain can see a fault of this class.** `tsc` types it, `npm test` never
 *    renders it, `eslint` has no rule for it, and `expo export -p web` passes because the web build
 *    does not drive Reanimated's UI thread this way. Only a handset can confirm it.
 *
 * ⚠️ IF IT CRASHES AGAIN, set this to `false` — one line, and the mic button and the entire voice
 * subtree (including `expo-audio`) stop mounting. Do not spend another build on a new guess without
 * either a device or the crash dialog's "View summary".
 */
export const VOICE_ENABLED = true;
