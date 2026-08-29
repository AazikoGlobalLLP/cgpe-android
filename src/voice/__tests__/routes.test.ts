/**
 * The voice route allow-list must never name a route that does not exist — `tsc` cannot catch a stale
 * string against the real route tree, so this test reads `src/app/**` and fails if any allow-listed
 * route has lost its screen file. That is the drift guard the module doc promises.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  VOICE_ROUTES_STATIC, VOICE_ROUTES_PARAM, isAllowedVoiceRoute, voiceRouteNeedsId,
} from '@/voice/routes';

const APP = join(process.cwd(), 'src', 'app');
function routeFileExists(route: string): boolean {
  const rel = route.replace(/^\//, '');
  return existsSync(join(APP, `${rel}.tsx`)) || existsSync(join(APP, rel, 'index.tsx'));
}

describe('drift guard — every allow-listed route maps to a real screen file', () => {
  for (const r of [...VOICE_ROUTES_STATIC, ...VOICE_ROUTES_PARAM]) {
    it(`${r} exists under src/app`, () => {
      expect(routeFileExists(r)).toBe(true);
    });
  }
});

describe('isAllowedVoiceRoute — membership only, fails closed', () => {
  it('accepts a known static route', () => {
    expect(isAllowedVoiceRoute('/(tabs)/home')).toBe(true);
    expect(isAllowedVoiceRoute('/attendance')).toBe(true);
  });
  it('accepts a known param template', () => {
    expect(isAllowedVoiceRoute('/client/[id]')).toBe(true);
  });
  it('rejects an unknown or auth/system route', () => {
    expect(isAllowedVoiceRoute('/(auth)/login')).toBe(false);
    expect(isAllowedVoiceRoute('/consent')).toBe(false);
    expect(isAllowedVoiceRoute('/job/[id]')).toBe(false); // internal campaign monitor, deliberately out
    expect(isAllowedVoiceRoute('/made-up')).toBe(false);
  });
  it('rejects a concrete param path (only templates are listed)', () => {
    expect(isAllowedVoiceRoute('/client/abc123')).toBe(false);
  });
  it('rejects non-strings', () => {
    expect(isAllowedVoiceRoute(null)).toBe(false);
    expect(isAllowedVoiceRoute(undefined)).toBe(false);
  });
});

describe('voiceRouteNeedsId', () => {
  it('is true for a [id] template, false for a static route', () => {
    expect(voiceRouteNeedsId('/client/[id]')).toBe(true);
    expect(voiceRouteNeedsId('/(tabs)/home')).toBe(false);
  });
});
