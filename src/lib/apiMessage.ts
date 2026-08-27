/* ------------------------------------------------------------------ *
 * apiMessage — which of a failed response's two strings is fit to show a human.
 *
 * WHY THIS EXISTS. This backend answers a refusal with BOTH an `error` and a `message`,
 * and the two do not mean the same thing on every route:
 *
 *   • Most routes put a HUMAN SENTENCE in `error` — `middleware/errorHandler.js` emits
 *     `{ success:false, error: <the thrown message> }`, and hand-written refusals do the
 *     same (`routes/auth.js`: `error: 'Your account is inactive. Please contact
 *     administration.'`, `error: 'The code has expired. Please request a new one.'`).
 *   • The sign-in routes put a MACHINE TOKEN in `error` and the sentence in `message`
 *     — verified on the DEPLOYED backend (`origin/main`) and against live prod on
 *     2026-08-27: `POST /auth/login` with an unknown identifier returns
 *     `{"success":false,"error":"NO_ACCOUNT","message":"No account found with that email
 *     or mobile number. Please check for a typo (e.g. the domain is cgpe.in)."}`.
 *     `BAD_PASSWORD`, `OTP_NOT_CONFIGURED` and `OTP_DELIVERY_FAILED` are the same shape.
 *
 * The app used to read `json.error || json.message`, so the two commonest sign-in
 * failures in the whole product — a mistyped address and a wrong password — put the bare
 * words `NO_ACCOUNT` and `BAD_PASSWORD` on screen, under the heading "Sign in refused".
 * The sentence that would have told the user what to do was sitting unread in `message`.
 *
 * A BLANKET FLIP TO `message`-FIRST WOULD BE A REGRESSION, which is why this is a
 * function and not a one-character edit: the routes above genuinely carry their only
 * human copy in `error`, and several of them send no `message` at all. So the rule is
 * narrow and can only ever improve the outcome:
 *
 *   `error` wins, UNLESS it looks like a machine token — in which case `message` wins,
 *   and if there is no `message`, the caller's own fallback wins. A token is never shown.
 *
 * Pure and total: no network, no state, no throwing. Tested in `__tests__/apiMessage.test.ts`.
 * ------------------------------------------------------------------ */

/**
 * True when a string is a SCREAMING_SNAKE_CASE identifier rather than prose — the shape
 * this backend uses for a machine-readable reason code (`NO_ACCOUNT`, `BAD_PASSWORD`,
 * `OTP_NOT_CONFIGURED`, `CLIENT_BOOK_DENIED`, `LIMIT_FILE_SIZE`).
 *
 * Deliberately strict: it requires the WHOLE string to be upper-case letters, digits and
 * single underscores. Anything containing a space, a lower-case letter or punctuation is
 * prose and is left alone — so a real sentence can never be mistaken for a code and
 * suppressed. `'Validation failed'` and `'Access denied'` are prose by this rule, which
 * is correct: they are the only copy those routes send.
 */
export function isMachineCode(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(v);
}

/** The two string-carrying fields of a failed response body. Both optional and untrusted. */
export type ApiErrorBody = { error?: unknown; message?: unknown } | null | undefined;

/** A field that is a usable non-empty string, or '' — `unknown` in, string out. */
function str(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

/**
 * The sentence to show a user for a failed request.
 *
 * @param body     the parsed response body (may be null — a body that did not parse).
 * @param fallback the caller's own copy, used when the server sent nothing readable. It
 *                 is required, because "" on screen is worse than a generic sentence.
 */
export function humanApiMessage(body: ApiErrorBody, fallback: string): string {
  const error = str(body?.error);
  const message = str(body?.message);
  // Prose in `error` is this backend's normal shape — keep preferring it, unchanged.
  if (error && !isMachineCode(error)) return error;
  // `error` is a token (or absent): the human sentence, if there is one, lives in `message`.
  if (message) return message;
  // A token with no sentence. Showing `NO_ACCOUNT` tells the user nothing they can act on,
  // so the caller's copy is the honest answer — the token is dropped, never displayed.
  return fallback;
}
