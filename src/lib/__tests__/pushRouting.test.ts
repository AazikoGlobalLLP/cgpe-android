import { describe, it, expect } from 'vitest';
import { routeForPush, shouldReRegister } from '@/lib/pushRouting';

/**
 * PHASE 72 (Tier B push). `lib/push.ts` imports `expo-notifications` and is device-only (no stub in
 * the Vitest env, like `tracker.ts`), so the two decisions behind push — where a tap lands, and
 * whether to re-register the token — are lifted into the pure `lib/pushRouting.ts` and pinned here.
 */
describe('routeForPush — where a notification tap lands (PHASE 72)', () => {
  it('routes every task-family event to the Tasks tab', () => {
    for (const type of ['task', 'task_assigned', 'task_reassigned', 'task_transfer', 'task_reminder', 'reminder']) {
      expect(routeForPush({ type })).toBe('/tasks');
    }
  });

  it('routes every lead-family event to the Leads tab', () => {
    for (const type of ['lead', 'lead_assigned', 'new_lead']) {
      expect(routeForPush({ type })).toBe('/leads');
    }
  });

  it('falls back to the notification feed for an unknown or missing type', () => {
    expect(routeForPush({ type: 'contest' })).toBe('/notifications');
    expect(routeForPush({ type: 'system' })).toBe('/notifications');
    expect(routeForPush({})).toBe('/notifications');
    expect(routeForPush(null)).toBe('/notifications');
    expect(routeForPush(undefined)).toBe('/notifications');
  });

  it('is case-insensitive and trims the type', () => {
    expect(routeForPush({ type: '  TASK ' })).toBe('/tasks');
    expect(routeForPush({ type: 'New_Lead' })).toBe('/leads');
  });

  it('honours an explicit url ONLY when it is a known-safe in-app route', () => {
    // A safe route wins over the type mapping.
    expect(routeForPush({ type: 'task', url: '/leads' })).toBe('/leads');
    expect(routeForPush({ url: '/notifications' })).toBe('/notifications');
  });

  it('ignores a url the app cannot honour and routes by type instead (never navigate on a guess)', () => {
    // A web link, or a not-yet-built detail path, must not be obeyed.
    expect(routeForPush({ type: 'task', url: 'https://cgpe.in/tasks/123' })).toBe('/tasks');
    expect(routeForPush({ type: 'lead', url: '/task/123' })).toBe('/leads');
    // An unhonourable url with no usable type → the always-correct feed.
    expect(routeForPush({ url: '/settings' })).toBe('/notifications');
  });

  it('tolerates non-string data fields without throwing', () => {
    expect(routeForPush({ type: 42 as unknown as string })).toBe('/notifications');
    expect(routeForPush({ url: { path: '/tasks' } as unknown as string, type: 'lead' })).toBe('/leads');
  });
});

describe('shouldReRegister — only POST the token when it actually changed (PHASE 72)', () => {
  it('registers a brand-new token (no prior)', () => {
    expect(shouldReRegister(null, 'ExponentPushToken[abc]')).toBe(true);
    expect(shouldReRegister(undefined, 'ExponentPushToken[abc]')).toBe(true);
    expect(shouldReRegister('', 'ExponentPushToken[abc]')).toBe(true);
  });

  it('does NOT register an unchanged token (the common app-open case)', () => {
    expect(shouldReRegister('ExponentPushToken[abc]', 'ExponentPushToken[abc]')).toBe(false);
  });

  it('registers when the token rotated', () => {
    expect(shouldReRegister('ExponentPushToken[old]', 'ExponentPushToken[new]')).toBe(true);
  });

  it('never registers a blank/absent next token (nothing to send)', () => {
    expect(shouldReRegister('ExponentPushToken[abc]', '')).toBe(false);
    expect(shouldReRegister('ExponentPushToken[abc]', null)).toBe(false);
    expect(shouldReRegister('ExponentPushToken[abc]', undefined)).toBe(false);
    expect(shouldReRegister(null, null)).toBe(false);
  });

  it('ignores surrounding whitespace on both sides', () => {
    expect(shouldReRegister('tok', '  tok  ')).toBe(false);
    expect(shouldReRegister('  tok  ', 'tok2')).toBe(true);
  });
});
