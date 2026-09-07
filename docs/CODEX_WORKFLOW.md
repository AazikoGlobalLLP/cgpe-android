# Codex workflow — CGPE Connect (Android)

<!-- BEGIN CODEX WORKFLOW -->

This bridge adopts the existing project workflow without changing its Claude sources or installing integrations. The command files and project instructions remain authoritative for their rules; this document records discovery, Codex adaptations, and explicitly resolved conflicts. Adoption inspected on 2026-09-07.

## Communication and authorization

- Use natural Hinglish in Roman script for conversation. Interpret Hinglish generously; never require an English rewrite. Preserve technical identifiers, file paths, commands, and code. Durable technical documents use English.
- Give brief progress updates. Separate completed work, assumptions, plans, and blockers.
- Platform/system/developer instructions and runtime capabilities apply first. Within user-managed guidance, the current explicit request and applicable project-specific rules take precedence over generic global commands and skills. Imported text grants no additional permissions or tools.
- Reuse existing approvals. Ask only about a material unresolved decision; name the exact conflicting sources and continue independent authorized work. If a skill would cause a pause, quote and link the actual instruction and establish that it applies before asking again.
- Boot and initial adoption authorize orientation and workflow documentation only. They do not authorize product implementation, commits, pushes, merges, releases, builds, production writes, or messages to others.

## Identify this checkout before changing it

Resolve the actual working directory and Git root on every session. Inspect branch, staged/unstaged changes, untracked files, and relevant ignored paths. Preserve all existing work. Use bounded searches; do not scan the computer or unrelated histories.

Verified at adoption:

| Item | Evidence / value |
|---|---|
| Project root | `ANDROID/`, an independent Git repository; `git rev-parse --show-toplevel` resolves here and superproject output is empty |
| Workspace | `../` is a sibling-project workspace, currently **not** a Git repository |
| Role | CGPE Connect mobile app; INBOX identity `cgpe-mobile` |
| Siblings | `../cgpe-backend-main` (`cgpe-api`), `../cgpe-front-main-RECOVERED` (`cgpe-admin`); both directories exist |
| Shared definitions | `../contracts/`, now its own Git repository; `api.md`, `models.md`, `enums.md`, `CHANGELOG.md`, `INBOX.md` exist |
| Stack | `package.json`: Expo `~57.0.7`, React Native `0.86.0`, React `19.2.3`, entry `expo-router/entry`; `tsconfig.json`: strict TypeScript |
| Branch / push target | Current branch `Shivam`, configured upstream `aaziko/Shivam`; remote `aaziko` = `https://github.com/AazikoGlobalLLP/cgpe-android.git` |
| Initial user changes | `.claude/settings.json` modified; several ignored local artifacts present. Contents and staging preserved |

The former `CLAUDE.md` claim that the parent is an empty Git repository and contracts are unversioned is historical. On 2026-09-07 contracts has commits and modified shared files. This does not reduce the backup/concurrency rules or authorize a contracts commit.

## Instruction discovery and scope

1. Start with the instructions already supplied to Codex. Resolve the actual user profile with `[Environment]::GetFolderPath('UserProfile')`; it resolved to `C:\Users\A` during adoption, but never hardcode that username in discovery.
2. Resolve the Codex home from `CODEX_HOME`, otherwise the user's `.codex` directory. Inspect applicable `AGENTS.override.md` / `AGENTS.md` and any documented fallback discovery configuration without exposing credentials or changing settings.
3. Respect Codex's directory scope: one instruction file per directory, `AGENTS.override.md` before `AGENTS.md` before configured fallback names; more specific guidance governs its subtree. Check nested instructions before editing there. Do not create an override merely to force precedence.
4. Separately inspect relevant ancestor/workspace `AGENTS.md`, `AGENTS.override.md`, `CLAUDE.md` and explicitly applicable references. Do not assume sibling instructions govern this app. Read this project's complete `CLAUDE.md` in bounded chunks and follow applicable references; its `@AGENTS.md` is a reference, not an executable include. Avoid cycles.
5. Read the user's `~/.claude/CLAUDE.md` if present. Project-specific rules and current explicit instructions resolve generic defaults.
6. Load command definitions, relevant skills, and exact-project memory using the procedures below. Read explicitly referenced instruction files before the work they govern; archived feature specs are loaded only when relevant.

