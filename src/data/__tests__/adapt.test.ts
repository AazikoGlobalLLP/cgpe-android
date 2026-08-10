/**
 * PHASE 2 — the `adapt.ts` mappers pinned.
 *
 * These functions stand between raw Mongo documents (a mix of the lic-import schema and the app
 * schema, with ~54 of the backend's collections having no schema at all) and every typed value
 * the UI renders. They synthesise four things outright — client segments, claim documents, the
 * claim timeline and lead notes — and they are the only validation the app performs on that data.
 *
 * EVERY EXPECTATION HERE PINS TODAY'S BEHAVIOUR, including the wrong bits. Cases that freeze a
 * known bug say so and live in their own describe block. See docs/spec/PHASE-2.md row 5.
 *
 * src/data/adapt.ts imports only types, so this file needs no stub and no environment.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adaptClaim, adaptClient, adaptLead, adaptNotification, adaptReminder,
  adaptUser, adaptWaMessage, adaptWaThread,
  dayMatches, isBirthdayThisMonth, isBirthdayToday, isPremiumDueThisMonth, monthMatches,
} from '@/data/adapt';
import type { Client } from '@/data/types';

/** Frozen "now" for every clock-dependent mapper. Local time, so it is TZ-independent. */
const NOW = new Date(2026, 2, 15, 12, 0, 0); // 15 March 2026, 12:00 local
const DAY = 86400000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

/* ------------------------------------------------------------ date predicates */

describe('monthMatches / dayMatches', () => {
  it('matches the same calendar month in a DIFFERENT year', () => {
    // adapt.ts:41 compares only getMonth(); the year is never compared, by design
    // (the comment at adapt.ts:38 says "any year").
    expect(monthMatches('2019-03-01', NOW)).toBe(true);
  });

  it('does not match a different month', () => {
    expect(monthMatches('2019-04-01', NOW)).toBe(false);
  });

  it('returns false for the empty string that iso() produces', () => {
    // The common real case: iso() (adapt.ts:20-22) turns every unparseable date into '',
    // so an adapted Client with no dob reaches here as '' and must read as "no match",
    // not as "epoch".
    expect(monthMatches('', NOW)).toBe(false);
  });

  it('returns false for undefined, null and an unparseable string', () => {
    expect(monthMatches(undefined, NOW)).toBe(false);
    expect(monthMatches(null, NOW)).toBe(false);
    expect(monthMatches('garbage', NOW)).toBe(false);
  });

  it('returns false for a time-only string', () => {
    // NOTE the mechanism: monthMatches uses the raw `new Date` constructor, NOT parseDate,
    // so it is the isNaN guard at adapt.ts:41 catching this, not parseDate's explicit
    // time-only reject at adapt.ts:16. Same answer, different code path.
    expect(monthMatches('10:30', NOW)).toBe(false);
  });

  it('accepts a Date instance', () => {
    expect(monthMatches(new Date(2019, 2, 1), NOW)).toBe(true);
  });

  it('dayMatches requires month AND day, across years', () => {
    expect(dayMatches(new Date(2019, 2, 15), NOW)).toBe(true);
    expect(dayMatches(new Date(2019, 2, 14), NOW)).toBe(false);
    expect(dayMatches(new Date(2019, 3, 15), NOW)).toBe(false);
  });

  it('dayMatches reads LOCAL calendar fields, not UTC ones', () => {
    // Built from local components on purpose: the ISO string a real record carries is UTC,
    // and dayMatches compares getDate() in local time — so a dob stored near midnight UTC
    // can fire a day early or late depending on the device timezone. This asserts the local
    // reading without hardcoding an offset.
    const lateInTheLocalDay = new Date(2019, 2, 15, 23, 30, 0);
    expect(dayMatches(lateInTheLocalDay, NOW)).toBe(true);
    expect(dayMatches(lateInTheLocalDay.toISOString(), NOW)).toBe(true);
  });
});

