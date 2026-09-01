/**
 * Turn whatever a failed voice turn threw into ONE short line a person can read off a screenshot.
 *
 * WHY THIS EXISTS. On 2026-09-01 the first APK carrying voice failed at "Hold to speak" and the app
 * said only *"Something went wrong. Please try again."* — twice, because `VoiceMode`'s banner
 * hard-codes that sentence as its title and was handed the same sentence again as its message. The
 * `catch` blocks in `useVoiceTurn` discarded the exception entirely, so the one fact that would have
 * identified the fault never left the device. Diagnosis then needs a USB cable and `adb logcat`,
 * which is not something a field agent can produce.
 *
 * So: the friendly sentence stays the title, and THIS goes underneath it. It is deliberately terse
 * and deliberately technical — it is a diagnostic breadcrumb, not copy, which is why it is not
 * translated (a translated exception message helps nobody) and why it is capped: a native error can
 * carry a multi-kilobyte stack, and a banner is not a log viewer.
 */

/** Longest cause we will show. Two lines on a phone; enough for an exception class + message. */
const MAX = 160;

/**
 * Best-effort one-liner for a thrown value. Returns `null` when there is genuinely nothing to say,
 * so a caller can fall back to its own copy rather than printing "undefined" at a user.
 */
export function describeCause(e: unknown): string | null {
  if (e == null) return null;

  let raw: string;
  if (typeof e === 'string') raw = e;
  else if (e instanceof Error) raw = e.message || e.name || '';
  else if (typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string') {
    raw = (e as { message: string }).message;
  } else {
    // `String(obj)` is usually '[object Object]', which is noise pretending to be information.
    raw = typeof e === 'object' ? '' : String(e);
  }

  // Collapse newlines/tabs from a native stack so the banner stays two lines, not twenty.
  const line = raw.replace(/\s+/g, ' ').trim();
  if (!line) return null;
  return line.length > MAX ? `${line.slice(0, MAX - 1)}…` : line;
}

/**
 * The same breadcrumb for a transport failure, where there is no exception — only the kind we
 * classified and, sometimes, the HTTP status. `unconfigured` is included even though its copy
 * already explains itself, because knowing the status behind it (404 = not deployed vs 503 = keys
 * unset) is exactly the distinction OPS needs and the sentence deliberately hides.
 */
export function describeTransport(transport: string, status?: number, detail?: string | null): string {
  const head = status ? `${transport} (HTTP ${status})` : transport;
  const tail = (detail ?? '').replace(/\s+/g, ' ').trim();
  if (!tail) return head;
  const line = `${head} — ${tail}`;
  return line.length > MAX ? `${line.slice(0, MAX - 1)}…` : line;
}
