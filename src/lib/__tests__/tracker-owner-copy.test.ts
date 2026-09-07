import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  saved: new Map<string, string>(),
  started: false,
  ownerReads: 0,
  switchAtOwnerRead: 0,
  backgroundPermission: vi.fn<() => Promise<{ granted: boolean }>>(),
  startService: vi.fn<(name: string, options: { foregroundService: { notificationTitle: string; notificationBody: string } }) => Promise<void>>(),
  stopService: vi.fn<() => Promise<void>>(),
}));

// Mock only native/storage/API boundaries; import the complete real tracker module and helpers.
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, Linking: { openSettings: vi.fn() } }));
vi.mock('expo-location', () => ({
  Accuracy: { High: 4, Balanced: 3, Low: 2 },
  ActivityType: { AutomotiveNavigation: 1 },
  hasStartedLocationUpdatesAsync: async () => h.started,
  getBackgroundPermissionsAsync: h.backgroundPermission,
  getForegroundPermissionsAsync: async () => ({ granted: true }),
  startLocationUpdatesAsync: h.startService,
  stopLocationUpdatesAsync: h.stopService,
}));
vi.mock('expo-task-manager', () => ({
  isTaskDefined: () => false,
  defineTask: vi.fn(),
  isTaskRegisteredAsync: async () => true,
}));
vi.mock('expo-background-task', () => ({
  registerTaskAsync: vi.fn(), unregisterTaskAsync: vi.fn(),
  BackgroundTaskResult: { Success: 1, Failed: 2 },
}));
vi.mock('expo-intent-launcher', () => ({}));
vi.mock('expo-sensors', () => ({ Accelerometer: { setUpdateInterval: vi.fn(), addListener: () => ({ remove: vi.fn() }) } }));
vi.mock('@/lib/storage', () => ({ storage: {
  get: async (key: string) => {
    if (key === 'cgpe.user' && ++h.ownerReads === h.switchAtOwnerRead) {
      h.saved.set('cgpe.user', JSON.stringify({ id: 'B' }));
      h.saved.set('track.notif', JSON.stringify({ ownerId: 'B', ambient: { title: 'B Gujarati', body: 'B body' } }));
    }
    return h.saved.get(key) ?? null;
  },
  set: async (key: string, value: string) => { h.saved.set(key, value); },
  remove: async (key: string) => { h.saved.delete(key); },
} }));
vi.mock('@/data/api', () => ({ startTrack: vi.fn(async () => true) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const snapshot = () => JSON.parse(h.saved.get('track.notif') ?? 'null');

beforeEach(() => {
  vi.resetModules();
  h.saved.clear();
  h.saved.set('cgpe.user', JSON.stringify({ id: 'A' }));
  h.started = false;
  h.ownerReads = 0;
  h.switchAtOwnerRead = 0;
  h.backgroundPermission.mockReset().mockResolvedValue({ granted: true });
  h.startService.mockReset().mockImplementation(async () => { h.started = true; });
  h.stopService.mockReset().mockResolvedValue(undefined);
});

describe('tracker notification copy ownership across delayed arming', () => {
  it('keeps the latest language when an earlier ambient permission read finishes late', async () => {
    const permission = deferred<{ granted: boolean }>();
    h.backgroundPermission.mockReturnValue(permission.promise);
    const tracker = await import('@/lib/tracker');
    const pending = tracker.startAmbientTracking({ ownerId: 'A', prompt: false, notif: { title: 'Old English', body: 'Old body' } });
    await vi.waitFor(() => expect(h.backgroundPermission).toHaveBeenCalledOnce());
    await tracker.updateTrackingNotificationCopies('A', { title: 'Latest Gujarati', body: 'Latest body' }, { title: 'Shift Gujarati', body: 'Shift body' });
    permission.resolve({ granted: true });
    await pending;
    expect(snapshot()).toEqual({ ownerId: 'A', ambient: { title: 'Latest Gujarati', body: 'Latest body' }, shift: { title: 'Shift Gujarati', body: 'Shift body' } });
    expect(h.startService).toHaveBeenCalledOnce();
    expect(h.startService.mock.calls[0][1].foregroundService).toMatchObject({ notificationTitle: 'Latest Gujarati', notificationBody: 'Latest body' });
  });

  it('does not arm the outgoing owner after permission completes for a new account', async () => {
    const permission = deferred<{ granted: boolean }>();
    h.backgroundPermission.mockReturnValue(permission.promise);
    const tracker = await import('@/lib/tracker');
    const pending = tracker.startAmbientTracking({ ownerId: 'A', prompt: false, notif: { title: 'A English', body: 'A body' } });
    await vi.waitFor(() => expect(h.backgroundPermission).toHaveBeenCalledOnce());
    h.saved.set('cgpe.user', JSON.stringify({ id: 'B' }));
    await tracker.updateTrackingNotificationCopies('B', { title: 'B Gujarati', body: 'B body' }, { title: 'B shift', body: 'B shift body' });
    permission.resolve({ granted: true });
    await pending;
    expect(snapshot().ownerId).toBe('B');
    expect(snapshot().ambient.title).toBe('B Gujarati');
    expect(h.saved.has('track.ambient')).toBe(false);
    expect(h.startService).not.toHaveBeenCalled();
  });

  it('never relabels an old owner copy when the account changes between the arm and copy-write guards', async () => {
    const tracker = await import('@/lib/tracker');
    // Storage boundary changes ownership after the arm entered its serial operation.
    h.switchAtOwnerRead = 3;
    await tracker.startAmbientTracking({ ownerId: 'A', prompt: false, notif: { title: 'A English', body: 'A body' } });
    expect(snapshot()).toEqual({ ownerId: 'B', ambient: { title: 'B Gujarati', body: 'B body' } });
    expect(h.saved.has('track.ambient')).toBe(false);
    expect(h.startService).not.toHaveBeenCalled();
  });

  it('uses the latest shift snapshot for a new shift while retaining the exact session id', async () => {
    const tracker = await import('@/lib/tracker');
    await tracker.updateTrackingNotificationCopies('A', { title: 'Ambient Gujarati', body: 'Ambient body' }, { title: 'Shift Gujarati', body: 'Shift body' });
    await tracker.startTracking('session-123', { title: 'Old English', body: 'Old body' }, 'A');
    expect(JSON.parse(h.saved.get('track.state')!).sid).toBe('session-123');
    expect(snapshot().shift).toEqual({ title: 'Shift Gujarati', body: 'Shift body' });
    expect(h.startService.mock.calls[0][1].foregroundService).toMatchObject({ notificationTitle: 'Shift Gujarati', notificationBody: 'Shift body' });
  });

  it('refreshes saved text without restarting a recorder that is already running', async () => {
    h.started = true;
    const tracker = await import('@/lib/tracker');
    await tracker.updateTrackingNotificationCopies('A', { title: 'Ambient Gujarati', body: 'Ambient body' }, { title: 'Shift Gujarati', body: 'Shift body' });
    expect(snapshot().ambient.title).toBe('Ambient Gujarati');
    expect(h.startService).not.toHaveBeenCalled();
    expect(h.stopService).not.toHaveBeenCalled();
    expect(h.backgroundPermission).not.toHaveBeenCalled();
  });
});
