/**
 * The voice network client — POST the recorded clip to the backend proxy `POST /api/voice/ask`, which
 * forwards it to n8n and returns the A1.3 JSON. The proxy exists so the n8n URL + webhook secret never
 * ship in the APK; the app only ever talks to `cgpe.in`, which it already trusts.
 *
 * This does NOT go through `req()` on purpose (grounded in `api.ts`):
 *  - `req()` hardcodes `Content-Type: application/json` — that corrupts a multipart boundary.
 *  - a voice turn is a WRITE: it must fire EXACTLY ONCE. A silently retried voice command is a double
 *    clock-in waiting to happen, so there is no retry loop here (the contract also makes `request_id`
 *    the idempotency key so a manual retry dedupes server-side).
 *  - it aborts at the A1.3 hard ceiling (`VOICE.CEILING_MS`, 8 s), not the 30 s upload timeout.
 *
 * It mirrors the proven multipart shape of `uploadFile()` in `api.ts`: build a `FormData`, DO NOT set
 * `Content-Type` (let `fetch` set the boundary), attach the bearer token, single attempt. On a non-200
 * (the contract says a non-200 is an outage) / a thrown fetch / the abort it returns a typed transport
 * error; on a 200 it hands the body to `parseVoiceReply`, which itself turns an empty/garbage 200 body
 * into a `VoiceReplyError` — so a broken n8n reply never crashes the caller.
 *
 * The webhook secret is attached by the Express proxy, NEVER here — shipping it in the APK would defeat
 * the whole reason the proxy exists.
 */
import { Platform } from 'react-native';
import { API_BASE_URL, APP, FORCE_DEMO } from '@/constants/config';
import { getAuthToken, isRealSession } from '@/data/api';
import { VOICE } from '@/voice/constants';
import { parseVoiceReply, type VoiceReply, type VoiceReplyError } from '@/voice/response';
import type { VoiceLangCode } from '@/voice/request';
import type { Turn } from '@/voice/session';

/**
 * A failure BEFORE we ever got a usable reply — distinct from a `VoiceReplyError` (a 200 whose body was
 * bad, which still carries a transcript to show). `unauthenticated` means we never sent it (no session).
 */
export type VoiceTransportError = {
  ok: false;
  transport: 'timeout' | 'network' | 'server' | 'unauthenticated';
  status?: number;
};

export type AskVoiceResult = VoiceReply | VoiceReplyError | VoiceTransportError;

/** True for the "never reached a reply" case (show a generic outage, no transcript). */
export function isTransportError(r: AskVoiceResult): r is VoiceTransportError {
  return r.ok === false && 'transport' in r;
}

export type AskVoiceInput = {
  audioUri: string;
  lang: VoiceLangCode;
  sessionId: string;
  /** The idempotency key for the whole turn — reuse it verbatim on a manual retry so the proxy dedupes. */
  requestId: string;
  screen: string;
  history: Turn[];
};

export async function askVoice(a: AskVoiceInput): Promise<AskVoiceResult> {
  const token = getAuthToken();
  // Never POST audio without a real session (mirrors uploadFile's guard).
  if (FORCE_DEMO || !isRealSession() || !token) return { ok: false, transport: 'unauthenticated' };

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, VOICE.CEILING_MS);

  try {
    const form = new FormData();
    if (Platform.OS === 'web') {
      const blob = await (await fetch(a.audioUri)).blob();
      form.append('audio', blob, 'voice.m4a');
    } else {
      // React Native's FormData accepts a { uri, name, type } part for a file on disk.
      form.append('audio', { uri: a.audioUri, name: 'voice.m4a', type: 'audio/m4a' } as unknown as Blob);
    }
    form.append('lang', a.lang);
    form.append('session_id', a.sessionId);
    form.append('request_id', a.requestId);
    form.append('screen', a.screen);
    form.append('history', JSON.stringify(a.history));

    const res = await fetch(`${API_BASE_URL}/voice/ask`, {
      method: 'POST',
      // NO Content-Type — fetch sets the multipart boundary itself (mirrors uploadFile in api.ts).
      headers: {
        Authorization: `Bearer ${token}`,
        'X-CGPE-Token': token,
        'X-CGPE-Request-Id': a.requestId,
        'X-CGPE-App-Version': APP.version,
      },
      body: form as unknown as BodyInit,
      signal: controller.signal,
    });

    // A non-200 is an outage per the contract — never a parseable reply.
    if (!res.ok) return { ok: false, transport: 'server', status: res.status };

    const json = await res.json().catch(() => null);
    // parseVoiceReply turns a null / empty / malformed 200 body into a VoiceReplyError (with transcript
    // if present) — so a broken n8n reply is a handled failure, not a throw.
    return parseVoiceReply(json);
  } catch {
    return { ok: false, transport: timedOut ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}
