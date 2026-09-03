/**
 * The voice turn pipeline — record → askVoice → parse → decide → speak/navigate — lifted verbatim from
 * the original VoiceSheet so both the sheet and the new full-screen VoiceMode share ONE glue path and
 * the tested `src/voice/*` seams stay untouched. v1 scope: reads + navigate + confirm-card display;
 * write EXECUTION stays dark.
 *
 * ⚠️ Uses the `expo-audio` `useAudioRecorder` hook, so this file is native and must be imported ONLY by
 * VoiceMode (← `_layout`, no route, no test). `level` is a Reanimated SharedValue the character reads on
 * the UI thread with zero re-render; unit 1 drives it synthetically, unit 2 swaps in real mic metering.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import {
  cancelAnimation, useSharedValue, withRepeat, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { useToast } from '@/ui/feedback';
import { haptics } from '@/lib/haptics';
import { useI18n } from '@/i18n';
import * as voiceAudio from '@/lib/voiceAudio';
import { askVoice, getVoiceStatus, isTransportError } from '@/voice/client';
import type { VoiceStatus } from '@/voice/status';
import { VOICE } from '@/voice/constants';
import { langForVoice, isRecordingTooShort } from '@/voice/request';
import { describeCause, describeTransport } from '@/voice/cause';
import { isAllowedVoiceRoute } from '@/voice/routes';
import { isAlreadyPreparedError } from '@/voice/recorderError';
import { expireIfIdle, historyForNlu, recordAssistantTurn, recordUserTurn } from '@/voice/session';
import { dbToAmp01, type VoiceCharacterState } from '@/ui/voice/voiceVisual';

export type VoiceTurn = {
  state: VoiceCharacterState;
  transcript: string;
  setTranscript: (s: string) => void;
  reply: string;
  /** The human sentence for the failure — the banner TITLE, not a hard-coded one. */
  error: string | null;
  /**
   * The technical reason behind `error`, shown under it. `null` when there is nothing useful to add.
   * Without this a failed turn is undiagnosable from anything but a USB cable — see `voice/cause.ts`.
   */
  cause: string | null;
  /** No retry can help (voice is switched off at the server) → the banner withholds "Try again". */
  permanent: boolean;
  /** 0..1 mic amplitude on the UI thread — the character/waveform read it with zero re-render. */
  level: SharedValue<number>;
  /** ms at which the current capture began (for the live duration + countdown). */
  startedAtRef: React.MutableRefObject<number>;
  startCapture: () => void;
  finishCapture: () => void;
  close: () => void;
  reset: () => void;
};

