# Future / not-yet-wired code — the single registry

One place to see every piece of code that is deliberately present but **not active yet**, so a reader
never mistakes forward-looking scaffolding for a live bug, and so re-activating any of it is a
deliberate, informed step. Owner-requested 2026-09-03.

> **Why this is a REGISTRY and not a `src/_future/` folder.** Most of the items below hold **per-user
> in-memory state** (the voice session slots) or sit inside a **gate path** (the voice write dispatch).
> Physically relocating those would create a new module-scope state container that must be cleared on
> every logout / silent-401 / user-switch — the exact shared-handset teardown-seam bug class this
> project keeps having to fix (see `resetApiState`, `resetVoiceSession`). Moving code to "tidy" it,
> only to reintroduce that class, is a bad trade. So the code stays in its natural module, clearly
> marked, and this file is the index. If a specific non-stateful piece should genuinely move, name it
> and it can be moved carefully with the teardown wired.

## Voice — on-phone multi-turn slot / intent memory (forward-looking)
- **Where:** `src/voice/session.ts` — `setSlot`, `clearSlot`, `currentSlot`, `slotForNlu`,
  `setLastIntent`, `lastIntentId`, plus the `slot` / `lastIntentId` fields on the session object.
- **State:** ZERO production consumers today (only tests). Nothing sets a slot.
- **For:** on-phone pronoun resolution ("uska number?") — the design keeps the entity id on the phone
  and never sends it to the NLU. Until a caller wires it, multi-turn works only via the raw text
  history (`historyForNlu`).
- **Teardown, already correct:** `reset()` / `resetVoiceSession()` clears these, and `resetApiState`
  calls it — so if it IS wired later, the shared-handset clearing is already in place. Keep it that way.
- **To activate:** have `finishCapture` set a slot from a resolved entity and read `slotForNlu()` into
  the request. Do NOT move the state out of `session.ts` without re-proving the teardown.

## Voice — write EXECUTION (dark by design, v1)
- **Where:** `src/voice/dispatch.ts` — `VOICE_WRITES_ENABLED = false`; the `passesGate` checks at
  `:65`/`:73` guard the write path.
- **State:** the read + navigate path is live; writes are display-only (a confirm card) in v1.
- **For:** voice-driven writes (clock-in, create task, …) once the contract and RBAC for them are
  settled. `passesGate` is therefore exercised only on the dark path today — the read path delegates
  scope to the backend (see `src/voice/registry.ts` header).
- **To activate:** flip `VOICE_WRITES_ENABLED` AFTER the write contract + per-intent gates are agreed
  with cgpe-api and cgpe-admin (raised in the live thread 2026-09-03). Not a flag to flip casually.

## Voice — Lottie mascot art (owner-commissioned, not yet delivered)
- **Where:** `src/ui/voice/mascots.ts` `mascotFor()` returns `null` unconditionally; consumed by
  `VoiceCharacter.tsx:46` behind `hasLottie()`.
- **State:** no `assets/voice/mascot-{male,female}.json` art is bundled, so the gradient/Skia orb is
  the character. A hand-authored placeholder looks worse than the orb — do not ship one.
- **To activate:** drop the commissioned art in and uncomment the `require` in `mascotFor`. The
  male/female toggle then swaps them with no other change. (Heavy graphics were enabled 2026-09-03;
  device QA is still owed — see `src/lib/voiceGraphics.ts`.)

## Voice — advisory audio byte cap (pure guard, unwired on native)
- **Where:** `src/voice/request.ts` `exceedsAudioCap` + `VOICE.MAX_AUDIO_BYTES`.
- **State:** a validated pure guard for a caller that HAS the byte count (the web blob path). On a real
  handset the clip streams to the proxy as a `{uri}` part, so the bytes never enter JS — nothing to
  measure without a native file-stat, which is not worth adding for a LOW risk the 15 s record cap
  already bounds. Documented at the function; kept as the byte-exact check for paths that can afford it.

## Data — `clientTotal` (dead/write-only, owner said keep)
- **Where:** `src/data/api.ts:1454` (assigned at `:1480`, never read).
- **State:** an approximate client-count that no screen consumes (the exact figure comes from
  `getClientStats`). Owner instruction 2026-09-03: clean up but do NOT remove. Left in place, recorded
  here so its unused-variable lint warning is understood, not mistaken for a miss.

---
*Keep this file in step: when a piece is activated, move its entry into the normal record (a phase
note / handoff) and delete it here; when new forward-looking scaffolding is added, add it here so the
registry stays the one place to look.*
