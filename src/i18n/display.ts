import type { TFn } from '@/i18n';

// Canonical category values are persisted and sent to the API. Translate only labels;
// unknown/custom server categories remain the text the author supplied.
const TASK_CATEGORY_KEYS: Record<string, string> = {
  'Follow-up': 'task.followUp', Claim: 'task.categoryClaim', Renewal: 'task.categoryRenewal',
  Meeting: 'stage.meeting', Documentation: 'task.categoryDocumentation',
  Collection: 'task.categoryCollection', Training: 'task.categoryTraining', General: 'task.categoryGeneral',
};

export function taskCategoryLabel(t: TFn, value: string): string {
  return TASK_CATEGORY_KEYS[value] ? t(TASK_CATEGORY_KEYS[value]) : value;
}

const CLAIM_TYPE_KEYS: Record<string, string> = {
  Health: 'claim.typeHealth', Death: 'claim.typeDeath', Maturity: 'client.maturity',
  Surrender: 'claim.typeSurrender', Accident: 'claim.typeAccident',
};

export function claimTypeLabel(t: TFn, value: string): string {
  return CLAIM_TYPE_KEYS[value] ? t(CLAIM_TYPE_KEYS[value]) : value;
}

const FREQUENCY_KEYS: Record<string, string> = {
  Yearly: 'policy.frequencyYearly', 'Half-Yearly': 'policy.frequencyHalfYearly',
  Quarterly: 'policy.frequencyQuarterly', Monthly: 'policy.frequencyMonthly',
};
export function policyFrequencyLabel(t: TFn, value: string): string {
  return FREQUENCY_KEYS[value] ? t(FREQUENCY_KEYS[value]) : value;
}

const ROLE_KEYS: Record<string, string> = {
  advisor: 'role.valueAdvisor', learn_advisor: 'role.valueLearnAdvisor',
  leader: 'role.valueLeader', admin: 'role.valueAdmin',
  payroll_staff: 'role.valuePayrollStaff', super_admin: 'role.valueSuperAdmin',
};
export function roleLabel(t: TFn, value: string): string {
  return ROLE_KEYS[value] ? t(ROLE_KEYS[value]) : value.replace(/_/g, ' ');
}

// These maps affect presentation only; API values remain canonical.
const TICKET_LABEL_KEYS: Record<string, Record<string, string>> = {
  "type": {
    "claim": "task.categoryClaim",
    "lead": "prospect.stageLead",
    "investment": "ticket.typeInvestment",
    "policy_review": "ticket.typePolicyReview",
    "renewal": "task.categoryRenewal",
    "maturity": "client.maturity",
    "service": "ticket.typeService",
    "call": "common.call",
    "complaint": "ticket.typeComplaint",
    "other": "ticket.typeOther"
  },
  "status": {
    "new": "stage.new",
    "new_inquiry": "ticket.statusNewInquiry",
    "open": "search.openLabel",
    "assigned": "ticket.statusAssigned",
    "in_progress": "taskStatus.inProgress",
    "working": "ticket.statusWorking",
    "awaiting_customer": "ticket.statusAwaitingCustomer",
    "awaiting_docs": "ticket.statusAwaitingDocs",
    "pending": "claims.pending",
    "on_hold": "ticket.statusOnHold",
    "resolved": "ticket.statusResolved",
    "done": "taskStatus.done",
    "completed": "task.completedLabel",
    "closed": "search.closedLabel",
    "cancelled": "ticket.statusCancelled",
    "canceled": "ticket.statusCanceled",
    "lost": "stage.lost",
    "rejected": "claimStatus.rejected"
  },
  "zone": {
    "red": "ticket.zoneRed",
    "amber": "ticket.zoneAmber",
    "green": "ticket.zoneGreen"
  },
  "source": {
    "admin": "more.adminLabel",
    "client": "task.clientLabel"
  },
  "channel": {
    "whatsapp": "common.whatsapp",
    "admin_panel": "ticket.channelAdminPanel"
  },
  "assignment": {
    "assigned": "ticket.statusAssigned",
    "unassigned": "task.unassignedLabel"
  }
};

export function ticketLabel(t: TFn, domain: keyof typeof TICKET_LABEL_KEYS, value: string, fallback?: string | null): string {
  const key = TICKET_LABEL_KEYS[domain]?.[value.toLowerCase()];
  return key ? t(key) : fallback || value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function whatsappTagLabel(t: TFn, value: string): string {
  return value === 'custom' ? t('waThread.tagCustom') : value === 'chat' ? t('waThread.tagChat') : value;
}