/** A short, unique-enough id for the turn — idempotency + tracing. Generated in a handler, not render. */
function newRequestId(): string {
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useVoiceTurn(onClose: () => void): VoiceTurn {
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const screen = usePathname();

  const [state, setState] = useState<VoiceCharacterState>('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The technical reason behind `error`, shown UNDER the friendly sentence. See `voice/cause.ts`:
  // without it a failed turn is undiagnosable from anything but a USB cable.
  const [cause, setCause] = useState<string | null>(null);
  // True when no retry can help — the server has voice switched off. Drives whether the banner is
  // allowed to offer "Try again", which for this case would be a promise the app cannot keep.
  const [permanent, setPermanent] = useState(false);
  const busy = useRef(false);
  const sessionIdRef = useRef('');
  const startedAtRef = useRef(0);
  /** The server's voice config, probed once when the surface opens. `null` until it answers (or if it
   *  could not be reached). Drives the fail-fast on `ready:false` and the per-turn abort budget. */
  const statusRef = useRef<VoiceStatus | null>(null);
  /**
   * ⚠️ THE NEXT THREE REFS EXIST BECAUSE REACT STATE CANNOT BE READ BY A HANDLER THAT RACES IT.
   *
   * `finishCapture` used to open with `if (state !== 'listening') return;` — reading the React state
   * captured in its closure. On the very first press that guard is ALWAYS false, because
   * `startCapture` awaits the Android microphone permission dialog before it ever calls
   * `setState('listening')`. The user's finger comes up while the dialog is open, `finishCapture`
   * returns having done nothing, and then the permission resolves and `startCapture` cheerfully
   * starts recording **with no finger on the button and nothing left to stop it**.
   *
   * That is the green microphone dot the owner photographed at 2:40 PM on 2026-09-01, still lit two
   * minutes later — and it is why the very next press died on
   * "AudioRecorder has already been prepared" (`expo-audio`'s `AudioRecorder.kt:84` refuses to
   * prepare a recorder that is still live). It also explains the owner's "pehli baar hold hi nahi
   * kar paaye": the first press was consumed by the permission dialog.
   *
   * So the capture lifecycle is tracked in refs, which are correct the instant they are written:
   *  • `heldRef`  — is the button physically down RIGHT NOW (not "did React re-render yet").
   *  • `liveRef`  — has the recorder been prepared/started and not yet torn down.
   *  • `maxTimer` — the `VOICE.MAX_RECORD_MS` guillotine (see `startCapture`).
   */
  const heldRef = useRef(false);
  const liveRef = useRef(false);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Latest `finishCapture`, so the max-duration timer can call it without a circular dependency. */
  const finishRef = useRef<() => void>(() => {});

  const recorder = useAudioRecorder(
    useMemo(() => ({ ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, isMeteringEnabled: true }), []),
  );
  const level = useSharedValue(0);

  // Drive `level` (0..1) on the UI thread. While LISTENING, sample the recorder's real mic metering
  // (dBFS from `getStatus().metering`, Android-implemented) every ~70 ms and smooth it with withTiming;
  // if a device exposes no metering, fall back to a synthetic oscillation so the character never looks
  // dead. SPEAKING has no playback metering, so it uses a procedural envelope. Zero React re-render.
  useEffect(() => {
    cancelAnimation(level);
    if (state === 'listening') {
      const id = setInterval(() => {
        let amp: number | null = null;
        try {
          const m = recorder.getStatus?.()?.metering;
          if (typeof m === 'number' && Number.isFinite(m)) amp = dbToAmp01(m);
        } catch { /* getStatus unavailable on this build */ }
        if (amp == null) amp = 0.28 + 0.28 * Math.abs(Math.sin(Date.now() / 190)); // synthetic fallback
        level.value = withTiming(amp, { duration: 80 });
      }, 70);
      return () => clearInterval(id);
    }
    if (state === 'speaking') {
      level.value = withRepeat(withTiming(0.55, { duration: 520 }), -1, true);
      return () => cancelAnimation(level);
    }
    level.value = withTiming(0, { duration: 200 });
    return () => cancelAnimation(level);
  }, [state, level, recorder]);

  /**
   * Ask for the microphone ONCE, when voice mode opens — not on the first press.
   *
   * The Android permission dialog is modal and steals the touch, so a first-time user's very first
   * hold was consumed by it: they never got to speak, and the capture that started when they tapped
   * "Allow" had no finger holding it. The owner reported exactly this — "pehli baar andar wala mic
   * hold hi nahi kar paaye". Asking on open means the button behaves the same on the first press as
   * on the hundredth. A refusal is NOT reported here: `startCapture` still asks and still shows
   * `voice.micDenied`, so nothing is lost if the user declines or answers late.
   */
  useEffect(() => {
    void voiceAudio.ensureMicPermission();
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
    setCause(null);
    setPermanent(false);
  }, []);

  const fail = useCallback((msg: string, why?: string | null, isPermanent = false) => {
    haptics.error();
    setState('error');
    setError(msg);
    setCause(why ?? null);
    setPermanent(isPermanent);
  }, []);

  /**
   * Probe the server's voice config when the surface opens (`GET /voice/status`). Three payoffs, all
   * aimed at the owner's "we speak and nothing comes back":
   *  • FAIL FAST — if `ready:false`, say "voice is not switched on for this server yet" and name the
   *    missing leg, BEFORE the user records and waits through a turn that could only 503. That wait is
   *    almost certainly the whole symptom.
   *  • SIZE THE ABORT — stash `budgetMs` so the turn aborts at the server's real budget, not a guess.
   *  • TEXT-ONLY — `ready` is `stt && brain`; TTS is separate, so a ready server with no TTS returns
   *    text and no audio. Say so once, so a missing voice-back is not mistaken for total failure.
   * A `null` probe (offline / no session / non-200) is left to the turn itself, which surfaces a
   * normal transport error — the probe must never block the mic on its own inability to answer. Placed
   * AFTER `fail`/`toast` so it does not read a block-scoped callback before its declaration.
   */
  useEffect(() => {
    let alive = true;
    void getVoiceStatus().then((s) => {
      if (!alive || !s) return;
      statusRef.current = s;
      if (!s.ready) {
        fail(
          t('voice.notSetUp'),
          s.missing.length ? `Server voice config missing: ${s.missing.join(', ')}` : null,
          true,
        );
      } else if (!s.hasTts) {
        toast(t('voice.textOnly'), 'info');
      }
    });
    return () => { alive = false; };
  }, [fail, t, toast]);

  /**
   * Stop and release the recorder if we ever started one. Idempotent and never throws, so it is safe
   * on every exit path — a released button, a thrown prepare, closing the overlay, unmounting.
   * Returns the recorded file's uri when there is one.
   *
   * This is the piece whose absence caused the stuck recording: there was no single place that
   * guaranteed teardown, so the paths that did not go through `finishCapture` simply leaked.
   */
  const teardown = useCallback(async (): Promise<string | null> => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (!liveRef.current) return null;
    liveRef.current = false;
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch {
      /* already stopped / never started — the point is only that it is not live now */
    }
    await voiceAudio.endCaptureSession();
    return uri;
  }, [recorder]);

  const startCapture = useCallback(async () => {
    heldRef.current = true;
    if (busy.current) return;
    // Voice is switched off at the server (known from the /status probe on open). The effect above
    // already showed the "not set up" state; a hold must not start a recording that can only 503.
    if (statusRef.current && statusRef.current.ready === false) {
      heldRef.current = false;
      fail(
        t('voice.notSetUp'),
        statusRef.current.missing.length ? `Server voice config missing: ${statusRef.current.missing.join(', ')}` : null,
        true,
      );
      return;
    }
    setError(null);
    setCause(null);
    setPermanent(false);

    // Permission is normally already granted here — it is pre-warmed when voice mode opens (see the
    // effect above) precisely so the FIRST hold works. This call is the fallback for the case where
    // the user answered the dialog after that, or revoked it in Settings.
    const ok = await voiceAudio.ensureMicPermission();
    if (!ok) {
      heldRef.current = false;
      toast(t('voice.micDenied'), 'warning');
      return;
    }
    // Released while the permission dialog was up. Starting now would record with no finger down.
    if (!heldRef.current) return;

    let firstPrepareError: unknown = null;
    try {
      if (!sessionIdRef.current) sessionIdRef.current = newRequestId();
      haptics.heavy();
      setState('listening');
      startedAtRef.current = Date.now();
      await voiceAudio.beginCaptureSession();

      // The hook is prepared with HIGH_QUALITY *modified* — mono, plus metering for the waveform.
      // Mono was a bandwidth optimisation, not a requirement, and Android's AAC encoder is entitled
      // to refuse a channel/sample-rate/bitrate combination the vendor never shipped as a preset.
      // So: try our options, and if the encoder rejects them, prepare again with the UNMODIFIED
      // preset before giving up. `prepareToRecordAsync` takes per-call overrides, so this costs one
      // extra call only on a device that would otherwise have failed outright. Speech-to-text does
      // not care how many channels it gets; a user who cannot record at all does.
      //
      // ⚠️ BUT NOT FOR EVERY FAILURE. "AudioRecorder has already been prepared" is a STATE fault —
      // a previous capture was never torn down — and re-preparing throws the identical error,
      // because nothing changed between the two calls. That is what the owner's 2026-09-01
      // screenshot showed. There the recovery is to stop the stale session and prepare once more.
      try {
        await recorder.prepareToRecordAsync();
      } catch (prepErr) {
        if (isAlreadyPreparedError(prepErr)) {
          liveRef.current = true;       // it IS live — teardown must be allowed to stop it
          await teardown();
          await voiceAudio.beginCaptureSession();
          await recorder.prepareToRecordAsync();
        } else {
          // Keep the FIRST error: it names the option the encoder objected to, which is the useful
          // one. If the fallback also throws, the outer catch reports that instead.
          firstPrepareError = prepErr;
          await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
        }
      }

      // Released during `beginCaptureSession`/`prepare`. The recorder is prepared but must not run.
      if (!heldRef.current) {
        liveRef.current = true;
        await teardown();
        setState('idle');
        return;
      }

      recorder.record();
      liveRef.current = true;

      // `VOICE.MAX_RECORD_MS` (15 s) is the contract's hard cap and until now had ZERO consumers —
      // nothing anywhere enforced it, so a capture that lost its release could grow without bound.
      // The owner's stuck session ran for at least two minutes, and the upload that followed failed
      // at the transport layer, which is exactly what an oversized body looks like from here.
      maxTimerRef.current = setTimeout(() => {
        heldRef.current = false;
        finishRef.current();
      }, VOICE.MAX_RECORD_MS);
    } catch (e) {
      // The recorder is the likeliest thing to fail on a handset we have never tested on, and it is
      // the one failure the user CAN see. Keep what it actually said, and never leave it live.
      await teardown();
      fail(t('voice.failed'), describeCause(firstPrepareError ?? e));
    }
  }, [recorder, teardown, toast, t, fail]);

  const finishCapture = useCallback(async () => {
    heldRef.current = false;
    // ⚠️ `liveRef`, NOT the React `state`. See the ref block above: on the first press `state` is
    // still 'idle' here because `startCapture` is parked on the permission dialog, and gating on it
    // is what let a recording outlive the press.
    if (!liveRef.current || busy.current) return;
    busy.current = true;
    setState('thinking');
    const durationMs = Date.now() - startedAtRef.current;
    const uri = await teardown();

    if (!uri || isRecordingTooShort(durationMs)) {
      busy.current = false;
      toast(t('voice.tooShort'), 'info');
      setState('idle');
      return;
    }

    // The proxy chains three vendor calls (STT -> brain -> TTS), so a healthy turn can genuinely run
    // past SLOW_MS. Say so, rather than leaving the character sitting in 'thinking' looking hung. The
    // alternative - aborting - discards an answer the server is still producing and bills it twice.
    // §7: drop stale multi-turn context BEFORE it reaches the NLU. If the app has been idle or
    // backgrounded past SESSION_IDLE_MS since the last turn, those turns are no longer "this
    // conversation" — sending them would let the model resolve a pronoun ("uska number") against a
    // different task, and on a shared handset carry the previous user's spoken context forward. This
    // is the sole enforcement of the §7 idle window; `historyForNlu()` below then returns only turns
    // recent enough to belong to this conversation.
    expireIfIdle(Date.now());
    const slow = setTimeout(() => toast(t('voice.stillWorking'), 'info'), VOICE.SLOW_MS);
    try {
      const result = await askVoice({
        audioUri: uri,
        lang: langForVoice(lang),
        sessionId: sessionIdRef.current,
        requestId: newRequestId(),
        screen: screen ?? '/',
        history: historyForNlu(),
        // Size the abort to the server's real budget when the /status probe read it; else the
        // generous CEILING_MS fallback (an over-long ceiling never truncates a healthy turn).
        budgetMs: statusRef.current?.budgetMs ?? null,
      });

      if (isTransportError(result)) {
        // Three different fixes, so three different sentences. `unconfigured` is the one that must
        // NOT carry "please try again": voice is off at the server and no retry can turn it on.
        fail(
          result.transport === 'unconfigured'
            ? t('voice.notSetUp')
            : result.transport === 'timeout' || result.transport === 'server'
              ? t('voice.failed')
              : t('voice.offline'),
          describeTransport(result.transport, result.status, result.detail),
          result.transport === 'unconfigured',
        );
        return;
      }
      if (!result.ok) {
        if (result.transcript) setTranscript(result.transcript);
        fail(t('voice.notUnderstood'));
        return;
      }

      setTranscript(result.transcript);
      recordUserTurn(result.transcript, Date.now());
      if (result.lowConfidence) {
        setState('idle');
        toast(t('voice.notUnderstood'), 'info');
        return;
      }

      setReply(result.replyText);
      recordAssistantTurn(result.replyText, Date.now());
      setState('speaking');
      haptics.tap();
      if (result.audio.mode !== 'none' && result.audio.url) void voiceAudio.play(result.audio.url);

      if (result.action.type === 'navigate' && isAllowedVoiceRoute(result.action.route)) {
        onClose();
        router.push({ pathname: result.action.route, params: (result.action.params ?? {}) as Record<string, string> } as Href);
        return;
      }
      // 'none' or a confirm_write (display only in v1): leave the answer on screen, then relax to idle.
      setTimeout(() => setState((s) => (s === 'speaking' ? 'idle' : s)), 1400);
    } catch (e) {
      fail(t('voice.failed'), describeCause(e));
    } finally {
      clearTimeout(slow);
      busy.current = false;
    }
  }, [teardown, screen, lang, t, toast, fail, onClose, router]);

  // The max-duration timer fires from inside `startCapture`, which is defined BEFORE `finishCapture`.
  // Routing through a ref keeps the two out of a dependency cycle without either of them going stale.
  useEffect(() => { finishRef.current = finishCapture; }, [finishCapture]);

  // Unmounting must not leave the microphone open either — the overlay can go away without `close()`
  // (a session expiry, an app-lock, a parent re-render). `teardown` is idempotent, so this is free.
  useEffect(() => () => { void teardown(); }, [teardown]);

  const close = useCallback(() => {
    voiceAudio.stopPlayback();
    // Closing the overlay must not leave the microphone open. Before the ref rewrite there was no
    // path here at all, so closing mid-capture left the recorder live and the green mic dot lit.
    heldRef.current = false;
    void teardown();
    busy.current = false;
    sessionIdRef.current = '';
    setTranscript('');
    setReply('');
    reset();
    onClose();
  }, [onClose, reset, teardown]);

  return { state, transcript, setTranscript, reply, error, cause, permanent, level, startedAtRef, startCapture, finishCapture, close, reset };
}