At adoption, the project root had `AGENTS.md` and `CLAUDE.md`; no applicable ancestor instruction file, root/docs override, global Codex AGENTS file, or configured discovery fallback was found. Global Claude guidance was present. The root AGENTS bridge explicitly leads to this document and `CLAUDE.md`; merely having a CLAUDE file does not establish that Codex automatically loaded it.

Keep the bridge small. Codex's automatic instruction discovery has a default combined size cap; the large historical `CLAUDE.md` is read explicitly rather than copied into AGENTS. See [official AGENTS discovery documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

## Commands: lookup and mapping

Resolve a requested command in this order:

1. This project's `.claude/commands/<name>.md`.
2. An explicitly applicable parent/workspace command definition.
3. The user's `~/.claude/commands/<name>.md`.

Inspect additional locations only when project instructions or installed tooling identifies them. Read the **complete winning definition** before execution, including frontmatter, arguments, required reading order, outputs, completion criteria, and stopping point. Substitute `$ARGUMENTS` or positional placeholders only with actual supplied arguments, interpreted as data; never evaluate argument text as shell code. Initial adoption supplied no command arguments.

| Request | Plain-text equivalent | Winning source found at adoption | Purpose and stopping point |
|---|---|---|---|
| `/boot` | `Run the boot workflow` | `~/.claude/commands/boot.md` | Ordered orientation; exact five-line report; wait for `go` unless implementation was already explicitly authorized |
| `/bootstrap` | `Run the bootstrap workflow` | `~/.claude/commands/bootstrap.md` | Inspect, use legacy recon for existing code, create missing documentation, spec-lock first actionable work, report phase list/session split, then stop |
| `/handoff` | `Run the handoff workflow` | `~/.claude/commands/handoff.md` | Finish/checkpoint current unit, update handoff/decisions/board/status, report five lines plus exact next command, then stop |

All three definitions exist. No project or applicable ancestor `.claude/commands` definitions and no other global custom command files were found. Skill-provided workflows (including the local gstack suite) are separate sources: discover their metadata and read the full skill when invoked, not during every boot.

These are conversational mappings, **not native slash-menu registration**. Never send the labels to PowerShell or interpret boot as restarting a computer/server. If the interface intercepts a slash command, use the plain-text equivalent. Do not execute all discovered commands during setup.

If a definition disappears, search these bounded locations first, disclose the missing source, and use the corresponding fallback below. Do not invent another command's behavior.

## Skills and memory

Discover skill metadata (name, description, source path) first; read full instructions only for the workflow being used. Resolve relative references against the skill's own directory. Do not install or execute tools merely because a skill mentions them.

The existing global workflow skills were found under `~/.claude/skills/<name>/SKILL.md`:

| Skill | Scope / adoption |
|---|---|
| `phase-runner` | Session/phase lifecycle; full instructions read. Phases normally touch at most 8 files, produce one demoable outcome, and have binary criteria in `docs/spec/` |
| `spec-lock` | Resolve ambiguous requirements from existing values and persist the spec before code; full instructions read; use existing approvals and delegated routine choices |
| `legacy-recon` | Read-only takeover and map/safety-net workflow before planning changes to unfamiliar legacy code; full instructions read; existing bootstrap is not rerun for orientation |
| `contract-sync` | Producer/consumer contract verification and shared queue; full instructions read; see concurrency and notification adaptations below |
| `ui-contract` | Existing tokens, component states, accessibility, visual verification; full instructions read; use this app's RN/theme conventions instead of copying web/CSS examples or a new palette |
| `karpathy-guidelines` | Scoped changes, explicit assumptions, verification; full instructions read |
| `n8n-build` | Versioned automation/webhook workflows; metadata discovered, load for actual n8n work |
| `graphify` | Code/content relationship graph; metadata discovered, load when its graph workflow is relevant |