describe('isPremiumDueThisMonth / isBirthdayThisMonth / isBirthdayToday', () => {
  it('is false when the client has no policies at all', () => {
    expect(isPremiumDueThisMonth({ policies: [] } as unknown as Client, NOW)).toBe(false);
  });

  it('reads ONLY policies[0] and ignores a due policies[1]', () => {
    // adapt.ts:50 indexes [0] with no scan. A multi-policy client whose SECOND policy is due
    // this month reads as not due. Pins current behaviour — in practice adaptClient always
    // emits exactly one policy (adapt.ts:113), which is why this has never surfaced.
    const c = { policies: [{ nextRenewal: '' }, { nextRenewal: '2019-03-01' }] } as unknown as Client;
    expect(isPremiumDueThisMonth(c, NOW)).toBe(false);
  });

  it('is true when policies[0].nextRenewal falls in the reference month', () => {
    const c = { policies: [{ nextRenewal: '2019-03-01' }] } as unknown as Client;
    expect(isPremiumDueThisMonth(c, NOW)).toBe(true);
  });

  it('birthday helpers are false for a client with no parseable dob', () => {
    expect(isBirthdayThisMonth({ dob: '' } as unknown as Client, NOW)).toBe(false);
    expect(isBirthdayToday({ dob: '' } as unknown as Client, NOW)).toBe(false);
  });

  it('isBirthdayThisMonth is true but isBirthdayToday is false on the wrong day', () => {
    const c = { dob: new Date(1990, 2, 20).toISOString() } as unknown as Client;
    expect(isBirthdayThisMonth(c, NOW)).toBe(true);
    expect(isBirthdayToday(c, NOW)).toBe(false);
  });
});

/* ----------------------------------------------------------------- adaptClient */

describe('adaptClient', () => {
  it('turns null into the all-default shape', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(adaptClient(null)).toEqual({
      id: 'Customer',
      name: 'Customer',
      phone: '',
      email: undefined,
      city: '',
      dob: '',
      family: undefined,
      totalPremium: 0,
      totalCover: 0,
      policies: [{
        id: '0.5',            // adapt.ts:84 falls through to String(Math.random())
        plan: 'LIC Policy',
        number: '-',
        sumAssured: 0,
        premium: 0,
        frequency: 'Yearly',
        startDate: '',
        maturityDate: '',
        nextRenewal: '',
        status: 'in_force',   // hardcoded; adaptClient can never emit any other status
      }],
      segment: ['cross_sell'],
      since: '-',
    });
  });

  it('maps a full lic-import record and stacks three segments', () => {
    const out = adaptClient({
      _id: 'c1',
      name: 'MCDONALD  raju',
      dob: '1990-03-20',
      fupDate: '2020-03-05',
      maturityDate: '2026-05-01',
      commencementDate: '2015-06-01',
      premium: 0,                       // a REAL zero
      premium_amount: 9999,             // must be ignored
      policy_details: { sum_assured: 500000, premium_frequency: 'MLY' },
      policyNo: ' P123 ',
      address: { city: ' Surat ' },
      phone: '98765-43210',
      email: '',
      mode: '',
    });

    expect(out).toEqual({
      id: 'c1',
      name: 'Mcdonald Raju',            // titleCase lowercases first, then re-capitalises
      phone: '+919876543210',
      email: undefined,                 // '' || undefined
      city: 'Surat',
      dob: '1990-03-20T00:00:00.000Z',
      family: undefined,
      totalPremium: 0,                  // the `!= null` guard preserves a real zero
      totalCover: 500000,
      policies: [{
        id: 'P123',
        plan: 'LIC Policy',
        number: 'P123',
        sumAssured: 500000,
        premium: 0,
        frequency: 'MLY',               // written unvalidated into a 4-value union
        startDate: '2015-06-01T00:00:00.000Z',
        maturityDate: '2026-05-01T00:00:00.000Z',
        nextRenewal: '2020-03-05T00:00:00.000Z',
        status: 'in_force',
      }],
      segment: ['renewal_due', 'birthday', 'maturity_soon'],
      since: '2015',
    });
  });

  it('falls back to cross_sell only when the other three segments all miss', () => {
    const out = adaptClient({
      _id: 'c2', name: 'raju', dob: '1990-07-20', fupDate: '2020-08-05',
      maturityDate: new Date(2030, 0, 1),
    });
    expect(out.segment).toEqual(['cross_sell']);
  });

  it('includes maturity_soon at exactly 90 days and drops it at 91', () => {
    // adapt.ts:100 `matDays <= 90` is INCLUSIVE. Dates are built from local components so the
    // day count is exact in any timezone.
    const at90 = adaptClient({ _id: 'c3', name: 'x', maturityDate: new Date(2026, 5, 13) });
    const at91 = adaptClient({ _id: 'c4', name: 'x', maturityDate: new Date(2026, 5, 14) });
    expect(at90.segment).toEqual(['maturity_soon']);
    expect(at91.segment).toEqual(['cross_sell']);
  });

  it('excludes a maturity date that has already passed', () => {
    // `matDays >= 0` — a matured policy is not "maturing soon".
    const out = adaptClient({ _id: 'c5', name: 'x', maturityDate: new Date(2026, 2, 14) });
    expect(out.segment).toEqual(['cross_sell']);
  });

  it('skips a too-short phone candidate and keeps scanning the rest', () => {
    // adapt.ts:28-36: a 5-digit value matches neither the ===10 nor the 11..15 rule, so the
    // loop CONTINUES to `mobile` instead of returning ''. Easy to break in a refactor.
    expect(adaptClient({ _id: 'c6', phone: '12345', mobile: '9876543210' }).phone)
      .toBe('+919876543210');
  });

  it('prefixes a bare + on an 11-to-15 digit number and gives up outside that range', () => {
    expect(adaptClient({ _id: 'c7', phone: '919876543210' }).phone).toBe('+919876543210');
    expect(adaptClient({ _id: 'c8', phone: '1234567890123456' }).phone).toBe('');
  });

  it('defaults the name to Customer when every candidate is blank', () => {
    expect(adaptClient({ _id: 'c9', name: '   ' }).name).toBe('Customer');
  });
});

