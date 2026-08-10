/**
 * PHASE 10. This module used to hold the app's entire sample corpus: fabricated clients,
 * leads, claims, reminders, WhatsApp threads, notifications, commissions, contests and LIC
 * plans, all with realistic Gujarati names and rupee amounts.
 *
 * It is retained as an empty module rather than deleted so the file's history and any
 * stale import path resolve to nothing instead of a build error. NOTHING imports it, and a
 * string probe of the exported Hermes bundle confirms none of its records ship.
 *
 * Do not repopulate it. A failed request must resolve empty and report through
 * src/data/health.ts so the UI can say 'could not load' rather than showing invented
 * policyholders and invented premium figures to a field agent.
 */
export {};
