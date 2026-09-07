// No React, storage, native modules or provider imports: usable when the root fails.
import { en, gu, hi, hiEn, guEn } from './generated/phase117';

export type CrashCopy = { title: string; message: string; retryLabel: string; detailHeading: string };
const tables: Record<string, typeof en> = { en, gu, hi, 'hi-en': hiEn, 'gu-en': guEn };
function copyFor(language: string): Readonly<CrashCopy> {
  const table = tables[language] ?? en;
  return Object.freeze({
    title: table['crash.title'], message: table['crash.message'],
    retryLabel: table['crash.reload'], detailHeading: table['crash.detailHeading'],
  });
}
export const EN_CRASH_COPY = copyFor('en');
let snapshot = EN_CRASH_COPY;
export function setCrashLanguage(language: string): void { snapshot = copyFor(language); }
export function getCrashCopy(): Readonly<CrashCopy> { return snapshot; }