/* ------------------------------------------------------------------- adaptUser */

describe('adaptUser', () => {
  it('turns null into every literal default, and never sets photo', () => {
    expect(adaptUser(null)).toEqual({
      id: 'u1', name: 'Advisor', email: '', phone: '', role: 'advisor',
      designation: 'Advisor', branch: '', agentCode: '', tier: 'Growth',
    });
    // `photo` is optional on User but adaptUser never assigns it, so the key is genuinely
    // ABSENT rather than present-and-undefined.
    expect('photo' in adaptUser({})).toBe(false);
  });

  it('prefers user_id over _id over id', () => {
    expect(adaptUser({ user_id: 'a', _id: 'b', id: 'c' }).id).toBe('a');
    expect(adaptUser({ _id: 'b', id: 'c' }).id).toBe('b');
  });
});

/* ------------------------------------------------------------------- adaptLead */

describe('adaptLead', () => {
  it('stamps createdAt and lastActivity from the clock when the record has neither', () => {
    const out = adaptLead({ _id: 'l0' });
    expect(out.createdAt).toBe(NOW.toISOString());
    expect(out.lastActivity).toBe(NOW.toISOString());
  });

  it('wraps a free-text notes STRING into one synthetic note', () => {
    // The most load-bearing synthesis in the file (adapt.ts:161-165).
    const out = adaptLead({
      _id: 'l1',
      notes: '  Budget: Rs 50,000 for term plan  ',
      updatedAt: '2026-01-02T00:00:00.000Z',
      probability: 29,
    });
    expect(out.notes).toEqual([{
      id: 'n0',                                     // hardcoded, not positional
      text: 'Budget: Rs 50,000 for term plan',      // TRIMMED
      at: '2026-01-02T00:00:00.000Z',               // BORROWED from the lead's updatedAt
    }]);
    // ...while `interest` takes the same string UNTRIMMED (adapt.ts:176). The two
    // deliberately disagree.
    expect(out.interest).toBe('  Budget: Rs 50,000 for term plan  ');
    expect(out.potential).toBe(50000);              // parsed out of the note text
    expect(out.priority).toBe('cold');
    expect(out.lastActivity).toBe('2026-01-02T00:00:00.000Z');
  });

  it('maps a notes ARRAY positionally, junk entries included', () => {
    const out = adaptLead({
      _id: 'l2',
      notes: [{ text: 'a' }, { _id: 'x', text: 'b', at: 'T' }, { foo: 1 }],
      probability: 70,
    });
    expect(out.notes).toEqual([
      { id: '0', text: 'a', at: '' },               // no _id -> positional index as a string
      { id: 'x', text: 'b', at: 'T' },
      { id: '2', text: '[object Object]', at: '' }, // no `text` -> String(n)
    ]);
    expect(out.priority).toBe('hot');
  });

  it('parses a budget from free text only with a currency or keyword prefix', () => {
    expect(adaptLead({ _id: 'l3', interest: 'budget 50k' }).potential).toBe(50000);
    expect(adaptLead({ _id: 'l4', interest: '₹2 lakh' }).potential).toBe(200000);
    expect(adaptLead({ _id: 'l5', interest: 'Rs 1,50,000' }).potential).toBe(150000);
  });

  it('prefers an explicit potential over anything parsed from text', () => {
    expect(adaptLead({ _id: 'l6', potential: 12345, interest: 'budget 50k' }).potential)
      .toBe(12345);
  });

  it('fences both priority thresholds', () => {
    // adapt.ts:179 — `prob >= 70` is inclusive, `prob < 30` is exclusive.
    expect(adaptLead({ _id: 'p1', probability: 29 }).priority).toBe('cold');
    expect(adaptLead({ _id: 'p2', probability: 30 }).priority).toBe('warm');
    expect(adaptLead({ _id: 'p3', probability: 69 }).priority).toBe('warm');
    expect(adaptLead({ _id: 'p4', probability: 70 }).priority).toBe('hot');
  });

  it('lets an explicit priority beat the probability ladder', () => {
    expect(adaptLead({ _id: 'p5', probability: 90, priority: 'cold' }).priority).toBe('cold');
  });

  it('normalises a 10-digit phoneLast10 but passes raw.phone through untouched', () => {
    expect(adaptLead({ _id: 'l7', phoneLast10: '98765-43210' }).phone).toBe('+919876543210');
    // A truthy raw.phone wins and is only String()'d — never given a +91, unlike pickPhone.
    expect(adaptLead({ _id: 'l8', phone: 9876543210, phoneLast10: '1234567890' }).phone)
      .toBe('9876543210');
    // An 11-digit phoneLast10 yields '' — there is no bare-'+' fallback here.
    expect(adaptLead({ _id: 'l9', phoneLast10: '91987654321' }).phone).toBe('');
  });

  it('maps the lead stage vocabulary it does recognise', () => {
    expect(adaptLead({ _id: 's1', stage: 'closed_won' }).stage).toBe('closed_won');
    expect(adaptLead({ _id: 's2', stage: 'lost' }).stage).toBe('closed_lost');
    expect(adaptLead({ _id: 's3', stage: 'proposal sent' }).stage).toBe('proposal');
    expect(adaptLead({ _id: 's4', stage: 'meeting_scheduled' }).stage).toBe('meeting');
    expect(adaptLead({ _id: 's5', stage: 'follow_up' }).stage).toBe('contacted');
    expect(adaptLead({ _id: 's6', status: 'new_lead' }).stage).toBe('new');
  });
});

