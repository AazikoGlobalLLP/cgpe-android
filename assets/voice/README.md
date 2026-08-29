# Voice mascot assets

Drop the commissioned Lottie character animations here to give the voice assistant an illustrated
character. Until then, the voice mode shows the premium **glossy orb** (no asset needed).

## Files expected
- `mascot-female.json` — the female character (default persona)
- `mascot-male.json` — the male character

## To enable them
1. Place the two `.json` files in this folder.
2. In `src/ui/voice/mascots.ts`, uncomment the two `require(...)` lines.

That's all — `VoiceCharacter` then renders the mascot ahead of the orb, and the male/female toggle in
voice mode swaps between the two, with no other change.

## Authoring notes for the designer
- ~230 dp square, transparent background.
- A calm looping animation works out of the box (it loops with a per-state speed: calmer when idle,
  faster when listening/speaking).
- Optional (nicer): author named markers for the five states — `idle`, `listening`, `thinking`,
  `speaking`, `error` — so each state can play its own segment later.
- Keep it light (Lottie file size adds to the APK).