Additional skills are exposed to this Codex session and live in `.agents/skills/`, including `gstack/` and design/testing skills. Consult their supplied catalog or bounded `SKILL.md` metadata, then load on demand. Parent `.claude/skills/` contains graphify/gstack and several **broken junctions pointing to an old `E:` workspace**; usable equivalents exist in this repo's `.agents/skills/`. Do not silently use an unrelated repository or repair those junctions during adoption. `F:\.claude\skills\graphify` and the global copy were also found. There is no `graphify-out/` inside ANDROID; the parent workspace has a graph, whose scope must be checked before use.

Exact-project Claude memory at adoption:

`~/.claude/projects/F--Shivam-Aaziko-Dev-MERN-CGPE-CURRENT-PROJECT-ANDROID/memory/`

Read `MEMORY.md` first, then only entries relevant to the current task. If the path changes, list candidate project directories using the resolved checkout name/path and verify their identity from the memory index or bounded metadata. Never merge memories from sibling repositories or scan unrelated transcripts.

The initial relevant entries were `status-md-every-session-2026-09-03.md`, `live-coordination-2026-09-03.md`, and `audit-sweep-2026-09-03.md`. The status instruction is also corroborated by the latest project handoff: update `docs/STATUS.md` every working session without being asked. Historical implementations, test totals, branch/deploy states, copy approvals, and device results require current evidence before reuse. Preserve original memory files; no memory migration or transcript import is needed.

## Boot, including fallback

Follow the discovered boot definition with these project-specific resolutions:

1. Read `docs/HANDOFF.md`, starting with the current entry; keep archived entries distinct.
2. Read the current portions of `docs/PHASES.md` (`Now`, `Next 3`, relevant current rows). Archived notes are not a new backlog.
3. Read `docs/PROJECT_MAP.md` for navigation, verifying stale facts only where relevant.
4. Read **`../contracts/INBOX.md`**, its protocol, full relevant threads, and later replies. The global command's `contracts/INBOX.md` is resolved to the project's actual shared location. For **every open `cgpe-mobile` box**, search the named symbols in `src/`: distinguish unstarted code, completed code with an open acknowledgement, and real external dependencies. The board alone can miss new inbound work.
5. Read only the next relevant spec and the files it touches. An unnumbered inbound request does not inherit a backend phase number. Report a missing mobile spec honestly; do not create an invented phase during boot.

The project also requires a bounded backend change sweep at boot/handoff: discover live branch refs, compare only matching cached objects (or safely obtain needed objects), list pending commits, and inspect changes to routes the app consumes. A commit on `main` is not proof of production deployment. Verify current remote state before reporting divergence. Never dump `.env`, credential-bearing documentation, tokens, or business records in a diff.

Boot does not start servers, tests, migrations, builds, paid probes, or feature implementation. It does not automatically tick boxes. Acknowledgement and completion are distinct; follow the ownership rules below. Initial adoption leaves shared files untouched.

Return these labels, with Hinglish descriptions:

```text
PHASE <number or NONE>: <current goal/state>
FILES: <relevant paths>
DONE WHEN: <observable acceptance criterion, or explicitly missing spec>
BLOCKERS: <specific dependencies or none>
INBOX: <items needing this session or clear>
```

A standalone boot stops here and waits for `go`. If no approved phase exists, use `NONE`; do not invent features or repeat completed phases. If `docs/PHASES.md` is missing, report that the project is not bootstrapped and name `Run the bootstrap workflow` as the next action. Do not create a phase board during boot. The one-time adoption response may precede the five lines with its setup report; later boots use only the format.

## Bootstrap, including fallback

Execute only when requested. The discovered definition requires inspection before writes and `legacy-recon` before planning changes to inherited code. Reuse the existing map, specs, and decisions instead of restarting historical phases. Establish actual entrypoints, scripts, startup risks, tests, existing behavior, and sibling ownership.

