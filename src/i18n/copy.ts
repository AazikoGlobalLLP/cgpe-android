import type { TFn, TParams } from '@/i18n';

/** Provenance for app-owned copy. Keep business/server text and wire values separate. */
export type LocalCopy = { key: string; params?: TParams; paramCopies?: Record<string, LocalCopy> };
export type LocalMessage = { message: string; messageCopy?: LocalCopy };
export type CopyText = string | LocalCopy;
export function textCopy(key: string, params?: TParams, paramCopies?: Record<string, LocalCopy>): LocalCopy {
  return { key, ...(params ? { params } : {}), ...(paramCopies ? { paramCopies } : {}) };
}
export function renderText(t: TFn, value: CopyText): string {
  if (typeof value === 'string') return value;
  const params = value.paramCopies
    ? { ...value.params, ...Object.fromEntries(Object.entries(value.paramCopies).map(([key, copy]) => [key, renderText(t, copy)])) }
    : value.params;
  return t(value.key, params);
}

export function localMessage(key: string, message: string, params?: TParams): LocalMessage {
  return { message, messageCopy: { key, ...(params ? { params } : {}) } };
}

export function resolveCopy(t: TFn, text: string, copy?: LocalCopy): string {
  return copy ? renderText(t, copy) : text;
}
