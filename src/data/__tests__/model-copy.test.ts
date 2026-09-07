import { describe, expect, it } from 'vitest';
import { adaptClient, adaptUser, adaptLead, adaptClaim, adaptWaThread, adaptReminder, adaptNotification, adaptContest, adaptLicPlan } from '@/data/adapt';
import { liveOnDutyPins, mergeRoster, type LiveLocation } from '@/data/roster';
import { mergePayrollRoster } from '@/data/payroll';

describe('local display provenance preserves canonical models and authored text', () => {
  it.each([
    { adapt: adaptClient, field: 'name', copy: 'nameCopy', raw: { name: 'Customer' } },
    { adapt: adaptUser, field: 'name', copy: 'nameCopy', raw: { name: 'Advisor' } },
    { adapt: adaptUser, field: 'designation', copy: 'designationCopy', raw: { designation: 'Advisor' } },
    { adapt: adaptLead, field: 'name', copy: 'nameCopy', raw: { name: 'Lead' } },
    { adapt: adaptLead, field: 'source', copy: 'sourceCopy', raw: { source: 'Manual' } },
    { adapt: adaptClaim, field: 'clientName', copy: 'clientNameCopy', raw: { patient_name: 'Claimant' } },
    { adapt: adaptWaThread, field: 'name', copy: 'nameCopy', raw: { name: 'WhatsApp user' } },
    { adapt: adaptReminder, field: 'title', copy: 'titleCopy', raw: { title: 'Reminder' } },
    { adapt: adaptNotification, field: 'title', copy: 'titleCopy', raw: { title: 'Notification' } },
    { adapt: adaptContest, field: 'name', copy: 'nameCopy', raw: { name: 'Contest' } },
  ])('marks the absent $field fallback, never an explicitly supplied value', ({ adapt, field, copy, raw }) => {
    const fallback = adapt(null) as unknown as Record<string, unknown>;
    const authored = adapt(raw) as unknown as Record<string, unknown>;
    expect(fallback[copy]).toHaveProperty('key');
    expect(authored[copy]).toBeUndefined();
    expect(authored[field]).toBeTruthy();
    expect(JSON.parse(JSON.stringify(fallback))[copy]).toEqual(fallback[copy]);
  });

  it('preserves generated plan provenance and custom contest units independently', () => {
    expect(adaptLicPlan({ plan_table: '914' })).toMatchObject({ name: 'LIC Plan 914', nameCopy: { key: 'record.licPlan', params: { code: '914' } } });
    expect(adaptLicPlan({ plan_table: '914', plan_name: 'LIC Plan 914' }).nameCopy).toBeUndefined();
    expect(adaptClient({ planName: 'LIC Policy' }).policies[0].planCopy).toBeUndefined();
    const local = adaptContest({ target_goal: 10, user_progress: 2 });
    const supplied = adaptContest({ target_goal: 10, user_progress: 2, target_unit: 'points' });
    expect(local.metric).toBe(supplied.metric);
    expect(local.metricUnitCopy).toEqual({ key: 'contests.pointsUnit' });
    expect(supplied.metricUnitCopy).toBeUndefined();
    expect(supplied.metricCopy?.params?.unit).toBe('points');
  });

  it('keeps fallback names through roster, map and payroll projections without changing joins', () => {
    const location = { userId: 'member-1', name: 'Member', nameCopy: { key: 'record.member' }, role: 'advisor', isClockedIn: true, lat: 21.1, lng: 72.8 } as LiveLocation;
    const members = mergeRoster([location], []);
    expect(members[0].nameCopy).toEqual(location.nameCopy);
    expect(liveOnDutyPins([location])[0].nameCopy).toEqual(location.nameCopy);
    expect(mergePayrollRoster(members, [])[0]).toMatchObject({ user_id: 'member-1', name: 'Member', nameCopy: location.nameCopy, pending: true });
    const raw = { ...location, nameCopy: undefined };
    expect(mergeRoster([raw], [])[0].nameCopy).toBeUndefined();
  });
});