Create only missing workflow documents: `docs/PHASES.md`, `docs/DECISIONS.md`, `docs/PROJECT_MAP.md`, `docs/spec/GLOSSARY.md`, `docs/HANDOFF.md`, and `docs/STATUS.md`; follow legacy-recon's `docs/RISK.md` requirement when doing that workflow. The command's short `CLAUDE.md` template applies only to a newly missing file: never truncate the existing project instructions to 60 lines. Its "Phase 1 starts here" seed applies only to an actual first phase.

Record existing implementation separately from future work. Spec-lock the first actionable phase in detail and keep later approved phases at one-line granularity, normally at most 8 files and one observable outcome per phase. Do not invent product requirements to fill a roadmap. Use the existing `../contracts/` if contracts need work; never create a competing `ANDROID/contracts/` or edit sibling instructions merely to satisfy a generic template. Report the phase list and recommended named-session split, then stop. Bootstrap does not authorize implementing every phase.

## Go and continuation

- `go` means execute the most recently identified phase or scope. `continue` resumes authorized unfinished work. `complete all pending phases` covers the established pending scope of this project only.
- Read and persist the relevant spec before coding. Reuse approved values and recorded owner decisions. Routine choices already delegated to the agent do not need repeated approval. Ask only when a missing decision materially changes the authorized outcome.
- Keep the board and handoff accurate as work progresses. Verify observable completion; do not mark device-unverified behavior as Done.
- `phase-runner`'s "1 session = 1 phase" and context-clear advice are sizing/checkpoint guidance under the current user instruction. They do not stop explicitly authorized multi-phase work. Compaction does not cancel the task.
- Use bounded read-only delegation when allowed by the active runtime and applicable skill instructions; do not spawn an open-ended swarm or switch models/settings to follow historical tooling advice.

## Verified Git, checks, and execution rules

- Work on `Shivam`; never push `main`. For authorized implementation, the project policy is a reviewed per-unit commit, then `git push aaziko Shivam` at each completed phase, then handoff. Use a clear `<area>: <what changed>` message; multiline messages go in a file passed to `git commit -F <file>`.
- Preserve `origin` (`https://github.com/Dev-Shivam-05/CGPE-ANDROID-APPLICATION.git`). Historical 403/access claims are not current capability checks. Inspect live remote refs when needed; a fetch-first rejection is divergence, not corruption. Inspect before a normal merge under the established implementation scope; never force-push, rebase, reset, delete branches, or rewrite history without explicit authorization.
- Stage only reviewed files belonging to the authorized work. This overrides the global Claude example `git add -A`. Never commit local `.claude/settings.json` or root scratch `.txt` files without a specific request. A setup/boot does not trigger the generic automatic commit/push rules.
- On a Git error, preserve the tree and report the actual error; do safe read-only diagnosis, not discarding/recloning or unsolicited global configuration changes.
- Before application changes, read the exact [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) required by AGENTS and the relevant versioned API page. Do not upgrade dependencies as an orientation step.

Commands verified from project scripts/configuration (availability is not a claim that they ran):

| Command | Scope / gate |
|---|---|
| `npx tsc --noEmit` | Strict TypeScript gate before implementation commits |
| `npm test` | `vitest run`; `vitest.config.mts` scopes tests to `src/**/__tests__/**/*.test.ts`, Node with native stubs |
| `npm test -- <test-file>` | Project-supported focused test invocation; do not replace with direct `npx vitest run <file>` |
| `npm run lint` | `expo lint`; no new lint errors. Cache-free touched-file check: `npx eslint <file>`; whole app: `npx eslint src` |
| `npm run e2e` | Playwright via `e2e/playwright.config.ts`; inspect startup/mocking before running, never as boot orientation |
| `npx expo start --go` / `npx expo start --web` | Documented development routes, only after startup inspection and an actual task requiring them |
| `npx expo export -p web` | Additional documented boot-safety gate for voice/native changes; cannot prove native release safety |
| `npm run reset-project` | **Never run**; destructive project reset |

