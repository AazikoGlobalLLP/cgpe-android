import type { ClaimStatus, LeadStage } from './types';

export const STAGE_META: Record<LeadStage, { label: string; tone: any }> = {
  new: { label: 'New', tone: 'info' },
  contacted: { label: 'Contacted', tone: 'primary' },
  meeting: { label: 'Meeting', tone: 'accent' },
  proposal: { label: 'Proposal', tone: 'warning' },
  closed_won: { label: 'Won', tone: 'success' },
  closed_lost: { label: 'Lost', tone: 'danger' },
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
