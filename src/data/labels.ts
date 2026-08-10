import type { ClaimStatus, LeadStage } from './types';

/**
 * PHASE 4: keyed by `Lead.status`, so the key is the wire value and the label is only ever copy.
 * Declaration order is the funnel order the server's own enum uses.
 * `Record<LeadStage, …>` is exhaustive on purpose — it is what makes a vocabulary change a
 * compile error in all four screens rather than a blank pill at runtime.
 */
export const STAGE_META: Record<LeadStage, { label: string; tone: any }> = {
  new_lead: { label: 'New', tone: 'info' },
  meeting_scheduled: { label: 'Meeting', tone: 'accent' },
  docs_shared: { label: 'Docs shared', tone: 'warning' },
  policy_issued: { label: 'Policy issued', tone: 'success' },
  lost: { label: 'Lost', tone: 'danger' },
};

export const PRIORITY_TONE: Record<string, any> = { hot: 'danger', warm: 'warning', cold: 'neutral' };

export const CLAIM_STATUS: Record<ClaimStatus, { label: string; tone: any }> = {
  intake: { label: 'Intake', tone: 'neutral' },
  docs_pending: { label: 'Docs pending', tone: 'warning' },
  under_review: { label: 'Under review', tone: 'info' },
  submitted: { label: 'Submitted', tone: 'primary' },
  settled: { label: 'Settled', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

export const SEG_META: Record<string, { label: string; tone: any; icon: any }> = {
  renewal_due: { label: 'Renewal due', tone: 'warning', icon: 'refresh-circle' },
  maturity_soon: { label: 'Maturity soon', tone: 'info', icon: 'cash' },
  birthday: { label: 'Birthday', tone: 'accent', icon: 'gift' },
  cross_sell: { label: 'Cross-sell', tone: 'primary', icon: 'trending-up' },
  hot_lead: { label: 'Hot', tone: 'danger', icon: 'flame' },
};

export const REMINDER_ICON: Record<string, any> = {
  birthday: 'gift', anniversary: 'heart', renewal: 'refresh-circle',
  maturity: 'cash', followup: 'call', meeting: 'people',
};
