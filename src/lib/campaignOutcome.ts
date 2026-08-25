/**
 * The pure mapping from a `sendCampaign()` result to the terminal fields of a background Job
 * (`src/store/jobs.tsx`). Extracted as a leaf so the ONE rule that used to be wrong on the
 * audience path — **a 403 role refusal is a COMPLETED job that delivered nothing, never a
 * system failure** — is unit-tested once and applied identically on both send paths
 * (renewals and the audience occasions). Before this, the renewal path handled `needsRole`
 * and the audience path did not, so a birthday/anniversary/maturity refusal was flattened to
 * `status:'failed'` and shown to the advisor as a red "Dispatch failed" (Band 2 #6, 2026-08-24).
 *
 * Pure: no React, no native imports, safe to reach from the Vitest graph without a stub.
 */

export type CampaignSendResult = {
  ok: boolean;
  /**
   * The server's confirmed dispatched count. OPTIONAL on purpose: `undefined` means "the server said
   * ok but returned no number" (fall back to the audience size), while an explicit `0` means "ok, but
   * zero recipients were actually dispatched" (opt-in/dedup/cap filtered them all — the backend returns
   * `{success:true, data:{count:0}}` for this). Collapsing the two would report the whole audience as
   * sent when nobody was (loophole audit round 3, 2026-08-25).
   */
  count?: number;
  message?: string;
  /** The server refused the bulk send for this role (a 403 from /campaigns/send). */
  needsRole?: boolean;
};

export type CampaignOutcome = {
  /** A refusal is terminal-but-not-a-failure, so it is `done`, never `failed`. */
  status: 'done' | 'failed';
  needsRole: boolean;
  /** Confirmed deliveries. A refusal delivered nothing, so this is 0. */
  sent: number;
  /** A refusal is an informational outcome, not an error line. */
  logState: 'info' | 'error';
  logText: string;
};

/**
 * @param res    the resolved `sendCampaign()` value
 * @param total  the audience size the job was dispatching to (for the success `sent` fallback)
 */
export function campaignOutcome(res: CampaignSendResult, total: number): CampaignOutcome {
  const needsRole = !!res.needsRole;
  // A role refusal is `done` (the job reached a real, terminal answer), not `failed`. Only a
  // genuine non-role failure — a 5xx, a thrown network error — is a failure.
  const status: 'done' | 'failed' = res.ok || needsRole ? 'done' : 'failed';
  // The server's own confirmed count when it returned one (INCLUDING an explicit 0 = "ok, nobody was
  // dispatched"); the whole audience only when it said ok with NO number; zero when it refused/failed.
  // `typeof` — not `||` — so an explicit 0 is honoured instead of falling back to the whole audience
  // and falsely claiming everyone was messaged (loophole audit round 3, 2026-08-25).
  const sent = typeof res.count === 'number' ? res.count : (res.ok ? total : 0);
  const logState: 'info' | 'error' = res.ok || needsRole ? 'info' : 'error';
  const logText = needsRole
    ? 'Bulk send blocked for this role.'
    : (res.message || (res.ok ? 'Campaign dispatched.' : 'Send failed.'));
  return { status, needsRole, sent, logState, logText };
}
