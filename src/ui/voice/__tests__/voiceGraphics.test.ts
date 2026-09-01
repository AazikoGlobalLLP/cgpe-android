/**
 * The decorative-renderer switch.
 *
 * On the first APK that carried voice (`372cd790`), tapping the mic button crashed the app on every
 * device tried. Two of the four native surfaces were ruled out by reading this tree — `expo-audio` is
 * constructed at boot (so boot would crash instead) and the Lottie mascot has no bundled art — which
 * left Skia's `<Canvas>` and `expo-blur`'s `BlurView`, the only two things that first RENDER when the
 * overlay opens. Both are decoration, so both are off.
 *
 * ⚠️ WHAT THIS FILE CANNOT DO, STATED PLAINLY: it cannot prove either library is safe or unsafe. A
 * native abort is not a JS throw, and under Node the probes' `require` would fail anyway, so a test
 * asserting `false` proves nothing on its own. What it pins is the DECISION — that the switch is off
 * and that each probe consults it BEFORE reaching a `require` — so re-enabling has to be deliberate
 * and cannot happen as a side effect of an unrelated edit. Device QA is the only real evidence.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Mod = typeof import('@/lib/voiceGraphics');
let mod: Mod;

beforeEach(async () => {
  vi.resetModules();          // the probes cache their answer in module scope
  mod = await import('@/lib/voiceGraphics');
});

describe('VOICE_HEAVY_GRAPHICS_ENABLED', () => {
  it('is OFF — the two crash suspects and the mascot are all disabled', () => {
    expect(mod.VOICE_HEAVY_GRAPHICS_ENABLED).toBe(false);
  });

  it('every probe reports unavailable while the switch is off', () => {
    expect(mod.hasSkia()).toBe(false);
    expect(mod.hasBlur()).toBe(false);
    expect(mod.hasLottie()).toBe(false);
  });

  it('the answer is stable across repeated calls (the cache is not confused by the early return)', () => {
    // The switch returns before the `require`, and it must also populate the same cache slot, or a
    // second call would fall through and try to load the native module after all.
    expect([mod.hasSkia(), mod.hasSkia(), mod.hasSkia()]).toEqual([false, false, false]);
    expect([mod.hasBlur(), mod.hasBlur()]).toEqual([false, false]);
    expect([mod.hasLottie(), mod.hasLottie()]).toEqual([false, false]);
  });
});
