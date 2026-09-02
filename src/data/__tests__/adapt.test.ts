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
  adaptAttendanceHistory,
  adaptClaim, adaptClient, adaptContest, adaptLead, adaptLicPlan, adaptNotification, adaptReminder, annualFactor,
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
        status: 'in_force',   // no maturity date ⇒ can't be known matured ⇒ stays in_force
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

  it('marks a policy whose maturity date has passed as matured, not in_force', () => {
    // The reported bug: a policy that matured years ago (e.g. Mar 2023) still showed "In force"
    // because the status was hardcoded. NOW is 15 Mar 2026, so this maturity is ~3 years past.
    const past = adaptClient({ _id: 'c6', name: 'x', maturityDate: new Date(2023, 2, 1) });
    expect(past.policies[0].status).toBe('matured');

    // One day before NOW is still past ⇒ matured.
    const yesterday = adaptClient({ _id: 'c7', name: 'x', maturityDate: new Date(2026, 2, 14) });
    expect(yesterday.policies[0].status).toBe('matured');

    // A future maturity date is still in force.
    const future = adaptClient({ _id: 'c8', name: 'x', maturityDate: new Date(2030, 0, 1) });
    expect(future.policies[0].status).toBe('in_force');

    // No maturity date at all ⇒ cannot be known matured ⇒ stays in_force.
    const none = adaptClient({ _id: 'c9', name: 'x' });
    expect(none.policies[0].status).toBe('in_force');
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

/* --------------------------------------------- adaptClient · the merged `client` book
 *
 * Phase 97. The book moved from the `clients` collection to `client` (backend Phase 118),
 * and while the WIRE is byte-identical the DOCUMENTS are not: every LIC row now also
 * carries its merged LIXXX columns under the original capitalised headers. The fixture
 * below is the owner's own sample document, kept verbatim at
 * `docs/spec/PHASE-97-sample-client.json`; only `dataAnalysis` (a ~130-line per-row audit
 * blob with no reader in the app) is trimmed to the two figures that CORROBORATE the
 * mapping — the merge itself reconciled `annual_premium_sum` as the annual premium and
 * `No of Policies` as the policy count.
 *
 * ⚠️ `_id` and `updated_at` are written `{$oid}` / `{$date}` in the owner's copy because it
 * came out of Compass as extended JSON. The wire does NOT carry that shape — ObjectId
 * serialises to a plain hex string through `res.json` — so `_id` is the one field given
 * here as the app really receives it. Pinning `{$oid}` would pin `String(...)` =
 * "[object Object]" as the client id, i.e. a test of a shape that cannot occur.
 */
const OWNER_SAMPLE = {
  _id: '6a43b46141eaae0c6c9e69c1',
  policyNo: '863251055',
  name: 'AGRAWAT MUKESHKUMAR TULSIDAS',
  dob: '1969-03-15',
  commencementDate: '2002-02-28',
  fupDate: '2014-08-28',
  tableNo: '89',
  term: 16,
  ppt: 16,
  mode: 'Half-Yearly',
  ecs: 'NO',
  sumAssured: 50000,
  premium: 1821,
  maturityDate: '2018-02-28',
  lastPremiumPayingDate: '2017-02-28',
  fprDate: '2002-03-28',
  branchNo: '86H',
  agentCode: '90960863',
  groupName: 'AGRAWAT MUKESHKUMAR TULSIDAS',
  status: 3897,
  source: 'lic-import',
  isActive: true,
  mobileRaw: '96387 80155',
  mobile: '9638780155',
  phoneLast10: '9638780155',
  phone: '919638780155',
  premiumDateRaw: '00:10:00',
  nameTokens: ['AGRAWAT', 'MUKESH', 'TULSIDAS'],
  annual_premium_sum: 3642,
  coverage_score: 0,
  Customer_Code: 'I02951',
  'Insured Name': 'AGRAWAT  MUKESHKUMAR  TULSIDAS',
  'Group Head': 'AGRAWAT MUKESHKUMAR TULSIDAS',
  'Date of Birth': '1969-03-15',
  Area: 'Katargam',
  Premium: 3642,
  'Sum Assured': 50000,
  Mobile: '96387 80155',
  'Telephone(Office)': null,
  'Telephone(Residence)': '96387 80155',
  AadhaarNo: null,
  PANNo: null,
  E_mail: null,
  'Marriage Date': null,
  'No of Policies': 1,
  Sex: 'Male',
  'Add Comm': 'Residential',
  Expired: null,
  'Agent Code': null,
  dataAnalysis: { '#2 Match Validation': { checks: { currentAnnualPremium: 3642, currentPolicyCount: 1 } } },
};

describe('adaptClient · the merged `client` book (Phase 97)', () => {
  it("reads the owner's sample document — city, gender and the ANNUAL premium", () => {
    const out = adaptClient(OWNER_SAMPLE);

    // `Area` is the only locality on this row: `address.city` and `city` are both absent,
    // so before Phase 97 the whole book rendered with a blank city.
    expect(out.city).toBe('Katargam');
    // ₹3,642 a year, NOT the ₹1,821 half-yearly instalment the row also carries.
    expect(out.totalPremium).toBe(3642);
    expect(out.policies[0].premium).toBe(1821); // the policy card still shows the instalment
    expect(out.policies[0].frequency).toBe('Half-Yearly'); // …and what it is an instalment OF
    expect(out.gender).toBe('Male');
    expect(out.policyCount).toBe(1);
    expect(out.id).toBe('6a43b46141eaae0c6c9e69c1');
    expect(out.name).toBe('Agrawat Mukeshkumar Tulsidas');
    expect(out.phone).toBe('+919638780155');
    expect(out.totalCover).toBe(50000);
  });

  it("leaves a null LIXXX column undefined rather than rendering it empty", () => {
    const out = adaptClient(OWNER_SAMPLE);
    // The sample's own audit lists E_mail and Marriage Date as "missing: LIXXX".
    expect(out.email).toBeUndefined();
    expect(out.marriageDate).toBeUndefined();
  });

  it('suppresses the household label on the head of the household, and keeps it for a member', () => {
    // `Group Head` / `groupName` carry the HEAD's name. On the head's own record that just
    // repeats the name in the title above it, which reads as a bug rather than as data.
    expect(adaptClient(OWNER_SAMPLE).family).toBeUndefined();

    // A different member of the same household keeps it — the one place it says something.
    const wife = adaptClient({ ...OWNER_SAMPLE, _id: 'c-wife', name: 'AGRAWAT SUNITA', 'Insured Name': 'AGRAWAT SUNITA' });
    expect(wife.family).toBe('Agrawat Mukeshkumar Tulsidas');
  });

  it('reads Marriage Date and E_mail when the row actually carries them', () => {
    const out = adaptClient({
      ...OWNER_SAMPLE,
      E_mail: 'mukesh@example.com',
      'Marriage Date': '1994-11-22',
    });
    expect(out.email).toBe('mukesh@example.com');
    expect(out.marriageDate).toBe('1994-11-22T00:00:00.000Z');
  });

  it('APPENDS the LIXXX names — an existing value always wins', () => {
    // The merge rule on these documents is "fill current blanks only, never overwrite a
    // non-empty current value". The adapter has to hold the same order or a row carrying
    // both spellings would flip to the legacy one.
    const out = adaptClient({
      ...OWNER_SAMPLE,
      address: { city: 'Surat' },
      email: 'current@example.com',
      E_mail: 'legacy@example.com',
      familyName: 'Agrawat parivar',
    });
    expect(out.city).toBe('Surat');
    expect(out.email).toBe('current@example.com');
    expect(out.family).toBe('Agrawat parivar'); // untouched, NOT title-cased
  });

  it('falls back to premium × mode when the row has not been warmed — never to a bare premium', () => {
    // `annual_premium_sum` is the backend's "this row is warmed" marker (clientScoreWarmer),
    // so it is ABSENT until the warmer has run. A bare `premium` there would report a
    // half-yearly instalment under a label that says "Annual premium".
    const { annual_premium_sum, ...unwarmed } = OWNER_SAMPLE;
    expect(annual_premium_sum).toBe(3642); // the fixture really did carry it
    expect(adaptClient(unwarmed).totalPremium).toBe(3642); // 1821 × 2, not 1821

    expect(adaptClient({ ...unwarmed, mode: 'Monthly' }).totalPremium).toBe(1821 * 12);
    expect(adaptClient({ ...unwarmed, mode: 'Quarterly' }).totalPremium).toBe(1821 * 4);
    expect(adaptClient({ ...unwarmed, mode: 'Yearly' }).totalPremium).toBe(1821);
  });

  it('ignores a zero or malformed annual_premium_sum instead of reporting ₹0', () => {
    expect(adaptClient({ ...OWNER_SAMPLE, annual_premium_sum: 0 }).totalPremium).toBe(3642);
    expect(adaptClient({ ...OWNER_SAMPLE, annual_premium_sum: null }).totalPremium).toBe(3642);
    expect(adaptClient({ ...OWNER_SAMPLE, annual_premium_sum: 'x' }).totalPremium).toBe(3642);
  });

  it('never surfaces AadhaarNo or PANNo', () => {
    // Deliberate, and it is a DPDP decision rather than a UI one: government ID on a shared
    // handset is the owner's call. Present on the document, absent from the app's shape.
    const out: any = adaptClient({ ...OWNER_SAMPLE, AadhaarNo: '1234 5678 9012', PANNo: 'ABCDE1234F' });
    expect(JSON.stringify(out)).not.toContain('1234 5678 9012');
    expect(JSON.stringify(out)).not.toContain('ABCDE1234F');
  });

  it('recovers name and dob from the LIXXX spellings when the current fields are blank', () => {
    const out = adaptClient({
      _id: 'c-lixxx',
      'Insured Name': 'AGRAWAT  MUKESHKUMAR  TULSIDAS', // double-spaced in the source
      'Date of Birth': '1969-03-15',
      Area: 'Katargam',
    });
    expect(out.name).toBe('Agrawat Mukeshkumar Tulsidas');
    expect(out.dob).toBe('1969-03-15T00:00:00.000Z');
  });
});

describe('annualFactor', () => {
  it('mirrors the backend clientFlags.annualFactor value for value', () => {
    expect(annualFactor('Monthly')).toBe(12);
    expect(annualFactor('monthly')).toBe(12);
    expect(annualFactor('ecs')).toBe(12);
    expect(annualFactor('sss')).toBe(12);
    expect(annualFactor('Quarterly')).toBe(4);
    expect(annualFactor('quaterly')).toBe(4); // the import's known typo
    expect(annualFactor('Half-Yearly')).toBe(2);
    expect(annualFactor('half_yearly')).toBe(2);
    // Both spellings the backend's normalizeMode() repairs before annualFactor sees them.
    expect(annualFactor('halg-yearly')).toBe(2);
    expect(annualFactor('hamf-yearly')).toBe(2);
    expect(annualFactor('Yearly')).toBe(1);
    expect(annualFactor('Single')).toBe(1);
  });

  it('returns 1 for anything it does not recognise, including the short codes', () => {
    // `MLY` means monthly in LIC paperwork and still returns 1 — a deliberate copy of the
    // backend's behaviour. If the app "improved" on it, the same client would show one
    // annual premium here and a different one in the admin panel.
    expect(annualFactor('MLY')).toBe(1);
    expect(annualFactor('')).toBe(1);
    expect(annualFactor(null)).toBe(1);
    expect(annualFactor(undefined)).toBe(1);
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

  it('carries department and the pre-merge _origRole when the login row has them', () => {
    // The backend sends the whole staff_unified row in `user` (toPublicJSON), so these ride along.
    const out = adaptUser({ user_id: 'tm_1', role: 'advisor', department: 'Operations', _origRole: 'ops' });
    expect(out.department).toBe('Operations');
    expect(out.origRole).toBe('ops');
  });

  it('trims department/_origRole and OMITS the keys entirely when empty or absent', () => {
    // The IT/admins master rows carry department:'' — an empty department must read as ABSENT, not
    // as a present empty string, so `identityOf` never mistakes '' for a real department.
    const empty = adaptUser({ user_id: 'a', role: 'super_admin', department: '', _origRole: '  ' });
    expect('department' in empty).toBe(false);
    expect('origRole' in empty).toBe(false);
    const absent = adaptUser({ user_id: 'b', role: 'admin' });
    expect('department' in absent).toBe(false);
    expect('origRole' in absent).toBe(false);
    expect(adaptUser({ department: '  TATA AIA  ' }).department).toBe('TATA AIA');
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

  /* ---------------------------------------------------------------- stage / status
   *
   * REWRITTEN DELIBERATELY BY PHASE 4, along with the two cases that used to sit in the
   * pinned-known-bugs block at the foot of this file. They asserted the app's OWN six-word
   * vocabulary (`new contacted meeting proposal closed_won closed_lost`), three words of
   * which exist nowhere on the server. `Lead.status` is enum-enforced to five values
   * (`contracts/enums.md:212`) and is the only lead vocabulary any endpoint will store.
   */

  it('passes every enforced Lead.status value through unchanged', () => {
    // The whole enum, verbatim from contracts/enums.md:212. If this list and the LeadStage
    // union ever disagree, one of them has invented a status.
    for (const s of ['new_lead', 'meeting_scheduled', 'docs_shared', 'policy_issued', 'lost']) {
      expect(adaptLead({ _id: `s-${s}`, status: s }).stage).toBe(s);
    }
  });

  it('reads status FIRST and falls back to the raw stage key', () => {
    // The reverse of what this did before Phase 4, and the reverse of the backend's own
    // `reports.js:121` (`l.stage || l.status`). `status` is the only one of the two any
    // endpoint writes, so a document carrying both must show `status` — otherwise a saved
    // change would be invisible and every write would read as unconfirmed.
    expect(adaptLead({ _id: 's1', status: 'policy_issued', stage: 'new' }).stage).toBe('policy_issued');
    // ...and a document with only the raw key still maps (contracts/models.md:2138, drift #5).
    expect(adaptLead({ _id: 's2', stage: 'docs_shared' }).stage).toBe('docs_shared');
    // An empty status is not an answer, so it falls through rather than pinning 'new_lead'.
    expect(adaptLead({ _id: 's3', status: '', stage: 'meeting_scheduled' }).stage).toBe('meeting_scheduled');
  });

  it('maps the raw stage vocabulary DOWN, never up', () => {
    // enums.md:586 gives the raw/query-engine key its own four words. Two are already
    // enforced values; these two are not, and `contacted` has no counterpart at all —
    // resolving it to `meeting_scheduled` would invent a meeting nobody recorded.
    expect(adaptLead({ _id: 's4', stage: 'new' }).stage).toBe('new_lead');
    expect(adaptLead({ _id: 's5', stage: 'contacted' }).stage).toBe('new_lead');
    // NOTHING may resolve up into policy_issued. Guessing that a sale closed takes a lead out
    // of the open pipeline and puts its premium into a won figure. `converted` is the tempting
    // one — it reads like "won" and routes/leads.js:109-111 filters on it — but it is a value
    // of no lead vocabulary (enums.md:218: the filter can never match), so an alias for it
    // would fabricate a sale from a token that does not occur on a document.
    expect(adaptLead({ _id: 's6', stage: 'converted' }).stage).toBe('new_lead');
  });

  it('cannot be walked into Object.prototype by a hostile stage string', () => {
    // The raw `stage` key is written by non-Mongoose paths (the Excel bulk import, the bot), so
    // its contents are arbitrary. A bare `TABLE[x]` lookup returns the Object constructor for
    // 'constructor', and a stage that is a function crashes every STAGE_META[stage].labelKey.
    expect(adaptLead({ _id: 'p1', stage: 'constructor' }).stage).toBe('new_lead');
    expect(adaptLead({ _id: 'p2', stage: '__proto__' }).stage).toBe('new_lead');
    expect(adaptLead({ _id: 'p3', stage: 'toString' }).stage).toBe('new_lead');
    expect(adaptLead({ _id: 'p4', stage: 'hasOwnProperty' }).stage).toBe('new_lead');
  });

  it('no longer substring-matches, so two real values stop inverting', () => {
    // UPDATED DELIBERATELY BY PHASE 4 — this asserted `not_converted` → 'closed_won' and
    // `unqualified` → 'contacted' and was written to go red exactly here. The old mapper was
    // five unanchored regexes: the NEGATION 'not_converted' contains 'convert', and
    // 'unqualified' contains 'qualif'. Unknown input now resolves to the schema's own default
    // (`models/Lead.js:32`) rather than to whichever arm happened to match a fragment.
    expect(adaptLead({ _id: 'b3', stage: 'not_converted' }).stage).toBe('new_lead');
    expect(adaptLead({ _id: 'b4', stage: 'unqualified' }).stage).toBe('new_lead');
    expect(adaptLead({ _id: 'b5', stage: 'anything at all' }).stage).toBe('new_lead');
    expect(adaptLead({ _id: 'b6' }).stage).toBe('new_lead');
  });

  it('trims and lowercases before matching, but does not repair separators', () => {
    expect(adaptLead({ _id: 's7', status: '  POLICY_ISSUED  ' }).stage).toBe('policy_issued');
    // 'Policy Issued' with a space is NOT a Lead.status — enums.md:6 says casing and shape
    // are exact — so it is unknown input and lands on the default.
    expect(adaptLead({ _id: 's8', status: 'Policy Issued' }).stage).toBe('new_lead');
  });

  it('reads insurance_need for the interest line, ahead of the app-only keys', () => {
    // The schema's field for what the lead wants (models/Lead.js:25-28) was the one source
    // this never read, so the Interest column was blank for every real lead.
    expect(adaptLead({ _id: 's9', insurance_need: 'Term plan' }).interest).toBe('Term plan');
    expect(adaptLead({ _id: 's10', insurance_need: 'Term plan', interest: 'ignored' }).interest)
      .toBe('Term plan');
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
    // PHASE 9: 'acknowledged' is the status the backend writes on POST /reminders/:id/acknowledge,
    // which is the state `toggleReminder` now creates — it must read back as done.
    expect(adaptReminder({ _id: 'r8', status: 'acknowledged' }).done).toBe(true);
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

/* ------------------------------------------------------------ attendance history (A3) */

describe('adaptAttendanceHistory', () => {
  it('flattens a raw DayLog (/time-tracker/history) into per-session records', () => {
    // This is the A3 fix: the primary leg returns DayLog docs with times nested in sessions[],
    // NOT the clock_in.time record shape. Before the adapter these rendered as "no clock-in".
    const out = adaptAttendanceHistory([
      {
        date: '2026-08-24',
        sessions: [
          { clockIn: '2026-08-24T09:00:00.000Z', clockOut: '2026-08-24T17:30:00.000Z' },
          { clockIn: '2026-08-24T18:00:00.000Z' }, // re-clock-in, still open
        ],
      },
    ]);
    expect(out).toEqual([
      { date: '2026-08-24', clock_in: { time: '2026-08-24T09:00:00.000Z' }, clock_out: { time: '2026-08-24T17:30:00.000Z' } },
      { date: '2026-08-24', clock_in: { time: '2026-08-24T18:00:00.000Z' } },
    ]);
  });

  it('omits an open session\'s clock_out entirely rather than emitting null', () => {
    const out = adaptAttendanceHistory([{ date: '2026-08-24', sessions: [{ clockIn: 'X', clockOut: null }] }]);
    expect(out[0]).toEqual({ date: '2026-08-24', clock_in: { time: 'X' } });
    expect('clock_out' in out[0]).toBe(false);
  });

  it('drops sessions with no clockIn, and a daylog with zero clocked-in sessions yields nothing', () => {
    expect(adaptAttendanceHistory([{ date: '2026-08-24', sessions: [] }])).toEqual([]);
    expect(adaptAttendanceHistory([{ date: '2026-08-24', sessions: [{ clockOut: 'Y' }] }])).toEqual([]);
  });

  it('passes an already-canonical /attendance/history record straight through', () => {
    const out = adaptAttendanceHistory([
      { date: '2026-08-23', clock_in: { time: '09:01', lat: 21.2 }, clock_out: { time: '17:00' } },
    ]);
    expect(out).toEqual([
      { date: '2026-08-23', clock_in: { time: '09:01' }, clock_out: { time: '17:00' } },
    ]);
  });

  it('tolerates a flat legacy row (clockIn/clockOut) and a bare absent day', () => {
    expect(adaptAttendanceHistory([{ day: '2026-08-22', clockIn: '10:00' }]))
      .toEqual([{ date: '2026-08-22', clock_in: { time: '10:00' } }]);
    // A legacy row with neither time still surfaces the date (renders as "No entry").
    expect(adaptAttendanceHistory([{ date: '2026-08-21' }]))
      .toEqual([{ date: '2026-08-21' }]);
  });

  it('is defensive about non-arrays and junk rows', () => {
    expect(adaptAttendanceHistory(null)).toEqual([]);
    expect(adaptAttendanceHistory(undefined)).toEqual([]);
    expect(adaptAttendanceHistory({} as any)).toEqual([]);
    expect(adaptAttendanceHistory([null, 3, 'x', { date: '2026-08-20' }])).toEqual([{ date: '2026-08-20' }]);
  });
});

/* ------------------------------------------------------------------------------ */

describe('pinned known bugs — these must be updated deliberately when fixed', () => {
  /* Both lead-stage pins that lived here are GONE, not deleted: Phase 4 fixed the mapper, so
   * they moved up into the `adaptLead` describe as assertions of correct behaviour. The one
   * about `policy_issued` reading as New was this file's [Phase 4] marker. `mapClaimStatus`
   * below is the same class of defect in the claims mapper and is still open. */

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

/* ------------------------------------------------------------ LIC plans (Phase 6) */

describe('adaptLicPlan', () => {
  /** A plan exactly as the backend's `unifiedToLic` serialises one (productIngestion.js:142-157). */
  const legacyPlan = (extra: Record<string, unknown> = {}) => ({
    _id: '652f0000000000000000abcd',
    product_id: 'LIC-914',
    company: 'LIC',
    plan_name: 'New Endowment Plan',
    plan_table: '914',
    category: 'endowment_par',
    category_label: 'Endowment (participating)',
    participating: true,
    status: 'active',
    summary: 'Classic savings + life cover; lump sum at maturity with bonuses.',
    benefit_note: '',
    riders: ['Accidental Death & Disability', 'Term Assurance', 'Critical Illness'],
    ...extra,
  });

  it('maps the legacy LIC field names onto LicPlan', () => {
    const p = adaptLicPlan(legacyPlan());
    expect(p.id).toBe('LIC-914');
    expect(p.name).toBe('New Endowment Plan');
    expect(p.code).toBe('914');                      // plan_table = the LIC plan/table number
    expect(p.type).toBe('Endowment (participating)'); // category_label
    expect(p.highlight).toContain('Classic savings');
    expect(p.tags).toEqual(['Accidental Death & Disability', 'Term Assurance', 'Critical Illness']);
  });

  it('leaves entry-age and term empty — the wire carries neither as a plan-level fact (D-2)', () => {
    const p = adaptLicPlan(legacyPlan());
    expect(p.minAge).toBe(0);
    expect(p.maxAge).toBe(0);
    expect(p.term).toBe('');
  });

  it('falls back id→_id and type→category when the primary field is empty', () => {
    const p = adaptLicPlan(legacyPlan({ product_id: '', category_label: '' }));
    expect(p.id).toBe('652f0000000000000000abcd');
    expect(p.type).toBe('endowment_par');
  });

  it('prefers summary but falls back to benefit_note for the highlight', () => {
    const p = adaptLicPlan(legacyPlan({ summary: '', benefit_note: 'Guaranteed additions apply.' }));
    expect(p.highlight).toBe('Guaranteed additions apply.');
  });

  it('keeps only non-empty string riders as tags — never a number or a blank', () => {
    const p = adaptLicPlan(legacyPlan({ riders: ['Premium Waiver', '', '  ', 42, null] }));
    expect(p.tags).toEqual(['Premium Waiver']);
  });

  it('does not throw on a null/garbage document', () => {
    const p = adaptLicPlan(null);
    expect(p.name).toBe('');
    expect(p.tags).toEqual([]);
    expect(p.minAge).toBe(0);
  });

  /* PHASE 77 — the owner reported plans 102/113/122/165/172/180/181/195 all showing "Unnamed".
   * `plan_name` is null for those rows (and for 5/836/904 — ELEVEN in total) in the backend's
   * data/lic_plans_library.json, but the APP NEVER SEES THAT NULL: productIngestion.js:121
   * substitutes `String(d.plan_name || 'Unnamed plan')` on ingest and :146 hands the placeholder
   * straight back out. Verified against deployed origin/main (990c660). The first cut of this fix
   * keyed on a falsy name and was therefore dead code — these pin the sentinel itself. */
  describe('the backend placeholder name falls back to the LIC table number', () => {
    /** What `GET /api/lic-plans` really returns for table 102 — note the STRING placeholder. */
    const legacyRow = (over: Record<string, unknown> = {}) => ({
      _id: '652f0000000000000000dead',
      product_id: 'LIC-102',
      plan_name: 'Unnamed plan',
      plan_table: '102',
      category_label: 'Legacy / to be sourced (in your book)',
      status: 'unknown',
      ...over,
    });

    it('labels the wire\'s "Unnamed plan" placeholder with the LIC table number', () => {
      const p = adaptLicPlan(legacyRow());
      expect(p.name).toBe('LIC Plan 102');
      expect(p.code).toBe('102');
    });

    it('matches the placeholder regardless of case or padding', () => {
      expect(adaptLicPlan(legacyRow({ plan_name: '  UNNAMED PLAN  ' })).name).toBe('LIC Plan 102');
    });

    it('still handles a genuinely null/absent name, if the backend ever stops substituting', () => {
      expect(adaptLicPlan(legacyRow({ plan_name: null })).name).toBe('LIC Plan 102');
      expect(adaptLicPlan(legacyRow({ plan_name: '' })).name).toBe('LIC Plan 102');
    });

    it('accepts a NUMERIC plan_table — `s()` would otherwise drop the only identifier', () => {
      const p = adaptLicPlan(legacyRow({ product_id: 'LIC-904', plan_table: 904 }));
      expect(p.name).toBe('LIC Plan 904');
      expect(p.code).toBe('904');
    });

    it('never overrides a real plan name', () => {
      expect(adaptLicPlan(legacyPlan()).name).toBe('New Endowment Plan');
    });

    it('leaves a name that merely CONTAINS the word untouched', () => {
      expect(adaptLicPlan(legacyRow({ plan_name: 'Unnamed Plan Rider Pack' })).name)
        .toBe('Unnamed Plan Rider Pack');
    });

    it('stays empty with no usable name AND no table number, so the screen still says "Unnamed plan"', () => {
      expect(adaptLicPlan(legacyRow({ plan_name: 'Unnamed plan', plan_table: null })).name).toBe('');
    });
  });
});

/* ============================================================ adaptContest
 * The wire shape is a raw Contest document (title/reward_description/target_goal/target_unit/
 * end_date) annotated per-caller with user_progress + a top-5 leaderboard. The pre-adapter code
 * read this straight into `Contest[]`, so every field was undefined and every card rendered
 * blank (owner backlog Point 7). These pin the real backend field names → app shape mapping.
 */
describe('adaptContest — real backend document → app Contest', () => {
  // A faithful slice of `GET /api/contests` data[i] (routes/contests.js:44-49 + models/Contest.js).
  const contestRow = (over: Record<string, any> = {}) => ({
    _id: 'ct_501',
    title: 'Diwali Sales Sprint',
    description: 'Close the most policies before Diwali.',
    type: 'sales',
    start_date: '2026-09-01T00:00:00.000Z',
    end_date: '2026-09-30T00:00:00.000Z',
    target_goal: 200,
    target_unit: 'policies',
    reward_description: 'Goa trip for the top 3',
    status: 'active',
    is_participating: true,
    user_progress: 120,
    leaderboard: [
      { user_id: 'u_lead', user_name: 'Top Gun', current_progress: 190, rank: 1 },
      { user_id: 'u_me', user_name: 'Me', current_progress: 120, rank: 2 },
    ],
    ...over,
  });

  it('maps the real field names the app screen reads — none of which match the wire', () => {
    const p = adaptContest(contestRow(), 'u_me');
    expect(p.id).toBe('ct_501');
    expect(p.name).toBe('Diwali Sales Sprint');            // title, not name
    expect(p.reward).toBe('Goa trip for the top 3');       // reward_description, not reward
    expect(p.ends).toBe('2026-09-30T00:00:00.000Z');       // end_date, not ends
    expect(p.metric).toBe('120 of 200 policies');          // built from user_progress/target/unit
  });

  it('progress is the user\'s own share of the goal, 0..1', () => {
    expect(adaptContest(contestRow(), 'u_me').progress).toBeCloseTo(0.6, 5); // 120/200
  });

  it('clamps an over-target progress to 1 (never > 100%)', () => {
    expect(adaptContest(contestRow({ user_progress: 250 }), 'u_me').progress).toBe(1);
  });

  it('a zero or missing target yields progress 0 — never NaN or Infinity', () => {
    const zero = adaptContest(contestRow({ target_goal: 0, user_progress: 5 }), 'u_me');
    expect(zero.progress).toBe(0);
    expect(Number.isFinite(zero.progress)).toBe(true);
    const missing = adaptContest(contestRow({ target_goal: undefined }), 'u_me');
    expect(missing.progress).toBe(0);
    expect(missing.metric).toBe('policies');   // falls back to the bare unit when no target
  });

  it('populates rank only from the user\'s own leaderboard row', () => {
    expect(adaptContest(contestRow(), 'u_me').rank).toBe(2);
    expect(adaptContest(contestRow(), 'u_lead').rank).toBe(1);
  });

  it('omits rank when the user is not in the (top-5) leaderboard — never a guessed #0', () => {
    expect(adaptContest(contestRow(), 'u_stranger').rank).toBeUndefined();
    expect(adaptContest(contestRow(), null).rank).toBeUndefined();       // no signed-in id
    expect(adaptContest(contestRow({ leaderboard: [] }), 'u_me').rank).toBeUndefined();
  });

  it('defaults the unit to points when the contest carries none', () => {
    expect(adaptContest(contestRow({ target_unit: undefined }), 'u_me').metric).toBe('120 of 200 points');
  });

  it('does not throw on a null/garbage row and keeps a usable, non-blank card', () => {
    const p = adaptContest(null, 'u_me');
    expect(p.name).toBe('Contest');    // the pre-adapter bug rendered this blank
    expect(p.reward).toBe('');
    expect(p.progress).toBe(0);
    expect(p.rank).toBeUndefined();
    expect(p.ends).toBe('');
  });
});
