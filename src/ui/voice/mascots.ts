/**
 * The Lottie mascot registry — one animation per persona. Returns `null` by default: the premium Skia
 * orb is the character until the commissioned mascot art is dropped in. A hand-authored or random Lottie
 * would look WORSE than the glossy orb, so nothing is bundled — the orb is genuinely the premium default.
 *
 * TO ENABLE A MASCOT (male + female): drop `mascot-male.json` / `mascot-female.json` into
 * `assets/voice/` and uncomment the matching `require(...)` below. `VoiceCharacter` then renders the
 * mascot AHEAD of the orb, and the male/female toggle swaps between the two — with no other change.
 * Ideally the Lottie is authored ~230 dp square with (optional) state markers so motion can vary per
 * state; without markers it simply loops with a per-state speed (see `VoiceMascot`).
 */
import type { AnimationObject } from 'lottie-react-native';
import type { Persona } from '@/ui/voice/voiceVisual';

export function mascotFor(persona: Persona): AnimationObject | null {
  switch (persona) {
    // case 'male':   return require('@/assets/voice/mascot-male.json');
    // case 'female': return require('@/assets/voice/mascot-female.json');
    default:
      return null;
  }
}
