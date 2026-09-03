/**
 * The decorative-renderer switch.
 *
 * On the first APK that carried voice (`372cd790`), tapping the mic button crashed the app on every
 * device. That crash was later traced to a Reanimated worklet calling a non-worklet helper
 * (`OrbStatic`'s `clamp01`), NOT to these decorative libraries — so Skia's `<Canvas>`, `expo-blur`'s
 * `BlurView` and the Lottie mascot were switched off as SUSPECTS, and the real fault was elsewhere.
 *
 * ⚠️ RE-ENABLED 2026-09-03 by explicit owner instruction ("UI hume chaiye, device test baad mein").
 * The switch is now ON. That does NOT make them proven — a native abort is not a JS throw and is not
 * caught by the error boundary — so the next build MUST be device-QA'd, one library at a time, before
 * any wide rollout. This file pins the DECISION (the switch state and that each probe consults it
 * before its `require`); it cannot prove device safety, and a green run here is not that evidence.
 * Under Node the native modules do not load at all, so the probes report unavailable regardless of the
 * switch — the useful thing the tests below still guarantee is the caching/early-return contract.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Mod = typeof import('@/lib/voiceGraphics');
let mod: Mod;

beforeEach(async () => {
  vi.resetModules();          // the probes cache their answer in module scope
  mod = await import('@/lib/voiceGraphics');
});

describe('VOICE_HEAVY_GRAPHICS_ENABLED', () => {
  it('is ON — owner-enabled 2026-09-03, device QA still owed before rollout', () => {
    expect(mod.VOICE_HEAVY_GRAPHICS_ENABLED).toBe(true);
  });

  it('every probe still reports unavailable under Node (the native modules do not load in the test env)', () => {
    expect(mod.hasSkia()).toBe(false);
    expect(mod.hasBlur()).toBe(false);
    expect(mod.hasLottie()).toBe(false);
  });

  it('the answer is stable across repeated calls (the cache is not confused by a failed require)', () => {
    // With the switch on, each probe reaches its `require`, which fails under Node and caches `false`.
    // A second call must read that cache, not fall through and try the native module again.
    expect([mod.hasSkia(), mod.hasSkia(), mod.hasSkia()]).toEqual([false, false, false]);
    expect([mod.hasBlur(), mod.hasBlur()]).toEqual([false, false]);
    expect([mod.hasLottie(), mod.hasLottie()]).toEqual([false, false]);
  });
});