/* ------------------------------------------------------------------ adaptClaim */

describe('adaptClaim', () => {
  it('turns null into the all-default claim with an EMPTY timeline', () => {
    expect(adaptClaim(null)).toEqual({
      id: 'undefined',
      ref: '',
      clientName: 'Claimant',
      clientPhone: '',
      type: 'Health',
      policyNumber: '',
      amount: 0,
      status: 'under_review',
      insurer: 'LIC of India',
      openedAt: '',
      ageDays: 0,
      docs: [],
      timeline: [],          // the synthetic 't0' event is guarded on `created`
      aiSummary: undefined,
    });
  });

  it('synthesises a "Claim registered" timeline event when there is no status_history', () => {
    const created = new Date(Date.now() - 10 * DAY).toISOString();
    const out = adaptClaim({ id: 'cl1', status: 'in_process', created_at: created });
    expect(out.timeline).toEqual([
      { id: 't0', label: 'Claim registered', at: created, by: 'System' },
    ]);
    expect(out.openedAt).toBe(created);
    expect(out.ageDays).toBe(10);
  });

  it('lets a single blank status_history entry suppress the synthetic event', () => {
    const out = adaptClaim({
      id: 'cl2', status_history: [{}], created_at: new Date(Date.now() - DAY).toISOString(),
    });
    expect(out.timeline).toEqual([{ id: '0', label: 'Update', at: '', by: 'System' }]);
  });

  it('rounds ageDays on the raw millisecond difference, with no midnight normalisation', () => {
    const at = (hoursAgo: number) =>
      adaptClaim({ id: 'x', created_at: new Date(Date.now() - hoursAgo * 3600000).toISOString() }).ageDays;
    expect(at(12)).toBe(1);   // Math.round(0.5)
    expect(at(11)).toBe(0);
  });

  it('clamps a future-dated claim to age 0', () => {
    const out = adaptClaim({ id: 'x', created_at: new Date(Date.now() + 5 * DAY).toISOString() });
    expect(out.ageDays).toBe(0);
  });

  it('inverts missing_info into unreceived documents, positionally', () => {
    const out = adaptClaim({ id: 'cl3', missing_info: ['PAN', 'Bill'] });
    expect(out.docs).toEqual([
      { id: 'd0', name: 'PAN', received: false },
      { id: 'd1', name: 'Bill', received: false },
    ]);
  });

  it('collapses documents_received into one synthetic "All required documents" row', () => {
    expect(adaptClaim({ id: 'cl4', documents_received: true }).docs).toEqual([
      { id: 'd0', name: 'All required documents', received: true },
    ]);
  });

  it('reaches docs_pending when the stage says so and no status regex matches', () => {
    // The one input shape that gets to adapt.ts:201 — proves the arm is live at all.
    expect(adaptClaim({ id: 'x', stage: 'document_collection' }).status).toBe('docs_pending');
  });

  it('maps claim types through an exact-key lookup', () => {
    expect(adaptClaim({ id: 'x', claim_type: 'motor' }).type).toBe('Accident');
    expect(adaptClaim({ id: 'x', claim_type: 'death' }).type).toBe('Death');
    expect(adaptClaim({ id: 'x', claim_type: 'MATURITY' }).type).toBe('Maturity');
    expect(adaptClaim({ id: 'x', claim_type: 'not-a-type' }).type).toBe('Health');
  });

  it('preserves a genuine zero claim_amount instead of falling through', () => {
    // adapt.ts:214 uses `!= null`, not `||`. Would silently break if "simplified".
    expect(adaptClaim({ id: 'x', claim_amount: 0, claimable_amount: 5000 }).amount).toBe(0);
    expect(adaptClaim({ id: 'x', claimable_amount: 5000 }).amount).toBe(5000);
  });

  it('templates aiSummary from details.TPA as a last resort', () => {
    expect(adaptClaim({ id: 'x', details: { TPA: 'MediAssist' } }).aiSummary).toBe('TPA: MediAssist');
    expect(adaptClaim({ id: 'x', last_note: 'n', details: { TPA: 'M' } }).aiSummary).toBe('n');
    expect(adaptClaim({ id: 'x' }).aiSummary).toBeUndefined();
  });

  it('normalises the claimant phone through a one-key synthetic object', () => {
    expect(adaptClaim({ id: 'x', claimant: { phone: '+91 98765 43210' } }).clientPhone)
      .toBe('+919876543210');
  });
});

