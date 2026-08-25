/**
 * The ONE builder for the local clock-in marker's AsyncStorage key.
 *
 * The Home clock ring WRITES a small `{ in, time, place }` marker under this key; the My-Attendance
 * "Today" card and the master agent-map "My check-in" section READ it. It is scoped per USER (not per
 * device) so a shared handset never shows one person's clock state to the next — the same shared-handset
 * correctness the 2026-08-21 audit hardened elsewhere.
 *
 * It lives here, alone, because the writer and the readers had DRIFTED: Home moved to the per-user key
 * `clock.<userId>.<date>` while `attendance.tsx` / `agent-map.tsx` still read the old device-scoped
 * `clock.<date>` that nothing writes any more — so a clocked-in day rendered "Not clocked in" (loophole
 * audit round 3, 2026-08-25). Keeping the builder in one place means the two can never silently diverge
 * again. Pure + tested; `date` is a parameter so the key is deterministic under test.
 */
export function clockKeyFor(userId: string | null | undefined, date: Date = new Date()): string {
  return `clock.${userId || 'anon'}.${date.toDateString()}`;
}
