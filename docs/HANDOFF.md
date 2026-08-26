# HANDOFF — CGPE Connect (Android) — Phase 76 close / Phase 77 open — 2026-08-26

## Done
- **Search replaced Clients in the bottom tab bar** (owner ask). The bar is now
  **Today · Tasks · 🔍 Search · Claims · More**, with the Search glyph rendered larger (26 vs 21) as the
  bar's primary "find anything" action. Clients left the bar and is reached from **More**, where it was
  already gated master/admin-only (Point 9). Shipped `ba622af`, gates green (`tsc` 0 · `npm test` **993** ·
  `eslint` 0 errors / 12 warnings baseline). **Not on any APK yet** — no OTA exists.
- **Voice assistant researched and decided, twice.** First a general survey (`2c1b21a`), then — after the
  owner proposed a concrete n8n + ElevenLabs + character architecture — a **full 11-agent workflow with
  adversarial verification of every price and language claim** (`952cf59`). Verdict recorded: the voice
  round-trip belongs in Express, not n8n, because n8n holds direct Mongo credentials and bypasses
  `protect`/`visibilityScope`; Sarvam `saaras:v3` `mode=translit` for STT (only engine emitting Latin
  script, which the app's char-level matcher requires); Claude for verb-only NLU with the app writing the
  spoken sentence; Sarvam Bulbul v3 TTS; ≈₹6,055/mo for 21 staff at expected use.
- **Owner then chose the n8n route anyway, for speed — that decision is recorded and the plan now follows
  it**, carrying exactly one mitigation forward (n8n must call the REST API with the user's JWT, never
  Mongo directly). See `docs/PLAN-2026-08-26-VOICE-N8N-AND-BUGS.md` (`2db724f`).
- **The owner's 9 reported problems were triaged with root causes verified in the real code**, not guessed:
  - LIC "Unnamed" is **data, not a bug** — `plan_name` is literally `null` in
    `cgpe-backend-main/data/lic_plans_library.json` for plans 102/113/122/165/172/180/181/195.
  - The **admin-must-not-see-location gate is already correct on mobile** (`canSeeLiveLocation()` is real
    `super_admin` only, `roles.ts:72-74`, 20 tests) — if an admin sees it, that is the **admin panel**.
  - The **upload endpoint is live** (`POST /upload` → **401**, probed), so "couldn't reach the server" is
    not a missing route; the candidates are an unset `BACKEND_URL` (returns a `localhost:3001` URL the
    phone can never load), the NAT64/MTU stall on multipart, or the 10 MB / MIME rejection.
  - **App size growth is the WebView map-tile cache** (CartoDB + Esri satellite tiles, uncapped).
  - **Splash text exists** in `ui/Splash.tsx`; the *native* splash is logo-only by design.
  - **More → Today going blank**: prime suspect is `Appear`'s cleanup `cancelAnimation(progress)`
    (`ui/motion.tsx:104`) freezing opacity at 0.
  - **Role-wise Operations/Sales views are already supported** by `nav.tabs`/`nav.hidden`/`more_sections` —
    mostly a config-seeding job, with two genuinely new app pieces.
- **The full n8n contract is specified** — exact URL, request fields, headers, the strict JSON response
  shape, timing budget, and failure semantics — so the workflow can be built without another round trip.

## Files changed
- `src/app/(tabs)/search.tsx` — moved from `src/app/search.tsx` so `/search` can be a real bottom tab; the
  route path is unchanged, so both existing callers still work and no typed-routes regen was needed. Header
  `back` chevron dropped (it is a tab root now).
- `src/app/(tabs)/_layout.tsx` — `search` added to `TAB_META` + `<Tabs.Screen>`; Search glyph rendered at
  `SEARCH_ICON_SIZE` 26 vs `TAB_ICON_SIZE` 21; `clients`/`leads` still registered but off the default bar.
- `src/store/appUi.tsx` — `DEFAULT_UI.nav.tabs` is now `home/tasks/search/claims/more`; `search` added to
  `KNOWN_TAB_ROUTES` so `resolveTabs` can place it.
- `src/i18n/index.tsx` — new `tab.search` key in all 5 dictionaries.
- `src/i18n/__tests__/dictionaries.test.ts` — parity count 132 → **133**.
- `src/store/__tests__/appUi.test.ts` — three tab-set assertions updated.
- `docs/VOICE-ASSISTANT-RESEARCH-2026-08-26.md` — first-pass survey; now marked **superseded**.
- `docs/VOICE-ARCHITECTURE-DECISION-2026-08-26.md` — **the authoritative voice document** (875 lines):
  architecture verdict, STT/TTS/NLU choices, verified cost tables, RBAC design, 16 owner decisions.
- `docs/PLAN-2026-08-26-VOICE-N8N-AND-BUGS.md` — **the current working plan**: n8n contract, ElevenLabs
  asks, character + Assistant Mode spec, the 9 bugs with verified root causes, phases 77–83.

## Decisions made
- **Search takes the Clients bar slot.** The client book is master/admin-only, so it no longer earns a
  permanent tab; Search is the one destination every tier uses. Clients stays reachable in More.
- **`tab.search` ships as the English word "Search" in all five languages** — the same sanctioned
  trade-vocab fallback as "WhatsApp", and the natural word in Hinglish/Roman-Gujarati. Native gu/hi script
  copy is owner-owed. Not machine-translated.
- **Owner chose the n8n voice route over the recommended Express route, for speed.** Recorded as the
  owner's call after they read the full analysis. The plan follows it.
- **One mitigation is non-negotiable and was not dropped:** the n8n voice workflow must call
  `https://cgpe.in/internal/api/...` with the user's `X-CGPE-Token` JWT, never Mongo directly — otherwise a
  team advisor can voice-read the whole ~9,000-client book, defeating the Point 9 gate.
- **Character: half-body (shoulders-up), not full body** — on a phone the face is where the personality is,
  and half-body leaves room for the transcript and answer. Two personas (male/female) behind one
  `<VoiceAvatar>` interface. **Ship the coded Reanimated version first** (zero new native deps) with Lottie
  able to drop in behind the same interface later.
- **ElevenLabs: buy Creator ($22, $11 first month) only** — enough for all development plus a pilot. Pro /
  Scale / Business are premature until real usage is measured.
- **Assistant Mode is a UX lock, not a kiosk** — stated plainly rather than oversold; a normal Android app
  cannot prevent force-quit.

## Known broken / deliberately skipped
- **The tab-bar change is device-unverified and on no APK.** There is no OTA, so it reaches phones only via
  a new build. Deliberately not built yet, to batch it with Phase 77's fixes rather than rebuild twice.
- **Apple App Store submission is not possible** — no Apple Developer account ($99/yr), and the recorded
  2026-08-21 decision is that the owner cannot buy one. There is no free route. The owner asked to submit
  "today"; that was answered honestly rather than attempted.
- **Play Store approval is not same-day either** — a new account plus `ACCESS_BACKGROUND_LOCATION` triggers
  a manual review with a mandatory justification video, and a *personal* account created after Nov 2023
  needs 12 testers for 14 days before production.
- **Nothing from the 9 problems was fixed this session** — the session produced verified triage and a phase
  plan, by design. Phase 77 is where the fixing starts.
- **The `[admin]` items are in a different repo** — the "Assign Task" label and the admin-panel location
  gate live in `cgpe-front-main-RECOVERED`, untouched here.

## Next session starts here
- **Phase 77 — Quick visible fixes** (no owner input needed, so it cannot stall): the More→Today blank
  screen, the splash redesign, the LIC "Unnamed" fallback, and the app-size cache cap + a "Clear cache"
  control in Settings. Batch them and build **one** APK carrying the Search tab too.
- First command: `/boot`
- Watch out for: **the More→Today blank screen is a strong hypothesis, not a confirmed diagnosis.**
  `Appear`'s `cancelAnimation(progress)` cleanup freezing opacity at 0 fits the symptom exactly ("kuch
  dikhta hai, baaki empty"), but it must be reproduced on a device before the fix is trusted — `tsc`,
  `npm test` and lint cannot see it. And do **not** tell the owner any of this session's triage is "fixed";
  it is diagnosed.