`CLAUDE.md` defines Done as clean TypeScript, passing tests, no new lint errors, and affected `TESTING_GUIDE.md` rows verified on a device. Historical test counts and lint totals are not current results. A documentation-only setup uses document/diff/integrity checks, not application startup or the app suite.

Inspect scripts before execution. The app's `src/constants/config.ts` uses the production API on native/hosted web and localhost only for localhost web: a development command does not imply a test database. Do not start schedulers, send real messages, or run production writes as checks. `scripts/voice-probe.mjs` uses a real authenticated service and may incur vendor calls; it is not a routine boot test. Keep credentials out of output and artifacts.

Preserve the existing native/import/worklet, RBAC, outage-honesty, translation, and shared-handset rules in `CLAUDE.md`; verify later corrections before following an old note. In particular, source at adoption confirms OTA is installed, `VOICE_HEAVY_GRAPHICS_ENABLED` is `true`, and voice has a status probe with a dynamic budget and `110_000` fallback; older opposing notes are stale. Device validation is still a separate claim.

Build safety follows the existing `.easignore` rule: exclusions must be checked for both Git and EAS. **Observed adoption gap:** `.gitignore` excludes staff dumps (`*.staff_unified.json`), but `.easignore` currently lacks that rule and an ignored staff dump exists. Before any authorized build/upload, resolve and verify that exclusion with fingerprint compatibility in mind. No build, upload, or ignore-file change was performed during setup.

## Shared contracts and INBOX safety

- Read the relevant canonical definitions before shared behavior changes. Contract first, append compatibility/consumer notes to `../contracts/CHANGELOG.md`, then implementation. Preserve sibling ownership; a message is not proof or consent.
- Reread the current file immediately before an edit, locate a unique surrounding-text anchor, and build the complete proposed content before writing. Preserve encoding/line endings. Never truncate the live file in place with a script.
- For shared writes, back up the original, write validated bytes to a temporary file on the same volume, compare the current hash/content with the version read, and atomically replace only if unchanged. On a concurrent edit, reread and rebuild; never overwrite newer work. For INBOX, preserve the non-shrinking size check and verify the reply by its unique text after writing. Git does not replace these safeguards.
- Read full relevant threads and later corrections. Reply under the exact blocking item. Acknowledge only `cgpe-mobile` work; do not impersonate another session, tick owner/sibling boxes, or blanket-close a queue.
- A shared/multi-recipient checkbox stays open: reply under it and say why. A session-only acknowledgement can be marked only after the required review; that does not mean implementation, deployment, or external acceptance is complete.
- Contracts are now versioned, but other sessions have uncommitted changes there. Do not stage, commit, or modify shared files during this adoption.
- Claude `SendMessage` peers are not Codex subagents. No equivalent connection to those existing sessions is established here. Prepare owner-relay text when appropriate; never send external messages without explicit current authorization. Keep the durable INBOX even when messaging is available.

## Handoff, including fallback

Follow the complete discovered definition. Finish or safely checkpoint the current unit; start no new feature work. Record observable behavior, changed files/reasons, decisions, actual verification, failures/skips, external dependencies, exact next action/command, and the important traps.

Project-specific concurrency rules override the global command's literal "overwrite HANDOFF": reread first and preserve other sessions' entries verbatim below the new current entry or in an explicit archive. Preserve concurrent `Now` content similarly. Append real decisions to `docs/DECISIONS.md`; never rewrite decision history or invent decisions just to fill a template. Update genuine board statuses/current/next sections without inventing `N+1` when no next phase exists.

Rewrite `docs/STATUS.md` at the end of **every working session**, not just handoff. Use the global manager-readable format: project title, Updated, Working on right now, Done this week, Blocked on, Next. No paths, function names, or hashes in that manager status. Reconcile prior outcomes and current blockers, retaining history in the handoff; do not roll last week's claims into "Done this week" as new work.

Update shared contracts/INBOX only when the work requires it and within ownership/authorization. Append newly verified server dependencies to `docs/OPS-SERVER-HANDOVER.md` under its own rules. **Phase Ω stays blocked** until every other phase is Done, including device verification and owner/copy dependencies. Do not prematurely assemble or send the final production message.