/* --------------------------------------------------------------- WhatsApp */

describe('adaptWaThread / adaptWaMessage', () => {
  it('gives a null thread an EMPTY-STRING id, unlike every other adapter', () => {
    // adapt.ts:250 ends its chain in p10 (''), so this one does NOT produce the string
    // 'undefined' that adaptLead / adaptClaim / adaptReminder / adaptNotification do.
    expect(adaptWaThread(null)).toEqual({
      id: '', name: 'WhatsApp user', phone: '', lastMessage: '', lastAt: '',
      unread: 0, tag: undefined, messages: [],
    });
  });

  it('normalises a 10-digit thread phone to +91', () => {
    expect(adaptWaThread({ phone_last10: '98765-43210' }).phone).toBe('+919876543210');
  });

  it('defaults an unlabelled message to fromMe', () => {
    // adapt.ts:264 — the DEFAULT is outbound, so a direction-less inbound message renders
    // as sent by the advisor.
    expect(adaptWaMessage({ id: 'm1' })).toEqual({ id: 'm1', fromMe: true, text: '', at: '' });
    expect(adaptWaMessage({ id: 'm2', direction: 'inbound' }).fromMe).toBe(false);
  });
});

/* -------------------------------------------------------- Reminders / notifications */

describe('adaptReminder', () => {
  it('turns null into every literal default', () => {
    expect(adaptReminder(null)).toEqual({
      id: 'undefined', type: 'followup', title: 'Reminder', subtitle: '',
      clientName: undefined, phone: undefined,
      date: '',   // NOT normalised through parseDate/iso — whatever the backend sent, verbatim
      done: false,
    });
  });

  it('lower-cases the type key before the lookup', () => {
    expect(adaptReminder({ _id: 'r1', type: 'Birthday' }).type).toBe('birthday');
    expect(adaptReminder({ _id: 'r2', type: 'event' }).type).toBe('meeting');
    expect(adaptReminder({ _id: 'r3', type: 'nonsense' }).type).toBe('followup');
  });

  it('duplicates raw.message into both title and subtitle', () => {
    const out = adaptReminder({ _id: 'r4', message: 'hi' });
    expect(out.title).toBe('hi');
    expect(out.subtitle).toBe('hi');
  });

  it('reads the documented done vocabulary', () => {
    expect(adaptReminder({ _id: 'r5', status: 'done' }).done).toBe(true);
    expect(adaptReminder({ _id: 'r6', status: 'cancelled' }).done).toBe(true);
    expect(adaptReminder({ _id: 'r7', status: 'scheduled' }).done).toBe(false);
  });
});

