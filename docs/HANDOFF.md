# HANDOFF — CGPE Connect (Android) — FULL-CODEBASE AUDIT SWEEP — 2026-09-03

> **A full-codebase audit (8 parallel evidence-demanding agents, every finding verified against the
> real source before any change), then fixes. 12 confirmed defects fixed across 6 commits, all
> pushed to `aaziko/Shivam` (`1bf323d..42d7816`). No new code phase existed — the audit IS the work.**
>
> ⚠️ **Do not delete the handoffs below this one.** This is NOT the owner's "Phase 99 rollout"
> (that is still the build-6 handset rollout, owner-held and unchanged).

## Done — fixes, each verified against the real source (backend at deployed `origin/main` `0324dfc`)

- **A partial-paid claim no longer reads as fully settled** (`adapt.ts` `mapClaimStatus`, `c557ec9`).
  The greedy `/paid|settl|closed|pass/` arm matched the substring in `partial_paid` (money still
  owed) and `closed_rejected` before the `/partial/` and `/reject/` arms ran, so both rendered as
  **settled** — contradicting the backend's own normaliser (`claimWorkflow.js`: partial_paid →
  under_review, declined → rejected). This was the last deliberately-pinned known-bug in the suite;
  its assertion moved up into correct-behaviour.
- **The offline flush can no longer corrupt the queue or bleed PII when the signed-in user changes
  mid-flush** (`api.ts` `flushWriteQueue`, `9100fc1`). It captured the user once and never re-checked
  across its per-draft network awaits; a shared-handset logout / silent-401 / user-switch caused
  silent draft loss, cross-user write attribution (A's drafts created owned by B), and A's queued
  customer names/phones painting onto B's screen. Now re-checks identity before and after each await,
  bails intact, and guards the drop-notice. Two tests pin it. Same-family fixes: `cachedList`
  captured the user after the read (cross-user cache poisoning); `setCurrentUser` now clears the bus
  synchronously on a user change.
- **The "your work was removed" offline notice is now translated** (`42d7816`). It was hardcoded
  English in the non-React api layer while the owner-supplied `sync.dropped{One,Many}` keys (5
  languages, `{n}` placeholder) sat with zero consumers — a Hindi/Gujarati agent was told in English
  only that their draft was deleted. Now carries a count; the screen renders the translated sentence.
- **A deleted account's offline draft PII is purged** (`42d7816`). Sign-out keeps the queue for
  re-sync, but a deleted account never returns, so its queued customer names/phones sat on the shared
  disk forever. New `offlineStore.purgeQueue`, called from `deleteAccount`.
- **Voice ceiling sized to the backend's real worst case** (80s → 110s, `078de90`). The proxy tries
  ElevenLabs then Sarvam sequentially, so with both configured its own budget is 110s; the app was
  aborting healthy turns at 80s and re-running the billed vendor chain. Also enforced the session
  idle-expiry (was declared with zero callers → stale turns to the NLU); removed the redundant
  `SESSION_BG_MS`.
- **`getAgentLocations` reports an outage** when task-overview succeeds but the whole attendance
  fan-out fails (`078de90`), instead of a silent "nobody on duty" over a real outage (convention #4).
- **Screen-layer honesty + guards** (`6331188`, `e9ca377`): clients/leads empty states check
  `health.degraded` before "no match" (server-side search failure was reading as "no result");
  notify dispatch ref-guarded against a double-tap that duplicated a team-wide notice; claim-new
  re-entrancy guard (duplicate insurance claim); leads/tasks `keyboardShouldPersistTaps`; payroll
  degraded empty-state; account "export data" honest copy (asserted an email with no endpoint);
  campaigns hero `—` on a failed audience; GlassCards `expo-blur` moved behind a lazy require (native
  import at module scope in a boot-reachable file).

## Verified CLEAN (traced, not assumed) — the disciplines are holding

Reanimated worklet-crash class · stale-memo deps · unhandled-async handlers · all four RBAC
invariants (client-book gate, fail-open flags, widget leaks, admin-via-tier) · retry/timeout
classification · `resetApiState` completeness · adaptClient field mapping · dashboard-partial
handling · presigned + legacy upload paths · geofence/attribution/fuzzy/biometric/OTA pure seams ·
AppLock/LocationBlock lock gates · idempotency keys · clock-key per-user scoping.

## Gates

`tsc --noEmit` 0 · `npm test` **1380** / 84 files (+2 new race tests) · `eslint` 0 errors (the 2
warnings are the pre-existing `status`/`clientTotal` in `api.ts`, untouched).

## Left as documented, NOT fixed (with reasons)

- **Voice read-intent registry gates are latent** — voice is server-dark (`/voice/ask` unconfigured),
  the proxy is unbuilt, navigation re-gates at the destination, and PII scope is delegated to the
  backend by design. No live exploit and no app-side fix helps today; recorded for when the proxy lands.
- **`mapClaimStatus` docs_pending arm-order** — genuinely ambiguous (a live test frames the
  status-wins-over-stage order as intentional), lower severity, left pinned and documented.
- **`exceedsAudioCap`** stays a pure guard — on native the clip streams to the proxy so the bytes
  never enter JS; the 15s record cap is the live size bound. Documented rather than adding a native stat.

## 🔴 OWNER-ONLY — cannot be done in code, live evidence attached

1. **Roll build 6 out to the ~20 other handsets** — unchanged; the single highest-value unblocked action.
2. **Backend deploy** — `origin/main` still `0324dfc`; **30 commits** (backend Phases 118–128) sit on
   `origin/ved` (`1515f8d`). Prod health 200; storage now live (`cloudStorageConfigured:true`).
3. **Rotate `JWT_SECRET` + ~20 committed production secrets** — still present in deployed `origin/main`.
4. **Voice keys** — `/voice/status` deployed (401), needs `SARVAM_API_KEY` + `N8N_VOICE_BRAIN_URL`.

## Next session starts here

- Nothing in `src/` is blocking. The audit found no further confirmed code defects after these fixes.
- If picking up code work, the highest-value remaining items are all owner-held (above). Re-verify the
  deploy gap first: `git -C ../cgpe-backend-main ls-remote origin refs/heads/main` (if still
  `0324dfc`, the deploy is still the blocker — say so before anything else).

---

# HANDOFF — CGPE Connect (Android) — Phase 98 — 2026-09-02

> **The app can now fix itself over the air, and it is CONFIRMED working on a real handset — not
> merely built. The owner ran the full round trip on their phone. This phase is Done in the
> `CLAUDE.md` sense, which is rare for this project.**
>
> **Latest APK — build 6 (`80df5c5a`), `1.10.0 (6)`:**
> `https://expo.dev/artifacts/eas/pt-OtGN3dtJBvENQcjzPUjz4aKWphGnvh3xE9AyhZ_8.apk`
> (expires 2026-09-16; open ON the phone). It is the FIRST build that can receive an over-the-air fix.
>
> ⚠️ **Do not delete the handoffs below this one.**

## Done

- **A JS fix reaches an installed build-6 handset in ~30 seconds, with no rebuild and no re-install.**
  Publish with `npx eas-cli update --channel preview --message "<what changed>" --environment preview`.
- **The over-the-air round trip is device-verified.** The owner installed build 6, the update banner
  appeared on its own, tapping it restarted the app, and `Settings › Version` gained a `· u…` suffix
  it did not have before. That single test proved five things that had only been argued: the
  `fingerprint` runtime matched a real build, `u.expo.dev` is reachable from an Indian mobile network,
  the banner's press handler survives a **release** build (no LogBox — a throw there is fatal, the
  trap that cost four APKs), `reloadAsync()` applies, and the version line reads the applied update.
- **`Settings › Version` survives OTA as a build identifier.** It now reads `1.10.0 (6) · u3f9c1a`,
  and the ABSENCE of the `· u…` suffix means that handset has taken no update. Without this, OTA would
  have re-opened the exact hole `9ecaa9e` closed (one build number, many possible JS versions).
- **Gates: `tsc` 0 · `npm test` 1378 passed / 84 files · `eslint` 0 errors on the touched files ·
  `expo export -p web` exit 0.** Orphan i18n scan still 18; parity 448 → 450.

## Files changed

- `app.json` — `updates` block (`url`, `enabled`, `checkAutomatically: ON_LOAD`,
  `fallbackToCacheTimeout: 0`) + `runtimeVersion: { policy: "fingerprint" }`.
- `eas.json` — `channel` on every build profile (`development`/`preview`/`production`).
- `package.json` / `package-lock.json` — `expo-updates@~57.0.21`, lock synced in the same commit
  (EAS runs `npm ci`, which hard-fails on an out-of-sync lock).
- `src/lib/ota.ts` — the `expo-updates` calls behind a lazy `require`, fail-quiet, no `data/health`.
- `src/lib/otaPolicy.ts` — pure decision seam (foreground-check throttle, banner gate), 20 tests.
- `src/lib/buildInfo.ts` — `formatVersionLine` / `shortUpdateId` / `versionLine` (OTA-aware line).
- `src/ui/UpdateBanner.tsx` — offers a one-tap restart; suppressed while `HealthBanner` owns the slot.
- `src/app/_layout.tsx` — mounts `<UpdateBanner/>` inside a `FeatureBoundary`, beside `HealthBanner`.
- `src/app/settings.tsx` — Version row now shows `versionLine()` instead of `buildLabel()`.
- `src/i18n/index.tsx` (+ `__tests__/dictionaries.test.ts`) — `update.ready` / `update.restart`,
  English in all five dictionaries (the `tab.search`/`voice.*` precedent), parity 448 → 450.
- `src/lib/__tests__/{otaPolicy,buildInfo}.test.ts` — the pure seams pinned.
- `CLAUDE.md`, `docs/PHASES.md`, `docs/DECISIONS.md`, `docs/i18n/COPY-REQUEST-2026-08-26.md` (Batch 6i),
  `../contracts/INBOX.md` — the record.

## Decisions made

- **`fingerprint` runtime policy, chosen after MEASURING that fingerprinting works here.** `CLAUDE.md`
  records a Windows fingerprint failure that would have ruled it out; it did not reproduce (three
  clean runs, `36864e87` → `067cf142` → `067cf142`). It is the only policy where an update needing new
  native code cannot reach a build that lacks it — the alternative makes that a rule a human must
  remember, and this project has already spent four APKs on one of those.
- **The cost of that choice, written down: `eas.json` / `.easignore` / `.gitignore` are fingerprint
  SOURCES.** Editing any of them changes the runtime version, so an update published afterwards
  silently does not match the build on the phones. Safe direction (no-op, not crash) but invisible.
- **The app OFFERS a restart; it never performs one.** `reloadAsync()` erases the navigation stack, so
  auto-applying would drop a user out of a half-filled form. `ON_LOAD` applies at next cold start.
- **`fallbackToCacheTimeout: 0` and OTA failures never reach `data/health`** — both because the update
  server is a different host from the user's data, and this project has a documented IPv6/NAT64 stall.
- **Repaired the build discriminator in the same commit that broke it** (`formatVersionLine`).

## Known broken / deliberately skipped

- 🔴 **OTA reaches exactly ONE phone so far.** Builds 1–5 and the 25-Aug field APK have no
  `expo-updates` native side and can never receive an update. Each of the other ~20 handsets needs one
  manual install of build 6, then never again. **This is a rollout, and it is the owner's** — it is
  now the highest-value unblocked action in the project.
- **Voice is unchanged from Phase 96** — the probe output still needs `CGPE_EMAIL`/`CGPE_PASSWORD`
  (owner-held), and `/voice/ask` stays `503` until OPS sets `SARVAM_API_KEY` + `N8N_VOICE_BRAIN_URL`.
- 🔴 **Backend deploy still not done.** `origin/main` = `0324dfc`; Phases 118–123 (incl. everything
  Phase 97 reads) sit on `origin/ved` (`1515f8d`). Owner-held: merge → deploy → restart `:3001`.
- 🔴 **The committed production `JWT_SECRET`** (and 20 other values) is still unrotated. Owner-held.
- **`update.ready` / `update.restart` ship in English** in all five dictionaries — new surface, no
  owner copy yet, filed as Batch 6i. Nothing breaks; the banner just speaks English until translated.

## Next session starts here

- **Phase 99 is the owner's, not code: roll build 6 out to the remaining handsets.** Nothing in `src/`
  blocks it. When done, every future JS fix is free; until done, "we can fix it over the air" is true
  of one phone and false of the fleet.
- **First command (orient, confirm nothing regressed and the deploy is still pending):**
  `git -C ../cgpe-backend-main ls-remote origin refs/heads/main && npm test`
  (if `origin/main` is still `0324dfc`, the backend deploy is still the blocker — say so first.)
- **Watch out for:** **before publishing any OTA update, confirm the fingerprint still matches the
  build** (`npx expo-updates fingerprint:generate --platform android` vs the build's runtime version).
  An edit to `eas.json` / `.easignore` / `.gitignore` since the build silently makes the update reach
  nobody — `eas update` succeeds and the phones never see it.

---

# HANDOFF — CGPE Connect (Android) — Phase 97 (BUILT) — 2026-09-02

> **Phase 97 is built, committed (`acfcc46`) and pushed. Both `[api]` items we filed came back
> SHIPPED the same day — verified in the sibling's repo, not read off the board.**
>
> 🔴 **And the one thing that matters most is not code: `origin/main` has not moved. Backend Phases
> 118–123 — including the whole client-collection move — sit on `origin/ved` and on no deployed
> branch. Three sessions' work is finished and invisible on every handset.**
>
> ⚠️ **Do not delete the handoffs below this one.**

## Done

- **The app reads the merged `client` book's own columns.** `adaptClient` maps `Area`→city,
  `E_mail`→email, `groupName`/`Group Head`→family, `annual_premium_sum`→`totalPremium`, plus
  `Sex`→gender, `Marriage Date`→wedding anniversary and `No of Policies`→the policy-count KPI. Before
  this, the entire client book rendered **city-blank** (`Area` is the only locality on the new rows —
  98.8% coverage by `cgpe-api`'s own measurement), family-blank and email-blank.
- **"Annual premium" is finally annual.** That KPI has always been labelled `client.annualPremium`,
  translated into all five languages, while showing ONE instalment — ₹1,821 half-yearly against
  ₹3,642 a year on the owner's own sample. An unwarmed row falls back to
  `premium × annualFactor(mode)`, never to a bare `premium`.
- **The owner's sample document is pinned verbatim** at `docs/spec/PHASE-97-sample-client.json` and
  drives eight new tests. It was recovered from the session transcripts — it was not on disk — and
  `JSON.parse`d to prove it was unmangled.
- **Gates: `tsc` 0 · `npm test` 1358 passed / 83 files · `eslint` 0 on the touched files.**
- ✅ **`cgpe-api` shipped both of our asks the same day.** Their **Phase 119** (`0179bc0`) put
  `Area: 1` in both projections and made the directory city sort resolve the same chain; their
  **Phase 120** put `dataAnalysis: 0` at **four** sites — we could only see one from an app, and
  `campaigns.js AUDIENCE_EXCLUDE` (up to 20,000 rows), `reportData.js` and `userPortal.js` carried
  the same shape, two of them with comments claiming they used "the SAME" projection.

## Files changed

- `src/data/adapt.ts` — the LIXXX column reads, the household-label rule, and a new exported
  `annualFactor` mirroring the backend's `normalizeMode`→`annualFactor` **chain**.
- `src/data/types.ts` — `gender` / `marriageDate` / `policyCount` on `Client`, each with the reason
  at the field.
- `src/app/client/[id].tsx` — Gender and Wedding-anniversary rows; the Policies KPI prefers the
  person's real holding over the one document this screen fetched.
- `src/data/__tests__/adapt.test.ts` — the owner's document as a fixture + the `annualFactor` table.
- `docs/spec/PHASE-97-sample-client.json` — the owner's sample, verbatim, as durable evidence.
- `CLAUDE.md`, `docs/PHASES.md`, `docs/DECISIONS.md`, `../contracts/INBOX.md` — the record.

## Decisions made

- **Recovered the owner's real document rather than trusting yesterday's transcription of it** — and
  it corrected three details (`E_mail`/`Marriage Date` are null on that row; `groupName` is a
  *current* field, not a new LIXXX one; and the row's own audit reconciles `currentAnnualPremium:
  3642`, corroborating the premium reading from the data instead of from our inference).
- **`annualFactor` mirrors the producer's CHAIN, not one function.** A failing test found it:
  `normalizeMode` repairs `halg-yearly` / `hamf-yearly` before the factor runs, and the app never
  normalises `mode`. Without folding those in, a typo'd row annualises ×1 here and ×2 in the panel.
- **Checked the money path instead of trusting the type.** Renewal reminders build their figure from
  `raw.premium` directly, so no message tells a half-yearly client to pay the annual sum.
- **Suppressed the household label where it equals the client's own name**, in the adapter (one seam,
  feeding both the detail screen and the search index).
- **A `401` under a blanket-protected router proves nothing** — see "Watch out for".

## Known broken / deliberately skipped

- 🔴 **Nothing shipped today is visible to anyone.** `origin/main` = `0324dfc` (the 1 Sep release,
  through their Phase 111). Phases 118–123 are on `origin/ved` (`1515f8d`). Until the owner merges +
  deploys + restarts `:3001`, the new fields are simply absent from production — which is why
  adopting them early was safe, and also why **this is device-unverified and not "Done" in the
  `CLAUDE.md` sense.**
- **`Customer_Code`, `Telephone(Residence)`, `ppt`, `ecs`, `fprDate`, `lastPremiumPayingDate`,
  `dataAnalysis` and the LIXXX `Premium` are unread on purpose** — the backend's own `pickPhone`
  skips the residence phone; the date/term fields each need a display RULE rather than a field; and
  `Premium` is a second annual figure one sample cannot disambiguate.
- **`AadhaarNo` / `PANNo` stay unread** — government ID on a shared handset is an owner decision
  under DPDP, not a field sweep. A test asserts neither can appear in the adapter's output.
- **The new detail rows are English literals** (`Gender`, `Wedding anniversary`), matching their
  existing English peers in that same section. No key was invented — machine translation is banned,
  and a half-translated section reads worse than an English one. They belong in the next copy batch.
- **Open and owner-held: is `dataAnalysis` also on the LEGACY book?** `cgpe-api` refused to guess and
  shipped section 6 of `scripts/preflight-client-collection.js` to answer it; it needs `MONGODB_URI`,
  which we do not have.
- **Voice is unchanged from Phase 96** — the probe output has still not been read, build 6 + OTA is
  not started, and the committed production `JWT_SECRET` is still unrotated.

## Next session starts here

- **Phase 98: read the voice probe, then build 6 with EAS Update (OTA).** `POST /voice/ask` answers
  `401` on prod, so the route is deployed; whether the KEYS are set is what the probe settles, and if
  they are not it is an OPS task no APK can fix. OTA has been asked for three times and its one
  objection ("don't add a native module to a build that is fixing a crash") is spent.
- **First command:**
  `git -C ../cgpe-backend-main ls-remote origin refs/heads/main`
  (if it is still `0324dfc`, nothing from Phases 97 or 118–123 is live and the owner's deploy is
  still the blocker — say so before anything else.)
- **Watch out for:** **a `401` is not proof a route is deployed.** `GET /campaigns/localities`, added
  in the *undeployed* Phase 120, answers 401 — because `router.use(protect)` fires before route
  matching, so `GET /campaigns/definitely-not-a-route-xyz` answers 401 too. **Probe an impossible
  sibling path first; if the control 401s, only the git refs are authority.** `GET /api/users/test`
  is now spent as a discriminator (it answers 404, which only confirms the 1 Sep release is live).

---

# HANDOFF — CGPE Connect (Android) — Phase 97 (SCOPED, no code) — 2026-09-01

> **Nothing was built this session. It was orientation plus one cross-repo verification, and the
> verification changed what the phase is.**
>
> The owner's instruction was *"clients ka data `clients` collection se `client` collection karo —
> har jagah, everywhere, aur naye fields UI mein integrate karo."*
>
> 🔑 **Half of that ask is not app work at all, and is already built by `cgpe-api`. The other half is
> real, is ours, and nobody has filed it.** Doing the literal find-and-replace would have broken every
> client endpoint in the app for no gain.

## Done

- **Established that the collection rename is entirely backend-side and already done.** The app never
  sends or receives a Mongo collection name — `grep -rn "collection" src/` returns only comments and
  UI copy. It calls `/api/clients*`, whose URLs, request bodies and response shapes `cgpe-api` states
  are byte-identical. Their Phase 118 (`644ff2b`) routes all 14 call sites through
  `utils/clientCollection.js` → `CLIENT_COLLECTION = process.env.CLIENT_COLLECTION || 'client'`.
  Their INBOX item says "cgpe-mobile — read; **nothing owed**".
- **Established that Phase 118 is NOT deployed.** Prod deploys `origin/main` = `0324dfc`; `644ff2b`
  exists only on `origin/Shivam`. Production still serves the OLD `clients` book today. So the new
  data is not on any phone and cannot be device-verified yet.
- **Found the part that IS ours, which their "nothing owed" line does not cover.** The wire *shape* is
  identical; the *documents* are not. The owner's sample carries merged LIXXX columns that
  `adaptClient` (`src/data/adapt.ts:139-199`) has no reader for:
  - `Area` → the app derives city from `raw.address.city || raw.city`. The new doc has neither.
    **City renders blank for the whole book.**
  - `E_mail` → the app reads `raw.email`. **Email renders blank.**
  - `groupName` / `Group Head` → the app reads `raw.familyName || raw.family`. **Family renders blank.**
  - `annual_premium_sum` (3,642) vs `premium` (1,821, the half-yearly instalment) → `totalPremium`
    currently shows the **instalment, not the annual figure**, for every non-yearly policy.
  - Unread entirely: `Sex`, `Marriage Date` (anniversary), `No of Policies`, `Customer_Code`,
    `Telephone(Residence)`/`(Office)`, `ppt`, `ecs`, `fprDate`, `lastPremiumPayingDate`, `dataAnalysis`.
  - `AadhaarNo` / `PANNo` are present in the documents and are **PII — deliberately out of scope**.
- **Confirmed those columns actually reach the app**, rather than assuming it. The list route projects
  with `LIST_HEAVY_EXCLUDE` (an *exclusion* projection, so everything else flows) and `GET /clients/:id`
  returns the full document. Non-schema fields survive the read — proven by the fact that `policyNo`
  and `sumAssured` are absent from `models/Client.js` yet the app reads them today.
- 🔎 **Found a real bug in the sibling's own code, by their own rule, and filed it.**
  `greetingEngine.normalizeClient:195` was updated for the new book and now reads `c.Area` as a city
  fallback — but `clientFlags.DERIVED_PROJECTION:329` and `DIRECTORY_FACET_PROJECTION:1124` still
  project only `'address.city'` and `city`, **not `Area`**. That projection's own header says *"⚠️ If
  you add a field (or a new alternate name) to normalizeClient, ADD IT HERE TOO"*. Their completeness
  test (`auth.phase77.test.js`) carries no `Area` fixture, so it stays green. Consequence after the
  deploy: **city is empty for the entire book on every derived read** — the person/household grouping
  key (`clientFlags.js:268`), the directory city sort (`:1274`) and the search score (`:755`). The app
  calls `/clients/segments`, so this reaches us too.

## Files changed

- `docs/HANDOFF.md` — this entry, **inserted above** the Phase 96 handoff, which is preserved verbatim.
- `docs/PHASES.md` — `## Now` and `## Next 3` rewritten; **new row added** for Phase 97 as the owner asked.
- `docs/DECISIONS.md` — appended D-1 … D-4 for this session.
- `../contracts/INBOX.md` — one item appended (append-only `cat >>`, grepped back, size checked).
- `CLAUDE.md` — the durable lesson, so the next session does not re-derive any of this.
- **No file under `src/` was touched.** `tsc`, `npm test` and `eslint` are unchanged from Phase 96 and
  were not re-run, because nothing could have changed them.

## Decisions made

- **Refused the literal find-and-replace.** `clients` → `client` across `src/` would rewrite
  `/api/clients` request paths and 404 the entire client book. The owner's intent — "the app should
  use the new data" — is served by reading the new fields, not by renaming a URL.
- **Did not tick the Phase 118 box.** It is addressed to three recipients, so per the protocol the
  reply goes underneath and the box stays open.
- **Filed the `Area` projection gap rather than working around it app-side.** A client cannot detect
  it (the response is a valid 200 with an empty string) and cannot fix it — only the producer can.
- **Left `AadhaarNo` / `PANNo` out of scope.** They are on the documents; putting government ID on a
  shared-handset screen is an owner decision under DPDP, not a UI detail to slip into a field sweep.

## Known broken / deliberately skipped

- 🔴 **Nothing was built. The phase is scoped, not started.** No `src/` change exists to verify.
- 🔴 **Phase 118 is undeployed**, so even once built, the new fields stay absent on production and the
  work is inert until the owner merges `origin/Shivam` → `origin/main`, deploys and restarts `:3001`.
- **The owner must run the preflight before that deploy** (`cgpe-api`'s ask, still unticked):
  `MONGODB_URI="<atlas uri>" node scripts/preflight-client-collection.js`. It checks the two failures
  that hide themselves — a book with no `advisor_id` (every advisor's "My clients" returns zero while
  an admin sees everything and it all looks fine), and `policy_number: null` duplicates that break the
  unique index build.
- **The voice items from Phase 96 are untouched and still open** — the probe output has not been read,
  build 6 + OTA is not started, and the committed production `JWT_SECRET` is still unrotated.

## Next session starts here

- **Phase 97: make `adaptClient` read the new columns, then show them.** `Area`→city, `E_mail`→email,
  `groupName`/`Group Head`→family, `annual_premium_sum`→`totalPremium`, plus gender / anniversary /
  policy count on the detail screen. Pin the owner's exact sample document as a test fixture.
- **First command:**
  `npx tsc --noEmit && npm test -- src/data/__tests__/adapt.test.ts`
  (establish the green baseline before touching `src/data/adapt.ts`.)
- **Watch out for:** **`totalPremium` is a money figure on the dashboard.** Switching it from
  `premium` to `annual_premium_sum` doubles a half-yearly client's number and multiplies a monthly
  one by twelve. That is the *correct* value — `annual_premium_sum` is a PERSON aggregate the backend
  warms, while `premium` is one instalment on one policy row — but it will read as a regression to
  anyone watching the totals, and `annual_premium_sum` is **absent until the row has been warmed**.
  Fall back to `premium × annualFactor(mode)`, never to a bare `premium`, and say the change out loud
  before it ships.

---

# HANDOFF — CGPE Connect (Android) — Phase 96 — 2026-09-01 (later)

> **The mic crash is GONE — confirmed on the owner's handset.** Build 5 (`a9583d51`) opens voice
> mode and holds the mic without exiting. The `'worklet'` diagnosis was right.
>
> **What replaced it were two REAL bugs, both ours, both now fixed** — and the owner's own screenshots
> named them. No APK was built this session: the fixes are in `src/`, device-unverified, waiting on a
> voice test the owner can now run in one command.
>
> 🔑 **The lesson of the day: three separate times the answer was "read the producer's real code, stop
> guessing" — and twice the guesser was me.** The Expo Go failure, the login field and the brain
> header were all settled by opening someone else's source, never by reasoning from this repo.
>
> ⚠️ **Do not delete the handoffs below this one.** Phases 92–95 and the archived parallel voice-track
> handoff are still the only record of the Skia / Lottie / web-stub traps.

## Done

- **The mic crash is confirmed fixed on a real phone.** Voice mode opens, the orb renders, the mic
  holds. Two APKs died there; build 5 does not.
- **The recorder can no longer outlive the press.** `finishCapture` gated on React `state`, but on the
  first press `startCapture` is parked on the Android permission dialog and has not called
  `setState` yet — so the release did nothing, and when the user tapped "Allow", recording began
  **with no finger on the button and nothing left to stop it.** That is the green mic dot in the
  owner's 2:40 PM screenshot, still lit at 2:42. The next press then hit `expo-audio`'s own guard
  (`AudioRecorder.kt:84`) and reported *"AudioRecorder has already been prepared"*.
- **The 15-second recording cap is actually enforced.** `VOICE.MAX_RECORD_MS` had **zero consumers** —
  the contract specified a hard cap and nothing anywhere applied it, so a capture that lost its
  release grew without bound. That is the likeliest cause of the second screenshot's status-less
  `network` failure.
- **A build can finally be identified on the phone.** The owner's MIUI *App info* shows only
  "Version: 1.10.0" — no build number — and the app's own Settings row showed a hard-coded string
  identical in every build ever made. **Nothing on the handset could tell build 3 from build 5**,
  which is exactly the question the whole day turned on. Settings now reads `1.10.0 (6)`.
- **A failed voice turn names its own cause.** `askVoice`'s `catch` discarded the exception, so the
  owner's second screenshot explained itself with the single word "network".
- **Voice can now be tested from a terminal with only a login** — no phone, no APK, no build, and
  **no server secret**. `scripts/voice-probe.mjs` signs in, prints `GET /voice/status` (which legs the
  server has configured), and runs eight spoken clips through the real STT → brain → TTS chain.
  `scripts/make-voice-clips.ps1` generates those clips with Windows' built-in speech engine — free,
  local, no vendor and no credits.
- **The brain's REAL wire shape is pinned as tests** (`brainShapes.test.ts`, 6 tests), transcribed
  verbatim from a live probe rather than imagined.

## Files changed

- `src/ui/voice/useVoiceTurn.ts` — the lifecycle rewrite: `heldRef`/`liveRef` refs instead of React
  state, one idempotent `teardown()` on every exit path, permission pre-warmed when voice mode opens,
  an already-prepared recorder reclaimed by stopping first, `MAX_RECORD_MS` enforced.
- `src/voice/recorderError.ts` + test — the pure `isAlreadyPreparedError`, split out because
  `useVoiceTurn` is native and the suite cannot reach it.
- `src/voice/client.ts` / `cause.ts` — a thrown fetch keeps its message; `describeTransport` shows it.
- `src/voice/__tests__/brainShapes.test.ts` — real captured responses.
- `src/voice/__tests__/client.test.ts` — one test deliberately updated: it pinned the old discarding shape.
- `src/lib/buildInfo.ts` + test, `src/app/settings.tsx` — the real native build number.
- `package.json` / `package-lock.json` — `expo-application`, lock synced in the same commit.
- `scripts/voice-probe.mjs`, `scripts/make-voice-clips.ps1` — the terminal test path.
- `docs/TESTING-WITHOUT-A-BUILD.md` — Expo Go vs OTA, with the limits of each.
- `docs/OPS-SERVER-HANDOVER.md` §13, `../contracts/INBOX.md` — the nginx questions.
- `.gitignore` + `.easignore` — `e2e/voice-probe/`, both in the same commit.

## Decisions made

- **Did NOT build an APK.** The owner asked for "no more errors" and a voice test first. Building
  before the voice chain has been exercised once would repeat the day's mistake.
- **Did NOT upgrade the 24 drifting SDK-57 packages** to make Expo Go work. `react-native` and
  `reanimated` are in that list, and reanimated is where today's crash came from. Upgrading them for
  a dev tool, on the day the release build finally stabilised, is the wrong trade.
- **Did not file a backend priority-1 task**, because nothing proved a backend fault. Screenshot 1
  never left the phone; screenshot 2 returned no status. Filed two cheap nginx questions instead —
  and `cgpe-api` has **already acted**: `GET /voice/status` now reports `budget_ms`, citing our item.
- **Used Windows' speech engine rather than a paid TTS** to make test audio — free, local, and the
  backend's upload filter already accepts `.wav`.
- **Told the owner plainly that "multiple commands in one query" is a contract limit**, not something
  to loop on: one reply carries one `action`. Pinned by a test so nobody reads it as a parser bug.

## Known broken / deliberately skipped

- 🔴 **The two voice fixes are DEVICE-UNVERIFIED.** They are JS-only and there is still no OTA, so
  they reach a phone only in the next APK.
- 🔴 **Voice has never been observed working end to end by anyone.** The owner says the two server
  keys are set; `GET /voice/status` sits behind `protect` and this session holds no credentials, so
  it could not be confirmed. **The probe answers this in one command.**
- **Expo Go does not work here and was abandoned.** First it was a client-version mismatch (the phone
  needed Expo Go ≥ 57.0.9); after updating, the tunnel failed to deliver the 15 MB bundle
  (`java.io.IOException: Failed to download remote update`). LAN mode works but needs the same WiFi.
  **Expo Go could never have proven release safety anyway** — it runs a dev bundle with LogBox, so
  today's fatal worklet error would have been a dismissible red box.
- **Hindi/Hinglish voice clips cannot be generated here** — this machine has only en-US voices. The
  probe tests the English half of the battery; the Hinglish staff actually speak still needs a Hindi
  voice pack or a human recording.
- **`exceedsAudioCap` still has no consumer.** The duration cap bounds clips to ~250 KB, so it is not
  urgent, but the byte check remains dead code.
- **The committed production secrets (`JWT_SECRET`) are still unrotated** — owner-owned, unchanged.

## Next session starts here

- **Phase 97: read the probe output, then build.** If `ready: true` and the clips navigate correctly,
  build 6 with the voice fixes **+ EAS Update (OTA)** — the owner has asked for OTA three times, and
  the baseline is now known-good, which is what was missing when it was last deferred.
- **First command:** ask the owner for the `node scripts/voice-probe.mjs` output (they have it
  queued), or if they have already pasted it, read `e2e/voice-probe/voice-status.json`.
- **Watch out for:** **guessing another producer's wire format.** This session got the brain header,
  the login field and the Expo Go failure wrong by reasoning instead of reading, three times in a row.
  Second trap: **do not "fix" Expo Go by upgrading reanimated.**

---

# HANDOFF — CGPE Connect (Android) — Phases 92–95 — 2026-09-01

> **Four APKs shipped today. The first three were the story: `372cd790` (vc2) and `577a4ec5` (vc3)
> both EXITED THE APP when the mic was pressed, `2cb0e667` (vc4) shipped with voice switched off,
> and `a9583d51` (vc5) ships the actual fix with voice back on.**
>
> 🔑 **The lesson that outranks everything else here: `tsc` + `npm test` + `eslint` +
> `expo export -p web` were ALL GREEN on both crashing builds, and always would have been.** The
> fault was a missing `'worklet'` directive — a UI-thread runtime rule no gate in this project can
> see. **A build carrying a surface that has never run on a handset must be treated as unverified,
> and said so out loud before the build is spent.**
>
> **THE BACKEND ALSO DEPLOYED TODAY** (`origin/main` `990c660` → `0324dfc`), which changed live app
> behaviour and surfaced a production secret leak. See "Known broken" — it is not ours to fix.
>
> ⚠️ **The voice-track handoff below the rule is ARCHIVED VERBATIM from a parallel session. Do not
> delete it** — it is still the only record of the Skia / Lottie / web-stub traps.

## Done

- **The mic-button crash has a NAMED CAUSE and it is fixed.** `OrbStatic`'s `clamp01` had no
  `'worklet'` directive while being called from a `useDerivedValue` body, which runs on the **UI
  thread**. Reanimated cannot call a plain JS function from there; in a release build (no LogBox)
  that is **fatal** and the process exits, which to a user is indistinguishable from a native crash.
  **No React error boundary can catch it** — which is exactly why Phase 93's `FeatureBoundary`
  changed nothing.
- **The evidence is an asymmetry, not a hunch.** The identical helper in the sibling `OrbSkia.tsx:27`
  has always carried the directive, and `VoiceWaveform`'s `Bar` sidesteps it by inlining its clamp.
  Only this copy was plain, and it is the **only** such call site in the app (`'worklet'` appears
  exactly once in `src/`; every other animated style is self-contained). **It explains BOTH crashing
  builds with one cause** — `OrbStatic` renders as the Skia orb's `Suspense`/boundary fallback *and*
  as the sole character once Skia is off — which no earlier theory did.
- **The dashboard no longer prints a failed read as a real zero.** Backend Phase 110 answers 200 with
  `partial:true` + `degraded:[…]` and the KPIs zeroed; the app read neither field, so "0 claims,
  ₹0 settled" appeared on the master dashboard as though true. It now raises the outage banner.
- **A failed voice turn now says what actually failed.** Every path used to `catch { fail(…) }`
  without binding the exception, and the banner hard-coded one sentence as both title and message —
  so a screenshot carried zero diagnostic information. `src/voice/cause.ts` puts the real reason on
  screen; the title is now the sentence the failure produced; and the retry action is withheld when
  no retry can help.
- **Voice mode no longer constructs a native audio recorder on every app boot.** `useVoiceTurn` →
  `useAudioRecorder` sat *above* `if (!isOpen) return null`. `VoiceMode` is now a shell reading one
  context value plus an inner component holding every other hook.
- **Builds can be told apart on the phone.** `preview` gained `autoIncrement`; versionCode went
  1 → 2 → 3 → 4 → 5. Previously every build was versionCode 1 and only an APK hash distinguished them.
- **The `.easignore` fix is verified against real builds** — four archives uploaded at ~7 MB (was
  347 MB), with no keystore, no plaintext passwords and no Firebase key.
- **The backend's whole 29-commit window was swept against every route the app calls** (Phases
  107–112). One app-side finding (the `partial` flag above); everything else verified as owed nothing.

## Files changed

- `src/data/api.ts` — `getDashboardOverview` re-reports to `data/health` when `partial === true`.
- `src/data/__tests__/api-dashboard-partial.test.ts` — 4 tests, incl. a body with no `partial` key.
- `src/ui/voice/OrbStatic.tsx` — **the fix**: `'worklet'` on `clamp01` *and* the derived value clamps
  inline, so the worklet calls nothing at all. Either alone suffices; both together survive an edit.
- `src/voice/enabled.ts` — new `VOICE_ENABLED` master switch (currently `true`), carrying the whole
  crash history and the one-line kill instruction.
- `src/lib/voiceGraphics.ts` / `.web.ts` — `VOICE_HEAVY_GRAPHICS_ENABLED = false`: Skia, blur and
  Lottie stay off. **They were never the cause, but they were never device-proven either.**
- `src/voice/cause.ts` + `__tests__/cause.test.ts` — the diagnostic breadcrumb, 7 tests.
- `src/ui/voice/useVoiceTurn.ts` — `cause`/`permanent` state; the exception is kept; the recorder
  retries with the vendor's unmodified `HIGH_QUALITY` preset if ours is refused.
- `src/ui/voice/VoiceMode.tsx` — shell/inner split; banner title/message fixed; async event handlers
  `.catch()`-ed (a boundary covers neither handlers nor promise rejections).
- `src/ui/VoiceLauncher.tsx` — respects `VOICE_ENABLED`.
- `src/ui/FeatureBoundary.tsx` — contains a JS **render** failure to one feature. Kept, with its real
  limits written at the file.
- `src/ui/voice/GlassCards.tsx` — `blurMethod` (the `experimental` prop is deprecated in expo-blur 57).
- `eas.json` — `autoIncrement` on `preview`.
- `docs/PHASES.md`, `docs/DECISIONS.md`, `docs/STATUS.md`, `../contracts/INBOX.md` (one reply + one
  ticked box, both grepped back; 948,532 → 954,539 B).

## Decisions made

- **Fixed the worklet bug twice over** — directive *and* inline clamp — so a future edit to one cannot
  reintroduce it.
- **Re-enabled voice, but left Skia/blur/Lottie off.** They are decoration, were never proven on a
  handset, and the fixed `OrbStatic` is the character. Turning them on is a separate device test.
- **Switched voice off entirely for vc4 rather than guess a third time**, because it *also* cannot
  work today (server keys unset) — so hiding it cost the user nothing. Had voice been working, that
  would have been the owner's call, not mine.
- **Did NOT add EAS Update (OTA) to any of today's builds**, though the owner asked for it twice. It
  adds a native module and changes the boot path, and these were the builds fixing a crash. **It is
  the agreed next step once a build is confirmed good on a phone.**
- **Measured the quota instead of quoting it:** 15 Android builds/month (Aug ran 15 then refused; Jul
  13). Four used today, **11 left**.
- **Did not guess at the "view as preview" report.** `applyView` (`more.tsx:188`) only sets state and
  toasts; without a log it was left explicitly unexplained.

## Known broken / deliberately skipped

- 🔴 **The fix is DEVICE-UNVERIFIED, like the two crashing builds before it.** This is the third
  attempt; the first two were containment and both failed. The diagnosis is strong (it explains both
  builds with one cause) but **only a handset settles it**. If it crashes again:
  `VOICE_ENABLED = false` in `src/voice/enabled.ts` — one line — and **do not spend another build on
  a new guess** without a device or the crash dialog's "View summary".
- 🔴 **PRODUCTION SECRETS ARE COMMITTED AND PUSHED** in `Aaziko1Market1/cgpe-backend` at
  `docs/OPS-ENV-HANDOVER.md` (`1624f8a`) — on `origin/main`, `origin/Shivam` *and* `origin/ved`.
  21 real values including **`JWT_SECRET` (64 chars)**, which signs every session token: it mints a
  valid token for any user, super_admin included, with no password. **Deleting the file does not fix
  it (git history) — these must be ROTATED**, and rotating `JWT_SECRET` signs everyone out, so the
  owner picks the moment. **Owner-owned, unanswered, and the most serious open item in the project.**
- **Voice cannot ANSWER until OPS sets `SARVAM_API_KEY` + `N8N_VOICE_BRAIN_URL` and restarts `:3001`.**
  `/api/voice/ask` answers `503 not_configured` (`voiceConfig()` needs `ready = stt && brain`).
  **We could not verify the env from here** — `GET /api/voice/status` reports exactly this (names
  only, never values) but sits behind `protect`, and this session holds no credentials. The n8n brain
  itself **is** live and correctly rejects a bad secret (probed). The backend's own handover doc parks
  both keys under *"Group 2 — can wait; the owner is arranging these"*, so they are probably unset.
- **The owner declined USB debugging**, so `adb logcat` is unavailable. `platform-tools` is in the
  session scratchpad if that changes.
- **Never confirmed which build was installed** when vc3 was reported as still crashing. The owner
  reported the APK link opening in a browser on some handsets, which makes re-installing an older
  file easy. **Ask for `Settings › Apps › CGPE Connect → 1.10.0 (N)` before believing a bug report.**
- **The "view as preview" crash report is unexplained** (see Decisions).
- **Everything since 25 Aug remains device-unverified**, which is what keeps Phase Ω shut.

## Next session starts here

- **Phase 96: confirm vc5 on a real handset, then add EAS Update (OTA).** OTA is what the owner has
  asked for twice — after it, a fix like today's ships in seconds with no rebuild and no quota.
- **First command:**
  `npx eas-cli build:list --platform android --limit 3 --json --non-interactive`
  (confirm `a9583d51` / versionCode 5 is newest), then ask the owner what the mic button did.
- **Watch out for:** **treating a green gate chain as evidence.** It was green on both crashing
  builds. The only evidence about this class of fault is a phone. Second trap: **do not re-enable
  Skia/blur/Lottie** while chasing something else — they are off deliberately and are still unproven.
---
---

# ARCHIVED — the parallel session's handoff (voice assistant track, 2026-08-29)

> Preserved verbatim. This is the only record of the Skia / Lottie / web-stub traps. Do not delete.

# HANDOFF — CGPE Connect (Android) — Voice assistant track — 2026-08-29

> This session built the **voice assistant** end-to-end on the app side, produced the n8n + backend
> specs, and then **totally redesigned the voice UI to be "heavy"** (Skia glossy orb + frosted glass +
> Lottie-ready + male/female toggle). Everything is pushed to `aaziko/Shivam`; gates green throughout;
> **no APK built (owner: build ONE at the very end, after the backend proxy + all tasks).**
>
> ⚠️ **A PARALLEL session did the i18n Phase 85 work** (home-dashboard header translations) in this same
> checkout — see memory `phase85-home-headers-i18n-2026-08-29` and `docs/PHASES.md`. History is linear;
> both coexist; nothing overridden. This HANDOFF is the voice track's snapshot.

## Done (observable)
- **The whole voice app-side works in code**: hold the floating mic → full-screen voice mode opens →
  record → POST to the backend proxy → show transcript + speak the reply → navigate on command. All the
  decision logic (`src/voice/*`) is unit-tested (**npm test 1254**).
- **The voice mode is the heavy redesign**: a full-screen immersive surface (not a bottom sheet), a
  **glossy Skia liquid orb** that pulses with the real mic, **real frosted-glass** cards (expo-blur), a
  **male/female toggle** (persisted), a mic-reactive waveform, five animated states, department + persona
  colours, and a reduced-motion + non-Skia fallback (gradient orb). Boot-safe: web export prerenders all
  46 routes clean after every native add.
- **The app is aligned to the LIVE n8n brain contract** — the brain sends `{success, reply_text, action}`
  (no `confidence`); the parser now treats absent confidence as *act*, accepts `success`, and speaks a
  `success:false` reason without navigating.
- **The backend task is filed** — `POST /api/voice/ask` (STT → brain → TTS) is in `contracts/INBOX.md`
  (top, to `cgpe-api`) with the full brief at `docs/spec/VOICE-BACKEND-PROXY-BRIEF.md`.
- **Deliverables handed to the owner**: the n8n dev brief, the backend proxy brief, and two visual
  artifacts (voice-mode preview + the n8n spec page).

## Files changed
- `src/voice/*` — the tested pure core: gate/resolve/session/response/routes/request/client/registry/dispatch.
- `src/ui/voice/*` — **NEW** heavy UI: VoiceMode, useVoiceTurn, VoiceCharacter, OrbSkia, OrbStatic, GlassCards, VoiceWaveform, PersonaToggle, VoiceModeContext, VoiceMascot(+`.web`), mascots.ts, voiceVisual.ts (+tests).
- `src/lib/voiceGraphics.ts` (+`.web`) — Skia/blur/lottie probes; `src/lib/voiceAudio.ts` — metering.
- `src/app/_layout.tsx` — mount VoiceModeProvider + `<VoiceMode/>`; `src/ui/VoiceLauncher.tsx` — opens voice mode.
- `src/voice/response.ts` (+test) — aligned to the live brain. Removed superseded `VoiceSheet.tsx` + `VoiceAvatar.tsx`.
- `package.json`/`package-lock.json` — `@shopify/react-native-skia 2.6.2`, `expo-blur ~57.0.2`, `lottie-react-native ~7.3.8` (+~10-16 MB; native rebuild).
- `src/i18n/index.tsx` (+test) — voice.* keys (parity 446).
- `docs/spec/{N8N-VOICE-DEV-BRIEF,VOICE-BUILD-SPLIT,VOICE-BACKEND-PROXY-BRIEF,N8N-VOICE-WORKFLOW-SPEC}.md` — voice specs.
- `contracts/INBOX.md` — the `/api/voice/ask` backend ask.

## Decisions made
- **Voice architecture = n8n text brain + backend STT/TTS** (owner overrode the Express-fat-registry recommendation for speed). Confirmed live: the brain is text-in/text-out.
- **Full heavy UI** (Skia + expo-blur + Lottie), **light glassmorphic aesthetic**, **Lottie + male/female toggle now**. **Mascot ART is owner-commissioned** — the premium orb is the character until the `.json` drops into `assets/voice/`.
- **Writes stay DARK** in v1 (`VOICE_WRITES_ENABLED=false`) — reads + navigate only.
- **No APK yet** — one build at the very end, after the backend proxy + all other tasks.

## Known broken / deliberately skipped
- **Voice does not round-trip yet** — the backend proxy (`/api/voice/ask`) is not built (filed to cgpe-api). Until it's up, the app records but has nothing to talk to.
- **The character is an orb, not a drawn mascot** — bespoke art is owner-commissioned; the Lottie slot + toggle are wired.
- **All visuals are device-unverified** — Skia/blur/metering/back-intercept need a real APK (EAS quota resets 1 Sep; existing account cannot build before then).
- **EAS Update (OTA) not added** — recommended; owner build decision.
- **The `vbk_` brain webhook secret was pasted in chat** — must stay server-side only; worth rotating.

## Next session starts here
- **Phase — voice go-live:** confirm the backend proxy is built (INBOX top ask), then wire the pre-1-Sep test APK OR the 1-Sep final build (existing account, same keystore).
- **First command:** `npm test` (expect 1254 green), then re-read `contracts/INBOX.md` for the cgpe-api reply on `/api/voice/ask`.
- **Watch out for:** the **lottie web-build trap** — `lottie-react-native`'s web renderer needs `@lottiefiles/dotlottie-react` (not shipped); it is neutralised by `VoiceMascot.web.tsx` + `voiceGraphics.web.ts` stubs. **Do not delete those stubs** or the web export (boot-safety gate) breaks. And never static-import Skia/blur/lottie from a route/boot file — they load only via the `hasSkia/hasBlur/hasLottie` probes + `React.lazy`.
