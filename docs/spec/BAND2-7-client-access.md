# Band 2 #7 — Client access is Master/Admin only (owner backlog Point 9)

**Date:** 2026-08-24 · **Status:** app-side gate shipped; backend relay filed (owner relays) · **Priority:** P1 (near-P0, PII).

## Owner decision (AskUserQuestion, 2026-08-24)
"What should a normal team member see in Clients?" → **Master/admin only.** Ordinary TEAM-tier users
get **no** Clients section at all; MASTER and the whole ADMIN tier (admin + leader, who run a branch)
keep the full book. This option needs **no** client-ownership data job (unlike own-only/team), because
team simply gets nothing.

## The predicate (single source of truth)
`src/store/roles.ts` — **`canViewClients(user, viewAs) = capabilitiesOf(user, viewAs).tier !== 'team'`**
(+6 tests in `roles.test.ts`). Unlike the location/performance/monitor/view-as gates (which read the
REAL role to fold `leader` OUT), this INCLUDES the whole admin tier and reads the view-as-aware tier —
so a Master previewing the team side correctly loses the book, and regains it on switch-back.

## App-side surfaces gated (this is defence-in-depth + honest UX; the server is the authority)
| Surface | File | How |
|---|---|---|
| Clients bottom tab | `(tabs)/_layout.tsx` | `order` drops `clients` when `!canViewClients` |
| More menu modules | `(tabs)/more.tsx` | flatMap drops `clients`/`segments`/`families`/`premium` |
| Home widgets | `(tabs)/home.tsx` | `bookHidden` filter drops `segments`/`families`/`campaigns`; `premium` quick-action dropped |
| Global search | `search.tsx` | skips the clients fetch + group + adjusts copy (search fetched clients independent of the hidden tab — a distinct leak) |
| Clients directory (screen) | `(tabs)/clients.tsx` | wrapper → `RestrictedNotice` |
| Client 360 (deep link) | `client/[id].tsx` | wrapper → `RestrictedNotice` (closes the deep-link vector) |
| Segments (screen) | `segments.tsx` | wrapper → `RestrictedNotice` |
| Families (screen) | `families.tsx` | wrapper → `RestrictedNotice` |
| **Campaigns (screen)** | `campaigns.tsx` | wrapper → `RestrictedNotice` — its **audience preview** rendered real client names/phones/premiums from the whole book (`scope=all`); the SEND was already 403'd for team but the preview was not. Caught by the adversarial review as a **HIGH** leak. |

Guard pattern: a thin wrapper (`export default function X()` calls `useAuth()` unconditionally, then
renders `<XScreen/>` or `<RestrictedNotice/>`), so the real screen's hooks are untouched (no
conditional-hooks hazard). Shared UI: `src/ui/RestrictedNotice.tsx`.

## Deliberately NOT gated (flagged for owner decision — genuinely separate surfaces)
- **WhatsApp hub** (`whatsapp/index.tsx`) — renders client conversation names/phones. Communication
  tool; threads may be the user's own. Owner call: gate for team, or keep?
- **Search → Tickets group** — tickets carry client name/phone, but tickets are a support queue, not
  the client book. Kept. Owner call.
- **Task contact sheet** (`task/[id].tsx`) — when a task has a client but no stored phone,
  `contactClient()` resolves that ONE client's phone from the book to let the assignee call them. This
  is task-scoped execution of the member's OWN assigned work (not book browsing). LOW-severity review
  finding; left in place so a team member can still contact the client on their own task. Owner call:
  operational (keep) vs strict (gate).

## Backend relay (filed to INBOX; owner relays) — the REAL security authority
`GET /clients` (`routes/clients.js:203`) and `GET /clients/:id` are `protect`-only, **no role gate**.
A team advisor's `visibilityScope` resolves to `mode:'own'` **non-strict** (`utils/scope.js:93`), and
non-strict includes `UNOWNED` (`:121,161`); the imported ~9,000-client book is overwhelmingly unowned,
so a team advisor reads essentially the whole book. Ask: **403 the team roles
(advisor/learn_advisor/payroll_staff) on the client-book reads; keep super_admin/admin/leader.** The
app now enforces the same rule client-side, so this closes the loop.

## Review + gates
Adversarial security review (`band2-7-client-access-review`, 4 lenses → refute-by-default verify):
raised 2, confirmed 2 — the campaigns HIGH leak (now gated) and the LOW task-contact finding (flagged,
left as operational). tsc 0 · npm test 902 (+6) · eslint 0 new errors.