describe('adaptNotification', () => {
  it('stops the ?? chain on an explicit read:false', () => {
    // adapt.ts:309 is the file's only nullish-coalescing operator. `false` is not nullish,
    // so is_read never gets a look-in. The cheapest guard against someone "simplifying" ?? to ||.
    expect(adaptNotification({ _id: 'n1', read: false, is_read: true }).read).toBe(false);
  });

  it('falls through to is_read only for null/undefined', () => {
    expect(adaptNotification({ _id: 'n2', read: null, is_read: true }).read).toBe(true);
    expect(adaptNotification({ _id: 'n3', is_read: true }).read).toBe(true);
  });

  it('collapses reminder and event notifications into system, icon included', () => {
    expect(adaptNotification({ _id: 'n4', type: 'reminder', message: 'm' })).toEqual({
      id: 'n4', icon: 'notifications', title: 'm', body: 'm', at: '', read: false, kind: 'system',
    });
    expect(adaptNotification({ _id: 'n5', type: 'event' }).kind).toBe('system');
    expect(adaptNotification({ _id: 'n6', type: 'claim' }).icon).toBe('shield-half');
  });
});

/* ------------------------------------------------------------------------------ */

describe('pinned known bugs — these must be updated deliberately when fixed', () => {
  it('mapLeadStage maps the real backend stage "policy_issued" to "new" [Phase 4]', () => {
    // A WON lead is indistinguishable from a brand-new one. 'policy_issued' matches none of
    // the five regexes at adapt.ts:148-152 and hits the `return 'new'` fallback.
    // docs/PHASES.md Phase 4 fixes this; when it does, THIS TEST GOING RED IS CORRECT.
    expect(adaptLead({ _id: 'b1', stage: 'policy_issued' }).stage).toBe('new');
    expect(adaptLead({ _id: 'b2', stage: 'docs_shared' }).stage).toBe('new');
  });

  it('mapLeadStage substring-matches unanchored, inverting two real values', () => {
    // /won|convert|closed_won/ is unanchored, so the NEGATION 'not_converted' contains
    // 'convert' and reads as won; 'unqualified' contains 'qualif' and reads as contacted.
    expect(adaptLead({ _id: 'b3', stage: 'not_converted' }).stage).toBe('closed_won');
    expect(adaptLead({ _id: 'b4', stage: 'unqualified' }).stage).toBe('contacted');
  });

  it('mapClaimStatus resolves partial_paid to settled, because of arm order', () => {
    // adaptClaim's own docstring (adapt.ts:205-206) names 'partial_paid' as a real backend
    // status, but /paid|settl|closed|pass/ at :197 fires before the /partial|.../ arm at :200.
    // A part-paid claim reads as fully settled.
    expect(adaptClaim({ id: 'b5', status: 'partial_paid' }).status).toBe('settled');
    // Same class: /closed/ wins over /reject/.
    expect(adaptClaim({ id: 'b6', status: 'closed_rejected' }).status).toBe('settled');
  });

  it('docs_pending is unreachable whenever any status regex also matches', () => {
    // 'in_process' matches /process/ at adapt.ts:200, so the docs_pending arm is skipped even
    // though the stage says document_collection AND two documents are missing.
    const out = adaptClaim({
      id: 'b7', status: 'in_process', stage: 'document_collection', missing_info: ['PAN'],
    });
    expect(out.status).toBe('under_review');
    expect(out.docs).toEqual([{ id: 'd0', name: 'PAN', received: false }]);
  });

  it('a STRING missing_info is discarded, and the claim then reports all documents received', () => {
    // adapt.ts:215 keeps only an array; the "everything received" row is emitted anyway.
    expect(adaptClaim({ id: 'b8', missing_info: 'PAN', documents_received: true }).docs)
      .toEqual([{ id: 'd0', name: 'All required documents', received: true }]);
  });

  it('the claim status "New Claim" does not reach the intake arm (exact equality, not regex)', () => {
    expect(adaptClaim({ id: 'b9', status: 'intake' }).status).toBe('intake');
    expect(adaptClaim({ id: 'b10', status: 'New Claim' }).status).toBe('under_review');
  });

  it('adaptReminder\'s done regex is case-SENSITIVE while its type lookup is not', () => {
    // adapt.ts:277 lower-cases the type; adapt.ts:278 does not lower-case the status and has
    // no /i flag. So 'Birthday' resolves but 'DONE' does not.
    const out = adaptReminder({ _id: 'b11', type: 'Birthday', status: 'DONE' });
    expect(out.type).toBe('birthday');
    expect(out.done).toBe(false);
  });

  it('adaptReminder marks "not_completed" as done, by substring match', () => {
    expect(adaptReminder({ _id: 'b12', status: 'not_completed' }).done).toBe(true);
  });

  it('adaptWaMessage is case-sensitive on direction, inverting the chat bubble', () => {
    // adapt.ts:264 compares strictly with no .toLowerCase(), unlike every other mapper here.
    expect(adaptWaMessage({ id: 'b13', direction: 'OUTBOUND' }).fromMe).toBe(false);
  });

  it('adaptWaThread gives a short phone a nonsense bare "+" prefix', () => {
    // adapt.ts:252 has no 11..15 length check, unlike pickPhone at :33.
    expect(adaptWaThread({ phone_last10: '123' }).phone).toBe('+123');
  });

  it('parseBudget requires the prefix its own docstring says is optional', () => {
    // The JSDoc at adapt.ts:134 advertises "50k", but the regex makes the
    // (?:budget|rs\.?|₹|inr) group MANDATORY.
    expect(adaptLead({ _id: 'b14', interest: '50k' }).potential).toBe(0);
    expect(adaptLead({ _id: 'b15', interest: 'budget 50k' }).potential).toBe(50000);
  });

  it('a lead, claim, reminder or notification with no identifier gets the STRING "undefined"', () => {
    // String(raw._id || raw.id || ...) with no '' fallback, in four separate adapters.
    expect(adaptLead({}).id).toBe('undefined');
    expect(adaptClaim({}).id).toBe('undefined');
    expect(adaptReminder({}).id).toBe('undefined');
    expect(adaptNotification({}).id).toBe('undefined');
  });

  it('adaptUser launders an invalid tier and a NUMERIC phone into string-typed fields', () => {
    // adapt.ts:130's cast lets lowercase 'growth' into a 'Star'|'MDRT'|'COT'|'TOT'|'Growth'
    // union; adapt.ts:125 has no String() wrapper, unlike id at :122.
    const out = adaptUser({ club: 'growth', phone: 9876543210 });
    expect(out.tier).toBe('growth');
    expect(out.phone).toStrictEqual(9876543210);
  });

  it('a STRING element in a notes array gets String.prototype.at as its timestamp', () => {
    // adapt.ts:162: `n.at` on a string primitive resolves to the built-in method, which is
    // truthy, so the || chain stops there. The note's `at` is a FUNCTION, which JSON.stringify
    // then silently drops.
    const note = adaptLead({ _id: 'b16', notes: ['plain'] }).notes[0];
    expect(note.id).toBe('0');
    expect(note.text).toBe('plain');
    expect(typeof note.at).toBe('function');
  });
});
