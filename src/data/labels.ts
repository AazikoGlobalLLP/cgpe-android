import type { ClaimStatus, LeadStage } from './types';
import type { TKey } from '@/i18n';

/**
 * PHASE 77 — these maps hold an i18n KEY, not a sentence.
 *
 * The field is deliberately named `labelKey` rather than `label`: renaming it turned every one of
 * the ~25 call sites into a COMPILE ERROR, which is the only reliable way to be sure none was left
 * rendering a raw key like "stage.new" to a user. `label: string` → `labelKey: string` would have
 * type-checked silently and shipped the keys as visible text.
 *
 * These 24 words render on Home, Leads, Claims, Tasks AND Search simultaneously, so they are the
 * highest-visibility-per-word copy in the app. Owner-supplied in all five languages 2026-08-26.
 */
type LabelKey = TKey;

/**
 * PHASE 4: keyed by `Lead.status`, so the key is the wire value and the label is only ever copy.
 * Declaration order is the funnel order the server's own enum uses.
 * `Record<LeadStage, …>` is exhaustive on purpose — it is what makes a vocabulary change a
 * compile error in all four screens rather than a blank pill at runtime.
 */
export const STAGE_META: Record<LeadStage, { labelKey: LabelKey; tone: any }> = {
  new_lead: { labelKey: 'stage.new', tone: 'info' },
  meeting_scheduled: { labelKey: 'stage.meeting', tone: 'accent' },
  docs_shared: { labelKey: 'stage.docsShared', tone: 'warning' },
  policy_issued: { labelKey: 'stage.policyIssued', tone: 'success' },
  lost: { labelKey: 'stage.lost', tone: 'danger' },
};

export const PRIORITY_TONE: Record<string, any> = { hot: 'danger', warm: 'warning', cold: 'neutral' };

export const CLAIM_STATUS: Record<ClaimStatus, { labelKey: LabelKey; tone: any }> = {
  intake: { labelKey: 'claimStatus.intake', tone: 'neutral' },
  docs_pending: { labelKey: 'claimStatus.docsPending', tone: 'warning' },
  under_review: { labelKey: 'claimStatus.review', tone: 'info' },
  submitted: { labelKey: 'claimStatus.submitted', tone: 'primary' },
  settled: { labelKey: 'claimStatus.settled', tone: 'success' },
  rejected: { labelKey: 'claimStatus.rejected', tone: 'danger' },
};

export const SEG_META: Record<string, { labelKey: LabelKey; tone: any; icon: any }> = {
  renewal_due: { labelKey: 'seg.renewal', tone: 'warning', icon: 'refresh-circle' },
  maturity_soon: { labelKey: 'seg.maturity', tone: 'info', icon: 'cash' },
  birthday: { labelKey: 'seg.birthday', tone: 'accent', icon: 'gift' },
  cross_sell: { labelKey: 'seg.crossSell', tone: 'primary', icon: 'trending-up' },
  hot_lead: { labelKey: 'seg.hot', tone: 'danger', icon: 'flame' },
};

export const REMINDER_ICON: Record<string, any> = {
  birthday: 'gift', anniversary: 'heart', renewal: 'refresh-circle',
  maturity: 'cash', followup: 'call', meeting: 'people',
};