Report implemented / tested / committed / pushed / merged / deployed / externally verified separately. Return the requested five-line handoff summary plus exact next action. No available interface here clears the user's conversation: do not claim `/clear` ran. The user can open a new session and send `Run the boot workflow`.

## Initialization evidence — 2026-09-07

The September 3 handoff's "only owner work remains" is no longer the full current picture. The September 7 INBOX thread headed "pending backend completion" requires **new mobile account-deletion request/status adoption**. Current `src/data/api.ts` still calls `DELETE /auth/me`; `src/app/account.tsx` promises immediate erasure, and `src/store/auth.tsx` clears local identity on success. The new canonical contract is POST/GET `/auth/me/deletion-request`: request submission/status only, with no erasure or deactivation. Adoption must keep the user signed in and use truthful request/status wording.

This is unstarted mobile work with no mobile phase number or spec yet; the producer's "Phase 24" is **not** an Android phase number. Next authorized implementation should first persist a bounded mobile spec from `../contracts/api.md`, `enums.md`, `CHANGELOG.md`, and the full September 7 INBOX thread. Do not invoke the existing destructive-success cleanup after submitting a request. Boot reports `PHASE NONE` for this newly identified unnumbered work instead of fabricating a phase or restarting a completed one.

Backend live `main` was `99df14b5cd8cf0e321dbcf662e1fa3e2941f999a`; live `Shivam` was `338724b317f4944569b498e9fa183f01792c71ed`. The request-flow commit `65e3894f28ab79ef56d5a5ead90882c6a7ef1989` was on `Shivam`, absent `main`. Earlier backend work through Phase 133 is represented on main, superseding the old `0324dfc` merge-blocker claim. No current production deployment, voice readiness, secret rotation, ownership backfill, or handset rollout was verified by this setup. Those need separate evidence; authentication middleware returning 401 is insufficient.

The full open-mobile INBOX review found many completed/no-consumer FYIs with unticked shared boxes, plus device/runtime checks still outstanding. Source confirms the existing export, voice-status budget, auto-closed attendance display, and foreground layout refresh are implemented. None of those were reimplemented or marked externally complete. INBOX content was unchanged throughout the review. Phase 99 remains the historical owner-held rollout scope; Phase Ω is still gated by unfinished/device-unverified work.

These are dated observations, not permanent branch hashes or future authorization. Rediscover current state at the next boot. No application tests, builds, uploads, commits, pushes, merges, or deployments ran during adoption.

## Compatibility and maintenance

Implementation continuation on September 7 supersedes only the initialization
snapshot's unstarted-work status: the owner's subsequent “go for all the pending
phases and complete everything” authorized implementation. Mobile Phases 100–119
are now recorded on the board, and the owner explicitly approved translations for
the remaining pending scope. Follow the current board/handoff for progress; the
initialization evidence above remains a dated record of what setup itself did.

- No global Codex settings, permissions, model configuration, hooks, or plugin installations were changed. Claude settings were inspected only for integration metadata; no hooks/installers/downloaded scripts ran.
- Local Claude settings name `expo@claude-plugins-official`, but its definition was not found at the identified local marketplace path and the local installed-plugin registry contains no entries. An enabled setting is not proof it is usable in Codex.
- `gh` and `graphify` were not on PATH at adoption. Use available capabilities when a task requires them; do not claim unavailable CLI/MCP/browser/device integrations work or install them as a setup side effect.
- Commands/skills remain file-based guidance. Preserve `CLAUDE.md`, original command/skill files, and Claude project memory. Rediscover missing paths and disclose limitations; if persistence is unavailable, apply the workflow only in conversation and say so.
- Idempotent updates: replace the existing block between `BEGIN/END CODEX WORKFLOW BRIDGE` in AGENTS and this document's `BEGIN/END CODEX WORKFLOW` markers. Do not append duplicates or replace unmanaged content. Verify markers, references, preserved user edits, and the final diff after writing.

<!-- END CODEX WORKFLOW -->
