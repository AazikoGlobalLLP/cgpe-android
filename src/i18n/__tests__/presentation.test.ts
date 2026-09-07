import { afterEach, describe, expect, it, vi } from 'vitest';
import { translate } from '@/i18n';
import { localMessage, renderText, resolveCopy, textCopy } from '@/i18n/copy';
import { EN_CRASH_COPY, getCrashCopy, setCrashLanguage } from '@/i18n/crashCopy';
import { describeCrash } from '@/lib/crashReport';
import { timeAgo } from '@/lib/format';
import { readTrackingCopy } from '@/lib/trackingCopy';
import { DEFAULT_UI, normalizeUiConfig, arrangeMoreSections } from '@/store/appUi';

const tr = (language: 'en' | 'hi') => (key: string, params?: Parameters<typeof translate>[2]) => translate(language, key, params);
afterEach(() => { vi.useRealTimers(); setCrashLanguage('en'); });

describe('presentation copy retains its source and current language', () => {
  it('relabels stored nested local messages while equal-English authored text stays raw', () => {
    const local = localMessage('api.withinOffice', 'Within the office area');
    expect(resolveCopy(tr('hi'), local.message, local.messageCopy)).not.toBe(local.message);
    expect(resolveCopy(tr('hi'), local.message)).toBe(local.message);
    const job = textCopy('job.dispatchingTo', undefined, { name: textCopy('record.customer') });
    expect(renderText(tr('hi'), job)).not.toBe(renderText(tr('en'), job));
    expect(renderText(tr('hi'), job)).toContain(tr('hi')('record.customer'));
  });

  it('translates relative prose and retains English absolute dates and nonbreaking spaces', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 7, 12));
    const twoMinutes = new Date(Date.now() - 120_000);
    expect(timeAgo(twoMinutes)).toBe('2m\u00a0ago');
    expect(timeAgo(twoMinutes, tr('hi'))).toBe(tr('hi')('time.minutesAgo', { count: 2 }).replace(/ /g, '\u00a0'));
    expect(timeAgo('invalid', tr('hi'))).toBe(timeAgo('invalid'));
    const old = new Date(2026, 7, 1);
    expect(timeAgo(old, tr('hi'))).toBe(timeAgo(old));
  });

  it('can describe a root crash without a provider, preserving bounded diagnostics', () => {
    setCrashLanguage('hi');
    const details = describeCrash(new TypeError('raw diagnostic'), getCrashCopy());
    expect(details.title).not.toBe(EN_CRASH_COPY.title);
    expect(details.detail).toBe('TypeError: raw diagnostic');
    setCrashLanguage('unknown');
    expect(getCrashCopy()).toEqual(EN_CRASH_COPY);
    expect(describeCrash(null).title).toBe(EN_CRASH_COPY.title);
  });

  it('marks only local More headings, even inside an otherwise server-supplied config', () => {
    const partial = normalizeUiConfig({ role_key: 'advisor', dashboard: { widgets: [] } })!;
    expect(partial.nav.more_sections).toBe(DEFAULT_UI.nav.more_sections);
    expect(partial.nav.more_sections?.[0].titleKey).toBe('more.groupBook');
    const served = normalizeUiConfig({ role_key: 'advisor', nav: { more_sections: [{ title: 'The book', titleKey: 'malicious.untrusted', items: ['clients'] }] } })!;
    const groups = arrangeMoreSections(served.nav.more_sections, ['clients', 'settings'], () => false, 'Translated more');
    expect(groups).toEqual([{ title: 'The book', keys: ['clients'] }, { title: 'Translated more', keys: ['settings'] }]);
  });

  it('rejects another account or legacy notification copy and separates recording modes', () => {
    const fallback = { title: 'CGPE Connect', body: 'Fallback' };
    const ambient = { title: 'Ambient', body: 'Continues after clock-out' };
    const shift = { title: 'Shift', body: 'Stops after clock-out' };
    const saved = JSON.stringify({ ownerId: 'A', ambient, shift });
    expect(readTrackingCopy(saved, 'A', 'ambient', fallback)).toEqual(ambient);
    expect(readTrackingCopy(saved, 'A', 'shift', fallback)).toEqual(shift);
    expect(readTrackingCopy(saved, 'B', 'ambient', fallback)).toEqual(fallback);
    expect(readTrackingCopy(saved, null, 'shift', fallback)).toEqual(fallback);
    expect(readTrackingCopy(JSON.stringify(ambient), 'A', 'ambient', fallback)).toEqual(fallback);
    expect(readTrackingCopy('{bad', 'A', 'shift', fallback)).toEqual(fallback);
  });
});
