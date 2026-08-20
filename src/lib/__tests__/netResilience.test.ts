/**
 * Phase 55 — the pure network-resilience decisions. No network, no timers: just the rules that
 * gate `req()`'s retry loop and name a failure for the banner. If one of these flips, the retry
 * behaviour or the user-facing wording changed on purpose — this file is where that is decided.
 */
import { describe, it, expect } from 'vitest';
import {
  isIdempotentMethod,
  isRetryableStatus,
  kindForThrown,
  backoffMs,
} from '@/lib/netResilience';

describe('isIdempotentMethod — only reads may auto-retry', () => {
  it('treats an ABSENT method as a GET (a bare req() is a read) → idempotent', () => {
    expect(isIdempotentMethod(undefined)).toBe(true);
    expect(isIdempotentMethod('')).toBe(true);
  });
  it('is true for GET/HEAD in any casing', () => {
    expect(isIdempotentMethod('GET')).toBe(true);
    expect(isIdempotentMethod('get')).toBe(true);
    expect(isIdempotentMethod('Head')).toBe(true);
  });
  it('is FALSE for every write verb — a retried write could double-fire', () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'post', 'Put']) {
      expect(isIdempotentMethod(m)).toBe(false);
    }
  });
});

describe('isRetryableStatus — transient server faults only', () => {
  it('retries 429 and a transient 5xx (500/502/503/504)', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(504)).toBe(true);
    expect(isRetryableStatus(599)).toBe(true);
  });
  it('never retries 501 — it is this backend\'s "endpoint not deployed" ANSWER, a permanent signal (quiet, like a 404)', () => {
    expect(isRetryableStatus(501)).toBe(false);
  });
  it('never retries a 2xx/3xx or a considered 4xx answer (400/401/403/404) — the reply would not change', () => {
    for (const s of [200, 204, 301, 400, 401, 403, 404, 409, 422]) {
      expect(isRetryableStatus(s)).toBe(false);
    }
  });
});

describe('kindForThrown — timeout vs a transport failure', () => {
  it('maps our AbortController abort to "timeout"', () => {
    const e = new Error('aborted');
    e.name = 'AbortError';
    expect(kindForThrown(e)).toBe('timeout');
  });
  it('maps any other throw (DNS/TLS/refused/offline) to "network"', () => {
    expect(kindForThrown(new TypeError('Failed to fetch'))).toBe('network');
    expect(kindForThrown(new Error('network down'))).toBe('network');
    expect(kindForThrown(null)).toBe('network');
    expect(kindForThrown(undefined)).toBe('network');
  });
});

describe('backoffMs — bounded exponential', () => {
  it('grows base, 2·base, 4·base by retry index', () => {
    expect(backoffMs(0, 600)).toBe(600);
    expect(backoffMs(1, 600)).toBe(1200);
    expect(backoffMs(2, 600)).toBe(2400);
  });
  it('clamps a negative index to the base (never shorter than one backoff)', () => {
    expect(backoffMs(-5, 600)).toBe(600);
  });
  it('defaults its base to the owner-locked config constant when none is passed', () => {
    // The exact value is owned by config.ts; here we only assert it is a positive number so a
    // future edit that zeroes the backoff (defeating the point) fails loudly.
    expect(backoffMs(0)).toBeGreaterThan(0);
  });
});
